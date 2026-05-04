"""
scripts/train_real.py — Train Nowcast CNN + Forecast TCN on real NOAA GOES X-ray data.

Usage:
    python scripts/train_real.py                     # Fetch NOAA GOES data & train
    python scripts/train_real.py --source mock        # Train on local mock data instead
    python scripts/train_real.py --epochs 50          # Custom training epochs

What it does:
    1. Fetches real GOES X-ray flux data from NOAA (or loads mock data)
    2. Converts to pipeline telemetry format
    3. Computes features using the existing pipeline/features.py
    4. Creates sliding-window training samples with labels
    5. Defines PyTorch versions of Nowcast CNN & Forecast TCN
    6. Trains both models with Adam optimizer
    7. Exports trained weights → models/ (overwrites hand-crafted weights)
    8. Reports validation accuracy & metrics
"""

import os
import sys
import json
import math
import warnings
import argparse
from datetime import datetime, timedelta

import numpy as np

warnings.filterwarnings("ignore")

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ── Optional imports (with graceful fallbacks) ──────────────────────────────
try:
    import requests
except ImportError:
    requests = None

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
except ImportError:
    print("ERROR: PyTorch not installed. Run: pip install torch")
    sys.exit(1)

# Import pipeline modules
from pipeline.features import compute_latest_features_pure


# ═══════════════════════════════════════════════════════════════════════════
# 1. Data Fetching — Real NOAA GOES XRS
# ═══════════════════════════════════════════════════════════════════════════

NOAA_ENDPOINTS = {
    "1day": "https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json",
    "7day": "https://services.swpc.noaa.gov/json/goes/primary/xrays-7-day.json",
    "30day_g16": "https://services.swpc.noaa.gov/json/goes/16/xrays-30-day.json",
    "30day_g18": "https://services.swpc.noaa.gov/json/goes/18/xrays-30-day.json",
}


def fetch_noaa_goes_data(max_days=7):
    """Fetch GOES X-ray flux data from NOAA public endpoints.

    Returns list of dicts: {time (unix_seconds), soft_flux (0.1-0.8nm), hard_flux (0.05-0.4nm)}
    """
    if requests is None:
        print("  [WARN] requests not installed -- cannot fetch live data.")
        return []

    # Try multiple endpoints to maximize data
    all_points = {}
    endpoints = ["7day", "1day", "30day_g16", "30day_g18"]

    for key in endpoints:
        url = NOAA_ENDPOINTS.get(key)
        if not url:
            continue
        try:
            resp = requests.get(url, timeout=10)
            if resp.status_code != 200:
                continue
            data = resp.json()
            if not data or not isinstance(data, list):
                continue
            print(f"  Fetched {len(data)} points from {key}")
            for item in data:
                tt = item.get("time_tag")
                energy = item.get("energy")
                flux_val = item.get("flux")
                if not tt or not energy or flux_val is None:
                    continue
                try:
                    dt = datetime.strptime(tt, "%Y-%m-%dT%H:%M:%SZ")
                    t_sec = int(dt.timestamp())
                except (ValueError, TypeError):
                    continue
                if t_sec not in all_points:
                    all_points[t_sec] = {}
                if "0.1-0.8nm" in energy:
                    all_points[t_sec]["soft"] = float(flux_val)
                elif "0.05-0.4nm" in energy:
                    all_points[t_sec]["hard"] = float(flux_val)
        except Exception as e:
            print(f"  [WARN] Failed to fetch {key}: {e}")

    # Build sorted record list
    records = []
    for t_sec in sorted(all_points.keys()):
        pt = all_points[t_sec]
        if "soft" in pt:
            records.append({
                "time": t_sec,
                "soft_flux": pt["soft"],
                "hard_flux": pt.get("hard", pt["soft"] * 0.3),  # proxy if hard missing
            })
    return records


def load_mock_data():
    """Load existing mock JSON telemetry as alternative training data."""
    try:
        from pipeline.ingestion import load_and_align
        solexs_path = "data/raw/solexs/solexs_20240915_level2.json"
        helios_path = "data/raw/helios/helios_20240915_level1.json"
        aligned = load_and_align(solexs_path, helios_path)
        # Convert to training record format
        records = []
        for r in aligned:
            records.append({
                "time": r["time"],
                "soft_flux": r["soft_flux"],
                "hard_flux": r["hard_25_50"],
            })
        return records
    except Exception as e:
        print(f"  [ERROR] Could not load mock data: {e}")
        return []


# ═══════════════════════════════════════════════════════════════════════════
# 2. Label Generation
# ═══════════════════════════════════════════════════════════════════════════

# Flare class thresholds (W/m²)
FLARE_THRESHOLDS = {
    "A": (1e-8, 1e-7),
