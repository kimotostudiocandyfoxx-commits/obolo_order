'use client';

import { neoVoiceUrl, SATURN_LIFETIME_HOURS, SATURN_MAX_CHARS, VOICE_STYLES, type SaturnPostView } from '@obolo/shared';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getApi } from '@/lib/api';
import { stopAudio, subscribeAudio, toggleAudio } from '@/lib/audio';
import { useAuth } from '@/lib/auth';
import { residentReplies, SATURN_RESIDENTS } from '@/lib/saturnResidents';
import { useRecorder } from '@/lib/useRecorder';
import { PuniAvatar } from '@/components/puni/PuniAvatar';
import { PuniPhysicsLayer, type PuniItem, type PuniLayerHandle } from '@/components/puni/PuniPhysicsLayer';
import { COLORS, defaultLook } from '@/lib/puni/parts';
import { hueOf } from './BallAvatar';
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
  /** Only the NEO voice can be used to post (Day 4 tutorial). */
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
  const [open, setOpen] = useState<SaturnPostView | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [composer, setComposer] = useState<false | { replyTo?: SaturnPostView; quote?: SaturnPostView }>(false);
  const [tabPosts, setTabPosts] = useState<SaturnPostView[] | null>(null);
  const [stageW, setStageW] = useState(390);
  const [allReplies, setAllReplies] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const tail = useRef<HTMLSpanElement>(null);
  const [replies, setReplies] = useState<SaturnPostView[]>([]);
  const [activeReply, setActiveReply] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  // replays the squish of a tapped character
  const stage = useRef<HTMLDivElement>(null);
  const layer = useRef<PuniLayerHandle>(null);
  const openRef = useRef<string | null>(null);

  useEffect(() => {
    getApi()
      .saturnFeed()
      .then((p) => setPosts(p.items))
      .catch(() => setPosts([]));
    return () => stopAudio();
  }, []);

  useEffect(() => subscribeAudio((s) => setPlayingUrl(s.playing ? s.url : null)), []);

  // Real posts first, topped up with sample residents so the world never feels empty.
  const all = useMemo(() => {
    const real = posts;
    const fill = SATURN_RESIDENTS.slice(0, Math.max(0, 16 - real.length));
    return [...real, ...fill];
  }, [posts]);

  // フォロー / ダチ (every planet has みんな・フォロー・ダチ): real posts only, fetched when the tab opens
  useEffect(() => {
    if (tab === 'all') return;
    setTabPosts(null);
    getApi()
      .saturnFeed(undefined, true, tab)
      .then((p) => setTabPosts(p.items))
      .catch(() => setTabPosts([]));
  }, [tab]);

  const shown = useMemo(() => (tab === 'all' ? all : (tabPosts ?? [])), [all, tab, tabPosts]);

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
          R: Math.max(30, Math.min(84, stageW * (0.05 + (hueOf(p.id) % 4) * 0.008))),
        };
      }),
    [shown, stageW],
  );
  const speakingId = shown.find((p) => p.voiceUrl === playingUrl)?.id ?? null;

  // the post card follows the tapped character (above it, or below near the top)
  const onFrame = useCallback((get: (id: string) => { x: number; y: number; R: number } | undefined, W: number) => {
    const id = openRef.current;
    const el = card.current;
    if (!id || !el) return;
    const b = get(id);
    if (!b) return;
    const cw = el.offsetWidth;
    const ch = el.offsetHeight;
    const left = Math.max(12, Math.min(W - cw - 12, b.x - cw / 2));
    const above = b.y - b.R * 1.15 - ch - 14;
    const below = above < 96;
    const top = below ? b.y + b.R * 1.05 + 14 : above;
    el.style.transform = `translate(${left}px, ${top}px)`;
    el.style.opacity = '1';
    if (tail.current) {
      tail.current.style.left = `${Math.max(24, Math.min(cw - 24, b.x - left))}px`;
      tail.current.style.top = below ? '-8px' : '';
      tail.current.style.bottom = below ? '' : '-8px';
    }
  }, []);

  const listen = useCallback(
    (p: SaturnPostView) => {
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
    } else {
      setPosts((cur) => cur.map(upd));
      getApi()
        .starSaturnPost(p.id, on)
        .catch(() => undefined);
    }
    if (on) events?.onStar?.();
  };

  const shake = () => layer.current?.shake();

  const omakase = () => {
    if (!shown.length) return;
    const p = shown[Math.floor(Math.random() * shown.length)];
    layer.current?.poke(p.id);
    listen(p);
  };

  const onPosted = (p: SaturnPostView) => {
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
      {/* the planet: concentric peach / pink stripes following its horizon */}
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

      {/* characters: soft bodies on the planet */}
      <div ref={stage} className="absolute inset-0">
        <PuniPhysicsLayer ref={layer} items={items} floorAt={(x, W, H) => surfaceY(x, W, H) + Math.min(W, H) * 0.02} onTap={(id) => {
          const p = shown.find((x) => x.id === id);
          if (p) listen(p);
        }} onTapEmpty={close} onFrame={onFrame} speakingId={speakingId} />
      </div>

      {/* header */}
      <div className="pt-safe absolute inset-x-0 top-0 z-[80] px-4">
        <div className="mt-2 flex items-center justify-between">
          <span className="flex items-center gap-2 text-2xl font-black tracking-wide text-white drop-shadow-[0_2px_0_rgba(80,40,140,.45)]">
            <SaturnIcon /> ころりん
          </span>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-black text-[#4a3570] shadow-[0_3px_0_#e3cfae]">
              <StarIcon /> {all.reduce((a, p) => a + (p.author.id === me?.id ? p.starCount : 0), 0) || 0}
            </span>
            {me && (
              <button onClick={() => setProfileId(me.id)} className="flex h-11 w-11 items-center justify-center overflow-visible rounded-full border-[3px] border-white bg-[#4a3a6e] shadow-[0_3px_0_rgba(60,30,110,.35)]" aria-label="my page">
                <PuniAvatar seed={me.id} neo={me.neoForm} look={me.look} size={34} />
              </button>
            )}
          </div>
        </div>
        <div className="mx-auto mt-3 flex w-fit gap-1 rounded-full border border-white/25 bg-white/15 p-1 backdrop-blur">
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-full px-5 py-1.5 text-sm font-black transition ${tab === k ? 'bg-white text-[#4a3570] shadow-[0_3px_0_#e3cfae]' : 'text-white/90'}`}>
              {label}
            </button>
          ))}
        </div>
        {tab !== 'all' && tabPosts && !tabPosts.length && (
          <p className="mx-auto mt-2 w-fit max-w-[90%] rounded-2xl bg-white/85 px-3 py-1.5 text-center text-[11px] font-bold text-[#5a3f8a]">
            {tab === 'friends' ? 'ダチは、おたがいにフォローしている人。名前をタップしてページからフォローしてね' : 'まだ誰もフォローしていないよ。名前をタップして、その人のページからフォローしてね'}
          </p>
        )}
        <p className="mx-auto mt-2 w-fit rounded-full bg-white/75 px-3.5 py-1 text-[12px] font-bold text-[#5a3f8a]">
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-pink-400 align-middle" />
          いま土星に {online} 人がころりん中
        </p>
      </div>

      {/* the post card, floating over the tapped character (positioned by the loop) */}
      {open && (
        <div ref={card} className="absolute left-0 top-0 z-[90] w-[min(330px,calc(100%-24px))] rounded-[28px] bg-white p-4 text-[#3d2a5c] opacity-0 shadow-[0_12px_40px_rgba(60,20,110,.28)]">
          <span ref={tail} className="absolute h-4 w-4 -translate-x-1/2 rotate-45 rounded-[3px] bg-white" />
          <div className="relative flex items-center gap-2">
            <button onClick={() => setProfileId(open.author.id)} className="flex min-w-0 items-baseline gap-2 text-left" aria-label="profile">
              <span className="truncate text-base font-black">{open.author.displayName}</span>
              <span className="shrink-0 text-[11px] font-bold text-[#a08fc4]">{resident ? 'サンプル' : lifeLeft(open.createdAt)}</span>
            </button>
            {!resident && (
              <button onClick={() => setComposer({ quote: open })} className="ml-auto flex h-8 shrink-0 items-center gap-1 rounded-full bg-[#f3ecff] px-2.5 text-xs font-black text-[#7a62b0]" aria-label="quote">
                🔁 {open.repostCount ?? 0}
              </button>
            )}
            <button onClick={close} className={`${resident ? 'ml-auto' : ''} flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f3ecff] text-[#7a62b0]`} aria-label="close">
              ✕
            </button>
          </div>
          <p className="relative mt-2 max-h-[30vh] overflow-y-auto text-[17px] font-black leading-relaxed">{open.text}</p>
          {open.repostOf && (
            <button onClick={() => void toggleAudio(open.repostOf!.voiceUrl).catch(() => undefined)} className="relative mt-2 flex w-full items-center gap-2 rounded-2xl bg-[#f8f3ff] p-2 text-left">
              <PuniAvatar seed={open.repostOf.author.id} neo={open.repostOf.author.neoForm} look={open.repostOf.author.look} size={28} speaking={playingUrl === open.repostOf.voiceUrl} />
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-black text-[#a08fc4]">🔁 {open.repostOf.author.displayName}の声</span>
                <span className="block truncate text-xs font-bold">{open.repostOf.text}</span>
              </span>
              <span className="text-xs text-[#7a62b0]">{playingUrl === open.repostOf.voiceUrl ? '❚❚' : '▶'}</span>
            </button>
          )}
          {/* replies: overlapping little characters, tap one to hear it */}
          <div className="relative mt-3 rounded-[22px] bg-[#f6f0ff] p-3">
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
                    <PuniAvatar seed={rp.author.id} neo={rp.author.neoForm} look={rp.author.look} size={42} speaking={playingUrl === rp.voiceUrl} bounce={activeReply === rp.id ? `${rp.id}-on` : undefined} />
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
          <div className="relative mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => void star(open)} className={`rounded-full py-2.5 text-sm font-black ${open.starredByMe ? 'bg-amber-100 text-amber-600' : 'bg-[#f3ecff] text-[#5a3f8a]'}`}>
              {open.starredByMe ? '★' : '☆'} {open.starCount}
            </button>
            <button
              onClick={() => !resident && setComposer({ replyTo: open })}
              disabled={resident}
              className="flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#fbd0e8] to-[#e7d2ff] py-2.5 text-sm font-black text-[#5a3f8a] disabled:opacity-50"
            >
              <MicIcon size={16} /> 声でかえす
            </button>
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
          <button onClick={omakase} className="flex w-16 flex-col items-center gap-0.5 text-[11px] font-black text-[#6b5a8a]">
            <RandomIcon />
            おまかせ
          </button>
        </div>
      </div>

      {composer && <DropComposer neoOnly={neoOnly} replyTo={composer.replyTo} quote={composer.quote} onClose={() => setComposer(false)} onPosted={onPosted} />}
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

/** "のこり 12時間": how long a voice stays on Saturn (they vanish after 88 hours). */
function lifeLeft(createdAt: string) {
  const h = SATURN_LIFETIME_HOURS - (Date.now() - new Date(createdAt).getTime()) / 3600_000;
  return h <= 1 ? 'まもなく消える' : `のこり${Math.floor(h)}時間`;
}

/**
 * 声をおとす: write a short line and drop it onto Saturn, read aloud either
 *  - by the NEO voice in a chosen style (OBOLO NEO members; client decision 2026-10-04),
 *  - by the member's own registered voice in a chosen style (Fish Audio, P-SAT-5), or
 *  - with a recording of your own voice.
 */
function DropComposer({
  onClose,
  onPosted,
  neoOnly,
  replyTo,
  quote,
}: {
  onClose: () => void;
  onPosted: (p: SaturnPostView) => void;
  neoOnly: boolean;
  /** answering this voice (the reply lines up under it) */
  replyTo?: SaturnPostView;
  /** quoting this voice (🔁, with your own words and voice) */
  quote?: SaturnPostView;
}) {
  const { me } = useAuth();
  const rec = useRecorder();
  const [mode, setMode] = useState<'neo' | 'own' | 'record'>('neo');
  // own-voice previews cost a Fish call: keep the last one for the same text + style
  const [ownPreview, setOwnPreview] = useState<{ key: string; url: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const hasOwnVoice = !!me?.voices?.self;
  const [style, setStyle] = useState(VOICE_STYLES[0].id);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const left = SATURN_MAX_CHARS - [...text].length;
  const canPost = !!text.trim() && left >= 0 && !busy && (mode === 'neo' || (mode === 'own' && hasOwnVoice) || (!!rec.blob && !rec.recording));

  const preview = async () => {
    const t = text.trim();
    if (!t) return;
    if (mode === 'neo') return void toggleAudio(neoVoiceUrl(style, me?.neoForm, t)).catch(() => undefined);
    const key = `${style}:${t}`;
    setErr(null);
    try {
      let url = ownPreview?.key === key ? ownPreview.url : null;
      if (!url) {
        setPreviewing(true);
        url = (await getApi().speak({ slot: 'self', text: t, style })).url;
        setOwnPreview({ key, url });
      }
      await toggleAudio(url);
    } catch {
      setErr('自分の声で読めなかった…もう一度');
    } finally {
      setPreviewing(false);
    }
  };

  const post = async () => {
    setBusy(true);
    setErr(null);
    try {
      const target = { ...(replyTo ? { replyToId: replyTo.id } : {}), ...(quote ? { repostOfId: quote.id } : {}) };
      if (mode === 'neo' || mode === 'own') {
        onPosted(await getApi().createSaturnPost({ text: text.trim(), voiceStyle: style, ...(mode === 'own' ? { ownVoice: true } : {}), ...target }));
      } else {
        if (!rec.blob) return;
        const media = await getApi().uploadVoice(rec.blob);
        onPosted(await getApi().createSaturnPost({ text: text.trim(), voiceMediaId: media.id, voiceDurationSec: rec.duration, ...target }));
      }
    } catch {
      setErr('うまく落とせなかった…もう一度');
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[95] flex items-end justify-center bg-violet-950/50" onClick={onClose}>
      <div className="pb-safe w-full max-w-md rounded-t-3xl bg-white p-5 text-slate-800" onClick={(e) => e.stopPropagation()}>
        <p className="text-center text-sm font-black text-violet-600">
          {replyTo ? `${replyTo.author.displayName}に、声で返信` : quote ? '声を引用して、ひとこと' : 'いまの気持ちを、声でおとす'}
        </p>
        {(replyTo ?? quote) && (
          <div className="mt-2 flex items-center gap-2 rounded-2xl bg-violet-50 p-2">
            <PuniAvatar seed={(replyTo ?? quote)!.author.id} neo={(replyTo ?? quote)!.author.neoForm} look={(replyTo ?? quote)!.author.look} size={26} />
            <p className="min-w-0 flex-1 truncate text-xs text-slate-600">{(replyTo ?? quote)!.text}</p>
          </div>
        )}
        {!neoOnly && (
          <div className="mx-auto mt-3 flex w-fit gap-1 rounded-full bg-violet-50 p-1">
            {(
              [
                ['neo', 'ネオの声'],
                ['own', '自分の声（AI）'],
                ['record', '自分で録音'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} onClick={() => setMode(k)} className={`rounded-full px-4 py-1.5 text-xs font-bold ${mode === k ? 'bg-violet-500 text-white' : 'text-violet-500'}`}>
                {label}
              </button>
            ))}
          </div>
        )}
        <textarea
          className="mt-3 h-24 w-full resize-none rounded-2xl bg-violet-50 p-3 text-[16px] outline-none"
          placeholder={replyTo ? 'どう返す？' : quote ? 'この声について、ひとこと' : 'なんでもいい。いま思ったことを書いてみて'}
          maxLength={SATURN_MAX_CHARS * 2}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mt-1 text-right text-xs text-slate-400">
          <span className={left < 0 ? 'text-rose-500' : ''}>{left}</span>
        </div>

        {mode === 'own' && !hasOwnVoice ? (
          <a href="/voice" className="mt-2 block rounded-2xl bg-violet-50 p-3 text-center text-xs font-bold text-violet-600">
            自分の声で読んでもらうには、先に声を登録してね →
          </a>
        ) : mode !== 'record' ? (
          <>
            <p className="mt-1 text-xs font-black text-violet-600">どんな感じで読んでもらう？</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {VOICE_STYLES.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setStyle(v.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${style === v.id ? 'bg-violet-500 text-white' : 'bg-violet-50 text-violet-600'}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => void preview()}
              disabled={!text.trim() || previewing}
              className="mt-3 w-full rounded-full bg-violet-100 py-2.5 text-sm font-bold text-violet-700 disabled:opacity-40"
            >
              {previewing ? '自分の声で読んでいます…' : mode === 'own' ? '▶ 自分の声で聞いてみる' : '▶ ネオの声で聞いてみる'}
            </button>
          </>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            {!rec.recording && !rec.blob && (
              <button onClick={() => void rec.start()} className="rounded-full bg-rose-400 px-4 py-2 text-sm font-bold text-white">
                ● 録音
              </button>
            )}
            {rec.recording && (
              <button onClick={rec.stop} className="animate-pulse rounded-full bg-rose-500 px-4 py-2 text-sm font-bold text-white">
                ■ 停止 {rec.elapsed}秒
              </button>
            )}
            {rec.blob && !rec.recording && (
              <button onClick={() => void rec.start()} className="rounded-full bg-violet-100 px-4 py-2 text-sm font-bold text-violet-600">
                ↺ 録り直す（{rec.duration.toFixed(1)}秒）
              </button>
            )}
          </div>
        )}
        {rec.error && mode === 'record' && <p className="mt-2 text-xs text-rose-500">{rec.error === 'denied' ? 'マイクを許可してください' : 'このブラウザでは録音できません'}</p>}
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
