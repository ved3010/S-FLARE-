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
