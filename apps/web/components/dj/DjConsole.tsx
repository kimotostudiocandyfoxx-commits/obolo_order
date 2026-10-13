'use client';

import Link from 'next/link';
import { useEffect, useReducer, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { HOT_CUES, JUMP_SIZES, TEMPO_RANGE, type Deck } from '@/lib/dj/deck';
import type { DjEngine } from '@/lib/dj/engine';
import { FX_NAMES, FX_TYPES, type FxType } from '@/lib/dj/fx';
import { SAMPLES, type SampleId } from '@/lib/dj/sampler';
import { VISUALS, type VisualId } from '@/lib/dj/visuals';
import { Fader, Jog, Knob, Pad } from './controls';
import { PadIcon } from './icons';
import type { DjTrack } from './DjController';
import './fonts';
import { ART, FONT_NUM, FONT_UI, HOT_CUE_COLORS, NEON, neon } from './skin';

/**
 * The Venus DJ console in the client's shape (reference picture 2026-10-12): three circles side by
 * side — deck A, the mixer, deck B — now in brushed dark metal with a neon rim (skin.ts).
 * The mixer's middle holds a small round screen: the VJ view (the decks' MVs, or visuals from the
 * sound when a song has no MV), mixed by the crossfader. Button positions are provisional until
 * the client settles them.
 *
 * Everything is sized from one circle's diameter D, so it fits any landscape phone.
 */
const ORANGE = '#ff9a3c';
const BLUE = '#3cc8ff';
const DECK_COLOR = [BLUE, ORANGE] as const;

function useSize() {
  const [s, set] = useState({ w: 844, h: 390 });
  useEffect(() => {
    const f = () => set({ w: window.innerWidth, h: window.innerHeight });
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return s;
}

function useDeck(deck: Deck) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const off = deck.onChange(force);
    return () => void off();
  }, [deck]);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (deck.playing) force();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [deck]);
}

/**
 * Each deck's MV (Venus VJ, client 2026-10-12): a muted video kept in step with the deck — same
 * position, same speed (the tempo slider), stopping with it — drawn on the platter and mixed in the
 * VJ screen. Not crossOrigin: the CDN may not send CORS, and drawing (not reading) a video is fine.
 */
const VIDEOS = new WeakMap<Deck, HTMLVideoElement>();

function useDeckVideo(deck: Deck) {
  const url = deck.meta?.videoUrl ?? null;
  useEffect(() => {
    if (!url) {
      VIDEOS.delete(deck);
      return;
    }
    const v = document.createElement('video');
    v.muted = true;
    v.setAttribute('muted', '');
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.preload = 'auto';
    v.src = url;
    VIDEOS.set(deck, v);
    let raf = 0;
    const tick = () => {
      const p = deck.position();
      if (deck.playing) {
        v.playbackRate = Math.max(0.5, Math.min(2, deck.rate));
        if (v.paused) void v.play().catch(() => undefined);
        if (Math.abs(v.currentTime - p) > 0.25) v.currentTime = p;
      } else {
        if (!v.paused) v.pause();
        if (Math.abs(v.currentTime - p) > 0.05) v.currentTime = p;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      v.pause();
      v.removeAttribute('src');
      v.load();
      if (VIDEOS.get(deck) === v) VIDEOS.delete(deck);
    };
  }, [deck, url]);
}

/** A video drawn to fill a square (cover), centred. */
function cover(g: CanvasRenderingContext2D, v: HTMLVideoElement | HTMLImageElement, S: number, zoom = 1) {
  const w = ('videoWidth' in v ? v.videoWidth : v.naturalWidth) || 1;
  const h = ('videoHeight' in v ? v.videoHeight : v.naturalHeight) || 1;
  const sc = (Math.max(S / w, S / h)) * zoom;
  g.drawImage(v, (S - w * sc) / 2, (S - h * sc) / 2, w * sc, h * sc);
}

/** Jackets, loaded once each; `onLoad` redraws whoever asked while it was still loading. */
const COVER_IMAGES = new Map<string, HTMLImageElement>();
function coverImage(url: string | null | undefined, onLoad: () => void): HTMLImageElement | null {
  if (!url) return null;
  let img = COVER_IMAGES.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    COVER_IMAGES.set(url, img);
  }
  if (img.complete && img.naturalWidth) return img;
  img.addEventListener('load', onLoad, { once: true });
  return null;
}

/** Put a child at (angle°, radius as a fraction of R) from a circle's centre (0° = right, 90° = down). */
const polar = (D: number, deg: number, r: number): CSSProperties => {
  const a = (deg * Math.PI) / 180;
  return { position: 'absolute', left: D / 2 + Math.cos(a) * r * (D / 2), top: D / 2 + Math.sin(a) * r * (D / 2), transform: 'translate(-50%, -50%)' };
};

export function DjConsole({ engine, songs, backHref }: { engine: DjEngine; songs: DjTrack[]; backHref?: string }) {
  const { w, h } = useSize();
  // three circles, each overlapping the next by 20% of D
  const OV = 0.2;
  const D = Math.floor(Math.min(h * 0.96, w / (3 - 2 * OV)));
  const step = D * (1 - OV);
  const W = D + 2 * step;
  const k = D / 330; // 1 at the design size (an 844 × 390 phone)

  return (
    <div
      className="fixed inset-0 z-[300] overflow-hidden bg-[#05060a] text-white"
      style={{ touchAction: 'none', fontFamily: FONT_UI, backgroundImage: `radial-gradient(ellipse at center, rgba(5,6,10,0.35) 0%, rgba(5,6,10,0.85) 70%), url(${ART.club})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="flex h-full items-center justify-center portrait:hidden">
        <div className="relative" style={{ width: W, height: D }}>
          <Body D={D} step={step} />
          <div data-circle="a" className="absolute" style={{ left: 0, top: 0, width: D, height: D }}>
            <DeckCircle engine={engine} i={0} D={D} k={k} songs={songs} />
          </div>
          <div data-circle="b" className="absolute" style={{ left: 2 * step, top: 0, width: D, height: D }}>
            <DeckCircle engine={engine} i={1} D={D} k={k} songs={songs} />
          </div>
          {/* the mixer's square box overlaps both decks: only its controls catch touches (the ½ / ×2 near it were dead) */}
          <div data-circle="m" className="pointer-events-none absolute" style={{ left: step, top: 0, width: D, height: D }}>
            <MixerCircle engine={engine} D={D} k={k} />
          </div>
        </div>
      </div>
      <div className="hidden h-full items-center justify-center text-sm text-white/60 portrait:flex">横向きにしてね ↻</div>
      {backHref && (
        <Link href={backHref} className="absolute left-2 top-[calc(6px+env(safe-area-inset-top))] rounded-full bg-black/50 px-2.5 py-1 text-[10px] text-white/70">
          ← もどる
        </Link>
      )}
    </div>
  );
}

/**
 * The body: the three circles as one shape in brushed dark metal with a neon rim (blue → violet →
 * orange, deck A to deck B), the decks sunk in dark wells, the mixer's panel in front with a chrome ring.
 */
function Body({ D, step }: { D: number; step: number }) {
  const R = D / 2;
  const cx = [R, R + step, R + 2 * step];
  const W = D + 2 * step;
  return (
    <svg className="pointer-events-none absolute inset-0" width={W} height={D} style={{ overflow: 'visible', filter: 'drop-shadow(0 18px 36px rgba(0,0,0,0.9))' }}>
      <defs>
        <pattern id="metal" patternUnits="userSpaceOnUse" width={D * 0.9} height={D * 0.9}>
          <rect width={D * 0.9} height={D * 0.9} fill="#15171c" />
          <image href={ART.metal} width={D * 0.9} height={D * 0.9} preserveAspectRatio="xMidYMid slice" opacity={0.9} />
        </pattern>
        <linearGradient id="rim" x1="0" x2={W} y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={NEON.blue} />
          <stop offset="0.5" stopColor={NEON.violet} />
          <stop offset="1" stopColor={NEON.orange} />
        </linearGradient>
        <radialGradient id="well" cx="50%" cy="50%" r="50%">
          <stop offset="0.8" stopColor="#0a0b0f" />
          <stop offset="0.97" stopColor="#030304" />
          <stop offset="1" stopColor="#24272e" />
        </radialGradient>
        <radialGradient id="panel" cx="50%" cy="40%" r="60%">
          <stop offset="0" stopColor="rgba(40,44,54,0.55)" />
          <stop offset="1" stopColor="rgba(5,6,9,0.85)" />
        </radialGradient>
        <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9edf5" />
          <stop offset="0.45" stopColor="#5b616e" />
          <stop offset="0.55" stopColor="#2a2e36" />
          <stop offset="1" stopColor="#a9b0bd" />
        </linearGradient>
        <filter id="glow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation={D * 0.012} />
        </filter>
      </defs>
      {/* the neon rim of the whole shape: a soft glow under a sharp line, both under the fills */}
      {cx.map((x) => (
        <circle key={`g${x}`} cx={x} cy={R} r={R - 2} fill="none" stroke="url(#rim)" strokeWidth={D * 0.03} filter="url(#glow)" opacity={0.85} />
      ))}
      {cx.map((x) => (
        <circle key={`o${x}`} cx={x} cy={R} r={R - 1.5} fill="none" stroke="url(#rim)" strokeWidth={3} />
      ))}
      {cx.map((x) => (
        <circle key={`f${x}`} cx={x} cy={R} r={R - 3} fill="url(#metal)" />
      ))}
      {/* the decks' wells */}
      {[cx[0], cx[2]].map((x) => (
        <circle key={`r${x}`} cx={x} cy={R} r={R * 0.93} fill="url(#well)" />
      ))}
      {/* the mixer's round panel, in front of the decks: a chrome ring, metal, a dark glass tint */}
      <circle cx={cx[1]} cy={R} r={R * 0.955} fill="url(#chrome)" />
      <circle cx={cx[1]} cy={R} r={R * 0.935} fill="url(#metal)" />
      <circle cx={cx[1]} cy={R} r={R * 0.935} fill="url(#panel)" />
    </svg>
  );
}

function DeckCircle({ engine, i, D, k, songs }: { engine: DjEngine; i: 0 | 1; D: number; k: number; songs: DjTrack[] }) {
  const deck = engine.decks[i];
  useDeck(deck);
  useDeckVideo(deck);
  const [pick, setPick] = useState(false);
  const [jumpPick, setJumpPick] = useState(false);
  const [loading, setLoading] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const color = DECK_COLOR[i];
  // deck B is deck A mirrored: angles θ → 180° − θ
  const at = (deg: number, r: number) => polar(D, i === 0 ? deg : 180 - deg, r);
  // a left / right pair that should read the same on both decks (½ before ×2, ◀◀ before ▶▶):
  // deck B takes the partner's spot, so the mirror does not swap them
  const pair = (deg: number, partner: number) => (i === 0 ? deg : partner);
  const b = Math.round(26 * k);

  const load = async (data: ArrayBuffer, title: string, bpm: number | null, source: 'song' | 'file', videoUrl: string | null = null, coverUrl: string | null = null) => {
    setLoading(title);
    try {
      await engine.load(i, data, { title, bpm, source, videoUrl, coverUrl });
    } finally {
      setLoading('');
    }
  };
  const pos = deck.position();
  const angle = ((pos / 1.8) * 360) % 360;
  const ring = (active: boolean, c: string = color): CSSProperties => ({ ...neon(c, active, k), width: b, height: b, borderRadius: '50%', fontSize: 8.5 * k });
  // a pill: a little slimmer than a round button, as wide as its longest label plus even padding
  const pill = (active: boolean, c: string, w: number, font = 7.5): CSSProperties => ({ ...neon(c, active, k), width: b * w, height: b * 0.84, borderRadius: 999, fontSize: font * k, letterSpacing: '0.04em' });

  return (
    <div className="absolute inset-0">
      {/* load a song: the button at the top of the ring (the title shows over the waveform) */}
      <div style={at(L.load, L.r)}>
        <Pad onDown={() => setPick(!pick)} className="border-0 bg-transparent">
          <span style={pill(pick, color, 1.5, 8)} className="flex items-center justify-center border">
            {loading ? '…' : 'LOAD'}
          </span>
        </Pad>
      </div>

      {/* the platter */}
      <div data-jog style={polar(D, 0, 0)}>
        <Jog size={D * 0.6} skin={ART.jog} color={color} led={0.9} angle={angle} onStart={(top) => deck.jogStart(top)} onTurn={(turns, dt) => deck.jogMove(turns * 1.8, dt)} onEnd={() => deck.jogEnd()}>
          <Platter deck={deck} size={D * 0.6} i={i} angle={angle} />
        </Jog>
      </div>

      {/* hot cues on the upper outer arc */}
      {Array.from({ length: HOT_CUES }, (_, n) => (
        <div key={n} style={at(L.cues[n], L.r)}>
          <Pad onDown={() => deck.hotCue(n)} onLong={() => deck.clearHotCue(n)} className="border-0 bg-transparent">
            <span style={ring(deck.hotCues[n] !== null, HOT_CUE_COLORS[n])} className="flex items-center justify-center border">{n + 1}</span>
          </Pad>
        </div>
      ))}

      {/* loop (½ · LOOP · ×2) on the upper inner arc; ½ stays on the left on both decks */}
      {(
        [
          [pair(L.loop[0], L.loop[2]), '½', () => deck.resizeLoop(-1), false],
          [L.loop[1], `LOOP ${beatsLabel(deck.loopBeats)}`, () => deck.toggleLoop(), true],
          [pair(L.loop[2], L.loop[0]), '×2', () => deck.resizeLoop(1), false],
        ] as const
      ).map(([deg, label, fn, main], n) => (
        <div key={`l${n}`} style={at(deg, main ? L.pill : L.r)}>
          <Pad onDown={fn} className="border-0 bg-transparent">
            <span style={main ? pill(deck.loop !== null, LOOP_COLOR, 1.6, 7) : ring(false)} className="flex items-center justify-center whitespace-nowrap border">
              {label}
            </span>
          </Pad>
        </div>
      ))}
      {/* beat jump along the lower arc on the mixer side: ◀◀ JUMP ▶▶ (◀◀ on the left on both decks); tap JUMP to pick the distance */}
      <div style={at(L.jump[1], L.pill)}>
        <Pad onDown={() => setJumpPick(!jumpPick)} className="border-0 bg-transparent">
          <span style={pill(jumpPick, '#f5c66b', 1.6, 6.8)} className="flex items-center justify-center whitespace-nowrap border">
            JUMP {beatsLabel(deck.jumpBeats)}
          </span>
        </Pad>
      </div>
      {(
        [
          [-1, '◀◀'],
          [1, '▶▶'],
        ] as const
      ).map(([dir, label]) => (
        <div key={label} style={at(dir < 0 ? pair(L.jump[0], L.jump[2]) : pair(L.jump[2], L.jump[0]), L.pill + 0.02)}>
          <Pad onDown={() => deck.beatJump(dir)} className="border-0 bg-transparent">
            <span style={ring(false)} className="flex items-center justify-center border">
              {label}
            </span>
          </Pad>
        </div>
      ))}

      {/* tempo on the outer side, KEY (key lock) under it */}
      <div style={{ ...at(180, L.tempo), marginTop: (L.tempoDrop * D) / 2 }}>
        <div className="flex flex-col items-center" style={{ gap: 4 * k }}>
          <div style={{ width: 34 * k, height: 64 * k }}>
            <div style={{ width: 34, transform: `scale(${k})`, transformOrigin: 'top left' }}>
              <Fader color={color} value={(deck.tempo / TEMPO_RANGE + 1) / 2} length={64} center={0.5} onChange={(v) => deck.setTempo((v * 2 - 1) * TEMPO_RANGE)} />
            </div>
          </div>
          {/* the tempo now, under its fader */}
          <span className="tabular-nums" style={{ fontFamily: FONT_NUM, fontSize: 7 * k, color, textShadow: `0 0 ${4 * k}px ${color}` }}>
            {deck.tempo >= 0 ? '+' : ''}
            {(deck.tempo * 100).toFixed(1)}%
          </span>
          <Pad onDown={() => deck.setKeylock(!deck.keylock)} className="border-0 bg-transparent">
            <span style={ring(deck.keylock, '#f5c66b')} className="flex items-center justify-center border">
              KEY
            </span>
          </Pad>
        </div>
      </div>

      {/* SYNC low on the outer side; CUE and play side by side right under the platter */}
      <div style={at(L.sync, L.pill)}>
        <Pad onDown={() => engine.sync(i)} className="border-0 bg-transparent">
          <span style={pill(false, color, 1.5, 7.5)} className="flex items-center justify-center border">
            SYNC
          </span>
        </Pad>
      </div>
      <div style={at(L.cue, L.cueR)}>
        <Pad onDown={() => deck.cueDown()} onUp={() => deck.cueUp()} className="border-0 bg-transparent">
          <Pill color={ORANGE} k={k} size={31} lit>
            CUE
          </Pill>
        </Pad>
      </div>
      <div style={at(L.play, L.playR)}>
        <Pad onDown={() => deck.toggle()} className="border-0 bg-transparent">
          <Pill color={NEON.green} k={k} size={39} lit={deck.playing}>
            {/* play ▶ and pause ❚❚ drawn as one clean mark */}
            <svg viewBox="0 0 28 16" width={20 * k} height={11.5 * k} fill="currentColor" aria-label="play / pause">
              <path d="M1 1.5v13l10.5-6.5z" />
              <rect x="16" y="1.5" width="3.6" height="13" rx="0.8" />
              <rect x="22.4" y="1.5" width="3.6" height="13" rx="0.8" />
            </svg>
          </Pill>
        </Pad>
      </div>

      {jumpPick && (
        <>
          <div className="fixed inset-0 z-30" onPointerDown={() => setJumpPick(false)} />
          <div style={{ ...at(20, 0.5), zIndex: 31 }} className="grid grid-cols-4 gap-1 rounded-xl border border-[#c9974f]/50 bg-[#120c09]/95 p-1.5 shadow-xl">
            <span className="col-span-4 px-1 text-center text-white/60" style={{ fontSize: Math.max(9, 9 * k) }}>
              ジャンプする拍
            </span>
            {JUMP_SIZES.map((n) => (
              <button
                key={n}
                onClick={() => (deck.setJumpBeats(n), setJumpPick(false))}
                className="rounded-lg border font-bold"
                style={{ minWidth: 34 * Math.max(1, k), padding: `${6 * Math.max(1, k)}px 0`, fontSize: Math.max(11, 11 * k), borderColor: n === deck.jumpBeats ? '#f5c66b' : 'rgba(255,255,255,0.12)', color: n === deck.jumpBeats ? '#fff' : 'rgba(255,255,255,0.75)', background: n === deck.jumpBeats ? '#f5c66b40' : 'transparent' }}
              >
                {beatsLabel(n)}
              </button>
            ))}
          </div>
        </>
      )}
      {pick && (
        <div className="absolute z-30 max-h-[70%] overflow-y-auto rounded-xl border border-[#c9974f]/40 bg-[#120c09]/95 p-2 text-sm shadow-xl" style={{ left: '12%', right: '12%', top: '18%' }}>
          {songs.map((s) => (
            <button
              key={s.url}
              onClick={async () => {
                setPick(false);
                await load(await (await fetch(s.url)).arrayBuffer(), s.title, s.bpm, 'song', s.videoUrl ?? null, s.coverUrl ?? null);
              }}
              className="block w-full truncate rounded px-2 py-2 text-left hover:bg-white/5"
            >
              {s.videoUrl ? '🎬' : '♪'} {s.title} <span className="text-[10px] text-white/40">{s.bpm ? `${s.bpm} BPM` : ''}</span>
            </button>
          ))}
          <button onClick={() => file.current?.click()} className="mt-1 block w-full rounded px-2 py-2 text-left text-white/70">
            📁 端末の音声ファイル…
          </button>
          <input
            ref={file}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setPick(false);
              await load(await f.arrayBuffer(), f.name.replace(/\.[^.]+$/, ''), null, 'file');
            }}
          />
        </div>
      )}
    </div>
  );
}

const LOOP_COLOR = '#3cf0c8';
/** sampler pads: picture (left), sound (right) */
const SAMPLER_COLOR = ['#6ae0ff', '#ff4fa3'] as const;
/** 0.25 → 1/4, 4 → 4 */
const beatsLabel = (n: number) => (n < 1 ? `1/${1 / n}` : String(n));

/**
 * Where the deck's controls sit (deck A; deck B is its mirror): angles in degrees (0° = towards the
 * mixer, 90° = down) on a ring between the jog wheel (radius 0.6 R) and the rim. Worked out so nothing
 * overlaps: round buttons 14° apart on radius 0.8; the mixer's circle covers the ring below |34°|.
 */
const L = {
  r: 0.8,
  /** pills (LOOP, JUMP, SYNC) sit a little further in, so their ends stay off the rim */
  pill: 0.76,
  cues: [-148, -134, -120, -106],
  load: -90,
  /** ½, LOOP, ×2 */
  loop: [-75, -56.5, -38],
  /** ◀◀, JUMP, ▶▶ */
  jump: [76, 57.5, 39.5],
  /** play: the big round button right under the jog; CUE beside it on the outer side */
  play: 93,
  playR: 0.75,
  cue: 113,
  cueR: 0.78,
  sync: 134,
  /** the tempo column (fader, %, round KEY) on the outer side, a little below the middle */
  tempo: 0.72,
  tempoDrop: 0.055,
};

function Pill({ children, color, k, lit, size = 32 }: { children: ReactNode; color: string; k: number; lit?: boolean; size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-full"
      style={{ ...neon(color, !!lit, k), borderWidth: 2 * k, width: size * k, height: size * k, fontSize: 9.5 * k, letterSpacing: '0.08em' }}
    >
      {children}
    </span>
  );
}

/** the share of the jog wheel its centre screen takes */
const PLATTER_SCREEN = 0.64;

/** The platter's picture: glowing swirls turning with the record, brighter with the sound. */
function Platter({ deck, size, i, angle }: { deck: Deck; size: number; i: 0 | 1; angle: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const data = useRef(new Uint8Array(128));
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    const S = (c.width = c.height = Math.round(size * PLATTER_SCREEN * devicePixelRatio));
    deck.analyser.getByteFrequencyData(data.current);
    let level = 0;
    for (let n = 0; n < 40; n++) level += data.current[n];
    level = level / (40 * 255);
    g.clearRect(0, 0, S, S);
    const video = VIDEOS.get(deck);
    if (video && video.readyState >= 2) {
      // the song's MV on the record, upright; a lit marker on the rim turns with the record
      g.save();
      g.beginPath();
      g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
      g.clip();
      cover(g, video, S);
      g.restore();
      g.strokeStyle = DECK_COLOR[i];
      g.globalAlpha = 0.5 + level * 0.5;
      g.lineWidth = S / 40;
      g.beginPath();
      const a0 = (angle * Math.PI) / 180 - Math.PI / 2;
      g.arc(S / 2, S / 2, S / 2 - S / 80, a0 - 0.25, a0 + 0.25);
      g.stroke();
      g.globalAlpha = 1;
      return;
    }
    const jacket = coverImage(deck.meta?.coverUrl, redraw);
    if (jacket) {
      // no MV: the jacket turns with the record, a spindle hole in the middle
      g.save();
      g.beginPath();
      g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
      g.clip();
      g.translate(S / 2, S / 2);
      g.rotate((angle * Math.PI) / 180);
      g.translate(-S / 2, -S / 2);
      cover(g, jacket, S);
      g.restore();
      // the grooves' sheen, brighter with the sound
      g.strokeStyle = `rgba(0,0,0,${0.35 - level * 0.2})`;
      g.lineWidth = S / 200;
      for (let r = S * 0.2; r < S / 2; r += S / 40) {
        g.beginPath();
        g.arc(S / 2, S / 2, r, 0, Math.PI * 2);
        g.stroke();
      }
      g.fillStyle = '#05080c';
      g.beginPath();
      g.arc(S / 2, S / 2, S * 0.04, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = DECK_COLOR[i];
      g.lineWidth = S / 80;
      g.globalAlpha = 0.5 + level * 0.5;
      g.beginPath();
      g.arc(S / 2, S / 2, S / 2 - S / 160, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
      return;
    }
    g.save();
    g.translate(S / 2, S / 2);
    g.rotate((angle * Math.PI) / 180);
    g.globalCompositeOperation = 'lighter';
    const cols = i === 0 ? ['#7a3cff', '#3cc8ff', '#ff6a3c'] : ['#3cc8ff', '#ffb04a', '#3c7bff'];
    const arms = i === 0 ? 3 : 6;
    for (let a = 0; a < arms; a++) {
      g.rotate((Math.PI * 2) / arms);
      for (let n = 0; n < 26; n++) {
        const t = n / 26;
        const r = (S / 2) * (0.12 + t * 0.82);
        const x = Math.cos(t * (i === 0 ? 5 : 3)) * r;
        const y = Math.sin(t * (i === 0 ? 5 : 3)) * r * (i === 0 ? 1 : 0.45);
        g.fillStyle = cols[(a + (n >> 3)) % cols.length];
        g.globalAlpha = (0.25 + level * 0.75) * (1 - t * 0.6);
        g.beginPath();
        g.arc(x, y, (S / 90) * (1.5 + level * 3) * (1 - t * 0.5), 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
    // the label in the middle
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.fillStyle = '#05080c';
    g.beginPath();
    g.arc(S / 2, S / 2, S * 0.09, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = DECK_COLOR[i];
    g.lineWidth = S / 120;
    g.stroke();
  });
  // the jog's centre screen, in a gold bezel like the wheel's own
  return (
    <div className="pointer-events-none rounded-full p-[2px]" style={{ background: 'linear-gradient(160deg, #ffe3a3, #b07a2a 40%, #5a3a10 60%, #e8c06a)', boxShadow: '0 0 8px rgba(0,0,0,0.9), inset 0 0 2px rgba(0,0,0,0.8)' }}>
      <canvas ref={ref} className="block rounded-full bg-black" style={{ width: size * PLATTER_SCREEN, height: size * PLATTER_SCREEN }} />
    </div>
  );
}

/** The FX knob's choices: the filter is one of the effects (client 2026-10-12). */
type FxMode = 'filter' | FxType;
const FX_MODES: FxMode[] = ['filter', ...FX_TYPES];
const FX_LABEL: Record<FxMode, string> = { filter: 'FILTER', ...FX_NAMES };

function MixerCircle({ engine, D, k }: { engine: DjEngine; D: number; k: number }) {
  const [s, setS] = useState(() => [0, 1].map(() => ({ high: 0, mid: 0, low: 0, filter: 0, fader: 0.85 })));
  const [xf, setXf] = useState(0.5);
  // the bottom knob of each column is the FX knob: FILTER or one of the effects, picked from its menu
  const [mode, setMode] = useState<FxMode[]>(['filter', 'filter']);
  const [menu, setMenu] = useState<0 | 1 | null>(null);
  // the samplers either side of the mixer: pictures on the left (VJ screen), sounds on the right
  const [picked, setPicked] = useState<[VisualId, SampleId]>(['flash', 'horn']);
  const [samplePick, setSamplePick] = useState<0 | 1 | null>(null);
  const [hit, setHit] = useState<0 | 1 | null>(null);
  const applyFx = (i: 0 | 1, m: FxMode, v: number) => (m === 'filter' ? engine.decks[i].setFilter(v) : engine.decks[i].setFx(m, v));
  const set = (i: 0 | 1, key: 'high' | 'mid' | 'low' | 'filter' | 'fader', v: number) => {
    setS((prev) => prev.map((x, j) => (j === i ? { ...x, [key]: v } : x)));
    const d = engine.decks[i];
    if (key === 'filter') applyFx(i, mode[i], v);
    else if (key === 'fader') d.setFader(v);
    else d.setEq(key, v);
  };
  const pickFx = (i: 0 | 1, m: FxMode) => {
    setMenu(null);
    if (m === mode[i]) return;
    // the old one off, the new one starts at zero
    applyFx(i, mode[i], 0);
    setMode((prev) => prev.map((x, j) => (j === i ? m : x)));
    setS((prev) => prev.map((x, j) => (j === i ? { ...x, filter: 0 } : x)));
  };
  useEffect(() => {
    for (const i of [0, 1] as const) engine.decks[i].setFader(0.85);
  }, [engine]);
  const R = D / 2;
  const box = (x: number, y: number): CSSProperties => ({ position: 'absolute', left: R + x * R, top: R + y * R, transform: 'translate(-50%, -50%)', pointerEvents: 'auto' });
  const ks = 22 * k;

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* the two waveforms across the top: deck A above, deck B below */}
      <div data-part style={{ ...box(0, -0.5), width: D * 0.58 }} className="flex flex-col gap-0.5">
        {([0, 1] as const).map((i) => (
          <WaveTouch key={i} deck={engine.decks[i]}>
            <TrackLine deck={engine.decks[i]} i={i} k={k} />
            <Wave deck={engine.decks[i]} h={16 * k} />
          </WaveTouch>
        ))}
      </div>
      {/* EQ + filter, a column per deck */}
      {([0, 1] as const).map((i) => (
        <div key={i} style={box(i === 0 ? -0.52 : 0.52, 0.2)} className="flex flex-col items-center">
          <Knob cap={ART.knob} label="HI" size={ks} value={s[i].high} min={-26} max={6} center={0} color={DECK_COLOR[i]} onChange={(v) => set(i, 'high', v)} />
          <Knob cap={ART.knob} label="MID" size={ks} value={s[i].mid} min={-26} max={6} center={0} color={DECK_COLOR[i]} onChange={(v) => set(i, 'mid', v)} />
          <Knob cap={ART.knob} label="LOW" size={ks} value={s[i].low} min={-26} max={6} center={0} color={DECK_COLOR[i]} onChange={(v) => set(i, 'low', v)} />
          <Knob
            cap={ART.knob}
            label={`${FX_LABEL[mode[i]]} ▾`}
            size={ks}
            value={s[i].filter}
            min={mode[i] === 'filter' ? -1 : 0}
            max={1}
            center={0}
            color={mode[i] === 'filter' ? '#9be37a' : '#ff6ad5'}
            onChange={(v) => set(i, 'filter', v)}
            onMenu={() => setMenu(i)}
          />
        </div>
      ))}
      {/* the samplers: a pad (fires it) and SELECT (picks it) on each side — left = picture, right = sound */}
      {([0, 1] as const).map((side) => {
        const list = side === 0 ? VISUALS : SAMPLES;
        const sm = list.find((x) => x.id === picked[side])!;
        const col = SAMPLER_COLOR[side];
        const fire = () => (side === 0 ? engine.visuals.fire(picked[0]) : void engine.sampler.play(picked[1], engine.beat));
        return (
          <div key={`s${side}`}>
            <div style={box(side === 0 ? -0.74 : 0.74, -0.2)} className="pointer-events-none text-center font-bold tracking-wider">
              <span style={{ fontSize: 6.5 * k, letterSpacing: '0.2em', color: col, textShadow: `0 0 ${4 * k}px ${col}` }}>{side === 0 ? 'VISUAL' : 'SOUND'}</span>
            </div>
            <div style={box(side === 0 ? -0.74 : 0.74, -0.06)}>
              <button
                onPointerDown={() => {
                  fire();
                  setHit(side);
                  setTimeout(() => setHit((h) => (h === side ? null : h)), 160);
                }}
                className="flex select-none flex-col items-center justify-center rounded-full"
                style={{ ...neon(col, hit === side, k), borderWidth: 2 * k, width: 36 * k, height: 36 * k, touchAction: 'none', color: '#fff' }}
              >
                <span style={{ color: hit === side ? '#fff' : col, lineHeight: 0 }}>
                  <PadIcon id={sm.id} size={14 * k} />
                </span>
                <span style={{ fontSize: 5.8 * k, letterSpacing: '0.04em', marginTop: 1 * k }}>{sm.short}</span>
              </button>
            </div>
            <div style={box(side === 0 ? -0.79 : 0.79, 0.15)}>
              <button
                onClick={() => setSamplePick(samplePick === side ? null : side)}
                aria-label={side === 0 ? '映像のサンプラーを選ぶ' : '音のサンプラーを選ぶ'}
                className="flex select-none items-center justify-center rounded-full"
                style={{ ...neon(col, samplePick === side, k), width: 21 * k, height: 21 * k }}
              >
                {/* a grid mark: pick from the set */}
                <svg viewBox="0 0 10 10" width={8.5 * k} height={8.5 * k} fill="currentColor" aria-hidden>
                  <rect x="0" y="0" width="4" height="4" rx="1" />
                  <rect x="6" y="0" width="4" height="4" rx="1" />
                  <rect x="0" y="6" width="4" height="4" rx="1" />
                  <rect x="6" y="6" width="4" height="4" rx="1" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
      {samplePick !== null && (
        <>
          <div className="pointer-events-auto fixed inset-0 z-30" onPointerDown={() => setSamplePick(null)} />
          <div
            style={{ ...box(samplePick === 0 ? -0.3 : 0.12, 0.05), zIndex: 31, gridTemplateColumns: `repeat(${samplePick === 0 ? 3 : 4}, auto)`, borderColor: `${SAMPLER_COLOR[samplePick]}66`, boxShadow: `0 0 18px ${SAMPLER_COLOR[samplePick]}44, 0 10px 30px rgba(0,0,0,0.8)` }}
            className="grid gap-1 rounded-xl border bg-[#0b0c11]/95 p-1.5 backdrop-blur"
          >
            <span className="text-center font-bold tracking-[0.2em] text-white/60" style={{ gridColumn: '1 / -1', fontSize: Math.max(9, 9 * k) }}>
              {samplePick === 0 ? '映像のサンプラー' : '音のサンプラー'}
            </span>
            {(samplePick === 0 ? VISUALS : SAMPLES).map((x) => {
              const on = x.id === picked[samplePick];
              const col = SAMPLER_COLOR[samplePick];
              return (
                <button
                  key={x.id}
                  onClick={() => {
                    setPicked((prev) => (samplePick === 0 ? [x.id as VisualId, prev[1]] : [prev[0], x.id as SampleId]));
                    setSamplePick(null);
                  }}
                  className="flex flex-col items-center gap-0.5 whitespace-nowrap rounded-lg px-2 py-1.5"
                  style={{ ...neon(col, on, 1), fontSize: Math.max(9, 8.5 * k) }}
                >
                  <PadIcon id={x.id} size={Math.max(18, 18 * k)} />
                  {x.name}
                </button>
              );
            })}
          </div>
        </>
      )}
      {/* the FX menu (long press on the FX knob) */}
      {menu !== null && (
        <>
          <div className="pointer-events-auto fixed inset-0 z-30" onPointerDown={() => setMenu(null)} />
          <div style={{ ...box(menu === 0 ? -0.3 : 0.3, 0.3), zIndex: 31 }} className="flex flex-col gap-1 rounded-xl border border-[#c9974f]/50 bg-[#120c09]/95 p-1.5 shadow-xl">
            {FX_MODES.map((m) => (
              <button
                key={m}
                onClick={() => pickFx(menu, m)}
                className="rounded-lg border px-3 py-1.5 text-left font-bold tracking-wider"
                style={{ fontSize: Math.max(10, 10 * k), borderColor: m === mode[menu] ? DECK_COLOR[menu] : 'rgba(255,255,255,0.12)', color: m === mode[menu] ? '#fff' : 'rgba(255,255,255,0.75)', background: m === mode[menu] ? `${DECK_COLOR[menu]}40` : 'transparent' }}
              >
                {FX_LABEL[m]}
              </button>
            ))}
          </div>
        </>
      )}
      {/* channel faders either side of the VJ screen */}
      {([0, 1] as const).map((i) => (
        <div key={`f${i}`} style={{ ...box(i === 0 ? -0.2 : 0.2, 0.36) }}>
          <div style={{ transform: `scale(${k * 0.85})` }}>
            <Fader color={DECK_COLOR[i]} value={s[i].fader} length={78} onChange={(v) => set(i, 'fader', v)} />
          </div>
        </div>
      ))}
      {/* the VJ screen: a small round vision in the middle */}
      <div style={box(0, -0.06)}>
        <VjScreen engine={engine} size={D * 0.24} />
      </div>
      {/* crossfader at the bottom */}
      <div style={box(0, 0.74)}>
        <div style={{ transform: `scale(${k})` }}>
          <Fader horizontal color={NEON.violet} value={xf} length={120} center={0.5} onChange={(v) => (setXf(v), engine.setCrossfader(v))} />
        </div>
      </div>
    </div>
  );
}

/**
 * The VJ view: each deck's picture — its MV when the song has one, else visuals drawn from its
 * sound in the deck's colour — mixed like the sound: crossfader and channel faders.
 */
function VjScreen({ engine, size }: { engine: DjEngine; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const buf = useRef([new Uint8Array(128), new Uint8Array(128)]);
  useEffect(() => {
    let raf = 0;
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    const S = (c.width = c.height = Math.round(size * devicePixelRatio));
    let t = 0;
    const draw = () => {
      t += 1 / 60;
      const xf = engine.crossfader;
      const mixes = engine.decks.map((d, i) => (i === 0 ? Math.cos((xf * Math.PI) / 2) : Math.sin((xf * Math.PI) / 2)) * d.faderValue);
      // the MVs first: deck A as the base, deck B over it by its share of the mix — a real crossfade,
      // with a little push-in on the low end so the picture moves with the beat
      const vids = engine.decks.map((d) => {
        const v = VIDEOS.get(d);
        return v && v.readyState >= 2 ? v : null;
      });
      let kick = 0;
      engine.decks.forEach((d, i) => {
        d.analyser.getByteFrequencyData(buf.current[i]);
        kick += (buf.current[i][2] / 255) * mixes[i];
      });
      const total = mixes.reduce((a, m, i) => a + (vids[i] ? m : 0), 0);
      g.globalCompositeOperation = 'source-over';
      if (total > 0.02) {
        g.globalAlpha = 1;
        g.fillStyle = '#000';
        g.fillRect(0, 0, S, S);
        const zoom = 1.02 + kick * 0.06;
        let first = true;
        vids.forEach((v, i) => {
          if (!v || mixes[i] < 0.02) return;
          g.globalAlpha = first ? 1 : mixes[i] / total;
          cover(g, v, S, zoom);
          first = false;
        });
        // quieter mix → darker picture
        g.globalAlpha = Math.max(0, 1 - Math.min(1, Math.max(...mixes) * 1.3));
        g.fillStyle = '#000';
        g.fillRect(0, 0, S, S);
      } else {
        g.fillStyle = 'rgba(4,6,10,0.35)';
        g.fillRect(0, 0, S, S);
      }
      g.globalCompositeOperation = 'lighter';
      engine.decks.forEach((d, i) => {
        const mix = mixes[i];
        if (mix < 0.02) return;
        const f = buf.current[i];
        const col = DECK_COLOR[i];
        g.strokeStyle = col;
        g.globalAlpha = Math.min(1, mix * 1.2) * (vids[i] ? 0.12 : 1);
        // rings that swell with the lows, rays with the highs
        for (let r = 0; r < 4; r++) {
          const v = f[2 + r * 3] / 255;
          g.lineWidth = (S / 70) * (1 + v * 2);
          g.beginPath();
          g.arc(S / 2, S / 2, (S / 2) * (0.15 + r * 0.18 + v * 0.1), 0, Math.PI * 2);
          g.stroke();
        }
        g.lineWidth = S / 160;
        for (let n = 0; n < 24; n++) {
          const v = f[20 + n * 3] / 255;
          const a = (n / 24) * Math.PI * 2 + t * (i === 0 ? 0.6 : -0.6);
          g.beginPath();
          g.moveTo(S / 2 + Math.cos(a) * S * 0.12, S / 2 + Math.sin(a) * S * 0.12);
          g.lineTo(S / 2 + Math.cos(a) * S * (0.14 + v * 0.36), S / 2 + Math.sin(a) * S * (0.14 + v * 0.36));
          g.stroke();
        }
      });
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      engine.visuals.draw(g, S);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [engine, size]);
  return (
    <div className="rounded-full p-[2px]" style={{ background: `conic-gradient(${BLUE}, ${ORANGE}, ${BLUE})`, boxShadow: `0 0 ${size * 0.15}px ${ORANGE}66` }}>
      <canvas ref={ref} className="block rounded-full bg-black" style={{ width: size, height: size }} />
    </div>
  );
}

/** The deck letter, its song and BPM over its waveform. */
function TrackLine({ deck, i, k }: { deck: Deck; i: 0 | 1; k: number }) {
  useDeck(deck);
  return (
    <div className="flex items-center gap-1 truncate" style={{ fontSize: 8 * k, lineHeight: 1.3 }}>
      <span className="rounded-sm px-1 font-bold text-black" style={{ background: DECK_COLOR[i], fontFamily: FONT_NUM, boxShadow: `0 0 ${5 * k}px ${DECK_COLOR[i]}` }}>
        {i === 0 ? 'A' : 'B'}
      </span>
      <span className="min-w-0 flex-1 truncate text-white/80">{deck.meta?.title ?? '—'}</span>
      <span className="tabular-nums" style={{ color: DECK_COLOR[i], fontFamily: FONT_NUM, fontWeight: 800, textShadow: `0 0 ${4 * k}px ${DECK_COLOR[i]}` }}>
        {deck.bpm ? deck.bpm.toFixed(1) : '--.-'}
        <span style={{ fontSize: '0.7em', marginLeft: 2, opacity: 0.7 }}>BPM</span>
      </span>
    </div>
  );
}

/**
 * Touching a deck's waveform (client 2026-10-12): the finger holds the track (it stops), a swipe moves it
 * — left = ahead (fast), right = back (rewind), with the sound following the finger — and letting go
 * plays on as before. A quick tap with no swipe = play / stop.
 */
function WaveTouch({ deck, children }: { deck: Deck; children: ReactNode }) {
  const st = useRef<{ x: number; t: number; t0: number; moved: boolean; id: number } | null>(null);
  const down = (e: RPointerEvent<HTMLDivElement>) => {
    if (st.current || !deck.buffer) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* a synthetic event has no pointer to capture */
    }
    st.current = { x: e.clientX, t: performance.now(), t0: performance.now(), moved: false, id: e.pointerId };
    deck.jogStart(true);
  };
  const move = (e: RPointerEvent<HTMLDivElement>) => {
    const s = st.current;
    if (!s || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x;
    if (!s.moved && Math.abs(dx) < 4) return;
    s.moved = true;
    const t = performance.now();
    // the waveform shows WAVE_SPAN seconds across its width: the track moves with the finger
    deck.jogMove((-dx / e.currentTarget.clientWidth) * WAVE_SPAN, (t - s.t) / 1000);
    st.current = { ...s, x: e.clientX, t };
  };
  const up = (e: RPointerEvent<HTMLDivElement>) => {
    const s = st.current;
    if (!s || e.pointerId !== s.id) return;
    st.current = null;
    deck.jogEnd();
    if (!s.moved && performance.now() - s.t0 < 300) deck.toggle();
  };
  return (
    <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className="select-none" style={{ touchAction: 'none' }}>
      {children}
    </div>
  );
}

/** seconds of track across the waveform */
const WAVE_SPAN = 8;

/** A deck's waveform around the playhead (±4 s), lows red, mids green, highs blue. */
function Wave({ deck, h }: { deck: Deck; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useDeck(deck);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    const W = (c.width = c.clientWidth * devicePixelRatio);
    const H = (c.height = c.clientHeight * devicePixelRatio);
    g.clearRect(0, 0, W, H);
    const p = deck.position();
    const span = WAVE_SPAN;
    const draw = (band: Float32Array, col: string, scale: number) => {
      g.fillStyle = col;
      for (let x = 0; x < W; x++) {
        const t = p - span / 2 + (x / W) * span;
        const v = (band[Math.floor(t * 100)] ?? 0) * scale * 0.95;
        g.globalAlpha = t < p ? 0.5 : 1;
        g.fillRect(x, H / 2 - (v * H) / 2, 1, v * H);
      }
    };
    if (deck.bands) {
      draw(deck.bands.low, '#ff3b30', 1);
      draw(deck.bands.mid, '#34e05a', 0.72);
      draw(deck.bands.high, '#3a8bff', 0.48);
    } else draw(deck.peaks, '#8fa3b8', 1);
    g.globalAlpha = 1;
    const mark = (t: number, col: string) => {
      const x = ((t - (p - span / 2)) / span) * W;
      if (x < 0 || x > W) return;
      g.fillStyle = col;
      g.fillRect(x - 1, 0, 2 * devicePixelRatio, H);
    };
    if (deck.meta?.bpm) {
      const b = 60 / deck.meta.bpm;
      for (let t = deck.meta.firstBeat + Math.ceil((p - span / 2 - deck.meta.firstBeat) / b) * b; t < p + span / 2; t += b) mark(t, 'rgba(255,255,255,0.16)');
    }
    // the loop: a lit band
    if (deck.loop) {
      const x0 = ((deck.loop.start - (p - span / 2)) / span) * W;
      const x1 = ((deck.loop.end - (p - span / 2)) / span) * W;
      g.fillStyle = 'rgba(60,240,200,0.22)';
      g.fillRect(x0, 0, x1 - x0, H);
      mark(deck.loop.start, LOOP_COLOR);
      mark(deck.loop.end, LOOP_COLOR);
    }
    mark(deck.cue, '#ffb340');
    deck.hotCues.forEach((x, n) => x !== null && mark(x, HOT_CUE_COLORS[n]));
    g.fillStyle = '#fff';
    g.fillRect(W / 2 - 1, 0, 2 * devicePixelRatio, H);
  });
  return <canvas ref={ref} className="w-full rounded-sm bg-black/70" style={{ height: h }} />;
}
