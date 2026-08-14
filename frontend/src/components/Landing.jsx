import { useState, useEffect, useRef, useCallback } from 'react';



// ── Landing Page CTA Button ────────────────────────────────────
function MagneticBtn({ children, className, onClick, href, ...props }) {
  const Tag = href ? 'a' : 'button';
  const extra = href ? { href, target: '_blank', rel: 'noopener noreferrer' } : {};

  return (
    <Tag
      className={className}
      onClick={onClick}
      {...extra}
      {...props}
    >
      {children}
    </Tag>
  );
}

// ── 3D Tilt Card ───────────────────────────────────────────────
function TiltCard({ children, className = '', glare = true }) {
  const ref = useRef(null);
  const [style, setStyle] = useState({});

  const handleMove = useCallback((e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const tiltX = (y - 0.5) * -8;
    const tiltY = (x - 0.5) * 8;
    const glareX = x * 100;
    const glareY = y * 100;
    setStyle({
      transform: `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.02,1.02,1.02)`,
      ...(glare ? {
        background: `radial-gradient(400px circle at ${glareX}% ${glareY}%, rgba(230,126,34,0.07), transparent 50%)`,
      } : {}),
    });
  }, [glare]);

  const handleLeave = useCallback(() => {
    setStyle({ transform: 'perspective(800px) rotateX(0) rotateY(0) scale3d(1,1,1)' });
  }, []);

  return (
    <div
      ref={ref}
      className={`tilt-card ${className}`}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={style}
    >
      {children}
    </div>
  );
}

// ── Typing Text ────────────────────────────────────────────────
function TypingText({ words, speed = 80, pause = 2000 }) {
  const [text, setText] = useState('');
  const [wordIdx, setWordIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const pauseTimer = useRef(null);

  useEffect(() => {
    return () => { if (pauseTimer.current) clearTimeout(pauseTimer.current); };
  }, []);

  useEffect(() => {
    const word = words[wordIdx];
    const timeout = setTimeout(() => {
      if (!deleting) {
        setText(word.slice(0, charIdx + 1));
        setCharIdx((c) => c + 1);
        if (charIdx + 1 === word.length) {
          pauseTimer.current = setTimeout(() => {
            pauseTimer.current = null;
            setDeleting(true);
          }, pause);
        }
      } else {
        setText(word.slice(0, charIdx - 1));
        setCharIdx((c) => c - 1);
        if (charIdx - 1 === 0) {
          setDeleting(false);
          setWordIdx((w) => (w + 1) % words.length);
        }
      }
    }, deleting ? speed / 2 : speed);

    return () => clearTimeout(timeout);
  }, [charIdx, deleting, wordIdx, words, speed, pause]);

  return (
    <span>
      {text}
      <span className="typing-cursor">|</span>
    </span>
  );
}

// ── Scroll Reveal (IntersectionObserver) ───────────────────────
function Reveal({ children, className = '', delay = 0 }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setShown(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${shown ? 'revealed' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ── Animated Line (for workflow connector) ──────────────────────
function AnimatedLine() {
  const ref = useRef(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setProgress(1); obs.disconnect(); } },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="workflow-line">
      <div className="workflow-line-fill" style={{ height: progress ? '100%' : '0%' }} />
    </div>
  );
}

// ── Live Demo Preview (mini dashboard mockup) ──────────────────
function DemoPreview() {
  const [activeTab, setActiveTab] = useState(0);
  const tabs = ['Nowcast', 'Forecast', 'Catalog'];

  useEffect(() => {
    const id = setInterval(() => setActiveTab((t) => (t + 1) % tabs.length), 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="demo-mockup">
      {/* Fake header */}
      <div className="demo-header">
        <div className="demo-logo">
          <span className="demo-logo-dot" />
          SOLFLARE
        </div>
        <div className="demo-tabs">
          {tabs.map((t, i) => (
            <span
              key={t}
              className={`demo-tab ${i === activeTab ? 'active' : ''}`}
              onClick={() => setActiveTab(i)}
            >
              {t}
            </span>
          ))}
        </div>
        <div className="demo-status">
          <span className="demo-status-dot" />
          LIVE
        </div>
      </div>

      {/* Fake content area */}
      <div className="demo-body">
        {/* Mini chart */}
        <div className="demo-chart">
          <svg viewBox="0 0 400 120" className="demo-chart-svg">
            <defs>
              <linearGradient id="demoGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,100 Q50,95 80,80 T160,60 T240,40 T320,25 T400,15"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2"
              className="demo-chart-line"
            />
            <path
              d="M0,100 Q50,95 80,80 T160,60 T240,40 T320,25 T400,15 L400,120 L0,120 Z"
              fill="url(#demoGrad)"
              className="demo-chart-area"
            />
            {/* Flare event marker */}
            <circle cx="320" cy="25" r="4" fill="#E74C3C" className="demo-flare-dot" />
            <text x="320" y="18" fill="#E74C3C" fontSize="8" textAnchor="middle" fontFamily="var(--font-mono)">M2.4</text>
          </svg>
          <div className="demo-chart-label">
            Soft X-ray Flux (W/m²) — Last 24h
          </div>
        </div>

        {/* Mini status cards */}
        <div className="demo-cards">
          <div className="demo-card-item">
            <span className="demo-card-label">Status</span>
            <span className="demo-card-value green">Nominal</span>
          </div>
          <div className="demo-card-item">
            <span className="demo-card-label">Flux</span>
            <span className="demo-card-value">3.2e-5</span>
          </div>
          <div className="demo-card-item">
            <span className="demo-card-label">Forecast</span>
            <span className="demo-card-value orange">M-class 72%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── FadeIn Component ───────────────────────────────────────────
function FadeIn({ children, delay = 0, duration = 1000, className = "" }) {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOpacity(1);
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`transition-opacity duration-1000 ${className}`}
      style={{
        opacity: opacity,
        transitionDuration: `${duration}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ── AnimatedHeading Component ──────────────────────────────────
function AnimatedHeading({ text }) {
  const [animate, setAnimate] = useState(false);
  const lines = text.split('\n');

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimate(true);
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  let globalCharIdx = 0;

  return (
    <h1
      className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-normal mb-4 text-white leading-tight"
      style={{ letterSpacing: '-0.04em' }}
    >
      {lines.map((line, lineIdx) => {
        const words = line.split(' ');
        return (
          <div key={lineIdx} className="block overflow-hidden">
            {words.map((word, wordIdx) => {
              const chars = Array.from(word);
              return (
                <span key={wordIdx} className="inline-block whitespace-nowrap">
                  {chars.map((char, charIdx) => {
                    const delay = globalCharIdx * 30;
                    globalCharIdx++;
                    return (
                      <span
                        key={charIdx}
                        className="inline-block transition-all ease-out"
                        style={{
                          opacity: animate ? 1 : 0,
                          transform: animate ? 'translateX(0)' : 'translateX(-18px)',
                          transitionDuration: '500ms',
                          transitionDelay: `${delay}ms`,
                        }}
                      >
                        {char}
                      </span>
                    );
                  })}
                  {wordIdx < words.length - 1 && (
                    <span
                      className="inline-block transition-all ease-out"
                      style={{
                        opacity: animate ? 1 : 0,
                        transform: animate ? 'translateX(0)' : 'translateX(-18px)',
                        transitionDuration: '500ms',
                        transitionDelay: `${globalCharIdx++ * 30}ms`,
                      }}
                    >
                      {'\u00A0'}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        );
      })}
    </h1>
  );
}

// ── Nowcast Engine Visual ──────────────────────────────────────
function NowcastVisual() {
  return (
    <div className="relative h-28 w-full flex items-center justify-center bg-black/40 rounded-lg overflow-hidden border border-white/5 mb-3">
      <svg width="100%" height="100%" viewBox="0 0 200 90" className="opacity-90">
        <defs>
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        {/* Soft and Hard Waves */}
        <path d="M10,45 Q30,20 50,45 T90,45 T130,10 T150,80 T170,45" fill="none" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1.5" />
        <path d="M10,45 Q30,70 50,45 T90,45 T130,20 T145,15 T160,75 T170,45" fill="none" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1.5" />
        
        {/* Sliding CNN Kernel */}
        <rect x="0" y="5" width="20" height="80" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.2)" strokeWidth="1">
          <animate attributeName="x" values="10;170;10" dur="5s" repeatCount="indefinite" />
        </rect>
        
        {/* Threshold Level Line */}
        <line x1="10" y1="30" x2="190" y2="30" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1" strokeDasharray="3,3" />
        <text x="185" y="25" fill="rgba(255, 255, 255, 0.5)" fontSize="6" fontFamily="monospace" textAnchor="end">THR (3σ)</text>
        
        {/* Pulse detection */}
        <circle cx="130" cy="15" r="4" fill="#FFFFFF" opacity="0.6">
          <animate attributeName="r" values="3;6;3" dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;1;0.4" dur="1.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="130" cy="15" r="2.5" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

// ── TCN Forecasting Visual ─────────────────────────────────────
function ForecastVisual() {
  return (
    <div className="relative h-28 w-full flex items-center justify-center bg-black/40 rounded-lg overflow-hidden border border-white/5 mb-3">
      <svg width="100%" height="100%" viewBox="0 0 200 90">
        <rect width="100%" height="100%" fill="url(#grid)" />
        {/* Past Timeline */}
        <path d="M10,70 L40,70 L70,65 L100,70" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
        
        {/* Forecast Area (Shaded Confidence) */}
        <path d="M100,70 Q120,40 140,25 T180,60 L180,85 L100,85 Z" fill="rgba(255,255,255,0.04)" />
        
        {/* Forecast Line (Dashed) */}
        <path d="M100,70 Q120,40 140,25 T180,60" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="3,3" />
        
        {/* Vertical Separator (Now / Forecast Boundary) */}
        <line x1="100" y1="10" x2="100" y2="80" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="2,2" />
        <text x="95" y="18" fill="rgba(255,255,255,0.4)" fontSize="6" fontFamily="monospace" textAnchor="end">NOW</text>
        <text x="105" y="18" fill="#FFFFFF" fontSize="6" fontFamily="monospace">FORECAST (3h)</text>
        
        {/* Probability Label */}
        <g transform="translate(130, 20)">
          <rect x="-22" y="-12" width="44" height="15" rx="3" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
          <text x="0" y="-2" fill="#FFFFFF" fontSize="7" fontFamily="monospace" textAnchor="middle" fontWeight="bold">p &gt; 88%</text>
        </g>
      </svg>
    </div>
  );
}

// ── L1 Data Ingestion Visual ───────────────────────────────────
function PipelineVisual() {
  return (
    <div className="relative h-28 w-full flex items-center justify-center bg-black/40 rounded-lg overflow-hidden border border-white/5 mb-3">
      <svg width="100%" height="100%" viewBox="0 0 200 90">
        <rect width="100%" height="100%" fill="url(#grid)" />
        {/* Sun on left */}
        <circle cx="15" cy="45" r="16" fill="rgba(255, 255, 255, 0.05)" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1" />
        <circle cx="15" cy="45" r="12" fill="rgba(255, 255, 255, 0.1)" />
        <text x="15" y="47" fill="#FFFFFF" fontSize="5" fontFamily="monospace" textAnchor="middle">SUN</text>
        
        {/* L1 Lagrange Point */}
        <circle cx="100" cy="45" r="2" fill="rgba(255, 255, 255, 0.3)" />
        <text x="100" y="32" fill="#FFFFFF" fontSize="5" fontFamily="monospace" textAnchor="middle">ADITYA-L1</text>
        
        {/* Earth on right */}
        <circle cx="185" cy="45" r="10" fill="rgba(255, 255, 255, 0.05)" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1" />
        <text x="185" y="47" fill="rgba(255, 255, 255, 0.4)" fontSize="5" fontFamily="monospace" textAnchor="middle">EARTH</text>
        
        {/* Lagrange Orbit line */}
        <line x1="31" y1="45" x2="175" y2="45" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="2,2" />
        
        {/* Aditya-L1 satellite icon */}
        <g transform="translate(100, 45)">
          <circle cx="0" cy="0" r="3" fill="#FFFFFF" />
          <line x1="-7" y1="0" x2="7" y2="0" stroke="#FFFFFF" strokeWidth="1" />
          <rect x="-10" y="-3" width="3" height="6" fill="rgba(255,255,255,0.3)" />
          <rect x="7" y="-3" width="3" height="6" fill="rgba(255,255,255,0.3)" />
        </g>
        
        {/* Data transmission dots moving towards Earth */}
        <circle cx="110" cy="45" r="1.5" fill="#FFFFFF">
          <animate attributeName="cx" values="100;175" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="135" cy="45" r="1.5" fill="#FFFFFF">
          <animate attributeName="cx" values="125;175" dur="2s" repeatCount="indefinite" begin="0.6s" />
          <animate attributeName="opacity" values="1;0" dur="2s" repeatCount="indefinite" begin="0.6s" />
        </circle>
        <circle cx="160" cy="45" r="1.5" fill="#FFFFFF">
          <animate attributeName="cx" values="150;175" dur="2s" repeatCount="indefinite" begin="1.2s" />
          <animate attributeName="opacity" values="1;0" dur="2s" repeatCount="indefinite" begin="1.2s" />
        </circle>
      </svg>
    </div>
  );
}

// ── Spectral Hardness Visual ──────────────────────────────────
function HardnessVisual() {
  return (
    <div className="relative h-28 w-full flex items-center justify-center bg-black/40 rounded-lg overflow-hidden border border-white/5 mb-3">
      <svg width="100%" height="100%" viewBox="0 0 200 90">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255,255,255,0.4)" />
          </marker>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        {/* SoLEXS Bar (Soft X-ray) */}
        <rect x="40" y="25" width="12" height="45" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
        <rect x="40" y="45" width="12" height="25" fill="#FFFFFF" opacity="0.3">
          <animate attributeName="y" values="45;35;50;45" dur="4s" repeatCount="indefinite" />
          <animate attributeName="height" values="25;35;20;25" dur="4s" repeatCount="indefinite" />
        </rect>
        <text x="46" y="80" fill="rgba(255,255,255,0.4)" fontSize="6" fontFamily="monospace" textAnchor="middle">SOFT</text>
        
        {/* HEL1OS Bar (Hard X-ray) */}
        <rect x="70" y="25" width="12" height="45" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
        <rect x="70" y="55" width="12" height="15" fill="#FFFFFF" opacity="0.8">
          <animate attributeName="y" values="55;30;45;55" dur="4s" repeatCount="indefinite" />
          <animate attributeName="height" values="15;40;25;15" dur="4s" repeatCount="indefinite" />
        </rect>
        <text x="76" y="80" fill="rgba(255,255,255,0.4)" fontSize="6" fontFamily="monospace" textAnchor="middle">HARD</text>
        
        {/* Ratio Arrow & Calculation */}
        <line x1="90" y1="47" x2="120" y2="47" stroke="rgba(255,255,255,0.4)" strokeWidth="1" markerEnd="url(#arrow)" />
        <text x="105" y="42" fill="rgba(255,255,255,0.4)" fontSize="5" fontFamily="monospace" textAnchor="middle">RATIO</text>
        
        {/* Hardness Ratio Output Dial/Value */}
        <g transform="translate(150, 47)">
          <circle cx="0" cy="0" r="18" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
          <path d="M-12.7,12.7 A18,18 0 1,1 12.7,12.7" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeDasharray="60,100">
            <animate attributeName="strokeDasharray" values="40,100;75,100;50,100;40,100" dur="4s" repeatCount="indefinite" />
          </path>
          <text x="0" y="3" fill="#FFFFFF" fontSize="8" fontFamily="monospace" textAnchor="middle" fontWeight="bold">0.08</text>
          <text x="0" y="23" fill="rgba(255,255,255,0.4)" fontSize="5" fontFamily="monospace" textAnchor="middle">HR INDEX</text>
        </g>
      </svg>
    </div>
  );
}

// ── Workflow Step 1: Data Ingestion Visual ─────────────────────
function IngestStepVisual() {
  const [logTicks, setLogTicks] = useState([]);
  
  useEffect(() => {
    const logs = [
      'INGEST: SoLEXS CH-1 [OK]',
      'INGEST: HEL1OS CH-2 [OK]',
      'PACKET: L1_TELEMETRY_REF_409',
      'BUFFER: 1024kb/s [STREAMING]',
      'SYNC: GPS_EPOCH_LOCK',
    ];
    let idx = 0;
    const interval = setInterval(() => {
      setLogTicks(prev => {
        const next = [...prev, logs[idx]];
        if (next.length > 3) next.shift();
        return next;
      });
      idx = (idx + 1) % logs.length;
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-2 select-none">
      {/* Animation Area */}
      <div className="relative flex-1 flex items-center justify-between px-2">
        {/* Satellite */}
        <div className="flex flex-col items-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.5" className="animate-pulse">
            <path d="M12 3v18M3 12h18" />
            <circle cx="12" cy="12" r="3" fill="#000" stroke="#FFF" strokeWidth="1.5" />
            <rect x="1" y="9" width="3" height="6" fill="rgba(255,255,255,0.2)" stroke="#FFF" strokeWidth="1" />
            <rect x="20" y="9" width="3" height="6" fill="rgba(255,255,255,0.2)" stroke="#FFF" strokeWidth="1" />
          </svg>
          <span className="text-[6px] font-mono text-gray-500 mt-1">L1_PROBE</span>
        </div>
        
        {/* Signals */}
        <div className="flex-1 relative h-6 mx-2 overflow-hidden">
          {/* Signal path dashed line */}
          <svg width="100%" height="100%" className="absolute inset-0">
            <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(255,255,255,0.15)" strokeDasharray="3,3" />
            <circle cx="0" cy="50%" r="2" fill="#FFF">
              <animate attributeName="cx" values="0%;100%" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0" dur="2s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>

        {/* Earth dish */}
        <div className="flex flex-col items-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.5">
            <path d="M4 12a8 8 0 0 1 16 0" />
            <path d="M12 12v8" />
