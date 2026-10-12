'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { HOT_CUES, TEMPO_RANGE, type Deck } from '@/lib/dj/deck';
import { DjEngine } from '@/lib/dj/engine';
import { FX_NAMES, FX_TYPES, type FxType } from '@/lib/dj/fx';
import { Fader, Jog, Knob, Pad } from './controls';

/**
 * The Venus DJ controller (client request 2026-10-12) — first stage: the sound engine with a plain
 * screen to try it; the client's design comes later. Two decks, mixer in the middle, landscape.
 * Tracks: the member's own songs (`songs`) or a file from the device.
 */
export interface DjTrack {
  title: string;
  url: string;
  bpm: number | null;
}

export function DjController({ songs = [] }: { songs?: DjTrack[] }) {
  const [engine, setEngine] = useState<DjEngine | null>(null);
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState('');
  const [xf, setXf] = useState(0.5);

  const start = async () => {
    setStarting(true);
    try {
      setEngine(await DjEngine.create());
    } catch (e) {
      setErr(String(e));
    } finally {
      setStarting(false);
    }
  };
  useEffect(() => () => engine?.close(), [engine]);

  if (!engine)
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#0b0916] px-6 text-white">
        <p className="text-lg tracking-[0.3em] text-amber-100">VENUS DJ</p>
        <button onClick={() => void start()} disabled={starting} className="rounded-full bg-amber-400 px-8 py-3 font-bold text-black disabled:opacity-50">
          {starting ? '準備中…' : 'はじめる'}
        </button>
        {err && <p className="max-w-sm text-center text-xs text-rose-300">{err}</p>}
        <p className="text-xs text-white/40">スマホは横向きにしてね</p>
      </div>
    );

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0b0916] text-white" style={{ touchAction: 'none' }}>
      <div className="flex h-full portrait:hidden">
        <DeckPanel engine={engine} i={0} songs={songs} />
        <div className="flex w-[22%] min-w-[170px] flex-col items-center justify-between border-x border-white/10 bg-black/30 px-1 py-2">
          <Mixer engine={engine} />
          <Fader horizontal value={xf} length={150} center={0.5} label="CROSSFADER" onChange={(v) => (setXf(v), engine.setCrossfader(v))} />
        </div>
        <DeckPanel engine={engine} i={1} songs={songs} />
      </div>
      <div className="hidden h-full items-center justify-center text-sm text-white/60 portrait:flex">横向きにしてね ↻</div>
    </div>
  );
}

function useDeck(deck: Deck) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const off = deck.onChange(force);
    return () => void off();
  }, [deck]);
  // the position moves smoothly between the engine's updates
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

function DeckPanel({ engine, i, songs }: { engine: DjEngine; i: 0 | 1; songs: DjTrack[] }) {
  const deck = engine.decks[i];
  useDeck(deck);
  const [loading, setLoading] = useState('');
  const [fx, setFx] = useState<{ type: FxType; amount: number }>({ type: 'echo', amount: 0 });
  const [pick, setPick] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const side = i === 0 ? 'A' : 'B';
  const color = i === 0 ? '#5ad1ff' : '#ff7ad9';

  const loadData = async (data: ArrayBuffer, title: string, bpm: number | null, source: 'song' | 'file') => {
    setLoading(title);
    try {
      await engine.load(i, data, { title, bpm, source });
    } finally {
      setLoading('');
    }
  };
  const fromSong = async (t: DjTrack) => {
    setPick(false);
    await loadData(await (await fetch(t.url)).arrayBuffer(), t.title, t.bpm, 'song');
  };

  const pos = deck.position();
  const angle = ((pos / 1.8) * 360) % 360;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className="relative flex flex-1 flex-col px-2 py-2">
      <div className="flex items-center gap-2 text-[11px]">
        <span className="rounded px-1.5 py-0.5 font-bold text-black" style={{ background: color }}>
          {side}
        </span>
        <button onClick={() => setPick(!pick)} className="min-w-0 flex-1 truncate rounded bg-white/5 px-2 py-1 text-left">
          {loading ? `読み込み中… ${loading}` : (deck.meta?.title ?? '曲をえらぶ ▾')}
        </button>
        <span className="tabular-nums text-amber-100">{deck.bpm ? deck.bpm.toFixed(1) : '--.-'} BPM</span>
      </div>
      <Wave deck={deck} color={color} />
      <div className="flex items-center justify-between text-[10px] tabular-nums text-white/50">
        <span>{fmt(pos)}</span>
        <span>-{fmt(Math.max(0, deck.duration - pos))}</span>
      </div>

      <div className={`mt-1 flex flex-1 items-center gap-2 ${i === 1 ? 'flex-row-reverse' : ''}`}>
        <div className="flex flex-col items-center gap-2">
          <span className="text-[9px] text-white/50">{(deck.tempo * 100).toFixed(1)}%</span>
          {/* tempo: up = faster (a fader drawn from −16% at the bottom to +16% at the top) */}
          <Fader value={(deck.tempo / TEMPO_RANGE + 1) / 2} length={130} center={0.5} label="TEMPO" onChange={(v) => deck.setTempo((v * 2 - 1) * TEMPO_RANGE)} />
          <Pad onDown={() => deck.setKeylock(!deck.keylock)} active={deck.keylock} className="px-2 py-1">
            KEY
          </Pad>
        </div>
        <div className="flex flex-1 flex-col items-center gap-2">
          <Jog size={150} angle={angle} onStart={(top) => deck.jogStart(top)} onTurn={(turns, dt) => deck.jogMove(turns * 1.8, dt)} onEnd={() => deck.jogEnd()}>
            <span className="pointer-events-none text-[10px] text-white/40">{deck.playing ? '▶' : '❚❚'}</span>
          </Jog>
          <div className="grid w-full max-w-[220px] grid-cols-4 gap-1">
            {Array.from({ length: HOT_CUES }, (_, k) => (
              <Pad key={k} onDown={() => deck.hotCue(k)} onLong={() => deck.clearHotCue(k)} active={deck.hotCues[k] !== null} className="py-2">
                {k + 1}
              </Pad>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Pad onDown={() => engine.sync(i)} className="w-14 py-2">
            SYNC
          </Pad>
          <Pad onDown={() => deck.cueDown()} onUp={() => deck.cueUp()} className="w-14 py-3">
            CUE
          </Pad>
          <Pad onDown={() => deck.toggle()} active={deck.playing} className="w-14 py-4 text-base">
            ▶❚❚
          </Pad>
        </div>
      </div>

      <div className="mt-1 flex items-center justify-center gap-2">
        <div className="flex gap-1">
          {FX_TYPES.map((t) => (
            <Pad key={t} onDown={() => (setFx({ ...fx, type: t }), deck.setFx(t, fx.amount))} active={fx.type === t} className="px-1.5 py-1 text-[9px]">
              {FX_NAMES[t]}
            </Pad>
          ))}
        </div>
        <Knob label="FX" size={40} value={fx.amount} min={0} max={1} center={0} color={color} onChange={(v) => (setFx({ ...fx, amount: v }), deck.setFx(fx.type, v))} />
      </div>

      {pick && (
        <div className="absolute inset-x-2 top-9 z-20 max-h-[70%] overflow-y-auto rounded-xl border border-white/15 bg-[#151226] p-2 text-sm shadow-xl">
          {songs.map((s) => (
            <button key={s.url} onClick={() => void fromSong(s)} className="block w-full truncate rounded px-2 py-2 text-left hover:bg-white/5">
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
              await loadData(await f.arrayBuffer(), f.name.replace(/\.[^.]+$/, ''), null, 'file');
            }}
          />
        </div>
      )}
    </div>
  );
}

function Mixer({ engine }: { engine: DjEngine }) {
  const [s, setS] = useState(() => [0, 1].map(() => ({ trim: 1, high: 0, mid: 0, low: 0, filter: 0, fader: 0.85 })));
  const set = useCallback(
    (i: 0 | 1, k: keyof (typeof s)[number], v: number) => {
      setS((prev) => prev.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
      const d = engine.decks[i];
      if (k === 'trim') d.setTrim(v);
      else if (k === 'filter') d.setFilter(v);
      else if (k === 'fader') d.setFader(v);
      else d.setEq(k, v);
    },
    [engine],
  );
  useEffect(() => {
    for (const i of [0, 1] as const) engine.decks[i].setFader(0.85);
  }, [engine]);
  return (
    <div className="flex w-full justify-around">
      {([0, 1] as const).map((i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <Knob label="TRIM" size={34} value={s[i].trim} min={0} max={2} center={1} onChange={(v) => set(i, 'trim', v)} />
          <Knob label="HI" size={34} value={s[i].high} min={-26} max={6} center={0} onChange={(v) => set(i, 'high', v)} />
          <Knob label="MID" size={34} value={s[i].mid} min={-26} max={6} center={0} onChange={(v) => set(i, 'mid', v)} />
          <Knob label="LOW" size={34} value={s[i].low} min={-26} max={6} center={0} onChange={(v) => set(i, 'low', v)} />
          <Knob label="FILTER" size={34} value={s[i].filter} min={-1} max={1} center={0} color="#9be37a" onChange={(v) => set(i, 'filter', v)} />
          <Fader value={s[i].fader} length={84} onChange={(v) => set(i, 'fader', v)} />
        </div>
      ))}
    </div>
  );
}

/** The waveform around the playhead (±4 s), with the cue and hot cues. */
function Wave({ deck, color }: { deck: Deck; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    const W = (c.width = c.clientWidth * devicePixelRatio);
    const H = (c.height = c.clientHeight * devicePixelRatio);
    g.clearRect(0, 0, W, H);
    const p = deck.position();
    const span = 8;
    const peaks = deck.peaks;
    g.fillStyle = color;
    for (let x = 0; x < W; x++) {
      const t = p - span / 2 + (x / W) * span;
      const v = peaks[Math.floor(t * 100)] ?? 0;
      g.globalAlpha = t < p ? 0.45 : 0.9;
      g.fillRect(x, H / 2 - (v * H) / 2, 1, v * H);
    }
    g.globalAlpha = 1;
    const mark = (t: number, col: string) => {
      const x = ((t - (p - span / 2)) / span) * W;
      if (x < 0 || x > W) return;
      g.fillStyle = col;
      g.fillRect(x - 1, 0, 2 * devicePixelRatio, H);
    };
    // beat ticks
    if (deck.meta?.bpm) {
      const b = 60 / deck.meta.bpm;
      for (let t = deck.meta.firstBeat + Math.ceil((p - span / 2 - deck.meta.firstBeat) / b) * b; t < p + span / 2; t += b) mark(t, 'rgba(255,255,255,0.18)');
    }
    mark(deck.cue, '#ffb340');
    deck.hotCues.forEach((h) => h !== null && mark(h, '#9be37a'));
    g.fillStyle = '#fff';
    g.fillRect(W / 2 - 1, 0, 2 * devicePixelRatio, H);
  });
  return <canvas ref={ref} className="mt-1 h-12 w-full rounded bg-black/40" />;
}
