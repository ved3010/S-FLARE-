# SolFlare — Solar Flare Monitoring Dashboard

Real-time solar flare detection and forecasting using **Aditya-L1 SoLEXS + HEL1OS** X-ray instruments.

## Features

- **Dashboard** — Live status panel, X-ray flux chart, hardness ratio tracking, alert log
- **Replay Mode** — Historical event playback with time scrubber
- **Event Catalog** — Sortable table of detected flares with lead time and confidence
- **Metrics** — Backtesting results: POD, FAR, CSI, confusion matrix

## Tech Stack

- React 18 + Vite
- Tailwind CSS
- Custom SVG charts (no heavy charting libraries)

## Design Principles

- Information first, decoration never
- Status should scream — color + text + icon
- Everything has a number attached
- Dark mode default (control room aesthetic)

## Color Palette

| Token | Color | Usage |
|-------|-------|-------|
| Background | `#0D1117` | Near-black |
| Surface | `#161B22` | Card backgrounds |
| Quiet | `#3FB950` | All clear |
| Watch | `#D29922` | Pre-flare signature |
| Warning | `#E05C1A` | Flare probability > 60% |
| Active | `#F85149` | Flare in progress |
| Recovery | `#388BFD` | Event ending |

## Quick Start

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Project Structure
