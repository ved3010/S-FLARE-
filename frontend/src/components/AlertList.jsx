const LEVEL_STYLES = { 
  RED: { border: 'border-l-[3px] border-red-400', text: 'text-red-400', bg: 'bg-red-500/5', dot: 'bg-red-400', glow: 'rgba(248,113,113,0.15)' }, 
  YELLOW: { border: 'border-l-[3px] border-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-500/5', dot: 'bg-yellow-400', glow: 'rgba(251,191,36,0.15)' }, 
  GREEN: { border: 'border-l-[3px] border-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/5', dot: 'bg-emerald-400', glow: 'rgba(52,211,153,0.15)' } 
};
const TYPE_ABBR = { NOWCAST: 'NOWCAST', FORECAST: 'FORECAST', INFO: 'SYS_INFO' };

export default function AlertList({ alerts }) {
  const displayAlerts = alerts.slice(0, 20);
  
  return (
    <div className="h-full flex flex-col" style={{ overflow: 'hidden' }}>
      <div className="dash-card-header">
        <div className="dash-card-header-left">
          <div className="dash-card-bar" style={{ background: 'linear-gradient(180deg, #F87171, #FBBF24)' }} />
          <span className="dash-card-title">Alert Log</span>
        </div>
        <span className="dash-card-sub uppercase">
          {alerts.length > 0 ? `${alerts.length} alerts` : 'Live Feed'}
        </span>
      </div>
      
      <div className="dash-card-body flex-1 overflow-y-auto space-y-2 font-mono text-[10px]">
        {displayAlerts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white/30 gap-2 py-8">
            <div className="w-10 h-10 rounded-full border-2 border-white/10 flex items-center justify-center text-sm text-emerald-400">✓</div>
            <span className="text-[10px] uppercase font-mono tracking-wider">No active alerts</span>
            <span className="text-[8px] text-center max-w-[180px] text-white/20">All systems nominal — no anomalous solar activity detected</span>
          </div>
        ) : (
