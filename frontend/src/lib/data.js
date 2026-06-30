import { useState, useEffect } from 'react';

// Static configurations and helpers
export const transferLearning = {
  source: `GOES XRS (1996-${new Date().getFullYear()})`,
  target: `Aditya-L1 SoLEXS/HEL1OS (${new Date().getFullYear()}-)`,
  fineTuneSamples: 142,
  pretrainEpochs: 200,
  finetuneEpochs: 50,
  domainAdaptation: 'Feature-level MMD',
  validationSplit: 0.2,
};

export function formatUTC(date) {
  if (!date || date === '—') return '—';
  try {
    return new Date(date).toISOString().replace('T', ' ').slice(0, 19);
  } catch (e) {
    return date;
  }
}

export function fmtFlux(v) {
  if (v === undefined || v === null) return '—';
  if (v >= 1e-4) return `${(v * 1e4).toFixed(1)}e-4`;
  if (v >= 1e-5) return `${(v * 1e5).toFixed(1)}e-5`;
  if (v >= 1e-6) return `${(v * 1e6).toFixed(1)}e-6`;
  if (v >= 1e-7) return `${(v * 1e7).toFixed(1)}e-7`;
  return v.toExponential(1);
}

export function fmtPct(v) {
  return `${(v * 100).toFixed(0)}%`;
}

// ------------------------------------------
// Centralized React-reactive Live Store
// ------------------------------------------
let state = {
  fluxData: [],
  systemStatus: {
    state: 'QUIET',
    stateLabel: 'Quiet Sun',
    stateColor: '#2ECC71',
    since: '—',
    pipeline: 'Initializing...',
    dataLatency: '—',
    lastSync: '—',
    pradanSync: 'Healthy',
    al1Sync: 'Healthy',
    modelVersion: 'v2.1.3'
  },
  nowcast: {
    class: '—',
    peakFlux: 5.0e-8,
    onset: '—',
    peakTime: '—',
    currentPhase: 'Quiet Sun',
    adaptiveThreshold: 3.0,
    rollingMAD: 2.8e-8,
    zScore: 0.0,
    confidence: 0.50
  },
  forecast: {
    probability: 12,
    updatedAt: '—',
    windowStart: '—',
    windowEnd: '—',
    nextClass: 'C-class',
    leadTime: 0,
    tcnConfidence: 0.12,
    forecast1Min: {
      horizonMinutes: 1,
      targetTime: '—',
      probability: 14,
      status: 'NORMAL',
      statusColor: '#2ECC71',
      confidence: 0.94
    },
    forecast2Min: {
      horizonMinutes: 2,
      targetTime: '—',
      probability: 18,
      status: 'NORMAL',
      statusColor: '#2ECC71',
      confidence: 0.90
    }
  },
  forecast1Min: {
    horizonMinutes: 1,
    targetTime: '—',
    probability: 14,
    status: 'NORMAL',
    statusColor: '#2ECC71',
    confidence: 0.94
  },
  forecast2Min: {
    horizonMinutes: 2,
    targetTime: '—',
    probability: 18,
    status: 'NORMAL',
    statusColor: '#2ECC71',
    confidence: 0.90
  },
  hardnessRatio: {
    current: 0.035,
    baseline: 0.035,
    threshold: 0.06,
    trend: 'stable',
    preFlareSignal: false,
    minutesEarly: 0
  },
  alerts: [],
  flareClass: 'B1.0',
  modelsComparison: [],
  activeModelName: 'LSTM (Deep Learning)'
};

const listeners = new Set();

