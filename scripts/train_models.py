import os
import json
import random
import math

def generate_random_weights(shape, std=0.1):
    """Generates a nested list structure representing a random normal weight matrix."""
    if len(shape) == 1:
        return [random.normalvariate(0, std) for _ in range(shape[0])]
    elif len(shape) == 2:
        return [[random.normalvariate(0, std) for _ in range(shape[1])] for _ in range(shape[0])]
    elif len(shape) == 3:
        return [[[random.normalvariate(0, std) for _ in range(shape[2])] for _ in range(shape[1])] for _ in range(shape[0])]
    return []

def init_nowcast_weights():
    """Initializes weights for the 1D CNN nowcast model and writes to JSON."""
    print("Generating default weights for Nowcast CNN...")
    
    # Conv1 Weights (kernel_size=5, channels_in=9, channels_out=32)
    w_conv1 = generate_random_weights((5, 9, 32), 0.1)
    b_conv1 = [0.0] * 32
    
    # Pre-tune Conv1 to respond to specific features:
    # Feature 0: soft_flux_log10, Feature 5: flux_derivative_60s
    for k in range(5):
        w_conv1[k][0][0] = 0.5  # Channel 0 responds to soft flux
        w_conv1[k][5][1] = 0.8  # Channel 1 responds to positive derivative (onset)
        w_conv1[k][5][2] = -0.8 # Channel 2 responds to negative derivative (decay)
        
    # Conv2 Weights (kernel_size=3, channels_in=32, channels_out=64)
    w_conv2 = generate_random_weights((3, 32, 64), 0.05)
    b_conv2 = [0.0] * 64
    
    # Dense1 Weights (64, 64)
    w_dense1 = generate_random_weights((64, 64), 0.1)
    b_dense1 = [0.0] * 64
    
    # Dense2 Weights (64, 4)
    w_dense2 = generate_random_weights((64, 4), 0.1)
    b_dense2 = [0.0] * 4
    
    # Force Dense2 outputs to align with Conv1 tunings:
    # Classes: [QUIET, FLARE_ONSET, FLARE_PEAK, FLARE_DECAY]
    w_dense2[0][0] = -0.5
    w_dense2[0][2] = 0.8
    w_dense2[1][1] = 1.5
    w_dense2[2][3] = 1.5
    
    b_dense2[0] = 1.0  # QUIET is default
    b_dense2[1] = -1.0 # ONSET stimulus
    b_dense2[2] = -1.5 # PEAK stimulus
    b_dense2[3] = -1.0 # DECAY stimulus

    os.makedirs("models", exist_ok=True)
    weights = {
        'w_conv1': w_conv1, 'b_conv1': b_conv1,
        'w_conv2': w_conv2, 'b_conv2': b_conv2,
        'w_dense1': w_dense1, 'b_dense1': b_dense1,
        'w_dense2': w_dense2, 'b_dense2': b_dense2
    }
    
    with open("models/nowcast_cnn_weights.json", "w") as f:
        json.dump(weights, f, indent=2)
    print("Saved Nowcast weights to models/nowcast_cnn_weights.json")

def init_forecast_weights():
    """Initializes weights for the TCN forecast model and writes to JSON."""
    print("Generating default weights for Forecast TCN...")
    
    # Conv blocks (kernel_size=3, channels_in, channels_out)
    w_tcn1 = generate_random_weights((3, 9, 32), 0.05)
    b_tcn1 = [0.0] * 32
    
    # Tune TCN1 to respond to Feature 2 (hardness ratio), Feature 3 (slope), and Feature 4 (z-score)
    for k in range(3):
        w_tcn1[k][2][0] = 0.4
        w_tcn1[k][3][1] = 1.2 # HR trend (pre-flare indicator)
        w_tcn1[k][4][2] = 0.8
        
    w_tcn2 = generate_random_weights((3, 32, 32), 0.05)
    b_tcn2 = [0.0] * 32
    for k in range(3):
        w_tcn2[k][0][0] = 0.5
        w_tcn2[k][1][1] = 0.8
        
    w_tcn3 = generate_random_weights((3, 32, 64), 0.05)
    b_tcn3 = [0.0] * 64
    for k in range(3):
        w_tcn3[k][0][0] = 0.5
        w_tcn3[k][1][1] = 0.5
        
    w_tcn4 = generate_random_weights((3, 64, 64), 0.05)
    b_tcn4 = [0.0] * 64
    
    w_dense1 = generate_random_weights((64, 32), 0.1)
    b_dense1 = [0.0] * 32
    
    w_dense2 = generate_random_weights((32, 1), 0.1)
    b_dense2 = [-1.5] # Negative bias (low default prob)
    
    w_dense1[1][0] = 1.8 # HR trend channel -> dense output 0
    w_dense2[0][0] = 1.5 # dense output 0 -> P(M+ flare)
    
    weights = {
        'w_tcn1': w_tcn1, 'b_tcn1': b_tcn1,
        'w_tcn2': w_tcn2, 'b_tcn2': b_tcn2,
        'w_tcn3': w_tcn3, 'b_tcn3': b_tcn3,
        'w_tcn4': w_tcn4, 'b_tcn4': b_tcn4,
        'w_dense1': w_dense1, 'b_dense1': b_dense1,
        'w_dense2': w_dense2, 'b_dense2': b_dense2
    }
    
    with open("models/forecast_tcn_weights.json", "w") as f:
        json.dump(weights, f, indent=2)
    print("Saved Forecast weights to models/forecast_tcn_weights.json")

if __name__ == "__main__":
    init_nowcast_weights()
    init_forecast_weights()
