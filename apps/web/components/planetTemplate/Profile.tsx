'use client';

import type { HomePlanet, HomeWork } from '@obolo/shared';
import type { ReactNode } from 'react';
import { templateConfig } from '@/lib/planetTemplate/config';
import s from './PlanetTemplate.module.css';

/** one person on the profile's top row (the first is always じぶん) */
export interface ProfilePerson {
  id: string;
  name: string;
  figure: string | null;
  works: HomeWork[];
  mine?: boolean;
}

/** what a planet's profile middle gets (02〜: Saturn's stage of kororins, Jupiter's atelier frames, Mercury's beach speakers …) */
export interface ProfileMiddle {
  planet: HomePlanet;
  person: ProfilePerson;
  /** a work tapped in the middle (opens it the planet's way) */
  open: (w: HomeWork) => void;
  /** the work opened now (from the middle), if any */
  current: string | null;
}
export type ProfileMiddleSlot = (m: ProfileMiddle) => ReactNode;

/** the default middle until the planet's own: the person's works in two columns, newest first */
export const defaultProfileMiddle: ProfileMiddleSlot = ({ person, open }) =>
  person.works.length ? (
    <div className={s.grid}>
      {person.works.map((w) => {
        const pic = w.thumbUrl || (w.kind === 'jupiter_post' ? w.url : null);
        return (
          <button key={w.id} type="button" className={s.cell} style={pic ? { backgroundImage: `url(${pic})` } : undefined} onClick={() => open(w)} aria-label={w.title || w.text || 'さくひん'}>
            {pic ? '' : w.title || w.text}
          </button>
        );
      })}
    </div>
  ) : (
    <div className={s.empty}>まだ、ここには何もないよ</div>
  );

/**
 * 3-5 the profile (per planet, the same skeleton): on top ← and the ダチ list (じぶん first, the one shown lit up);
 * at the bottom the owner's big figure (spilling over the edge) with their name beside it; the middle is the planet's.
 */
export function Profile({
  planet,
  people,
  current,
  onPick,
  onBack,
  middle = defaultProfileMiddle,
  onOpen,
  openedId = null,
}: {
  planet: HomePlanet;
  people: ProfilePerson[];
  current: string;
  onPick: (id: string) => void;
  onBack: () => void;
  middle?: ProfileMiddleSlot;
  onOpen: (person: ProfilePerson, w: HomeWork) => void;
  openedId?: string | null;
}) {
  const cfg = templateConfig(planet);
  const who = people.find((p) => p.id === current) ?? people[0];
  if (!who) return null;
  return (
    <div className={s.prof} style={{ backgroundImage: `url(${cfg.art.profile})` }} data-testid="profile">
      <div className={s.profTop}>
        <button type="button" className={s.profBack} onClick={onBack} aria-label="もどる">
          ←
        </button>
        <div className={s.profList}>
          {people.map((p) => (
            <button key={p.id} type="button" className={p.id === who.id ? s.cur : ''} onClick={() => onPick(p.id)} aria-current={p.id === who.id}>
              {p.figure ? <img src={p.figure} alt="" draggable={false} /> : <i className={s.blank} />}
              <span>{p.mine ? 'じぶん' : p.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className={s.profMid}>{middle({ planet, person: who, open: (w) => onOpen(who, w), current: openedId })}</div>
      <div className={s.profWho}>
        {who.figure ? <img src={who.figure} alt="" draggable={false} /> : null}
        <span>{who.name}</span>
      </div>
    </div>
  );
}
