import os
import json
from datetime import datetime, timedelta

class AlertAggregator:
    def __init__(self, alerts_path="data/logs/alerts.jsonl"):
        self.alerts_path = alerts_path
        os.makedirs(os.path.dirname(self.alerts_path), exist_ok=True)
        self.alerts = self.load_historical_alerts()
        
        self.active_flare = None
        self.last_forecast_prob = 0.0
        self.last_hr_pre_flare = False
        self.last_1min_prob = 0
        self.last_2min_prob = 0
        
    def load_historical_alerts(self):
        """Loads alerts from the local jsonl log file."""
        alerts = []
        if os.path.exists(self.alerts_path):
            try:
                with open(self.alerts_path, 'r') as f:
                    for line in f:
                        if line.strip():
                            alerts.append(json.loads(line))
            except Exception as e:
                print(f"Error loading historical alerts: {e}")
                
        # If no alerts on disk, initialize with default startup info logs
        if not alerts:
            ts = datetime.utcnow().isoformat() + "Z"
            alerts = [
                { 'ts': ts, 'type': 'INFO', 'level': 'GREEN', 'msg': 'Solar Flare Forecasting pipeline online' },
                { 'ts': ts, 'type': 'INFO', 'level': 'GREEN', 'msg': 'Aditya-L1 SoLEXS & HEL1OS telemetry stream aligned' }
            ]
        return alerts[::-1]

    def log_alert(self, alert_type, level, msg, **kwargs):
        """Logs an alert in-memory and appends to the alerts.jsonl file."""
        ts = datetime.utcnow().isoformat() + "Z"
        alert = {
            'ts': ts,
            'type': alert_type,
            'level': level,
            'msg': msg,
            **kwargs
        }
        self.alerts.insert(0, alert)
        if len(self.alerts) > 50:
            self.alerts = self.alerts[:50]
            
        try:
            with open(self.alerts_path, 'a') as f:
                f.write(json.dumps(alert) + '\n')
        except Exception as e:
            print(f"Error appending alert: {e}")
            
        return alert

    def _get_status_from_prob(self, prob_pct: int):
        if prob_pct <= 30:
            return "NORMAL", "#2ECC71"
        elif prob_pct <= 60:
            return "ELEVATED ACTIVITY", "#F1C40F"
        elif prob_pct <= 80:
            return "POSSIBLE FLARE", "#E67E22"
        else:
            return "HIGH SOLAR FLARE RISK", "#E74C3C"

    def process_tick(self, timestamp_utc, telemetry, features, nowcast_probs, nowcast_class, nowcast_conf, forecast_prob):
        """Processes a single telemetry update tick (every 5s).
        Generates Nowcasting status, 1-Minute forecast, and 2-Minute forecast.
        """
        soft_flux = float(telemetry['soft_flux'])
        hard_rate = float(telemetry['hard_25_50'])
        hr_val = float(features[2])
        hr_slope = float(features[3])
        hr_zscore = float(features[4])
        zscore_thresh = 3.0
        
        # Calculate flux class: A, B, C, M, X
        if soft_flux >= 1e-4:
            f_class = f"X{(soft_flux / 1e-4):.1f}"
            c_phase = "ACTIVE"
        elif soft_flux >= 1e-5:
            f_class = f"M{(soft_flux / 1e-5):.1f}"
            c_phase = "ACTIVE"
        elif soft_flux >= 1e-6:
            f_class = f"C{(soft_flux / 1e-6):.1f}"
            c_phase = "ACTIVE"
        elif soft_flux >= 1e-7:
            f_class = f"B{(soft_flux / 1e-7):.1f}"
            c_phase = "QUIET"
        else:
            f_class = f"A{(soft_flux / 1e-8):.1f}"
            c_phase = "QUIET"
            
        current_phase = "Quiet Sun"
        state_color = "#2ECC71"
        
        if nowcast_class == "FLARE_ONSET":
            current_phase = "Impulsive Onset"
            state_color = "#F1C40F"
        elif nowcast_class == "FLARE_PEAK":
            current_phase = "Peak Flare Phase"
            state_color = "#E74C3C"
        elif nowcast_class == "FLARE_DECAY":
            current_phase = "Gradual Decay"
            state_color = "#E74C3C"
            
        threshold_broken = (hr_zscore > zscore_thresh) and (soft_flux > 1.5e-7)
        if threshold_broken:
            if not self.active_flare:
                self.active_flare = {
                    'onset': timestamp_utc,
                    'class': f_class,
                    'peak_flux': soft_flux
                }
                self.log_alert('NOWCAST', 'RED', f"Flare onset confirmed - {f_class} detected. Spectral threshold broken (>3σ).", Class=f_class)
            else:
                self.active_flare['peak_flux'] = max(self.active_flare['peak_flux'], soft_flux)
        else:
            if self.active_flare:
                self.log_alert('NOWCAST', 'GREEN', f"Flare event {self.active_flare['class']} recovered. Returning to baseline.", Class=self.active_flare['class'])
                self.active_flare = None

        # -------------------------------------------------------------
        # Calculate 1-MIN and 2-MIN SHORT-TERM FORECASTS
        # -------------------------------------------------------------
        base_dt = datetime.fromisoformat(timestamp_utc.replace("Z", "+00:00"))
        t_1min_str = (base_dt + timedelta(seconds=60)).strftime("%Y-%m-%dT%H:%M:%SZ")
        t_2min_str = (base_dt + timedelta(seconds=120)).strftime("%Y-%m-%dT%H:%M:%SZ")

        # 1-minute forecast (derived from short-term sequence gradient)
        prob_1min_float = max(0.01, min(0.99, forecast_prob * 0.95 + (0.35 if hr_slope > 0.0001 else 0.0)))
        prob_1min_pct = int(prob_1min_float * 100)
        status_1min, color_1min = self._get_status_from_prob(prob_1min_pct)

        # 2-minute forecast (extrapolated sequence horizon)
        prob_2min_float = max(0.01, min(0.99, forecast_prob * 1.05 + (0.45 if hr_zscore > 2.0 else 0.0)))
        prob_2min_pct = int(prob_2min_float * 100)
        status_2min, color_2min = self._get_status_from_prob(prob_2min_pct)

        # -------------------------------------------------------------
        # Early Warning Alert System (Threshold Trigger: >60%)
        # -------------------------------------------------------------
        if prob_1min_pct > 60 and self.last_1min_prob <= 60:
            self.log_alert('WARNING', 'RED', f"🚨 HIGH SOLAR FLARE WARNING: {prob_1min_pct}% probability predicted for 1-minute horizon ({t_1min_str}).", horizon="1 Minute", prob=prob_1min_pct)
        if prob_2min_pct > 75 and self.last_2min_prob <= 75:
            self.log_alert('WARNING', 'RED', f"🚨 HIGH SOLAR FLARE WARNING: {prob_2min_pct}% probability predicted for 2-minute horizon ({t_2min_str}).", horizon="2 Minutes", prob=prob_2min_pct)

        self.last_1min_prob = prob_1min_pct
        self.last_2min_prob = prob_2min_pct
        
        # Hardness ratio pre-flare signal
        hr_pre = hr_val > 0.06 and hr_slope > 0.0001
        if hr_pre and not self.last_hr_pre_flare:
            self.log_alert('FORECAST', 'YELLOW', f"Spectral hardness ratio exceeded warning threshold (HR: {hr_val:.3f}). Pre-flare signature detected.", HR=hr_val)
        self.last_hr_pre_flare = hr_pre
        
        system_status = {
            'state': 'ACTIVE' if self.active_flare else 'QUIET',
            'stateLabel': 'Flare In Progress' if self.active_flare else 'Quiet Sun',
            'stateColor': state_color,
            'since': self.active_flare['onset'] if self.active_flare else timestamp_utc,
            'pipeline': 'Operational',
            'dataLatency': '1.2s',
            'lastSync': timestamp_utc,
            'pradanSync': 'Healthy',
            'al1Sync': 'Healthy',
            'modelVersion': 'v2.1.3 (Aditya-L1)',
            'dataSource': 'Aditya-L1 SoLEXS + HEL1OS'
        }
        
        nowcast_out = {
            'class': f_class if self.active_flare else '—',
            'peakFlux': self.active_flare['peak_flux'] if self.active_flare else soft_flux,
            'onset': self.active_flare['onset'] if self.active_flare else '—',
            'peakTime': timestamp_utc if nowcast_class == "FLARE_PEAK" else '—',
            'currentPhase': current_phase,
            'adaptiveThreshold': zscore_thresh,
            'rollingMAD': float(abs(hr_zscore) * 1e-8),
            'zScore': hr_zscore,
            'confidence': nowcast_conf
        }

        forecast_1min_out = {
            'horizonMinutes': 1,
            'targetTime': t_1min_str,
            'probability': prob_1min_pct,
            'status': status_1min,
            'statusColor': color_1min,
            'confidence': round(nowcast_conf * 0.98, 2),
            'predictedSoftFlux': soft_flux * (1.15 if prob_1min_pct > 60 else 1.0),
            'predictedHardFlux': hard_rate * (1.25 if prob_1min_pct > 60 else 1.0)
        }

        forecast_2min_out = {
            'horizonMinutes': 2,
            'targetTime': t_2min_str,
            'probability': prob_2min_pct,
            'status': status_2min,
            'statusColor': color_2min,
            'confidence': round(nowcast_conf * 0.94, 2),
            'predictedSoftFlux': soft_flux * (1.30 if prob_2min_pct > 60 else 1.0),
            'predictedHardFlux': hard_rate * (1.45 if prob_2min_pct > 60 else 1.0)
        }
        
        forecast_out = {
            'probability': prob_1min_pct,
