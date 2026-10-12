import os
import sys
import json
import math
import random
import numpy as np

# Add project root to sys.path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(project_root)

import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim

from pipeline.ingestion import load_and_align
from pipeline.features import compute_latest_features_pure

# ----------------------------------------------------
# 1. Model Definitions in PyTorch
# ----------------------------------------------------

class NowcastCNN(nn.Module):
    def __init__(self):
        super().__init__()
        # Input shape: (batch, 9, 60)
        self.conv1 = nn.Conv1d(in_channels=9, out_channels=32, kernel_size=5)
        self.pool1 = nn.MaxPool1d(kernel_size=2)
        self.conv2 = nn.Conv1d(in_channels=32, out_channels=64, kernel_size=3)
        self.dense1 = nn.Linear(in_features=64, out_features=64)
        self.dense2 = nn.Linear(in_features=64, out_features=4) # 4 classes
        
    def forward(self, x):
        x = F.relu(self.conv1(x))    # (batch, 32, 56)
        x = self.pool1(x)            # (batch, 32, 28)
        x = F.relu(self.conv2(x))    # (batch, 64, 26)
        x = x.mean(dim=2)            # Global Average Pooling -> (batch, 64)
        x = F.relu(self.dense1(x))   # (batch, 64)
        return self.dense2(x)        # (batch, 4)

class CausalConv1d(nn.Module):
    def __init__(self, in_channels, out_channels, kernel_size, dilation=1):
        super().__init__()
        self.dilation = dilation
        self.kernel_size = kernel_size
        self.padding = (kernel_size - 1) * dilation
        self.conv = nn.Conv1d(in_channels, out_channels, kernel_size, dilation=dilation)
        
    def forward(self, x):
        # Pad left by (kernel_size - 1) * dilation to enforce causal convolution
        x = F.pad(x, (self.padding, 0))
        return self.conv(x)

class ForecastTCN(nn.Module):
    def __init__(self):
        super().__init__()
        self.tcn1 = CausalConv1d(in_channels=9, out_channels=32, kernel_size=3, dilation=1)
        self.tcn2 = CausalConv1d(in_channels=32, out_channels=32, kernel_size=3, dilation=2)
        self.tcn3 = CausalConv1d(in_channels=32, out_channels=64, kernel_size=3, dilation=4)
        self.tcn4 = CausalConv1d(in_channels=64, out_channels=64, kernel_size=3, dilation=8)
        self.dense1 = nn.Linear(in_features=64, out_features=32)
        self.dense2 = nn.Linear(in_features=32, out_features=1)
        
    def forward(self, x):
        # Input shape: (batch, 9, 720)
        x = F.relu(self.tcn1(x))
        x = F.relu(self.tcn2(x))
        x = F.relu(self.tcn3(x))
        x = F.relu(self.tcn4(x))
        x = x.mean(dim=2)            # Global Average Pooling -> (batch, 64)
        x = F.relu(self.dense1(x))   # (batch, 32)
        return self.dense2(x)        # (batch, 1)

# ----------------------------------------------------
# 2. Data Ingestion & Preprocessing
# ----------------------------------------------------

def prepare_data():
    solexs_path = os.path.join(project_root, "data", "raw", "solexs", "solexs_20240915_level2.json")
    helios_path = os.path.join(project_root, "data", "raw", "helios", "helios_20240915_level1.json")
    
    print(f"Loading aligned telemetry from: \n  SoLEXS: {solexs_path}\n  HEL1OS: {helios_path}")
    
    if not os.path.exists(solexs_path) or not os.path.exists(helios_path):
        print("Telemetry JSON files not found! Please run python scripts/generate_mock_fits.py first.")
        sys.exit(1)
        
    aligned = load_and_align(solexs_path, helios_path)
    n_rows = len(aligned)
    print(f"Loaded {n_rows} aligned rows.")
    
    print("Precomputing rolling physics features...")
    feature_history = []
    soft_fluxes = []
    
    for i in range(n_rows):
        sub_buffer = aligned[:i+1]
        feats = compute_latest_features_pure(sub_buffer)
        feature_history.append(feats)
        soft_fluxes.append(aligned[i]['soft_flux'])
        
    feature_history = np.array(feature_history) # Shape: (N, 9)
    soft_fluxes = np.array(soft_fluxes)
    
    # Labeling Logic
    print("Creating targets/labels based on physical flare phases...")
    
    # 2.1 Nowcast Labels: [0: QUIET, 1: FLARE_ONSET, 2: FLARE_PEAK, 3: FLARE_DECAY]
    # In generate_mock_fits.py, the flare starts at t=3000, peaks around 3300-3500, and decays.
    # We can use the soft flux values and its derivative to determine the phase at each index.
    nowcast_labels = []
    for i in range(n_rows):
        flux = soft_fluxes[i]
        deriv = feature_history[i, 5] # flux_derivative_60s
        
        if flux < 1.5e-7:
            lbl = 0  # QUIET
        elif deriv > 1e-9:
            lbl = 1  # FLARE_ONSET
        elif deriv < -1e-9:
            lbl = 3  # FLARE_DECAY
        else:
            lbl = 2  # FLARE_PEAK
        nowcast_labels.append(lbl)
        
    nowcast_labels = np.array(nowcast_labels)
    
    # 2.2 Forecast Labels: 1.0 (predictive warning) if a flare will occur in the next 3 hours (2160 steps)
    # and the current state is not yet in the active flare, else 0.0.
    # Specifically, we want it to activate for the window leading up to the flare onset (t in [1000, 3000]).
    forecast_labels = []
    for i in range(n_rows):
        # Check if any future time within 3 hours has a flare start
        future_slice = soft_fluxes[i+1 : min(i+2160, n_rows)]
        if len(future_slice) > 0 and np.any(future_slice >= 3.0e-7) and soft_fluxes[i] < 3.0e-7:
            forecast_labels.append(1.0)
        else:
            forecast_labels.append(0.0)
            
    forecast_labels = np.array(forecast_labels)
    
    # 2.3 Build Sliding Window Datasets
    # Nowcast requires windows of shape (60, 9), target is label at final index
    X_nc = []
    y_nc = []
    for i in range(60, n_rows):
        window = feature_history[i-60 : i] # length 60
        # transpose to (9, 60) for Conv1D channel-first shape
        X_nc.append(window.T)
        y_nc.append(nowcast_labels[i])
        
    X_nc = torch.tensor(np.array(X_nc), dtype=torch.float32)
    y_nc = torch.tensor(np.array(y_nc), dtype=torch.long)
    
    # Forecast requires windows of shape (720, 9), target is label at final index
    X_fc = []
    y_fc = []
    for i in range(720, n_rows):
        window = feature_history[i-720 : i] # length 720
        X_fc.append(window.T)
        y_fc.append(forecast_labels[i])
        
    X_fc = torch.tensor(np.array(X_fc), dtype=torch.float32)
    y_fc = torch.tensor(np.array(y_fc), dtype=torch.float32).unsqueeze(1)
    
    return X_nc, y_nc, X_fc, y_fc

# ----------------------------------------------------
# 3. Model Training Functions
# ----------------------------------------------------

def train_nowcast(X, y, epochs=40):
    print("\n--- Training Nowcast CNN Model ---")
    model = NowcastCNN()
    optimizer = optim.Adam(model.parameters(), lr=0.005)
    criterion = nn.CrossEntropyLoss()
    
    model.train()
    for epoch in range(epochs):
        optimizer.zero_grad()
        outputs = model(X)
        loss = criterion(outputs, y)
        loss.backward()
        optimizer.step()
        
        if (epoch + 1) % 10 == 0 or epoch == 0:
            # Calculate accuracy
            _, preds = torch.max(outputs, 1)
            acc = (preds == y).sum().item() / len(y)
            print(f"  Epoch {epoch+1:02d}/{epochs} | Loss: {loss.item():.4f} | Accuracy: {acc:.2%}")
            
    return model

def train_forecast(X, y, epochs=40):
    print("\n--- Training Forecast TCN Model ---")
    model = ForecastTCN()
    optimizer = optim.Adam(model.parameters(), lr=0.003)
    criterion = nn.BCEWithLogitsLoss()
    
    model.train()
    for epoch in range(epochs):
        optimizer.zero_grad()
        outputs = model(X)
        loss = criterion(outputs, y)
        loss.backward()
        optimizer.step()
        
        if (epoch + 1) % 10 == 0 or epoch == 0:
            probs = torch.sigmoid(outputs)
            preds = (probs >= 0.5).float()
            acc = (preds == y).sum().item() / len(y)
            print(f"  Epoch {epoch+1:02d}/{epochs} | Loss: {loss.item():.4f} | Accuracy: {acc:.2%}")
            
    return model

# ----------------------------------------------------
# 4. Weight Translation & JSON Exporter
# ----------------------------------------------------

def export_nowcast_weights(model, path="models/nowcast_cnn_weights.json"):
    print(f"\nTranslating and exporting Nowcast CNN weights to: {path}")
    
    # 1. Conv1: shape (32, 9, 5) -> permute to (2, 1, 0) -> (5, 9, 32)
    w_conv1 = model.conv1.weight.permute(2, 1, 0).detach().numpy().tolist()
    b_conv1 = model.conv1.bias.detach().numpy().tolist()
    
    # 2. Conv2: shape (64, 32, 3) -> permute to (2, 1, 0) -> (3, 32, 64)
    w_conv2 = model.conv2.weight.permute(2, 1, 0).detach().numpy().tolist()
    b_conv2 = model.conv2.bias.detach().numpy().tolist()
    
    # 3. Dense1: shape (64, 64) -> transpose -> (64, 64)
    w_dense1 = model.dense1.weight.t().detach().numpy().tolist()
    b_dense1 = model.dense1.bias.detach().numpy().tolist()
    
    # 4. Dense2: shape (4, 64) -> transpose -> (64, 4)
    w_dense2 = model.dense2.weight.t().detach().numpy().tolist()
    b_dense2 = model.dense2.bias.detach().numpy().tolist()
    
    weights = {
        'w_conv1': w_conv1, 'b_conv1': b_conv1,
        'w_conv2': w_conv2, 'b_conv2': b_conv2,
        'w_dense1': w_dense1, 'b_dense1': b_dense1,
        'w_dense2': w_dense2, 'b_dense2': b_dense2
    }
    
    os.makedirs(os.path.dirname(os.path.join(project_root, path)), exist_ok=True)
    with open(os.path.join(project_root, path), 'w') as f:
        json.dump(weights, f, indent=2)
    print("Nowcast weights exported successfully!")

def export_forecast_weights(model, path="models/forecast_tcn_weights.json"):
    print(f"\nTranslating and exporting Forecast TCN weights to: {path}")
    
    # Causal Conv blocks require kernel dimension flip: weight.flip(dims=[2]).permute(2, 1, 0)
    w_tcn1 = model.tcn1.conv.weight.flip(dims=[2]).permute(2, 1, 0).detach().numpy().tolist()
    b_tcn1 = model.tcn1.conv.bias.detach().numpy().tolist()
    
    w_tcn2 = model.tcn2.conv.weight.flip(dims=[2]).permute(2, 1, 0).detach().numpy().tolist()
    b_tcn2 = model.tcn2.conv.bias.detach().numpy().tolist()
    
    w_tcn3 = model.tcn3.conv.weight.flip(dims=[2]).permute(2, 1, 0).detach().numpy().tolist()
    b_tcn3 = model.tcn3.conv.bias.detach().numpy().tolist()
    
    w_tcn4 = model.tcn4.conv.weight.flip(dims=[2]).permute(2, 1, 0).detach().numpy().tolist()
    b_tcn4 = model.tcn4.conv.bias.detach().numpy().tolist()
    
    # Dense layers
    w_dense1 = model.dense1.weight.t().detach().numpy().tolist()
    b_dense1 = model.dense1.bias.detach().numpy().tolist()
    
    w_dense2 = model.dense2.weight.t().detach().numpy().tolist()
    b_dense2 = model.dense2.bias.detach().numpy().tolist()
    
    weights = {
        'w_tcn1': w_tcn1, 'b_tcn1': b_tcn1,
        'w_tcn2': w_tcn2, 'b_tcn2': b_tcn2,
        'w_tcn3': w_tcn3, 'b_tcn3': b_tcn3,
        'w_tcn4': w_tcn4, 'b_tcn4': b_tcn4,
        'w_dense1': w_dense1, 'b_dense1': b_dense1,
        'w_dense2': w_dense2, 'b_dense2': b_dense2
    }
    
    os.makedirs(os.path.dirname(os.path.join(project_root, path)), exist_ok=True)
    with open(os.path.join(project_root, path), 'w') as f:
        json.dump(weights, f, indent=2)
    print("Forecast weights exported successfully!")

# ----------------------------------------------------
# 5. Main Loop
# ----------------------------------------------------

def main():
    print("=" * 60)
    print("ISRO Solar Flare Model Optimizer (PyTorch -> Pure Python Export)")
    print("=" * 60)
    
    X_nc, y_nc, X_fc, y_fc = prepare_data()
    
    # Train
    nc_model = train_nowcast(X_nc, y_nc, epochs=50)
    fc_model = train_forecast(X_fc, y_fc, epochs=50)
    
    # Export
    export_nowcast_weights(nc_model)
    export_forecast_weights(fc_model)
    
    print("\n" + "=" * 60)
    print("Training and Weight Translation Complete!")
    print("The production JSON weights files have been updated.")
    print("You can run python scripts/backtest.py to verify performance.")
    print("=" * 60)

if __name__ == "__main__":
    main()
