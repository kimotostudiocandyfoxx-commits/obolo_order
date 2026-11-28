'use client';

import type { GameView, HomeWork, WorkTags } from '@obolo/shared';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { GameFull } from '@/components/atelier/GamePlay';
import { castOfWork } from '@/lib/planetTemplate/castWorks';
import { templateConfig } from '@/lib/planetTemplate/config';
import {
  bookOpening,
  caseFace,
  FIVE,
  fiveTitleOf,
  fiveTitleStyle,
  goodsKindOfWork,
  isAudioUrl,
  OPEN_MS,
  RADIO_VOICE_MS,
  SHELF_ASPECT,
  titleFit,
  waveBars,
  WHO_CORNER,
  WHO_NAME,
  type FiveKind,
  type FivePlanet,
} from '@/lib/planetTemplate/five';
import { letterKind } from '@/lib/planetTemplate/mercury';
import { CastViewer } from '../cast/CastViewer';
import { useTitleFont } from '../mercury/SongStage';
import type { TemplateHooks } from '../PlanetTemplateHome';
import type { ProfileMiddleSlot } from '../Profile';
import type { OpenWork, WorkOpener } from '../WorkView';
import f from './Five.module.css';
import { GoodsMock } from './GoodsMock';

/** after two frames (so a transition runs from where it was placed) */
function useNextFrame() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
    return () => cancelAnimationFrame(id);
  }, []);
  return on;
}

/** the title under the work, in the work's own font (05 共通), letter by letter; no label, no by (M-R310) */
export function FiveTitle({ kind, title, tags, className = '' }: { kind: FiveKind; title: string; tags?: WorkTags | null; className?: string }) {
  const st = fiveTitleStyle(kind, title, tags);
  useTitleFont(st.family, title);
  // a long title wraps to two lines, and shrinks when two are not enough (never off the screen); the book's own page title is the page's
  const [w, setW] = useState(390);
  useEffect(() => {
    const fit = () => setW(window.innerWidth || 390);
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  if (!title) return null;
  const fit = className ? { lines: 1 as const, size: null } : titleFit(title, w);
  return (
    <div
      className={`${f.ttl} ${f[`m_${st.motion}`] ?? ''} ${fit.lines === 2 ? f.two : ''} ${className}`}
      style={{ fontFamily: `'${st.font}', var(--font-sans)`, ...(fit.size ? { fontSize: fit.size } : {}) }}
      data-testid="five-title"
      data-lines={fit.lines}
    >
      {[...title].map((ch, i) => (
        <span key={i} className={f[letterKind(ch)]} style={{ animationDelay: `${(0.25 + i * 0.05).toFixed(2)}s` }}>
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </div>
  );
}

const picOf = (w: HomeWork) => w.thumbUrl || null;

/**
 * 05 how a work opens, per planet (the prototype's viewer): Mars an MV on a square screen with its sound, the title under
 * it; Venus the show's thumbnail (not a spinning record), ON AIR and a wave, the show in its maker's voice; Uranus the art
 * printed on a tote bag; Pluto an open book (the picture on the left page, the title and how it begins on the right);
 * Neptune the game's case and a blinking PRESS START (pressed on the home or a shelf: the game itself, in its sandbox).
 * `playing`: in ▶ (Mars: once to the end, then `onDone`); elsewhere an MV loops until it is closed.
 */
export function FiveViewer({
  planet,
  work,
  playing = false,
  closing = false,
  onDone,
  onStart,
  onFinish,
  top,
}: {
  planet: FivePlanet;
  work: HomeWork;
  playing?: boolean;
  closing?: boolean;
  onDone?: () => void;
  /** Neptune: PRESS START (none: it only blinks) */
  onStart?: () => void;
  /** the cast's picture book has closed and flown away (handoff 08 §3): the work closes */
  onFinish?: () => void;
  /** where it opens instead of the planet's own place (the sky: lower, under the maker's name, 07 §3) */
  top?: number;
}) {
  const def = FIVE[planet];
  const on = useNextFrame();
  const title = fiveTitleOf(work);
  const pic = picOf(work);
  const done = useRef(onDone);
  done.current = onDone;
  // Venus: the show starts a moment after the viewer (in its maker's voice)
  const [voice, setVoice] = useState(false);
  useEffect(() => {
    if (def.kind !== 'radio' || !work.url) return;
    const id = setTimeout(() => setVoice(true), RADIO_VOICE_MS);
    return () => clearTimeout(id);
  }, [def.kind, work.url]);
  const style = { top: `${(top ?? def.top) * 100}%`, ['--glow' as string]: def.glow } as CSSProperties;
  const cls = `${f.vw} ${f[def.kind]} ${on && !closing ? f.on : ''}`;
  // the cast's own works (handoff 08 §3 / §6): the film under the song, the goods' picture, the picture book, the tap game
  const cast = castOfWork(work)?.cast;
  if (cast && planet !== 'venus')
    return <CastViewer planet={planet} cast={cast} className={`${f.vw} ${on && !closing ? f.on : ''}`} screenClass={f.scr} style={style} playing={playing} onDone={() => done.current?.()} onFinish={onFinish} title={<FiveTitle kind={def.kind} title={title} tags={work.tags} />} />;
  if (def.kind === 'mv') {
    const audio = isAudioUrl(work.url);
    return (
      <div className={cls} style={style} data-testid="five-viewer" data-kind="mv">
        <div className={f.scr} data-testid="mv-screen">
          {audio || !work.url ? <i style={{ backgroundImage: pic ? `url(${pic})` : undefined }} /> : <video src={work.url} poster={pic ?? undefined} autoPlay playsInline loop={!playing} onEnded={() => done.current?.()} onError={() => done.current?.()} />}
        </div>
        {audio && work.url && <audio src={work.url} autoPlay loop={!playing} onEnded={() => done.current?.()} onError={() => done.current?.()} />}
        <FiveTitle kind="mv" title={title} tags={work.tags} />
      </div>
    );
  }
  if (def.kind === 'radio')
    return (
      <div className={cls} style={style} data-testid="five-viewer" data-kind="radio">
        <div className={f.thumb} style={{ backgroundImage: pic ? `url(${pic})` : undefined }} data-testid="radio-thumb" />
        <span className={f.air}>ON AIR</span>
        <div className={f.wave} aria-hidden>
          {waveBars().map((b, i) => (
            <b key={i} style={{ height: b.h, animationDelay: `${b.delay}s` }} />
          ))}
        </div>
        <FiveTitle kind="radio" title={title} tags={work.tags} />
        {voice && work.url && <audio src={work.url} autoPlay />}
      </div>
    );
  if (def.kind === 'goods')
    return (
      <div className={cls} style={style} data-testid="five-viewer" data-kind="goods">
        {/* story 2026-11-25: the art on its own kind (トート, Tシャツ, ステッカー, アクスタ, マグカップ, 缶バッジ), drawn in code */}
        <div className={f.goods} data-testid="tote">
          <GoodsMock kind={goodsKindOfWork(work)} art={pic} width={240} sway />
        </div>
        <FiveTitle kind="goods" title={title} tags={work.tags} />
      </div>
    );
  if (def.kind === 'book') {
    const lines = bookOpening(work.text);
    return (
      <div className={cls} style={style} data-testid="five-viewer" data-kind="book">
        <div className={f.book} data-testid="open-book">
          <div className={`${f.pg} ${f.l} ${pic ? '' : f.plain}`} style={{ backgroundImage: pic ? `url(${pic})` : undefined }}>
            {!pic && <span>{title}</span>}
          </div>
          <div className={`${f.pg} ${f.r}`}>
            <FiveTitle kind="book" title={title} tags={work.tags} className={f.h4} />
            {lines.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      </div>
    );
  }
  const face = caseFace(work.id, title);
  return (
    <div className={cls} style={style} data-testid="five-viewer" data-kind="game">
      <div className={f.case} data-testid="game-case">
        <i style={pic ? { backgroundImage: `url(${pic})` } : { backgroundImage: `radial-gradient(circle at 30% 25%, ${face.a}, ${face.b} 70%)` }}>{!pic && <em>{face.glyph}</em>}</i>
        <b>OBOLO GAMES</b>
      </div>
      <FiveTitle kind="game" title={title} tags={work.tags} />
      {onStart ? (
        <button
          type="button"
          className={f.start}
          onClick={(e) => {
            e.stopPropagation();
            onStart();
          }}
          data-testid="press-start"
        >
          PRESS START
        </button>
      ) : (
        <div className={f.start} data-testid="press-start">
          PRESS START
        </div>
      )}
    </div>
  );
}

/** what the five's hooks need from the page: a flown game to play (GET /moon/games/:id; the sample: a demo game) */
export interface FiveDeps {
  game?: (w: HomeWork) => Promise<GameView | null>;
}

/** Neptune: PRESS START → the game full screen in its sandbox (a friend's never reports itself broken) */
function useGame(planet: FivePlanet, deps: FiveDeps, w: HomeWork) {
  const [game, setGame] = useState<GameView | null>(null);
  const start = planet === 'neptune' && deps.game ? () => void deps.game!(w).then((g) => g && setGame(g)) : undefined;
  // the game is portalled over everything; its taps must not close the work under it (React bubbles through portals)
  const full = game ? (
    <div onClick={(e) => e.stopPropagation()}>
      <GameFull game={game} own={w.rel === 'own'} onClose={() => setGame(null)} />
    </div>
  ) : null;
  return { start, full };
}

/** a tap closes only after a moment (popG5's 300 ms), then the viewer goes and the figure flies back to your place */
function useClose(onClosed: () => void, after: number) {
  const [t0] = useState(() => performance.now());
  const [closing, setClosing] = useState(false);
  const closed = useRef(onClosed);
  closed.current = onClosed;
  const close = () => {
    if (closing || performance.now() - t0 < OPEN_MS.closeAfter) return;
    setClosing(true);
    setTimeout(() => closed.current(), after);
  };
  return { closing, close };
}

const at = (p: { x: number; y: number }) => `translate3d(${p.x * 100}cqw, ${p.y * 100}cqh, 0)`;

/** popG5: the figure tapped goes to the bottom left with its name; the viewer opens; a tap closes and it flies home */
function HomeOpen({ planet, o, deps }: { planet: FivePlanet; o: OpenWork; deps: FiveDeps }) {
  const place = templateConfig(planet).place;
  const c = useClose(o.close, OPEN_MS.viewerOut + OPEN_MS.toPlace);
  const moved = useNextFrame();
  const [named, setNamed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setNamed(true), OPEN_MS.name);
    return () => clearTimeout(id);
  }, []);
  const g = useGame(planet, deps, o.work);
  const from = o.from ? `translate3d(${o.from.x}px, ${o.from.y}px, 0) scale(${o.from.size})` : `${at(WHO_CORNER)} scale(${WHO_CORNER.size})`;
  const pos = c.closing ? `${at(place)} scale(0.25)` : moved ? `${at(WHO_CORNER)} scale(${WHO_CORNER.size})` : from;
  return (
    <div className={f.open} onClick={c.close} data-testid="work-view" data-planet={planet} data-closing={c.closing ? '1' : '0'}>
      <FiveViewer planet={planet} work={o.work} closing={c.closing} onStart={g.start} onFinish={c.close} />
      {o.figure && (
        <div className={`${f.fly} ${c.closing ? f.gone : ''}`} style={{ transform: pos }} data-testid="front-figure">
          <img src={o.figure} alt="" draggable={false} />
        </div>
      )}
      {named && !c.closing && (
        <div className={f.who} style={{ left: `${WHO_NAME.x * 100}%`, top: `${WHO_NAME.y * 100}%` }} data-testid="five-who">
          {o.person.name}
        </div>
      )}
      {g.full}
    </div>
  );
}

/** playG5: in ▶ the visitor is the play view's own; the viewer opens over the view (Mars: until its MV has played) */
function PlayOpen({ planet, o }: { planet: FivePlanet; o: OpenWork }) {
  return (
    <div className={`${f.open} ${f.inPlay}`} data-testid="work-view" data-planet={planet}>
      <FiveViewer planet={planet} work={o.work} playing onDone={o.onDone} />
    </div>
  );
}

/** a work on the shelf tapped: the same viewer over the profile; a tap closes it */
function ProfileOpen({ planet, o, deps }: { planet: FivePlanet; o: OpenWork; deps: FiveDeps }) {
  const c = useClose(o.close, OPEN_MS.viewerOut);
  const g = useGame(planet, deps, o.work);
  return (
    <div className={`${f.open} ${f.clear}`} onClick={c.close} data-testid="work-view" data-planet={planet}>
      <FiveViewer planet={planet} work={o.work} closing={c.closing} onStart={g.start} onFinish={c.close} />
      {g.full}
    </div>
  );
}

export function fiveOpener(planet: FivePlanet, deps: FiveDeps = {}): WorkOpener {
  const Opener: WorkOpener = (o) => {
    if (o.where === 'play') return <PlayOpen key={o.work.id} planet={planet} o={o} />;
    if (o.where === 'profile') return <ProfileOpen key={o.work.id} planet={planet} o={o} deps={deps} />;
    return <HomeOpen key={o.work.id} planet={planet} o={o} deps={deps} />;
  };
  return Opener;
}

/** what each planet's shelf is called (for the screen reader) and says when it is empty */
const SHELF: Record<FiveKind, { label: string; none: string }> = {
  mv: { label: 'MV', none: 'まだ、ここにはMVがないよ' },
  radio: { label: '番組', none: 'まだ、ここには番組がないよ' },
  goods: { label: 'グッズ', none: 'まだ、ここにはグッズがないよ' },
  book: { label: '本', none: 'まだ、ここには本がないよ' },
  game: { label: 'ゲーム', none: 'まだ、ここにはゲームがないよ' },
};

/**
 * 05 the profile's middle (the prototype's pgal per kind): Mars the MVs' thumbnails, Venus the shows' thumbnails, Uranus
 * the goods on shelves (each a small tote), Pluto a bookshelf (the covers as spines and faces), Neptune the cases on
 * shelves. Two columns, scrolling down; a tap opens the work the planet's way.
 */
export function fiveShelf(planet: FivePlanet): ProfileMiddleSlot {
  const kind = FIVE[planet].kind;
  const Shelf: ProfileMiddleSlot = ({ person, open, current }) =>
    person.works.length ? (
      <div className={`${f.gal} ${f[`g_${kind}`]}`} data-testid="five-shelf" data-kind={kind}>
        {person.works.map((w) => {
          const pic = picOf(w);
          const title = fiveTitleOf(w);
          const face = kind === 'game' && !pic ? caseFace(w.id, title) : null;
          return (
            <button
              key={w.id}
              type="button"
              className={`${f.fr} ${current === w.id ? f.cur : ''}`}
              style={{ aspectRatio: String(SHELF_ASPECT[kind]), backgroundImage: kind === 'goods' ? undefined : pic ? `url(${pic})` : face ? `radial-gradient(circle at 30% 25%, ${face.a}, ${face.b} 70%)` : undefined }}
              onClick={() => open(w)}
              aria-label={title || SHELF[kind].label}
            >
              {kind === 'goods' && <GoodsMock kind={goodsKindOfWork(w)} art={pic} width={118} />}
              {(kind === 'book' || kind === 'game') && !pic && <em>{face?.glyph ?? title}</em>}
            </button>
          );
        })}
      </div>
    ) : (
      <div className={f.none}>{SHELF[kind].none}</div>
    );
  return Shelf;
}

/** the five's hooks for the common template (handoff 05): their opener and the profile's shelf; the rest is the template's */
export function fiveHooks(planet: FivePlanet, deps: FiveDeps = {}): TemplateHooks {
  return { opener: fiveOpener(planet, deps), profileMiddle: fiveShelf(planet) };
}
