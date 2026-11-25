'use client';

import type { ContinentView, FavouriteSlots, HomePlanet, HomeWork } from '@obolo/shared';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { templateConfig } from '@/lib/planetTemplate/config';
import { clamp, isDrag } from '@/lib/planetTemplate/layout';
import type { Body } from '@/lib/planetTemplate/motion';
import { PinchTracker, WheelPinch, type Pinch } from '@/lib/planetTemplate/pinch';
import { soundScope, type SoundScope } from '@/lib/planetTemplate/sfx';
import { countLine, SEARCH_PLACEHOLDER, SKY_ME, SKY_SLOTS, TRIP_SLOTS, type LandWork, type SkySource } from '@/lib/planetTemplate/sky';
import { hitSlot, LAND_MAX, landMotionOf, landNameSize, SKY_PLANETS, type ShorePoint } from '@/lib/planetTemplate/skyPlanets';
import type { SkyKit } from './skyKits';
import x from './Sky.module.css';

type Scene = { kind: 'map' } | { kind: 'trip'; list: ContinentView[] } | { kind: 'land'; c: ContinentView; back: 'map' | 'trip' };
/** a stranger on the continent (their work, their running number, where they are) */
type Rider = { w: LandWork; n: number; b: Body };
type SkyMe = { name: string; figure: string | null; back: string | null };

const TRIP_HINT_KEY = 'obolo-planet-sky-trip-hint';
const at3 = (p: ShorePoint) => `translate3d(${p.x * 100}cqw, ${p.y * 100}cqh, 0) translate(-50%, -50%) scale(${p.size})`;
const transformOf = (b: Body, k = 1) => `translate3d(${b.x.toFixed(1)}px,${b.y.toFixed(1)}px,0) rotate(${b.rot.toFixed(2)}deg) scale(${(b.size * b.qx * k).toFixed(4)},${(b.size * b.qy * k).toFixed(4)})`;
/** a work that plays to its end waits for it — but never for ever (a song that does not load) */
const UNTIL_DONE_MAX_MS = 6 * 60_000;
/** a tapped work rolls up / fades before it is gone */
const CLOSING_MS = 380;

/** a component's sounds: its pending cues stop with it */
function useScope(): SoundScope {
  const [sc] = useState(soundScope);
  useEffect(() => () => sc.stop(), [sc]);
  return sc;
}

function once(key: string): boolean {
  try {
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, '1');
  } catch {
    // no storage: say it every time
  }
  return true;
}

/**
 * 空から探す (handoff 06, M-R295〜M-R312 / M-R316; prototype expOpen …): pinched up from the home, じぶんの空 — your
 * island and your five favourite continents on the planet's sky, 〔🔍 大陸をさがす〕 and 〔✈ 旅〕 (six continents, the
 * ones not seen yet first). ☆ with five already: drag the new island onto one of yours, or tap one. Tap an island to
 * land: the strangers' works that drifted there come on the planet's figures (Mercury's ships on the sea, Jupiter's
 * butterflies, Saturn's kororins on the plaza's record; drag them about). Tap one: the work opens the planet's way, its
 * maker's figure and name under it, ☆ into Bluena, ♡ 推す, ⋯ hide / report. ▶: the shore view, the works come one at a
 * time in a random order until stopped. Pinch in / ← go back up; pinch out on the sky (or your island) goes home.
 */
export function SkyExplore({ planet, source, kit, me, onClose, toast }: { planet: HomePlanet; source: SkySource; kit: SkyKit; me: SkyMe; onClose: () => void; toast: (t: string) => void }) {
  const cfg = templateConfig(planet);
  const [on, setOn] = useState(false);
  const [scene, setScene] = useState<Scene>({ kind: 'map' });
  const [continents, setContinents] = useState<ContinentView[]>([]);
  const [favs, setFavs] = useState<FavouriteSlots>([null, null, null, null, null]);
  const [swap, setSwap] = useState<ContinentView | null>(null);
  const [search, setSearch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dive, setDive] = useState<{ x: number; y: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  // the sky's sounds (expOpen / expLand / tripGo: whoosh; an island kept: chime); they stop when the sky closes
  const snd = useScope();
  useEffect(() => {
    snd.cue(planet, 'skyOpen');
  }, [snd, planet]);

  useEffect(() => {
    let live = true;
    source
      .sky()
      .then((v) => {
        if (!live) return;
        setContinents(v.continents);
        setFavs(v.favourites);
      })
      .catch(() => toast('空が見えなかった… もう一度ためしてね'));
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
    return () => {
      live = false;
      cancelAnimationFrame(id);
    };
  }, [source, toast]);

  const byKey = useMemo(() => new Map(continents.map((c) => [c.key, c])), [continents]);
  const prevTrip = useRef<ContinentView[] | null>(null);
  const land = useCallback(
    (c: ContinentView, from: 'map' | 'trip', pt: { x: number; y: number }) => {
    snd.cue(planet, 'skyLand');
    setSearch(false);
    setSwap(null);
    setDive(pt);
    setTimeout(() => {
      setDive(null);
      setScene({ kind: 'land', c, back: from });
    }, 650);
    },
    [snd, planet],
  );
  const back = useCallback(() => {
    if (scene.kind === 'land') setScene(scene.back === 'trip' && prevTrip.current ? { kind: 'trip', list: prevTrip.current } : { kind: 'map' });
    else if (swap) setSwap(null);
    else if (scene.kind === 'trip') {
      snd.cue(planet, 'skyTripBack');
      setScene({ kind: 'map' });
    } else onClose();
  }, [scene, swap, onClose, snd, planet]);
  const travel = async () => {
    if (busy) return;
    snd.cue(planet, 'skyTrip');
    setBusy(true);
    setSwap(null);
    try {
      const list = await source.travel();
      prevTrip.current = list;
      setTimeout(() => {
        setScene({ kind: 'trip', list });
        setBusy(false);
        if (once(TRIP_HINT_KEY)) toast('✈ ← でじぶんの空にもどれるよ');
      }, 600);
    } catch {
      setBusy(false);
      toast('旅に出られなかった… もう一度ためしてね');
    }
  };
  const favourite = async (c: ContinentView, want: boolean, slot?: number) => {
    const r = await source.favourite(c.key, want, slot).catch(() => null);
    if (r === 'FULL') {
      setSearch(false);
      setScene({ kind: 'map' });
      setSwap(c);
      return;
    }
    if (!r) return;
    const old = slot != null ? favs[slot] : null;
    setFavs(r);
    setSwap(null);
    if (slot != null) setPopped(slot);
    if (want) snd.cue(planet, 'skyKeep');
    if (!want) toast(`☆ ${c.name} をはずしたよ`);
    else if (old && old !== c.key) toast(`🔁 ${byKey.get(old)?.name ?? ''} → ${c.name}`);
    else toast(`☆ ${c.name} をじぶんの空に追加`);
  };
  const [popped, setPopped] = useState<number | null>(null);

  // --- the pinch: in on a continent → back up to the sky; out on the sky → home (ctrl + wheel on a computer) ------
  const pinch = useRef(new PinchTracker());
  const wheel = useRef(new WheelPinch());
  const landOpen = useRef(false);
  const pinched = (k: Pinch) => {
    if (k === 'in' && scene.kind === 'land' && !landOpen.current) back();
    else if (k === 'out' && scene.kind !== 'land' && !search && !swap) onClose();
  };

  // --- 「どの島と入れかえる？」: drag the new island onto one of yours (or tap one) ----------------------------------
  const islEls = useRef(new Map<number, HTMLButtonElement>());
  const [drag, setDrag] = useState<{ x: number; y: number; w: number; hot: number | null } | null>(null);
  const dragAt = useRef<{ id: number; dx: number; dy: number; x0: number; y0: number; w: number; moved: boolean } | null>(null);
  const hotAt = (cx: number, cy: number) =>
    hitSlot(
      cx,
      cy,
      [...islEls.current].map(([i, el]) => {
        // the island's picture (not the name tag under it)
        const r = (el.querySelector('img, i') ?? el).getBoundingClientRect();
        return { i, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      }),
    );
  const local = (cx: number, cy: number) => {
    const r = root.current?.getBoundingClientRect();
    return { x: cx - (r?.left ?? 0), y: cy - (r?.top ?? 0) };
  };

  const islands =
    scene.kind === 'trip'
      ? scene.list.map((c, i) => ({ c, S: TRIP_SLOTS[i % TRIP_SLOTS.length], i }))
      : favs.map((k, i) => ({ c: (k && byKey.get(k)) || null, S: SKY_SLOTS[i], i }));
  return (
    <div
      ref={root}
      className={`${x.exp} ${on ? x.on : ''} ${swap ? x.swapping : ''}`}
      style={{ ['--accent' as string]: cfg.accent }}
      data-testid="sky"
      data-planet={planet}
      data-scene={scene.kind}
      onPointerDownCapture={(e) => pinch.current.down(e.pointerId, e.clientX, e.clientY)}
      onPointerMoveCapture={(e) => {
        const k = pinch.current.move(e.pointerId, e.clientX, e.clientY);
        if (k) pinched(k);
      }}
      onPointerUpCapture={(e) => pinch.current.up(e.pointerId)}
      onPointerCancelCapture={(e) => pinch.current.up(e.pointerId)}
      onWheel={(e) => {
        const k = wheel.current.of(e, performance.now());
        if (k) pinched(k);
      }}
    >
      {scene.kind !== 'land' && (
        <div
          className={`${x.emap} ${dive ? x.dive : ''} ${busy ? x.tripout : ''}`}
          style={{ backgroundImage: cfg.sky ? `url(${cfg.sky.sea})` : undefined, transformOrigin: dive ? `${dive.x * 100}% ${dive.y * 100}%` : undefined }}
        >
          {islands.map(({ c, S, i }) => (
            <button
              key={`${scene.kind}-${i}-${c?.key ?? 'empty'}`}
              ref={(el) => {
                if (scene.kind !== 'map') return;
                if (el) islEls.current.set(i, el);
                else islEls.current.delete(i);
              }}
              type="button"
              className={`${x.isl} ${c ? '' : x.empty} ${scene.kind === 'trip' || popped === i ? x.popin : ''} ${drag?.hot === i ? x.hot : ''}`}
              style={{ left: `${S[0] * 100}%`, top: `${S[1] * 100}%`, width: `${S[2] * 100}%`, animationDelay: scene.kind === 'trip' ? `${i * 0.07}s` : undefined }}
              onClick={(e) => {
                e.stopPropagation();
                if (swap && scene.kind === 'map') return void favourite(swap, true, i);
                if (c) land(c, scene.kind === 'trip' ? 'trip' : 'map', { x: S[0], y: S[1] });
                else setSearch(true);
              }}
              data-testid="island"
              data-slot={i}
            >
              {c?.pictures.sky ? <img src={c.pictures.sky} alt="" draggable={false} /> : <i className={x.ph} />}
              <b>
                {c ? c.name : '＋ さがす'}
                {c?.creator && <small>by {c.creator.name}</small>}
              </b>
            </button>
          ))}
          {scene.kind === 'map' && cfg.sky && (
            <button type="button" className={`${x.isl} ${x.me}`} style={{ left: `${SKY_ME[0] * 100}%`, top: `${SKY_ME[1] * 100}%`, width: `${SKY_ME[2] * 100}%` }} onClick={() => !swap && onClose()} data-testid="my-island">
              <img src={cfg.sky.me} alt="" draggable={false} />
              <b>じぶんの島</b>
            </button>
          )}
          {scene.kind === 'trip' && <div className={x.tlabel}>✈ 旅の空</div>}
          {busy && <div className={x.tcloud} />}
        </div>
      )}

      {scene.kind === 'land' && <Landed key={scene.c.key} planet={planet} c={scene.c} source={source} kit={kit} me={me} toast={toast} pinch={pinch.current} openRef={landOpen} />}

      <div className={x.etop}>
        <button type="button" className={x.eback} onClick={back} aria-label="もどる" data-testid="sky-back">
          ←
        </button>
        {scene.kind !== 'land' && (
          <>
            <button type="button" className={x.esearch} onClick={() => setSearch(true)} data-testid="sky-search">
              <svg viewBox="0 0 24 24" aria-hidden>
                <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.6" />
                <path d="M15.5 15.5l5 5" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
              </svg>
              <span>大陸をさがす</span>
            </button>
            <button type="button" className={x.trip} onClick={travel} aria-label="旅に出る" data-testid="sky-travel">
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M3 11.2l17.2-7.4c.6-.3 1.2.3.9.9L13.8 21c-.3.6-1.1.5-1.3-.1l-2-6.4-6.4-2c-.6-.2-.7-1-.1-1.3z" fill="#fff" />
                <path d="M10.5 14.5l4.8-4.8" stroke="#6a6cff" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              旅
            </button>
          </>
        )}
      </div>

      {swap && (
        <div className={x.eswap} data-testid="sky-swap">
          <p>「{swap.name}」をどの島と入れかえる？</p>
          <img
            className={x.nw}
            style={drag ? { visibility: 'hidden' } : undefined}
            src={swap.pictures.sky ?? cfg.sky?.me ?? ''}
            alt=""
            draggable={false}
            data-testid="swap-new"
            onPointerDown={(e) => {
              if (pinch.current.count >= 2) return;
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect();
              dragAt.current = { id: e.pointerId, dx: e.clientX - r.left - r.width / 2, dy: e.clientY - r.top - r.height / 2, x0: e.clientX, y0: e.clientY, w: r.width, moved: false };
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                // synthetic
              }
            }}
            onPointerMove={(e) => {
              const d = dragAt.current;
              if (!d || d.id !== e.pointerId) return;
              if (pinch.current.count >= 2) {
                // the pinch wins
                dragAt.current = null;
                setDrag(null);
                return;
              }
              if (!d.moved && !isDrag(e.clientX - d.x0, e.clientY - d.y0)) return;
              d.moved = true;
              const p = local(e.clientX - d.dx, e.clientY - d.dy);
              setDrag({ x: p.x, y: p.y, w: d.w, hot: hotAt(e.clientX, e.clientY) });
            }}
            onPointerUp={(e) => {
              const d = dragAt.current;
              if (!d || d.id !== e.pointerId) return;
              dragAt.current = null;
              const hot = d.moved ? hotAt(e.clientX, e.clientY) : null;
              setDrag(null);
              if (hot != null) void favourite(swap, true, hot);
            }}
            onPointerCancel={() => {
              dragAt.current = null;
              setDrag(null);
            }}
          />
          <small>島までドラッグ（またはタップ）</small>
          <button type="button" onClick={() => setSwap(null)}>
            やめる
          </button>
        </div>
      )}
      {swap && drag && <img className={x.swapDrag} src={swap.pictures.sky ?? cfg.sky?.me ?? ''} alt="" draggable={false} style={{ left: drag.x, top: drag.y, width: drag.w }} data-testid="swap-drag" />}
      {search && <SearchSheet planet={planet} source={source} favs={favs} onClose={() => setSearch(false)} onLand={(c) => land(c, 'map', { x: 0.5, y: 0.45 })} onFavourite={favourite} />}
    </div>
  );
}

/** 〔🔍 大陸をさがす〕: by name, genre (the chips: words only, no 「#」, M-R310) or maker; best first, the same at random (never by popularity, M-R298) */
function SearchSheet({
  planet,
  source,
  favs,
  onClose,
  onLand,
  onFavourite,
}: {
  planet: HomePlanet;
  source: SkySource;
  favs: FavouriteSlots;
  onClose: () => void;
  onLand: (c: ContinentView) => void;
  onFavourite: (c: ContinentView, on: boolean) => void;
}) {
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [all, setAll] = useState<ContinentView[]>([]);
  const [rows, setRows] = useState<ContinentView[] | null>(null);
  useEffect(() => {
    source
      .search('')
      .then(setAll)
      .catch(() => setAll([]));
  }, [source]);
  useEffect(() => {
    let live = true;
    const id = setTimeout(
      () =>
        source
          .search(q, tag || null)
          .then((r) => live && setRows(r))
          .catch(() => live && setRows([])),
      q ? 180 : 0,
    );
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [source, q, tag]);
  const tags = [...new Set(all.flatMap((c) => c.tags))].slice(0, 12);
  return (
    <div className={x.esheet} data-testid="sky-sheet">
      <div className={x.eshead}>
        <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder={SEARCH_PLACEHOLDER} autoComplete="off" aria-label="大陸をさがす" />
        <button type="button" onClick={onClose} aria-label="とじる">
          ✕
        </button>
      </div>
      <div className={x.estags}>
        {tags.map((g) => (
          <button key={g} type="button" className={g === tag ? x.on : ''} onClick={() => setTag((t) => (t === g ? '' : g))}>
            {g}
          </button>
        ))}
      </div>
      <div className={x.eslist}>
        <div className={x.cap}>{q || tag ? `${rows?.length ?? 0}件` : '大陸いちらん'}</div>
        {rows && !rows.length && <div className={x.cap}>見つからなかった… 別のことばで探してみて</div>}
        {rows?.map((c) => {
          const fav = favs.includes(c.key);
          return (
            <div key={c.key} className={x.esr}>
              <div className={x.th} style={c.pictures.sky ? { backgroundImage: `url(${c.pictures.sky})` } : undefined} />
              <div className={x.t}>
                <b>{c.name}</b>
                <small>{countLine(planet, c.count)}</small>
              </div>
              <button type="button" className={`${x.st} ${fav ? x.on : ''}`} aria-label="お気に入り" onClick={() => onFavourite(c, !fav)} data-testid="search-star">
                {fav ? '★' : '☆'}
              </button>
              <button type="button" className={x.go} onClick={() => onLand(c)}>
                降りる
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** ▶ on a continent: who is on the shore now, and where in their visit (in → show → closing → out → the next) */
type Auto = { order: Rider[]; n: number; phase: 'start' | 'in' | 'show' | 'closing' | 'out' };

/** a continent landed on: its name, the strangers on the planet's figures, a work opened, ▶ to the shore */
function Landed({
  planet,
  c,
  source,
  kit,
  me,
  toast,
  pinch,
  openRef,
}: {
  planet: HomePlanet;
  c: ContinentView;
  source: SkySource;
  kit: SkyKit;
  me: SkyMe;
  toast: (t: string) => void;
  pinch: PinchTracker;
  openRef: React.MutableRefObject<boolean>;
}) {
  const sp = SKY_PLANETS[planet];
  const snd = useScope();
  const motion = useMemo(() => landMotionOf(planet), [planet]);
  const root = useRef<HTMLDivElement>(null);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [young, setYoung] = useState(false);
  const [open, setOpen] = useState<{ r: Rider; closing: boolean } | null>(null);
  const [auto, setAuto] = useState<Auto | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const size = useRef({ W: 390, H: 844 });
  const els = useRef(new Map<number, HTMLDivElement>());
  const shadows = useRef(new Map<number, HTMLElement>());
  openRef.current = !!open;

  useLayoutEffect(() => {
    const el = root.current;
    if (el) size.current = { W: el.clientWidth || 390, H: el.clientHeight || 844 };
  }, []);
  useEffect(() => {
    let live = true;
    source
      .land(c.key)
      .then((l) => {
        if (!live) return;
        setYoung(l.young);
        const { W, H } = size.current;
        // seven at most, in a random order (never by popularity)
        const ws = [...l.works.slice(0, LAND_MAX)].sort(() => Math.random() - 0.5);
        setRiders(ws.map((w, i) => ({ w, n: i, b: motion.spawn(i, i, W, H) })));
        void source.visit(c.key);
      })
      .catch(() => toast('この大陸に降りられなかった…'));
    return () => {
      live = false;
    };
  }, [c.key, source, toast, motion]);

  const ridersRef = useRef(riders);
  ridersRef.current = riders;
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { W, H } = size.current;
      const live = ridersRef.current.filter((r) => els.current.has(r.n));
      for (const r of live) if (!r.b.drag) motion.step(r.b, dt, W, H);
      motion.settle?.(
        live.map((r) => r.b),
        dt,
        W,
        H,
      );
      for (const r of live) {
        const el = els.current.get(r.n)!;
        const sh = shadows.current.get(r.n);
        if (sh && r.b.shadow) {
          sh.style.transform = `translate3d(${r.b.shadow.x.toFixed(1)}px,${r.b.shadow.y.toFixed(1)}px,0)`;
          sh.style.width = `${r.b.shadow.w.toFixed(1)}px`;
          sh.style.height = `${(r.b.shadow.w * 0.24).toFixed(1)}px`;
          sh.style.opacity = r.b.shadow.o.toFixed(3);
        }
        el.style.zIndex = String(r.b.z ?? 2 + r.b.row);
        if (r.b.drag) continue;
        el.style.transform = transformOf(r.b);
        el.dataset.flip = r.b.flip ? '1' : '0';
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [motion]);

  const press = useRef<{ n: number; id: number; x: number; y: number; ox: number; oy: number; moved: boolean; lx: number; ly: number; lt: number } | null>(null);
  const live = riders.filter((r) => !gone.has(r.w.author.id));
  const closeOpen = () => {
    setOpen((o) => (o && !o.closing ? { ...o, closing: true } : o));
    setTimeout(() => setOpen(null), CLOSING_MS);
  };

  // ▶: the shore; the works come one by one in a random order, round and round until stopped (M-R296 / M-R301)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const later = (fn: () => void, ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  };
  const goneRef = useRef(gone);
  goneRef.current = gone;
  const stopAuto = () => {
    if (timer.current) clearTimeout(timer.current);
    setAuto(null);
  };
  const visit = (order: Rider[], n: number) => {
    const alive = order.filter((r) => !goneRef.current.has(r.w.author.id));
    if (!alive.length) return setAuto(null);
    setAuto({ order: alive, n, phase: 'in' });
    later(() => {
      // autoNext: the stranger reaches the shore with a splash (bob)
      if (c.pictures.shore) snd.cue(planet, 'skyArrive');
      setAuto((a) => (a ? { ...a, phase: 'show' } : a));
    }, 1800);
  };
  const leave = (a: Auto) => {
    setAuto({ ...a, phase: 'out' });
    later(() => visit(a.order, a.n + 1), 1100);
  };
  // the hold: a set time (then it rolls up) or until the song / MV has finished (06 §6)
  useEffect(() => {
    if (!auto || auto.phase !== 'show') return;
    const hold = sp.holdMs ?? UNTIL_DONE_MAX_MS;
    const a = auto;
    const t1 = setTimeout(() => setAuto((s) => (s === a ? { ...a, phase: 'closing' } : s)), Math.max(0, hold - CLOSING_MS));
    return () => clearTimeout(t1);
  }, [auto, sp.holdMs]);
  useEffect(() => {
    if (!auto || auto.phase !== 'closing') return;
    const a = auto;
    const t = setTimeout(() => leave(a), CLOSING_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);
  const startAuto = () => {
    const order = [...live].sort(() => Math.random() - 0.5);
    // autoStart: the view turns to the shore (whoosh)
    if (c.pictures.shore) snd.cue(planet, 'skyShore');
    setOpen(null);
    setAuto({ order, n: -1, phase: 'start' });
    later(() => visit(order, 0), 400);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const autoRider = auto && auto.n >= 0 ? auto.order[auto.n % auto.order.length] : null;
  const autoEnd = () => setAuto((a) => (a && a.phase === 'show' ? { ...a, phase: 'closing' } : a));

  const name = c.name;
  const pier = !!auto && !!c.pictures.shore;
  const showing = !!open || auto?.phase === 'show' || auto?.phase === 'closing';
  return (
    <div ref={root} className={`${x.landed} ${showing ? x.show : ''} ${auto ? x.auto : ''} ${pier ? x.pier : ''}`} data-testid="continent" data-key={c.key} data-land={sp.land}>
      <div className={x.eland} style={{ backgroundImage: `url(${(pier ? c.pictures.shore : c.pictures.land) ?? c.pictures.sky ?? ''})` }} />
      <div className={x.rname} style={{ fontSize: landNameSize(name, size.current.W) }}>
        {name}
      </div>
      {young && <div className={x.young}>15歳になると、ここに知らない人の{sp.works}が流れ着くよ</div>}
      {!pier && sp.land === 'floor' && (
        <div className={x.shadows}>
          {live.map((r) => (
            <i
              key={`sh-${r.n}`}
              className={x.ksh}
              ref={(el) => {
                if (el) shadows.current.set(r.n, el);
                else shadows.current.delete(r.n);
              }}
              style={{ visibility: open?.r === r ? 'hidden' : undefined }}
            />
          ))}
        </div>
      )}
      {!pier &&
        live.map((r) => (
          <div
            key={r.n}
            ref={(el) => {
              if (el) els.current.set(r.n, el);
              else els.current.delete(r.n);
            }}
            className={x.eb}
            data-land={sp.land}
            style={{ transform: transformOf(r.b), visibility: open?.r === r ? 'hidden' : undefined }}
            role="button"
            tabIndex={0}
            aria-label={r.w.author.name}
            data-testid="land-rider"
            onPointerDown={(e) => {
              if (e.button > 0 || pinch.count >= 2) return;
              press.current = { n: r.n, id: e.pointerId, x: e.clientX, y: e.clientY, ox: r.b.x, oy: r.b.y, moved: false, lx: e.clientX, ly: e.clientY, lt: performance.now() };
              r.b.vx = 0;
              r.b.vy = 0;
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                // synthetic
              }
            }}
            onPointerMove={(e) => {
              const d = press.current;
              if (!d || d.n !== r.n || d.id !== e.pointerId) return;
              const dx = e.clientX - d.x;
              const dy = e.clientY - d.y;
              if (!d.moved && isDrag(dx, dy)) {
                d.moved = true;
                r.b.drag = true;
              }
              if (pinch.count >= 2) {
                // two fingers: the pinch wins, let go where it is
                press.current = null;
                r.b.drag = false;
                return;
              }
              if (!d.moved) return;
              const now = performance.now();
              const st = Math.max(8, now - d.lt) / 1000;
              r.b.vx = ((e.clientX - d.lx) / st) * 0.6;
              r.b.vy = ((e.clientY - d.ly) / st) * 0.6;
              d.lx = e.clientX;
              d.ly = e.clientY;
              d.lt = now;
              r.b.x = d.ox + dx;
              r.b.y = d.oy + dy;
              if (motion.drag) {
                const { W, H } = size.current;
                motion.drag(r.b, W, H);
                e.currentTarget.style.transform = transformOf(r.b, 1.06);
              } else e.currentTarget.style.transform = `translate3d(${r.b.x}px,${r.b.y}px,0) rotate(${clamp(dx * 0.08, -10, 10)}deg) scale(${r.b.size * 1.1})`;
            }}
            onPointerUp={(e) => {
              const d = press.current;
              if (!d || d.id !== e.pointerId) return;
              press.current = null;
              if (!d.moved) {
                if (auto) stopAuto();
                return setOpen({ r, closing: false });
              }
              const { W, H } = size.current;
              motion.drop(r.b, W, H);
              r.b.drag = false;
            }}
            onPointerCancel={() => {
              press.current = null;
              r.b.drag = false;
            }}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen({ r, closing: false })}
          >
            {kit.rider({ w: r.w, i: r.n })}
            <span>{r.w.rel === 'own' ? '★ じぶん' : r.w.author.name}</span>
          </div>
        ))}

      {pier && me.back && <img className={x.pback} src={me.back} alt="" draggable={false} />}
      {pier && autoRider && (auto?.phase === 'in' || auto?.phase === 'show' || auto?.phase === 'closing' || auto?.phase === 'out') && (
        <div
          key={`pb-${autoRider.n}-${auto?.n}`}
          className={`${x.pb} ${auto?.phase === 'show' ? x.bob : ''}`}
          data-land={sp.land}
          style={{ transform: at3(auto?.phase === 'out' ? sp.shore.out : sp.shore.to), opacity: auto?.phase === 'out' ? 0 : 1 }}
          data-testid="shore-rider"
          ref={(el) => {
            // placed at `from` first, then comes in (its transition)
            if (el && !el.dataset.placed) {
              el.dataset.placed = '1';
              el.style.transition = 'none';
              el.style.transform = at3(sp.shore.from);
              requestAnimationFrame(() =>
                requestAnimationFrame(() => {
                  el.style.transition = '';
                  el.style.transform = at3(sp.shore.to);
                }),
              );
            }
          }}
        >
          {kit.rider({ w: autoRider.w, i: autoRider.n })}
        </div>
      )}
      {/* ▶ running: a tap anywhere stops it (06 §6) */}
      {auto && !showing && <div className={x.autoTap} onClick={stopAuto} />}

      {open && (
        <WorkOpen
          key={open.r.n}
          planet={planet}
          w={open.r.w}
          kit={kit}
          source={source}
          me={me}
          toast={toast}
          closing={open.closing}
          onClose={closeOpen}
          onHide={(id) => {
            setGone((g) => new Set(g).add(id));
            setOpen(null);
          }}
        />
      )}
      {auto && autoRider && (auto.phase === 'show' || auto.phase === 'closing') && (
        <WorkOpen
          key={`${autoRider.n}-${auto.n}`}
          planet={planet}
          w={autoRider.w}
          kit={kit}
          source={source}
          me={me}
          toast={toast}
          shore
          closing={auto.phase === 'closing'}
          onEnd={autoEnd}
          onClose={stopAuto}
          onHide={(id) => {
            const g = new Set(goneRef.current).add(id);
            goneRef.current = g;
            setGone(g);
            if (auto) leave(auto);
          }}
        />
      )}
      <button type="button" className={`${x.eplay} ${auto ? x.on : ''}`} onClick={() => (auto ? stopAuto() : startAuto())} aria-label={auto ? '止める' : '流す'} data-testid="land-play">
        <svg viewBox="0 0 24 24" aria-hidden>
          {auto ? <rect x="6" y="6" width="12" height="12" rx="3" /> : <path d="M8.5 5.6c0-1.1 1.2-1.8 2.2-1.2l8.6 5.5c.9.6.9 1.9 0 2.5l-8.6 5.5c-1 .6-2.2-.1-2.2-1.2z" />}
        </svg>
      </button>
      {auto && !pier && me.figure && (
        <div className={x.trav}>
          <span>おじゃまします</span>
          <img src={me.figure} alt="" draggable={false} />
        </div>
      )}
    </div>
  );
}

/**
 * a stranger's work opened (06 §5, M-R309 / M-R310): the planet's opener; under it only its maker's figure (on their
 * ride) and name — no tags; ☆ keeps it in Bluena, ♡ 推す the maker (from then on they come to your home on this planet);
 * ⋯ hides the person or reports the work (they are gone at once). A tap elsewhere closes it (on the shore: stops ▶).
 */
function WorkOpen({
  planet,
  w,
  kit,
  source,
  me,
  toast,
  shore = false,
  closing,
  onEnd,
  onClose,
  onHide,
}: {
  planet: HomePlanet;
  w: LandWork;
  kit: SkyKit;
  source: SkySource;
  me: { name: string };
  toast: (t: string) => void;
  shore?: boolean;
  closing: boolean;
  onEnd?: () => void;
  onClose: () => void;
  onHide: (personId: string) => void;
}) {
  const sp = SKY_PLANETS[planet];
  const mine = w.rel === 'own';
  const [saved, setSaved] = useState(false);
  const [oshi, setOshi] = useState(w.rel === 'oshi' || w.rel === 'dachi');
  const [menu, setMenu] = useState(false);
  const [hearts, setHearts] = useState(0);
  const [t0] = useState(() => performance.now());
  // expShow's splash and the planet's own (Saturn's pop, Jupiter's chime, Neptune's chip); ☆ / ♡: chime
  const snd = useScope();
  useEffect(() => {
    snd.cue(planet, 'skyShow');
  }, [snd, planet]);
  return (
    <div className={`${x.estage} ${closing ? x.closing : ''}`} onClick={() => performance.now() - t0 > 300 && onClose()} data-testid="land-work" data-planet={planet}>
      {kit.opener({ w: w as HomeWork & LandWork, shore, closing, onEnd })}
      <div className={x.auth} style={{ top: `${sp.whoTop * 100}%` }} data-testid="work-maker">
        {!shore && <img src={kit.figureOf(w)} alt="" draggable={false} />}
        <b>{mine ? `${me.name}（じぶん）` : w.author.name}</b>
      </div>
      <div className={x.acts} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={`${x.favb} ${saved ? x.done : ''}`}
          aria-label="お気に入り（ブルーナに保存）"
          data-testid="work-save"
          onClick={async () => {
            if (saved || mine) return;
            if (await source.save(w, true).catch(() => false)) {
              setSaved(true);
              snd.cue(planet, 'skyKeep');
              toast('⭐ ブルーナに保存したよ');
            }
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 16.6l-5.3 2.9 1.1-5.9L3.4 9.5l6-.8z" />
          </svg>
        </button>
        {!mine && (
          <button
            type="button"
            className={`${x.oshib} ${oshi ? x.done : ''}`}
            aria-label="推す"
            data-testid="work-oshi"
            onClick={async () => {
              if (oshi) return;
              await source.oshi(w.author.id, true).catch(() => undefined);
              setOshi(true);
              snd.cue(planet, 'skyKeep');
              setHearts((n) => n + 1);
              toast(`💗 ${w.author.name} を推しにしたよ。これから${sp.home}にも来てくれるよ`);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M12 20.3s-7.6-4.6-7.6-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.6 2.7c0 5.6-7.6 10.2-7.6 10.2z" />
            </svg>
          </button>
        )}
      </div>
      {hearts > 0 &&
        Array.from({ length: 12 }, (_, k) => (
          <i key={`${hearts}-${k}`} className={x.heart} style={{ ['--dx' as string]: `${((k * 53) % 160) - 80}px`, ['--dy' as string]: `${-60 - ((k * 37) % 120)}px` }}>
            💗
          </i>
        ))}
      {!mine && (
        <button
          type="button"
          className={x.repb}
          aria-label="通報・非表示"
          data-testid="work-more"
          onClick={(e) => {
            e.stopPropagation();
            setMenu((v) => !v);
          }}
        >
          ⋯
        </button>
      )}
      {menu && (
        <div className={x.repmenu} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={async () => {
              await source.hidePerson(w.author.id).catch(() => undefined);
              toast(`🙈 ${w.author.name} は表示しないよ`);
              onHide(w.author.id);
            }}
          >
            🙈 この人を表示しない
          </button>
          <button
            type="button"
            onClick={async () => {
              await source.report(w).catch(() => undefined);
              toast('⚑ 通報したよ。もう表示されないよ');
              onHide(w.author.id);
            }}
          >
            ⚑ 通報する
          </button>
        </div>
      )}
    </div>
  );
}
