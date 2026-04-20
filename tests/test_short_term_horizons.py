import unittest
import numpy as np
import pandas as pd
from pipeline.target_generation import create_short_term_targets

class TestShortTermHorizons(unittest.TestCase):
    def test_target_generation_timestamp_based(self):
        # Create dummy data with 10-second sampling rate
        # 1-minute horizon = 60s ahead, 2-minute horizon = 120s ahead
        times = np.arange(0, 300, 10)  # 30 rows over 300 seconds
        soft_flux = np.ones_like(times, dtype=float) * 1e-8
        
        # Inject a flare event around t = 180s (intensity = 5e-6, C-class)
        flare_mask = (times >= 170) & (times <= 190)
        soft_flux[flare_mask] = 5e-6

        df = pd.DataFrame({'time': times, 'soft_flux': soft_flux})
        df_target = create_short_term_targets(df, sampling_rate_sec=10, c_flare_threshold=1e-6)

        # At t = 120s:
        # 1-min window is (120+30, 120+60] = (150, 180]. Includes t=170,180 (flare!), so target_1min_class should be 1.
        row_120 = df_target[df_target['time'] == 120].iloc[0]
        self.assertEqual(row_120['target_1min_class'], 1)
        self.assertAlmostEqual(row_120['target_1min_flux'], 5e-6)

        # At t = 60s:
        # 2-min window is (60+90, 60+120] = (150, 180]. Includes t=170,180 (flare!), so target_2min_class should be 1.
        row_60 = df_target[df_target['time'] == 60].iloc[0]
        self.assertEqual(row_60['target_2min_class'], 1)
        self.assertAlmostEqual(row_60['target_2min_flux'], 5e-6)

    def test_variable_sampling_rate(self):
        # Create dummy data with 30-second sampling rate
        times = np.arange(0, 600, 30)
        soft_flux = np.ones_like(times, dtype=float) * 1e-8
