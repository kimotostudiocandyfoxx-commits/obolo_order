'use client';

import type { ContinentView, FavouriteSlots, HomePlanet, HomeWork } from '@obolo/shared';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { templateConfig } from '@/lib/planetTemplate/config';
import { clamp, isDrag } from '@/lib/planetTemplate/layout';
import { LAND_SEA, MSLOT_X, sailMotion, shipStandIn } from '@/lib/planetTemplate/mercury';
import type { Body } from '@/lib/planetTemplate/motion';
import { pinchOf, SKY_ME, SKY_SLOTS, TRIP_SLOTS, type LandWork, type SkySource } from '@/lib/planetTemplate/sky';
import { SongStage } from '../mercury/SongStage';
import x from './Sky.module.css';

type Scene = { kind: 'map' } | { kind: 'trip'; list: ContinentView[] } | { kind: 'land'; c: ContinentView; back: 'map' | 'trip' };
/** a boat on the continent's sea (the stranger's song) */
type Boat = { w: LandWork; n: number; b: Body };
/** the continent's sea: the strangers' ships sail the same lanes as at home, from lower down (spawnStrangers) */
const LAND_MOTION = sailMotion(LAND_SEA, (slot) => MSLOT_X[((slot % 7) + 7) % 7]);
/** ▶ on a continent (M-R296 / M-R301): the ships come to the shore one at a time, the same path as the home's pier */
const SHORE = { from: { x: -0.2, y: 0.5, size: 0.35 }, to: { x: 0.5, y: 0.8, size: 1.45 }, out: { x: 1.25, y: 0.55, size: 0.45 } };
/** the maker on their ship (figureFor), or a stand-in ship until theirs is painted */
const figOf = (w: HomeWork) => w.author.figure ?? shipStandIn(w.author.id);
const at3 = (p: { x: number; y: number; size: number }) => `translate3d(${p.x * 100}cqw, ${p.y * 100}cqh, 0) translate(-50%, -50%) scale(${p.size})`;

/**
 * 空から探す (M-R295〜M-R312, prototype expOpen …): pinched up from the home, じぶんの空 — your island and your five
 * favourite continents on the sea, 〔🔍 大陸をさがす〕 and 〔✈ 旅〕 (six continents not seen yet). Tap an island to land:
 * the strangers' songs that drifted there sail by as ships (drag them on the sea; tap one: its song, its maker on their
 * ship, ☆ into Bluena, ♡ 推す, ⋯ hide / report). ▶ lands on the shore and the ships bring their songs one after another
 * (random order, until stopped). Pinch in / ← go back up; pinch out on the sky (or your island) goes home.
 */
export function SkyExplore({
  planet,
  source,
  me,
  onClose,
  toast,
}: {
  planet: HomePlanet;
  source: SkySource;
  me: { name: string; figure: string | null; back: string | null };
  onClose: () => void;
  toast: (t: string) => void;
}) {
  const cfg = templateConfig(planet);
  const [on, setOn] = useState(false);
  const [scene, setScene] = useState<Scene>({ kind: 'map' });
  const [continents, setContinents] = useState<ContinentView[]>([]);
  const [favs, setFavs] = useState<FavouriteSlots>([null, null, null, null, null]);
  const [swap, setSwap] = useState<ContinentView | null>(null);
  const [search, setSearch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dive, setDive] = useState<{ x: number; y: number } | null>(null);

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
  const land = useCallback(
    (c: ContinentView, from: 'map' | 'trip', pt: { x: number; y: number }) => {
      setSearch(false);
      setSwap(null);
      setDive(pt);
      setTimeout(() => {
        setDive(null);
        setScene({ kind: 'land', c, back: from });
      }, 650);
    },
    [],
  );
  const back = useCallback(() => {
    if (scene.kind === 'land') setScene(scene.back === 'trip' && prevTrip.current ? { kind: 'trip', list: prevTrip.current } : { kind: 'map' });
    else if (swap) setSwap(null);
    else if (scene.kind === 'trip') setScene({ kind: 'map' });
    else onClose();
  }, [scene, swap, onClose]);
  const prevTrip = useRef<ContinentView[] | null>(null);
  const travel = async () => {
    if (busy) return;
    setBusy(true);
    setSwap(null);
    try {
      const list = await source.travel();
      prevTrip.current = list;
      setTimeout(() => {
        setScene({ kind: 'trip', list });
        setBusy(false);
      }, 600);
    } catch {
      setBusy(false);
      toast('旅に出られなかった… もう一度ためしてね');
    }
  };
  const favourite = async (c: ContinentView, on: boolean, slot?: number) => {
    const r = await source.favourite(c.key, on, slot).catch(() => null);
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
    if (!on) toast(`☆ ${c.name} をはずしたよ`);
    else if (old && old !== c.key) toast(`🔁 ${byKey.get(old)?.name ?? ''} → ${c.name}`);
    else toast(`☆ ${c.name} をじぶんの空に追加`);
  };

  // pinch: in on a continent → back up to the sky; out on the sky → home (ctrl + wheel on a computer)
  const fingers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d0: number; fired: boolean } | null>(null);
  const dist = () => {
    const a = [...fingers.current.values()];
    return a.length === 2 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : 0;
  };
  const pinched = (k: 'in' | 'out') => {
    if (k === 'in' && scene.kind === 'land') back();
    else if (k === 'out' && scene.kind !== 'land' && !search) onClose();
  };

  const islands =
    scene.kind === 'trip'
      ? scene.list.map((c, i) => ({ c, S: TRIP_SLOTS[i % TRIP_SLOTS.length], i }))
      : favs.map((k, i) => ({ c: (k && byKey.get(k)) || null, S: SKY_SLOTS[i], i }));
  return (
    <div
      className={`${x.exp} ${on ? x.on : ''} ${swap ? x.swapping : ''}`}
      data-testid="sky"
      data-scene={scene.kind}
      onPointerDownCapture={(e) => {
        fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (fingers.current.size === 2) pinch.current = { d0: dist(), fired: false };
      }}
      onPointerMoveCapture={(e) => {
        if (!fingers.current.has(e.pointerId)) return;
        fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const p = pinch.current;
        if (!p || p.fired || !p.d0) return;
        const k = pinchOf(dist() / p.d0);
        if (k) {
          p.fired = true;
          pinched(k);
        }
      }}
      onPointerUpCapture={(e) => {
        fingers.current.delete(e.pointerId);
        if (fingers.current.size < 2) pinch.current = null;
      }}
      onPointerCancelCapture={(e) => {
        fingers.current.delete(e.pointerId);
        if (fingers.current.size < 2) pinch.current = null;
      }}
      onWheel={(e) => {
        if (!e.ctrlKey) return;
        if (e.deltaY > 4) pinched('in');
        else if (e.deltaY < -4) pinched('out');
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
              type="button"
              className={`${x.isl} ${c ? '' : x.empty} ${scene.kind === 'trip' ? x.popin : ''}`}
              style={{ left: `${S[0] * 100}%`, top: `${S[1] * 100}%`, width: `${S[2] * 100}%`, animationDelay: `${i * 0.07}s` }}
              onClick={(e) => {
                e.stopPropagation();
                if (swap && scene.kind === 'map') return void favourite(swap, true, i);
                if (c) land(c, scene.kind === 'trip' ? 'trip' : 'map', { x: S[0], y: S[1] });
                else setSearch(true);
              }}
              data-testid="island"
            >
              {c?.pictures.sky ? <img src={c.pictures.sky} alt="" draggable={false} /> : <i className={x.ph} />}
              <b>
                {c ? c.name : '＋ さがす'}
                {c?.creator && <small>by {c.creator.name}</small>}
              </b>
            </button>
          ))}
          {scene.kind === 'map' && cfg.sky && (
            <button type="button" className={`${x.isl} ${x.me}`} style={{ left: `${SKY_ME[0] * 100}%`, top: `${SKY_ME[1] * 100}%`, width: `${SKY_ME[2] * 100}%` }} onClick={() => !swap && onClose()}>
              <img src={cfg.sky.me} alt="" draggable={false} />
              <b>じぶんの島</b>
            </button>
          )}
          {scene.kind === 'trip' && <div className={x.tlabel}>✈ 旅の空</div>}
          {busy && <div className={x.tcloud} />}
        </div>
      )}

      {scene.kind === 'land' && <Landed key={scene.c.key} c={scene.c} source={source} me={me} toast={toast} />}

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
        <div className={x.eswap}>
          <p>「{swap.name}」をどの島と入れかえる？</p>
          {swap.pictures.sky && <img src={swap.pictures.sky} alt="" draggable={false} />}
          <button type="button" onClick={() => setSwap(null)}>
            やめる
          </button>
        </div>
      )}
      {search && <SearchSheet source={source} favs={favs} onClose={() => setSearch(false)} onLand={(c) => land(c, 'map', { x: 0.5, y: 0.45 })} onFavourite={favourite} />}
    </div>
  );
}

/** 〔🔍 大陸をさがす〕: by name, genre, #tag or maker; best first, the same at random (never by popularity, M-R298) */
function SearchSheet({
  source,
  favs,
  onClose,
  onLand,
  onFavourite,
}: {
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
        <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="大陸の名前・ジャンル・#タグ" autoComplete="off" aria-label="大陸をさがす" />
        <button type="button" onClick={onClose} aria-label="とじる">
          ✕
        </button>
      </div>
      <div className={x.estags}>
        {tags.map((g) => (
          <button key={g} type="button" className={g === tag ? x.on : ''} onClick={() => setTag((t) => (t === g ? '' : g))}>
            #{g}
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
                <small>
                  🌊 {c.count ?? 0}曲 · {c.tags.map((g) => `#${g}`).join(' ')} · {c.creator ? `by ${c.creator.name}` : '公式'}
                </small>
              </div>
              <button type="button" className={`${x.st} ${fav ? x.on : ''}`} aria-label="お気に入り" onClick={() => onFavourite(c, !fav)}>
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

/** a continent landed on: its name, the strangers' ships, a song opened, ▶ to the shore */
function Landed({ c, source, me, toast }: { c: ContinentView; source: SkySource; me: { name: string; figure: string | null; back: string | null }; toast: (t: string) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [young, setYoung] = useState(false);
  const [open, setOpen] = useState<{ boat: Boat } | null>(null);
  const [auto, setAuto] = useState<{ order: Boat[]; n: number; phase: 'in' | 'show' | 'out' } | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const size = useRef({ W: 390, H: 844 });
  const els = useRef(new Map<number, HTMLDivElement>());

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
        const ws = [...l.works.slice(0, 7)].sort(() => Math.random() - 0.5);
        setBoats(ws.map((w, i) => ({ w, n: i, b: LAND_MOTION.spawn(i, i, W, H) })));
        void source.visit(c.key);
      })
      .catch(() => toast('この大陸に降りられなかった…'));
    return () => {
      live = false;
    };
  }, [c.key, source, toast]);

  const boatsRef = useRef(boats);
  boatsRef.current = boats;
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { W, H } = size.current;
      for (const bt of boatsRef.current) {
        const el = els.current.get(bt.n);
        if (!el || bt.b.drag) continue;
        LAND_MOTION.step(bt.b, dt, W, H);
        el.style.transform = `translate3d(${bt.b.x}px,${bt.b.y}px,0) scale(${bt.b.size})`;
        el.dataset.flip = bt.b.flip ? '1' : '0';
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const press = useRef<{ n: number; id: number; x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);
  const live = boats.filter((b) => !gone.has(b.w.author.id));
  const show = (boat: Boat) => setOpen({ boat });

  // ▶: the shore; the ships come one by one in a random order, round and round until stopped (M-R296 / M-R301)
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopAuto = () => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    setAuto(null);
    setOpen(null);
  };
  const nextAuto = useCallback((a: { order: Boat[]; n: number }) => {
    if (!a.order.length) return setAuto(null);
    setAuto({ ...a, phase: 'in' });
    autoTimer.current = setTimeout(() => setAuto((s) => (s ? { ...s, phase: 'show' } : s)), 1800);
  }, []);
  const startAuto = () => {
    const order = [...live].sort(() => Math.random() - 0.5);
    setOpen(null);
    autoTimer.current = setTimeout(() => nextAuto({ order, n: 0 }), 400);
    setAuto({ order, n: -1, phase: 'in' });
  };
  useEffect(() => () => void (autoTimer.current && clearTimeout(autoTimer.current)), []);
  const autoBoat = auto && auto.n >= 0 ? auto.order[auto.n % auto.order.length] : null;
  const autoDone = () => {
    if (!auto) return;
    setAuto({ ...auto, phase: 'out' });
    autoTimer.current = setTimeout(() => nextAuto({ order: auto.order.filter((b) => !gone.has(b.w.author.id)), n: auto.n + 1 }), 1100);
  };

  const name = c.name;
  const nameSize = Math.min(44, Math.floor((size.current.W * 0.46) / Math.max(1, [...name].length)));
  const pier = !!auto && !!c.pictures.shore;
  return (
    <div ref={root} className={`${x.landed} ${open || auto?.phase === 'show' ? x.show : ''} ${auto ? x.auto : ''} ${pier ? x.pier : ''}`} data-testid="continent" data-key={c.key}>
      <div className={x.eland} style={{ backgroundImage: `url(${(pier ? c.pictures.shore : c.pictures.land) ?? c.pictures.sky ?? ''})` }} />
      <div className={x.rname} style={{ fontSize: nameSize }}>
        {name}
      </div>
      {young && <div className={x.young}>15歳になると、ここに知らない人の曲が流れ着くよ</div>}
      {!pier &&
        live.map((bt) => (
          <div
            key={bt.n}
            ref={(el) => {
              if (el) els.current.set(bt.n, el);
              else els.current.delete(bt.n);
            }}
            className={x.eb}
            style={{ transform: `translate3d(${bt.b.x}px,${bt.b.y}px,0) scale(${bt.b.size})`, visibility: open?.boat === bt ? 'hidden' : undefined }}
            role="button"
            tabIndex={0}
            aria-label={`${bt.w.author.name}の曲`}
            data-testid="land-boat"
            onPointerDown={(e) => {
              press.current = { n: bt.n, id: e.pointerId, x: e.clientX, y: e.clientY, ox: bt.b.x, oy: bt.b.y, moved: false };
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                // synthetic
              }
            }}
            onPointerMove={(e) => {
              const d = press.current;
              if (!d || d.n !== bt.n || d.id !== e.pointerId) return;
              const dx = e.clientX - d.x;
              const dy = e.clientY - d.y;
              if (!d.moved && isDrag(dx, dy)) {
                d.moved = true;
                bt.b.drag = true;
              }
              if (d.moved && fingers2(e)) {
                press.current = null;
                bt.b.drag = false;
                return;
              }
              if (d.moved) {
                bt.b.x = d.ox + dx;
                bt.b.y = d.oy + dy;
                e.currentTarget.style.transform = `translate3d(${bt.b.x}px,${bt.b.y}px,0) rotate(${clamp(dx * 0.08, -10, 10)}deg) scale(${bt.b.size * 1.1})`;
              }
            }}
            onPointerUp={(e) => {
              const d = press.current;
              if (!d || d.id !== e.pointerId) return;
              press.current = null;
              if (!d.moved) {
                if (auto) stopAuto();
                return show(bt);
              }
              const { W, H } = size.current;
              LAND_MOTION.drop(bt.b, W, H);
              bt.b.drag = false;
            }}
            onPointerCancel={() => {
              press.current = null;
              bt.b.drag = false;
            }}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && show(bt)}
          >
            <img src={figOf(bt.w)} alt="" draggable={false} />
            <span>{bt.w.rel === 'own' ? '★ じぶん' : bt.w.author.name}</span>
          </div>
        ))}

      {pier && me.back && <img className={x.pback} src={me.back} alt="" draggable={false} />}
      {pier && autoBoat && (
        <div
          key={`pb-${autoBoat.n}-${auto?.n}`}
          className={`${x.pb} ${auto?.phase === 'show' ? x.bob : ''}`}
          style={{ transform: at3(auto?.phase === 'out' ? SHORE.out : SHORE.to), opacity: auto?.phase === 'out' ? 0 : 1 }}
          data-testid="shore-boat"
          ref={(el) => {
            // placed at `from` first, then sails in (its transition)
            if (el && !el.dataset.placed) {
              el.dataset.placed = '1';
              el.style.transition = 'none';
              el.style.transform = at3(SHORE.from);
              requestAnimationFrame(() =>
                requestAnimationFrame(() => {
                  el.style.transition = '';
                  el.style.transform = at3(SHORE.to);
                }),
              );
            }
          }}
        >
          <img src={figOf(autoBoat.w)} alt="" draggable={false} />
        </div>
      )}

      {open && (
        <SongOpen
          key={open.boat.n}
          boat={open.boat}
          source={source}
          me={me}
          toast={toast}
          onClose={() => setOpen(null)}
          onHide={(id) => {
            setGone((g) => new Set(g).add(id));
            setOpen(null);
          }}
        />
      )}
      {auto && autoBoat && auto.phase === 'show' && (
        <SongOpen
          key={`${autoBoat.n}-${auto.n}`}
          boat={autoBoat}
          source={source}
          me={me}
          toast={toast}
          shore
          onEnd={autoDone}
          onClose={stopAuto}
          onHide={(id) => {
            setGone((g) => new Set(g).add(id));
            autoDone();
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

/** two fingers on the screen (a pinch wins over a drag) */
const fingers2 = (e: React.PointerEvent) => !e.isPrimary;

/**
 * a stranger's song opened (M-R309 / M-R310): the disc, the title and the lyrics; its maker on their ship with the name
 * under a thin line (no tags shown); ☆ keeps it in Bluena, ♡ 推す the maker (from then on they come to your island);
 * ⋯ hides the person or reports the song (they are gone at once). A tap elsewhere closes it (on the shore: stops ▶).
 */
function SongOpen({
  boat,
  source,
  me,
  toast,
  shore,
  onEnd,
  onClose,
  onHide,
}: {
  boat: Boat;
  source: SkySource;
  me: { name: string };
  toast: (t: string) => void;
  shore?: boolean;
  onEnd?: () => void;
  onClose: () => void;
  onHide: (personId: string) => void;
}) {
  const w = boat.w as HomeWork & LandWork;
  const mine = w.rel === 'own';
  const [saved, setSaved] = useState(false);
  const [oshi, setOshi] = useState(w.rel === 'oshi' || w.rel === 'dachi');
  const [menu, setMenu] = useState(false);
  const [hearts, setHearts] = useState(0);
  const [t0] = useState(() => performance.now());
  const load = useCallback((x0: HomeWork) => source.song(x0), [source]);
  return (
    <div className={x.estage} onClick={() => performance.now() - t0 > 300 && onClose()} data-testid="land-song">
      <SongStage work={w} load={load} place="land" loop={!shore} startMs={shore ? 0 : 450} titleMs={shore ? 1500 : 2200} onEnd={onEnd} />
      <div className={x.auth} style={{ top: '73%' }}>
        <img src={figOf(w)} alt="" draggable={false} />
        <b>{mine ? `${me.name}（じぶん）` : w.author.name}</b>
      </div>
      <div className={x.acts} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={`${x.favb} ${saved ? x.done : ''}`}
          aria-label="お気に入り（ブルーナに保存）"
          onClick={async () => {
            if (saved || mine) return;
            if (await source.save(w, true).catch(() => false)) {
              setSaved(true);
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
            onClick={async () => {
              if (oshi) return;
              await source.oshi(w.author.id, true).catch(() => undefined);
              setOshi(true);
              setHearts((n) => n + 1);
              toast(`💗 ${w.author.name} を推しにしたよ。これからきみの島にも来てくれるよ`);
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
