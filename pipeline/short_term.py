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
    latest = clean[-1]
    start = latest["timestamp"] - 5 * 60_000
    recent = [p for p in clean if p["timestamp"] >= start]
    if len(recent) < 3:
        recent = clean[-min(len(clean), 60):]

    t0 = recent[0]["timestamp"] / 1000.0
    xs = [(p["timestamp"] / 1000.0) - t0 for p in recent]
    ys = [math.log10(max(p["softFlux"], 1e-12)) for p in recent]
    xbar, ybar = sum(xs) / len(xs), sum(ys) / len(ys)
    denom = sum((x - xbar) ** 2 for x in xs)
    slope = sum((x - xbar) * (y - ybar) for x, y in zip(xs, ys)) / denom if denom else 0.0
    slope = max(-0.01, min(0.01, slope))
    predicted = 10 ** (ys[-1] + slope * horizon_minutes * 60)
    predicted = max(1e-12, min(1e-2, predicted))
    target = latest["timestamp"] + horizon_minutes * 60_000
    return {
        "horizon_minutes": horizon_minutes,
        "target_time": datetime.fromtimestamp(target / 1000, tz=timezone.utc).isoformat().replace('+00:00', 'Z'),
        "predicted_flux": predicted,
        "activity": _activity_level(predicted),
        "risk": _activity_level(predicted),
        "confidence": round(min(0.8, 0.35 + len(recent) / 500), 2),
        "method": "Recent 5-minute log-linear baseline",
    }
