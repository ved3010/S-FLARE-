import math

# Try to load pandas for optional dataframe batch operations
try:
    import pandas as pd
    PANDAS_OK = True
except ImportError:
    PANDAS_OK = False

def compute_features_batch(df):
    """Computes features for a batch of synchronized telemetry data (Pandas/NumPy path)."""
    if not PANDAS_OK:
        raise RuntimeError("Pandas not installed.")
        
    import numpy as np
    df = df.copy().sort_values('time').reset_index(drop=True)
    df['soft_flux_log10'] = np.log10(df['soft_flux'].clip(lower=1e-10))
    df['hard_rate_25_50'] = df['hard_25_50']
    
    df['hardness_ratio'] = (df['hard_rate_25_50'] / (df['soft_flux'] * 1e8).clip(lower=0.1)) * 0.035
    df['hardness_ratio'] = df['hardness_ratio'].clip(0, 0.5)
    
    # Time-based windows keep the features valid when instrument cadence is
    # not one sample per second.  Duplicate timestamps are retained only for
    # the final value at that timestamp.
    df = df.drop_duplicates(subset='time', keep='last').set_index(
        pd.to_datetime(df['time'], unit='s', utc=True)
    )
    df['hr_mean_10m'] = df['hardness_ratio'].rolling('10min', min_periods=2).mean().bfill()
    ten_min_ago = df['hardness_ratio'].shift(freq='10min').reindex(df.index, method='nearest')
    df['hr_slope_10m'] = ((df['hardness_ratio'] - ten_min_ago) / 600.0).fillna(0)

    roll_mean = df['hardness_ratio'].rolling('30min', min_periods=2).mean()
    roll_std = df['hardness_ratio'].rolling('30min', min_periods=2).std()
    df['hr_zscore'] = ((df['hardness_ratio'] - roll_mean) / roll_std.clip(lower=1e-5)).fillna(0)
    
    minute_ago = df['soft_flux'].shift(freq='60s').reindex(df.index, method='nearest')
    df['flux_derivative_60s'] = ((df['soft_flux'] - minute_ago) / 60.0).fillna(0)
    
    expected_hard = df['flux_derivative_60s'] * 1.2e10
    df['neupert_residual'] = np.abs(df['hard_rate_25_50'] - expected_hard)
    
    df['time_since_last_c_flare'] = 120.0
    df['solar_activity_index'] = 0.0
    
    flare_times = []
    c_flare_threshold = 1e-6
    last_c_flare_t = -999999.0
    
    for idx, row in df.iterrows():
        t_val = row['time']
        flux = row['soft_flux']
        if flux >= c_flare_threshold:
            last_c_flare_t = t_val
            if not flare_times or (t_val - flare_times[-1] > 1800):
                flare_times.append(t_val)
                
        if last_c_flare_t > 0:
            df.at[idx, 'time_since_last_c_flare'] = (t_val - last_c_flare_t) / 60.0
            
        six_hours_ago = t_val - 21600
        recent_count = sum(1 for ft in flare_times if ft >= six_hours_ago)
        df.at[idx, 'solar_activity_index'] = float(recent_count)
        
    return df.reset_index(drop=True)

def compute_latest_features(history_df):
    """Computes features for the single latest row in a DataFrame (Pandas/NumPy path)."""
    if len(history_df) < 5:
        import numpy as np
        return np.zeros(9)
    processed = compute_features_batch(history_df)
    latest = processed.iloc[-1]
    import numpy as np
    return np.array([
        latest['soft_flux_log10'], latest['hard_rate_25_50'], latest['hardness_ratio'],
        latest['hr_slope_10m'], latest['hr_zscore'], latest['flux_derivative_60s'],
        latest['neupert_residual'], latest['time_since_last_c_flare'], latest['solar_activity_index']
    ])

# ==========================================
# 3. Pure-Python Feature Engine (Zero-Dependency)
# ==========================================
def compute_latest_features_pure(history_buffer):
    """Computes features for the single latest record in the history list of dictionaries.
    Uses pure-Python list operations.
    """
    if not history_buffer:
        return [0.0] * 9
        
    last_item = history_buffer[-1]
    t_curr = last_item['time']
    soft_curr = last_item['soft_flux']
    hard_curr = last_item['hard_25_50']
    
    # 1. log10 of soft flux
    soft_log10 = math.log10(max(1e-10, soft_curr))
    
    # 2. hard rate 25-50
    hard_rate = float(hard_curr)
    
    # 3. hardness ratio (0.01 - 0.20 scale target)
    hr_curr = (hard_curr / max(0.1, soft_curr * 1e8)) * 0.035
    hr_curr = max(0.0, min(0.5, hr_curr))
    
    # Calculate list of hardness ratios over history for rolling metrics
    hr_history = []
    times = []
    soft_history = []
    
    for item in history_buffer:
        s = item['soft_flux']
        h = item['hard_25_50']
        hr = (h / max(0.1, s * 1e8)) * 0.035
        hr_history.append(max(0.0, min(0.5, hr)))
        times.append(item['time'])
        soft_history.append(s)
        
    # Helper to slice history by time window (seconds)
    def get_indices_in_window(window_sec):
        indices = []
        cutoff = t_curr - window_sec
        for idx, t in enumerate(times):
            if t >= cutoff:
                indices.append(idx)
        return indices

    # 4. hr_mean_10m (10m = 600s window)
    idx_10m = get_indices_in_window(600)
    hr_mean = sum(hr_history[i] for i in idx_10m) / len(idx_10m) if idx_10m else hr_curr
    
    # 5. hr_slope_10m (slope over 10m window)
    if len(idx_10m) > 5:
        # Simple difference divided by time interval
        i_old = idx_10m[0]
        dt = t_curr - times[i_old]
        hr_slope = (hr_curr - hr_history[i_old]) / dt if dt > 0 else 0.0
    else:
        hr_slope = 0.0
        
    # 6. hr_zscore (deviation from 30-min window = 1800s)
    idx_30m = get_indices_in_window(1800)
    if len(idx_30m) > 10:
        hr_slice = [hr_history[i] for i in idx_30m]
        mean_30m = sum(hr_slice) / len(hr_slice)
        variance = sum((val - mean_30m) ** 2 for val in hr_slice) / len(hr_slice)
        std_30m = math.sqrt(variance)
        hr_zscore = (hr_curr - mean_30m) / max(1e-5, std_30m)
    else:
        hr_zscore = 0.0
        
    # 7. flux_derivative_60s (derivative of soft flux over 60s)
    idx_60s = get_indices_in_window(60)
    if len(idx_60s) > 2:
        i_old = idx_60s[0]
        dt = t_curr - times[i_old]
        flux_derivative = (soft_curr - soft_history[i_old]) / dt if dt > 0 else 0.0
    else:
        flux_derivative = 0.0
        
    # 8. neupert_residual
    expected_hard = flux_derivative * 1.2e10
    neupert_residual = abs(hard_rate - expected_hard)
    
    # 9. time_since_last_c_flare and solar_activity_index
