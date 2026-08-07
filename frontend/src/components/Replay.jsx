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
