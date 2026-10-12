'use client';

import Link from 'next/link';
import { useEffect, useReducer, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { HOT_CUES, TEMPO_RANGE, type Deck } from '@/lib/dj/deck';
import type { DjEngine } from '@/lib/dj/engine';
import { FX_TYPES, type FxType } from '@/lib/dj/fx';
import { Fader, Jog, Knob, Pad } from './controls';
import type { DjTrack } from './DjController';

/**
 * The Venus DJ console in the client's shape (reference picture 2026-10-12): three circles side by
 * side — deck A, the mixer, deck B — on a dark wooden body with gold rims, orange and blue light.
 * The mixer's middle holds a small round screen: the VJ view (the decks' MVs, or visuals from the
 * sound when a song has no MV), mixed by the crossfader. Button positions are provisional until
 * the client settles them.
 *
 * Everything is sized from one circle's diameter D, so it fits any landscape phone.
 */
const GOLD = '#c9974f';
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
    <div className="fixed inset-0 z-[300] overflow-hidden bg-[radial-gradient(ellipse_at_center,#1d1510_0%,#070506_70%)] text-white" style={{ touchAction: 'none' }}>
      <div className="flex h-full items-center justify-center portrait:hidden">
        <div className="relative" style={{ width: W, height: D }}>
          <Body D={D} step={step} />
          <div className="absolute" style={{ left: 0, top: 0, width: D, height: D }}>
            <DeckCircle engine={engine} i={0} D={D} k={k} songs={songs} />
          </div>
          <div className="absolute" style={{ left: 2 * step, top: 0, width: D, height: D }}>
            <DeckCircle engine={engine} i={1} D={D} k={k} songs={songs} />
          </div>
          <div className="absolute" style={{ left: step, top: 0, width: D, height: D }}>
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

/** The wooden body: the three circles as one shape with a gold rim, the mixer's panel on top. */
function Body({ D, step }: { D: number; step: number }) {
  const R = D / 2;
  const cx = [R, R + step, R + 2 * step];
  return (
    <svg className="pointer-events-none absolute inset-0" width={D + 2 * step} height={D} style={{ overflow: 'visible', filter: 'drop-shadow(0 14px 30px rgba(0,0,0,0.8))' }}>
      <defs>
        <radialGradient id="wood" cx="50%" cy="40%" r="60%">
          <stop offset="0" stopColor="#5a2a14" />
          <stop offset="0.7" stopColor="#3a1a0c" />
          <stop offset="1" stopColor="#24100a" />
        </radialGradient>
        <radialGradient id="panel" cx="50%" cy="45%" r="55%">
          <stop offset="0" stopColor="#1a1714" />
          <stop offset="1" stopColor="#0b0908" />
        </radialGradient>
      </defs>
      {/* gold outline of the whole shape: strokes under the fills */}
      {cx.map((x) => (
        <circle key={`o${x}`} cx={x} cy={R} r={R - 2} fill="none" stroke={GOLD} strokeWidth={4} />
      ))}
      {cx.map((x) => (
        <circle key={`f${x}`} cx={x} cy={R} r={R - 3} fill="url(#wood)" />
      ))}
      {/* the decks' dark rings */}
      {[cx[0], cx[2]].map((x) => (
        <circle key={`r${x}`} cx={x} cy={R} r={R * 0.93} fill="#140c08" stroke="rgba(201,151,79,0.45)" strokeWidth={1.5} />
      ))}
      {/* the mixer's round panel, in front of the decks */}
      <circle cx={cx[1]} cy={R} r={R * 0.95} fill={GOLD} />
      <circle cx={cx[1]} cy={R} r={R * 0.93} fill="url(#panel)" />
    </svg>
  );
}

function DeckCircle({ engine, i, D, k, songs }: { engine: DjEngine; i: 0 | 1; D: number; k: number; songs: DjTrack[] }) {
  const deck = engine.decks[i];
  useDeck(deck);
  const [fx, setFx] = useState<{ type: FxType; amount: number }>({ type: 'echo', amount: 0 });
  const [pick, setPick] = useState(false);
  const [loading, setLoading] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const color = DECK_COLOR[i];
  // deck B is deck A mirrored: angles θ → 180° − θ
  const at = (deg: number, r: number) => polar(D, i === 0 ? deg : 180 - deg, r);
  const b = Math.round(26 * k);

  const load = async (data: ArrayBuffer, title: string, bpm: number | null, source: 'song' | 'file') => {
    setLoading(title);
    try {
      await engine.load(i, data, { title, bpm, source });
    } finally {
      setLoading('');
    }
  };
  const pos = deck.position();
  const angle = ((pos / 1.8) * 360) % 360;
  const ring = (active: boolean, c: string = color): CSSProperties => ({
    width: b,
    height: b,
    borderRadius: '50%',
    fontSize: 7.5 * k,
    boxShadow: active ? `0 0 ${8 * k}px ${c}` : 'inset 0 1px 2px rgba(255,255,255,0.15)',
    borderColor: active ? c : 'rgba(201,151,79,0.5)',
    color: active ? '#fff' : 'rgba(255,255,255,0.75)',
    background: active ? `${c}55` : '#0e0a08',
  });
  const FXN: Record<FxType, string> = { echo: 'ECHO', reverb: 'REV', flanger: 'FLNG', sweep: 'SWP' };

  return (
    <div className="absolute inset-0">
      {/* load a song: the button at the top of the ring (the title shows over the waveform) */}
      <div style={at(-90, 0.84)}>
        <Pad onDown={() => setPick(!pick)} className="border-0 bg-transparent">
          <span style={{ ...ring(pick), width: b * 1.5, borderRadius: 999 }} className="flex items-center justify-center border">
            {loading ? '…' : '♪ LOAD'}
          </span>
        </Pad>
      </div>

      {/* the platter */}
      <div style={polar(D, 0, 0)}>
        <Jog size={D * 0.54} angle={angle} onStart={(top) => deck.jogStart(top)} onTurn={(turns, dt) => deck.jogMove(turns * 1.8, dt)} onEnd={() => deck.jogEnd()}>
          <Platter deck={deck} size={D * 0.54} i={i} angle={angle} />
        </Jog>
      </div>

      {/* hot cues on the upper outer arc, effects on the upper inner arc */}
      {Array.from({ length: HOT_CUES }, (_, n) => (
        <div key={n} style={at(-150 + n * 13, 0.84)}>
          <Pad onDown={() => deck.hotCue(n)} onLong={() => deck.clearHotCue(n)} className="border-0 bg-transparent">
            <span style={ring(deck.hotCues[n] !== null, '#9be37a')} className="flex items-center justify-center border">{n + 1}</span>
          </Pad>
        </div>
      ))}
      {FX_TYPES.map((t, n) => (
        <div key={t} style={at(-68 + n * 13, 0.84)}>
          <Pad onDown={() => (setFx({ ...fx, type: t }), deck.setFx(t, fx.amount))} active={false} className="border-0 bg-transparent">
            <span style={ring(fx.type === t && fx.amount > 0.01)} className="flex items-center justify-center border">
              {FXN[t]}
            </span>
          </Pad>
        </div>
      ))}
      <div style={at(-22, 0.62)}>
        <Knob label="FX" size={28 * k} value={fx.amount} min={0} max={1} center={0} color={color} onChange={(v) => (setFx({ ...fx, amount: v }), deck.setFx(fx.type, v))} />
      </div>

      {/* tempo on the outer side */}
      <div style={at(180, 0.8)}>
        <div className="flex flex-col items-center" style={{ transform: `scale(${k})` }}>
          <span className="text-[8px] tabular-nums text-white/60">{(deck.tempo * 100).toFixed(1)}%</span>
          <Fader value={(deck.tempo / TEMPO_RANGE + 1) / 2} length={80} center={0.5} onChange={(v) => deck.setTempo((v * 2 - 1) * TEMPO_RANGE)} />
        </div>
      </div>

      {/* SYNC and KEY low on the sides, CUE and play at the bottom */}
      <div style={at(140, 0.8)}>
        <Pad onDown={() => engine.sync(i)} className="border-0 bg-transparent">
          <span style={{ ...ring(false), width: b * 1.4, borderRadius: 999 }} className="flex items-center justify-center border">
            SYNC
          </span>
        </Pad>
      </div>
      <div style={at(42, 0.68)}>
        <Pad onDown={() => deck.setKeylock(!deck.keylock)} className="border-0 bg-transparent">
          <span style={{ ...ring(deck.keylock, '#f5c66b'), width: b * 1.3, borderRadius: 999 }} className="flex items-center justify-center border">
            KEY
          </span>
        </Pad>
      </div>
      <div style={at(116, 0.84)}>
        <Pad onDown={() => deck.cueDown()} onUp={() => deck.cueUp()} className="border-0 bg-transparent">
          <Pill color={ORANGE} k={k} lit>
            CUE
          </Pill>
        </Pad>
      </div>
      <div style={at(80, 0.84)}>
        <Pad onDown={() => deck.toggle()} className="border-0 bg-transparent">
          <Pill color={BLUE} k={k} lit={deck.playing}>
            ▶❚❚
          </Pill>
        </Pad>
      </div>

      {pick && (
        <div className="absolute z-30 max-h-[70%] overflow-y-auto rounded-xl border border-[#c9974f]/40 bg-[#120c09]/95 p-2 text-sm shadow-xl" style={{ left: '12%', right: '12%', top: '18%' }}>
          {songs.map((s) => (
            <button
              key={s.url}
              onClick={async () => {
                setPick(false);
                await load(await (await fetch(s.url)).arrayBuffer(), s.title, s.bpm, 'song');
              }}
              className="block w-full truncate rounded px-2 py-2 text-left hover:bg-white/5"
            >
              ♪ {s.title} <span className="text-[10px] text-white/40">{s.bpm ? `${s.bpm} BPM` : ''}</span>
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

function Pill({ children, color, k, lit }: { children: ReactNode; color: string; k: number; lit?: boolean }) {
  return (
    <span
      className="flex items-center justify-center rounded-full border-2 font-bold"
      style={{ width: 48 * k, height: 26 * k, fontSize: 10 * k, borderColor: color, color: lit ? '#fff' : color, background: lit ? `${color}40` : '#0b0807', boxShadow: lit ? `0 0 ${12 * k}px ${color}` : `0 0 ${5 * k}px ${color}55` }}
    >
      {children}
    </span>
  );
}

/** The platter's picture: glowing swirls turning with the record, brighter with the sound. */
function Platter({ deck, size, i, angle }: { deck: Deck; size: number; i: 0 | 1; angle: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const data = useRef(new Uint8Array(128));
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    const S = (c.width = c.height = Math.round(size * 0.8 * devicePixelRatio));
    deck.analyser.getByteFrequencyData(data.current);
    let level = 0;
    for (let n = 0; n < 40; n++) level += data.current[n];
    level = level / (40 * 255);
    g.clearRect(0, 0, S, S);
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
  return <canvas ref={ref} className="pointer-events-none rounded-full" style={{ width: size * 0.8, height: size * 0.8 }} />;
}

function MixerCircle({ engine, D, k }: { engine: DjEngine; D: number; k: number }) {
  const [s, setS] = useState(() => [0, 1].map(() => ({ high: 0, mid: 0, low: 0, filter: 0, fader: 0.85 })));
  const [xf, setXf] = useState(0.5);
  const set = (i: 0 | 1, key: 'high' | 'mid' | 'low' | 'filter' | 'fader', v: number) => {
    setS((prev) => prev.map((x, j) => (j === i ? { ...x, [key]: v } : x)));
    const d = engine.decks[i];
    if (key === 'filter') d.setFilter(v);
    else if (key === 'fader') d.setFader(v);
    else d.setEq(key, v);
  };
  useEffect(() => {
    for (const i of [0, 1] as const) engine.decks[i].setFader(0.85);
  }, [engine]);
  const R = D / 2;
  const box = (x: number, y: number): CSSProperties => ({ position: 'absolute', left: R + x * R, top: R + y * R, transform: 'translate(-50%, -50%)' });
  const ks = 22 * k;

  return (
    <div className="absolute inset-0">
      {/* the two waveforms across the top: deck A above, deck B below */}
      <div style={{ ...box(0, -0.6), width: D * 0.66 }} className="flex flex-col gap-0.5">
        {([0, 1] as const).map((i) => (
          <div key={i}>
            <TrackLine deck={engine.decks[i]} i={i} k={k} />
            <Wave deck={engine.decks[i]} h={16 * k} />
          </div>
        ))}
      </div>
      {/* EQ + filter, a column per deck */}
      {([0, 1] as const).map((i) => (
        <div key={i} style={box(i === 0 ? -0.52 : 0.52, 0.2)} className="flex flex-col items-center">
          <Knob label="HI" size={ks} value={s[i].high} min={-26} max={6} center={0} color={DECK_COLOR[i]} onChange={(v) => set(i, 'high', v)} />
          <Knob label="MID" size={ks} value={s[i].mid} min={-26} max={6} center={0} color={DECK_COLOR[i]} onChange={(v) => set(i, 'mid', v)} />
          <Knob label="LOW" size={ks} value={s[i].low} min={-26} max={6} center={0} color={DECK_COLOR[i]} onChange={(v) => set(i, 'low', v)} />
          <Knob label="FILTER" size={ks} value={s[i].filter} min={-1} max={1} center={0} color="#9be37a" onChange={(v) => set(i, 'filter', v)} />
        </div>
      ))}
      {/* channel faders either side of the VJ screen */}
      {([0, 1] as const).map((i) => (
        <div key={`f${i}`} style={{ ...box(i === 0 ? -0.2 : 0.2, 0.36) }}>
          <div style={{ transform: `scale(${k * 0.85})` }}>
            <Fader value={s[i].fader} length={78} onChange={(v) => set(i, 'fader', v)} />
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
          <Fader horizontal value={xf} length={120} center={0.5} onChange={(v) => (setXf(v), engine.setCrossfader(v))} />
        </div>
      </div>
    </div>
  );
}

/**
 * The VJ view: each deck's picture — its MV when the song has one (later), else visuals drawn from its
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
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(4,6,10,0.35)';
      g.fillRect(0, 0, S, S);
      g.globalCompositeOperation = 'lighter';
      const xf = engine.crossfader;
      engine.decks.forEach((d, i) => {
        const mix = (i === 0 ? Math.cos((xf * Math.PI) / 2) : Math.sin((xf * Math.PI) / 2)) * d.faderValue;
        if (mix < 0.02) return;
        d.analyser.getByteFrequencyData(buf.current[i]);
        const f = buf.current[i];
        const col = DECK_COLOR[i];
        g.strokeStyle = col;
        g.globalAlpha = Math.min(1, mix * 1.2);
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
      <span className="rounded-sm px-1 font-bold text-black" style={{ background: DECK_COLOR[i] }}>
        {i === 0 ? 'A' : 'B'}
      </span>
      <span className="min-w-0 flex-1 truncate text-white/80">{deck.meta?.title ?? '—'}</span>
      <span className="tabular-nums" style={{ color: DECK_COLOR[i] }}>
        {deck.bpm ? deck.bpm.toFixed(1) : '--.-'}
      </span>
    </div>
  );
}

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
    const span = 8;
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
    mark(deck.cue, '#ffb340');
    deck.hotCues.forEach((x) => x !== null && mark(x, '#9be37a'));
    g.fillStyle = '#fff';
    g.fillRect(W / 2 - 1, 0, 2 * devicePixelRatio, H);
  });
  return <canvas ref={ref} className="w-full rounded-sm bg-black/70" style={{ height: h }} />;
}
