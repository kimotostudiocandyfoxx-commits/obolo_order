'use client';

import { ORBIT_ORDER, PLANETS, type PlanetId } from '@obolo/shared';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { useI18n } from '@/lib/i18n/client';
import { PlanetSphere } from './PlanetSphere';

/**
 * Home map. Earth in the centre; Moon at 12 o'clock; then clockwise
 * Saturn → Jupiter → Mercury → Venus → Mars → Uranus → Neptune (client layout, 2026-10-03).
 * Everything is expressed in % of a square stage so it fits any portrait phone.
 */
const ORBIT_R = 38; // % of stage
const EARTH = 29; // % of stage
const BASE = 18.5; // % of stage for size=1 orbiting planets

export function SolarSystem() {
  const { m } = useI18n();
  return (
    <div
      className="relative mx-auto square"
      style={{ width: 'min(100vw - 24px, 100svh - 210px, 620px)', containerType: 'inline-size' } as CSSProperties}
    >
      {/* orbit ring */}
      <div
        className="absolute rounded-full border border-dashed border-sky-200/20"
        style={{ inset: `${50 - ORBIT_R}%` }}
        aria-hidden
      />
      <div
        className="absolute rounded-full"
        style={{ inset: `${50 - ORBIT_R - 6}%`, background: 'radial-gradient(circle, transparent 60%, rgba(143,216,255,0.05) 75%, transparent 80%)' }}
        aria-hidden
      />

      {/* Earth */}
      <PlanetLink id="earth" x={50} y={50} sizePct={EARTH} label={m.planets.earth.name} big />

      {/* Orbiting planets */}
      {ORBIT_ORDER.map((id, i) => {
        const a = ((-90 + i * 45) * Math.PI) / 180;
        const x = 50 + ORBIT_R * Math.cos(a);
        const y = 50 + ORBIT_R * Math.sin(a);
        return (
          <PlanetLink
            key={id}
            id={id}
            x={x}
            y={y}
            sizePct={BASE * PLANETS[id].size}
            label={m.planets[id].name}
            delay={i * 0.6}
          />
        );
      })}
    </div>
  );
}

function PlanetLink({
  id,
  x,
  y,
  sizePct,
  label,
  big,
  delay = 0,
}: {
  id: PlanetId;
  x: number;
  y: number;
  sizePct: number;
  label: string;
  big?: boolean;
  delay?: number;
}) {
  const live = PLANETS[id].demo === 'live';
  return (
    <Link
      href={PLANETS[id].route}
      className={`group absolute flex flex-col items-center ${big ? '' : 'float'}`}
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)', animationDelay: `${delay}s` }}
      aria-label={label}
    >
      <span className={`block transition-transform duration-200 group-active:scale-90 ${big ? 'earth-glow' : ''}`}>
        <PlanetSphere id={id} size={`${sizePct}cqw`} />
      </span>
      <span
        className="mt-[1.2cqw] whitespace-nowrap rounded-full px-[1.6cqw] py-[0.3cqw] font-bold text-white/90"
        style={{ fontSize: big ? 'clamp(12px, 3.8cqw, 18px)' : 'clamp(10px, 3.1cqw, 15px)', background: 'rgba(8,11,28,0.55)' }}
      >
        {label}
        {live && <span className="ml-1 inline-block h-[1.4cqw] w-[1.4cqw] min-h-1.5 min-w-1.5 rounded-full bg-emerald-300 align-middle" />}
      </span>
    </Link>
  );
}
