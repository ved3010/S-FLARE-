import { useState, useEffect } from 'react';
import { formatUTC, fmtFlux } from '../lib/data';

export default function Replay({ event }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); 
  const [speed, setSpeed] = useState(10);
  const [source, setSource] = useState('PRADAN');
  const [simulating, setSimulating] = useState(false);

  const [replayPoints, setReplayPoints] = useState([]);
  const [activePoint, setActivePoint] = useState(null);

  useEffect(() => {
    const eid = event ? event.id : 6;
    setSimulating(true);
    fetch(`/api/replay/${eid}`)
      .then(r => r.json())
      .then(data => {
        setReplayPoints(data.points);
        setProgress(0);
        if (data.points.length > 0) {
          setActivePoint(data.points[0]);
        }
        setSimulating(false);
      })
      .catch(err => {
        console.error("Replay API offline", err);
        setSimulating(false);
      });
  }, [event]);

  useEffect(() => {
    if (!playing || replayPoints.length === 0) return;
    const timer = setInterval(() => {
      setProgress(p => {
        const nextIdx = p + 1;
        if (nextIdx >= replayPoints.length) {
          setPlaying(false);
          return p;
        }
        setActivePoint(replayPoints[nextIdx]);
        return nextIdx;
      });
    }, 1000 / speed);
    return () => clearInterval(timer);
  }, [playing, speed, replayPoints]);

  const handleSeek = (e) => {
    if (replayPoints.length === 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - r.left) / r.width;
    const idx = Math.min(replayPoints.length - 1, Math.max(0, Math.floor(frac * replayPoints.length)));
    setProgress(idx);
    setActivePoint(replayPoints[idx]);
  };

  const soft = activePoint ? activePoint.softFlux : 5e-8;
  const hard = activePoint ? activePoint.hardFlux : 3e-9;
  const hr = activePoint ? activePoint.hardnessRatio : 0.035;
  const pct = replayPoints.length > 1 ? (progress / (replayPoints.length - 1)) * 100 : 0;

  return (
    <div className="premium-dash select-none">
      <div className="dash-section-head">
        <span className="dash-section-tag">Replay</span>
        <h2 className="dash-section-title">Hardware Replay Simulator</h2>
        {event && (
          <p className="dash-section-desc">
            TARGET: <span className="text-[#F1C40F] font-bold">{event.cls}</span>
            <span className="ml-3">{formatUTC(event.ts)}</span>
          </p>
        )}
      </div>

      {/* Controls Card */}
      <div className="dash-card p-4 mb-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex gap-2">
            <button 
              className={`px-4 py-1.5 rounded text-xs uppercase tracking-wider font-bold transition-all cursor-pointer ${
                playing 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-white hover:bg-gray-100 text-black shadow-md shadow-white/10'
              }`}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? 'PAUSE' : 'PLAY'}
            </button>
            <button 
              className="px-4 py-1.5 rounded text-xs uppercase tracking-wider font-bold bg-[#21262D] hover:bg-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] border border-[#30363D] cursor-pointer"
              onClick={() => { 
                setProgress(0); 
                setPlaying(false); 
                if(replayPoints.length > 0) setActivePoint(replayPoints[0]); 
              }}
            >
              RESET
            </button>
          </div>
          
          <div className="h-6 w-[1px] bg-[#30363D]" />
          
          {/* Speed Multiplier */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#8B949E] font-mono uppercase">ACCELERATION:</span>
            <div className="flex bg-[#0D1117] p-0.5 border border-[#30363D] rounded">
              {[1, 5, 10, 50, 100].map(s => (
                <button 
                  key={s} 
                  className={`text-[10px] font-mono px-2.5 py-0.5 rounded cursor-pointer transition-all ${speed === s ? 'bg-white text-black font-bold shadow-sm' : 'text-[#8B949E] hover:text-white'}`} 
                  onClick={() => setSpeed(s)}
                >
                  {s}X
                </button>
              ))}
            </div>
          </div>

          <div className="h-6 w-[1px] bg-[#30363D]" />

          {/* Telemetry Source */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#8B949E] font-mono uppercase">STREAM SOURCE:</span>
            <div className="flex bg-[#0D1117] p-0.5 border border-[#30363D] rounded">
              {['PRADAN', 'GOES', 'SIMULATED'].map(s => (
                <button 
                  key={s} 
                  className={`text-[10px] font-mono px-2.5 py-0.5 rounded cursor-pointer transition-all ${source === s ? 'bg-white text-black font-bold shadow-sm' : 'text-[#8B949E] hover:text-white'}`} 
                  onClick={() => setSource(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Seek Track Bar */}
      <div className="dash-card p-4 mb-4">
        <div className="relative cursor-pointer" onClick={handleSeek}>
          <div className="h-2 bg-[#0D1117] border border-[#30363D] rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-100" style={{ width: `${pct}%`, boxShadow: '0 0 10px rgba(255,255,255,0.3)' }} />
          </div>
          <div className="flex justify-between items-center mt-2.5">
            <span className="text-[10px] text-[#8B949E] font-mono">
              TIME TAG: <span className="text-[#E6EDF3]">{activePoint ? new Date(activePoint.timestamp).toISOString().slice(11, 19) : '00:00:00'} UTC</span>
            </span>
            <span className="text-xs text-white font-mono font-bold">
              PROGRESS: {pct.toFixed(0)}%
            </span>
            <span className="text-[10px] text-[#8B949E] font-mono">
              DURATION: {replayPoints.length > 0 ? `+${Math.floor((replayPoints.length * 10) / 60)} min` : '+60 min'}
            </span>
          </div>
        </div>
      </div>

      {/* Realtime Readings */}
      <div className="dash-card p-4 space-y-4">
        <div className="dash-card-header-left">
          <div className="dash-card-bar" style={{ background: 'linear-gradient(180deg, #FFFFFF, #3498DB)' }} />
          <span className="dash-card-title">Replayed Physical Telemetry</span>
          {simulating && (
            <span className="text-[9px] font-mono text-white/60 uppercase animate-pulse ml-3">
              SYNCING REPLAY STREAM...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="dash-card-body !p-4 text-center">
            <div className="text-[9px] uppercase tracking-wider font-semibold font-mono text-[#8B949E] mb-1">SoLEXS (Soft X-Ray)</div>
            <div className="text-xl font-bold font-mono text-[#E6EDF3]">{fmtFlux(soft)}</div>
            <div className="text-[8px] text-[#566176] font-mono mt-1">W/m²</div>
          </div>
          <div className="dash-card-body !p-4 text-center">
            <div className="text-[9px] uppercase tracking-wider font-semibold font-mono text-[#8B949E] mb-1">HEL1OS (Hard X-Ray)</div>
            <div className="text-xl font-bold font-mono text-[#3498DB]">{fmtFlux(hard)}</div>
            <div className="text-[8px] text-[#566176] font-mono mt-1">W/m² equivalent</div>
          </div>
          <div className="dash-card-body !p-4 text-center">
            <div className="text-[9px] uppercase tracking-wider font-semibold font-mono text-[#8B949E] mb-1">Hardness Ratio</div>
            <div className={`text-xl font-bold font-mono ${hr > 0.06 ? 'text-orange-400' : 'text-[#8B949E]'}`}>
              {hr.toFixed(4)}
            </div>
            <div className="text-[8px] text-[#566176] font-mono mt-1">HEL1OS / SoLEXS</div>
          </div>
        </div>

        {/* Model State Simulator readout */}
        {activePoint && activePoint.status && (
          <div className="dash-card-body !p-4 font-mono text-[10px] space-y-2">
            <div className="text-[9px] uppercase font-bold text-white/80 border-b border-[#30363D]/40 pb-1">
              Pipeline Neural Inferences:
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[#8B949E]">
              <div>NOWCAST STATE: <span className="text-red-500 font-bold block">{activePoint.status.systemStatus.stateLabel} ({activePoint.status.nowcast.class})</span></div>
              <div>FORECAST PROBABILITY: <span className="text-[#3498DB] font-bold block">{activePoint.status.forecast.probability}%</span></div>
              <div>ONSET DETECTED: <span className="text-[#E6EDF3] block">{activePoint.status.nowcast.currentPhase}</span></div>
              <div>Z-SCORE VALUE: <span className="text-[#E6EDF3] block">{activePoint.status.nowcast.zScore.toFixed(2)}σ</span></div>
            </div>
            {activePoint.status.hardnessRatio.preFlareSignal && (
              <div className="bg-white/10 text-white border border-white/20 px-2 py-1 rounded text-[9px] font-bold animate-pulse text-center">
                ⚠️ SPECTRAL HARDENING DETECTED: PRE-FLARE WARNING FIRED (+{activePoint.status.hardnessRatio.minutesEarly} MINUTES ADVANCE WARNING)
              </div>
            )}
          </div>
        )}

        {/* Cataloged Event Details */}
        {event && (
          <div className="border-t border-[#30363D]/40 pt-3 text-[9px] font-mono text-[#566176] flex flex-wrap gap-x-6 gap-y-1">
            <div>EVENT ID: <span className="text-[#8B949E]">{event.id}</span></div>
            <div>PEAK FLUX: <span className="text-[#8B949E]">{event.peak.toExponential(1)} W/m²</span></div>
            <div>GOES LEAD TIME: <span className="text-white font-bold">+{event.lead} MIN</span></div>
            <div>INSTRUMENT COMBINATION: <span className="text-[#8B949E]">{event.instrument || event.instr}</span></div>
            <div>STORM DURATION: <span className="text-[#8B949E]">{event.duration || event.dur}</span></div>
            <div>DETECTION CONFIDENCE: <span className="text-green-400 font-bold">{event.conf}%</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
