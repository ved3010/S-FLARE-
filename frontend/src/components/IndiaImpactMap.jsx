import { useState, useEffect, useRef, useCallback } from 'react';
import { useLiveState } from '../lib/data';

// ─── Risk Colors ─────────────────────────────────────────
const RISK_COLORS = {
  low:      { fill: 'rgba(52,211,153,0.18)', stroke: 'rgba(52,211,153,0.40)', glow: 'rgba(52,211,153,0.12)', text: '#34D399', label: 'LOW' },
  moderate: { fill: 'rgba(251,191,36,0.18)', stroke: 'rgba(251,191,36,0.40)', glow: 'rgba(251,191,36,0.12)', text: '#FBBF24', label: 'MODERATE' },
  high:     { fill: 'rgba(251,146,60,0.22)', stroke: 'rgba(251,146,60,0.45)', glow: 'rgba(251,146,60,0.15)', text: '#FB923C', label: 'HIGH' },
  critical: { fill: 'rgba(248,113,113,0.25)', stroke: 'rgba(248,113,113,0.55)', glow: 'rgba(248,113,113,0.18)', text: '#F87171', label: 'CRITICAL' },
};

// ─── ISRO Ground Stations ────────────────────────────────
const ISRO_STATIONS = [
  { id: 'blr', name: 'UR Rao Satellite Centre', city: 'Bengaluru', lat: 12.97, lng: 77.56, x: 130, y: 225, type: 'HQ/Satellite', icon: '★' },
  { id: 'shar', name: 'Satish Dhawan Space Centre', city: 'Sriharikota', lat: 13.72, lng: 80.23, x: 185, y: 220, type: 'Launch Complex', icon: '▲' },
  { id: 'ahm', name: 'Space Applications Centre', city: 'Ahmedabad', lat: 23.03, lng: 72.58, x: 95, y: 132, type: 'R&D Centre', icon: '●' },
  { id: 'vssc', name: 'Vikram Sarabhai Space Centre', city: 'Thiruvananthapuram', lat: 8.53, lng: 76.87, x: 145, y: 270, type: 'R&D Centre', icon: '●' },
  { id: 'hyd', name: 'NRSC', city: 'Hyderabad', lat: 17.42, lng: 78.55, x: 170, y: 188, type: 'Data Centre', icon: '⏺' },
  { id: 'del', name: 'Delhi Earth Station', city: 'New Delhi', lat: 28.61, lng: 77.23, x: 175, y: 82, type: 'Ground Station', icon: '▽' },
  { id: 'lko', name: 'IITK Satellite Lab', city: 'Lucknow', lat: 26.85, lng: 80.95, x: 212, y: 98, type: 'Research', icon: '◇' },
  { id: 'shill', name: 'NE-SAC', city: 'Shillong', lat: 25.57, lng: 91.88, x: 272, y: 78, type: 'R&D Centre', icon: '●' },
  { id: 'mcf', name: 'Master Control Facility', city: 'Hassan', lat: 13.01, lng: 76.13, x: 140, y: 222, type: 'Satellite Ops', icon: '⏺' },
];

// ─── India State SVG Paths (improved, more recognizable) ─
const STATE_PATHS = {
  jk:  { d: 'M155,28 L172,22 L188,28 L202,36 L208,50 L198,58 L190,64 L180,60 L170,54 L158,48 L150,42 L146,35 Z', label: 'JK', zone: 'north' },
  hp:  { d: 'M190,58 L208,52 L218,60 L222,70 L212,74 L200,70 L194,66 Z', label: 'HP', zone: 'north' },
  uk:  { d: 'M215,58 L232,55 L242,62 L240,74 L230,78 L218,75 Z', label: 'UK', zone: 'north' },
  pb:  { d: 'M146,62 L162,56 L176,62 L180,74 L172,80 L158,78 L148,72 Z', label: 'PB', zone: 'north' },
  hr:  { d: 'M164,78 L180,74 L188,82 L182,92 L168,90 L162,84 Z', label: 'HR', zone: 'north' },
  dl:  { d: 'M176,78 L183,76 L187,80 L184,86 L178,84 Z', label: 'DL', zone: 'north' },
  rj:  { d: 'M118,84 L148,78 L162,84 L168,100 L162,118 L148,124 L130,122 L118,114 L112,98 Z', label: 'RJ', zone: 'northwest' },
  up:  { d: 'M180,84 L212,78 L228,84 L234,100 L232,118 L220,124 L202,120 L188,112 L178,102 Z', label: 'UP', zone: 'north' },
  br:  { d: 'M228,104 L242,100 L254,106 L258,120 L250,130 L238,126 L226,118 Z', label: 'BR', zone: 'east' },
  jh:  { d: 'M228,124 L244,120 L258,126 L262,142 L250,148 L236,144 L226,136 Z', label: 'JH', zone: 'east' },
  wb:  { d: 'M250,104 L268,98 L278,106 L282,122 L274,132 L264,128 L256,120 L248,112 Z', label: 'WB', zone: 'east' },
  sk:  { d: 'M268,54 L278,50 L284,56 L282,64 L272,62 Z', label: 'SK', zone: 'north' },
  as:  { d: 'M258,60 L278,52 L294,56 L302,66 L298,78 L284,80 L272,74 L262,68 Z', label: 'AS', zone: 'northeast' },
  ar:  { d: 'M294,38 L314,32 L330,36 L336,48 L332,62 L320,58 L306,54 L296,46 Z', label: 'AR', zone: 'northeast' },
  nl:  { d: 'M298,58 L312,54 L322,60 L320,72 L308,70 L300,64 Z', label: 'NL', zone: 'northeast' },
  mn:  { d: 'M308,64 L322,60 L328,68 L326,80 L316,78 L308,72 Z', label: 'MN', zone: 'northeast' },
  mz:  { d: 'M314,78 L328,74 L338,82 L336,94 L324,90 L314,84 Z', label: 'MZ', zone: 'northeast' },
  tr:  { d: 'M290,82 L304,78 L312,84 L308,96 L296,92 L288,88 Z', label: 'TR', zone: 'northeast' },
  ml:  { d: 'M270,70 L286,66 L296,72 L294,82 L280,82 L268,78 Z', label: 'ML', zone: 'northeast' },
  gj:  { d: 'M88,114 L118,106 L134,110 L142,124 L138,142 L124,148 L108,144 L96,136 L90,124 Z', label: 'GJ', zone: 'west' },
  mp:  { d: 'M124,124 L148,116 L172,120 L180,134 L176,150 L162,154 L144,152 L130,146 L122,136 Z', label: 'MP', zone: 'central' },
  cg:  { d: 'M180,140 L198,134 L214,138 L220,154 L214,164 L200,162 L186,156 L178,148 Z', label: 'CG', zone: 'central' },
  od:  { d: 'M208,156 L222,148 L236,150 L244,164 L238,178 L224,178 L214,172 L206,164 Z', label: 'OD', zone: 'east' },
  mh:  { d: 'M92,156 L130,148 L160,152 L174,162 L176,180 L164,188 L142,184 L124,178 L110,172 L100,164 Z', label: 'MH', zone: 'west' },
  ts:  { d: 'M162,184 L184,176 L202,180 L204,196 L194,204 L180,202 L166,194 Z', label: 'TS', zone: 'south' },
  ap:  { d: 'M202,186 L222,178 L242,182 L248,200 L240,214 L226,210 L214,204 L204,196 Z', label: 'AP', zone: 'south' },
  ka:  { d: 'M130,212 L156,200 L178,206 L188,220 L184,238 L172,244 L152,240 L136,234 L128,224 Z', label: 'KA', zone: 'south' },
  ga:  { d: 'M106,196 L118,190 L126,198 L124,208 L114,204 Z', label: 'GA', zone: 'west' },
  kl:  { d: 'M140,250 L158,244 L170,250 L168,268 L158,274 L142,270 L134,260 Z', label: 'KL', zone: 'south' },
  tn:  { d: 'M170,250 L188,242 L204,248 L210,262 L204,276 L190,282 L176,278 L164,270 Z', label: 'TN', zone: 'south' },
  py:  { d: 'M210,244 L216,240 L220,246 L218,252 L212,250 Z', label: 'PY', zone: 'south' },
  an:  { d: 'M308,248 L318,242 L326,250 L324,264 L314,262 L306,254 Z', label: 'AN', zone: 'islands' },
  ld:  { d: 'M72,268 L80,262 L88,268 L86,278 L76,276 Z', label: 'LD', zone: 'islands' },
};

const STATE_LABELS = {
  jk: { x: 175, y: 44 }, hp: { x: 206, y: 64 }, uk: { x: 228, y: 66 },
  pb: { x: 163, y: 68 }, hr: { x: 176, y: 84 }, dl: { x: 182, y: 82 },
  rj: { x: 142, y: 100 }, up: { x: 206, y: 102 }, br: { x: 240, y: 114 },
  jh: { x: 240, y: 134 }, wb: { x: 263, y: 118 }, sk: { x: 275, y: 58 },
  as: { x: 276, y: 68 }, ar: { x: 312, y: 50 }, nl: { x: 310, y: 64 },
  mn: { x: 314, y: 70 }, mz: { x: 324, y: 84 }, tr: { x: 300, y: 86 },
  ml: { x: 280, y: 76 }, gj: { x: 114, y: 128 }, mp: { x: 152, y: 135 },
  cg: { x: 196, y: 148 }, od: { x: 224, y: 164 }, mh: { x: 134, y: 170 },
  ts: { x: 180, y: 190 }, ap: { x: 222, y: 196 }, ka: { x: 158, y: 226 },
  ga: { x: 116, y: 198 }, kl: { x: 152, y: 262 }, tn: { x: 186, y: 262 },
  py: { x: 214, y: 248 }, an: { x: 314, y: 252 }, ld: { x: 80, y: 272 },
};

// ─── Helper: map flare class to severity 0–1 ────────────
function computeSeverity(flareClass) {
  if (!flareClass) return 0;
  const fc = flareClass.trim().toUpperCase();
  const letter = fc[0] || 'B';
  const num = parseFloat(fc.slice(1)) || 1.0;
  if (letter === 'A' || letter === 'B') return 0;
  if (letter === 'C') return Math.min(0.3, 0.15 + (num / 10.0) * 0.15);
  if (letter === 'M') return Math.min(0.6, 0.35 + (num / 10.0) * 0.25);
  if (letter === 'X') return Math.min(1.0, 0.65 + (num / 10.0) * 0.30);
  return 0;
}

// ─── Predict risk at forecast hour (interpolation) ───────
function riskAtHour(baseSeverity, forecastHour) {
  // Growing: risk increases over forecast horizon as CME approaches
  // Decaying: after peak, CME passes and risk subsides
  const PEAK_HOUR = 6; // CME arrives around 6h
  if (forecastHour <= PEAK_HOUR) {
    const growth = forecastHour / PEAK_HOUR; // 0→1
    return baseSeverity * (0.3 + 0.7 * growth);
  } else {
    const decay = Math.max(0, 1 - (forecastHour - PEAK_HOUR) / 18); // 1→0 by 24h
    return baseSeverity * decay;
  }
}

// ─── Skeleton ────────────────────────────────────────────
function MapSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-2">
      <div className="flex gap-2">
        <div className="h-5 w-16 bg-white/[0.06] rounded animate-pulse" />
        <div className="h-5 w-16 bg-white/[0.06] rounded animate-pulse" />
      </div>
      <div className="w-full aspect-square max-w-[340px] mx-auto bg-white/[0.03] rounded-xl animate-pulse flex items-center justify-center">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────
export default function IndiaImpactMap() {
  const { flareClass } = useLiveState();
  const [mode, setMode] = useState('gps');
  const [mapData, setMapData] = useState(null);
  const [hoveredState, setHoveredState] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [hoveredStation, setHoveredStation] = useState(null);
  const [stationTooltipPos, setStationTooltipPos] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);
  const [forecastHour, setForecastHour] = useState(6); // Start at CME peak arrival for realistic initial view
  const [isAnimating, setIsAnimating] = useState(false);
  const [showIsro, setShowIsro] = useState(false);
  const mapRef = useRef(null);
  const lastFetchedClass = useRef(null);
  const animRef = useRef(null);

  const getRiskColor = (risk) => RISK_COLORS[risk] || RISK_COLORS.low;
  const baseSeverity = computeSeverity(flareClass);

  // ── Fetch data from API ──
  const fetchData = useCallback(async (fc) => {
    if (!fc) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/india-impact?flare_class=${encodeURIComponent(fc)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMapData(data);
      lastFetchedClass.current = fc;
    } catch (err) {
      console.error('Failed to fetch India impact map:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch on flareClass change (WebSocket live update)
  useEffect(() => {
    if (flareClass && flareClass !== lastFetchedClass.current) {
      fetchData(flareClass);
    }
  }, [flareClass, fetchData]);

  // ── Time Animation ──
  useEffect(() => {
    if (!isAnimating) {
      if (animRef.current) clearInterval(animRef.current);
      return;
    }
    animRef.current = setInterval(() => {
      setForecastHour(prev => {
        const next = prev + 0.5;
        return next >= 24 ? 0 : next;
      });
    }, 80);
    return () => clearInterval(animRef.current);
  }, [isAnimating]);

  // ── Get risk at current forecast hour, interpolating from base ──
  const getInterpolatedRisk = useCallback((region) => {
    if (!mapData) return null;
    const base = region.gps?.value || 0;
    const multiplier = riskAtHour(1.0, forecastHour);
    const severityScale = baseSeverity > 0 ? base / baseSeverity : 0.5;
    const interpolated = base * multiplier;

    function label(v) {
      if (v < 0.08) return 'low';
      if (v < 0.22) return 'moderate';
      if (v < 0.42) return 'high';
      return 'critical';
    }

    const risk = mode === 'gps' ? { ...region.gps } : { ...region.powerGrid };
    const origVal = mode === 'gps' ? (region.gps?.value || 0) : (region.powerGrid?.value || 0);
    const newVal = origVal * multiplier;
    const newRisk = label(newVal);
    const origRisk = mode === 'gps' ? region.gps?.risk : region.powerGrid?.risk;

    return {
      risk: newRisk,
      value: newVal,
      originalRisk: origRisk,
      originalValue: origVal,
    };
  }, [mapData, mode, forecastHour, baseSeverity]);

  // ── Hover ──
  const handleStateHover = useCallback((e, stateId) => {
    const stateData = mapData?.regions?.find(r => r.id === stateId);
    if (!stateData) return;
    setHoveredState(stateData);
    setHoveredStation(null);
    const rect = e.target.getBoundingClientRect();
    const mapRect = mapRef.current?.getBoundingClientRect();
    if (mapRect) {
      setTooltipPos({ x: rect.left - mapRect.left + rect.width / 2, y: rect.top - mapRect.top - 6 });
    }
  }, [mapData]);

  const handleStationHover = useCallback((e, station) => {
    setHoveredStation(station);
    setHoveredState(null);
    const rect = e.target.getBoundingClientRect();
    const mapRect = mapRef.current?.getBoundingClientRect();
    if (mapRect) {
      setStationTooltipPos({ x: rect.left - mapRect.left + rect.width / 2, y: rect.top - mapRect.top - 6 });
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredState(null);
    setHoveredStation(null);
  }, []);

  // ── Stats ──
  const stats = (() => {
    if (!mapData?.regions) return { critical: 0, high: 0, moderate: 0, low: 0 };
    const s = { critical: 0, high: 0, moderate: 0, low: 0 };
    mapData.regions.forEach(r => {
      const interpolated = getInterpolatedRisk(r);
      const risk = interpolated?.risk || (mode === 'gps' ? r.gps.risk : r.powerGrid.risk);
      s[risk]++;
    });
    return s;
  })();

  const overall = stats.critical > 0
    ? { text: '#F87171', bg: 'rgba(248,113,113,0.12)', label: 'CRITICAL' }
    : stats.high > 0
    ? { text: '#FB923C', bg: 'rgba(251,146,60,0.12)', label: 'HIGH' }
    : stats.moderate > 0
    ? { text: '#FBBF24', bg: 'rgba(251,191,36,0.12)', label: 'MODERATE' }
    : { text: '#34D399', bg: 'rgba(52,211,153,0.12)', label: 'NOMINAL' };

  const riskLegend = ['low', 'moderate', 'high', 'critical'];
  const modeLabel = mode === 'gps' ? 'GPS/Navigation' : 'Power Grid';

  // ── Animate indicator ──
  const animPct = (forecastHour / 24) * 100;

  if (loading && !mapData) return <MapSkeleton />;

  // Since we're rendering, compute diagnostics for ISRO sidebar
  const getStationStatus = (st) => {
    const sev = baseSeverity * riskAtHour(1.0, forecastHour);
    const s4 = 0.02 + sev * 0.95;
    const gic = 0.1 + sev * 79.9;
    let statusText = 'NOMINAL';
    let statusColor = '#34D399';
    let bg = 'rgba(52,211,153,0.06)';
    if (s4 > 0.7) {
      statusText = 'CRITICAL';
      statusColor = '#F87171';
      bg = 'rgba(248,113,113,0.1)';
    } else if (s4 > 0.4) {
      statusText = 'WARNING';
      statusColor = '#FB923C';
      bg = 'rgba(251,146,60,0.08)';
    } else if (s4 > 0.15) {
      statusText = 'ELEVATED';
      statusColor = '#FBBF24';
      bg = 'rgba(251,191,36,0.06)';
    }
    return { s4, gic, statusText, statusColor, bg };
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* ── Map & Controls Column ── */}
      <div className="lg:col-span-3 india-map-wrapper flex flex-col justify-between h-full">
        <div>
          {/* Controls Row */}
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-wider">{modeLabel}</span>
              {mapData && (
                <span className="text-[7px] font-mono font-bold px-1.5 py-0.5 rounded-full tracking-wider uppercase" style={{ background: overall.bg, color: overall.text }}>
                  {overall.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowIsro(v => !v)}
                className={`px-2 py-1 rounded-md text-[8px] font-mono font-bold tracking-wider uppercase transition-all duration-200 ${
                  showIsro ? 'text-white bg-white/[0.12]' : 'text-white/25 hover:text-white/50'
                }`}
                title="Toggle ISRO ground stations"
              >
                ISRO {showIsro ? 'ON' : 'OFF'}
              </button>
              <div className="w-px h-3 bg-white/[0.06]" />
              <button onClick={() => setMode('gps')} className={`px-2.5 py-1 rounded-md text-[8px] font-mono font-bold tracking-wider uppercase transition-all duration-200 ${mode === 'gps' ? 'text-white bg-white/[0.12]' : 'text-white/25 hover:text-white/50'}`}>GPS</button>
              <button onClick={() => setMode('grid')} className={`px-2.5 py-1 rounded-md text-[8px] font-mono font-bold tracking-wider uppercase transition-all duration-200 ${mode === 'grid' ? 'text-white bg-white/[0.12]' : 'text-white/25 hover:text-white/50'}`}>GRID</button>
            </div>
          </div>

          {/* Time Slider */}
          <div className="mb-4 px-0.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[7px] font-mono font-bold text-white/25 uppercase tracking-wider">Forecast Timeline: T+{forecastHour}h</span>
              <button
                onClick={() => setIsAnimating(v => !v)}
                className={`text-[7px] font-mono font-bold px-1.5 py-0.5 rounded tracking-wider uppercase transition-all ${
                  isAnimating ? 'text-[#38BDF8] bg-[#38BDF8]/10' : 'text-white/25 hover:text-white/50'
                }`}
              >
                {isAnimating ? '⏹ STOP' : '▶ PLAY'}
              </button>
            </div>
            <div
              className="relative h-1.5 rounded-full cursor-pointer overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.06)' }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                setForecastHour(Math.round(pct * 24));
              }}
            >
              <div
                className="h-full rounded-full transition-all duration-100"
                style={{ width: `${animPct}%`, background: 'linear-gradient(90deg, #34D399, #FBBF24, #F87171)', boxShadow: '0 0 8px rgba(248,113,113,0.3)' }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white transition-all duration-100"
                style={{ left: `calc(${animPct}% - 5px)`, boxShadow: '0 0 8px rgba(255,255,255,0.4)' }}
              />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[6px] font-mono text-white/15">Now</span>
              <span className="text-[6px] font-mono text-white/15">+12h</span>
              <span className="text-[6px] font-mono text-white/15">+24h</span>
            </div>
          </div>
        </div>

        {/* Map Vector */}
        <div className="relative w-full max-w-[340px] mx-auto" ref={mapRef}>
          <svg viewBox="0 0 340 400" className="w-full h-auto" style={{ filter: 'drop-shadow(0 4px 24px rgba(0,0,0,0.4))' }}>
            <path d="M68,108 Q56,130 62,152 L84,156 Q88,166 94,172 L78,188 Q72,198 84,208 L96,212 Q106,218 112,228 L122,238 L116,252 Q120,264 132,272 L142,278 L158,282 L174,278 L184,270 Q200,274 210,268 Q220,262 224,252 L232,248 Q242,242 248,232 L254,222 L258,212 L264,200 Q256,186 262,176 L266,166 Q268,156 262,148 L256,140 Q252,130 244,126 L240,118 Q236,108 232,104 L230,96 Q226,88 222,84 L220,76 Q216,68 212,64 L206,56 Q200,50 194,46 L184,42 Q176,36 168,34 L158,30 Q148,26 142,34 L136,44 Q130,52 126,56 L118,60 Q108,64 102,70 L88,76 Q78,84 74,94 L68,108 Z" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />

            {mapData?.regions?.map((region) => {
              const path = STATE_PATHS[region.id];
              if (!path) return null;
              const interpolated = getInterpolatedRisk(region);
              const risk = interpolated?.risk || (mode === 'gps' ? region.gps.risk : region.powerGrid.risk);
              const colors = getRiskColor(risk);
              const isHovered = hoveredState?.id === region.id;

              return (
                <g key={region.id}>
                  {isHovered && <path d={path.d} fill={colors.glow} stroke={colors.text} strokeWidth="2" opacity="0.5" />}
                  <path
                    d={path.d}
                    fill={colors.fill}
                    stroke={isHovered ? colors.text : colors.stroke}
                    strokeWidth={isHovered ? 1.5 : 0.7}
                    opacity={isHovered ? 1 : 0.82}
                    className="cursor-pointer"
                    style={{ transition: 'fill 0.4s ease, stroke 0.3s, opacity 0.2s' }}
                    onMouseEnter={(e) => handleStateHover(e, region.id)}
                    onMouseLeave={handleMouseLeave}
                  />
                  <text
                    x={STATE_LABELS[region.id]?.x || 0} y={STATE_LABELS[region.id]?.y || 0}
                    textAnchor="middle" dominantBaseline="central"
                    fill={isHovered ? colors.text : 'rgba(255,255,255,0.22)'}
                    fontSize="5" fontFamily="'JetBrains Mono', monospace" fontWeight="700"
                    className="pointer-events-none select-none"
                    style={{ transition: 'fill 0.3s' }}
                  >{path.label}</text>
                </g>
              );
            })}

            {showIsro && ISRO_STATIONS.map(st => {
              const isHovered = hoveredStation?.id === st.id;
              const beaconColor = '#38BDF8';
              return (
                <g key={st.id}>
                  <line x1={st.x} y1={st.y} x2={st.x} y2={st.y + 12} stroke="rgba(56,189,248,0.12)" strokeWidth="0.6" strokeDasharray="2,2" />
                  <circle cx={st.x} cy={st.y} r={isHovered ? 6 : 4} fill="none" stroke={beaconColor} strokeWidth={isHovered ? 1.5 : 0.8} opacity={isHovered ? 0.8 : 0.4}>
                    {!isHovered && <animate attributeName="r" values="3;5;3" dur="2.5s" repeatCount="indefinite" />}
                  </circle>
                  <circle cx={st.x} cy={st.y} r="2.5" fill={beaconColor} opacity={isHovered ? 1 : 0.7} style={{ boxShadow: '0 0 6px rgba(56,189,248,0.6)' }}>
                    <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <text x={st.x} y={st.y - 6} textAnchor="middle" fill={isHovered ? beaconColor : 'rgba(56,189,248,0.4)'} fontSize="3.5" fontFamily="'JetBrains Mono', monospace" fontWeight="600" className="pointer-events-none select-none">{st.city}</text>
                  <circle cx={st.x} cy={st.y} r="7" fill="transparent" className="cursor-pointer" onMouseEnter={(e) => handleStationHover(e, st)} onMouseLeave={handleMouseLeave} />
                </g>
              );
            })}

            {mapData && (
              <g>
                <circle cx="182" cy="82" r="3" fill="none" stroke="#38BDF8" strokeWidth="1" opacity="0.4">
                  <animate attributeName="opacity" values="0.2;0.7;0.2" dur="3s" repeatCount="indefinite" />
                  <animate attributeName="r" values="2;4;2" dur="3s" repeatCount="indefinite" />
                </circle>
                <text x="182" y="74" textAnchor="middle" fill="#38BDF8" fontSize="3.5" fontFamily="'JetBrains Mono', monospace" fontWeight="600" opacity="0.35">NAVIC</text>
              </g>
            )}
          </svg>

          {/* Tooltip: State */}
          {hoveredState && (
            <div className="absolute pointer-events-none z-10" style={{ left: tooltipPos.x, top: tooltipPos.y, transform: 'translate(-50%, -100%)' }}>
              <div className="glass px-2.5 py-1.5 rounded-lg" style={{ minWidth: '160px', maxWidth: '220px' }}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] font-bold text-white/90">{hoveredState.name}</span>
                  {(() => {
                    const r = getInterpolatedRisk(hoveredState);
                    const risk = r?.risk || (mode === 'gps' ? hoveredState.gps.risk : hoveredState.powerGrid.risk);
                    const c = getRiskColor(risk);
                    const changed = r && r.originalRisk !== r.risk;
                    return (
                      <span className="text-[6px] font-mono font-bold px-1 py-0.5 rounded-full tracking-wider uppercase flex items-center gap-1" style={{ background: c.fill, color: c.text, border: `1px solid ${c.stroke}` }}>
                        {risk}
                        {changed && <span className="text-white/40 text-[5px]">({r.originalRisk})</span>}
                      </span>
                    );
                  })()}
                </div>
                <div className="text-[7px] font-mono text-white/25 mb-0.5">{hoveredState.lat}°N · Zone: {hoveredState.zone.toUpperCase()}</div>
                <p className="text-[8px] font-mono text-white/45 leading-relaxed">{mode === 'gps' ? hoveredState.gps.description : hoveredState.powerGrid.description}</p>
                {(() => {
                  const r = getInterpolatedRisk(hoveredState);
                  const val = r?.value || (mode === 'gps' ? hoveredState.gps.value : hoveredState.powerGrid.value);
                  const c = getRiskColor(r?.risk || 'low');
                  const pct = Math.min(100, val * 100);
                  return (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: c.text, boxShadow: `0 0 4px ${c.text}` }} />
                      </div>
                      <span className="text-[6px] font-mono text-white/25">{Math.round(pct)}%</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Tooltip: ISRO Station */}
          {hoveredStation && !hoveredState && (
            <div className="absolute pointer-events-none z-10" style={{ left: stationTooltipPos.x, top: stationTooltipPos.y, transform: 'translate(-50%, -100%)' }}>
              <div className="glass px-2.5 py-1.5 rounded-lg" style={{ minWidth: '150px', maxWidth: '200px' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-white/90">{hoveredStation.name}</span>
                </div>
                <div className="text-[7px] font-mono text-white/30 mb-1">{hoveredStation.city} · {hoveredStation.type}</div>
                <div className="flex items-center gap-2 text-[7px] font-mono text-white/25">
                  <span className={`px-1 py-0.5 rounded-full ${baseSeverity > 0.3 ? 'bg-[#F87171]/10 text-[#F87171]' : 'bg-[#34D399]/10 text-[#34D399]'}`}>
                    {baseSeverity > 0.3 ? '⚠ MONITOR' : '✓ NOMINAL'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Legend / Stats Row */}
        <div className="flex items-center justify-between mt-2 flex-wrap gap-1.5">
          <div className="flex items-center gap-2">
            {riskLegend.map((level) => {
              const c = getRiskColor(level);
              return (
                <div key={level} className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-sm" style={{ background: c.fill, border: `1px solid ${c.stroke}` }} />
                  <span className="text-[6px] font-mono font-bold text-white/25 uppercase tracking-wider">{level === 'moderate' ? 'mod' : level === 'critical' ? 'crit' : level.slice(0, 3)}</span>
                </div>
              );
            })}
            <div className="w-px h-3 bg-white/[0.06] mx-1" />
            <span className="text-[6px] font-mono text-white/15">{stats.critical}C · {stats.high}H · {stats.moderate}M · {stats.low}L</span>
          </div>
          {showIsro && (
            <span className="text-[6px] font-mono text-white/15">{ISRO_STATIONS.length} ISRO stations mapped</span>
          )}
        </div>
      </div>

      {/* ── Regional Diagnostics Sidebar ── */}
      <div className="lg:col-span-2 bg-white/[0.015] border border-white/[0.04] rounded-xl p-4 flex flex-col justify-between h-full animate-fadeInUp">
        <div className="space-y-4">
          <div className="text-[10px] font-mono font-bold text-white/80 border-b border-white/[0.06] pb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-pulse" />
              <span>ISRO Regional Diagnostics</span>
            </span>
            <span className="text-[7.5px] font-mono text-white/30 uppercase tracking-wider">NavIC & GAGAN monitoring</span>
          </div>

          {/* Regional Risk summary */}
          <div className="grid grid-cols-2 gap-3 bg-white/[0.01] rounded-lg p-2.5 border border-white/[0.02]">
            <div>
              <span className="text-[7.5px] font-mono text-white/35 block uppercase tracking-wider">Avg Scintillation</span>
              <span className="text-[11px] font-mono font-black text-[#38BDF8] block mt-0.5">
                {(0.02 + baseSeverity * riskAtHour(1.0, forecastHour) * 0.95).toFixed(2)} S4
              </span>
            </div>
            <div>
              <span className="text-[7.5px] font-mono text-white/35 block uppercase tracking-wider">Induced Current (GIC)</span>
              <span className="text-[11px] font-mono font-black text-[#34D399] block mt-0.5">
                {(0.1 + baseSeverity * riskAtHour(1.0, forecastHour) * 79.9).toFixed(1)} A
              </span>
            </div>
          </div>

          {/* Scrollable list of ground tracking stations */}
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 select-none custom-scrollbar">
            {ISRO_STATIONS.map((st) => {
              const status = getStationStatus(st);
              const isSelected = hoveredStation?.id === st.id;
              return (
                <div
                  key={st.id}
                  className="flex items-center justify-between p-2 rounded-lg border transition-all duration-200"
                  style={{
                    background: isSelected ? 'rgba(56,189,248,0.04)' : 'rgba(255,255,255,0.01)',
                    borderColor: isSelected ? 'rgba(56,189,248,0.25)' : 'rgba(255,255,255,0.03)',
                  }}
                  onMouseEnter={() => setHoveredStation(st)}
                  onMouseLeave={() => setHoveredStation(null)}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-[8px] mt-0.5" style={{ color: status.statusColor }}>{st.icon}</span>
                    <div>
                      <h5 className="text-[9px] font-bold text-white/80">{st.city}</h5>
                      <span className="text-[7px] font-mono text-white/25 block">{st.type}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className="text-[6.5px] font-mono font-bold px-1.5 py-0.5 rounded tracking-wider uppercase inline-block mb-1"
                      style={{ background: status.bg, color: status.statusColor }}
                    >
                      {status.statusText}
                    </span>
                    <div className="text-[7px] font-mono text-white/30 space-x-1.5">
                      <span>S4: <span className="text-white/60 font-semibold">{status.s4.toFixed(2)}</span></span>
                      <span>GIC: <span className="text-white/60 font-semibold">{status.gic.toFixed(0)}A</span></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Diagnostic info footer */}
        <p className="text-[8px] font-mono text-white/30 leading-relaxed border-t border-white/[0.04] pt-2.5 mt-3">
          📊 <strong>Ionospheric Ionization Alert Thresholds:</strong> GAGAN APV receivers enter warning alert when regional L-band scintillation index exceeds 0.45 S4.
        </p>
      </div>
    </div>
  );
}
