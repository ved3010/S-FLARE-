import { useMemo, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatUTC } from '../lib/data';

export default function FluxChart({ data, range, onRange }) {
  const [fullscreen, setFullscreen] = useState(false);
  const [hover, setHover] = useState(null);
  const [dimensions, setDimensions] = useState({ w: 700, h: 200 });
  const [fsDims, setFsDims] = useState({ w: 1200, h: 500 });

  // Normal card responsive sizing
  const containerRef = useCallback((node) => {
    if (!node) return;
    const w = Math.max(400, node.clientWidth - 24);
    setDimensions({ w, h: Math.round(200 * (w / 700)) });
  }, []);

  // Fullscreen responsive sizing
  const fsContainerRef = useCallback((node) => {
    if (!node) return;
    const w = Math.max(700, node.clientWidth - 40);
    setFsDims({ w, h: Math.round(500 * (w / 1200)) });
  }, []);

  // Escape key + body scroll lock
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [fullscreen]);

  const toggleFs = () => setFullscreen(p => !p);
  const isFs = fullscreen;

  // Active dimensions based on mode
  const active = isFs ? fsDims : dimensions;
  const cw = active.w;
  const ch = active.h;
  const pad = isFs
    ? { t: 32, r: 100, b: 55, l: 100 }
    : { t: 16, r: 50, b: 30, l: 50 };

  const filtered = useMemo(() => {
    const now = Date.now();
    return data.filter(d => d.timestamp >= now - range * 3600 * 1000);
  }, [data, range]);

  const scales = useMemo(() => {
    if (!filtered.length) return null;
    const t0 = filtered[0].timestamp, t1 = filtered[filtered.length - 1].timestamp;
    const fMin = 1e-10, fMax = 1e-3;
    const xScale = t => pad.l + ((t - t0) / Math.max(1, t1 - t0)) * (cw - pad.l - pad.r);
    const yScale = v => pad.t + ch - pad.t - pad.b - ((Math.log10(Math.max(1e-10, v)) - Math.log10(fMin)) / (Math.log10(fMax) - Math.log10(fMin))) * (ch - pad.t - pad.b);
    return { x: xScale, y: yScale, t0, t1 };
  }, [filtered, cw, ch, pad]);

  const handleMouseMove = useCallback((e, scalesVal) => {
    const r = e.currentTarget.getBoundingClientRect();
    const sx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    setHover({ x: pad.l + sx * (cw - pad.l - pad.r), t: scalesVal.t0 + sx * (scalesVal.t1 - scalesVal.t0) });
  }, [cw, pad]);

  const closestPoint = useMemo(() => {
    if (!hover || !filtered.length || !scales) return null;
    let closest = filtered[0];
    let minDiff = Math.abs(filtered[0].timestamp - hover.t);
    for (const p of filtered) {
      const diff = Math.abs(p.timestamp - hover.t);
      if (diff < minDiff) { minDiff = diff; closest = p; }
    }
    return closest;
  }, [hover, filtered, scales]);

  // ── Shared SVG content ──────────────────────────────────────────

  const renderChartSvg = () => {
    if (!scales || !filtered.length) return null;

    const tiers = [
      { y: scales.y(1e-8), label: 'A', color: '#484F58' },
      { y: scales.y(1e-7), label: 'B', color: '#484F58' },
      { y: scales.y(1e-6), label: 'C', color: '#484F58' },
      { y: scales.y(1e-5), label: 'M', color: '#D29922' },
      { y: scales.y(1e-4), label: 'X', color: '#F85149' },
    ];

    const firstX = scales.x(filtered[0].timestamp);
    const lastX = scales.x(filtered[filtered.length - 1].timestamp);

    const softLine = filtered.map((d, i) => `${i === 0 ? 'M' : 'L'}${scales.x(d.timestamp)},${scales.y(d.softFlux)}`).join(' ');
    const hardLine = filtered.map((d, i) => `${i === 0 ? 'M' : 'L'}${scales.x(d.timestamp)},${scales.y(d.hardFlux)}`).join(' ');
    const softArea = `${softLine} L${lastX},${ch - pad.b} L${firstX},${ch - pad.b} Z`;
    const hardArea = `${hardLine} L${lastX},${ch - pad.b} L${firstX},${ch - pad.b} Z`;

    const nTicks = isFs ? 10 : (cw < 500 ? 4 : 6);
    const xtickVals = Array.from({ length: nTicks + 1 }, (_, i) => {
      const t = scales.t0 + (i / nTicks) * (scales.t1 - scales.t0);
      return {
        x: scales.x(t),
        label: new Date(t).toISOString().slice(11, 16) +
          (isFs ? `:${String(new Date(t).getUTCSeconds()).padStart(2, '0')}` : '')
      };
    });

    const yLabels = [1e-8, 1e-7, 1e-6, 1e-5, 1e-4];
    const yLabelTexts = ['10⁻⁸', '10⁻⁷', '10⁻⁶', '10⁻⁵', '10⁻⁴'];

    const getGoesClass = (flux) => {
      if (flux >= 1e-4) return `X${(flux * 1e4).toFixed(1)}`;
      if (flux >= 1e-5) return `M${(flux * 1e5).toFixed(1)}`;
      if (flux >= 1e-6) return `C${(flux * 1e6).toFixed(1)}`;
      if (flux >= 1e-7) return `B${(flux * 1e7).toFixed(1)}`;
      return `A${(flux * 1e8).toFixed(1)}`;
    };

    return (
      <svg viewBox={`0 0 ${cw} ${ch}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={`softGrad${isFs ? 'Fs' : ''}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E67E22" stopOpacity={isFs ? 0.25 : 0.2} />
            <stop offset="100%" stopColor="#E67E22" stopOpacity={0.01} />
          </linearGradient>
          <linearGradient id={`hardGrad${isFs ? 'Fs' : ''}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3498DB" stopOpacity={isFs ? 0.2 : 0.15} />
            <stop offset="100%" stopColor="#3498DB" stopOpacity={0.01} />
          </linearGradient>
          <filter id={`softGlow${isFs ? 'Fs' : ''}`}>
            <feDropShadow dx="0" dy="1" stdDeviation={isFs ? 3 : 2} floodColor="#E67E22" floodOpacity={isFs ? 0.5 : 0.4} />
          </filter>
          <filter id={`hardGlow${isFs ? 'Fs' : ''}`}>
            <feDropShadow dx="0" dy="1" stdDeviation={isFs ? 2.5 : 1.5} floodColor="#3498DB" floodOpacity={isFs ? 0.4 : 0.3} />
          </filter>
        </defs>

        {/* Hazard zone backdrops */}
        {(() => {
          const mY = scales.y(1e-5);
          const xY = scales.y(1e-4);
          return (
            <>
              <rect x={pad.l} y={xY} width={cw - pad.l - pad.r} height={mY - xY} fill="rgba(210,153,34,0.025)" rx="2" />
              <rect x={pad.l} y={0} width={cw - pad.l - pad.r} height={xY} fill="rgba(248,81,73,0.03)" rx="2" />
            </>
          );
        })()}

        {/* Horizontal grid */}
        {yLabels.map((val, i) => (
          <line key={`h-${i}`} x1={pad.l} y1={scales.y(val)} x2={cw - pad.r} y2={scales.y(val)}
            stroke="rgba(255,255,255,0.06)" strokeWidth={isFs ? 0.7 : 0.5} strokeDasharray="3,4" />
        ))}

        {/* Threshold labels */}
        {tiers.map(t => (
          <g key={t.label}>
            <line x1={pad.l} y1={t.y} x2={cw - pad.r} y2={t.y}
              stroke={t.color} strokeWidth={t.label === 'M' || t.label === 'X' ? (isFs ? 1 : 0.7) : 0.3}
              opacity={t.label === 'M' || t.label === 'X' ? 0.5 : 0.15}
              strokeDasharray={t.label === 'M' || t.label === 'X' ? 'none' : '2,4'}
