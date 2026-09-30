import { useState, useEffect, useRef, useCallback } from 'react';
import IndiaImpactMap from './IndiaImpactMap';
import ModelExplanation from './ModelExplanation';
import { useLiveState } from '../lib/data';

// ─── Inline SVG Icons ───────────────────────────────────

function IconNavigation() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 9v-1M12 16v1M9 12H8M16 12h1" />
    </svg>
  );
}

function IconComms() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20V10" />
      <path d="M18 20V4" />
      <path d="M6 20v-4" />
      <path d="M12 10c0-3.5 3-6 6-6" />
      <path d="M12 10c0-2 1.5-4 3.5-4" />
      <circle cx="12" cy="7" r="1" fill="currentColor" />
    </svg>
  );
}

function IconDefence() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

function IconWeather() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      <path d="M12 8a4 4 0 0 0 0 8" fill="currentColor" opacity="0.15" />
    </svg>
  );
}

function IconPower() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function IconCrewedSpace() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="12" rx="10" ry="4" />
      <path d="M12 2a4 10 0 0 1 0 20 4 10 0 0 1 0-20" />
      <rect x="4" y="10" width="16" height="4" rx="1" opacity="0.2" fill="currentColor" />
      <circle cx="8" cy="12" r="0.5" fill="currentColor" />
      <circle cx="16" cy="12" r="0.5" fill="currentColor" />
    </svg>
  );
}

function IconScience() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v4M12 19v4" />
      <path d="M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83" />
      <path d="M1 12h4M19 12h4" />
      <path d="M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </svg>
  );
}

const CATEGORY_ICONS = {
  'Navigation & Positioning': IconNavigation,
  'Communications': IconComms,
  'Defence & Intelligence': IconDefence,
  'Weather & Earth Observation': IconWeather,
  'Power Grid & Ground Infrastructure': IconPower,
  'Space Station & Crewed Missions': IconCrewedSpace,
  'Scientific Instruments': IconScience,
};

const RISK_COLORS = {
  low:      { bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.25)', text: '#34D399', label: 'LOW' },
  moderate: { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.25)', text: '#FBBF24', label: 'MODERATE' },
  high:     { bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.25)', text: '#FB923C', label: 'HIGH' },
  critical: { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)', text: '#F87171', label: 'CRITICAL' },
};

// ─── Skeleton Card ──────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="impact-card impact-skeleton">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-white/[0.06] animate-pulse" />
        <div className="flex-1">
          <div className="h-3 w-32 bg-white/[0.06] rounded animate-pulse mb-2" />
          <div className="h-2 w-16 bg-white/[0.06] rounded animate-pulse" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-2 w-full bg-white/[0.06] rounded animate-pulse" />
        <div className="h-2 w-4/5 bg-white/[0.06] rounded animate-pulse" />
        <div className="h-2 w-3/5 bg-white/[0.06] rounded animate-pulse" />
      </div>
      <div className="flex gap-2 mt-4">
        <div className="h-5 w-14 bg-white/[0.06] rounded-full animate-pulse" />
        <div className="h-5 w-18 bg-white/[0.06] rounded-full animate-pulse" />
        <div className="h-5 w-12 bg-white/[0.06] rounded-full animate-pulse" />
      </div>
    </div>
  );
}

// ─── Mission Status Row ─────────────────────────────────

function AdityaMissionStatus({ systemStatus }) {
  const statusItems = [
    { label: 'Pipeline', value: systemStatus.pipeline || '—', ok: systemStatus.pipeline === 'Operational' },
    { label: 'PRADAN Sync', value: systemStatus.pradanSync || '—', ok: systemStatus.pradanSync === 'Healthy' },
    { label: 'AL1 Sync', value: systemStatus.al1Sync || '—', ok: systemStatus.al1Sync === 'Healthy' },
    { label: 'Data Latency', value: systemStatus.dataLatency || '—', ok: true },
    { label: 'Model', value: systemStatus.modelVersion || '—', ok: true },
  ];

  return (
    <div className="tcn-status-grid">
      {statusItems.map((item) => (
        <div key={item.label} className="tcn-status-item">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${item.ok ? 'bg-emerald-400' : 'bg-red-400'}`} style={item.ok ? { boxShadow: '0 0 6px rgba(52,211,153,0.5)' } : { boxShadow: '0 0 6px rgba(248,113,113,0.5)' }} />
            <span className="text-[7px] font-mono font-bold text-white/35 uppercase tracking-wider">{item.label}</span>
          </div>
          <span className="text-[10px] font-mono font-semibold text-white/80">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── TCN Forecast Status Card ───────────────────────────

function TcnForecastCard({ forecast, flareClass, systemStatus }) {
  const prob = forecast.probability ?? 0;
  const nextClass = forecast.nextClass || '—';
  const leadTime = forecast.leadTime ?? 0;
  const tcnConf = forecast.tcnConfidence ?? 0;

  const probColor = prob >= 70 ? '#F87171' : prob >= 40 ? '#FBBF24' : '#34D399';
  const confColor = tcnConf >= 0.7 ? '#34D399' : tcnConf >= 0.4 ? '#FBBF24' : '#F87171';
  const stateColor = systemStatus.stateColor || '#2ECC71';

  return (
    <div className="dash-card animate-fadeInUp h-full">
      <div className="dash-card-header">
        <div className="dash-card-header-left">
          <div className="dash-card-bar" style={{ background: 'linear-gradient(180deg, #A78BFA, #38BDF8)' }} />
          <span className="dash-card-title">TCN Forecast Model</span>
          <span className="dash-card-sub">Temporal Convolution Network</span>
        </div>
      </div>
      <div className="dash-card-body" style={{ padding: '14px 18px 18px' }}>
        {/* Main forecast row */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-[21px] font-mono font-black" style={{ color: probColor }}>{prob}%</span>
            <span className="text-[9px] font-mono text-white/30 ml-2">probability</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono font-bold text-white/70">{nextClass}</span>
            <span className="text-[7px] font-mono text-white/25 block">next expected</span>
          </div>
        </div>

        {/* Probability bar */}
        <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden mb-4">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${Math.max(2, prob)}%`,
              background: `linear-gradient(90deg, ${probColor}88, ${probColor})`,
              boxShadow: `0 0 8px ${probColor}44`,
            }}
          />
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="bg-white/[0.02] rounded-lg p-2.5 border border-white/[0.03]">
            <span className="text-[7px] font-mono font-bold text-white/30 uppercase tracking-wider block">Lead Time</span>
            <span className="text-[12px] font-mono font-bold text-white/80">{leadTime > 0 ? `+${leadTime}` : '—'} min</span>
          </div>
          <div className="bg-white/[0.02] rounded-lg p-2.5 border border-white/[0.03]">
            <span className="text-[7px] font-mono font-bold text-white/30 uppercase tracking-wider block">TCN Conf.</span>
            <span className="text-[12px] font-mono font-bold" style={{ color: confColor }}>{(tcnConf * 100).toFixed(0)}%</span>
          </div>
          <div className="bg-white/[0.02] rounded-lg p-2.5 border border-white/[0.03]">
            <span className="text-[7px] font-mono font-bold text-white/30 uppercase tracking-wider block">Flare Class</span>
            <span className="text-[12px] font-mono font-bold" style={{ color: stateColor }}>{flareClass || '—'}</span>
          </div>
        </div>

        {/* Architecture note */}
        <div className="flex items-center gap-1.5 text-[7px] font-mono text-white/20 pt-2 border-t border-white/[0.04]">
          <span>TCN · 3 dilated causal conv layers · 3h context window · NOAA/Aditya-L1 transfer learning</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────

export default function ImpactPanel() {
  const { flareClass, systemStatus, nowcast, forecast } = useLiveState();
  const [impactData, setImpactData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastAssessed, setLastAssessed] = useState(null);
  const [stale, setStale] = useState(false);
  const lastFetchedClass = useRef(null);
  const staleTimer = useRef(null);

  const fetchImpact = useCallback(async (fc) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/impact?flare_class=${encodeURIComponent(fc)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setImpactData(data);
      setLastAssessed(new Date());
      setStale(false);
      lastFetchedClass.current = fc;

      if (staleTimer.current) clearTimeout(staleTimer.current);
      staleTimer.current = setTimeout(() => setStale(true), 60000);
    } catch (err) {
      setError(err.message || 'Failed to fetch impact data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (flareClass && flareClass !== lastFetchedClass.current) {
      fetchImpact(flareClass);
    } else if (flareClass === lastFetchedClass.current) {
      setLastAssessed(new Date());
      setStale(false);
      if (staleTimer.current) clearTimeout(staleTimer.current);
      staleTimer.current = setTimeout(() => setStale(true), 60000);
    }
  }, [flareClass, fetchImpact]);

  useEffect(() => {
    return () => {
      if (staleTimer.current) clearTimeout(staleTimer.current);
    };
  }, []);

  // ─── Error State ────
  if (error && !impactData) {
    return (
      <div className="dashboard-layout">
        <div className="dash-section-head">
          <span className="dash-section-tag">Impact</span>
          <h2 className="dash-section-title">Infrastructure Impact Assessment</h2>
        </div>
        <div className="impact-error-card">
          <div className="flex flex-col items-center gap-4 py-8">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <p className="text-white/60 font-mono text-sm text-center">Failed to load impact assessment: {error}</p>
            <button onClick={() => fetchImpact(flareClass || 'B1.0')} className="impact-retry-btn">Retry</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Loading State ────
  if (loading && !impactData) {
    return (
      <div className="dashboard-layout">
        <div className="dash-section-head">
          <span className="dash-section-tag">Impact</span>
          <h2 className="dash-section-title">Infrastructure Impact Assessment</h2>
          <p className="dash-section-desc">Analyzing flare class {flareClass || '...'}</p>
        </div>
        <div className="impact-grid">
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      </div>
    );
  }

  const isNominal = impactData?.nominal;
  const categories = impactData?.categories || [];
  const noaaScale = impactData?.noaaScale || '';

  return (
    <div className="dashboard-layout">
      {/* ── Header ── */}
      <div className="dash-section-head">
        <span className="dash-section-tag">Impact</span>
        <h2 className="dash-section-title">Infrastructure Impact Assessment</h2>
        <p className="dash-section-desc">
          {!isNominal && (
            <span
              className="impact-flare-badge"
              style={{
                background: RISK_COLORS[categories[0]?.risk_level]?.bg || 'rgba(255,255,255,0.05)',
                borderColor: RISK_COLORS[categories[0]?.risk_level]?.border || 'rgba(255,255,255,0.1)',
                color: RISK_COLORS[categories[0]?.risk_level]?.text || '#fff',
              }}
            >
              {flareClass} — {noaaScale}
            </span>
          )}
          {lastAssessed && (
            <span className="text-[10px] font-mono text-white/30 ml-3">
              Last assessed: {lastAssessed.toISOString().replace('T', ' ').slice(0, 19)} UTC
            </span>
          )}
          {stale && <span className="impact-stale-badge ml-2">⚠ DATA MAY BE STALE</span>}
          {error && impactData && (
            <span className="impact-stale-badge ml-2" style={{ color: '#F87171', borderColor: 'rgba(248,113,113,0.3)' }}>
              ⚠ Cached data
            </span>
          )}
        </p>
      </div>

      {/* ── Status Banner ── */}
      {isNominal ? (
        <div className="impact-nominal-banner mb-6">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400" style={{ boxShadow: '0 0 12px rgba(52,211,153,0.6)' }} />
            </span>
            <div>
              <span className="text-emerald-300 font-bold text-sm tracking-wide">ALL SYSTEMS NOMINAL</span>
              <p className="text-emerald-400/40 text-[10px] font-mono mt-0.5">
                Current solar activity ({flareClass}) poses no threat to satellite infrastructure or ground systems.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="impact-nominal-banner !bg-red-500/10 !border-red-500/35 mb-6">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-400" style={{ boxShadow: '0 0 12px rgba(239,68,68,0.6)' }} />
            </span>
            <div>
              <span className="text-red-300 font-bold text-sm tracking-wide uppercase">Active Space Weather Alert</span>
              <p className="text-red-400/40 text-[10px] font-mono mt-0.5">
                Solar activity ({flareClass}) has triggered a NOAA Scale {noaaScale} impact report. Operational mitigation protocols recommended.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── TCN Forecast + Mission Status Row ── */}
      <div className="tcn-mission-row">
        {/* TCN Forecast Card */}
        <div className="tcn-mission-col">
          <TcnForecastCard forecast={forecast} flareClass={flareClass} systemStatus={systemStatus} />
        </div>

        {/* Aditya-L1 Mission Status Card */}
        <div className="tcn-mission-col">
          <div className="dash-card animate-fadeInUp h-full">
            <div className="dash-card-header">
              <div className="dash-card-header-left">
                <div className="dash-card-bar" style={{ background: 'linear-gradient(180deg, #34D399, #38BDF8)' }} />
                <span className="dash-card-title">Aditya-L1 Mission</span>
                <span className="dash-card-sub">PRADAN · SoLEXS · HEL1OS</span>
              </div>
            </div>
            <div className="dash-card-body" style={{ padding: '14px 18px 18px' }}>
              {/* Instrument dashboard */}
              <div className="instrument-grid mb-4">
                <div className="instrument-card">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px rgba(52,211,153,0.5)' }} />
                    <span className="text-[9px] font-mono font-bold text-white/70">SoLEXS</span>
                    <span className="text-[6px] font-mono text-emerald-400/60 ml-auto">ONLINE</span>
                  </div>
                  <span className="text-[8px] font-mono text-white/35">SDD1 + SDD2 · Soft X-ray (0.1-0.8nm)</span>
                  <div className="mt-1.5 text-[8px] font-mono text-white/25">Flux: <span className="text-white/50">{(nowcast.peakFlux || 5e-8).toExponential(2)} W/m²</span></div>
                </div>
                <div className="instrument-card">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px rgba(52,211,153,0.5)' }} />
                    <span className="text-[9px] font-mono font-bold text-white/70">HEL1OS</span>
                    <span className="text-[6px] font-mono text-emerald-400/60 ml-auto">ONLINE</span>
                  </div>
                  <span className="text-[8px] font-mono text-white/35">CdTe + CZT · Hard X-ray (5-150 keV)</span>
                  <div className="mt-1.5 text-[8px] font-mono text-white/25">Hardness: <span className="text-white/50">{(forecast.tcnConfidence || 0.12).toFixed(2)} ratio</span></div>
                </div>
              </div>

              {/* Status row */}
              <AdityaMissionStatus systemStatus={systemStatus} />

              {/* Additional context */}
              <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/[0.04]">
                <span className="text-[7px] font-mono text-white/20">Lagrange Point L1 · halo orbit</span>
                <span className="text-[7px] font-mono text-white/15">{nowcast.currentPhase || 'Quiet Sun'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Category Cards Grid ── */}
      <div className="impact-grid mt-6">
        {categories.map((cat, i) => {
          const risk = RISK_COLORS[cat.risk_level] || RISK_COLORS.low;
          const IconComp = CATEGORY_ICONS[cat.category] || IconScience;
          const isCritical = cat.risk_level === 'critical';

          return (
            <div
              key={cat.category}
              className={`impact-card ${isCritical ? 'impact-card-critical' : ''}`}
              style={{ animationDelay: `${i * 0.06}s`, borderColor: risk.border }}
            >
              {/* Card Header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: risk.bg, color: risk.text }}>
                  <IconComp />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-bold text-white/90 tracking-wide uppercase truncate">{cat.category}</h3>
                  <span
                    className="inline-block mt-1 px-2 py-0.5 rounded-full text-[8px] font-bold font-mono uppercase tracking-wider"
                    style={{ background: risk.bg, color: risk.text, border: `1px solid ${risk.border}` }}
                  >
                    {risk.label} RISK
                  </span>
                </div>
              </div>

              {/* Effect Description */}
              <p className="text-[11px] text-white/50 leading-relaxed mb-3 font-mono">{cat.effect}</p>

              {/* Systems Tags */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {cat.systems.map((sys) => (
                  <span
                    key={sys}
                    className="px-2 py-0.5 rounded-full text-[8px] font-mono font-semibold bg-white/[0.04] text-white/50 border border-white/[0.06]"
                  >
                    {sys}
                  </span>
                ))}
              </div>

              {/* Recovery Time + Score bar */}
              <div className="flex items-center justify-between gap-2 text-[9px] font-mono text-white/35 mb-2 border-t border-white/[0.05] pt-2.5">
                <div className="flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>RECOVERY: <span className="text-white/55 font-semibold">{cat.recovery_time}</span></span>
                </div>
              </div>

              {/* Risk score bar */}
              <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden mb-2">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: cat.risk_level === 'critical' ? '95%' : cat.risk_level === 'high' ? '70%' : cat.risk_level === 'moderate' ? '40%' : '12%',
                    background: `${risk.text}66`,
                    boxShadow: `0 0 6px ${risk.text}44`,
                  }}
                />
              </div>

              {/* Historical Example */}
              <p className="text-[9px] italic text-white/25 leading-relaxed mt-1">📖 {cat.historical_example}</p>
            </div>
          );
        })}
      </div>

      {/* ── India Impact Map + XAI Row ── */}
      <div className="mt-6 dash-card animate-fadeInUp">
        <div className="dash-card-header">
          <div className="dash-card-header-left">
            <div className="dash-card-bar" style={{ background: 'linear-gradient(180deg, #F87171, #FBBF24)' }} />
            <span className="dash-card-title">India Regional Risk Map</span>
            <span className="dash-card-sub">GPS & Power Grid</span>
          </div>
        </div>
        <div className="dash-card-body" style={{ padding: '12px 16px 16px' }}>
          <IndiaImpactMap />
        </div>
      </div>

      {/* ── XAI Section ── */}
      <div className="mt-6 dash-card animate-fadeInUp">
        <div className="dash-card-header">
          <div className="dash-card-header-left">
            <div className="dash-card-bar" style={{ background: 'linear-gradient(180deg, #A78BFA, #38BDF8)' }} />
            <span className="dash-card-title">Explainable AI</span>
            <span className="dash-card-sub">Model Decision Analysis</span>
          </div>
        </div>
        <div className="dash-card-body" style={{ padding: '16px' }}>
          <ModelExplanation />
        </div>
      </div>
    </div>
  );
}

// ─── Compact Impact Strip for Dashboard ─────────────────

export function ImpactStrip({ onNavigate }) {
  const { flareClass } = useLiveState();
  const [impactData, setImpactData] = useState(null);
  const lastFetchedClass = useRef(null);

  useEffect(() => {
    if (!flareClass || flareClass === lastFetchedClass.current) return;
    const letter = flareClass.charAt(0).toUpperCase();
    if (letter === 'A' || letter === 'B') {
      setImpactData(null);
      lastFetchedClass.current = flareClass;
      return;
    }
    fetch(`/api/impact?flare_class=${encodeURIComponent(flareClass)}`)
      .then(r => r.json())
      .then(data => {
        setImpactData(data);
        lastFetchedClass.current = flareClass;
      })
      .catch(() => {});
  }, [flareClass]);

  if (!impactData || impactData.nominal) return null;

  const riskOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
  const top3 = [...(impactData.categories || [])]
    .sort((a, b) => (riskOrder[a.risk_level] ?? 4) - (riskOrder[b.risk_level] ?? 4))
    .slice(0, 3);

  if (top3.length === 0) return null;

  return (
    <div className="impact-strip" onClick={() => onNavigate?.('impact')}>
      <div className="impact-strip-label">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2" strokeLinecap="round">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
        <span>IMPACT</span>
      </div>
      <div className="impact-strip-items">
        {top3.map((cat) => {
          const risk = RISK_COLORS[cat.risk_level] || RISK_COLORS.low;
          return (
            <div key={cat.category} className="impact-strip-item">
              <span className="impact-strip-cat">{cat.category}</span>
              <span className="impact-strip-badge" style={{ background: risk.bg, color: risk.text, borderColor: risk.border }}>
                {risk.label}
              </span>
            </div>
          );
        })}
      </div>
      <span className="impact-strip-arrow">→ VIEW ALL</span>
    </div>
  );
}
