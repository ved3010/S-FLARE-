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
