import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { formatUTC } from '../lib/data';

export default function HardnessMeter({ data, fluxData }) {
  const [hover, setHover] = useState(null);
  const [dimensions, setDimensions] = useState({ w: 300, h: 180 });
  const containerRef = useRef(null);
  
  const cw = dimensions.w, ch = dimensions.h;
  const pad = { t: 16, r: 35, b: 24, l: 35 };

  // Robust ResizeObserver for layout-independent responsiveness
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          w: Math.max(150, width),
          h: Math.max(100, height)
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const chartData = useMemo(() => {
    if (!fluxData || fluxData.length === 0) return [];
    const twoHoursAgo = Date.now() - 2 * 3600 * 1000;
    return fluxData.filter(d => d.timestamp >= twoHoursAgo);
  }, [fluxData]);

  const scales = useMemo(() => {
    if (!chartData.length) return null;
    const t0 = chartData[0].timestamp, t1 = chartData[chartData.length - 1].timestamp;
    const rMin = 0, rMax = 0.15;
    const thr = 0.06;
    const thrY = pad.t + ch - pad.t - pad.b - ((thr - rMin) / (rMax - rMin)) * (ch - pad.t - pad.b);
    return {
      x: t => pad.l + ((t - t0) / Math.max(1, t1 - t0)) * (cw - pad.l - pad.r),
      y: r => pad.t + ch - pad.t - pad.b - ((r - rMin) / (rMax - rMin)) * (ch - pad.t - pad.b),
      thrY, thr, t0, t1
    };
  }, [chartData, cw, ch]);

  const handleMouseMove = useCallback((e, scalesVal) => {
    if (!containerRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHover({ x: pad.l + sx * (cw - pad.l - pad.r), t: scalesVal.t0 + sx * (scalesVal.t1 - scalesVal.t0) });
  }, [cw]);

  const closestPoint = useMemo(() => {
    if (!hover || !chartData.length || !scales) return null;
    let closest = chartData[0];
    let minDiff = Math.abs(chartData[0].timestamp - hover.t);
    for (const p of chartData) {
      const diff = Math.abs(p.timestamp - hover.t);
      if (diff < minDiff) { minDiff = diff; closest = p; }
    }
    return closest;
  }, [hover, chartData, scales]);

  // Determine colors based on hardness ratio levels
  const currentVal = data.current;
  const isDanger = currentVal > 0.06;
  const isWarning = currentVal >= 0.05 && currentVal <= 0.06;
  
  let stateColor = '#34D399'; // Safe (Green)
  let stateGlow = 'rgba(52,211,153,0.1)';
  if (isDanger) {
    stateColor = '#F87171'; // Danger (Red)
    stateGlow = 'rgba(248,113,113,0.25)';
  } else if (isWarning) {
    stateColor = '#FBBF24'; // Warning (Amber)
    stateGlow = 'rgba(251,191,36,0.18)';
  }

  // Circular gauge math (radius = 40, circumference = 251.32)
  const radius = 40;
  const circ = 2 * Math.PI * radius;
  const maxHardness = 0.15;
  const pct = Math.min(1.0, Math.max(0.0, currentVal / maxHardness));
  const strokeOffset = circ * (1 - pct);

  // Position of the 0.06 Threshold Tick on the circular dial (40% of 360 deg = 144 deg. Top is -90 deg, so 54 deg)
  const thrAngleRad = (54 * Math.PI) / 180;
  const thrTickX = 50 + radius * Math.cos(thrAngleRad);
  const thrTickY = 50 + radius * Math.sin(thrAngleRad);

  if (!scales || !chartData.length) {
    return (
      <div className="glass-card h-full flex flex-col justify-center items-center p-6 text-center select-none">
        <div className="w-8 h-8 rounded-full border-2 border-[#30363D] border-t-[#F87171] animate-spin mb-2" />
        <span className="text-[#8B949E] text-xs font-mono">Hardness indicator initializing...</span>
      </div>
    );
  }

  const firstX = scales.x(chartData[0].timestamp);
  const lastX = scales.x(chartData[chartData.length - 1].timestamp);
  const pathLine = chartData.map((d, i) => `${i === 0 ? 'M' : 'L'}${scales.x(d.timestamp)},${scales.y(d.hardnessRatio)}`).join(' ');
  const pathArea = `${pathLine} L${lastX},${ch - pad.b} L${firstX},${ch - pad.b} Z`;

  const nTicks = cw < 400 ? 3 : 4;
  const xtickVals = Array.from({ length: nTicks + 1 }, (_, i) => {
    const t = scales.t0 + (i / nTicks) * (scales.t1 - scales.t0);
    return { x: scales.x(t), label: new Date(t).toISOString().slice(11, 16) };
  });

  return (
    <div className="h-full flex flex-col relative" style={{ overflow: 'hidden' }}>
      {/* ── CARD HEADER ── */}
      <div className="dash-card-header">
        <div className="dash-card-header-left">
          <div className="dash-card-bar" style={{ background: 'linear-gradient(180deg, #F87171, #FBBF24)' }} />
          <span className="dash-card-title">Spectral Hardness</span>
          <span className="dash-card-sub text-white/40">Neupert Pre-flare Warning</span>
        </div>

        {data.preFlareSignal && (
          <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded font-mono font-bold animate-pulse text-[8px]">
            ⚠ {data.minutesEarly}M EARLY ALERT
          </span>
        )}
      </div>

      {/* ── CARD BODY ── */}
      <div className="dash-card-body flex-1 flex flex-col sm:flex-row gap-6 items-center overflow-hidden p-4 sm:p-5 h-full">
        
        {/* 1. Real-time Glassmorphic Gauge */}
        <div className="flex flex-col items-center justify-center flex-shrink-0 w-full sm:w-[130px] h-full relative group">
          <div 
            className="w-24 h-24 rounded-full flex items-center justify-center relative transition-all duration-500" 
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              boxShadow: `0 8px 32px 0 ${stateGlow}, inset 0 1px 1px rgba(255, 255, 255, 0.05)`,
              border: '1px solid rgba(255, 255, 255, 0.04)'
            }}
          >
            {/* Pulsing ring for alerts */}
            {isDanger && (
              <div className="absolute inset-0 rounded-full border border-red-400/30 animate-ping opacity-40" />
            )}

            {/* SVG Ring Gauge */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={stateColor} />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.7" />
                </linearGradient>
              </defs>
              
              {/* Outer track */}
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="4.5" />
              
              {/* Dynamic progress bar */}
              <circle 
                cx="50" cy="50" r="40" 
                fill="none" 
                stroke="url(#gaugeGrad)" 
                strokeWidth="4.5" 
                strokeDasharray={circ}
                strokeDashoffset={strokeOffset}
                transform="rotate(-90 50 50)"
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.25, 0.8, 0.25, 1)' }}
              />

              {/* Threshold indicator tick (0.06) */}
              <circle cx={thrTickX} cy={thrTickY} r="2.2" fill="#FBBF24" style={{ boxShadow: '0 0 8px #FBBF24' }} />
              <text x={thrTickX + 4} y={thrTickY + 2.5} fill="#FBBF24" fontSize="5.5" fontFamily="monospace" fontWeight="bold">0.06</text>
            </svg>

            {/* Central value readouts */}
            <div className="flex flex-col items-center justify-center z-10 text-center font-mono">
              <span className="text-[15px] font-black tracking-tighter" style={{ color: stateColor, textShadow: `0 0 12px ${stateColor}80` }}>
                {currentVal.toFixed(4)}
              </span>
              <span className="text-[7px] text-white/30 uppercase mt-0.5">Ratio</span>
            </div>
          </div>

          {/* Trend readout */}
          <div className="mt-3 text-center font-mono text-[9px]">
            {data.trend === 'rising' && <span className="text-red-400 font-extrabold animate-pulse">▲ RISING</span>}
            {data.trend === 'falling' && <span className="text-emerald-400 font-extrabold">▼ FALLING</span>}
            {data.trend === 'stable' && <span className="text-white/30">■ STABLE</span>}
          </div>
        </div>

        {/* 2. Sparkline Trend Line */}
        <div ref={containerRef} className="flex-1 w-full h-full min-h-[140px] relative overflow-hidden border-l border-white/[0.04] pl-2 sm:pl-4">
          <svg viewBox={`0 0 ${cw} ${ch}`} className="w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stateColor} stopOpacity="0.15" />
                <stop offset="100%" stopColor={stateColor} stopOpacity="0.00" />
              </linearGradient>
              <filter id="hrGlow">
                <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor={stateColor} floodOpacity="0.3" />
              </filter>
            </defs>

            {/* Alert zone background */}
            <rect x={pad.l} y={0} width={cw - pad.l - pad.r} height={scales.thrY} fill="rgba(248,113,113,0.012)" rx="1" />

            {/* Horizontal Gridlines */}
            {[0.03, 0.06, 0.09, 0.12].map(val => (
              <line key={`h-${val}`} x1={pad.l} y1={scales.y(val)} x2={cw - pad.r} y2={scales.y(val)} stroke="rgba(255,255,255,0.03)" strokeWidth={0.5} strokeDasharray="2,3" />
            ))}

            {/* Y-Axis values */}
            {[0.03, 0.06, 0.09, 0.12].map(val => (
              <text key={`yl-${val}`} x={pad.l - 5} y={scales.y(val) + 2} textAnchor="end" fill="#566176" fontSize={6.5} fontFamily="monospace">
                {val.toFixed(2)}
              </text>
            ))}

            {/* Vertical Time Gridlines */}
            {xtickVals.map((t, i) => (
              <line key={`v-${i}`} x1={t.x} y1={pad.t} x2={t.x} y2={ch - pad.b} stroke="rgba(255,255,255,0.02)" strokeWidth={0.5} strokeDasharray="2,3" />
            ))}

            {/* Threshold Line */}
            <line x1={pad.l} y1={scales.thrY} x2={cw - pad.r} y2={scales.thrY} stroke="#FBBF24" strokeWidth={0.8} strokeDasharray="3,3" />
            <text x={cw - pad.r + 3} y={scales.thrY + 2.5} fill="#FBBF24" fontSize={6.5} fontFamily="monospace" fontWeight="bold">THR</text>

            {/* Plot Axes */}
            <line x1={pad.l} y1={pad.t} x2={pad.l} y2={ch - pad.b} stroke="rgba(255,255,255,0.08)" strokeWidth={0.8} />
            <line x1={pad.l} y1={ch - pad.b} x2={cw - pad.r} y2={ch - pad.b} stroke="rgba(255,255,255,0.08)" strokeWidth={0.8} />

            {/* X-Axis Time Ticks */}
            {xtickVals.map((t, i) => (
              <text key={i} x={t.x} y={ch - pad.b + 12} textAnchor="middle" fill="#566176" fontSize={6.5} fontFamily="monospace">{t.label}</text>
            ))}

            {/* Areas & Lines */}
            <path d={pathArea} fill="url(#hrGrad)" />
            <path d={pathLine} fill="none" stroke={stateColor} strokeWidth={1.2} filter="url(#hrGlow)" />

            {/* Hover tooltip pointer */}
            {closestPoint && (
              <g>
                <line x1={scales.x(closestPoint.timestamp)} y1={pad.t} x2={scales.x(closestPoint.timestamp)} y2={ch - pad.b} stroke="rgba(255,255,255,0.12)" strokeWidth={0.5} strokeDasharray="1,2" />
                <circle cx={scales.x(closestPoint.timestamp)} cy={scales.y(closestPoint.hardnessRatio)} r={3} fill={stateColor} stroke="#FFFFFF" strokeWidth={1} />
              </g>
            )}

            {/* Mouse Capture */}
            <rect 
              x={pad.l} y={pad.t} width={cw - pad.l - pad.r} height={ch - pad.t - pad.b}
              fill="transparent"
              onMouseMove={e => handleMouseMove(e, scales)}
              onMouseLeave={() => setHover(null)}
            />
          </svg>

          {/* Hover interactive tooltip box */}
          {closestPoint && (
            <div className="absolute top-1 left-3 bg-[#0D1117]/90 backdrop-blur-md border border-[rgba(255,255,255,0.06)] px-2 py-1 rounded shadow-2xl font-mono text-[8px] space-y-0.5 text-[#8B949E] z-10 select-none pointer-events-none">
              <div className="text-white border-b border-[rgba(255,255,255,0.05)] pb-0.5 mb-0.5 font-bold text-center text-[8.5px]">
                {formatUTC(closestPoint.timestamp)}
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#566176]">HARDNESS:</span>
                <span className="text-white font-bold">{closestPoint.hardnessRatio.toFixed(4)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#566176]">THRESHOLD:</span>
                <span className="text-[#FBBF24] font-semibold">{scales.thr.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
