import os
import sys
import time
import argparse
import requests
import random
from datetime import datetime

# Include project path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Robust imports for optional libraries
try:
    import pandas as pd
    PANDAS_OK = True
except ImportError:
    PANDAS_OK = False

from pipeline.ingestion import generate_live_stream_point, load_and_align, load_aditya_data
from pipeline.features import compute_latest_features, compute_latest_features_pure
from pipeline.nowcast import nowcast_predict
from pipeline.forecast import forecast_predict
from pipeline.aggregator import AlertAggregator

def fill_history_buffer(buffer, num_points=800):
    """Fills the history buffer with quiet-sun baseline points so models can immediately run."""
    print("Initializing history buffer with baseline solar activity...")
    base_time = time.time() - num_points * 5
    for i in range(num_points):
        t_sec = base_time + i * 5
        point = generate_live_stream_point(t_sec, flare_active=False)
        buffer.append(point)

def fetch_latest_noaa_tick(last_time_tag=None):
    try:
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        url = "https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json"
        r = requests.get(url, verify=False, timeout=3.0)
        if r.status_code != 200:
            return None, last_time_tag
        data = r.json()
        if not data:
            return None, last_time_tag
            
        points = {}
        for item in data:
            tt = item.get('time_tag')
            energy = item.get('energy')
            flux = item.get('flux')
            if not tt or not energy or flux is None:
                continue
            if tt not in points:
                points[tt] = {}
            if energy == '0.1-0.8nm':
                points[tt]['soft'] = flux
            elif energy == '0.05-0.4nm':
                points[tt]['hard'] = flux
                
        sorted_tts = sorted(points.keys())
        if not sorted_tts:
            return None, last_time_tag
            
        latest_tt = sorted_tts[-1]
        if last_time_tag and latest_tt == last_time_tag:
            return None, last_time_tag
            
        latest_val = points[latest_tt]
        if 'soft' in latest_val and 'hard' in latest_val:
            dt = datetime.strptime(latest_tt, "%Y-%m-%dT%H:%M:%SZ")
            t_sec = int(dt.timestamp())
            
            hard_proxy = latest_val['hard'] * 3.0e9
            
            telemetry = {
                'time': t_sec,
                'soft_flux': latest_val['soft'],
                'hard_15_25': hard_proxy * 2.2,
                'hard_25_50': hard_proxy,
                'hard_50_100': hard_proxy * 0.12,
                'data_gap': False,
                'time_tag': latest_tt
            }
            return telemetry, latest_tt
        return None, last_time_tag
    except Exception as e:
        print(f"Error checking NOAA tick: {e}")
        return None, last_time_tag

def main():
    parser = argparse.ArgumentParser(description="SOLAR FLARE FORECASTING Pipeline Orchestrator")
    parser.add_argument("--mode", type=str, default="live", choices=["live", "replay", "aditya"], help="Run mode")
    parser.add_argument("--event", type=int, default=6, help="Event ID for replay")
    parser.add_argument("--speed", type=float, default=1.0, help="Simulation speed multiplier")
    parser.add_argument("--api-url", type=str, default="http://localhost:8000/api/update", help="FastAPI update endpoint")
    args = parser.parse_args()
    
    print(f"Starting pipeline in {args.mode.upper()} mode...")
    
    aggregator = AlertAggregator()
    
    # Telemetry history buffer
    history_buffer = []
    fill_history_buffer(history_buffer, num_points=800)
    
    # Setup data source
    replay_records = []
    replay_idx = 0
    
    # Try to load replay data
    if args.mode == "replay":
        solexs_json = f"data/raw/solexs/solexs_20240915_level2.json"
        helios_json = f"data/raw/helios/helios_20240915_level1.json"
        
        if os.path.exists(solexs_json) and os.path.exists(helios_json):
            print("Loading historical aligned telemetry for replay...")
            try:
                aligned = load_and_align(solexs_json, helios_json)
                # Sample every 5th record to match 5-second tick cadence
                replay_records = aligned[::5]
                print(f"Loaded {len(replay_records)} replay records.")
            except Exception as e:
                print(f"Error loading replay data: {e}. Falling back to simulation.")
                
    # ADITYA mode: load real Aditya-L1 PRADAN data
    if args.mode == "aditya":
        print("Loading real Aditya-L1 data from PRADAN archive...")
        try:
            aditya_data = load_aditya_data(sample_every=60)
            if aditya_data and len(aditya_data) > 10:
                replay_records = aditya_data
                print(f"Loaded {len(replay_records)} real Aditya-L1 records from PRADAN!")
            else:
                print("Aditya-L1 data empty or not found.")
        except Exception as e:
            print(f"Error loading Aditya-L1 data: {e}")
                
    # Fallback simulation if replay data empty
    if args.mode in ("replay", "aditya") and not replay_records:
        print("Simulating replay stream for Event ID", args.event)
        duration_ticks = 720
        base_time = time.time()
        for i in range(duration_ticks):
            flare_active = 180 <= i < 480
            point = generate_live_stream_point(base_time + i * 5, flare_active=flare_active)
            replay_records.append(point)
            
    # Main loop setup
    tick_interval = 5.0 / args.speed
    print(f"Running loop. Tick interval: {tick_interval:.2f}s (Speed: {args.speed}x)")
    
    live_tick = 0
    last_noaa_tag = None
    last_known_noaa = None
    
    try:
        while True:
            start_tick = time.time()
            t_sec = time.time()
            
            # 1. Fetch new telemetry based on mode
            if args.mode == "replay":
                if replay_idx >= len(replay_records):
                    print("Replay completed. Restarting...")
                    replay_idx = 0
                telemetry = replay_records[replay_idx].copy()
                replay_idx += 1
                telemetry['time'] = int(t_sec)
            elif args.mode == "aditya":
                if replay_idx >= len(replay_records):
                    print("Aditya replay completed. Restarting...")
                    replay_idx = 0
                telemetry = replay_records[replay_idx].copy()
                replay_idx += 1
                telemetry['time'] = int(t_sec)
            else: # "live" mode
                # Try fetching live NOAA data
                new_telemetry, latest_noaa_tag = fetch_latest_noaa_tick(last_noaa_tag)
                if new_telemetry:
                    last_noaa_tag = latest_noaa_tag
                    last_known_noaa = new_telemetry
                    print(f"[NOAA SYNC] Fetched latest NOAA X-ray tick: {last_noaa_tag}")
                
                if last_known_noaa:
                    # Stream last known NOAA data with current time & small dynamic fluctuation
                    telemetry = last_known_noaa.copy()
                    telemetry['time'] = int(t_sec)
                    fluct_soft = random.gauss(0, telemetry['soft_flux'] * 0.01)
                    fluct_hard = random.gauss(0, telemetry['hard_25_50'] * 0.01)
                    telemetry['soft_flux'] = max(1e-9, telemetry['soft_flux'] + fluct_soft)
                    telemetry['hard_25_50'] = max(0.1, telemetry['hard_25_50'] + fluct_hard)
                    telemetry['hard_15_25'] = telemetry['hard_25_50'] * 2.2
                    telemetry['hard_50_100'] = telemetry['hard_25_50'] * 0.12
                else:
                    # Offline/initial fallback: simulated active flare cycle
                    flare_active = (live_tick % 180) > 60 and (live_tick % 180) < 120
                    telemetry = generate_live_stream_point(t_sec, flare_active=flare_active)
                    live_tick += 1
                
            # Append to history
            history_buffer.append(telemetry)
            if len(history_buffer) > 2000:
                history_buffer.pop(0)
                
            # 2. Compute features
            if PANDAS_OK:
                buf_df = pd.DataFrame(history_buffer)
                features = compute_latest_features(buf_df).tolist()
            else:
                features = compute_latest_features_pure(history_buffer)
                
            # 3. Model predictions
            # Construct inputs from history
            x_nowcast = []
            for offset in range(60, 0, -1):
                if len(history_buffer) >= offset:
                    x_nowcast.append(compute_latest_features_pure(history_buffer[:-offset]))
                else:
                    x_nowcast.append(features)
                    
            x_forecast = []
            for offset in range(720, 0, -1):
                if len(history_buffer) >= offset:
                    x_forecast.append(compute_latest_features_pure(history_buffer[:-offset]))
                else:
                    x_forecast.append(features)
                    
            _, nc_class, nc_conf = nowcast_predict(x_nowcast)
            fc_prob = forecast_predict(x_forecast)
            
            # Auto-retrain: use trained model predictions directly.
            # Physics-based sanity clamp: only override if model outputs are
            # wildly out of range (data gap / NaN protection).
            soft_flux = telemetry['soft_flux']
            hr_val = features[2]
            if nc_class == "—" and soft_flux > 1.5e-6:
                nc_class = "QUIET"
            fc_prob = max(0.01, min(0.99, fc_prob))  # Clamp to valid range
                
            # 4. Aggregate
            ts_str = datetime.utcfromtimestamp(t_sec).isoformat() + "Z"
            status = aggregator.process_tick(
                timestamp_utc=ts_str,
                telemetry=telemetry,
                features=features,
                nowcast_probs=None,
                nowcast_class=nc_class,
                nowcast_conf=nc_conf,
                forecast_prob=fc_prob
            )
