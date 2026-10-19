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

function updateState(nextFields) {
  state = { ...state, ...nextFields };
  listeners.forEach(l => l(state));
}

export function getState() {
  return state;
}

export function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useLiveState() {
  const [liveData, setLiveData] = useState(state);
  
  useEffect(() => {
    setLiveData(state);
    return subscribe(setLiveData);
  }, []);
  
  return liveData;
}

// ------------------------------------------
// WebSocket and REST Ingestion Client
// ------------------------------------------
let ws = null;
let reconnectTimer = null;

const API_HTTP_HOST = '';
const API_WS_HOST = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

let pollTimer = null;

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    // Poll status
    fetch(`${API_HTTP_HOST}/api/status`)
      .then(r => r.json())
      .then(data => {
        updateState({
          systemStatus: data.systemStatus,
          nowcast: data.nowcast,
          forecast: data.forecast,
          hardnessRatio: data.hardnessRatio,
          alerts: data.alerts || [],
          flareClass: data.flareClass || state.flareClass
        });
      })
      .catch(() => {});
    // Poll timeseries
    fetch(`${API_HTTP_HOST}/api/timeseries?hours=6`)
      .then(r => r.json())
      .then(points => {
        updateState({ fluxData: points });
      })
      .catch(() => {});
  }, 5000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function initWebSocketConnection() {
  // Fetch initial data via REST immediately
  fetch(`${API_HTTP_HOST}/api/status`)
    .then(r => r.json())
    .then(data => {
      updateState({
        systemStatus: { ...data.systemStatus, pipeline: 'Operational' },
        nowcast: data.nowcast,
        forecast: data.forecast,
        hardnessRatio: data.hardnessRatio,
        alerts: data.alerts || [],
        flareClass: data.flareClass || state.flareClass
      });
    })
    .catch(err => {
      console.warn("Failed to load status from API server.", err);
    });

  fetch(`${API_HTTP_HOST}/api/timeseries?hours=6`)
    .then(r => r.json())
    .then(points => {
      updateState({ fluxData: points });
    })
    .catch(err => {
      console.warn("Failed to load timeseries from API server.", err);
    });

  // Start REST polling as primary data source
  startPolling();

  // Also try WebSocket for lower latency
  connectWS();
}

function connectWS() {
  if (ws) {
    try {
      ws.close();
    } catch(e) {}
  }
  
  console.log("Connecting to WebSocket:", `${API_WS_HOST}/ws/live`);
  ws = new WebSocket(`${API_WS_HOST}/ws/live`);
  
  ws.onopen = () => {
    console.log("WebSocket connection established with Solar Flare Forecasting server.");
    updateState({
      systemStatus: {
        ...state.systemStatus,
        pipeline: 'Operational',
        dataLatency: '1.2s'
      }
    });
    // WebSocket is connected, stop REST polling to avoid duplicates
    stopPolling();
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };
  
  ws.onmessage = (event) => {
    try {
      const data = jsonParse(event.data);
      if (data) {
        const nextFlux = [...state.fluxData];
        
        const ts_ms = Date.now();
        nextFlux.push({
          timestamp: ts_ms,
          softFlux: data.nowcast.peakFlux,
          hardFlux: data.hardnessRatio.current * (data.nowcast.peakFlux * 1e8) * 1.5e-8,
          hardnessRatio: data.hardnessRatio.current
        });
        
        if (nextFlux.length > 1000) {
          nextFlux.shift();
        }
        
        updateState({
          fluxData: nextFlux,
          systemStatus: data.systemStatus,
          nowcast: data.nowcast,
          forecast: data.forecast,
          forecast1Min: data.forecast1Min || data.forecast?.forecast1Min || state.forecast1Min,
          forecast2Min: data.forecast2Min || data.forecast?.forecast2Min || state.forecast2Min,
          hardnessRatio: data.hardnessRatio,
          alerts: data.alerts,
          flareClass: data.flareClass || state.flareClass
        });
      }
    } catch (e) {
      console.error("Error processing websocket frame:", e);
    }
  };
  
  ws.onclose = () => {
    console.warn("WebSocket disconnected. Falling back to REST polling. Retrying WS in 5s...");
    // Fall back to REST polling
    startPolling();
    
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectWS();
      }, 5000);
    }
  };
  
  ws.onerror = (err) => {
    console.error("WebSocket connection encountered an error:", err);
  };
}

function jsonParse(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

// ------------------------------------------
// Push Notification Support (PWA)
// ------------------------------------------
let _lastNotifiedClass = '';

export function requestNotificationPermission() {
  // Register service worker first
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('SW registered'))
      .catch(e => console.warn('SW registration failed:', e));
  }
  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(perm => {
      console.log('Notification permission:', perm);
    });
  }
}

export function fireNotification(title, body, tag) {
  // Don't spam the same alert
  if (tag === _lastNotifiedClass) return;
  _lastNotifiedClass = tag || '';

  if ('Notification' in window && Notification.permission === 'granted') {
    // Try service worker push first
    if (navigator.serviceWorker?.ready) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, {
          body,
          icon: '/icon.svg',
          badge: '/icon.svg',
          vibrate: [200, 100, 200],
          tag: tag || 'solflare',
          requireInteraction: true,
          silent: false,
        });
      }).catch(() => {
        // Fallback to regular notification
        new Notification(title, { body, icon: '/icon.svg' });
      });
    } else {
      new Notification(title, { body, icon: '/icon.svg' });
    }
  }
}

// Track flare class changes for notification triggers
let _prevFlareClass = null;

export function checkFlareAlert(flareClass) {
  if (!flareClass || flareClass === _prevFlareClass) return;
  const letter = flareClass.charAt(0).toUpperCase();
  const prevLetter = _prevFlareClass ? _prevFlareClass.charAt(0).toUpperCase() : 'B';

  // Only notify on escalation to M-class or above
  if ((letter === 'M' || letter === 'X') &&
      (prevLetter === 'A' || prevLetter === 'B' || prevLetter === 'C')) {
    const title = `⚡ ${flareClass} Flare Detected!`;
    const body = `SolFlare has detected a ${flareClass} solar flare. Check the dashboard for impact assessment and infrastructure risk details.`;
    fireNotification(title, body, flareClass);
  }

  _prevFlareClass = flareClass;
}

export function useNotificationWatcher() {
  const { flareClass } = useLiveState();
  useEffect(() => {
    checkFlareAlert(flareClass);
  }, [flareClass]);
}

export async function fetchShortTermForecast() {
  try {
    const res = await fetch('/api/short-term-forecast');
    if (res.ok) {
      const data = await res.json();
      updateState({ shortTermForecast: data });
      return data;
    }
  } catch (e) {
    console.warn("Could not fetch short-term forecast:", e);
  }
  return null;
}

export async function fetchDataQuality() {
  try {
    const res = await fetch('/api/data-quality');
    if (res.ok) {
      const data = await res.json();
      updateState({ dataQuality: data });
      return data;
    }
  } catch (e) {
    console.warn("Could not fetch data quality:", e);
  }
  return null;
}

export async function fetchActualVsPredicted() {
  try {
    const res = await fetch('/api/actual-vs-predicted');
    if (res.ok) {
      const data = await res.json();
      updateState({ actualVsPredicted: data });
      return data;
    }
  } catch (e) {
    console.warn("Could not fetch actual vs predicted:", e);
  }
  return [];
}

export async function fetchModelComparison() {
  try {
    const res = await fetch('/api/models/comparison');
    if (res.ok) {
      const data = await res.json();
      updateState({ modelsComparison: data });
      return data;
    }
  } catch (e) {
    console.warn("Could not fetch model comparison:", e);
  }
  return [];
}

export async function selectActiveModel(modelName) {
  try {
    const res = await fetch('/api/models/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelName })
    });
    if (res.ok) {
      updateState({ activeModelName: modelName });
      fetchModelComparison();
      return true;
    }
  } catch (e) {
    console.error("Failed to select active model:", e);
  }
  return false;
}

export async function controlSimulation(action, speed = 1.0) {
  try {
    const res = await fetch('/api/simulation/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, speed })
    });
    if (res.ok) {
      const data = await res.json();
      updateState({
        systemStatus: {
          ...state.systemStatus,
          simState: action === 'pause' ? 'PAUSED' : 'RUNNING',
          simSpeed: speed
        }
      });
      return data;
    }
  } catch (e) {
    console.error("Failed to control simulation:", e);
  }
  return null;
}
