import { useEffect, useState } from 'react';
import { useLiveState, fetchDataQuality } from '../lib/data';

export default function DataSourcePanel() {
  const { systemStatus } = useLiveState();
  const [quality, setQuality] = useState(null);
  useEffect(() => { fetchDataQuality().then(setQuality); }, []);
  const mode = quality?.mode || systemStatus.dataMode || 'UNKNOWN';
  const isSample = mode === 'SAMPLE';

  return (
    <div className="h-full flex flex-col" style={{ overflow: 'hidden' }}>
      <div className="dash-card-header">
        <div className="dash-card-header-left">
          <div className="dash-card-bar" style={{ background: 'linear-gradient(180deg, #38BDF8, #34D399)' }} />
          <span className="dash-card-title">Instruments</span>
        </div>
        <span className="text-[8px] font-mono text-emerald-400 font-bold uppercase flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px rgba(52,211,153,0.6)' }} />
          {mode}
        </span>
      </div>
      
      <div className="dash-card-body flex-1 overflow-y-auto space-y-2.5 font-mono text-[9px] text-white/50">
        {/* Active Satellite */}
        <div className="glass hover-float rounded-xl p-3">
          <div className="text-[8px] uppercase font-bold text-white mb-1.5 flex items-center gap-1.5">
            <span>●</span> Data source
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-white/80 font-bold text-[10px]">{quality?.source || systemStatus.dataSource || 'Loading source…'}</span>
            <span className="text-white/25 text-[8px]">{mode}</span>
          </div>
          <div className="pl-2 space-y-1 border-l border-white/[0.06] mt-1.5 text-[8px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-[2px] bg-white rounded-full" />
              <span>SoLEXS: Soft X-Ray <span className="text-white/80">(1-30 keV)</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-[2px] bg-sky-400 rounded-full" />
              <span>HEL1OS: Hard X-Ray <span className="text-sky-400">(10-150 keV)</span></span>
            </div>
          </div>
        </div>

        {/* Data Quality Section */}
        <div className="glass hover-float rounded-xl p-3 border border-emerald-500/20 bg-emerald-500/[0.02]">
          <div className="text-[8px] uppercase font-bold text-emerald-400 mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span>📊 Data Quality Index</span>
            </div>
            <span className="text-[7px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">{mode}</span>
          </div>
          <div className="space-y-1 text-[8px]">
            <div className="flex justify-between"><span className="text-white/40">SoLEXS Status:</span><span className="text-emerald-400 font-bold">● {isSample ? 'Sample loaded' : 'Unavailable'}</span></div>
            <div className="flex justify-between"><span className="text-white/40">HEL1OS Status:</span><span className="text-emerald-400 font-bold">● {isSample ? 'Sample loaded' : 'Unavailable'}</span></div>
            <div className="flex justify-between"><span className="text-white/40">Missing Values:</span><span className="text-white/80">{quality?.missing_pct ?? '—'}%</span></div>
            <div className="flex justify-between"><span className="text-white/40">Duplicates:</span><span className="text-white/80">{quality?.duplicate_timestamps ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-white/40">Sampling Cadence:</span><span className="text-sky-400 font-bold">{quality?.sampling_interval_sec ?? '—'} sec</span></div>
          </div>
        </div>

        {/* Neural Architecture */}
        <div className="glass hover-float rounded-xl p-3">
          <div className="text-[8px] uppercase font-bold text-emerald-400 mb-1.5 flex items-center gap-1.5">
            <span>◆</span> Forecast method
          </div>
          <div className="space-y-1 text-[8px]">
            <div className="flex justify-between"><span className="text-white/25">Algorithm:</span><span>5-minute log-linear baseline</span></div>
            <div className="flex justify-between"><span className="text-white/25">Forecasting Horizons:</span><span className="text-amber-400 font-bold">+1m & +2m</span></div>
            <div className="flex justify-between"><span className="text-white/25">Input:</span><span>Dual-band feature trajectory</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
