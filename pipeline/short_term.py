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

