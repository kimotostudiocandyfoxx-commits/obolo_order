'use client';

import type { HomeWork, PlanetSongView } from '@obolo/shared';
import { useEffect, useState } from 'react';
import { PIER_PATH, SHIP_FRONT } from '@/lib/planetTemplate/mercury';
import type { SkySource } from '@/lib/planetTemplate/sky';
import type { TemplateHooks } from '../PlanetTemplateHome';
import type { ProfileMiddleSlot } from '../Profile';
import { SkyExplore } from '../sky/SkyExplore';
import type { OpenWork, WorkOpener } from '../WorkView';
import { SongStage } from './SongStage';
import m from './Mercury.module.css';

/** a second tap closes (not the tap that opened it: the prototype waits 0.5 s) */
const CLOSE_AFTER_MS = 500;
/** the ship sails off to your island as it closes (popSh's close: MISLE, ×0.2, 0.35 s) */
const ISLAND = { x: 0.78, y: 0.56 };
const CLOSING_MS = 380;

/** 02 §2: a ship tapped — it comes to the front, bigger, the home zooms behind it; the disc, lyrics, title and the song */
function ShipOpen({ o, load }: { o: OpenWork; load: (w: HomeWork) => Promise<PlanetSongView | null> }) {
  const [t0] = useState(() => performance.now());
  const [at, setAt] = useState<'from' | 'front' | 'gone'>(o.from ? 'from' : 'front');
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setAt('front')));
    return () => cancelAnimationFrame(id);
  }, []);
  const close = () => {
    if (performance.now() - t0 < CLOSE_AFTER_MS || at === 'gone') return;
    setAt('gone');
    setTimeout(o.close, CLOSING_MS);
  };
  const pos =
    at === 'from' && o.from
      ? `translate3d(${o.from.x}px, ${o.from.y}px, 0) scale(${o.from.size})`
      : at === 'gone'
        ? `translate3d(${ISLAND.x * 100}cqw, ${ISLAND.y * 100}cqh, 0) scale(0.2)`
        : `translate3d(${SHIP_FRONT.x * 100}cqw, ${SHIP_FRONT.y * 100}cqh, 0) scale(${SHIP_FRONT.size})`;
  return (
    <div className={m.open} onClick={close} data-testid="work-view" data-closing={at === 'gone' ? '1' : '0'}>
      {at !== 'gone' && <SongStage work={o.work} load={load} place="home" loop />}
      {o.figure && (
        <div className={`${m.ship} ${at === 'front' ? m.bob : ''}`} style={{ transform: pos, opacity: at === 'gone' ? 0 : 1 }} data-testid="front-ship">
          <img src={o.figure} alt="" draggable={false} />
        </div>
      )}
    </div>
  );
}

/** 02 §4: a record from the beach plays where you are (the disc, the title, the lyrics); a tap closes it */
function ProfileOpen({ o, load }: { o: OpenWork; load: (w: HomeWork) => Promise<PlanetSongView | null> }) {
  const [t0] = useState(() => performance.now());
  return (
    <div className={`${m.open} ${m.clear}`} onClick={() => performance.now() - t0 > 300 && o.close()} data-testid="work-view">
      <SongStage work={o.work} load={load} place="profile" loop titleMs={1400} />
    </div>
  );
}

/** Mercury's opener: tapped on the sea, from the beach, or in the play view (the ship there is the play view's own) */
export function mercuryOpener(load: (w: HomeWork) => Promise<PlanetSongView | null>): WorkOpener {
  const MercuryOpen: WorkOpener = (o) => {
    if (o.where === 'play') return <SongStage key={o.work.id} work={o.work} load={load} place="play" loop={false} startMs={0} titleMs={PIER_PATH.titleMs} onEnd={o.onDone} />;
    if (o.where === 'profile') return <ProfileOpen key={o.work.id} o={o} load={load} />;
    return <ShipOpen key={o.work.id} o={o} load={load} />;
  };
  return MercuryOpen;
}

/** 02 §4 the beach: the person's records standing on stands in a row (scroll sideways); the one playing spins */
export const mercuryBeach: ProfileMiddleSlot = ({ person, open, current }) =>
  person.works.length ? (
    <div className={m.beach} data-testid="beach">
      {person.works.map((w, j) => {
        const d = 128 + (j % 3) * 20;
        return (
          <button key={w.id} type="button" className={`${m.rec} ${current === w.id ? m.on : ''}`} onClick={() => open(w)} aria-label={w.title || 'きょく'}>
            <span className={m.dk} style={{ width: d, height: d, backgroundImage: w.thumbUrl ? `url(${w.thumbUrl})` : undefined }} />
            <span className={m.stand} />
            <span className={m.t2}>{w.title}</span>
          </button>
        );
      })}
    </div>
  ) : (
    <div className={m.none}>まだ、ここには曲がないよ</div>
  );

/**
 * 水星's hooks for the common template (handoff 02): the opener (§2 / §3 / §4), the beach (§4), and the sky (pinch in:
 * じぶんの空, search, travel, continents) when a sky source is given. The numbers (seven ships on MSLOT, the sea only,
 * the pier at night) are lib/planetTemplate/config.ts.
 */
export function mercuryHooks(o: { load: (w: HomeWork) => Promise<PlanetSongView | null>; sky: SkySource | null; me: { name: string; figure: string | null; back: string | null; dance?: string | null } }): TemplateHooks {
  const opener = mercuryOpener(o.load);
  return {
    opener,
    profileMiddle: mercuryBeach,
    sky: o.sky ? (h) => <SkyExplore planet="mercury" source={o.sky!} me={o.me} onClose={h.close} toast={h.toast} /> : undefined,
  };
}
