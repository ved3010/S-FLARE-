import numpy as np
import pandas as pd
from typing import Tuple, List, Dict, Any

FORECAST_HORIZONS = [1, 2]  # in minutes
LOOKBACK_MINUTES = 5  # configurable lookback window

def create_short_term_targets(
    df: pd.DataFrame,
    sampling_rate_sec: int = 5,
    c_flare_threshold: float = 1e-6
) -> pd.DataFrame:
    """
    Given a sorted DataFrame with timestamps and 'soft_flux',
    computes targets for t + 1 min and t + 2 min without data leakage.

    Target definitions:
      - target_1min_class: 1 if max soft_flux between t + 30s and t + 60s >= threshold, else 0
      - target_2min_class: 1 if max soft_flux between t + 90s and t + 120s >= threshold, else 0
      - target_1min_flux: max soft_flux in [t + 30s, t + 60s]
      - target_2min_flux: max soft_flux in [t + 90s, t + 120s]
    """
    df = df.copy().sort_values('time').reset_index(drop=True)
    times = df['time'].values
    fluxes = df['soft_flux'].values
    n = len(df)

    # NaN means the requested future observation is unavailable.  Keeping it
    # explicit prevents end-of-file rows from being trained against their own
    # current value (a subtle form of target leakage).
    t1_class = np.full(n, np.nan)
    t2_class = np.full(n, np.nan)
    t1_flux = np.full(n, np.nan)
    t2_flux = np.full(n, np.nan)

    for i in range(n):
        t_curr = times[i]
        
        # 1-minute horizon window: (t_curr + 30, t_curr + 60]
        idx_1min = np.where((times > t_curr + 30) & (times <= t_curr + 60))[0]
        if len(idx_1min) > 0:
            max_f1 = np.max(fluxes[idx_1min])
            t1_flux[i] = max_f1
            t1_class[i] = int(max_f1 >= c_flare_threshold)

        # 2-minute horizon window: (t_curr + 90, t_curr + 120]
        idx_2min = np.where((times > t_curr + 90) & (times <= t_curr + 120))[0]
        if len(idx_2min) > 0:
            max_f2 = np.max(fluxes[idx_2min])
            t2_flux[i] = max_f2
            t2_class[i] = int(max_f2 >= c_flare_threshold)

    df['target_1min_class'] = t1_class
    df['target_2min_class'] = t2_class
    df['target_1min_flux'] = t1_flux
    df['target_2min_flux'] = t2_flux

    return df


def create_sliding_windows(
    features_matrix: np.ndarray,
    targets_class: np.ndarray,
    targets_flux: np.ndarray,
    window_steps: int = 60
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Creates time-series sliding windows for sequence models (LSTM/TCN).
    Returns X_seq of shape (num_samples, window_steps, num_features), y_class, y_flux.
    """
    num_samples = len(features_matrix) - window_steps + 1
    if num_samples <= 0:
        return np.array([]), np.array([]), np.array([])

    num_features = features_matrix.shape[1]
    X_seq = np.zeros((num_samples, window_steps, num_features))
    y_c = np.zeros(num_samples, dtype=int)
    y_f = np.zeros(num_samples, dtype=float)

    for i in range(num_samples):
        X_seq[i] = features_matrix[i : i + window_steps]
        y_c[i] = targets_class[i + window_steps - 1]
        y_f[i] = targets_flux[i + window_steps - 1]

    return X_seq, y_c, y_f
