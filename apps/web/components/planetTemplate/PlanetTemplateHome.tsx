'use client';

import type { HomePlanet, HomeWork, PlanetHomeView } from '@obolo/shared';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { templateConfig, type PlanetTemplateConfig } from '@/lib/planetTemplate/config';
import { clamp, isDrag, replace, seat, type Crowd } from '@/lib/planetTemplate/layout';
import type { Body } from '@/lib/planetTemplate/motion';
import { dancerOf, peopleOf, type HomePerson } from '@/lib/planetTemplate/people';
import { SAMPLE_OWN_FIGURE } from '@/lib/planetTemplate/sample';
import { nameFont, shadesOf } from '@/lib/planetTemplate/saturn';
import { pinchOf } from '@/lib/planetTemplate/sky';
import { PlayView, type PlayStage } from './PlayView';
import { Profile, type ProfileMiddleSlot, type ProfilePerson } from './Profile';
import { Shades } from './saturn/Shades';
import { TopBar } from './TopBar';
import { defaultOpener, type FigureSlot, type WorkOpener } from './WorkView';
import s from './PlanetTemplate.module.css';

/** you, on this planet: your name, your riding figure (figureFor), your back (GET /me lookBack, or the stand-in) and you dancing */
export interface TemplateMe {
  name: string;
  figure: string | null;
  back: string | null;
  /** you jumping out of your place when ▶ is pressed (Mercury: the chibi; null: none) */
  dance?: string | null;
  /** Saturn: the chibi that pops out of your kororin (figureFor's chibi) */
  chibi?: string | null;
}

/** what the sky gets from the home (it covers the home while open) */
export interface SkyOpen {
  close: () => void;
  toast: (t: string) => void;
}

/** the per-planet hooks (the 02〜 documents fill them; every one has a default) */
export interface TemplateHooks {
  /** 3-2 how a work opens */
  opener?: WorkOpener;
  /** 3-5 the profile's middle */
  profileMiddle?: ProfileMiddleSlot;
  /** 3-1 how a figure with its own picture is drawn on the home and in ▶ (Jupiter: only the wings flap, 03 §1) */
  figure?: FigureSlot;
  /** 3-2 / 3-3 numbers: where a figure may stay, ▶'s intro delay, how long a work stays (templateConfig) */
  config?: Partial<Omit<PlanetTemplateConfig, 'planet'>>;
  /** the sky (pinch in on the home; Mercury first, M-R295): drawn over the home while open */
  sky?: (o: SkyOpen) => ReactNode;
  /** ▶ the planet's own stage in the view from your place, in place of the visitors one at a time (Saturn: the groove) */
  playStage?: PlayStage;
  /** the profile's middle takes the whole screen under the top row and the name (Saturn's 2D stage) */
  profileFull?: boolean;
}

/** the 9:16 picture's box covering a W×H screen */
function coverBox(W: number, H: number) {
  const k = Math.max(W / 9, H / 16);
  return { w: 9 * k, h: 16 * k };
}

const HINT_KEY = 'obolo-planet-sky-hint';
const transformOf = (b: Body, k = 1) => `translate3d(${b.x.toFixed(1)}px,${b.y.toFixed(1)}px,0) rotate(${b.rot.toFixed(2)}deg) scale(${(b.size * b.qx * k).toFixed(4)},${(b.size * b.qy * k).toFixed(4)})`;

/**
 * 惑星ホームの共通の型 (handoff 01 3章, prototype design/home/template.html): the planet's backdrop with your place at
 * the back right (tap → your profile), the ダチ・推し on their riding figures in three rows (the rest wait and take the
 * place of the ones opened), touch (tap opens, drag moves them; higher is further and smaller), ▶ at the top right (the
 * view from your place), the planet's icon and name at the top left (slide to switch planets) and the profile. How the
 * figures move is the planet's (config.motion: Jupiter's drift, Mercury's sea lanes). No posting on a planet (M-R314).
 */
export function PlanetTemplateHome({ planet, view, me, hooks = {}, onSwitchPlanet }: { planet: HomePlanet; view: PlanetHomeView | null; me: TemplateMe; hooks?: TemplateHooks; onSwitchPlanet?: (p: HomePlanet) => void }) {
  const cfg = useMemo(() => templateConfig(planet, hooks.config), [planet, hooks.config]);
  const motion = cfg.motion;
  const opener = hooks.opener ?? defaultOpener;
  const friends = useMemo(() => peopleOf(view), [view]);
  // Saturn: your own kororin is on the floor too (your newest voice), one of the eight
  const ownPerson = useMemo<HomePerson | null>(
    () =>
      cfg.ownOnHome && view?.own.length
        ? {
            id: view.owner.id,
            name: me.name || view.owner.name,
            rel: 'own',
            figure: me.figure,
            chibi: me.chibi ?? null,
            sprite: '',
            face: null,
            works: view.own,
          }
        : null,
    [cfg.ownOnHome, view, me.name, me.figure, me.chibi],
  );
  const people = useMemo(() => (ownPerson ? [ownPerson, ...friends] : friends), [ownPerson, friends]);
  const [crowd, setCrowd] = useState<Crowd<HomePerson>>(() => seat(people, motion.max));
  useEffect(() => setCrowd(seat(people, motion.max)), [people, motion]);

  const root = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ W: 390, H: 844 });
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const fit = () => setSize({ W: el.clientWidth || 390, H: el.clientHeight || 844 });
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [opened, setOpened] = useState<{
    person: HomePerson;
    work: HomeWork;
    seatN: number | null;
    from: { x: number; y: number; size: number; flip: boolean } | null;
  } | null>(null);
  const [playing, setPlaying] = useState<HomePerson[] | null>(null);
  const [profile, setProfile] = useState<string | null>(null);
  const [sky, setSky] = useState(false);
  const [toastText, setToastText] = useState<{ t: string; n: number } | null>(null);
  const toast = useCallback((t: string) => setToastText((o) => ({ t, n: (o?.n ?? 0) + 1 })), []);
  useEffect(() => {
    if (!toastText) return;
    const id = setTimeout(() => setToastText(null), 1800);
    return () => clearTimeout(id);
  }, [toastText]);

  // --- the figures' motion -------------------------------------------------------------------------------------
  const mo = useRef(new Map<number, Body>());
  const els = useRef(new Map<number, HTMLDivElement>());
  const shadows = useRef(new Map<number, HTMLElement>());
  const fingers = useRef(new Map<number, { x: number; y: number }>());
  for (const st of crowd.seats) if (!mo.current.has(st.n)) mo.current.set(st.n, motion.spawn(st.slot, st.n, size.W, size.H));
  useEffect(() => {
    const live = new Set(crowd.seats.map((x) => x.n));
    for (const n of [...mo.current.keys()]) if (!live.has(n)) mo.current.delete(n);
  }, [crowd]);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const busy = useRef(false);
  busy.current = !!opened || !!playing;
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { W, H } = sizeRef.current;
      const live: Body[] = [];
      for (const [n, b] of mo.current) {
        if (!els.current.get(n)) continue;
        live.push(b);
        if (!b.drag) motion.step(b, dt, W, H, busy.current && motion.kind !== 'floor' ? 0.6 : 1);
      }
      // what they do to each other (Saturn: push apart on the floor) and where they are drawn
      motion.settle?.(live, dt, W, H);
      for (const [n, b] of mo.current) {
        const el = els.current.get(n);
        if (!el) continue;
        if (b.z != null) el.style.zIndex = String(b.z);
        const sh = shadows.current.get(n);
        if (sh && b.shadow) {
          sh.style.transform = `translate3d(${b.shadow.x.toFixed(1)}px,${b.shadow.y.toFixed(1)}px,0)`;
          sh.style.width = `${b.shadow.w.toFixed(1)}px`;
          sh.style.height = `${(b.shadow.w * 0.24).toFixed(1)}px`;
          sh.style.opacity = b.shadow.o.toFixed(3);
        }
        if (b.drag) continue;
        el.style.transform = transformOf(b);
        if (el.dataset.row !== String(b.row)) el.dataset.row = String(b.row);
        const flip = b.flip ? '1' : '0';
        if (el.dataset.flip !== flip) el.dataset.flip = flip;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [motion]);

  // --- 3-2 touch: tap opens, a 9 px move drags; no drag while two fingers are down ------------------------------
  const press = useRef<{
    n: number;
    id: number;
    x: number;
    y: number;
    ox: number;
    oy: number;
    moved: boolean;
    lx: number;
    ly: number;
    lt: number;
  } | null>(null);
  const openPerson = useCallback((p: HomePerson, seatN: number | null) => {
    const work = p.works[0];
    const b = seatN != null ? mo.current.get(seatN) : null;
    if (work)
      setOpened({
        person: p,
        work,
        seatN,
        from: b ? { x: b.x, y: b.y, size: b.size, flip: b.flip } : null,
      });
  }, []);
  const figureHandlers = (n: number, p: HomePerson) => ({
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button > 0 || fingers.current.size >= 2) return;
      const b = mo.current.get(n);
      if (!b) return;
      press.current = {
        n,
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        ox: b.x,
        oy: b.y,
        moved: false,
        lx: e.clientX,
        ly: e.clientY,
        lt: performance.now(),
      };
      b.vx = 0;
      b.vy = 0;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // a synthetic event has no capture
      }
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const d = press.current;
      const b = mo.current.get(n);
      if (!d || d.n !== n || d.id !== e.pointerId || !b) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && isDrag(dx, dy)) {
        d.moved = true;
        b.drag = true;
        e.currentTarget.classList.add(s.dragging);
      }
      if (d.moved && fingers.current.size >= 2) {
        // the pinch wins: let go where it is
        press.current = null;
        b.drag = false;
        e.currentTarget.classList.remove(s.dragging);
        return;
      }
      if (d.moved) {
        // the finger's speed (Saturn throws with it when let go)
        const now = performance.now();
        const st = Math.max(8, now - d.lt) / 1000;
        b.vx = ((e.clientX - d.lx) / st) * 0.6;
        b.vy = ((e.clientY - d.ly) / st) * 0.6;
        d.lx = e.clientX;
        d.ly = e.clientY;
        d.lt = now;
        b.x = d.ox + dx;
        b.y = d.oy + dy;
        if (motion.drag) {
          const { W, H } = sizeRef.current;
          motion.drag(b, W, H);
          e.currentTarget.style.transform = transformOf(b, 1.06);
          if (b.z != null) e.currentTarget.style.zIndex = String(b.z);
        } else e.currentTarget.style.transform = `translate3d(${b.x}px,${b.y}px,0) rotate(${clamp(dx * 0.08, -10, 10)}deg) scale(${b.size * 1.1})`;
      }
    },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      const d = press.current;
      const b = mo.current.get(n);
      if (!d || d.id !== e.pointerId || !b) return;
      press.current = null;
      e.currentTarget.classList.remove(s.dragging);
      if (!d.moved) return openPerson(p, n);
      const { W, H } = sizeRef.current;
      motion.drop(b, W, H, cfg.allowed);
      b.drag = false;
    },
    onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => {
      const b = mo.current.get(n);
      press.current = null;
      e.currentTarget.classList.remove(s.dragging);
      if (b) b.drag = false;
    },
  });

  const closeWork = useCallback(() => {
    setOpened((o) => {
      if (o?.seatN != null) {
        const gone = o.person.id;
        // the one opened leaves; the next in the queue comes into its slot (nobody left at all: all heard)
        setTimeout(
          () =>
            setCrowd((c) => {
              const next = replace(c, (p) => p.id === gone);
              if (!next.seats.length && c.seats.length && cfg.play.doneLine) toast(cfg.play.doneLine);
              return next;
            }),
          200,
        );
      }
      return null;
    });
  }, [cfg.play.doneLine, toast]);

  // --- the sky: pinch in (or ctrl + wheel on a computer) goes up; the first visit says how, once (M-R295) ---------
  const skyOn = !!(cfg.sky && hooks.sky);
  const pinch = useRef<{ d0: number; fired: boolean } | null>(null);
  const openSky = useCallback(() => {
    setOpened(null);
    setPlaying(null);
    setSky(true);
  }, []);
  useEffect(() => {
    if (!skyOn) return;
    let seen = false;
    try {
      seen = !!localStorage.getItem(HINT_KEY);
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      // no storage: say it every visit
    }
    if (seen) return;
    const id = setTimeout(() => toast('✌️ 2本の指でつまむと、空から探せるよ'), 900);
    return () => clearTimeout(id);
  }, [skyOn, toast]);
  const twoFingers = () => {
    const a = [...fingers.current.values()];
    return a.length === 2 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : 0;
  };

  // --- 3-5 the profile ---------------------------------------------------------------------------------------
  const own: ProfilePerson = {
    id: view?.owner.id ?? 'me',
    name: me.name || view?.owner.name || '',
    figure: me.figure,
    chibi: me.chibi ?? null,
    works: view?.own ?? [],
    mine: true,
  };
  const profilePeople: ProfilePerson[] = [
    own,
    ...friends
      .filter((p) => p.rel === 'dachi' || p.rel === 'oshi')
      .map((p) => ({
        id: p.id,
        name: p.name,
        figure: p.figure ?? cfg.standIn?.(p.id) ?? null,
        chibi: p.chibi ?? null,
        works: p.works,
      })),
  ];
  const openProfile = useCallback((id: string) => {
    setPlaying(null);
    setOpened(null);
    setProfile(id);
  }, []);
  const playOrder = () => [...crowd.seats.map((x) => x.person), ...crowd.queue].filter((p) => p.rel !== 'own');

  const box = coverBox(size.W, size.H);
  const vars = {
    '--accent': cfg.accent,
    '--open-scale': cfg.openLook.scale,
    '--open-blur': `${cfg.openLook.blur}px`,
    '--open-bright': cfg.openLook.bright,
  } as CSSProperties;
  const picOf = (p: HomePerson) => p.figure ?? cfg.standIn?.(p.id) ?? p.sprite;
  return (
    <div
      ref={root}
      className={`${s.root} ${opened ? `${cfg.openLook.dim === false ? '' : s.dim} ${s.opened}` : ''}`}
      style={vars}
      onPointerDownCapture={(e) => {
        fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (fingers.current.size === 2) pinch.current = { d0: twoFingers(), fired: false };
      }}
      onPointerMoveCapture={(e) => {
        if (!fingers.current.has(e.pointerId)) return;
        fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const pc = pinch.current;
        if (!pc || pc.fired || !pc.d0 || fingers.current.size !== 2) return;
        if (skyOn && !sky && !profile && pinchOf(twoFingers() / pc.d0) === 'in') {
          pc.fired = true;
          openSky();
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
        // a trackpad pinch on a computer arrives as ctrl + wheel
        if (e.ctrlKey && e.deltaY > 4 && skyOn && !sky && !profile) openSky();
      }}
      onDragStart={(e) => e.preventDefault()}
      data-testid="planet-template"
      data-planet={planet}
      data-motion={motion.kind}
      data-playing={playing ? '1' : undefined}
    >
      <div
        className={s.stage}
        style={{
          width: box.w,
          height: box.h,
          backgroundImage: `url(${cfg.art.home})`,
        }}
      >
        <button
          type="button"
          className={s.place}
          style={{
            left: `${cfg.place.x * 100}%`,
            top: `${cfg.place.y * 100}%`,
          }}
          onClick={() => openProfile(own.id)}
          aria-label={`${own.name}の場所`}
        />
        {cfg.placeArm && (
          <button
            type="button"
            className={s.arm}
            style={{
              left: `${cfg.placeArm.x0 * 100}%`,
              top: `${cfg.placeArm.y0 * 100}%`,
              width: Math.hypot((cfg.placeArm.x1 - cfg.placeArm.x0) * box.w, (cfg.placeArm.y1 - cfg.placeArm.y0) * box.h),
              transform: `translateY(-50%) rotate(${Math.atan2((cfg.placeArm.y1 - cfg.placeArm.y0) * box.h, (cfg.placeArm.x1 - cfg.placeArm.x0) * box.w)}rad)`,
            }}
            onClick={() => openProfile(own.id)}
            aria-label={`${own.name}の場所`}
            data-testid="place-arm"
          />
        )}
      </div>

      {/* the figures in one layer (Saturn's depth stacking stays under the play view and the profile) */}
      <div className={s.crowd} data-motion={motion.kind}>
        {/* Saturn: each kororin's shadow on the floor (under every kororin) */}
        {motion.kind === 'floor' &&
          crowd.seats.map((st) => (
            <i
              key={`sh-${st.n}`}
              className={s.ksh}
              ref={(el) => {
                if (el) shadows.current.set(st.n, el);
                else shadows.current.delete(st.n);
              }}
              style={{
                visibility: opened?.seatN === st.n ? 'hidden' : undefined,
              }}
            />
          ))}

        {crowd.seats.map((st) => {
          const b = mo.current.get(st.n);
          return (
            <div
              key={st.n}
              ref={(el) => {
                if (el) els.current.set(st.n, el);
                else els.current.delete(st.n);
              }}
              className={s.fig}
              data-row={b?.row ?? motion.slotRow(st.slot)}
              data-flip={b?.flip ? '1' : '0'}
              data-motion={motion.kind}
              role="button"
              tabIndex={0}
              aria-label={st.person.name}
              style={{
                transform: b ? transformOf(b) : undefined,
                visibility: opened?.seatN === st.n ? 'hidden' : undefined,
              }}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openPerson(st.person, st.n)}
              {...figureHandlers(st.n, st.person)}
            >
              {motion.kind === 'sail' && <i className={s.wake} />}
              {hooks.figure && (st.person.figure || cfg.standIn) ? hooks.figure({ src: picOf(st.person), i: st.n }) : <img className={s.body} src={picOf(st.person)} alt="" draggable={false} />}
              {!st.person.figure && !cfg.standIn && st.person.face && <img className={s.face} src={st.person.face} alt="" draggable={false} />}
              {motion.kind === 'floor' ? (
                <>
                  <Shades kind={shadesOf(st.n)} className={s.shades} />
                  {/* the name inside the ball under the face (none on your own) */}
                  {st.person.rel !== 'own' && (
                    <span className={s.bname} style={{ fontSize: nameFont(st.person.name) }}>
                      {st.person.name}
                    </span>
                  )}
                </>
              ) : (
                <span className={s.nm}>{st.person.name}</span>
              )}
            </div>
          );
        })}
      </div>

      <TopBar planet={planet} onSwitch={onSwitchPlanet} />
      <button type="button" className={`${s.play} ${playing ? s.on : ''}`} onClick={() => setPlaying((v) => (v ? null : playOrder()))} aria-label={playing ? '止める' : 'ぜんぶ見る'} data-testid="play">
        <svg viewBox="0 0 24 24" aria-hidden>
          {playing ? <rect x="6" y="6" width="12" height="12" rx="3" /> : <path d="M8.5 5.6c0-1.1 1.2-1.8 2.2-1.2l8.6 5.5c.9.6.9 1.9 0 2.5l-8.6 5.5c-1 .6-2.2-.1-2.2-1.2z" />}
        </svg>
      </button>

      {playing && (
        <PlayView
          cfg={cfg}
          people={playing}
          back={me.back}
          dancer={dancerOf(cfg.play.danceAs, me, SAMPLE_OWN_FIGURE(planet))}
          opener={opener}
          figure={hooks.figure}
          stage={hooks.playStage}
          onEnd={(finished) => {
            setPlaying(null);
            if (finished && cfg.play.doneLine) toast(cfg.play.doneLine);
          }}
          openProfile={openProfile}
        />
      )}
      {profile && (
        <Profile
          planet={planet}
          people={profilePeople}
          current={profile}
          onPick={setProfile}
          onBack={() => {
            setOpened(null);
            setProfile(null);
          }}
          middle={hooks.profileMiddle}
          full={hooks.profileFull}
          openedId={opened && opened.seatN == null ? opened.work.id : null}
          onOpen={(p, w) => {
            const person = people.find((x) => x.id === p.id) ?? {
              id: p.id,
              name: p.name,
              rel: 'own' as const,
              figure: p.figure,
              sprite: '',
              face: null,
              works: p.works,
            };
            setOpened({ person, work: w, seatN: null, from: null });
          }}
        />
      )}
      {/* a work opened from the profile shows over it; closed, the profile is still there */}
      {opened && (
        <div className={profile ? s.over : undefined}>
          {opener({
            person: opened.person,
            work: opened.work,
            where: profile ? 'profile' : 'home',
            from: opened.from,
            figure: picOf(opened.person),
            close: closeWork,
            openProfile,
          })}
        </div>
      )}
      {sky && hooks.sky?.({ close: () => setSky(false), toast })}
      {toastText && (
        <div key={toastText.n} className={s.toast} role="status">
          {toastText.t}
        </div>
      )}
    </div>
  );
}
