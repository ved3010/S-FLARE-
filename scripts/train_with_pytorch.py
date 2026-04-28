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
