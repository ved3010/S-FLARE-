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
        <nav className="header-nav" ref={navRef} style={{ position: 'relative' }}>
          {/* Sliding highlight pill */}
          <div
            style={{
              position: 'absolute',
              top: 4,
              bottom: 4,
              left: indicator.left,
              width: indicator.width,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255,255,255,0.1)',
              boxShadow: '0 0 20px rgba(255,255,255,0.05)',
              transition: 'left 0.35s cubic-bezier(0.4, 0, 0.2, 1), width 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
              zIndex: 0,
              pointerEvents: 'none',
            }}
          />
          {NAV_ITEMS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => handleView(key)}
              className={`nav-pill ${view === key ? 'nav-pill-active' : ''}`}
              ref={(el) => { btnRefs.current[key] = el; }}
            >
              <span className="nav-pill-icon">{icon}</span>
              <span className="nav-pill-label">{label}</span>
            </button>
          ))}
        </nav>

        {/* Right: Simulation Controls + Data Source Badge + Clock */}
        <div className="header-right flex items-center gap-3">
          {/* Simulation Play/Pause & Speed Controls */}
          <div className="hidden lg:flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-lg px-2 py-1 font-mono text-[10px]">
            <button
              onClick={handleToggleSim}
              className={`px-2 py-0.5 rounded font-bold transition-all ${isPaused ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}
              title={isPaused ? 'Resume Simulation' : 'Pause Simulation'}
            >
              {isPaused ? '▶ RESUME' : '⏸ PAUSE'}
            </button>
            <span className="text-white/30 text-[9px]">SPEED:</span>
            <select
              value={simSpeed}
              onChange={handleSpeedChange}
              className="bg-transparent text-white font-mono text-[10px] focus:outline-none cursor-pointer"
            >
              <option value="1.0" className="bg-slate-900 text-white">1x</option>
              <option value="2.0" className="bg-slate-900 text-white">2x</option>
              <option value="5.0" className="bg-slate-900 text-white">5x</option>
              <option value="10.0" className="bg-slate-900 text-white">10x</option>
            </select>
          </div>

          <div className="header-status">
            <span className={`status-beacon ${isOnline ? 'beacon-online' : 'beacon-offline'}`}></span>
            <span className="status-label">{isOnline ? 'LIVE' : 'OFFLINE'}</span>
          </div>
          <div className="header-divider"></div>
          <div className="header-clock font-mono">
            {time.toISOString().replace('T', ' ').slice(0, 19)} UTC
          </div>

          {/* Mobile Hamburger */}
          <button
