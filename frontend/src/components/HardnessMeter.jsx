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
