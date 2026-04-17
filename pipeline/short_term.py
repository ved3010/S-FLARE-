"""Transparent, dependency-light short-horizon inference for the dashboard.

This is a baseline regressor used until a model trained on sufficient labelled
Aditya-L1 events is available.  It never reads observations after ``now``.
"""
from __future__ import annotations

from datetime import datetime, timezone
import math
from typing import Any, Dict, List


def _activity_level(flux: float) -> str:
    if flux >= 1e-4:
        return "EXTREME"
    if flux >= 1e-5:
        return "HIGH"
    if flux >= 1e-6:
        return "ELEVATED"
    return "NORMAL"


def forecast_from_history(history: List[Dict[str, Any]], horizon_minutes: int) -> Dict[str, Any]:
    """Forecast flux with a robust recent linear trend, using timestamps.

    The regression window is the latest five minutes of observations.  Its
    slope is clipped to avoid extrapolating a noisy one-sample spike.
    """
    if horizon_minutes not in (1, 2):
        raise ValueError("horizon_minutes must be 1 or 2")
    clean = [p for p in history if isinstance(p.get("timestamp"), (int, float))
             and isinstance(p.get("softFlux"), (int, float)) and p["softFlux"] > 0]
    if len(clean) < 3:
        raise ValueError("At least three valid observations are required for a forecast")
    clean.sort(key=lambda p: p["timestamp"])
