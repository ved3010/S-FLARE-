import { useState, useEffect } from 'react';
import { formatUTC } from '../lib/data';

const CLASS_COLORS = { X: 'text-red-500', M: 'text-yellow-500', C: 'text-blue-400', B: 'text-gray-400' };

export default function Catalog({ onReplay }) {
  const [sort, setSort] = useState('ts');
  const [dir, setDir] = useState('desc');
  const [events, setEvents] = useState([]);

  useEffect(() => {
    fetch(`/api/catalog`)
      .then(r => r.json())
      .then(data => {
        const mapped = data.map(e => ({ 
          ...e, 
          instr: e.instrument || e.instr,
          dur: e.duration || e.dur 
        }));
        setEvents(mapped);
      })
      .catch(err => console.error("API server offline, catalog unavailable", err));
  }, []);

  const sorted = [...events].sort((a, b) => {
    let av, bv;
    if (sort === 'ts') { av = new Date(a.ts); bv = new Date(b.ts); }
    else if (sort === 'cls') { av = a.cls.charCodeAt(0) * 100 + parseFloat(a.cls.slice(1)); bv = b.cls.charCodeAt(0) * 100 + parseFloat(b.cls.slice(1)); }
    else if (sort === 'lead') { av = a.lead; bv = b.lead; }
    else if (sort === 'conf') { av = a.conf; bv = b.conf; }
    return dir === 'desc' ? bv - av : av - bv;
  });

  const handleSort = (col) => {
    if (sort === col) setDir(dir === 'desc' ? 'asc' : 'desc');
    else { setSort(col); setDir('desc'); }
  };

  const S = ({ col }) => <span className="text-[#566176] ml-1 text-[8px]">{sort === col ? (dir === 'desc' ? '▼' : '▲') : ''}</span>;

  return (
    <div className="premium-dash select-none">
      <div className="dash-section-head">
        <span className="dash-section-tag">Catalog</span>
        <h2 className="dash-section-title">Solar Flare Event Catalog</h2>
        <p className="dash-section-desc">
          TOTAL RECORDED EVENTS: <span className="text-orange-400 font-bold">{events.length}</span>
        </p>
      </div>

      <div className="dash-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#30363D]">
            <thead className="bg-[#0D1117]/50 font-mono text-[9px] text-[#8B949E] uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 text-left font-semibold cursor-pointer hover:text-[#E6EDF3]" onClick={() => handleSort('ts')}>Date / Time UTC<S col="ts" /></th>
                <th className="px-6 py-3 text-left font-semibold cursor-pointer hover:text-[#E6EDF3]" onClick={() => handleSort('cls')}>Class<S col="cls" /></th>
                <th className="px-6 py-3 text-right font-semibold">Peak Flux</th>
                <th className="px-6 py-3 text-left font-semibold">Instruments</th>
                <th className="px-6 py-3 text-right font-semibold cursor-pointer hover:text-[#E6EDF3]" onClick={() => handleSort('lead')}>Lead Time<S col="lead" /></th>
                <th className="px-6 py-3 text-right font-semibold cursor-pointer hover:text-[#E6EDF3]" onClick={() => handleSort('conf')}>Confidence<S col="conf" /></th>
                <th className="px-6 py-3 text-left font-semibold">Duration</th>
                <th className="px-6 py-3 text-center font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363D]/40 font-mono text-xs text-[#8B949E]">
              {sorted.map(e => (
                <tr key={e.id} className="hover:bg-[#21262D]/20 transition-colors duration-150">
                  <td className="px-6 py-3 whitespace-nowrap text-[#E6EDF3] font-medium">{formatUTC(e.ts)}</td>
                  <td className={`px-6 py-3 whitespace-nowrap text-sm font-black ${CLASS_COLORS[e.cls[0]] || 'text-white'}`}>{e.cls}</td>
                  <td className="px-6 py-3 whitespace-nowrap text-right text-[#E6EDF3]">{e.peak.toExponential(1)} W/m²</td>
                  <td className="px-6 py-3 whitespace-nowrap text-[11px]">{e.instr}</td>
                  <td className="px-6 py-3 whitespace-nowrap text-right text-orange-400 font-bold">{e.lead > 0 ? `+${e.lead} min` : '—'}</td>
                  <td className="px-6 py-3 whitespace-nowrap text-right text-green-400 font-bold">{e.conf > 0 ? `${e.conf}%` : '—'}</td>
                  <td className="px-6 py-3 whitespace-nowrap">{e.dur}</td>
                  <td className="px-6 py-2 whitespace-nowrap text-center">
                    <button 
                      className="px-3 py-1 rounded text-[10px] uppercase font-bold tracking-wider cursor-pointer bg-[#21262D] hover:bg-white text-[#8B949E] hover:text-black border border-[#30363D] hover:border-white transition-all duration-200" 
                      onClick={() => onReplay(e)}
                    >
                      Replay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
