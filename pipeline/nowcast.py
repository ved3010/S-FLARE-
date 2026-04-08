import os
import json
import math

# Global cache for model weights
_WEIGHTS = None

def load_nowcast_model(weights_path="models/nowcast_cnn_weights.json"):
    global _WEIGHTS
    if _WEIGHTS is not None:
        return _WEIGHTS
        
    if not os.path.exists(weights_path):
        print(f"Weights file {weights_path} not found. Generating default weights...")
        from scripts.train_models import init_nowcast_weights
        init_nowcast_weights()
        
    with open(weights_path, 'r') as f:
        _WEIGHTS = json.load(f)
    return _WEIGHTS

def py_relu(x):
    return [[max(0.0, val) for val in row] for row in x]

def py_softmax(x):
    max_val = max(x)
    exp_vals = [math.exp(val - max_val) for val in x]
    sum_exp = sum(exp_vals)
    return [ev / sum_exp for ev in exp_vals]

def py_conv1d(x, w, b):
    L = len(x)
    C_in = len(x[0])
    K = len(w)
    C_out = len(w[0][0])
    
    L_out = L - K + 1
    out = [[0.0] * C_out for _ in range(L_out)]
    
    for i in range(L_out):
        for co in range(C_out):
            val = 0.0
            for k in range(K):
                for ci in range(C_in):
                    val += x[i+k][ci] * w[k][ci][co]
            out[i][co] = val + b[co]
    return out

def py_maxpool1d(x, pool_size=2):
    L = len(x)
