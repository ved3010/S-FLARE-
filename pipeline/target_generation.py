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
