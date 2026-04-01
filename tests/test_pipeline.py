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
