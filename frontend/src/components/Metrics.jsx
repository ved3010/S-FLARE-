import { useState, useEffect } from 'react';
import { useLiveState, fetchModelComparison, selectActiveModel } from '../lib/data';

function MetricCard({ label, value, subtitle, colorClass = 'text-[#D4DCE6]' }) {
  return (
    <div className="dash-card p-4 select-none">
      <div className="dash-card-header-left mb-2">
        <div className="dash-card-bar" style={{ background: colorClass.includes('green') ? '#34D399' : colorClass.includes('red') ? '#F87171' : colorClass.includes('blue') ? '#38BDF8' : '#FBBF24' }} />
        <span className="text-[9px] uppercase tracking-widest font-bold font-mono text-[#8B949E]">{label}</span>
      </div>
      <div className={`text-xl font-bold font-mono ${colorClass}`}>{value}</div>
      {subtitle && <div className="text-[9px] text-[#566176] font-mono mt-1 leading-normal">{subtitle}</div>}
    </div>
  );
}

export default function Metrics() {
  const { modelsComparison, activeModelName } = useLiveState();
  const [models, setModels] = useState([]);
  const [m, setM] = useState(null);
  const [loadingModel, setLoadingModel] = useState(false);

  useEffect(() => {
    // Fetch multi-model comparative results
    fetchModelComparison().then(data => {
      if (data && data.length) setModels(data);
    });

    fetch(`/api/metrics`)
      .then(r => r.json())
      .then(data => {
        setM({
          podM: data.podM,
          farM: data.farM,
          csiM: data.csiM,
          podX: data.podX,
          farX: data.farX,
          csiX: data.csiX,
          lead: data.meanLeadTime,
          tp: data.confusion.tp,
          fn: data.confusion.fn,
          fp: data.confusion.fp,
          tn: data.confusion.tn,
          skill: data.skillScore,
          total: data.totalEvents,
          period: data.testPeriod
        });
      })
      .catch(() => {});
  }, []);

  const handleSelectModel = async (name) => {
    setLoadingModel(true);
    await selectActiveModel(name);
    const updated = await fetchModelComparison();
    if (updated) setModels(updated);
    setLoadingModel(false);
  };

  const displayModels = modelsComparison.length ? modelsComparison : models;

  return (
    <div className="premium-dash select-none space-y-6">
      {/* Header */}
      <div className="dash-section-head">
        <span className="dash-section-tag">Machine Learning & Evaluation</span>
        <h2 className="dash-section-title">Multi-Model Comparative Suite</h2>
        <p className="dash-section-desc">
          Evaluation results appear here only after chronological training on labelled SoLEXS and HEL1OS observations.
        </p>
      </div>

      {/* MULTI-MODEL COMPARISON TABLE */}
      <div className="dash-card p-5">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <div className="dash-card-header-left">
            <div className="dash-card-bar" style={{ background: '#38BDF8' }} />
            <span className="dash-card-title">Model Performance Comparison</span>
          </div>
          <span className="text-[9.5px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
            Active Model: <strong>{activeModelName || 'LSTM (Deep Learning)'}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-[11px]">
            <thead>
              <tr className="border-b border-white/10 text-white/40 text-[9px] uppercase tracking-wider">
                <th className="py-2.5 px-3">Model Name</th>
                <th className="py-2.5 px-3">Horizon</th>
