import os
import json
import math
import io
import urllib.request
import pandas as pd
from datetime import datetime, timedelta
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from api.models import (
    UnifiedStatusModel, TimeseriesPoint, CatalogEventModel,
    ValidationMetricsModel, AlertModel, ModelComparisonItemModel,
    DatasetSummaryModel
)
from api.ws import manager
from pipeline.auto_train import start_auto_retrain
from pipeline.ml_models import model_manager
from pipeline.short_term import forecast_from_history

app = FastAPI(title="Solar Flare Forecasting API")

# Allow CORS for local dev environment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8000", "http://127.0.0.1:5173", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory stores for runtime
_latest_status = None
_timeseries_history = []
_alerts_history = []

def get_noaa_goes_history():
    try:
        import ssl
        context = ssl._create_unverified_context()
        url = "https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=context, timeout=5.0) as response:
            data = json.loads(response.read().decode('utf-8'))
            
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
                
        aligned = []
        for tt, val in points.items():
            if 'soft' in val and 'hard' in val:
                try:
                    dt = datetime.strptime(tt, "%Y-%m-%dT%H:%M:%SZ")
                    ts_ms = int(dt.timestamp() * 1000)
                    aligned.append((ts_ms, val['soft'], val['hard']))
                except Exception:
                    continue
                    
        aligned.sort(key=lambda x: x[0])
        return aligned[-1000:]
    except Exception as e:
        print(f"Error fetching NOAA history: {e}")
        return None

# Initialize historical telemetry at startup so charts are pre-populated
def init_history():
    global _timeseries_history, _latest_status, _alerts_history
    print("Pre-populating historical data...")
    
    # Set default status immediately so API responds right away
    ts_str = datetime.utcnow().isoformat() + "Z"
    _latest_status = {
        'systemStatus': {
            'state': 'QUIET',
            'stateLabel': 'Quiet Sun',
            'stateColor': '#2ECC71',
            'since': ts_str,
            'pipeline': 'Operational',
            'dataLatency': '1.2s',
            'lastSync': ts_str,
            'pradanSync': 'Healthy',
            'al1Sync': 'Sample telemetry loaded',
            'modelVersion': 'Recent 5-minute log-linear baseline',
            'dataSource': 'SAMPLE — local SoLEXS + HEL1OS telemetry',
            'dataMode': 'SAMPLE'
        },
        'nowcast': {
            'class': '—',
            'peakFlux': 5.2e-8,
            'onset': '—',
            'peakTime': '—',
            'currentPhase': 'Quiet Sun',
            'adaptiveThreshold': 3.0,
            'rollingMAD': 2.8e-8,
            'zScore': 0.1,
            'confidence': 0.98
        },
        'forecast': {
            'probability': 12,
            'updatedAt': ts_str,
            'windowStart': ts_str,
            'windowEnd': ts_str,
            'nextClass': 'C-class',
            'leadTime': 0,
            'tcnConfidence': 0.12
        },
        'hardnessRatio': {
            'current': 0.035,
            'baseline': 0.035,
            'threshold': 0.06,
            'trend': 'stable',
            'preFlareSignal': False,
            'minutesEarly': 0
        },
        'alerts': [
            { 'ts': ts_str, 'type': 'INFO', 'level': 'GREEN', 'msg': 'Forecast service online in sample/fallback mode' }
        ],
        'flareClass': 'B1.0'
    }
    _alerts_history = _latest_status['alerts']
    
    # Try loading real Aditya-L1 data (with heavy sampling for speed)
    try:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from pipeline.ingestion import load_aditya_data, load_and_align
        
        aditya_data = load_aditya_data(sample_every=30)
        # The downloaded project includes JSON telemetry rather than extracted
        # FITS light-curves.  Use it as local *sample* input when present.
        if not aditya_data:
            root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            sample_soft = os.path.join(root, 'data', 'raw', 'solexs', 'solexs_20240915_level2.json')
            sample_hard = os.path.join(root, 'data', 'raw', 'helios', 'helios_20240915_level1.json')
            aditya_data = load_and_align(sample_soft, sample_hard)[::30]
        if aditya_data and len(aditya_data) > 10:
            print(f"Loaded {len(aditya_data)} local SoLEXS/HEL1OS sample points.")
