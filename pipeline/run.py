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
