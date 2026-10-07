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
