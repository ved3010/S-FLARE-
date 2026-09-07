# SOLAR FLARE FORECASTING USING ADITYA-L1 X-RAY DATA

Short-Term Solar Flare Forecasting and Nowcasting using Soft and Hard X-Ray Data from Aditya-L1 (SoLEXS & HEL1OS).

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
