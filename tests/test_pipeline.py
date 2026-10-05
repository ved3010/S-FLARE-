import os
import sys
import unittest
import numpy as np
import pandas as pd

# Add parent directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline.target_generation import create_short_term_targets, create_sliding_windows
from pipeline.features import compute_features_batch, compute_latest_features_pure
from pipeline.ingestion import generate_live_stream_point, align_al1_data
from pipeline.ml_models import ModelManager, FEATURE_NAMES
from pipeline.short_term import forecast_from_history

class TestSolarFlarePipeline(unittest.TestCase):

    def test_live_point_generation(self):
        pt = generate_live_stream_point(1726400000, flare_active=False)
        self.assertIn('time', pt)
        self.assertIn('soft_flux', pt)
        self.assertIn('hard_25_50', pt)
        self.assertGreater(pt['soft_flux'], 0)

    def test_data_alignment(self):
        soft_data = [{'time': 1000 + i*5, 'soft_flux': 5e-8} for i in range(10)]
        hard_data = [{'time': 1000 + i*5, 'hard_15_25': 6.0, 'hard_25_50': 3.0, 'hard_50_100': 0.5} for i in range(10)]
        aligned = align_al1_data(soft_data, hard_data)
        self.assertEqual(len(aligned), 46)  # 1000 to 1045
        self.assertIn('soft_flux', aligned[0])
        self.assertIn('hard_25_50', aligned[0])

    def test_feature_engineering(self):
        records = []
        for i in range(50):
            records.append({
                'time': 1000 + i * 5,
                'soft_flux': 5e-8 + (1e-6 if 20 <= i <= 25 else 0),
                'hard_15_25': 6.0,
                'hard_25_50': 3.0,
                'hard_50_100': 0.5
            })
        df = pd.DataFrame(records)
        df_feat = compute_features_batch(df)
        self.assertIn('hardness_ratio', df_feat.columns)
        self.assertIn('hr_slope_10m', df_feat.columns)
        self.assertIn('hr_zscore', df_feat.columns)
        self.assertEqual(len(df_feat), 50)

    def test_target_generation_timing_and_no_leakage(self):
        """
        Verify target_1min is looking at t + 30s to t + 60s
        and target_2min is looking at t + 90s to t + 120s
        and input features do not use future information.
        """
        records = []
        # Create a series with a flare spike at t = 1060s (i = 52, 1060s)
        for i in range(120):
            t = 800 + i * 5
            soft = 5e-8
            if t == 1060:
                soft = 2.0e-6  # Flare threshold exceeded
            records.append({'time': t, 'soft_flux': soft})

        df = pd.DataFrame(records)
        df_targets = create_short_term_targets(df, c_flare_threshold=1e-6)

        self.assertIn('target_1min_class', df_targets.columns)
        self.assertIn('target_2min_class', df_targets.columns)

        # For timestamp t = 1000s, t+60s is 1060s. Target_1min should capture the flare!
        row_t1000 = df_targets[df_targets['time'] == 1000].iloc[0]
        self.assertEqual(row_t1000['target_1min_class'], 1)

        # For timestamp t = 940s, 1060s is t + 120s. Target_2min should capture the flare!
        row_t940 = df_targets[df_targets['time'] == 940].iloc[0]
        self.assertEqual(row_t940['target_2min_class'], 1)
        # Rows without a complete future horizon must never receive their
        # current value as a substitute target.
        self.assertTrue(np.isnan(df_targets.iloc[-1]['target_2min_flux']))

    def test_forecast_horizons_use_timestamps(self):
        history = [
            {'timestamp': 1_000_000 + i * 10_000, 'softFlux': 1e-7 * (1 + i / 100)}
            for i in range(40)
        ]
        one = forecast_from_history(history, 1)
        two = forecast_from_history(history, 2)
        self.assertEqual(one['horizon_minutes'], 1)
        self.assertEqual(two['horizon_minutes'], 2)
        self.assertEqual(
            two['target_time'],
            '1970-01-01T00:25:10Z'
        )


    def test_model_manager(self):
        mm = ModelManager()
        comparison = mm.get_comparison()
        self.assertGreater(len(comparison), 0)
        
        # Verify both +1min and +2min horizons are present in comparative evaluation
        horizons = [item.get('horizon') for item in comparison]
        self.assertTrue(any('+1 min' in h for h in horizons if h))
        self.assertTrue(any('+2 min' in h for h in horizons if h))

        # Check model selection
        self.assertTrue(mm.set_active_model("Random Forest (+1min)"))
        self.assertEqual(mm.active_model_name, "Random Forest (+1min)")

if __name__ == "__main__":
    unittest.main()
