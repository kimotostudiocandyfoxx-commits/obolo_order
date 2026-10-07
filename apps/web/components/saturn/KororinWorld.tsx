'use client';

import { neoVoiceUrl, SATURN_LIFETIME_HOURS, SATURN_MAX_CHARS, VOICE_STYLES, type SaturnPostView } from '@obolo/shared';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getApi } from '@/lib/api';
import { stopAudio, subscribeAudio, toggleAudio } from '@/lib/audio';
import { useAuth } from '@/lib/auth';
import { residentReplies, SATURN_RESIDENTS } from '@/lib/saturnResidents';
import { useRecorder } from '@/lib/useRecorder';
import { PuniAvatar } from '@/components/puni/PuniAvatar';
import { hueOf } from './BallAvatar';
import { SaturnProfile } from './SaturnProfile';

/**
 * 「ころりん」 — Saturn's voice world (client concept, 2026-10-04).
 * Everyone's posts become round chibi avatars that drift along Saturn's rings or roll on the ground.
 * Tap one → it squishes and stops, its words pop up in a speech bubble and the poster's voice
 * plays (the card below holds stars, replies, quote). Everyone is drawn as the ぷにぷに character
 * they dressed on their profile (or the plain ball). Voices vanish after 88 hours.
 * Bottom bar: ゆらす (shake) · 声をおとす (record & drop your voice) · おまかせ (play a random voice).
 * Under an opened voice, the people who answered line up as little balls: tap one → its voice
 * plays with a speech bubble. Names open the person's page (follow); 🔁 quotes the voice.
 */
type Tab = 'all' | 'following' | 'starred';

export interface KororinEvents {
  onListen?: () => void;
  onStar?: () => void;
  onPosted?: () => void;
}

interface Mover {
  post: SaturnPostView;
  kind: 'ring' | 'ground';
  ring: number; // which ring (0..2)
  t: number; // phase
  speed: number;
  size: number;
}

const RINGS = [
  { cy: 0.36, rx: 0.44, ry: 0.09 },
  { cy: 0.47, rx: 0.5, ry: 0.12 },
  { cy: 0.59, rx: 0.56, ry: 0.15 },
];

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
  const [followingPosts, setFollowingPosts] = useState<SaturnPostView[] | null>(null);
  const [replies, setReplies] = useState<SaturnPostView[]>([]);
  const [activeReply, setActiveReply] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  // replays the squish of a tapped character
  const [bounce, setBounce] = useState<Record<string, number>>({});
  const [shaking, setShaking] = useState(false);
  const [dropped, setDropped] = useState<string | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLButtonElement>());
  const movers = useRef<Mover[]>([]);
  const paused = useRef<string | null>(null);

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

  // フォロー中: the people you follow (and you) — real posts only, fetched when the tab opens
  useEffect(() => {
    if (tab !== 'following') return;
    getApi()
      .saturnFeed(undefined, true, 'following')
      .then((p) => setFollowingPosts(p.items))
      .catch(() => setFollowingPosts([]));
  }, [tab]);

  const shown = useMemo(
    () => (tab === 'starred' ? all.filter((p) => p.starredByMe) : tab === 'following' ? (followingPosts ?? []) : all),
    [all, tab, followingPosts],
  );

  // (re)build movers when the set changes, keeping existing ones (and their phase) in place
  useMemo(() => {
    const prev = new Map(movers.current.map((m) => [m.post.id, m]));
    movers.current = shown.map((post, i) => {
      const old = prev.get(post.id);
      if (old) return { ...old, post };
      const h = hueOf(post.id);
      const ground = i % 3 === 2;
      return {
        post,
        kind: ground ? 'ground' : 'ring',
        ring: i % 3,
        t: (h / 360) * Math.PI * 2,
        speed: (0.025 + ((h % 7) / 7) * 0.035) * (h % 2 ? 1 : -1),
        size: ground ? 64 + (h % 16) : 46 + (h % 18),
      } satisfies Mover;
    });
  }, [shown]);

  // animation loop: positions written straight to the DOM (no React re-render per frame)
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const el = stage.current;
      if (el) {
        const W = el.clientWidth;
        const H = el.clientHeight;
        for (const m of movers.current) {
          const node = nodes.current.get(m.post.id);
          if (!node) continue;
          if (paused.current !== m.post.id) m.t += m.speed * dt * (m.kind === 'ground' ? 1.4 : 1);
          let x: number, y: number, scale: number, z: number, rot = 0;
          if (m.kind === 'ring') {
            const r = RINGS[m.ring];
            x = W / 2 + Math.cos(m.t) * r.rx * W;
            y = H * r.cy + Math.sin(m.t) * r.ry * H;
            const depth = (Math.sin(m.t) + 1) / 2; // 0 = back, 1 = front
            scale = 0.7 + depth * 0.45;
            z = Math.round(10 + depth * 40);
          } else {
            // roll left/right along the ground arc
            const u = (Math.sin(m.t) + 1) / 2;
            x = W * (0.08 + u * 0.84);
            const gx = (x - W / 2) / (W * 0.9);
            y = H * 0.8 + gx * gx * H * 0.12;
            scale = 1;
            z = 60;
            rot = (Math.cos(m.t) * m.speed > 0 ? 1 : -1) * ((m.t * 180) % 360);
          }
          node.style.transform = `translate(${x - m.size / 2}px, ${y - m.size / 2}px) scale(${scale})`;
          node.style.zIndex = String(paused.current === m.post.id ? 75 : z);
          if (paused.current === m.post.id) {
            // keep the speech bubble (≤ 240 px wide) inside the screen
            const half = 124;
            const shift = x - half < 8 ? 8 - (x - half) : x + half > W - 8 ? W - 8 - (x + half) : 0;
            node.style.setProperty('--bubble-shift', `${shift}px`);
          }
          const inner = node.firstElementChild as HTMLElement | null;
          if (inner) inner.style.transform = m.kind === 'ground' && paused.current !== m.post.id ? `rotate(${rot * 0.15}deg)` : '';
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const listen = useCallback(
    (p: SaturnPostView) => {
      paused.current = p.id;
      setOpen(p);
      setActiveReply(null);
      setBounce((b) => ({ ...b, [p.id]: Date.now() }));
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
    paused.current = null;
    setOpen(null);
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

  const shake = () => {
    setShaking(true);
    for (const m of movers.current) m.speed *= -1.15;
    setTimeout(() => {
      setShaking(false);
      for (const m of movers.current) m.speed /= 1.15;
    }, 600);
  };

  const omakase = () => {
    const pool = movers.current;
    if (pool.length) listen(pool[Math.floor(Math.random() * pool.length)].post);
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
    setDropped(p.id);
    setComposer(false);
    setTimeout(() => setDropped(null), 1600);
    // play your own voice right after it lands
    setTimeout(() => listen(p), 1300);
    events?.onPosted?.();
  };

  const online = shown.length + 47;

  return (
    <div className={`relative h-full w-full select-none overflow-hidden ${className}`} style={{ fontFamily: '"Hiragino Maru Gothic ProN", "Hiragino Sans", system-ui, sans-serif' }}>
      {/* sky + planet */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#2b1b5c] via-[#6b3fa3] to-[#f4a3c4]" />
      <div className="starfield" aria-hidden />
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {RINGS.map((r, i) => (
          <ellipse key={i} cx="50" cy={r.cy * 100} rx={r.rx * 100} ry={r.ry * 100} fill="none" stroke="#fff" strokeOpacity={0.18 + i * 0.06} strokeWidth={0.5 + i * 0.25} strokeDasharray={i === 1 ? '0.6 1.4' : undefined} />
        ))}
      </svg>
      <div
        className="pointer-events-none absolute left-1/2 top-[72%] h-[120%] w-[190%] -translate-x-1/2 rounded-[50%]"
        style={{
          background:
            'repeating-radial-gradient(ellipse at 50% 0%, #ffd8c2 0 3%, #ffc0b0 3% 6%, #f7a8b8 6% 9%, #ffdcc8 9% 12%)',
          boxShadow: '0 -20px 60px rgba(255,200,220,.5)',
        }}
      />
      <div className="pointer-events-none absolute right-[14%] top-[22%] h-12 w-12 rounded-full bg-gradient-to-br from-amber-100 to-amber-400 opacity-80 blur-[1px]" />

      {/* balls */}
      <div ref={stage} className={`absolute inset-0 ${shaking ? 'animate-[shake_0.3s_ease-in-out_2]' : ''}`}>
        {shown.map((p) => {
          const m = movers.current.find((x) => x.post.id === p.id);
          const size = m?.size ?? 56;
          return (
            <button
              key={p.id}
              ref={(el) => {
                if (el) nodes.current.set(p.id, el);
                else nodes.current.delete(p.id);
              }}
              onClick={() => listen(p)}
              className="absolute left-0 top-0 will-change-transform"
              style={{ width: size, height: size }}
              aria-label={`${p.author.displayName}: ${p.text}`}
            >
              <span className={`block ${dropped === p.id ? 'animate-[dropIn_1.2s_cubic-bezier(.3,1.4,.6,1)]' : ''}`}>
                <PuniAvatar seed={p.author.id} neo={p.author.neoForm} look={p.author.look} size={size} speaking={playingUrl === p.voiceUrl} bounce={bounce[p.id]} />
              </span>
              {open?.id === p.id && (
                <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 w-max max-w-[240px]" style={{ transform: 'translateX(calc(-50% + var(--bubble-shift, 0px)))' }}>
                  <span className="relative block animate-[fadeUp_0.25s_ease-out] rounded-2xl bg-white px-3 py-2 text-left text-[14px] font-bold leading-snug text-slate-800 shadow-xl">
                    <span className="line-clamp-4">{p.text}</span>
                    <span className="absolute top-full border-x-8 border-t-8 border-x-transparent border-t-white" style={{ left: 'calc(50% - 8px - var(--bubble-shift, 0px))' }} />
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* header */}
      <div className="pt-safe absolute inset-x-0 top-0 z-[80] px-4">
        <div className="mt-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xl font-black text-white drop-shadow">🪐 ころりん</span>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-bold text-amber-600">⭐ {all.reduce((a, p) => a + (p.author.id === me?.id ? p.starCount : 0), 0) || 0}</span>
            {me && (
              <button onClick={() => setProfileId(me.id)} aria-label="my page">
                <PuniAvatar seed={me.id} neo={me.neoForm} look={me.look} size={34} />
              </button>
            )}
          </div>
        </div>
        <div className="mx-auto mt-3 flex w-fit gap-1 rounded-full bg-white/20 p-1 backdrop-blur">
          {(
            [
              ['all', 'みんな'],
              ['following', 'フォロー中'],
              ['starred', '星をあげた声'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-xs font-bold ${tab === k ? 'bg-white text-violet-700' : 'text-white'}`}>
              {label}
            </button>
          ))}
        </div>
        {tab === 'following' && followingPosts && !followingPosts.length && (
          <p className="mx-auto mt-2 w-fit max-w-[90%] rounded-2xl bg-white/85 px-3 py-1.5 text-center text-[11px] font-bold text-violet-600">
            まだ誰もフォローしていないよ。声の名前をタップして、その人のページからフォローしてね
          </p>
        )}
        <p className="mx-auto mt-2 w-fit rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-violet-700">
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-pink-400 align-middle" />
          いま土星に {online} 人がころりん中
        </p>
      </div>

      {/* speech card */}
      {open && (
        <div className="absolute inset-x-0 bottom-[calc(110px+env(safe-area-inset-bottom))] z-[90] flex justify-center px-4">
          <div className="w-full max-w-sm animate-[fadeUp_0.3s_ease-out] rounded-3xl bg-white p-4 text-slate-800 shadow-2xl">
            <div className="flex items-center gap-2">
              <button onClick={() => setProfileId(open.author.id)} className="flex min-w-0 items-center gap-2 text-left" aria-label="profile">
                <PuniAvatar seed={open.author.id} neo={open.author.neoForm} look={open.author.look} size={32} speaking={playingUrl === open.voiceUrl} />
                <span className="truncate font-black">{open.author.displayName}</span>
                <span className="truncate text-[11px] text-slate-400">@{open.author.handle}</span>
                <span className="shrink-0 text-[10px] text-pink-400">{lifeLeft(open.createdAt)}</span>
              </button>
              <button onClick={close} className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-500" aria-label="close">
                ×
              </button>
            </div>
            {/* the words are in the bubble over the character; long ones are repeated here in full */}
            {[...open.text].length > 60 && <p className="mt-2 text-sm font-bold leading-relaxed text-slate-600">{open.text}</p>}
            {open.repostOf && (
              <button
                onClick={() => void toggleAudio(open.repostOf!.voiceUrl).catch(() => undefined)}
                className="mt-2 flex w-full items-center gap-2 rounded-2xl border border-violet-100 bg-violet-50/60 p-2 text-left"
              >
                <PuniAvatar seed={open.repostOf.author.id} neo={open.repostOf.author.neoForm} look={open.repostOf.author.look} size={26} speaking={playingUrl === open.repostOf.voiceUrl} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-bold text-violet-400">🔁 {open.repostOf.author.displayName}の声</span>
                  <span className="block truncate text-xs text-slate-600">{open.repostOf.text}</span>
                </span>
                <span className="text-xs text-violet-500">{playingUrl === open.repostOf.voiceUrl ? '❚❚' : '▶'}</span>
              </button>
            )}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                onClick={() => void star(open)}
                className={`rounded-full py-2.5 text-sm font-bold ${open.starredByMe ? 'bg-amber-100 text-amber-600' : 'bg-violet-50 text-violet-600'}`}
              >
                {open.starredByMe ? '★' : '☆'} {open.starCount}
              </button>
              <button
                onClick={() => {
                  setActiveReply(null);
                  void toggleAudio(open.voiceUrl).catch(() => undefined);
                }}
                className="rounded-full bg-gradient-to-r from-pink-200 to-violet-200 py-2.5 text-sm font-bold text-violet-700"
              >
                {playingUrl === open.voiceUrl ? '❚❚' : '▶ きく'}
              </button>
              <button
                onClick={() => !open.id.startsWith('resident-') && setComposer({ quote: open })}
                disabled={open.id.startsWith('resident-')}
                className="rounded-full bg-violet-50 py-2.5 text-sm font-bold text-violet-600 disabled:opacity-40"
              >
                🔁 {open.repostCount ?? 0}
              </button>
            </div>

            {/* the answers: little balls in a row; tap → the voice plays with a speech bubble */}
            <div className="mt-3 border-t border-violet-50 pt-2">
              <p className="text-[10px] font-bold text-violet-400">💬 返信 {replies.length}</p>
              {(() => {
                const a = replies.find((x) => x.id === activeReply);
                return a ? (
                  <div className="mt-1.5 animate-[fadeUp_0.2s_ease-out] rounded-2xl rounded-bl-sm bg-violet-500 px-3 py-2 text-sm font-bold text-white">
                    <span className="mr-1 text-[10px] text-violet-200">{a.author.displayName}</span>
                    {a.text}
                  </div>
                ) : null;
              })()}
              <div className="-mx-1 mt-1.5 flex items-end gap-1.5 overflow-x-auto px-1 pb-1">
                {replies.map((rp) => (
                  <button key={rp.id} onClick={() => playReply(rp)} className={`relative shrink-0 rounded-full p-0.5 ${activeReply === rp.id ? 'ring-2 ring-violet-400' : ''}`} aria-label={`${rp.author.displayName}: ${rp.text}`}>
                    <PuniAvatar seed={rp.author.id} neo={rp.author.neoForm} look={rp.author.look} size={40} speaking={playingUrl === rp.voiceUrl} bounce={activeReply === rp.id ? `${rp.id}-on` : undefined} />
                  </button>
                ))}
                {!open.id.startsWith('resident-') ? (
                  <button
                    onClick={() => setComposer({ replyTo: open })}
                    className="flex h-11 shrink-0 items-center gap-1 rounded-full border-2 border-dashed border-violet-200 px-3 text-xs font-bold text-violet-500"
                  >
                    ＋ 声で返信
                  </button>
                ) : (
                  !replies.length && <span className="text-[10px] text-slate-400">サンプルの住人には返信できないよ</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* bottom bar */}
      <div className="pb-safe absolute inset-x-0 bottom-0 z-[85] flex justify-center px-4 pb-4">
        <div className="flex items-center gap-2 rounded-full bg-white/90 p-2 shadow-xl">
          <button onClick={shake} className="flex w-16 flex-col items-center text-[10px] font-bold text-violet-600">
            <span className="text-lg">⇄</span>ゆらす
          </button>
          <button
            onClick={() => {
              close();
              setComposer({});
            }}
            className={`rounded-full bg-gradient-to-r from-pink-400 to-violet-400 px-7 py-3.5 text-base font-black text-white shadow-lg ${highlightDrop ? 'animate-pulse ring-4 ring-pink-200' : ''}`}
            data-kororin="drop"
          >
            🎙 声をおとす
          </button>
          <button onClick={omakase} className="flex w-16 flex-col items-center text-[10px] font-bold text-violet-600">
            <span className="text-lg">↻</span>おまかせ
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
