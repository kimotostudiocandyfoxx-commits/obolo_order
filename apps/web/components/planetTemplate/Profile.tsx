'use client';

import type { HomePlanet, HomeWork } from '@obolo/shared';
import type { ReactNode } from 'react';
import { templateConfig } from '@/lib/planetTemplate/config';
import { swallowNextClick } from '@/lib/planetTemplate/pinch';
import s from './PlanetTemplate.module.css';

/** one person on the profile's top row (the first is always じぶん) */
export interface ProfilePerson {
  id: string;
  name: string;
  figure: string | null;
  /** Saturn: the chibi that pops out of their kororins */
  chibi?: string | null;
  works: HomeWork[];
  mine?: boolean;
  /** client 2026-11-28: a resident with the ♡ off — not on the home any more, still here (dimmed) to give the ♡ back */
  rest?: boolean;
}

/** client 2026-11-28: the ♡ of a resident on their profile (the residents are oshi from the start); null: no ♡ (members, ダチ) */
export type ProfileHeart = (p: ProfilePerson) => { on: boolean; toggle: () => void } | null;

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
  full = false,
  onOpen,
  openedId = null,
  heart,
}: {
  heart?: ProfileHeart;
  planet: HomePlanet;
  people: ProfilePerson[];
  current: string;
  onPick: (id: string) => void;
  onBack: () => void;
  middle?: ProfileMiddleSlot;
  /** the middle takes the whole screen (under the top row and the name): Saturn's 2D stage */
  full?: boolean;
  onOpen: (person: ProfilePerson, w: HomeWork) => void;
  openedId?: string | null;
}) {
  const cfg = templateConfig(planet);
  const who = people.find((p) => p.id === current) ?? people[0];
  if (!who) return null;
  const hearted = heart?.(who) ?? null;
  return (
    <div className={s.prof} style={{ backgroundImage: `url(${cfg.art.profile})` }} data-testid="profile" data-planet={planet}>
      <div className={s.profTop}>
        {/* M-R344: one press always goes back — it answers the first touch (the click after it is swallowed so it cannot
            land on the home underneath), and the button's reach is wider than its circle; the click stays for keyboards */}
        <button
          type="button"
          className={s.profBack}
          onPointerDown={(e) => {
            if (e.button > 0) return;
            e.stopPropagation();
            swallowNextClick();
            onBack();
          }}
          onClick={onBack}
          aria-label="もどる"
          data-testid="profile-back"
        >
          ←
        </button>
        <div className={s.profList}>
          {people.map((p) => (
            <button key={p.id} type="button" className={`${p.id === who.id ? s.cur : ''} ${p.rest ? s.rest : ''}`} onClick={() => onPick(p.id)} aria-current={p.id === who.id} data-rest={p.rest ? '1' : undefined}>
              {p.figure ? <img src={p.figure} alt="" draggable={false} /> : <i className={s.blank} />}
              <span>{p.mine ? 'じぶん' : p.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className={`${s.profMid} ${full ? s.profFull : ''}`}>{middle({ planet, person: who, open: (w) => onOpen(who, w), current: openedId })}</div>
      <div className={s.profWho}>
        {who.figure ? <img src={who.figure} alt="" draggable={false} /> : null}
        <span>{who.name}</span>
        {hearted && (
          <button
            type="button"
            className={`${s.heartBtn} ${hearted.on ? s.on : ''}`}
            onClick={hearted.toggle}
            aria-label={hearted.on ? '推しをはずす' : '推す'}
            aria-pressed={hearted.on}
            data-testid="profile-oshi"
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M12 20.3s-7.6-4.6-7.6-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.6 2.7c0 5.6-7.6 10.2-7.6 10.2z" />
            </svg>
            <b>{hearted.on ? '推し' : '推す'}</b>
          </button>
        )}
      </div>
    </div>
  );
}
