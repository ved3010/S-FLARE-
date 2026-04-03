# SOLAR FLARE FORECASTING USING ADITYA-L1 X-RAY DATA

Short-Term Solar Flare Forecasting and Nowcasting using Soft and Hard X-Ray Data from Aditya-L1 (SoLEXS & HEL1OS).

[![status](https://img.shields.io/badge/status-active_research-orange?style=flat-square)](#)

---

## 1. Problem Statement & Objective

Solar flares are intense bursts of electromagnetic radiation originating from solar active regions. Timely short-term forecasting allows space weather operators and satellite managers to anticipate radio blackouts and solar energetic particle events.

This system provides:
- **Current Solar Nowcast (t = 0m)**: Real-time flare classification, spectral Z-score, and peak flux tracking.
- **+1 Minute Forecast (t + 1m)**: 60-second forward X-ray flux prediction and activity level classification.
- **+2 Minute Forecast (t + 2m)**: 120-second forward X-ray flux prediction and risk level evaluation.

---

## 2. Satellite Instruments & Data Sources

The system is designed around India's flagship solar space observatory **Aditya-L1**:

1. **SoLEXS (Solar Low Energy X-ray Spectrometer)**: Measures soft X-ray emissions (1–30 keV).
2. **HEL1OS (High Energy L1 Orbiting X-ray Spectrometer)**: Measures hard X-ray emissions (10–150 keV).

### Data Modes & Transparency
- **Sample / Replay Mode**: Ships with local JSON telemetry files from both instruments (`data/raw/solexs/` & `data/raw/helios/`).
- **NOAA GOES Fallback**: Separately labelled fallback data from NOAA GOES XRS when live telemetry is unavailable. Fallback data is **never** misrepresented as Aditya-L1 data.

---

## 3. Data Fusion & Feature Engineering

1. **Timestamp Synchronization**: SoLEXS and HEL1OS observations are merged into a synchronized time-series representation.
2. **Resampling & Duplicate Handling**: Retains timestamp boundaries, drops exact duplicates, and maintains sampling cadence without row-count assumptions.
3. **9 Short-Term Features**:
   - `soft_flux_log10`: Logarithmic soft X-ray intensity.
   - `hard_rate_25_50`: Hard X-ray count rate (25–50 keV).
   - `hardness_ratio`: Spectral hardness ratio $\frac{\text{Hard Flux}}{\text{Soft Flux} \times 10^8} \times 0.035$.
   - `hr_slope_10m`: 10-minute rolling slope of the hardness ratio.
   - `hr_zscore`: 30-minute rolling Z-score of spectral hardness.
   - `flux_derivative_60s`: 60-second rate of change in soft X-ray flux.
   - `neupert_residual`: Deviation from Neupert-effect expectations ($|\text{Hard Rate} - \frac{dF}{dt} \times 1.2 \times 10^{10}|$).
   - `time_since_last_c_flare`: Time elapsed (in minutes) since the last C-class or higher flare.
   - `solar_activity_index`: Number of flare events recorded in the preceding 6 hours.

---

## 4. +1 Minute and +2 Minute Horizon Target Generation

Target generation relies strictly on **timestamp windows**, rather than assuming 1 row equals 1 minute:
- **+1 Minute Horizon**: Evaluated against future observation window `[t + 30s, t + 60s]`.
- **+2 Minute Horizon**: Evaluated against future observation window `[t + 90s, t + 120s]`.
- **Target Leakage Prevention**: Incomplete future windows (near the end of a time series) are explicitly set to `NaN` and excluded from model training/evaluation.

---

## 5. Machine Learning Models & Evaluation

The repository includes support for multiple Machine Learning & Deep Learning model architectures:
- **Random Forest Classifier**
- **Support Vector Machines (SVM)**
- **XGBoost / Gradient Boosted Trees**
- **LSTM (Long Short-Term Memory Neural Network)**
- **TCN (Temporal Convolutional Network)**

### Leakage Prevention
- **Chronological Splitting**: Data is split sequentially (70% Train, 15% Validation, 15% Test) without random shuffling.
- **Independent Fitting**: Scalers and feature transformers are fitted exclusively on training data.
