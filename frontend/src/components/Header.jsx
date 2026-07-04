import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { useLiveState, controlSimulation } from '../lib/data';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: '◉' },
  { key: 'impact', label: 'Impact', icon: '✦' },
  { key: 'replay', label: 'Replay', icon: '▶' },
  { key: 'catalog', label: 'Catalog', icon: '☰' },
  { key: 'metrics', label: 'Metrics', icon: '◈' },
  { key: 'explorer', label: 'Data Explorer', icon: '🗂️' },
];

export default function Header({ view, onView, time, onLogoClick }) {
  const { systemStatus } = useLiveState();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1.0);
  const [isPaused, setIsPaused] = useState(false);

  const isOnline = systemStatus.pipeline !== 'Disconnected (Offline)';

  // Sliding indicator
  const navRef = useRef(null);
  const btnRefs = useRef({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    const navEl = navRef.current;
    const btnEl = btnRefs.current[view];
    if (!navEl || !btnEl) return;
    const navRect = navEl.getBoundingClientRect();
    const btnRect = btnEl.getBoundingClientRect();
    setIndicator({
      left: btnRect.left - navRect.left,
      width: btnRect.width,
    });
  }, [view]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [view, updateIndicator]);

  useEffect(() => {
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);

  const handleView = (v) => {
    onView(v);
    setMobileMenuOpen(false);
  };

  const handleToggleSim = async () => {
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);
    await controlSimulation(nextPaused ? 'pause' : 'resume', simSpeed);
  };

  const handleSpeedChange = async (e) => {
    const spd = parseFloat(e.target.value);
    setSimSpeed(spd);
    await controlSimulation(isPaused ? 'pause' : 'resume', spd);
  };

  return (
    <header className="app-header">
      <div className="header-inner">
        {/* Left: Branding */}
        <div className="header-brand" onClick={onLogoClick} style={{ cursor: 'pointer', userSelect: 'none' }}>
          <div className="brand-text">
            <span className="brand-name">SOLAR FLARE FORECASTING</span>
            <span className="brand-sub font-mono text-[9px] text-orange-400">Aditya-L1 SoLEXS+HEL1OS</span>
          </div>
        </div>

        {/* Center: Navigation with sliding indicator */}
