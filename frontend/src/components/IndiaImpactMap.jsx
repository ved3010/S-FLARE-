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
