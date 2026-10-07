'use client';

import { neoVoiceUrl, SATURN_LIFETIME_HOURS, SATURN_MAX_CHARS, VOICE_STYLES, type PlazaView, type SaturnPostView } from '@obolo/shared';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getApi } from '@/lib/api';
import { stopAudio, subscribeAudio, toggleAudio } from '@/lib/audio';
import { useAuth } from '@/lib/auth';
import { residentReplies, SATURN_RESIDENTS } from '@/lib/saturnResidents';
import { useDictation } from '@/lib/useDictation';
import { MicButton } from '@/components/MicButton';
import { PuniAvatar } from '@/components/puni/PuniAvatar';
import { playPop, unlockPop } from '@/lib/popSound';
import { PuniPhysicsLayer, type PuniItem, type PuniLayerHandle } from '@/components/puni/PuniPhysicsLayer';
import { COLORS, defaultLook } from '@/lib/puni/parts';
import { hueOf } from './BallAvatar';
import { PhotoCropper } from './PhotoCropper';
import { PlazaMap } from './PlazaMap';
import { SaturnProfile } from './SaturnProfile';

/**
 * 「ころりん」 — Saturn's voice world (client concept, 2026-10-04).
 * Every voice is its author's ぷにぷに character (dressed on their profile), a soft body that
 * falls onto the planet, rolls, squashes and bumps into the others. Tap one → it squishes and
 * talks: the post card floats over it and the voice plays (it jiggles while talking). Drag →
 * stretch and throw. Voices vanish after 88 hours.
 * Bottom bar: ゆらす (shake) · 声をおとす (record & drop your voice) · おまかせ (play a random voice).
 * Under an opened voice, the people who answered line up as little balls: tap one → its voice
 * plays with a speech bubble. Names open the person's page (follow); 🔁 quotes the voice.
 * みんな is the ひろば map (client design 2026-10-07): pick a ひろば → its voices fall here.
 */
type Tab = 'all' | 'following' | 'friends';

export interface KororinEvents {
  onListen?: () => void;
  onStar?: () => void;
  onPosted?: () => void;
}

export function KororinWorld({
  events,
  overlay,
  className = '',
  neoOnly = false,
  highlightDrop = false,
}: {
  events?: KororinEvents;
  /** Day 4 tutorial (kept for its caller; posting is the same: Bati reads). */
  neoOnly?: boolean;
  /** Make the 声をおとす button pulse (tutorial cue). */
  highlightDrop?: boolean;
  /** Extra layer on top (tutorial coach). */
  overlay?: ReactNode;
  className?: string;
}) {
  const { me } = useAuth();
  const [posts, setPosts] = useState<SaturnPostView[]>([]);
  const [tab, setTab] = useState<Tab>('all');
  // みんな: the ひろば map, or inside one ひろば (the Day 4 tutorial skips the map)
  const [plaza, setPlaza] = useState<PlazaView | null>(null);
  const [mapShake, setMapShake] = useState(0);
  const [mapRefresh, setMapRefresh] = useState(0);
  const onMap = tab === 'all' && !plaza && !neoOnly;
  const [open, setOpen] = useState<SaturnPostView | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [composer, setComposer] = useState<false | { replyTo?: SaturnPostView; quote?: SaturnPostView }>(false);
  const [tabPosts, setTabPosts] = useState<SaturnPostView[] | null>(null);
  const [stageW, setStageW] = useState(390);
  const [allReplies, setAllReplies] = useState(false);
  // the replies / reply / quote sheet opened from the bubble's 💬
  const [detail, setDetail] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const tail = useRef<HTMLSpanElement>(null);
  const [replies, setReplies] = useState<SaturnPostView[]>([]);
  const [activeReply, setActiveReply] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  // replays the squish of a tapped character
  const stage = useRef<HTMLDivElement>(null);
  const layer = useRef<PuniLayerHandle>(null);
  const openRef = useRef<string | null>(null);
  const openPostRef = useRef<SaturnPostView | null>(null);
  const detailRef = useRef(false);
  const meIdRef = useRef<string | undefined>(undefined);
  // the Day 4 tutorial keeps voices on screen (you star the one you just heard)
  const tutorialRef = useRef(neoOnly);
  tutorialRef.current = neoOnly;
  const scopeRef = useRef('');

  useEffect(() => {
    getApi()
      .saturnFeed()
      .then((p) => setPosts(p.items))
      .catch(() => setPosts([]));
    return () => stopAudio();
  }, []);

  // voices you have heard pop like soap bubbles and stay gone (remembered on this device)
  const heardKey = `obolo.saturn.heard.${me?.id ?? 'guest'}`;
  const [heard, setHeard] = useState<Set<string>>(new Set());
  const [bursts, setBursts] = useState<{ key: number; x: number; y: number; r: number; rainbow?: boolean }[]>([]);
  useEffect(() => {
    try {
      setHeard(new Set(JSON.parse(localStorage.getItem(heardKey) ?? '[]') as string[]));
    } catch {
      setHeard(new Set());
    }
  }, [heardKey]);
  const remember = (next: Set<string> | ((cur: Set<string>) => Set<string>)) => {
    setHeard((cur) => {
      const n = typeof next === 'function' ? next(cur) : next;
      try {
        localStorage.setItem(heardKey, JSON.stringify([...n].slice(-600)));
      } catch {
        /* private mode: only for this visit */
      }
      return n;
    });
  };
  const popRef = useRef<(id: string) => void>(() => {});
  // みんな's ひろば: popped voices turn into rainbows
  const denseRef = useRef(false);
  const pendingPop = useRef<string | null>(null);

  useEffect(
    () =>
      subscribeAudio((st) => {
        setPlayingUrl(st.playing ? st.url : null);
        // the opened voice played to the end → it pops (not your own, not while its sheet is open)
        const id = openRef.current;
        const p = id ? openPostRef.current : null;
        if (!st.playing && st.progress >= 0.97 && p && st.url === p.voiceUrl && p.author.id !== meIdRef.current && !tutorialRef.current) {
          if (detailRef.current) pendingPop.current = p.id;
          else popRef.current(p.id);
        }
      }),
    [],
  );

  // Real posts first, topped up with sample residents so the world never feels empty.
  const all = useMemo(() => {
    const real = posts;
    const fill = SATURN_RESIDENTS.slice(0, Math.max(0, 16 - real.length));
    return [...real, ...fill];
  }, [posts]);

  // フォロー / ダチ (every planet has みんな・フォロー・ダチ): real posts only, fetched when the tab opens
  // only so many on the planet at once; when one pops, the next voice drops in from the sky
  const [tabCursor, setTabCursor] = useState<string | null>(null);
  const loadingMore = useRef(false);
  const plazaId = tab === 'all' && !neoOnly ? (plaza?.id ?? null) : null;
  // inside a ひろば: lots of small characters piled up
  const dense = !!plazaId;
  denseRef.current = dense;
  const fromList = tab !== 'all' || !!plazaId;
  useEffect(() => {
    if (tab === 'all' && !plazaId) return;
    let live = true;
    setTabPosts(null);
    setTabCursor(null);
    getApi()
      .saturnFeed(undefined, true, tab, 50, plazaId ?? undefined)
      .then((p) => {
        if (!live) return;
        setTabPosts(p.items);
        setTabCursor(p.nextCursor);
      })
      .catch(() => live && setTabPosts([]));
    return () => {
      live = false;
    };
  }, [tab, plazaId]);

  // inside a ひろば: its voices, topped up with a few residents while it is quiet
  const source = useMemo(() => {
    if (!fromList) return onMap ? [] : all;
    const real = tabPosts ?? [];
    if (tab !== 'all' || !tabPosts || real.length >= PLAZA_MIN) return real;
    // residents (repeated with their own ids when the crowd needs more of them)
    const h = hueOf(plazaId ?? '');
    const n = SATURN_RESIDENTS.length;
    const fill = Array.from({ length: PLAZA_MIN - real.length }, (_, k) => {
      const r = SATURN_RESIDENTS[(h + k) % n];
      return k < n ? r : { ...r, id: `${r.id}~${k}` };
    });
    return [...real, ...fill];
  }, [fromList, onMap, all, tabPosts, tab, plazaId]);
  const unheard = useMemo(() => source.filter((p) => !heard.has(p.id)), [source, heard]);
  const cap = tab === 'all' ? (plazaId ? TAB_CAP.plaza : Infinity) : TAB_CAP[tab];
  const shown = useMemo(() => unheard.slice(0, cap), [unheard, cap]);
  scopeRef.current = `${tab}:${plazaId}`;

  // running low on voices waiting in line → fetch the next page
  useEffect(() => {
    if (!fromList || !tabPosts || !tabCursor || loadingMore.current || unheard.length > cap) return;
    loadingMore.current = true;
    const key = `${tab}:${plazaId}`;
    getApi()
      .saturnFeed(tabCursor, true, tab, 50, plazaId ?? undefined)
      .then((p) => {
        if (key !== scopeRef.current) return;
        setTabPosts((cur) => {
          const have = new Set((cur ?? []).map((x) => x.id));
          return [...(cur ?? []), ...p.items.filter((x) => !have.has(x.id))];
        });
        setTabCursor(p.nextCursor);
      })
      .catch(() => setTabCursor(null))
      .finally(() => {
        loadingMore.current = false;
      });
  }, [fromList, tab, plazaId, tabPosts, tabCursor, unheard.length, cap]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStageW(el.clientWidth));
    ro.observe(el);
    setStageW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // everyone as a soft body: their look (or a simple one in a colour of their own), size varies a little
  const items = useMemo<PuniItem[]>(
    () =>
      shown.map((p) => {
        const h = hueOf(p.author.id);
        return {
          id: p.id,
          look: p.author.look ?? defaultLook(COLORS[h % COLORS.length]),
          pic: p.author.pic ?? null,
          photo: p.photoUrl ?? null,
          R: dense
            ? Math.max(14, Math.min(30, stageW * 0.028 * (1 + (hueOf(p.id) % 3) * 0.12))) * (1 + (popScale(p) - 1) * 0.6)
            : Math.min(
            stageW * (tab === 'friends' ? 0.16 : 0.12),
            Math.max(30, Math.min(84, stageW * (0.05 + (hueOf(p.id) % 4) * 0.008))) * (tab === 'friends' ? FRIENDS_SCALE : 1) * popScale(p),
          ),
        };
      }),
    [shown, stageW, tab, dense],
  );
  const speakingId = shown.find((p) => p.voiceUrl === playingUrl)?.id ?? null;

  // the speech bubble follows the tapped character, always above it (never over the buttons)
  const onFrame = useCallback((get: (id: string) => { x: number; y: number; R: number } | undefined, W: number) => {
    const id = openRef.current;
    const el = card.current;
    if (!id || !el) return;
    const b = get(id);
    if (!b) return;
    const cw = el.offsetWidth;
    const ch = el.offsetHeight;
    const left = Math.max(12, Math.min(W - cw - 12, b.x - cw / 2));
    // under the header at most; near the top it may overlap the character a little
    const top = Math.max(150, b.y - b.R * 1.1 - ch - 16);
    el.style.transform = `translate(${left}px, ${top}px)`;
    el.style.opacity = '1';
    if (tail.current) tail.current.style.left = `${Math.max(22, Math.min(cw - 22, b.x - left))}px`;
  }, []);

  openPostRef.current = open;
  detailRef.current = detail;
  meIdRef.current = me?.id;
  popRef.current = (id: string) => {
    const b = layer.current?.blob(id);
    if (b) setBursts((cur) => [...cur.slice(-8), { key: Date.now() + Math.random(), x: b.x, y: b.y, r: b.R, rainbow: denseRef.current }]);
    playPop(b ? Math.min(1, b.R / 120) : 0.5);
    if (openRef.current === id) close();
    remember((cur) => new Set(cur).add(id));
  };
  // the sheet closed after the voice ended: pop now
  useEffect(() => {
    if (!detail && pendingPop.current) {
      const id = pendingPop.current;
      pendingPop.current = null;
      popRef.current(id);
    }
  }, [detail]);

  const listen = useCallback(
    (p: SaturnPostView) => {
      unlockPop();
      openRef.current = p.id;
      setOpen(p);
      setActiveReply(null);
      void toggleAudio(p.voiceUrl).catch(() => undefined);
      events?.onListen?.();
    },
    [events],
  );

  // the answers under the opened voice (sample residents answer each other)
  useEffect(() => {
    setReplies([]);
    if (!open) return;
    if (open.id.startsWith('resident-')) return setReplies(residentReplies(open.id));
    let on = true;
    getApi()
      .saturnReplies(open.id)
      .then((r) => on && setReplies(r))
      .catch(() => undefined);
    return () => {
      on = false;
    };
  }, [open?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const playReply = (r: SaturnPostView) => {
    setActiveReply(r.id);
    void toggleAudio(r.voiceUrl).catch(() => undefined);
  };

  const close = () => {
    openRef.current = null;
    setOpen(null);
    setDetail(false);
    setAllReplies(false);
    setActiveReply(null);
    stopAudio();
  };

  const star = async (p: SaturnPostView) => {
    const on = !p.starredByMe;
    const upd = (x: SaturnPostView) => (x.id === p.id ? { ...x, starredByMe: on, starCount: x.starCount + (on ? 1 : -1) } : x);
    setOpen((o) => (o ? upd(o) : o));
    if (p.id.startsWith('resident-')) {
      const r = SATURN_RESIDENTS.find((x) => x.id === p.id);
      if (r) Object.assign(r, upd(r));
      setPosts((cur) => [...cur]);
      setTabPosts((cur) => (cur ? [...cur] : cur));
    } else {
      setPosts((cur) => cur.map(upd));
      setTabPosts((cur) => (cur ? cur.map(upd) : cur));
      getApi()
        .starSaturnPost(p.id, on)
        .catch(() => undefined);
    }
    if (on) events?.onStar?.();
  };

  const shake = () => (onMap ? setMapShake(Date.now()) : layer.current?.shake());

  const enterPlaza = (p: PlazaView | null) => {
    close();
    setPlaza(p);
    if (!p) setMapRefresh(Date.now());
  };

  const omakase = async () => {
    // on the map: into a ひろば where someone is talking
    if (onMap) {
      const list = await getApi()
        .plazas()
        .catch(() => []);
      const talking = list.filter((x) => x.voiceCount > 0);
      const pool = talking.length ? talking : list;
      if (pool.length) enterPlaza(pool[Math.floor(Math.random() * pool.length)]);
      return;
    }
    if (!shown.length) return;
    const p = shown[Math.floor(Math.random() * shown.length)];
    layer.current?.poke(p.id);
    listen(p);
  };

  const onPosted = (p: SaturnPostView, into?: PlazaView | null) => {
    // a reply joins the row under its post instead of floating in the world
    if (p.replyToId) {
      setComposer(false);
      setReplies((cur) => [...cur, p]);
      const bump = (x: SaturnPostView) => (x.id === p.replyToId ? { ...x, replyCount: (x.replyCount ?? 0) + 1 } : x);
      setPosts((cur) => cur.map(bump));
      setOpen((o) => (o ? bump(o) : o));
      setTimeout(() => playReply(p), 400);
      events?.onPosted?.();
      return;
    }
    setPosts((cur) => [p, ...cur]);
    if (p.repostOf) setPosts((cur) => cur.map((x) => (x.id === p.repostOf!.id ? { ...x, repostCount: (x.repostCount ?? 0) + 1 } : x)));
    setComposer(false);
    // dropped from the map into a ひろば: go there (its list is fetched fresh, with the new voice)
    if (onMap) {
      if (into) {
        setPlaza(into);
        setTimeout(() => listen(p), 1600);
      }
      events?.onPosted?.();
      return;
    }
    if (fromList) setTabPosts((cur) => [p, ...(cur ?? []).filter((x) => x.id !== p.id)]);
    // it drops in from the sky; play your own voice once it has landed
    setTimeout(() => listen(p), 1300);
    events?.onPosted?.();
  };

  const online = shown.length + 47;
  const shownReplies = allReplies ? replies : replies.slice(0, 5);
  const resident = !!open?.id.startsWith('resident-');

  return (
    <div className={`relative h-full w-full select-none overflow-hidden ${className}`} style={{ fontFamily: '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Hiragino Sans", system-ui, sans-serif' }}>
      {/* sky: violet → pink, stars and sparkles, a golden orb and a pale moon */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#2f2268] via-[#6d48b0] to-[#e6a3cf]" />
      <div className="starfield" aria-hidden />
      {SPARKLES.map(([x, y, r], i) => (
        <svg key={i} className="pointer-events-none absolute animate-[twinkle_3s_ease-in-out_infinite]" style={{ left: `${x}%`, top: `${y}%`, width: r * 2, height: r * 2, animationDelay: `${(i % 6) * 0.45}s` }} viewBox={`${-r} ${-r} ${r * 2} ${r * 2}`} aria-hidden>
          <path d={sparkle(0, 0, r)} fill="#fff" />
        </svg>
      ))}
      <div className="pointer-events-none absolute right-[13%] top-[25%] h-[6vmin] min-h-10 w-[6vmin] min-w-10 rounded-full" style={{ background: 'radial-gradient(circle at 35% 30%, #fff6cf 0%, #f8c25a 45%, #e58f2c 100%)', boxShadow: '0 0 24px rgba(255,200,110,.55)' }} />
      <div className="pointer-events-none absolute left-[11%] top-[36%] h-[3.4vmin] min-h-6 w-[3.4vmin] min-w-6 rounded-full" style={{ background: 'radial-gradient(circle at 35% 30%, #ffffff 0%, #d9d2ff 60%, #b4a8f0 100%)', boxShadow: '0 0 16px rgba(220,210,255,.6)' }} />
      {/* the rings, seen from the surface: wide translucent arcs with dotted lines */}
      {!onMap && (
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {[
          [62, 44, 9],
          [74, 54, 6],
          [86, 64, 7],
        ].map(([rx, ry, w], i) => (
          <g key={i}>
            <path d={`M ${50 - rx} 82 A ${rx} ${ry} 0 0 1 ${50 + rx} 82`} fill="none" stroke="#e7dcff" strokeOpacity={0.14 + i * 0.03} strokeWidth={w} vectorEffect="non-scaling-stroke" style={{ strokeWidth: `${w * 0.9}vmin` }} />
            <path d={`M ${50 - rx} 82 A ${rx} ${ry} 0 0 1 ${50 + rx} 82`} fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth={1.6} strokeDasharray="1 7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </svg>
      )}
      {/* the planet: concentric peach / pink stripes following its horizon */}
      {!onMap && (
      <div
        className="pointer-events-none absolute rounded-[50%]"
        style={{
          left: `${50 - PLANET.rx * 100}%`,
          width: `${PLANET.rx * 200}%`,
          top: `${PLANET.top * 100}%`,
          height: `${PLANET.ry * 200}%`,
          background:
            'repeating-radial-gradient(ellipse farthest-side at 50% 50%, #ffdccf 0 3%, #fcc8cc 3% 6%, #f7b6cf 6% 9%, #ffe4d8 9% 12%, #fff4ee 12% 12.6%)',
          boxShadow: 'inset 0 10px 18px rgba(255,255,255,.65), 0 -10px 40px rgba(255,190,225,.55)',
        }}
      />
      )}

      {/* みんな: the ひろば map */}
      {onMap && <PlazaMap onEnter={enterPlaza} shakeKey={mapShake} refreshKey={mapRefresh} />}

      {/* characters: soft bodies on the planet */}
      <div ref={stage} className="absolute inset-0">
        <PuniPhysicsLayer ref={layer} items={items} floorAt={(x, W, H) => surfaceY(x, W, H) + Math.min(W, H) * 0.02} onTap={(id) => {
          const p = shown.find((x) => x.id === id);
          if (p) listen(p);
        }} onTapEmpty={close} onFrame={onFrame} speakingId={speakingId} />
      </div>

      {/* soap-bubble pops of the voices you heard */}
      {bursts.map((bu) => (
        bu.rainbow ? (
          <RainbowBurst key={bu.key} x={bu.x} y={bu.y} r={bu.r} onDone={() => setBursts((cur) => cur.filter((x) => x.key !== bu.key))} />
        ) : (
          <BubbleBurst key={bu.key} x={bu.x} y={bu.y} r={bu.r} onDone={() => setBursts((cur) => cur.filter((x) => x.key !== bu.key))} />
        )
      ))}
      {tab === 'all' && !onMap && source.length > 0 && shown.length === 0 && (
        <div className="absolute inset-x-0 top-[38%] z-[70] flex flex-col items-center gap-2 px-6 text-center">
          <p className="rounded-2xl bg-white/85 px-4 py-2 text-sm font-black text-[#5a3f8a] shadow">いまの声は、ぜんぶ聞いたよ。新しい声を待ってね</p>
          <button onClick={() => remember(new Set())} className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-bold text-[#7a62b0]">
            聞いた声をもう一度ならべる
          </button>
        </div>
      )}

      {/* header */}
      <div className="pt-safe absolute inset-x-0 top-0 z-[80] px-4">
        <div className="mt-2 flex items-center justify-between">
          <span className="flex items-center gap-2 text-2xl font-black tracking-wide text-white drop-shadow-[0_2px_0_rgba(80,40,140,.45)]">
            <SaturnIcon /> ころりんぱ
          </span>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-black text-[#4a3570] shadow-[0_3px_0_#e3cfae]">
              <StarIcon /> {all.reduce((a, p) => a + (p.author.id === me?.id ? p.starCount : 0), 0) || 0}
            </span>
            {me && (
              <button onClick={() => setProfileId(me.id)} className="flex h-11 w-11 items-center justify-center overflow-visible rounded-full border-[3px] border-white bg-[#4a3a6e] shadow-[0_3px_0_rgba(60,30,110,.35)]" aria-label="my page">
                <PuniAvatar seed={me.id} neo={me.neoForm} look={me.look} pic={me.puniPic} size={34} />
              </button>
            )}
          </div>
        </div>
        <div className="mx-auto mt-3 flex w-fit gap-1 rounded-full border border-white/25 bg-white/15 p-1 backdrop-blur">
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => (k === 'all' && tab === 'all' && plaza ? enterPlaza(null) : setTab(k))} className={`rounded-full px-5 py-1.5 text-sm font-black transition ${tab === k ? 'bg-white text-[#4a3570] shadow-[0_3px_0_#e3cfae]' : 'text-white/90'}`}>
              {label}
            </button>
          ))}
        </div>
        {tab !== 'all' && tabPosts && !tabPosts.length && (
          <p className="mx-auto mt-2 w-fit max-w-[90%] rounded-2xl bg-white/85 px-3 py-1.5 text-center text-[11px] font-bold text-[#5a3f8a]">
            {tab === 'friends' ? 'ダチは、おたがいにフォローしている人。名前をタップしてページからフォローしてね' : 'まだ誰もフォローしていないよ。名前をタップして、その人のページからフォローしてね'}
          </p>
        )}
        {tab === 'all' && plaza ? (
          <div className="mx-auto mt-2 flex w-fit max-w-[94%] items-center gap-1.5 rounded-full bg-white/90 py-1 pl-1 pr-1 shadow">
            <button onClick={() => enterPlaza(null)} className="flex h-8 items-center gap-1 rounded-full bg-[#f3ecff] px-3 text-[12px] font-black text-[#5a3f8a]" aria-label="back to map">
              ← ひろば
            </button>
            <span className="text-lg leading-none">{plaza.icon}</span>
            <span className="min-w-0 truncate text-sm font-black text-[#3d2a5c]">{plaza.name}</span>
            <span className="shrink-0 text-[11px] font-bold text-[#8a76bd]">👤{plaza.memberCount.toLocaleString()}</span>
            <button
              onClick={() =>
                void getApi()
                  .joinPlaza(plaza.id, !plaza.joined)
                  .then(setPlaza)
                  .catch(() => undefined)
              }
              className={`h-8 shrink-0 rounded-full px-3 text-[12px] font-black ${plaza.joined ? 'bg-pink-100 text-pink-500' : 'bg-gradient-to-r from-pink-400 to-violet-400 text-white'}`}
            >
              {plaza.joined ? '参加中' : '参加する'}
            </button>
          </div>
        ) : (
          <p className="mx-auto mt-2 w-fit rounded-full bg-white/75 px-3.5 py-1 text-[12px] font-bold text-[#5a3f8a]">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-pink-400 align-middle" />
            いま土星に {online} 人がころりん中
          </p>
        )}
      </div>

      {/* the speech bubble: just the words, over the tapped character (positioned by the loop);
          replies and stars as small badges at its lower right */}
      {open && (
        <div ref={card} className="pointer-events-none absolute left-0 top-0 z-[90] opacity-0">
          <div className="relative w-max max-w-[min(270px,calc(100vw-24px))] animate-[fadeUp_0.2s_ease-out] rounded-[22px] bg-white px-4 py-2.5 text-[16px] font-black leading-snug text-[#3d2a5c] shadow-[0_10px_30px_rgba(60,20,110,.28)]">
            <span ref={tail} className="absolute -bottom-2 h-4 w-4 -translate-x-1/2 rotate-45 rounded-[3px] bg-white" />
            {open.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={open.photoUrl} alt="" className="relative mb-1.5 h-28 w-28 rounded-full border-[3px] border-violet-50 object-cover" />
            )}
            <span className="relative line-clamp-5 pb-1.5 pr-2">{open.text}</span>
            <span className="pointer-events-auto absolute -bottom-3 -right-3 flex gap-1">
              <button onClick={() => setProfileId(open.author.id)} className="flex h-7 items-center gap-1 rounded-full border border-violet-100 bg-white py-0 pl-0.5 pr-2 text-[11px] font-black text-[#7a62b0] shadow" aria-label="profile">
                <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-[#f3ecff]">
                  <PuniAvatar seed={open.author.id} neo={open.author.neoForm} look={open.author.look} pic={open.author.pic} size={22} />
                </span>
                <span className="max-w-[5.5em] truncate">{open.author.displayName}</span>
                <span className="text-[#b4a3d8]">›</span>
              </button>
              <button onClick={() => setDetail(true)} className="flex h-7 items-center gap-1 rounded-full border border-violet-100 bg-white px-2 text-[11px] font-black text-[#7a62b0] shadow" aria-label="replies">
                💬 {replies.length}
              </button>
              <button onClick={() => void star(open)} className={`flex h-7 items-center gap-0.5 rounded-full border px-2 text-[11px] font-black shadow ${open.starredByMe ? 'border-amber-200 bg-amber-50 text-amber-500' : 'border-violet-100 bg-white text-[#7a62b0]'}`} aria-label="star">
                {open.starredByMe ? '★' : '☆'} {open.starCount}
              </button>
            </span>
          </div>
        </div>
      )}

      {/* the details (from 💬): who, replies to listen to, answer by voice, quote */}
      {open && detail && (
        <div className="absolute inset-0 z-[94] flex items-end justify-center bg-violet-950/40" onClick={() => setDetail(false)}>
          <div className="pb-safe max-h-[75%] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-4 text-[#3d2a5c]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <button onClick={() => setProfileId(open.author.id)} className="flex min-w-0 items-center gap-2 text-left" aria-label="profile">
                <PuniAvatar seed={open.author.id} neo={open.author.neoForm} look={open.author.look} pic={open.author.pic} size={34} />
                <span className="truncate text-base font-black">{open.author.displayName}</span>
                <span className="shrink-0 text-[11px] font-bold text-[#a08fc4]">{resident ? 'サンプル' : lifeLeft(open.createdAt)}</span>
              </button>
              <button onClick={() => setDetail(false)} className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f3ecff] text-[#7a62b0]" aria-label="close">
                ✕
              </button>
            </div>
            <p className="mt-2 text-sm font-bold leading-relaxed text-slate-600">{open.text}</p>
            {open.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={open.photoUrl} alt="" className="mx-auto mt-2 block aspect-square w-[min(260px,70%)] rounded-full border-4 border-white object-cover shadow" />
            )}
            {open.repostOf && (
              <button onClick={() => void toggleAudio(open.repostOf!.voiceUrl).catch(() => undefined)} className="mt-2 flex w-full items-center gap-2 rounded-2xl bg-[#f8f3ff] p-2 text-left">
                <PuniAvatar seed={open.repostOf.author.id} neo={open.repostOf.author.neoForm} look={open.repostOf.author.look} pic={open.repostOf.author.pic} size={28} speaking={playingUrl === open.repostOf.voiceUrl} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-black text-[#a08fc4]">🔁 {open.repostOf.author.displayName}の声</span>
                  <span className="block truncate text-xs font-bold">{open.repostOf.text}</span>
                </span>
                <span className="text-xs text-[#7a62b0]">{playingUrl === open.repostOf.voiceUrl ? '❚❚' : '▶'}</span>
              </button>
            )}
            <div className="mt-3 rounded-[22px] bg-[#f6f0ff] p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#8a76bd]">💬 リプ {replies.length}</span>
                <span className="text-[10px] font-bold text-[#b3a5d6]">{replies.length ? 'アイコンをタップできくよ' : resident ? 'サンプルには返信できないよ' : 'まだリプはないよ'}</span>
              </div>
              {(() => {
                const a = replies.find((x) => x.id === activeReply);
                return a ? (
                  <p className="mt-2 animate-[fadeUp_0.2s_ease-out] rounded-2xl rounded-bl-sm bg-white px-3 py-1.5 text-sm font-black shadow-sm">
                    <span className="mr-1 text-[10px] text-[#a08fc4]">{a.author.displayName}</span>
                    {a.text}
                  </p>
                ) : null;
              })()}
              {!!replies.length && (
                <div className="mt-2 flex items-center overflow-x-auto py-1 pl-1">
                  {shownReplies.map((rp, i) => (
                    <button
                      key={rp.id}
                      onClick={() => playReply(rp)}
                      className={`relative shrink-0 rounded-full border-[3px] bg-white ${activeReply === rp.id ? 'z-10 border-pink-300' : 'border-white'}`}
                      style={{ marginLeft: i ? -12 : 0 }}
                      aria-label={`${rp.author.displayName}: ${rp.text}`}
                    >
                      <PuniAvatar seed={rp.author.id} neo={rp.author.neoForm} look={rp.author.look} pic={rp.author.pic} size={42} speaking={playingUrl === rp.voiceUrl} bounce={activeReply === rp.id ? `${rp.id}-on` : undefined} />
                    </button>
                  ))}
                  {replies.length > 5 && !allReplies && (
                    <button onClick={() => setAllReplies(true)} className="-ml-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[3px] border-white bg-white text-sm font-black text-[#8a76bd] shadow-sm">
                      +{replies.length - 5}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => !resident && setComposer({ replyTo: open })}
                disabled={resident}
                className="flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#fbd0e8] to-[#e7d2ff] py-2.5 text-sm font-black text-[#5a3f8a] disabled:opacity-50"
              >
                <MicIcon size={16} /> 声でかえす
              </button>
              <button onClick={() => !resident && setComposer({ quote: open })} disabled={resident} className="rounded-full bg-[#f3ecff] py-2.5 text-sm font-black text-[#5a3f8a] disabled:opacity-50">
                🔁 引用 {open.repostCount ?? 0}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* bottom bar */}
      <div className="pb-safe absolute inset-x-0 bottom-0 z-[85] flex justify-center px-4 pb-4">
        <div className="flex items-center gap-1 rounded-[30px] bg-white/95 px-3 py-2 shadow-[0_8px_30px_rgba(80,30,130,.25)]">
          <button onClick={shake} className="flex w-16 flex-col items-center gap-0.5 text-[11px] font-black text-[#6b5a8a]">
            <ShakeIcon />
            ゆらす
          </button>
          <button
            onClick={() => {
              close();
              setComposer({});
            }}
            className={`flex items-center gap-2 rounded-full bg-gradient-to-r from-[#f39bd0] to-[#c3a2ff] px-7 py-3.5 text-lg font-black text-white shadow-[0_4px_0_rgba(160,90,200,.35)] ${highlightDrop ? 'animate-pulse ring-4 ring-pink-200' : ''}`}
            data-kororin="drop"
          >
            <MicIcon size={20} /> 声をおとす
          </button>
          <button onClick={() => void omakase()} className="flex w-16 flex-col items-center gap-0.5 text-[11px] font-black text-[#6b5a8a]">
            <RandomIcon />
            おまかせ
          </button>
        </div>
      </div>

      {composer && (
        <DropComposer
          replyTo={composer.replyTo}
          quote={composer.quote}
          plaza={tab === 'all' && !neoOnly ? plaza : null}
          choosePlaza={onMap && !composer.replyTo}
          onClose={() => setComposer(false)}
          onPosted={onPosted}
        />
      )}
      {profileId && (
        <SaturnProfile
          userId={profileId}
          playingUrl={playingUrl}
          onClose={() => setProfileId(null)}
          onOpenPost={(p) => {
            setProfileId(null);
            listen(p);
          }}
        />
      )}
      {overlay}
    </div>
  );
}


/** The tabs every planet uses (client decision 2026-10-07): everyone / people you follow / mutual follows. */
const TABS: [Tab, string][] = [
  ['all', 'みんな'],
  ['following', 'フォロー'],
  ['friends', 'ダチ'],
];

/** How many characters a tab shows at once (client decision 2026-10-07; みんな/セカイ is still being designed). */
const TAB_CAP: Record<Exclude<Tab, 'all'> | 'plaza', number> = { following: 22, friends: 8, plaza: 30 };
/** A quiet ひろば is topped up with residents so it looks like a crowd (P-SAT-15). */
const PLAZA_MIN = 30;
/** ダチ are few, so they are drawn bigger. */
const FRIENDS_SCALE = 1.45;

/**
 * Popular voices grow (client decision 2026-10-07): stars and replies make a character bigger,
 * on a gentle log curve up to ×1.6 (☆10 ≈ ×1.26, ☆100 ≈ ×1.5). A reply counts as two stars.
 * Not on みんな yet (being designed).
 */
function popScale(p: SaturnPostView): number {
  const score = p.starCount + 2 * (p.replyCount ?? 0);
  return 1 + Math.min(0.6, Math.log10(1 + Math.max(0, score)) * 0.25);
}

/** The planet's horizon (share of the stage): an ellipse whose top edge is the ground. */
const PLANET = { top: 0.67, rx: 0.78, ry: 0.5 };

function surfaceY(x: number, W: number, H: number) {
  const rx = PLANET.rx * W;
  const ry = PLANET.ry * H;
  const cy = PLANET.top * H + ry;
  const dx = Math.min(0.999, Math.abs(x - W / 2) / rx);
  return cy - ry * Math.sqrt(1 - dx * dx);
}

/** Where the little 4-point sparkles sit in the sky: [x %, y %, size px]. */
const SPARKLES: [number, number, number][] = [
  [8, 22, 7], [18, 9, 5], [27, 31, 6], [42, 16, 4], [55, 26, 6], [66, 11, 5], [78, 19, 7], [88, 30, 5], [93, 12, 6], [35, 44, 4], [72, 40, 5], [12, 47, 5],
];

const sparkle = (x: number, y: number, r: number) => `M${x},${y - r} Q${x + r * 0.18},${y - r * 0.18} ${x + r},${y} Q${x + r * 0.18},${y + r * 0.18} ${x},${y + r} Q${x - r * 0.18},${y + r * 0.18} ${x - r},${y} Q${x - r * 0.18},${y - r * 0.18} ${x},${y - r}Z`;

function SaturnIcon() {
  return (
    <svg width="38" height="26" viewBox="0 0 38 26" aria-hidden>
      <ellipse cx="19" cy="14" rx="17" ry="6" fill="none" stroke="#9fe7e0" strokeWidth="3" transform="rotate(-12 19 14)" />
      <circle cx="19" cy="13" r="8.5" fill="#ffc7a8" />
      <path d="M2.6,17.2 A17,6 -12 0 0 35.4,10.8" fill="none" stroke="#9fe7e0" strokeWidth="3" transform="rotate(0)" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.5l1.3-6.6L2.5 9.3l6.6-.8z" fill="#ffcc3d" stroke="#e5a91c" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function MicIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <rect x="8.5" y="3" width="7" height="12" rx="3.5" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function ShakeIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6b5a8a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
    </svg>
  );
}

function RandomIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6b5a8a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 11a8 8 0 0 0-14.3-4.5M4 13a8 8 0 0 0 14.3 4.5M5 3v4h4M19 21v-4h-4" />
    </svg>
  );
}

/** A soap bubble popping: an iridescent ring that bursts into droplets (CSS, ~0.6 s). */
function BubbleBurst({ x, y, r, onDone }: { x: number; y: number; r: number; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => done.current(), 700);
    return () => clearTimeout(t);
  }, []);
  const size = r * 2.3;
  return (
    <div className="pointer-events-none absolute z-[60]" style={{ left: x - size / 2, top: y - size / 2, width: size, height: size }}>
      <span
        className="absolute inset-0 animate-[bubbleRing_0.45s_ease-out_forwards] rounded-full"
        style={{ background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,.85), rgba(255,255,255,0) 30%), conic-gradient(from 30deg, #ffc6ea, #c9b8ff, #a8f0ff, #d8ffc6, #fff3b0, #ffc6ea)', mask: 'radial-gradient(circle, transparent 58%, #000 61%)', WebkitMask: 'radial-gradient(circle, transparent 58%, #000 61%)' }}
      />
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        const d = size * (0.62 + (i % 3) * 0.12);
        return (
          <span
            key={i}
            className="absolute left-1/2 top-1/2 animate-[bubbleDrop_0.6s_ease-out_forwards] rounded-full bg-white/90"
            style={{ width: 5 + (i % 3) * 2, height: 5 + (i % 3) * 2, ['--dx' as string]: `${Math.cos(a) * d}px`, ['--dy' as string]: `${Math.sin(a) * d}px`, boxShadow: '0 0 6px rgba(200,180,255,.9)' }}
          />
        );
      })}
    </div>
  );
}

/** なぞる pop (みんな's ひろば): the character turns into a little rainbow that rises and fades. */
const RAINBOW = ['#ff6b8b', '#ffa14f', '#ffe066', '#7ee08a', '#5cc8ff', '#7a8cff', '#c38bff'];
function RainbowBurst({ x, y, r, onDone }: { x: number; y: number; r: number; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => done.current(), 1050);
    return () => clearTimeout(t);
  }, []);
  const w = Math.max(70, r * 4);
  return (
    <div className="pointer-events-none absolute z-[60]" style={{ left: x - w / 2, top: y - w / 2, width: w, height: w }}>
      <svg className="absolute inset-0 animate-[rainbowUp_1s_ease-out_forwards]" viewBox="-50 -50 100 100" aria-hidden>
        {RAINBOW.map((c, i) => (
          <path key={c} d={`M ${-40 + i * 4} 8 A ${40 - i * 4} ${40 - i * 4} 0 0 1 ${40 - i * 4} 8`} fill="none" stroke={c} strokeWidth="5.5" strokeLinecap="round" />
        ))}
      </svg>
      {RAINBOW.map((c, i) => {
        const a = (i / RAINBOW.length) * Math.PI * 2;
        return (
          <span
            key={c}
            className="absolute left-1/2 top-1/2 animate-[bubbleDrop_0.7s_ease-out_forwards] rounded-full"
            style={{ width: 7, height: 7, background: c, ['--dx' as string]: `${Math.cos(a) * w * 0.55}px`, ['--dy' as string]: `${Math.sin(a) * w * 0.55}px`, boxShadow: `0 0 6px ${c}` }}
          />
        );
      })}
    </div>
  );
}

/** "のこり 12時間": how long a voice stays on Saturn (they vanish after 88 hours). */
function lifeLeft(createdAt: string) {
  const h = SATURN_LIFETIME_HOURS - (Date.now() - new Date(createdAt).getTime()) / 3600_000;
  return h <= 1 ? 'まもなく消える' : `のこり${Math.floor(h)}時間`;
}

/** The reading styles, as the "バティに読んでもらう" choices. */
const READ_LABELS: Record<string, string> = {
  genki: '元気に読む',
  yukkuri: 'ゆっくり読む',
  hayakuchi: '早口で読む',
  hikui: '低い声で読む',
  takai: '高い声で読む',
  sasayaki: 'ささやき声で読む',
  sakebu: '叫んで読む',
};

/**
 * 声をおとす (client decisions 2026-10-07): the mic is for typing — tap the big mic, speak, tap
 * again; the words appear at the cursor (fix a part: tap / select it, delete, speak again).
 * Every post is read by Bati (the member's registered Bati voice) in a chosen reading style;
 * nobody's raw recording is used (noise). Without a registered Bati voice a temporary one reads.
 */
function DropComposer({
  onClose,
  onPosted,
  replyTo,
  quote,
  plaza,
  choosePlaza = false,
}: {
  onClose: () => void;
  onPosted: (p: SaturnPostView, into?: PlazaView | null) => void;
  /** dropped in this ひろば (inside one) */
  plaza?: PlazaView | null;
  /** from the map: pick which ひろば to drop it in */
  choosePlaza?: boolean;
  /** answering this voice (the reply lines up under it) */
  replyTo?: SaturnPostView;
  /** quoting this voice (🔁, with your own words and voice) */
  quote?: SaturnPostView;
}) {
  const { me } = useAuth();
  const hasBatiVoice = !!me?.voices?.bati;
  // previews cost a voice call: keep the last one for the same text + style
  const [preview, setPreview] = useState<{ key: string; url: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [style, setStyle] = useState(VOICE_STYLES[0].id);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  // 📷 写真もつける: the character holds it on the planet
  // (fitted into the round frame first: photos on Saturn are round)
  const [photo, setPhoto] = useState<{ blob: Blob; preview: string } | null>(null);
  const [cropping, setCropping] = useState<File | null>(null);
  const [places, setPlaces] = useState<PlazaView[]>([]);
  const [into, setInto] = useState<PlazaView | null>(plaza ?? null);
  useEffect(() => {
    if (!choosePlaza) return;
    getApi()
      .plazas()
      .then((l) => {
        const sorted = [...l.filter((x) => x.joined), ...l.filter((x) => !x.joined)].slice(0, 12);
        setPlaces(sorted);
        setInto((cur) => cur ?? sorted.find((x) => x.joined) ?? null);
      })
      .catch(() => undefined);
  }, [choosePlaza]);
  const mic = useDictation({ field: box, value: text, onChange: setText, maxLength: SATURN_MAX_CHARS * 2 });
  const left = SATURN_MAX_CHARS - [...text].length;
  const canPost = !!text.trim() && left >= 0 && !busy && !mic.listening;

  const listen = async () => {
    const t = text.trim();
    if (!t) return;
    // no registered Bati voice yet: the device's reading voice stands in
    if (!hasBatiVoice) return void toggleAudio(neoVoiceUrl(style, me?.neoForm, t)).catch(() => undefined);
    const key = `${style}:${t}`;
    setErr(null);
    try {
      let url = preview?.key === key ? preview.url : null;
      if (!url) {
        setPreviewing(true);
        url = (await getApi().speak({ slot: 'bati', text: t, style })).url;
        setPreview({ key, url });
      }
      await toggleAudio(url);
    } catch {
      setErr('バティが読めなかった…もう一度');
    } finally {
      setPreviewing(false);
    }
  };

  const post = async () => {
    mic.stop();
    setBusy(true);
    setErr(null);
    try {
      const where = replyTo ? null : into;
      const photoMediaId = photo ? (await getApi().uploadPhoto(photo.blob)).id : undefined;
      const target = { ...(replyTo ? { replyToId: replyTo.id } : {}), ...(quote ? { repostOfId: quote.id } : {}), ...(where ? { plazaId: where.id } : {}), ...(photoMediaId ? { photoMediaId } : {}) };
      onPosted(await getApi().createSaturnPost({ text: text.trim(), voiceStyle: style, readBy: 'bati', ...target }), where);
    } catch {
      setErr('うまく落とせなかった…もう一度');
      setBusy(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-[95] flex items-end justify-center bg-violet-950/50"
      onClick={() => {
        mic.stop();
        onClose();
      }}
    >
      <div className="pb-safe max-h-[92%] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 text-slate-800" onClick={(e) => e.stopPropagation()}>
        <p className="text-center text-sm font-black text-violet-600">
          {replyTo ? `${replyTo.author.displayName}に、声で返信` : quote ? '声を引用して、ひとこと' : 'いまの気持ちを、声でおとす'}
        </p>
        {(replyTo ?? quote) && (
          <div className="mt-2 flex items-center gap-2 rounded-2xl bg-violet-50 p-2">
            <PuniAvatar seed={(replyTo ?? quote)!.author.id} neo={(replyTo ?? quote)!.author.neoForm} look={(replyTo ?? quote)!.author.look} pic={(replyTo ?? quote)!.author.pic} size={26} />
            <p className="min-w-0 flex-1 truncate text-xs text-slate-600">{(replyTo ?? quote)!.text}</p>
          </div>
        )}

        {!replyTo && plaza && (
          <p className="mt-1 text-center text-[11px] font-bold text-[#8a76bd]">
            {plaza.icon} {plaza.name} に落とすよ
          </p>
        )}
        {choosePlaza && (
          <div className="mt-3">
            <p className="text-xs font-black text-[#8a76bd]">どのひろばに落とす？</p>
            <div className="mt-1 flex gap-2 overflow-x-auto pb-1">
              {places.map((x) => (
                <button key={x.id} onClick={() => setInto(x)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${into?.id === x.id ? 'bg-violet-500 text-white' : 'bg-violet-50 text-[#7a62b0]'}`}>
                  {x.icon} {x.name}
                </button>
              ))}
              <button onClick={() => setInto(null)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${!into ? 'bg-violet-500 text-white' : 'bg-violet-50 text-[#7a62b0]'}`}>
                ひろばに置かない
              </button>
            </div>
            {!into && <p className="mt-0.5 text-[10px] text-slate-400">ひろばに置かない声は、フォロー・ダチの人にだけ届くよ</p>}
          </div>
        )}

        {/* the mic types the words */}
        <div className="mt-4">
          <MicButton listening={mic.listening} interim={mic.interim} supported={mic.supported} error={mic.error} onToggle={mic.toggle} />
        </div>
        <textarea
          ref={box}
          className={`mt-3 h-24 w-full resize-none rounded-2xl p-3 text-[16px] outline-none ${mic.listening ? 'bg-pink-50 ring-2 ring-pink-200' : 'bg-violet-50'}`}
          placeholder={replyTo ? '🎙 を押して、どう返すか話してね' : quote ? '🎙 を押して、この声についてひとこと' : '🎙 を押して、いま思ったことを話してね'}
          maxLength={SATURN_MAX_CHARS * 2}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mt-1 flex items-start justify-between gap-2 text-[10px] text-slate-400">
          <span>直したいところをタップ（なぞって選ぶ）→ 消して → もう一度 🎙</span>
          <span className={`shrink-0 text-xs ${left < 0 ? 'text-rose-500' : ''}`}>{left}</span>
        </div>

        {/* 📷 a photo to go with it: your character holds it */}
        <div className="mt-3 flex items-center gap-3">
          <label className="shrink-0 cursor-pointer whitespace-nowrap rounded-full bg-sky-50 px-4 py-2 text-xs font-black text-sky-700">
            📷 {photo ? '写真をかえる' : '写真もつける'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) setCropping(f);
              }}
            />
          </label>
          {photo && (
            <span className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.preview} alt="" className="h-14 w-14 rounded-full border-[3px] border-white object-cover shadow" />
              <button onClick={() => setPhoto(null)} className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-500 text-[10px] font-black text-white" aria-label="remove photo">
                ✕
              </button>
            </span>
          )}
          {photo && <span className="text-[10px] text-slate-400">あなたのキャラに、この写真がついてころがるよ</span>}
        </div>
        {cropping && (
          <PhotoCropper
            file={cropping}
            onCancel={() => setCropping(null)}
            onDone={(blob) => {
              setCropping(null);
              setPhoto({ blob, preview: URL.createObjectURL(blob) });
            }}
          />
        )}

        {/* Bati reads it */}
        <p className="mt-3 text-xs font-black text-amber-700">🐣 バティがどんなふうに読む？</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {VOICE_STYLES.map((v) => (
            <button
              key={v.id}
              onClick={() => setStyle(v.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${style === v.id ? 'bg-amber-400 text-white' : 'bg-amber-50 text-amber-700'}`}
            >
              {READ_LABELS[v.id] ?? v.label}
            </button>
          ))}
        </div>
        <button onClick={() => void listen()} disabled={!text.trim() || previewing} className="mt-2 w-full rounded-full bg-amber-50 py-2 text-xs font-bold text-amber-700 disabled:opacity-40">
          {previewing ? 'バティが読んでいます…' : '▶ バティの声で聞いてみる'}
        </button>
        {!hasBatiVoice && (
          <a href="/voice" className="mt-2 block text-center text-[10px] font-bold text-amber-600 underline">
            バティの声を登録すると、あなたのバティの声で読んでくれるよ →
          </a>
        )}

        {err && <p className="mt-2 text-xs text-rose-500">{err}</p>}
        <button
          disabled={!canPost}
          onClick={() => void post()}
          className="mt-4 w-full rounded-full bg-gradient-to-r from-pink-400 to-violet-400 py-3.5 text-base font-black text-white disabled:opacity-40"
        >
          {busy ? 'おとしています…' : replyTo ? '💬 返信する' : quote ? '🔁 引用しておとす' : '🎙 土星におとす'}
        </button>
      </div>
    </div>
  );
}
