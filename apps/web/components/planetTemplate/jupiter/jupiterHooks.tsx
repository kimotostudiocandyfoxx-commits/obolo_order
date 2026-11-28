'use client';

import type { FigureWings, HomeWork, WorkTags } from '@obolo/shared';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
  artTitleOf,
  artTitleStyle,
  BF_CORNER,
  BF_NAME,
  CAMERAS,
  flapSeconds,
  frameTilt,
  JTREE,
  KAKEJIKU,
  pick,
  PORCH_HOLD_MS,
  SCROLL_MS,
  SHAKE_AT,
  scrollLayout,
  TITLE_FIRST_S,
  TITLE_GAP_S,
  wingCutOf,
  wingParts,
  type Camera,
  type Kakejiku,
} from '@/lib/planetTemplate/jupiter';
import { letterKind } from '@/lib/planetTemplate/mercury';
import { useCastVoice } from '../cast/CastViewer';
import { useTitleFont } from '../mercury/SongStage';
import type { TemplateHooks } from '../PlanetTemplateHome';
import type { ProfileMiddleSlot } from '../Profile';
import type { FigureSlot, OpenWork, WorkOpener } from '../WorkView';
import j from './Jupiter.module.css';

/** §1 a butterfly: only its wings flap, from the body's edges; the body is drawn over them (never the face behind a wing) */
export function Wings({ src, i, fill = false, wings }: { src: string; i: number; fill?: boolean; wings?: FigureWings | null }) {
  const p = wingParts(wingCutOf(src, wings));
  return (
    <div className={`${j.wg} ${fill ? j.fill : ''}`} style={{ ['--fl' as string]: `${flapSeconds(i)}s` }} data-testid="wings">
      <img className={j.wl} src={src} alt="" draggable={false} style={{ clipPath: p.left.clip, transformOrigin: p.left.origin }} />
      <img className={j.wr} src={src} alt="" draggable={false} style={{ clipPath: p.right.clip, transformOrigin: p.right.origin }} />
      <img src={src} alt="" draggable={false} style={{ clipPath: p.body.clip }} />
    </div>
  );
}
export const butterfly: FigureSlot = ({ src, i, fill, wings }) => <Wings src={src} i={i} fill={fill} wings={wings} />;

/** after two frames (so a transition runs from where it was placed) */
function useNextFrame() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
    return () => cancelAnimationFrame(id);
  }, []);
  return on;
}

/**
 * §2 the art in a hanging scroll: one of the four scrolls, the camera coming in one of five ways (both at random), the
 * paper unrolling top to bottom with the art on it at 95% of the screen's width; the title laid over the art in the art's
 * own font and entrance. No label, no 「〜のアート」, no by (M-R310). `closing`: it rolls up fast.
 */
export function ScrollArt({ art, title, tags, closing, kk, cam }: { art: string | null; title: string; tags?: WorkTags | null; closing: boolean; kk?: Kakejiku; cam?: Camera }) {
  const [k] = useState(() => kk ?? pick(KAKEJIKU, Math.random()));
  const [c] = useState(() => cam ?? pick(CAMERAS, Math.random()));
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ W: number; H: number } | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (el) setSize({ W: el.clientWidth || 390, H: el.clientHeight || 844 });
  }, []);
  const on = useNextFrame() && !!size;
  const [shake, setShake] = useState(false);
  useEffect(() => {
    const at = SHAKE_AT[c];
    if (!on || at == null) return;
    const a = setTimeout(() => setShake(true), at);
    const b = setTimeout(() => setShake(false), at + 520);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [on, c]);
  const st = artTitleStyle(title, tags);
  useTitleFont(st.family, title);
  const L = size ? scrollLayout(k, size.W, size.H) : null;
  return (
    <div ref={box} className={`${j.layer} ${shake ? j.shake : ''}`}>
      {L && (
        <div
          className={`${j.scroll} ${j[`cam_${c}`]} ${on && !closing ? j.on : ''} ${closing ? j.closing : ''}`}
          style={{ width: L.width, top: L.top }}
          data-testid="art-scroll"
          data-camera={c}
          data-kakejiku={KAKEJIKU.indexOf(k) + 1}
        >
          <div className={j.kk}>
            <img src={k.src} alt="" draggable={false} />
            <div className={j.art} style={{ left: `${L.art.left}%`, top: `${L.art.top}%`, width: `${L.art.width}%`, height: `${L.art.height}%`, backgroundImage: art ? `url(${art})` : undefined }} data-testid="art">
              {title && (
                <div className={`${j.ot} ${j[`a_${st.motion}`]} ${on && !closing ? j.on : ''}`} style={{ fontFamily: `'${st.font}', var(--font-sans)` }} data-testid="art-title">
                  {[...title].map((ch, i) => (
                    <span key={i} className={j[letterKind(ch)]} style={{ transitionDelay: `${(TITLE_FIRST_S + i * TITLE_GAP_S).toFixed(2)}s`, ['--gx' as string]: `${(i % 2 ? -1 : 1) * 8}px` }}>
                      {ch === ' ' ? ' ' : ch}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const artOf = (w: HomeWork) => w.url || w.thumbUrl || null;
const px = (p: { x: number; y: number }) => `translate3d(${p.x * 100}cqw, ${p.y * 100}cqh, 0)`;

/** the scroll shows after SCROLL_MS.open; a second tap rolls it up; `done` after it has rolled up (ms) */
function useScroll(onClosed: () => void, closedAfter: number) {
  const [t0] = useState(() => performance.now());
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setShown(true), SCROLL_MS.open);
    return () => clearTimeout(id);
  }, []);
  const closed = useRef(onClosed);
  closed.current = onClosed;
  const close = () => {
    if (closing || performance.now() - t0 < SCROLL_MS.closeAfter) return false;
    setClosing(true);
    setTimeout(() => closed.current(), closedAfter);
    return true;
  };
  return { shown, closing, close };
}

/** §2 a butterfly tapped on the home: it goes to the bottom left with its name, the scroll opens; a tap rolls it up and the butterfly flies to your tree */
function HomeOpen({ o }: { o: OpenWork }) {
  useCastVoice('jupiter', o.work);
  const s = useScroll(o.close, SCROLL_MS.toTree);
  const moved = useNextFrame();
  const [named, setNamed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setNamed(true), SCROLL_MS.name);
    return () => clearTimeout(id);
  }, []);
  const from = o.from ? `translate3d(${o.from.x}px, ${o.from.y}px, 0) scale(${o.from.size})` : `${px(BF_CORNER)} scale(${BF_CORNER.size})`;
  const pos = s.closing ? `${px(JTREE)} scale(0.25)` : moved ? `${px(BF_CORNER)} scale(${BF_CORNER.size})` : from;
  return (
    <div className={j.open} onClick={s.close} data-testid="work-view" data-closing={s.closing ? '1' : '0'}>
      {s.shown && <ScrollArt art={artOf(o.work)} title={artTitleOf(o.work)} tags={o.work.tags} closing={s.closing} />}
      {o.figure && (
        <div className={`${j.fly} ${s.closing ? j.gone : ''}`} style={{ transform: pos }} data-testid="front-butterfly">
          <Wings src={o.figure} i={0} wings={o.person.figure === o.figure ? o.person.wings : null} />
        </div>
      )}
      {named && !s.closing && (
        <div className={j.who} style={{ left: `${BF_NAME.x * 100}%`, top: `${BF_NAME.y * 100}%` }} data-testid="art-who">
          {o.person.name}
        </div>
      )}
    </div>
  );
}

/** §3 in the play view: the butterfly is the play view's own; the scroll opens and rolls up just before it flies off */
function PlayOpen({ o }: { o: OpenWork }) {
  useCastVoice('jupiter', o.work);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setClosing(true), PORCH_HOLD_MS - 250);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className={`${j.open} ${j.inPlay}`} data-testid="work-view">
      <ScrollArt art={artOf(o.work)} title={artTitleOf(o.work)} tags={o.work.tags} closing={closing} />
      {!closing && (
        <div className={j.who} style={{ left: `${BF_NAME.x * 100}%`, top: `${BF_NAME.y * 100}%` }} data-testid="art-who">
          {o.person.name}
        </div>
      )}
    </div>
  );
}

/** §4 a frame tapped in the atelier: the same scroll over the atelier; a tap rolls it up */
function ProfileOpen({ o }: { o: OpenWork }) {
  useCastVoice('jupiter', o.work);
  const s = useScroll(o.close, SCROLL_MS.roll);
  return (
    <div className={`${j.open} ${j.clear}`} onClick={s.close} data-testid="work-view">
      <ScrollArt art={artOf(o.work)} title={artTitleOf(o.work)} tags={o.work.tags} closing={s.closing} />
    </div>
  );
}

/** Jupiter's opener: tapped on the home, in the play view (▶ from the porch), from the atelier */
export const jupiterOpener: WorkOpener = (o) => {
  if (o.where === 'play') return <PlayOpen key={o.work.id} o={o} />;
  if (o.where === 'profile') return <ProfileOpen key={o.work.id} o={o} />;
  return <HomeOpen key={o.work.id} o={o} />;
};

/** §4 the atelier: the person's arts in gold frames on the wall, two columns, scrolling down, each a little crooked */
export const jupiterAtelier: ProfileMiddleSlot = ({ person, open, current }) =>
  person.works.length ? (
    <div className={j.gal} data-testid="atelier">
      {person.works.map((w, i) => {
        const pic = w.thumbUrl || w.url;
        return (
          <button
            key={w.id}
            type="button"
            className={`${j.fr} ${current === w.id ? j.on : ''}`}
            style={{ backgroundImage: pic ? `url(${pic})` : undefined, transform: `rotate(${frameTilt(i)}deg)` } as CSSProperties}
            onClick={() => open(w)}
            aria-label={artTitleOf(w) || 'アート'}
          />
        );
      })}
    </div>
  ) : (
    <div className={j.none}>まだ、ここにはアートがないよ</div>
  );

/** 木星's hooks for the common template (handoff 03): the butterflies' wings (§1), the scroll (§2 / §3 / §4) and the atelier (§4) */
export function jupiterHooks(): TemplateHooks {
  return { opener: jupiterOpener, profileMiddle: jupiterAtelier, figure: butterfly };
}
