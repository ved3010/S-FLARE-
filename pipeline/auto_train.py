"""
pipeline/auto_train.py — Background Auto-Retrain Module

Periodically:
    1. Fetches fresh NOAA GOES X-ray flux data
    2. Trains NowcastCNN and ForecastTCN on the latest data
    3. Exports trained weights to models/
    4. Clears the inference cache so the pipeline uses new weights immediately

Runs in a background daemon thread, integrated with the FastAPI server's startup.
"""

import os
import sys
import time
import json
import logging
import threading
import subprocess
from datetime import datetime

logger = logging.getLogger("auto_train")
# Ensure logger has a handler so background thread output is visible
if not logger.handlers:
    logger.addHandler(logging.StreamHandler())
    logger.setLevel(logging.INFO)

# ── Cache busting imports (reloaded after training to pick up new weights) ──
# These modules cache loaded weights in global _WEIGHTS variables.
# After training, we set _WEIGHTS = None to force re-load on next inference.
CACHE_MODULES = [
    "pipeline.nowcast",
    "pipeline.forecast",
]


def bust_model_cache():
    """Clear cached model weights so next inference loads the newly trained weights."""
    import importlib
    for mod_name in CACHE_MODULES:
        try:
            mod = importlib.import_module(mod_name)
            if hasattr(mod, "_WEIGHTS"):
                mod._WEIGHTS = None
                logger.info(f"  Cleared {mod_name}._WEIGHTS cache")
        except Exception as e:
            logger.warning(f"  Could not clear {mod_name} cache: {e}")


def run_training(epochs=30, lr=0.001):
    """Execute the training script and return True on success.

    Uses subprocess to run train_real.py in a separate process so memory
    (PyTorch tensors) is fully released after training completes.
    """
    script_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "scripts", "train_real.py"
    )

    # Use the venv Python (same as the running server) to ensure numpy/torch are available
    venv_python = sys.executable
    # Ensure we're not using the system python (which may lack numpy)
    if 'ucrt64' in venv_python or 'msys' in venv_python:
        # Try known venv paths; fall back to sys.executable
        for candidate in [
            os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.venv', 'bin', 'python.exe'),
            os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.venv', 'Scripts', 'python.exe'),
        ]:
            if os.path.exists(candidate):
                venv_python = candidate
                break
    cmd = [
        venv_python, script_path,
        "--source", "noaa",
        "--epochs", str(epochs),
        "--lr", str(lr),
    ]

    logger.info(f"  Running: {' '.join(cmd)}")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=3600,  # 1 hour max
            cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        )

        if result.returncode == 0:
            # Log key lines from the output
            for line in result.stdout.split("\n"):
                if any(kw in line.lower() for kw in
                       ["fetched", "samples", "epoch", "best",
                        "saved", "verif", "complete", "error", "warn"]):
                    logger.info(f"    {line.strip()}")
            logger.info("  Training completed successfully")
            return True
        else:
            logger.error(f"  Training failed (exit code {result.returncode})")
            for line in (result.stderr or "").split("\n")[-20:]:
                if line.strip():
                    logger.error(f"    {line.strip()}")
            return False

    except subprocess.TimeoutExpired:
        logger.error("  Training timed out after 3600s")
        return False
    except Exception as e:
        logger.error(f"  Training error: {e}")
        return False


def auto_retrain_loop(interval_hours=6, epochs=30, lr=0.001):
    """Background loop that re-trains models on fresh NOAA data.

    Runs in a daemon thread. Checks every 60 seconds if it's time to retrain.
    After successful training, busts the model cache for immediate effect.

    Args:
        interval_hours: How often to retrain (default 6 hours)
        epochs: Number of training epochs per retrain (default 30)
        lr: Learning rate (default 0.001)
    """
    last_train_time = 0
    first_run = True

    logger.info(f"Auto-retrain started (interval={interval_hours}h, epochs={epochs})")

    while True:
        now = time.time()
        should_train = False

        if first_run:
            # Do an initial training pass shortly after startup
            logger.info("[AUTO-TRAIN] Initial training pass starting in 30 seconds...")
            time.sleep(30)
            should_train = True
            first_run = False
        elif now - last_train_time >= interval_hours * 3600:
            should_train = True

        if should_train:
            ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
            logger.info(f"[AUTO-TRAIN] ===== Scheduled training at {ts} UTC =====")

            success = run_training(epochs=epochs, lr=lr)

            if success:
                bust_model_cache()
                last_train_time = now
                logger.info(f"[AUTO-TRAIN] Training cycle complete. Next: +{interval_hours}h")
            else:
                logger.warning(f"[AUTO-TRAIN] Training cycle failed. Will retry in 30min")
                # On failure, retry sooner
                last_train_time = now - (interval_hours * 3600) + 1800

        # Check every 60 seconds
        time.sleep(60)


def start_auto_retrain(interval_hours=6, epochs=30, lr=0.001, daemon=True):
    """Start the auto-retrain background thread.

    Call this from the FastAPI server's startup event.

    Args:
        interval_hours: How often to retrain (default 6)
        epochs: Training epochs (default 30)
        lr: Learning rate (default 0.001)
        daemon: If True, thread exits when main process exits

    Returns:
        The background thread object
    """
    thread = threading.Thread(
        target=auto_retrain_loop,
        args=(interval_hours, epochs, lr),
        daemon=daemon,
        name="auto-retrain"
    )
    thread.start()
    logger.info(f"Auto-retrain thread started (PID: {thread.ident})")
    return thread
