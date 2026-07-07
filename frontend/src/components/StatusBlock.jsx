import { useLiveState } from '../lib/data';

export default function StatusBlock() {
  const { nowcast, forecast, forecast1Min, forecast2Min, systemStatus } = useLiveState();
  
  const phase = nowcast.currentPhase || 'Quiet Sun';
  const isWatch = phase.includes('Warning') || phase.includes('Elevated');
  const isFlare = phase.includes('Onset') || phase.includes('Peak') || phase.includes('Decay') || (nowcast.class && nowcast.class !== '—');
  
  let stateColor = '#34D399';
  let stateGlow = 'rgba(52,211,153,0.15)';
  if (isFlare) { stateColor = '#F87171'; stateGlow = 'rgba(248,113,113,0.25)'; }
  else if (isWatch) { stateColor = '#FBBF24'; stateGlow = 'rgba(251,191,36,0.2)'; }

  // 1-min & 2-min values with robust fallbacks
  const f1 = forecast1Min || forecast?.forecast1Min || { horizonMinutes: 1, probability: forecast?.probability || 14, status: 'NORMAL', statusColor: '#2ECC71', targetTime: '—', confidence: 0.94 };
  const f2 = forecast2Min || forecast?.forecast2Min || { horizonMinutes: 2, probability: Math.min(99, (forecast?.probability || 14) + 4), status: 'NORMAL', statusColor: '#2ECC71', targetTime: '—', confidence: 0.90 };

  return (
    <div className="h-full flex flex-col" style={{ boxShadow: `0 4px 24px ${stateGlow}` }}>
      {/* Header */}
      <div className="dash-card-header">
        <div className="dash-card-header-left">
          <div className="dash-card-bar" style={{ background: stateColor }} />
          <span className="dash-card-title">Mission Status & Multi-Horizon AI</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: stateColor }} />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: stateColor, boxShadow: `0 0 12px ${stateGlow}` }} />
          </span>
          <span className="text-[10px] font-bold uppercase font-mono tracking-wide" style={{ color: stateColor }}>{phase}</span>
        </div>
      </div>

      {/* Body */}
      <div className="dash-card-body flex-1 flex flex-col gap-3 overflow-y-auto">
        
        {/* 1. NOWCASTING CARD */}
        <div className="glass rounded-xl p-3.5 relative overflow-hidden hover-float">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 opacity-60" />
          <div className="text-[9px] uppercase tracking-widest font-bold font-mono text-white/40 mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span>Nowcast Engine</span>
              <span className="ai-badge text-[7px]">REAL-TIME</span>
            </div>
            <span className="text-[9px] font-mono text-emerald-400">0m Horizon</span>
          </div>
          <div className="flex items-baseline justify-between flex-wrap gap-1">
            <span className="text-2xl font-black font-mono tracking-tighter" style={{ color: stateColor, textShadow: `0 0 16px ${stateGlow}` }}>
              {nowcast.class && nowcast.class !== '—' ? nowcast.class : 'QUIET SUN'}
            </span>
            {isFlare ? (
              <span className="text-[8px] uppercase font-bold font-mono text-red-400 animate-pulse px-2 py-0.5 bg-red-500/10 rounded-full border border-red-500/20">
                FLARE IN PROGRESS
              </span>
            ) : (
              <span className="text-[8px] uppercase font-bold font-mono text-emerald-400 px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                🟢 NORMAL
              </span>
            )}
          </div>
          <div className="mt-2 space-y-1.5 border-t border-white/[0.06] pt-2 font-mono text-[9.5px] text-white/50">
            <div className="flex justify-between"><span>PEAK FLUX:</span><span className="text-white/80 font-semibold">{nowcast.peakFlux.toExponential(1)} <span className="text-white/30 text-[8px]">W/m²</span></span></div>
            <div className="flex justify-between"><span>SPECTRAL Z-SCORE:</span><span className={`font-bold ${isWatch || isFlare ? 'text-amber-400' : 'text-white/70'}`}>{nowcast.zScore.toFixed(1)}σ</span></div>
          </div>
        </div>

        {/* 2. 1-MINUTE FORECAST CARD */}
        <div className="glass rounded-xl p-3.5 hover-float relative overflow-hidden border border-amber-500/20 bg-amber-500/[0.02]">
          <div className="text-[9px] uppercase tracking-widest font-bold font-mono text-amber-400 mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span>⚡ 1-Minute Forecast</span>
              <span className="ai-badge text-[7px] bg-amber-500/20 text-amber-300">T+60s</span>
            </div>
