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
    "B": (1e-7, 1e-6),
    "C": (1e-6, 1e-5),
    "M": (1e-5, 1e-4),
    "X": (1e-4, float("inf")),
}

# Nowcast label indices
NOWCAST_CLASSES = {"QUIET": 0, "FLARE_ONSET": 1, "FLARE_PEAK": 2, "FLARE_DECAY": 3}


def classify_flare(flux):
    """Return flare letter class for a given flux value."""
    for cls, (lo, hi) in FLARE_THRESHOLDS.items():
        if lo <= flux < hi:
            return cls
    return "A"


def generate_nowcast_label(flux_series):
    """Generate nowcast label for the LAST point in a flux series.

    Rules:
        - PEAK: flux >= 1e-6 AND this point is the max in a 5-minute window
        - ONSET: flux rising rapidly (> 2× previous minute)
        - DECAY: flux falling after a peak
        - QUIET: everything else
    """
    if len(flux_series) < 5:
        return 0  # QUIET

    current = flux_series[-1]
    prev = flux_series[-2]
    window = flux_series[-10:] if len(flux_series) >= 10 else flux_series
    is_max = current >= max(window)
    is_rising = current > prev * 1.5  # 50% increase
    is_falling = current < prev * 0.7  # 30% decrease
    above_c = current >= 1e-6  # C-class or higher

    if above_c and is_max:
        return 2  # FLARE_PEAK
    elif above_c and is_rising:
        return 1  # FLARE_ONSET
    elif is_falling and current >= 5e-7:
        return 3  # FLARE_DECAY
    else:
        return 0  # QUIET


def generate_forecast_label(flux_series, current_idx, lookahead=180):
    """Generate forecast label: will there be M/X flare in next `lookahead` steps?"""
    end = min(current_idx + lookahead, len(flux_series))
    for i in range(current_idx, end):
        if flux_series[i] >= 1e-5:  # M-class or higher
            return 1.0
    return 0.0


# ═══════════════════════════════════════════════════════════════════════════
# 3. PyTorch Model Definitions
# ═══════════════════════════════════════════════════════════════════════════


class DilatedCausalConv1d(nn.Module):
    """1D dilated causal convolution that exactly matches py_dilated_causal_conv1d.

    Causal: output at position i depends only on inputs at positions ≤ i.
    Implemented by left-padding the input before a standard Conv1d.
    """

    def __init__(self, in_channels, out_channels, kernel_size, dilation=1):
        super().__init__()
        self.conv = nn.Conv1d(
            in_channels, out_channels, kernel_size,
            dilation=dilation, padding=0
        )
        self.kernel_size = kernel_size
        self.dilation = dilation
        self.pad_length = (kernel_size - 1) * dilation

    def forward(self, x):
        # Left-pad to make it causal: pad only the left (start) side
        x = F.pad(x, (self.pad_length, 0))
        return self.conv(x)


class NowcastCNN(nn.Module):
    """1D CNN for flare phase classification (matches pipeline/nowcast.py).

    Input:  (batch, 9, 60)   — 9 feature channels × 60 time steps
    Output: (batch, 4)       — [QUIET, ONSET, PEAK, DECAY]
    """

    def __init__(self, n_features=9, seq_len=60, n_classes=4):
        super().__init__()
        self.conv1 = nn.Conv1d(n_features, 32, kernel_size=5, padding=0)
        self.pool1 = nn.MaxPool1d(kernel_size=2)
        self.conv2 = nn.Conv1d(32, 64, kernel_size=3, padding=0)
        self.fc1 = nn.Linear(64, 64)
        self.fc2 = nn.Linear(64, n_classes)

    def forward(self, x):
        # x: (batch, 9, 60)
        x = F.relu(self.conv1(x))       # (batch, 32, 56)
        x = self.pool1(x)               # (batch, 32, 28)
        x = F.relu(self.conv2(x))       # (batch, 64, 26)
        x = x.mean(dim=-1)              # Global Avg Pool → (batch, 64)
        x = F.relu(self.fc1(x))         # (batch, 64)
        x = self.fc2(x)                 # (batch, 4)
        return x


class ForecastTCN(nn.Module):
    """Temporal Convolutional Network for flare probability (matches pipeline/forecast.py).

    Uses **dilated causal** convolutions exactly as the pure Python inference code does.
    Input:  (batch, 9, 720)  — 9 feature channels × 720 time steps
    Output: (batch, 1)       — probability of M/X flare via sigmoid
    """

    def __init__(self, n_features=9, seq_len=720):
        super().__init__()
        # Dilated causal conv blocks with increasing dilation
        # Each preserves the time dimension length (720 → 720)
        self.conv1 = DilatedCausalConv1d(n_features, 32, kernel_size=3, dilation=1)
        self.conv2 = DilatedCausalConv1d(32, 32, kernel_size=3, dilation=2)
        self.conv3 = DilatedCausalConv1d(32, 64, kernel_size=3, dilation=4)
        self.conv4 = DilatedCausalConv1d(64, 64, kernel_size=3, dilation=8)
        self.fc1 = nn.Linear(64, 32)
        self.fc2 = nn.Linear(32, 1)

    def forward(self, x):
        # x: (batch, 9, 720)
        x = F.relu(self.conv1(x))       # (batch, 32, 720)
        x = F.relu(self.conv2(x))       # (batch, 32, 720)
        x = F.relu(self.conv3(x))       # (batch, 64, 720)
        x = F.relu(self.conv4(x))       # (batch, 64, 720)
        x = x.mean(dim=-1)              # Global Avg Pool → (batch, 64)
        x = F.relu(self.fc1(x))         # (batch, 32)
        x = torch.sigmoid(self.fc2(x))  # (batch, 1)
        return x


# ═══════════════════════════════════════════════════════════════════════════
# 4. Weight Export — PyTorch → JSON (matching inference format)
# ═══════════════════════════════════════════════════════════════════════════

def export_nowcast_weights(model, save_path="models/nowcast_cnn_weights.json"):
    """Extract PyTorch state_dict and save in the nested-list JSON format."""
    sd = model.state_dict()

    # Conv1: w_conv1 shape (32, 9, 5) → needs to be (5, 9, 32)
    w_conv1 = sd["conv1.weight"].cpu().numpy()  # (32, 9, 5)
    w_conv1 = w_conv1.transpose(2, 1, 0).tolist()  # (5, 9, 32)
    b_conv1 = sd["conv1.bias"].cpu().numpy().tolist()  # (32,)

    # Conv2: w_conv2 shape (64, 32, 3) → needs to be (3, 32, 64)
    w_conv2 = sd["conv2.weight"].cpu().numpy()  # (64, 32, 3)
    w_conv2 = w_conv2.transpose(2, 1, 0).tolist()  # (3, 32, 64)
    b_conv2 = sd["conv2.bias"].cpu().numpy().tolist()  # (64,)

    # FC1: w_dense1 shape (64, 64) → needs to be (64, 64)
    w_dense1 = sd["fc1.weight"].cpu().numpy().T.tolist()  # (64, 64)
    b_dense1 = sd["fc1.bias"].cpu().numpy().tolist()

    # FC2: w_dense2 shape (4, 64) → needs to be (64, 4)
    w_dense2 = sd["fc2.weight"].cpu().numpy().T.tolist()  # (64, 4)
    b_dense2 = sd["fc2.bias"].cpu().numpy().tolist()

    weights = {
        "w_conv1": w_conv1,
        "b_conv1": b_conv1,
        "w_conv2": w_conv2,
        "b_conv2": b_conv2,
        "w_dense1": w_dense1,
        "b_dense1": b_dense1,
        "w_dense2": w_dense2,
        "b_dense2": b_dense2,
    }

    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    with open(save_path, "w") as f:
        json.dump(weights, f, indent=2)
    print(f"  Saved Nowcast weights -> {save_path}")


def export_forecast_weights(model, save_path="models/forecast_tcn_weights.json"):
    """Extract PyTorch state_dict and save in the nested-list JSON format."""
    sd = model.state_dict()

    # Conv blocks: each conv1d weight shape is (C_out, C_in, K)
    # Target: (K, C_in, C_out)
    conv_mapping = [
        ("conv1.conv", "w_tcn1", "b_tcn1"),
        ("conv2.conv", "w_tcn2", "b_tcn2"),
        ("conv3.conv", "w_tcn3", "b_tcn3"),
        ("conv4.conv", "w_tcn4", "b_tcn4"),
    ]

    weights = {}
    for conv_key, w_key, b_key in conv_mapping:
        w = sd[f"{conv_key}.weight"].cpu().numpy()  # (C_out, C_in, K)
        # Reverse kernel order: PyTorch applies w[k] at pos i+k*d, but
        # py_dilated_causal_conv1d applies w[k] at pos i-k*d, so we need w_export[k] = w_pytorch[K-1-k]
        w = w[:, :, ::-1]  # (C_out, C_in, K) — kernel order flipped
        w = w.transpose(2, 1, 0).tolist()  # (K, C_in, C_out)
        b = sd[f"{conv_key}.bias"].cpu().numpy().tolist()
        weights[w_key] = w
        weights[b_key] = b

    # FC1: w_dense1 shape (32, 64) → needs to be (64, 32)
    w_dense1 = sd["fc1.weight"].cpu().numpy().T.tolist()
    b_dense1 = sd["fc1.bias"].cpu().numpy().tolist()
    weights["w_dense1"] = w_dense1
    weights["b_dense1"] = b_dense1

    # FC2: w_dense2 shape (1, 32) → needs to be (32, 1)
    w_dense2 = sd["fc2.weight"].cpu().numpy().T.tolist()
    b_dense2 = sd["fc2.bias"].cpu().numpy().tolist()
    weights["w_dense2"] = w_dense2
    weights["b_dense2"] = b_dense2

    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    with open(save_path, "w") as f:
        json.dump(weights, f, indent=2)
    print(f"  Saved Forecast weights -> {save_path}")


# ═══════════════════════════════════════════════════════════════════════════
# 5. Dataset Construction
# ═══════════════════════════════════════════════════════════════════════════

def prepare_telemetry(records):
    """Convert raw GOES records into pipeline telemetry format.

    GOES has: time, soft_flux, hard_flux
    Pipeline expects: time, soft_flux, hard_15_25, hard_25_50, hard_50_100, data_gap
    """
    telemetry = []
    for r in records:
        hard = r["hard_flux"]
        telemetry.append({
            "time": r["time"],
            "soft_flux": r["soft_flux"],
            "hard_15_25": hard * 2.2,
            "hard_25_50": hard,
            "hard_50_100": hard * 0.12,
            "data_gap": False,
        })
    return telemetry


def build_training_samples(records, nowcast_window=60, forecast_window=720):
    """Build (X, y) training samples from telemetry records.

    Returns:
        X_nowcast: list of (60, 9) arrays
        y_nowcast: list of integer labels (0-3)
        X_forecast: list of (720, 9) arrays
        y_forecast: list of binary labels (0.0 or 1.0)
    """
    telemetry = prepare_telemetry(records)
    n = len(telemetry)
    if n < forecast_window + 10:
        print(f"  [WARN] Only {n} records -- need at least {forecast_window + 10} for training.")
        return [], [], [], []

    # Compute features for every point
    print("  Computing features...")
    all_features = []
    soft_fluxes = []
    for i in range(n):
        buf = telemetry[: i + 1]
        feats = compute_latest_features_pure(buf)
        all_features.append(feats)
        soft_fluxes.append(telemetry[i]["soft_flux"])

    X_nc, y_nc = [], []
    X_fc, y_fc = [], []

    print(f"  Building nowcast samples (window={nowcast_window})...")
    for i in range(nowcast_window, n):
        x_nc = all_features[i - nowcast_window + 1 : i + 1]
        if len(x_nc) == nowcast_window:
            label = generate_nowcast_label(soft_fluxes[: i + 1])
            X_nc.append(x_nc)
            y_nc.append(label)

    print(f"  Building forecast samples (window={forecast_window})...")
    for i in range(forecast_window, n - 1):
        x_fc = all_features[i - forecast_window + 1 : i + 1]
        if len(x_fc) == forecast_window:
            label = generate_forecast_label(soft_fluxes, i, lookahead=180)
            X_fc.append(x_fc)
            y_fc.append(label)

    return X_nc, y_nc, X_fc, y_fc


# ═══════════════════════════════════════════════════════════════════════════
# 6. Training Loop
# ═══════════════════════════════════════════════════════════════════════════

def train_nowcast(model, X, y, n_epochs=30, lr=0.001):
    """Train NowcastCNN."""
    device = torch.device("cpu")
    model = model.to(device)

    # Convert to tensors
    X_t = torch.tensor(np.array(X), dtype=torch.float32)  # (N, 60, 9)
    X_t = X_t.permute(0, 2, 1)  # (N, 9, 60) for Conv1d
    y_t = torch.tensor(np.array(y), dtype=torch.long)

    # Train/val split
    split = int(len(X_t) * 0.8)
    train_X, train_y = X_t[:split], y_t[:split]
    val_X, val_y = X_t[split:], y_t[split:]

    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = nn.CrossEntropyLoss()

    best_val_acc = 0.0

    for epoch in range(n_epochs):
        model.train()
        perm = torch.randperm(len(train_X))
        running_loss = 0.0
        batch_size = 64
        for start in range(0, len(train_X), batch_size):
            idx_b = perm[start : start + batch_size]
            bx, by = train_X[idx_b], train_y[idx_b]
            optimizer.zero_grad()
            out = model(bx)
            loss = criterion(out, by)
            loss.backward()
            optimizer.step()
            running_loss += loss.item()

        # Validation
        model.eval()
        with torch.no_grad():
            val_out = model(val_X)
            val_pred = val_out.argmax(dim=1)
            val_acc = (val_pred == val_y).float().mean().item()

        if (epoch + 1) % 5 == 0 or epoch == 0:
            print(f"    Epoch {epoch+1:2d}/{n_epochs}  loss={running_loss:.4f}  val_acc={val_acc:.4f}")

        if val_acc > best_val_acc:
            best_val_acc = val_acc

    print(f"  Nowcast training complete. Best val accuracy: {best_val_acc:.4f}")
    return model


def train_forecast(model, X, y, n_epochs=30, lr=0.001):
    """Train ForecastTCN."""
    device = torch.device("cpu")
    model = model.to(device)

    # Convert to tensors
    X_t = torch.tensor(np.array(X), dtype=torch.float32)  # (N, 720, 9)
    X_t = X_t.permute(0, 2, 1)  # (N, 9, 720)
    y_t = torch.tensor(np.array(y), dtype=torch.float32).unsqueeze(1)

    # Train/val split
    split = int(len(X_t) * 0.8)
    train_X, train_y = X_t[:split], y_t[:split]
    val_X, val_y = X_t[split:], y_t[split:]

    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
