'use client';

import type { HomePlanet } from '@obolo/shared';
import { useRef, useState } from 'react';
import { planetAtSlide, SWITCH_GAIN, SWITCH_MIN_PX, SWITCH_ORDER } from '@/lib/planetTemplate/layout';
import { templateConfig } from '@/lib/planetTemplate/config';
import s from './PlanetTemplate.module.css';

const ITEM = 64;

/**
 * 3-4 the top bar: the planet's icon and name at the top left — nothing else (no explainer, no ？, no 推し: M-R291).
 * Touching the icon opens the strip of planets; sliding the finger moves it (1.6×) and the planet in its middle when the
 * finger is released is the one switched to. A touch without a slide leaves the strip open to tap a planet.
 */
export function TopBar({ planet, onSwitch }: { planet: HomePlanet; onSwitch?: (p: HomePlanet) => void }) {
  const cfg = templateConfig(planet);
  const [open, setOpen] = useState(false);
  const [dx, setDx] = useState(0);
  const [sliding, setSliding] = useState(false);
  const drag = useRef<{ x: number; id: number } | null>(null);
  const i0 = SWITCH_ORDER.indexOf(planet);
  const mid = planetAtSlide(planet, dx, ITEM);
  const offset = -(i0 * ITEM + ITEM / 2) + dx * SWITCH_GAIN;
  const choose = (p: HomePlanet) => {
    setOpen(false);
    setDx(0);
    if (p !== planet) onSwitch?.(p);
  };
  return (
    <>
      <div className={s.top}>
        <button
          type="button"
          className={s.icon}
          aria-label={`${cfg.name}（ほかの星へ）`}
          onPointerDown={(e) => {
            e.preventDefault();
            drag.current = { x: e.clientX, id: e.pointerId };
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              // a synthetic event has no capture
            }
            setDx(0);
            setSliding(true);
            setOpen(true);
          }}
          onPointerMove={(e) => {
            if (drag.current?.id === e.pointerId) setDx(e.clientX - drag.current.x);
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            drag.current = null;
            setSliding(false);
            if (!d) return;
            const moved = e.clientX - d.x;
            if (Math.abs(moved) < SWITCH_MIN_PX) return setDx(0);
            choose(planetAtSlide(planet, moved, ITEM));
          }}
          onPointerCancel={() => {
            drag.current = null;
            setSliding(false);
            setDx(0);
          }}
        >
          <img src={cfg.icon} alt="" draggable={false} />
        </button>
        <span className={s.name}>{cfg.name}</span>
      </div>
      {open && (
        <div className={s.stripShade} onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}>
        <div className={s.strip}>
          <div className={`${s.stripRow} ${sliding ? '' : s.settle}`} style={{ transform: `translateX(${offset}px)` }}>
            {SWITCH_ORDER.map((p) => {
              const c = templateConfig(p);
              return (
                <button key={p} type="button" className={`${s.stripItem} ${p === mid ? s.mid : ''}`} onClick={() => choose(p)} aria-current={p === planet}>
                  <img src={c.icon} alt="" draggable={false} />
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
        </div>
      )}
    </>
  );
}
