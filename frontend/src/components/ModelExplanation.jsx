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

  const fetchExplanation = useCallback(async (fc) => {
    if (!fc || fc === lastFetched.current) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/explain?flare_class=${encodeURIComponent(fc)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setData(d);
      lastFetched.current = fc;
    } catch (err) {
      console.error('XAI fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExplanation(flareClass);
  }, [flareClass, fetchExplanation]);

  if (loading && !data) return <Skeleton />;
  if (!data) return <Skeleton />;

  const pred = data.prediction;
  const sortedFeatures = [...data.features].sort((a, b) => b.importance - a.importance);
  const top3 = data.topContributors;

  // Confidence color
  const confColor = pred.confidence > 0.7 ? '#34D399' : pred.confidence > 0.4 ? '#FBBF24' : '#F87171';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Live Feature Analysis Column */}
      <div className="lg:col-span-3 space-y-4">
        {/* Header - Prediction Summary */}
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-wider">Model Decision</span>
            <span className="text-[8px] font-mono font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: confColor, border: `1px solid ${confColor}40` }}>
              {pred.class} · {(pred.confidence * 100).toFixed(0)}% confidence
            </span>
          </div>
          <span className="text-[7px] font-mono text-white/20">{data.flareClass}</span>
        </div>

        {/* Explanation text */}
        <p className="text-[9px] font-mono text-white/40 leading-relaxed mb-4">
          {data.explanation}
        </p>

        {/* Top contributors badges */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {top3.map((name, i) => (
            <span key={i} className="text-[7px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-white/[0.04] text-white/30 border border-white/[0.06]">
              #{i+1} {name.length > 25 ? name.slice(0, 25) + '...' : name}
            </span>
          ))}
        </div>

        {/* Feature importance bars */}
        <div className="space-y-3">
          {sortedFeatures.map((feat, i) => (
            <FeatureBar key={i} {...feat} />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04] mt-3">
          <span className="text-[6px] font-mono text-white/15">Live explanation · Updated on flare class change</span>
          <span className="text-[6px] font-mono text-white/15">SHAP-inspired feature attribution</span>
        </div>
      </div>

      {/* Educational XAI Explanation Card */}
      <div className="lg:col-span-2 bg-white/[0.015] border border-white/[0.04] rounded-xl p-4 space-y-3 flex flex-col justify-between">
        <div>
          <div className="text-[10px] font-mono font-bold text-white/80 border-b border-white/[0.06] pb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] animate-pulse" />
            <span>Explainable AI (XAI)</span>
          </div>
          <p className="text-[9px] font-mono text-white/50 leading-relaxed mt-2">
            Deep learning networks (like our TCN and CNN) are often seen as "black boxes". Explainable AI (XAI) exposes their decision-making logic by calculating the contribution (SHAP score) of each input telemetry feature.
          </p>
        </div>
        <div className="space-y-2 border-t border-white/[0.04] pt-3">
          <div className="space-y-1">
            <span className="text-[8px] font-mono font-bold text-[#A78BFA] block">SPECTRAL HARDNESS:</span>
            <span className="text-[8.5px] font-mono text-white/40 leading-relaxed block">
              Key pre-flare indicator. Flaring coronal loops accelerate electrons, causing hard X-ray counts to spike *before* soft thermal X-rays peak.
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-[8px] font-mono font-bold text-[#A78BFA] block">RISE RATE & Z-SCORE:</span>
            <span className="text-[8.5px] font-mono text-white/40 leading-relaxed block">
              Detects sudden flux jumps. An elevated Z-score indicates statistical anomaly against rolling quiet-sun baseline fluctuations.
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-[8px] font-mono font-bold text-[#A78BFA] block">TCN TEMPORAL CONTEXT:</span>
            <span className="text-[8.5px] font-mono text-white/40 leading-relaxed block">
              Dilated causal convolutions capture multi-scale history over a 3-hour window to project flaring probability.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
