import os
import json
import math

# Global cache for model weights
_WEIGHTS = None

def load_forecast_model(weights_path="models/forecast_tcn_weights.json"):
    global _WEIGHTS
    if _WEIGHTS is not None:
        return _WEIGHTS
        
    if not os.path.exists(weights_path):
        print(f"Weights file {weights_path} not found. Generating default weights...")
        from scripts.train_models import init_forecast_weights
        init_forecast_weights()
        
    with open(weights_path, 'r') as f:
        _WEIGHTS = json.load(f)
    return _WEIGHTS

def py_relu(x):
    return [[max(0.0, val) for val in row] for row in x]

def py_sigmoid(x):
    # Clip to avoid overflow
    x = max(-20.0, min(20.0, x))
    return 1.0 / (1.0 + math.exp(-x))

def py_dilated_causal_conv1d(x, w, b, dilation=1):
    L = len(x)
    C_in = len(x[0])
    K = len(w)
    C_out = len(w[0][0])
    
    out = [[0.0] * C_out for _ in range(L)]
    for i in range(L):
        for co in range(C_out):
            val = 0.0
            for k in range(K):
                idx = i - k * dilation
                if idx >= 0:
                    for ci in range(C_in):
                        val += x[idx][ci] * w[k][ci][co]
            out[i][co] = val + b[co]
