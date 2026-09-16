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
    C = len(x[0])
    L_out = L // pool_size
    out = [[0.0] * C for _ in range(L_out)]
    for i in range(L_out):
        for c in range(C):
            out[i][c] = max(x[i*pool_size + p][c] for p in range(pool_size))
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

def nowcast_predict(x, weights_path="models/nowcast_cnn_weights.json"):
    """Inference for the 1D CNN Nowcast classifier (pure Python).
    Input x: nested list of shape (60, 9) or numpy array
    Output: probability list of shape (4,), state class string, confidence score
    """
    # If numpy array, convert to list
    if hasattr(x, "tolist"):
        x = x.tolist()
        
    w = load_nowcast_model(weights_path)
    
    # 1. Conv1D + ReLU -> input (60, 9), weights (5, 9, 32)
    # Output: (56, 32)
    c1 = py_conv1d(x, w['w_conv1'], w['b_conv1'])
    c1_rect = py_relu(c1)
    
    # 2. MaxPool1D -> input (56, 32), pool_size=2
    # Output: (28, 32)
    p1 = py_maxpool1d(c1_rect, pool_size=2)
    
    # 3. Conv1D + ReLU -> input (28, 32), weights (3, 32, 64)
    # Output: (26, 64)
    c2 = py_conv1d(p1, w['w_conv2'], w['b_conv2'])
    c2_rect = py_relu(c2)
    
    # 4. Global Average Pooling -> input (26, 64)
    # Output: (64,)
    gap = py_gap(c2_rect)
    
    # 5. Dense 1 + ReLU -> input (64,), weights (64, 64)
    # Output: (64,)
    d1_logits = [sum(gap[ci] * w['w_dense1'][ci][co] for ci in range(64)) + w['b_dense1'][co] for co in range(64)]
    d1 = [max(0.0, val) for val in d1_logits]
    
    # 6. Dense 2 + Softmax -> input (64,), weights (64, 4)
    # Output: (4,)
    logits = py_dense(d1, w['w_dense2'], w['b_dense2'])
    probs = py_softmax(logits)
    
    classes = ["QUIET", "FLARE_ONSET", "FLARE_PEAK", "FLARE_DECAY"]
    pred_idx = probs.index(max(probs))
    pred_class = classes[pred_idx]
    confidence = probs[pred_idx]
    
    return probs, pred_class, confidence

if __name__ == "__main__":
    # Quick test
    x_test = [[0.0] * 9 for _ in range(60)]
    probs, cls, conf = nowcast_predict(x_test)
    print(f"Test probabilities: {probs}")
    print(f"Test prediction: {cls} (Confidence: {conf:.4f})")
