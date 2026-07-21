import { useState, useEffect, useRef, useCallback } from 'react';
import IndiaImpactMap from './IndiaImpactMap';
import ModelExplanation from './ModelExplanation';
import { useLiveState } from '../lib/data';

// ─── Inline SVG Icons ───────────────────────────────────

function IconNavigation() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 9v-1M12 16v1M9 12H8M16 12h1" />
    </svg>
  );
}

function IconComms() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20V10" />
      <path d="M18 20V4" />
      <path d="M6 20v-4" />
      <path d="M12 10c0-3.5 3-6 6-6" />
      <path d="M12 10c0-2 1.5-4 3.5-4" />
      <circle cx="12" cy="7" r="1" fill="currentColor" />
    </svg>
  );
}

function IconDefence() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

function IconWeather() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      <path d="M12 8a4 4 0 0 0 0 8" fill="currentColor" opacity="0.15" />
    </svg>
  );
}

function IconPower() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function IconCrewedSpace() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="12" rx="10" ry="4" />
      <path d="M12 2a4 10 0 0 1 0 20 4 10 0 0 1 0-20" />
      <rect x="4" y="10" width="16" height="4" rx="1" opacity="0.2" fill="currentColor" />
      <circle cx="8" cy="12" r="0.5" fill="currentColor" />
      <circle cx="16" cy="12" r="0.5" fill="currentColor" />
    </svg>
  );
}

function IconScience() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v4M12 19v4" />
      <path d="M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83" />
      <path d="M1 12h4M19 12h4" />
      <path d="M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </svg>
  );
}

const CATEGORY_ICONS = {
  'Navigation & Positioning': IconNavigation,
  'Communications': IconComms,
  'Defence & Intelligence': IconDefence,
  'Weather & Earth Observation': IconWeather,
  'Power Grid & Ground Infrastructure': IconPower,
  'Space Station & Crewed Missions': IconCrewedSpace,
  'Scientific Instruments': IconScience,
};

const RISK_COLORS = {
  low:      { bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.25)', text: '#34D399', label: 'LOW' },
  moderate: { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.25)', text: '#FBBF24', label: 'MODERATE' },
  high:     { bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.25)', text: '#FB923C', label: 'HIGH' },
  critical: { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)', text: '#F87171', label: 'CRITICAL' },
};

// ─── Skeleton Card ──────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="impact-card impact-skeleton">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-white/[0.06] animate-pulse" />
        <div className="flex-1">
          <div className="h-3 w-32 bg-white/[0.06] rounded animate-pulse mb-2" />
          <div className="h-2 w-16 bg-white/[0.06] rounded animate-pulse" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-2 w-full bg-white/[0.06] rounded animate-pulse" />
        <div className="h-2 w-4/5 bg-white/[0.06] rounded animate-pulse" />
        <div className="h-2 w-3/5 bg-white/[0.06] rounded animate-pulse" />
      </div>
      <div className="flex gap-2 mt-4">
        <div className="h-5 w-14 bg-white/[0.06] rounded-full animate-pulse" />
        <div className="h-5 w-18 bg-white/[0.06] rounded-full animate-pulse" />
        <div className="h-5 w-12 bg-white/[0.06] rounded-full animate-pulse" />
      </div>
    </div>
  );
}

// ─── Mission Status Row ─────────────────────────────────

function AdityaMissionStatus({ systemStatus }) {
  const statusItems = [
    { label: 'Pipeline', value: systemStatus.pipeline || '—', ok: systemStatus.pipeline === 'Operational' },
    { label: 'PRADAN Sync', value: systemStatus.pradanSync || '—', ok: systemStatus.pradanSync === 'Healthy' },
    { label: 'AL1 Sync', value: systemStatus.al1Sync || '—', ok: systemStatus.al1Sync === 'Healthy' },
    { label: 'Data Latency', value: systemStatus.dataLatency || '—', ok: true },
    { label: 'Model', value: systemStatus.modelVersion || '—', ok: true },
  ];

  return (
    <div className="tcn-status-grid">
      {statusItems.map((item) => (
        <div key={item.label} className="tcn-status-item">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${item.ok ? 'bg-emerald-400' : 'bg-red-400'}`} style={item.ok ? { boxShadow: '0 0 6px rgba(52,211,153,0.5)' } : { boxShadow: '0 0 6px rgba(248,113,113,0.5)' }} />
            <span className="text-[7px] font-mono font-bold text-white/35 uppercase tracking-wider">{item.label}</span>
          </div>
          <span className="text-[10px] font-mono font-semibold text-white/80">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── TCN Forecast Status Card ───────────────────────────

function TcnForecastCard({ forecast, flareClass, systemStatus }) {
  const prob = forecast.probability ?? 0;
  const nextClass = forecast.nextClass || '—';
  const leadTime = forecast.leadTime ?? 0;
  const tcnConf = forecast.tcnConfidence ?? 0;

  const probColor = prob >= 70 ? '#F87171' : prob >= 40 ? '#FBBF24' : '#34D399';
