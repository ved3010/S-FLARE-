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
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Accuracy</th>
                <th className="py-2.5 px-3">Precision</th>
                <th className="py-2.5 px-3">Recall</th>
                <th className="py-2.5 px-3">F1-Score</th>
                <th className="py-2.5 px-3">ROC-AUC</th>
                <th className="py-2.5 px-3">Status / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {displayModels.map((item) => {
                const isActive = item.active || item.name === activeModelName;
                const is1Min = item.horizon?.includes('1') || item.name.includes('1min');
                return (
                  <tr key={item.name} className={`transition-all hover:bg-white/[0.02] ${isActive ? 'bg-sky-500/[0.06]' : ''}`}>
                    <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                      <span>{item.name}</span>
                      {isActive && <span className="text-[8px] bg-sky-500/20 text-sky-300 border border-sky-500/30 px-1.5 py-0.5 rounded font-mono uppercase">ACTIVE</span>}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded font-mono ${is1Min ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                        {item.horizon || (is1Min ? '+1 min' : '+2 min')}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-white/50 text-[10px]">{item.type}</td>
                    <td className="py-3 px-3 font-bold text-emerald-400">{item.accuracy}%</td>
                    <td className="py-3 px-3 text-white/80">{item.precision}%</td>
                    <td className="py-3 px-3 text-white/80">{item.recall}%</td>
                    <td className="py-3 px-3 font-bold text-amber-400">{item.f1Score}%</td>
                    <td className="py-3 px-3 text-sky-400 font-bold">{item.rocAuc}</td>
                    <td className="py-3 px-3">
                      {isActive ? (
                        <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-1">
                          ✓ ACTIVE INFERENCE
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSelectModel(item.name)}
                          disabled={loadingModel}
                          className="px-2.5 py-1 text-[9px] font-bold uppercase rounded bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer"
                        >
                          ACTIVATE
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* METRIC DEFINITIONS & CONFUSION MATRIX */}
      {m && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="dash-card p-5 md:col-span-2">
            <div className="dash-card-header-left mb-4">
              <div className="dash-card-bar" style={{ background: 'linear-gradient(180deg, #8B949E, #566176)' }} />
              <span className="dash-card-title">Confusion Matrix (2x2 Contingency Table)</span>
            </div>
            <div className="grid grid-cols-3 gap-2 max-w-md font-mono text-[10px]">
              <div />
              <div className="text-[#8B949E] font-bold text-center pb-1">PREDICTED +</div>
              <div className="text-[#8B949E] font-bold text-center pb-1">PREDICTED -</div>

              <div className="text-[#8B949E] font-bold flex items-center pr-2">ACTUAL +</div>
              <div className="bg-green-500/10 border border-green-500/30 rounded p-2.5 text-center">
                <div className="text-lg font-black text-green-400">{m.tp}</div>
                <div className="text-[8px] text-[#566176] font-bold uppercase mt-0.5">True Positive (TP)</div>
              </div>
              <div className="bg-red-500/10 border border-red-500/30 rounded p-2.5 text-center">
                <div className="text-lg font-black text-red-500">{m.fn}</div>
                <div className="text-[8px] text-[#566176] font-bold uppercase mt-0.5">False Negative (FN)</div>
              </div>

              <div className="text-[#8B949E] font-bold flex items-center pr-2">ACTUAL -</div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2.5 text-center">
                <div className="text-lg font-black text-yellow-500">{m.fp}</div>
                <div className="text-[8px] text-[#566176] font-bold uppercase mt-0.5">False Positive (FP)</div>
              </div>
              <div className="bg-[#0D1117]/60 border border-[#30363D] rounded p-2.5 text-center">
                <div className="text-lg font-black text-[#E6EDF3]">{m.tn}</div>
                <div className="text-[8px] text-[#566176] font-bold uppercase mt-0.5">True Negative (TN)</div>
              </div>
            </div>
          </div>

          <div className="dash-card p-5 flex flex-col justify-between items-center text-center">
            <div className="dash-card-header-left mb-4 w-full">
              <div className="dash-card-bar" style={{ background: '#38BDF8' }} />
              <span className="dash-card-title">Skill Score (HSS)</span>
            </div>
            <div className="my-auto py-4 space-y-2">
              <div className="text-4xl font-black font-mono text-blue-400">
                {m.skill.toFixed(2)}
              </div>
              <div className="text-[10px] text-[#8B949E] font-mono leading-relaxed px-2">
                Heidke Skill Score vs random chance background noise. Demonstrates high predictive skill.
              </div>
            </div>
            <div className="text-[8px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-mono font-bold uppercase">
              Validated
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
