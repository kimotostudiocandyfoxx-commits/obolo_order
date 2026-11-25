'use client';

import type { HomePlanet, HomeWork, PlanetHomeView } from '@obolo/shared';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { templateConfig, type PlanetTemplateConfig } from '@/lib/planetTemplate/config';
import { clamp, dropAt, isDrag, replace, seat, slotOf, swayAt, type Crowd } from '@/lib/planetTemplate/layout';
import { peopleOf, type HomePerson } from '@/lib/planetTemplate/people';
import { PlayView } from './PlayView';
import { Profile, type ProfileMiddleSlot, type ProfilePerson } from './Profile';
import { TopBar } from './TopBar';
import { defaultOpener, type WorkOpener } from './WorkView';
import s from './PlanetTemplate.module.css';

/** you, on this planet: your name, your riding figure (figureFor) and your back (GET /me lookBack, or the stand-in) */
export interface TemplateMe {
  name: string;
  figure: string | null;
  back: string | null;
}

/** the per-planet hooks (the 02〜 documents fill them; every one has a default) */
export interface TemplateHooks {
  /** 3-2 how a work opens */
  opener?: WorkOpener;
  /** 3-5 the profile's middle */
  profileMiddle?: ProfileMiddleSlot;
  /** 3-2 / 3-3 numbers: where a figure may stay, ▶'s intro delay, how long a work stays (templateConfig) */
  config?: Partial<Omit<PlanetTemplateConfig, 'planet'>>;
}

/** one figure's motion (kept out of React: the frame loop moves it) */
type Mo = { cx: number; cy: number; size: number; row: 0 | 1 | 2; sx: number; sy: number; x: number; y: number; t: number; drag: boolean; i: number };

/** the 9:16 picture's box covering a W×H screen */
function coverBox(W: number, H: number) {
  const k = Math.max(W / 9, H / 16);
  return { w: 9 * k, h: 16 * k };
}

/**
 * 惑星ホームの共通の型 (handoff 01 3章, prototype design/home/template.html): the planet's backdrop with your place at
 * the back right (tap → your profile), up to eight ダチ・推し on their riding figures in three rows (the rest wait and
 * take the place of the ones opened), touch (tap opens, drag moves them; higher is further and smaller), ▶ at the top
 * right (the view from your place), the planet's icon and name at the top left (slide to switch planets) and the
 * profile. No posting on a planet (M-R314: making is on the Moon).
 */
export function PlanetTemplateHome({
  planet,
  view,
  me,
  hooks = {},
  onSwitchPlanet,
}: {
  planet: HomePlanet;
  view: PlanetHomeView | null;
  me: TemplateMe;
  hooks?: TemplateHooks;
  onSwitchPlanet?: (p: HomePlanet) => void;
}) {
  const cfg = useMemo(() => templateConfig(planet, hooks.config), [planet, hooks.config]);
  const opener = hooks.opener ?? defaultOpener;
  const people = useMemo(() => peopleOf(view), [view]);
  const [crowd, setCrowd] = useState<Crowd<HomePerson>>(() => seat(people));
  useEffect(() => setCrowd(seat(people)), [people]);

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

  const [opened, setOpened] = useState<{ person: HomePerson; work: HomeWork; seatN: number | null } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [profile, setProfile] = useState<string | null>(null);

  // --- the figures' motion -------------------------------------------------------------------------------------
  const mo = useRef(new Map<number, Mo>());
  const els = useRef(new Map<number, HTMLDivElement>());
  const fingers = useRef(new Set<number>());
  for (const st of crowd.seats)
    if (!mo.current.has(st.n)) {
      const S = slotOf(st.slot);
      mo.current.set(st.n, { cx: S[0], cy: S[1], size: S[2], row: S[5], sx: S[3], sy: S[4], x: size.W * (st.n % 2 ? 1.1 : -0.1), y: size.H * 0.6, t: 0, drag: false, i: st.n });
    }
  useEffect(() => {
    const live = new Set(crowd.seats.map((x) => x.n));
    for (const n of [...mo.current.keys()]) if (!live.has(n)) mo.current.delete(n);
  }, [crowd]);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { W, H } = sizeRef.current;
      for (const [n, b] of mo.current) {
        const el = els.current.get(n);
        if (!el || b.drag) continue;
        b.t += dt;
        const sw = swayAt(b.t, b.i, b.sx, b.sy, W, H);
        const tx = b.cx * W + sw.dx;
        const ty = b.cy * H + sw.dy;
        b.x += (tx - b.x) * Math.min(1, dt * 3);
        b.y += (ty - b.y) * Math.min(1, dt * 3);
        el.style.transform = `translate3d(${b.x}px,${b.y}px,0) scale(${b.size})`;
        if (el.dataset.row !== String(b.row)) el.dataset.row = String(b.row);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  // --- 3-2 touch: tap opens, a 9 px move drags; no drag while two fingers are down ------------------------------
  const press = useRef<{ n: number; id: number; x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);
  const openPerson = useCallback((p: HomePerson, seatN: number | null) => {
    const work = p.works[0];
    if (work) setOpened({ person: p, work, seatN });
  }, []);
  const figureHandlers = (n: number, p: HomePerson) => ({
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button > 0 || fingers.current.size >= 2) return;
      const b = mo.current.get(n);
      if (!b) return;
      press.current = { n, id: e.pointerId, x: e.clientX, y: e.clientY, ox: b.x, oy: b.y, moved: false };
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
        b.x = d.ox + dx;
        b.y = d.oy + dy;
        e.currentTarget.style.transform = `translate3d(${b.x}px,${b.y}px,0) rotate(${clamp(dx * 0.08, -10, 10)}deg) scale(${b.size * 1.1})`;
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
      const r = dropAt(b.x / W, b.y / H, cfg.allowed);
      const sw = swayAt(b.t, b.i, b.sx, b.sy, W, H);
      b.cx = r.x - sw.dx / W;
      b.cy = r.y - sw.dy / H;
      b.size = r.size;
      b.row = r.row;
      b.x = r.x * W;
      b.y = r.y * H;
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
        // the one opened leaves; the next in the queue comes into its slot
        setTimeout(() => setCrowd((c) => replace(c, (p) => p.id === gone)), 200);
      }
      return null;
    });
  }, []);

  // --- 3-5 the profile ---------------------------------------------------------------------------------------
  const own: ProfilePerson = { id: view?.owner.id ?? 'me', name: me.name || view?.owner.name || '', figure: me.figure, works: view?.own ?? [], mine: true };
  const profilePeople: ProfilePerson[] = [own, ...people.filter((p) => p.rel === 'dachi' || p.rel === 'oshi').map((p) => ({ id: p.id, name: p.name, figure: p.figure, works: p.works }))];
  const openProfile = useCallback(
    (id: string) => {
      setPlaying(false);
      setOpened(null);
      setProfile(id);
    },
    [],
  );

  const box = coverBox(size.W, size.H);
  const accent = { '--accent': cfg.accent } as CSSProperties;
  return (
    <div
      ref={root}
      className={`${s.root} ${playing || opened ? s.dim : ''}`}
      style={accent}
      onPointerDownCapture={(e) => void fingers.current.add(e.pointerId)}
      onPointerUpCapture={(e) => void fingers.current.delete(e.pointerId)}
      onPointerCancelCapture={(e) => void fingers.current.delete(e.pointerId)}
      onDragStart={(e) => e.preventDefault()}
      data-testid="planet-template"
      data-planet={planet}
    >
      <div className={s.stage} style={{ width: box.w, height: box.h, backgroundImage: `url(${cfg.art.home})` }}>
        <button type="button" className={s.place} style={{ left: `${cfg.place.x * 100}%`, top: `${cfg.place.y * 100}%` }} onClick={() => openProfile(own.id)} aria-label={`${own.name}の場所`} />
      </div>

      {crowd.seats.map((st) => (
        <div
          key={st.n}
          ref={(el) => {
            if (el) els.current.set(st.n, el);
            else els.current.delete(st.n);
          }}
          className={s.fig}
          data-row={slotOf(st.slot)[5]}
          role="button"
          tabIndex={0}
          aria-label={st.person.name}
          style={{ transform: `translate3d(${(mo.current.get(st.n)?.x ?? 0).toFixed(1)}px,${(mo.current.get(st.n)?.y ?? 0).toFixed(1)}px,0) scale(${slotOf(st.slot)[2]})`, visibility: opened?.seatN === st.n ? 'hidden' : undefined }}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openPerson(st.person, st.n)}
          {...figureHandlers(st.n, st.person)}
        >
          <img className={s.body} src={st.person.figure ?? st.person.sprite} alt="" draggable={false} />
          {!st.person.figure && st.person.face && <img className={s.face} src={st.person.face} alt="" draggable={false} />}
          <span className={s.nm}>{st.person.name}</span>
        </div>
      ))}

      <TopBar planet={planet} onSwitch={onSwitchPlanet} />
      <button type="button" className={`${s.play} ${playing ? s.on : ''}`} onClick={() => setPlaying((v) => !v)} aria-label={playing ? '止める' : 'ぜんぶ見る'} data-testid="play">
        <svg viewBox="0 0 24 24" aria-hidden>
          {playing ? <rect x="6" y="6" width="12" height="12" rx="3" /> : <path d="M8.5 5.6c0-1.1 1.2-1.8 2.2-1.2l8.6 5.5c.9.6.9 1.9 0 2.5l-8.6 5.5c-1 .6-2.2-.1-2.2-1.2z" />}
        </svg>
      </button>

      {playing && <PlayView cfg={cfg} people={[...crowd.seats.map((x) => x.person), ...crowd.queue]} back={me.back} opener={opener} onEnd={() => setPlaying(false)} openProfile={openProfile} />}
      {profile && (
        <Profile
          planet={planet}
          people={profilePeople}
          current={profile}
          onPick={setProfile}
          onBack={() => setProfile(null)}
          middle={hooks.profileMiddle}
          onOpen={(p, w) => {
            const person = people.find((x) => x.id === p.id) ?? { id: p.id, name: p.name, rel: 'own' as const, figure: p.figure, sprite: '', face: null, works: p.works };
            setOpened({ person, work: w, seatN: null });
          }}
        />
      )}
      {/* a work opened from the profile shows over it; closed, the profile is still there */}
      {opened && <div className={profile ? s.over : undefined}>{opener({ person: opened.person, work: opened.work, close: closeWork, openProfile })}</div>}
    </div>
  );
}
