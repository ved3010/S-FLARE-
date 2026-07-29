import { useState, useEffect, useRef, useCallback } from 'react';
import { useLiveState } from '../lib/data';

const DIRECTION_STYLES = {
  positive:     { bar: '#F87171', text: '#F87171', label: 'DRIVING', bg: 'rgba(248,113,113,0.08)' },
  critical:     { bar: '#EF4444', text: '#EF4444', label: 'CRITICAL', bg: 'rgba(239,68,68,0.10)' },
  warning:      { bar: '#FBBF24', text: '#FBBF24', label: 'ELEVATED', bg: 'rgba(251,191,36,0.08)' },
  slight_positive: { bar: '#FB923C', text: '#FB923C', label: 'SUBTLE', bg: 'rgba(251,146,60,0.06)' },
  elevated:     { bar: '#FB923C', text: '#FB923C', label: 'ELEVATED', bg: 'rgba(251,146,60,0.08)' },
  stable:       { bar: '#34D399', text: '#34D399', label: 'STABLE', bg: 'rgba(52,211,153,0.06)' },
  baseline:     { bar: '#8B949E', text: '#8B949E', label: 'BASELINE', bg: 'rgba(139,148,158,0.06)' },
  neutral:      { bar: '#8B949E', text: '#8B949E', label: 'NEUTRAL', bg: 'rgba(139,148,158,0.06)' },
};

function FeatureBar({ name, value, importance, direction, description }) {
  const dir = DIRECTION_STYLES[direction] || DIRECTION_STYLES.stable;
  const barWidth = Math.max(4, importance * 100);

  return (
    <div className="group relative">
      <div className="flex items-center gap-3 mb-1">
        {/* Feature name */}
        <span className="text-[9px] font-mono text-white/60 flex-1 min-w-0 truncate">{name}</span>
        {/* Direction badge */}
        <span className="text-[6px] font-mono font-bold px-1 py-0.5 rounded tracking-wider uppercase flex-shrink-0"
          style={{ background: dir.bg, color: dir.text }}
        >
          {dir.label}
        </span>
        {/* Importance pct */}
        <span className="text-[8px] font-mono text-white/30 w-8 text-right flex-shrink-0">
          {(importance * 100).toFixed(0)}%
        </span>
      </div>
      {/* Bar */}
      <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${barWidth}%`,
            background: dir.bar,
            boxShadow: `0 0 6px ${dir.bar}`,
          }}
        />
      </div>
      {/* Tooltip description */}
      <div className="absolute left-0 -bottom-2 translate-y-full w-64 p-2 rounded-lg glass pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20" style={{ backdropFilter: 'blur(16px)' }}>
        <p className="text-[8px] font-mono text-white/60 leading-relaxed">{description}</p>
        <div className="mt-1 text-[7px] font-mono text-white/25">Value: {value.toExponential(2)}</div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4 p-2">
      <div className="flex gap-2 items-center mb-4">
        <div className="h-6 w-20 bg-white/[0.06] rounded animate-pulse" />
        <div className="h-6 w-24 bg-white/[0.06] rounded-full animate-pulse" />
      </div>
      {[1,2,3,4,5].map(i => (
        <div key={i} className="space-y-2">
          <div className="flex gap-2 items-center">
            <div className="h-3 flex-1 bg-white/[0.04] rounded animate-pulse" />
            <div className="h-3 w-14 bg-white/[0.04] rounded animate-pulse" />
          </div>
          <div className="h-2 bg-white/[0.03] rounded-full animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export default function ModelExplanation() {
  const { flareClass } = useLiveState();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const lastFetched = useRef(null);

