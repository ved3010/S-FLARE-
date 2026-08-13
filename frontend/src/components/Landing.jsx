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
