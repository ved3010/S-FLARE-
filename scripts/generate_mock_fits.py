import os
import math
import random
import json

def generate_mock_data():
    print("Generating simulated solar flare telemetry...")
    duration_sec = 7200 # 2 hours
    
    # Base timestamp: 2024-09-15 12:00:00 UTC
    base_time = 1726401600.0
    
    # Base parameters
    bg_soft = 5e-8
    bg_hard = 3.0
    flare_onset = 3000
    
    # 1. HEL1OS rates
    hard_rate_25_50 = []
    for i in range(duration_sec):
        # Base background
        val = bg_hard + random.gauss(0, 0.5)
        # Double Gaussian spike
        if i >= flare_onset:
            dt1 = (i - 3300) / 120.0
            dt2 = (i - 3500) / 80.0
            spike1 = 800.0 * math.exp(-dt1 * dt1)
            spike2 = 400.0 * math.exp(-dt2 * dt2)
            val += spike1 + spike2
        hard_rate_25_50.append(max(0.1, val))
        
    hard_rate_15_25 = [max(0.1, val * 2.5 + random.gauss(0, 1.0)) for val in hard_rate_25_50]
    hard_rate_50_100 = [max(0.01, val * 0.15 + random.gauss(0, 0.2)) for val in hard_rate_25_50]
    
    # 2. SoLEXS Soft X-Ray flux (Neupert Effect integration)
    soft_flux = [bg_soft]
    alpha = 5e-11
    eta = 0.0015
    
    for i in range(1, duration_sec):
        dS_dt = alpha * hard_rate_25_50[i-1] - eta * (soft_flux[i-1] - bg_soft)
        val = soft_flux[i-1] + dS_dt + random.gauss(0, 1e-10)
        soft_flux.append(max(1e-9, val))
        
    # Cadence selection for SoLEXS
    solexs_records = []
    last_written = -100
    
    for i in range(duration_sec):
        t_val = base_time + i
        flux = soft_flux[i]
        
        # Flare mode check
        is_flare = False
        if i > 0:
            deriv = soft_flux[i] - soft_flux[i-1]
            if flux > 2e-7 or deriv > 5e-9:
                is_flare = True
                
        # Sample cadence logic
        if is_flare or (i - last_written >= 60):
            # Sum counts across 5 simulated channels
            counts_base = flux / 1.5e-8
            for chan in range(1, 6):
                chan_scale = math.exp(-(chan - 1) * 0.4)
