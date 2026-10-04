'use client';

import { SATURN_MAX_CHARS, type SaturnPostView } from '@obolo/shared';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getApi } from '@/lib/api';
import { stopAudio, subscribeAudio, toggleAudio } from '@/lib/audio';
import { useAuth } from '@/lib/auth';
import { SATURN_RESIDENTS } from '@/lib/saturnResidents';
import { useRecorder } from '@/lib/useRecorder';
import { BallAvatar, hueOf } from './BallAvatar';

/**
 * 「ころりん」 — Saturn's voice world (client concept, 2026-10-04).
 * Everyone's posts become round chibi avatars that drift along Saturn's rings or roll on the ground.
 * Tap one → it stops, a speech card opens and the poster's voice plays.
 * Bottom bar: ゆらす (shake) · 声をおとす (record & drop your voice) · おまかせ (play a random voice).
 */
type Tab = 'all' | 'friends' | 'starred';

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
}: {
  events?: KororinEvents;
  /** Extra layer on top (tutorial coach). */
  overlay?: ReactNode;
  className?: string;
}) {
  const { me } = useAuth();
  const [posts, setPosts] = useState<SaturnPostView[]>([]);
  const [tab, setTab] = useState<Tab>('all');
  const [open, setOpen] = useState<SaturnPostView | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [composer, setComposer] = useState(false);
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

  const shown = useMemo(
    () => (tab === 'starred' ? all.filter((p) => p.starredByMe) : tab === 'friends' ? all.filter((p) => !p.id.startsWith('resident-')) : all),
    [all, tab],
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
          node.style.zIndex = String(z);
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
      void toggleAudio(p.voiceUrl).catch(() => undefined);
      events?.onListen?.();
    },
    [events],
  );

  const close = () => {
    paused.current = null;
    setOpen(null);
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
    setPosts((cur) => [p, ...cur]);
    setDropped(p.id);
    setComposer(false);
    setTimeout(() => setDropped(null), 1600);
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
                <BallAvatar seed={p.author.id} neo={p.author.neoForm} size={size} speaking={playingUrl === p.voiceUrl} />
              </span>
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
            {me && <BallAvatar seed={me.id} neo={me.neoForm} size={34} />}
          </div>
        </div>
        <div className="mx-auto mt-3 flex w-fit gap-1 rounded-full bg-white/20 p-1 backdrop-blur">
          {(
            [
              ['all', 'みんな'],
              ['friends', 'ともだち'],
              ['starred', '星をあげた声'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-xs font-bold ${tab === k ? 'bg-white text-violet-700' : 'text-white'}`}>
              {label}
            </button>
          ))}
        </div>
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
              <BallAvatar seed={open.author.id} neo={open.author.neoForm} size={32} speaking={playingUrl === open.voiceUrl} />
              <span className="font-black">{open.author.displayName}</span>
              <span className="text-[11px] text-slate-400">@{open.author.handle}</span>
              <button onClick={close} className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-violet-500" aria-label="close">
                ×
              </button>
            </div>
            <p className="mt-2 text-[17px] font-bold leading-relaxed">{open.text}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => void star(open)}
                className={`rounded-full py-2.5 text-sm font-bold ${open.starredByMe ? 'bg-amber-100 text-amber-600' : 'bg-violet-50 text-violet-600'}`}
              >
                {open.starredByMe ? '★' : '☆'} {open.starCount}
              </button>
              <button
                onClick={() => void toggleAudio(open.voiceUrl).catch(() => undefined)}
                className="rounded-full bg-gradient-to-r from-pink-200 to-violet-200 py-2.5 text-sm font-bold text-violet-700"
              >
                {playingUrl === open.voiceUrl ? '❚❚ 再生中' : '▶ もう一度きく'}
              </button>
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
              setComposer(true);
            }}
            className="rounded-full bg-gradient-to-r from-pink-400 to-violet-400 px-7 py-3.5 text-base font-black text-white shadow-lg"
            data-kororin="drop"
          >
            🎙 声をおとす
          </button>
          <button onClick={omakase} className="flex w-16 flex-col items-center text-[10px] font-bold text-violet-600">
            <span className="text-lg">↻</span>おまかせ
          </button>
        </div>
      </div>

      {composer && <DropComposer onClose={() => setComposer(false)} onPosted={onPosted} />}
      {overlay}
    </div>
  );
}

/** 声をおとす: write a short line, record it in your own voice, drop it onto Saturn. */
function DropComposer({ onClose, onPosted }: { onClose: () => void; onPosted: (p: SaturnPostView) => void }) {
  const rec = useRecorder();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const left = SATURN_MAX_CHARS - [...text].length;

  const post = async () => {
    if (!rec.blob) return;
    setBusy(true);
    setErr(null);
    try {
      const media = await getApi().uploadVoice(rec.blob);
      onPosted(await getApi().createSaturnPost({ text: text.trim(), voiceMediaId: media.id, voiceDurationSec: rec.duration }));
    } catch {
      setErr('うまく落とせなかった…もう一度');
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[95] flex items-end justify-center bg-violet-950/50" onClick={onClose}>
      <div className="pb-safe w-full max-w-md rounded-t-3xl bg-white p-5 text-slate-800" onClick={(e) => e.stopPropagation()}>
        <p className="text-center text-sm font-black text-violet-600">いまの気持ちを、声でおとす</p>
        <textarea
          className="mt-3 h-24 w-full resize-none rounded-2xl bg-violet-50 p-3 text-[16px] outline-none"
          placeholder="ひとこと（声といっしょに届きます）"
          maxLength={SATURN_MAX_CHARS * 2}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
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
          <span className={`ml-auto text-xs ${left < 0 ? 'text-rose-500' : 'text-slate-400'}`}>{left}</span>
        </div>
        {rec.error && <p className="mt-2 text-xs text-rose-500">{rec.error === 'denied' ? 'マイクを許可してください' : 'このブラウザでは録音できません'}</p>}
        {err && <p className="mt-2 text-xs text-rose-500">{err}</p>}
        <button
          disabled={!rec.blob || !text.trim() || left < 0 || busy || rec.recording}
          onClick={() => void post()}
          className="mt-4 w-full rounded-full bg-gradient-to-r from-pink-400 to-violet-400 py-3.5 text-base font-black text-white disabled:opacity-40"
        >
          {busy ? 'おとしています…' : '🎙 土星におとす'}
        </button>
      </div>
    </div>
  );
}
