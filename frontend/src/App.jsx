import { useState, useEffect, useRef, useCallback } from 'react';
import Landing from './components/Landing';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import ImpactPanel from './components/ImpactPanel';
import Replay from './components/Replay';
import Catalog from './components/Catalog';
import Metrics from './components/Metrics';
import DataExplorer from './components/DataExplorer';
import { initWebSocketConnection, requestNotificationPermission, useNotificationWatcher } from './lib/data';

// ── Hash-based routing helpers ─────────────────────────────
function getViewFromHash() {
  const hash = window.location.hash.replace('#', '');
  const valid = ['dashboard', 'impact', 'replay', 'catalog', 'metrics', 'explorer'];
  return valid.includes(hash) ? hash : null;
}

function setHash(view) {
  window.location.hash = view;
}

export default function App() {
  // Read initial view from URL hash, default to 'dashboard'
  const initialView = getViewFromHash() || 'dashboard';
  // If we came from a hash, skip landing; otherwise show it
  const hasHashOnLoad = useRef(!!window.location.hash);

  const [showLanding, setShowLanding] = useState(!hasHashOnLoad.current);
  const [view, setView] = useState(initialView);
  const [activeTab, setActiveTab] = useState(initialView);
  const [replayEvent, setReplayEvent] = useState(null);
  const [time, setTime] = useState(new Date());
  const [initDone, setInitDone] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  // Watch flare class for automatic push notifications
  useNotificationWatcher();

  useEffect(() => {
    if (!initDone) {
      initWebSocketConnection();
      // Request push notification permission after a short delay
      setTimeout(() => requestNotificationPermission(), 3000);
      setInitDone(true);
    }
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, [initDone]);

  // Sync hash whenever view changes
  useEffect(() => {
    if (!showLanding) {
      setHash(view);
    }
  }, [view, showLanding]);

  // Listen for popstate (browser back/forward) to sync view
  useEffect(() => {
    const onHashChange = () => {
      const v = getViewFromHash();
      if (v && v !== activeTab) {
        setActiveTab(v);
        setView(v);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [activeTab]);

  const handleView = useCallback((v) => {
    if (v === activeTab) return;
    setActiveTab(v);
    setHash(v);  // update URL hash immediately
    setTransitioning(true);
    setTimeout(() => {
      setView(v);
      setTimeout(() => setTransitioning(false), 50);
    }, 180);
  }, [activeTab]);

