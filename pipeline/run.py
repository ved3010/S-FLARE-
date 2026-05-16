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
