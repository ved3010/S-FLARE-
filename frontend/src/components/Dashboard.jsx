import { useState, useEffect } from 'react';
import FluxChart from './FluxChart';
import StatusBlock from './StatusBlock';
import AlertList from './AlertList';
import HardnessMeter from './HardnessMeter';
import DataSourcePanel from './DataSourcePanel';
import { ImpactStrip } from './ImpactPanel';
import { useLiveState, fmtFlux, fetchActualVsPredicted, fetchShortTermForecast } from '../lib/data';

function HeroCard({ tag, value, sub, color, badge, delay }) {
  return (
    <div className="dash-hero-card" style={{ animationDelay: `${delay}s` }}>
      <span className="dash-hero-tag">{tag}</span>
      <div className="dash-hero-value" style={color ? { color } : {}}>
        {value}
        {badge && <span className="dash-hero-badge">{badge}</span>}
      </div>
      {sub && <span className="dash-hero-sub">{sub}</span>}
    </div>
  );
}

function ActualVsPredictedCard() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchActualVsPredicted().then(data => {
      if (data) setHistory(data);
    });
    const id = setInterval(() => {
      fetchActualVsPredicted().then(data => {
        if (data) setHistory(data);
      });
    }, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="h-full flex flex-col font-mono">
      <div className="dash-card-header">
        <div className="dash-card-header-left">
          <div className="dash-card-bar" style={{ background: '#F59E0B' }} />
          <span className="dash-card-title">Actual vs. Predicted Verification</span>
        </div>
        <span className="text-[8px] font-mono text-emerald-400 font-bold uppercase">LIVE EVALUATION</span>
      </div>

      <div className="dash-card-body flex-1 overflow-y-auto p-2 space-y-2 text-[9.5px]">
        <div className="grid grid-cols-4 gap-1 text-[8px] text-white/40 uppercase font-bold border-b border-white/10 pb-1">
          <span>Time (UTC)</span>
          <span>Actual Flux</span>
          <span>+1m Pred (Err)</span>
          <span>+2m Pred (Err)</span>
        </div>
        {history.slice(0, 5).map((row, idx) => (
          <div key={idx} className="grid grid-cols-4 gap-1 text-[9px] py-1 border-b border-white/[0.04] items-center">
            <span className="text-white/60">{row.timestamp}</span>
            <span className="text-emerald-400 font-bold">{fmtFlux(row.actual_flux)}</span>
            <span className="text-amber-300">
              {fmtFlux(row.predicted_1min_flux)} <span className="text-[7.5px] text-white/40">({row.error_1min_pct}%)</span>
            </span>
            <span className="text-red-400">
              {fmtFlux(row.predicted_2min_flux)} <span className="text-[7.5px] text-white/40">({row.error_2min_pct}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard({ onNavigate }) {
  const [range, setRange] = useState(6);
  const [shortTerm, setShortTerm] = useState(null);
  const { fluxData, alerts, hardnessRatio, nowcast, forecast, forecast1Min, forecast2Min, systemStatus } = useLiveState();

  useEffect(() => {
    const load = () => fetchShortTermForecast().then(setShortTerm);
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);
  const f1 = shortTerm?.forecast?.['1_minute'];
  const f2 = shortTerm?.forecast?.['2_minute'];
  const f1Value = f1 ? fmtFlux(f1.predicted_flux) : `${forecast1Min?.probability || forecast?.forecast1Min?.probability || '—'}%`;
  const f2Value = f2 ? fmtFlux(f2.predicted_flux) : `${forecast2Min?.probability || forecast?.forecast2Min?.probability || '—'}%`;

  const isFlare = nowcast.class !== '—' || nowcast.currentPhase?.includes('Onset') || nowcast.currentPhase?.includes('Peak');
  const stateColor = isFlare ? '#F87171' : hardnessRatio.preFlareSignal ? '#FBBF24' : systemStatus.stateColor || '#34D399';

  return (
    <div className="premium-dash">
      {/* ===== HERO STATS BAR ===== */}
      <div className="dash-hero">
        <HeroCard tag="Solar State" value={systemStatus.stateLabel} color={stateColor} delay={0.02} />
        <HeroCard tag="Nowcast" value={nowcast.class} sub={`Z-Score: ${nowcast.zScore.toFixed(1)}σ`} color={isFlare ? '#F87171' : '#34D399'} delay={0.06} />
        <HeroCard tag="+1 Min Forecast" value={f1Value} sub={f1 ? `${f1.activity} · baseline` : 'Forecast unavailable'} color="#FBBF24" delay={0.10} />
        <HeroCard tag="+2 Min Forecast" value={f2Value} sub={f2 ? `${f2.activity} · baseline` : 'Forecast unavailable'} color="#F87171" delay={0.14} />
        <HeroCard tag="Peak Flux" value={fmtFlux(nowcast.peakFlux)} sub="W/m²" delay={0.18} />
        <HeroCard tag="Hardness Ratio" value={hardnessRatio.current.toFixed(4)} badge={hardnessRatio.preFlareSignal ? `⚠ +${hardnessRatio.minutesEarly}m` : undefined} color={hardnessRatio.preFlareSignal ? '#FBBF24' : ''} delay={0.22} />
