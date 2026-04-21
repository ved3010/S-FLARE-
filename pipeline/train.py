import os
import sys
import argparse
import json
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, mean_absolute_error, mean_squared_error
)

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline.features import compute_features_batch
from pipeline.target_generation import create_short_term_targets, create_sliding_windows
from pipeline.ingestion import load_aditya_data, generate_live_stream_point

FEATURE_NAMES = [
    'soft_flux_log10', 'hard_rate_25_50', 'hardness_ratio',
    'hr_slope_10m', 'hr_zscore', 'flux_derivative_60s',
    'neupert_residual', 'time_since_last_c_flare', 'solar_activity_index'
]

def load_or_generate_dataset() -> pd.DataFrame:
    """Loads Aditya-L1 data if available, else generates synthetic telemetry series."""
    aditya_records = load_aditya_data(sample_every=1)
    if aditya_records and len(aditya_records) > 200:
        df = pd.DataFrame(aditya_records)
    else:
        print("Aditya-L1 raw data limited. Generating full telemetry stream for training...")
        records = []
        t_base = 1726400000
        for i in range(12000):  # ~16.6 hours of 5-sec cadence telemetry
            t = t_base + i * 5
            # Inject flares periodically for class balance
            flare_active = (1500 <= i <= 2500) or (5500 <= i <= 6500) or (9000 <= i <= 9800)
            pt = generate_live_stream_point(t, flare_active=flare_active)
            records.append(pt)
        df = pd.DataFrame(records)

    # Compute features
    df_feat = compute_features_batch(df)
    # Compute 1-min and 2-min targets
    df_full = create_short_term_targets(df_feat, c_flare_threshold=1e-6)
    return df_full


def train_models_for_horizon(horizon: int = 1) -> Dict[str, Any]:
    """
    Trains Random Forest, SVM, XGBoost, and neural baselines for a specific horizon (1 or 2 minutes).
    Uses chronological 70/15/15 train/val/test split to prevent leakage.
    """
    print(f"\n==================================================")
    print(f" TRAINING MODELS FOR {horizon}-MINUTE FORECAST HORIZON")
    print(f"==================================================")
