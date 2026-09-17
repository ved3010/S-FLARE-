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
    return out

def py_gap(x):
    L = len(x)
    C = len(x[0])
    out = [0.0] * C
    for c in range(C):
        out[c] = sum(x[i][c] for i in range(L)) / L
    return out

def py_dense(x, w, b):
    C_in = len(x)
    C_out = len(w[0])
    out = [0.0] * C_out
    for co in range(C_out):
        val = 0.0
        for ci in range(C_in):
            val += x[ci] * w[ci][co]
        out[co] = val + b[co]
    return out

def forecast_predict(x, weights_path="models/forecast_tcn_weights.json"):
    """Inference for the Temporal Convolutional Network (pure Python).
    Input x: nested list of shape (720, 9) representing 1 hour of features
    Output: probability of M-class or larger flare within next 3 hours (float)
    """
    if hasattr(x, "tolist"):
        x = x.tolist()
        
    w = load_forecast_model(weights_path)
    
    # 1. Dilated Causal Conv Block 1 -> input (720, 9), weights (3, 9, 32), dilation=1
    x1 = py_relu(py_dilated_causal_conv1d(x, w['w_tcn1'], w['b_tcn1'], dilation=1))
    
    # 2. Dilated Causal Conv Block 2 -> input (720, 32), weights (3, 32, 32), dilation=2
    x2 = py_relu(py_dilated_causal_conv1d(x1, w['w_tcn2'], w['b_tcn2'], dilation=2))
    
    # 3. Dilated Causal Conv Block 3 -> input (720, 32), weights (3, 32, 64), dilation=4
    x3 = py_relu(py_dilated_causal_conv1d(x2, w['w_tcn3'], w['b_tcn3'], dilation=4))
    
    # 4. Dilated Causal Conv Block 4 -> input (720, 64), weights (3, 64, 64), dilation=8
    x4 = py_relu(py_dilated_causal_conv1d(x3, w['w_tcn4'], w['b_tcn4'], dilation=8))
    
    # 5. Global Average Pooling -> input (720, 64)
    gap = py_gap(x4)
    
    # 6. Dense 1 + ReLU -> input (64,), weights (64, 32)
    d1 = py_relu([py_dense(gap, w['w_dense1'], w['b_dense1'])])[0]
    
    # 7. Dense 2 + Sigmoid -> input (32,), weights (32, 1)
    logits = py_dense(d1, w['w_dense2'], w['b_dense2'])
    prob = py_sigmoid(logits[0])
    
    return float(prob)

if __name__ == "__main__":
    # Quick test
    x_test = [[0.0] * 9 for _ in range(720)]
    prob = forecast_predict(x_test)
    print(f"Test probability: {prob:.4f}")
