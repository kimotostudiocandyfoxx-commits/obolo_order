'use client';

import { ReelPlayer } from './ReelPlayer';
import { useEffect, useRef, useState } from 'react';
import { StarButton } from '@/components/finds/MarkRing';
import { workMarkRef } from '@/lib/finds/works';
import { Glyph } from '@/components/bluena/glyphs';
import { PlanetMark } from '@/components/bluena/PlanetMark';
import { LineIcon } from '@/components/LineIcon';
import { getApi } from '@/lib/api';
import { stopAudio, subscribeAudio, toggleAudio } from '@/lib/audio';
import { synth } from '@/lib/synth';
import { BoothMixer } from '@/lib/venus/booth';
import type { AtelierKind } from '@/lib/atelier/unlock';
import { countdown, jobView, onJobs } from '@/lib/atelier/jobs';
import { lyricBlockLabels, lyricHintLabel, type RefineTarget, type SongLyrics, type WorkMaterial } from '@obolo/shared';
import { faceTo, FLIES, swipeTo, versionsOf, type Work } from './work';
import { BookById, BookFace } from './BookRead';
import { GameById, GameFace } from './GamePlay';

/** client 2026-11-25: a book / a game — one face (its chapters / versions live on the server), its own body on the card */
const isCraftWork = (w: Work) => w.kind === 'novel' || w.kind === 'game';
const loadGame = (id: string) => getApi().game(id);
const loadBook = (id: string) => getApi().book(id);

/** the folder mark for each kind (glyph only, M-R211) */
export function KindMark({ kind, className = 'h-5 w-5' }: { kind: AtelierKind; className?: string }) {
  if (kind === 'look')
    // a face (the profile look)
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M9 10.2h0M15 10.2h0M8.8 14.3a4 4 0 0 0 6.4 0" />
      </svg>
    );
  if (kind === 'bati') return <LineIcon id="moon" className={className} />;
  if (kind === 'lookup') return <LineIcon id="compass" className={className} />;
  if (kind === 'image') return <LineIcon id="camera" className={className} />;
  if (kind === 'novel') return <Glyph id="book" label={false} className={className} />;
  return <Glyph id={kind} label={false} className={className} />;
}

/** play / stop a work's sound (a song sketch plays on the synth; tts:/idb:/https: through lib/audio) */
export function usePlay(w: Work) {
  const [on, setOn] = useState(false);
  useEffect(() => subscribeAudio((st) => !st.playing && setOn(false)), []);
  useEffect(() => () => (w.ref?.demoSong ? synth.stop() : undefined), [w.ref?.demoSong]);
  const toggle = async () => {
    if (w.ref?.demoSong) {
      if (on) synth.stop();
      else {
        stopAudio();
        synth.play(w.ref.demoSong.preset);
      }
      return setOn(!on);
    }
    if (!w.audio) return;
    synth.stop();
    try {
      await toggleAudio(w.audio);
      setOn((x) => !x);
    } catch {
      setOn(false);
    }
  };
  return [on, toggle] as const;
}

const btn = 'flex items-center justify-center gap-1 rounded-full px-3 py-1.5 text-[12px] disabled:opacity-40';

/** what pointing means for a kind (M-R253 §2): a spot, a stretch of the song, a scene, some words */
export function aimOf(w: Work): RefineTarget['kind'] | null {
  if (w.status !== 'ready' || isCraftWork(w)) return null;
  if (w.video) return 'frame';
  if (w.kind === 'song' || ((w.audio || w.ref?.demoSong) && !w.text)) return 'range';
  if (w.image) return 'point';
  if (w.text) return 'span';
  return null;
}

/**
 * A work in the talk (M-R210/M-R211): the result, then 〔再生〕〔やり直し〕〔星へ飛ばす〕. It is in Bluena already — the
 * card's edge flashes Bluena's light once when it was put away. The chat around it never changes while it is made.
 * M-R253: its tries are stacked inside it (swipe left / right, the dots under it; the one looked at last is the face);
 * 〔ここを直す〕 lets you point at the part to change, then ask in words; a slow one counts down (「あと3分」); the works
 * used as its material are small along its foot.
 */
export function WorkCard({
  w,
  busy,
  onAgain,
  onFly,
  onWear,
  onPick,
  onRecorded,
  onRing,
  onFace,
  onDropTry,
  onAsk,
  onMaterial,
  songUrl,
}: {
  w: Work;
  busy: boolean;
  /** none: no 〔やり直し〕 (a work shown again, e.g. what {bati} found) */
  onAgain?: () => void;
  /** M-R236: a long press on the ★ opens the mark ring */
  onRing?: (at: { x: number; y: number }) => void;
  onFly: () => void;
  onWear: () => void;
  onPick: (id: string) => void;
  onRecorded: (blob: Blob, seconds: number) => void;
  /** M-R253 §1: this try was looked at (it becomes the face) */
  onFace?: (i: number) => void;
  /** §1: throw this try away (inside the work) */
  onDropTry?: (i: number) => void;
  /** §2: the part pointed at, and the words */
  onAsk?: (text: string, target: RefineTarget) => void;
  /** §3: a material opened */
  onMaterial?: (m: WorkMaterial) => void;
  /** §3: the song a show is recorded over (a material) */
  songUrl?: { url: string; title: string };
}) {
  const vs = isCraftWork(w) ? [] : versionsOf(w);
  const making = w.status === 'making';
  const pages = vs.length + (making ? 1 : 0);
  const [page, setPage] = useState(() => (making ? vs.length : (w.active ?? Math.max(0, vs.length - 1))));
  // a new try arrived (or a new one is being made): look at it
  useEffect(() => setPage(making ? vs.length : (w.active ?? Math.max(0, vs.length - 1))), [vs.length, making, w.active]);
  const shown = page < vs.length && vs.length > 1 ? faceTo(w, page) : making && page === vs.length ? { ...w, image: undefined, video: undefined, text: undefined, audio: undefined, candidates: undefined, title: w.title } : w;
  const turn = (dir: -1 | 1) => {
    const n = swipeTo(page, dir, pages);
    if (n === page) return;
    setPage(n);
    if (n < vs.length) onFace?.(n);
  };
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const [on, toggle] = usePlay(shown);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!w.saved) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 1300);
    return () => clearTimeout(t);
  }, [w.saved, vs.length]);
  const planet = FLIES[w.kind];
  const sound = !!shown.audio || !!shown.ref?.demoSong;
  const showMaking = making && page === vs.length;

  // §2: pointing
  const aim = onAsk ? aimOf(shown) : null;
  const [aiming, setAiming] = useState(false);
  const [target, setTarget] = useState<RefineTarget | null>(null);
  const [words, setWords] = useState('');
  useEffect(() => {
    setAiming(false);
    setTarget(null);
  }, [page, w.status]);
  const ask = () => {
    if (!target || !words.trim()) return;
    onAsk?.(words.trim(), target);
    setWords('');
    setTarget(null);
    setAiming(false);
  };

  return (
    <div
      data-testid="work-card"
      className={`ml-11 max-w-[86%] rounded-[18px] border p-2.5 transition-shadow duration-700 ${flash ? 'border-sky-200/80 shadow-[0_0_22px_rgba(120,200,255,0.75)]' : 'border-amber-200/20 shadow-none'}`}
      style={{ background: 'linear-gradient(180deg, rgba(38,28,56,0.80), rgba(14,10,24,0.80))' }}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-amber-100/70">
        <KindMark kind={w.kind} className="h-4 w-4" />
        {(shown.title || (making && w.prompt)) && <p className="truncate text-[13px] font-bold text-amber-50">{shown.title || w.prompt}</p>}
        {/* M-R236: the small ★ at the card's top right */}
        {w.status === 'ready' && <StarButton {...workMarkRef(shown)} onRing={onRing} className="ml-auto shrink-0" />}
      </div>

      <div
        className="touch-pan-y"
        onPointerDown={(e) => {
          if (aiming) return;
          swipe.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const s0 = swipe.current;
          swipe.current = null;
          if (!s0 || pages < 2) return;
          const dx = e.clientX - s0.x;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - s0.y)) turn(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => (swipe.current = null)}
      >
        {showMaking && <Making w={w} />}

        {w.status === 'record' && <RadioRecorder onDone={onRecorded} song={songUrl} />}

        {!showMaking && w.kind === 'novel' && (w.book ? <BookFace book={w.book} /> : w.ref?.bookId ? <BookById id={w.ref.bookId} load={loadBook} /> : null)}
        {!showMaking && w.kind === 'game' && (w.game ? <GameFace game={w.game} /> : w.ref?.gameId ? <GameById id={w.ref.gameId} own load={loadGame} /> : null)}
        {!showMaking && shown.image && !isCraftWork(w) && (
          <div
            className="relative"
            onClick={(e) => {
              if (!aiming || aim !== 'point') return;
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setTarget({ kind: 'point', x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)), r: 0.09 });
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shown.image} alt={shown.title ?? ''} draggable={false} className={`max-h-64 w-full rounded-xl bg-black/30 ${w.kind === 'bati' ? 'object-contain' : 'object-cover'} ${aiming ? 'cursor-crosshair' : ''}`} />
            {aiming && !target && <span className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[11px] text-white/90 drop-shadow">直したい所を、指でさしてね</span>}
            {target?.kind === 'point' && (
              <span
                data-testid="aim-ring"
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-amber-300 shadow-[0_0_0_2px_rgba(40,20,0,0.45),0_0_20px_8px_rgba(255,200,90,0.8),inset_0_0_12px_rgba(255,220,140,0.9)]"
                style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%`, width: 44, height: 44, animation: 'pulse 1.6s ease-in-out infinite' }}
              />
            )}
          </div>
        )}
        {!showMaking && shown.candidates && shown.candidates.length > 1 && (
          <div className="mt-1.5 flex gap-1.5">
            {shown.candidates.map((c) => (
              <button key={c.id} onClick={() => onPick(c.id)} aria-label="候補" className={`h-12 w-12 overflow-hidden rounded-lg border-2 ${shown.pick === c.id ? 'border-amber-200' : 'border-transparent'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        {!showMaking && shown.video && <video src={shown.video} poster={shown.poster ?? undefined} controls playsInline className="w-full rounded-xl bg-black" />}
        {!showMaking && !shown.video && shown.reel && <ReelPlayer reel={shown.reel} title={shown.title?.replace(/（MV）$/, '')} />}
        {!showMaking && aiming && aim === 'frame' && <Frames w={shown} target={target} onTarget={setTarget} />}
        {!showMaking && sound && w.kind === 'song' && <Wave w={shown} aiming={aiming && aim === 'range'} target={target} onTarget={setTarget} />}
        {!showMaking && w.kind === 'song' && w.lyrics && <CardLyrics lyrics={w.lyrics} note={w.tweak?.what} />}
        {!showMaking && shown.text && (aiming && aim === 'span' ? <Phrases text={shown.text} target={target} onTarget={setTarget} /> : <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed text-white/90">{shown.text}</p>)}
        {!showMaking && shown.source && (
          <a href={shown.source.pageUrl} target="_blank" rel="noreferrer" className="mt-0.5 block text-[10px] text-amber-50/55 underline">
            出どころ：{shown.source.source}
          </a>
        )}
      </div>

      {/* §1: which try this is */}
      {pages > 1 && (
        <div className="mt-1.5 flex items-center justify-center gap-1.5" aria-label={`${page + 1}つ目（${pages}つのうち）`} data-testid="version-dots">
          <button onClick={() => turn(-1)} disabled={page === 0} aria-label="前の" className="px-1 text-amber-100/60 disabled:opacity-20">‹</button>
          {Array.from({ length: pages }, (_, i) => (
            <span key={i} className={`block h-1.5 rounded-full transition-all ${i === page ? 'w-4 bg-amber-200' : 'w-1.5 bg-white/30'} ${making && i === vs.length ? 'animate-pulse' : ''}`} />
          ))}
          <button onClick={() => turn(1)} disabled={page >= pages - 1} aria-label="次の" className="px-1 text-amber-100/60 disabled:opacity-20">›</button>
          <span className="ml-1 text-[10px] tabular-nums text-amber-100/55">{page + 1}/{pages}</span>
        </div>
      )}

      {w.kind === 'lookup' && w.status === 'ready' && <p className="mt-1 text-[10px] text-amber-50/45">答えが、まちがっていることもあります。大事なことは、自分でも確かめてね</p>}
      {!showMaking && shown.note && <p className="mt-1 text-[12px] text-amber-100/70">{shown.note}</p>}

      {/* §3: the works it was made from */}
      {!!w.materials?.length && (
        <div className="mt-1.5 flex items-center gap-1" data-testid="materials">
          <span className="text-[10px] text-amber-100/55">材料</span>
          {w.materials.map((m) => (
            <button key={m.id} onClick={() => onMaterial?.(m)} aria-label={m.title || '材料'} className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-md border border-white/15 bg-white/5 text-amber-100/70">
              {m.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <KindMark kind={m.kind} className="h-3.5 w-3.5" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* §2: point, then ask in words (on the card itself) */}
      {aiming && target && (
        <form
          className="mt-2 flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
        >
          <input value={words} onChange={(e) => setWords(e.target.value)} autoFocus placeholder="ここを、どうする？" className="min-w-0 flex-1 rounded-full border border-amber-200/30 bg-black/30 px-3 py-1.5 text-[13px] text-amber-50 placeholder:text-amber-100/40" />
          <button type="submit" disabled={busy || !words.trim()} className={`${btn} bg-amber-200 font-bold text-slate-950`}>
            たのむ
          </button>
        </form>
      )}

      {(w.status === 'ready' || w.status === 'failed') && !showMaking && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sound && (
            <button onClick={() => void toggle()} className={`${btn} bg-white/15`} aria-label={on ? '止める' : '再生'}>
              {on ? '❚❚ 止める' : '▶ 再生'}
            </button>
          )}
          {onAgain && w.kind !== 'novel' && w.kind !== 'game' && (
            <button onClick={onAgain} disabled={busy} className={`${btn} border border-white/20`}>
              やり直し
            </button>
          )}
          {aim && (
            <button onClick={() => (setAiming((x) => !x), setTarget(null))} disabled={busy} aria-pressed={aiming} className={`${btn} border ${aiming ? 'border-amber-200 bg-amber-200/20 text-amber-50' : 'border-white/20'}`}>
              {aiming ? 'やめる' : 'ここを直す'}
            </button>
          )}
          {(w.kind === 'look' || w.kind === 'bati') && w.status === 'ready' && (
            <button onClick={onWear} disabled={busy || w.worn} className={`${btn} bg-amber-200 font-bold text-slate-950`}>
              {w.worn ? 'これになった' : 'これにする'}
            </button>
          )}
          {planet && w.status === 'ready' && w.saved && (
            <button onClick={onFly} disabled={busy || w.flown} className={`${btn} bg-sky-300 font-bold text-slate-950`}>
              <PlanetMark id={planet} size={14} />
              {w.flown ? '飛んでいった' : '星へ飛ばす'}
            </button>
          )}
          {onDropTry && vs.length > 1 && page < vs.length && (
            <button onClick={() => confirm('この試しを消す？') && onDropTry(page)} disabled={busy} className="ml-auto px-1 text-[11px] text-white/45 underline">
              この試しを消す
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** M-R253 §4: the card while it is made — a slow one counts down and fills (「あと3分」); a quick one just turns */
export function Making({ w }: { w: Work }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    const off = onJobs(() => tick((n) => n + 1));
    return () => {
      clearInterval(t);
      off();
    };
  }, []);
  const job = jobView(w.job?.id);
  const c = countdown(job, Date.now(), !!w.job?.long);
  const deg = Math.round(c.progress * 360);
  return (
    <div className="flex h-28 flex-col items-center justify-center gap-1.5" aria-label="作っている">
      <span className="relative block h-14 w-14" aria-hidden>
        {w.job?.long ? (
          <span className="absolute inset-0 rounded-full transition-[background] duration-1000" style={{ background: `conic-gradient(rgba(255,226,160,0.9) ${deg}deg, rgba(255,255,255,0.1) ${deg}deg)` }} />
        ) : (
          <span className="absolute inset-0 animate-[spin_3s_linear_infinite] rounded-full border-2 border-dashed border-amber-200/70" />
        )}
        <span className="absolute inset-[6px] rounded-full bg-[rgba(20,14,34,0.95)]" />
        <span className="absolute inset-[18px] animate-pulse rounded-full bg-amber-100/80" />
      </span>
      {c.left && (
        <span data-testid="eta-left" className="text-[13px] font-bold tracking-[0.1em] text-amber-100">
          {c.left}
        </span>
      )}
    </div>
  );
}

/** §2: a song's waveform; drag along it to choose the stretch to change (it changes colour) */
function Wave({ w, aiming, target, onTarget }: { w: Work; aiming: boolean; target: RefineTarget | null; onTarget: (t: RefineTarget) => void }) {
  const [len, setLen] = useState(w.ref?.demoSong ? 32 : 60);
  useEffect(() => {
    if (!w.audio || !/^https?:|^blob:/.test(w.audio)) return;
    const a = new Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => Number.isFinite(a.duration) && a.duration > 0 && setLen(a.duration);
    a.src = w.audio;
  }, [w.audio]);
  const n = 48;
  const seed = [...(w.id + (w.title ?? ''))].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7);
  const bars = Array.from({ length: n }, (_, i) => 0.25 + 0.75 * Math.abs(Math.sin(i * 0.7 + (seed % 97)) * Math.cos(i * 0.23 + (seed % 13))));
  const from = useRef<number | null>(null);
  const at = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  };
  const sel = target?.kind === 'range' ? [target.from / len, target.to / len] : null;
  const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return (
    <div className="mt-1.5">
      <div
        data-testid="wave"
        className={`flex h-12 items-center gap-[2px] rounded-lg bg-black/25 px-1.5 ${aiming ? 'cursor-ew-resize touch-none ring-1 ring-amber-200/40' : ''}`}
        onPointerDown={(e) => {
          if (!aiming) return;
          e.stopPropagation();
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          from.current = at(e);
          onTarget({ kind: 'range', from: from.current * len, to: Math.min(len, (from.current + 0.04) * len) });
        }}
        onPointerMove={(e) => {
          if (!aiming || from.current == null) return;
          const b = at(e);
          onTarget({ kind: 'range', from: Math.min(from.current, b) * len, to: Math.max(from.current, b) * len });
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          from.current = null;
        }}
      >
        {bars.map((h, i) => {
          const x = (i + 0.5) / n;
          const inSel = sel && x >= sel[0] && x <= sel[1];
          return <span key={i} className="block flex-1 rounded-full" style={{ height: `${h * 100}%`, background: inSel ? '#ffd27a' : 'rgba(255,255,255,0.35)', boxShadow: inSel ? '0 0 6px rgba(255,210,122,0.8)' : undefined }} />;
        })}
      </div>
      {aiming && <p className="mt-0.5 text-center text-[11px] text-amber-100/70">{target?.kind === 'range' ? `${clock(target.from)}〜${clock(target.to)}` : '直したい所を、なぞってね'}</p>}
    </div>
  );
}

/** §2: a film's scenes; tap the one to change */
function Frames({ w, target, onTarget }: { w: Work; target: RefineTarget | null; onTarget: (t: RefineTarget) => void }) {
  const of = 6;
  return (
    <div className="mt-1.5">
      <div className="grid grid-cols-6 gap-1">
        {Array.from({ length: of }, (_, i) => (
          <button key={i} onClick={() => onTarget({ kind: 'frame', index: i, of })} aria-label={`${i + 1}つ目の場面`} className={`relative aspect-square overflow-hidden rounded-md border-2 bg-black/40 ${target?.kind === 'frame' && target.index === i ? 'border-amber-200 shadow-[0_0_10px_rgba(255,220,150,0.7)]' : 'border-transparent'}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {w.poster && <img src={w.poster} alt="" className="h-full w-full object-cover opacity-70" style={{ objectPosition: `${(i / (of - 1)) * 100}% 50%` }} />}
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white">{i + 1}</span>
          </button>
        ))}
      </div>
      <p className="mt-0.5 text-center text-[11px] text-amber-100/70">直したい場面を、えらんでね</p>
    </div>
  );
}

/** §2: words; tap the phrases to change (one, or a run of them) */
function Phrases({ text, target, onTarget }: { text: string; target: RefineTarget | null; onTarget: (t: RefineTarget) => void }) {
  const parts = text.split(/(?<=[、。！？!?\s])/).filter(Boolean);
  const starts = parts.reduce<number[]>((a, p, i) => [...a, i ? a[i - 1] + parts[i - 1].length : 0], []);
  const sel = target?.kind === 'span' ? target : null;
  return (
    <p className="mt-1 text-[14px] leading-relaxed text-white/90">
      {parts.map((p, i) => {
        const s0 = starts[i];
        const on = !!sel && s0 >= sel.start && s0 < sel.end;
        return (
          <button
            key={i}
            onClick={() => {
              const start = sel && s0 >= sel.end && sel.end === s0 ? sel.start : s0;
              const end = s0 + p.length;
              onTarget({ kind: 'span', start, end, text: text.slice(start, end) });
            }}
            className={`rounded px-0.5 ${on ? 'bg-amber-200/80 text-slate-950' : 'underline decoration-dotted decoration-white/30'}`}
          >
            {p}
          </button>
        );
      })}
    </p>
  );
}

/**
 * The recorded show (FM, M-R208): your songs from Bluena under your voice. 〔録る〕 starts the newest song and the mic;
 * 〔止める〕 keeps the take. Live streaming stays the members' booth on Venus.
 */
function RadioRecorder({ onDone, song: given }: { onDone: (blob: Blob, seconds: number) => void; song?: { url: string; title: string } }) {
  const mixer = useRef<BoothMixer | null>(null);
  const [state, setState] = useState<'idle' | 'on' | 'saving'>('idle');
  const [song, setSong] = useState<string | null>(null);
  const [sec, setSec] = useState(0);
  const [err, setErr] = useState('');
  useEffect(() => () => mixer.current?.close(), []);
  useEffect(() => {
    if (state !== 'on') return;
    const t = setInterval(() => setSec(Math.floor(mixer.current?.elapsed() ?? 0)), 500);
    return () => clearInterval(t);
  }, [state]);
  const start = async () => {
    setErr('');
    const mx = (mixer.current ??= new BoothMixer());
    try {
      await mx.openMic();
    } catch {
      return setErr('マイクが使えない…。設定でマイクを許してね');
    }
    // M-R253 §3: a song chosen as material goes on first
    const s = given ? { url: given.url, title: given.title, bpm: 0 } : (await getApi().radioDeck().catch(() => [])).find((x) => x.from !== 'mine' || x.allowRadio !== false);
    if (s) {
      await mx.decks[0].load(s.url, s.bpm).catch(() => undefined);
      mx.setFader(0);
      if (mx.decks[0].buffer) mx.decks[0].play();
      setSong(s.title);
    }
    mx.startRecording();
    setState('on');
  };
  const stop = async () => {
    const mx = mixer.current;
    if (!mx?.recording) return;
    setState('saving');
    const { blob, seconds } = await mx.stopRecording();
    mx.decks[0].stop();
    mx.closeMic();
    if (seconds < 1) {
      setState('idle');
      return setErr('短すぎたみたい。もう一回');
    }
    onDone(blob, seconds);
  };
  return (
    <div className="space-y-1.5 py-1 text-center">
      <p className="text-[12px] text-white/60">{state === 'on' ? (song ? `♪ ${song}` : '声だけで収録中') : 'ブルーナの曲を流しながら、話して録るよ'}</p>
      {state === 'on' ? (
        <button onClick={() => void stop()} className="mx-auto flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-black">
          ■ 止める <span className="font-sans text-xs">{`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`}</span>
        </button>
      ) : (
        <button onClick={() => void start()} disabled={state === 'saving'} className="mx-auto flex items-center gap-2 rounded-full bg-white/90 px-5 py-2 text-sm font-black text-slate-950 disabled:opacity-50">
          <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
          {state === 'saving' ? 'しまっています…' : '録る'}
        </button>
      )}
      {err && <p className="text-[12px] text-rose-300">{err}</p>}
    </div>
  );
}

/**
 * R13: a song's lyrics on its card, each block under its metatag label (〔Aメロ〕〔サビ〕〔2番サビ〕 …, the performance tags
 * small after it) — after a free change the cut parts are gone and a repeated part is there again
 */
function CardLyrics({ lyrics, note }: { lyrics: SongLyrics; note?: string }) {
  const labels = lyricBlockLabels(lyrics);
  return (
    <div className="mt-1.5 max-h-[150px] overflow-y-auto rounded-lg bg-[rgba(70,150,230,.12)] px-2.5 py-1.5" style={{ boxShadow: 'inset 0 0 0 1px rgba(190,240,255,.22)', scrollbarWidth: 'thin' }} data-testid="card-lyrics">
      {note && <p className="mb-1 text-[10.5px] text-sky-100/70">♪ {note}</p>}
      {lyrics.blocks.map((b, i) => (
        <div key={i} className="mb-1">
          <span className="mr-1 inline-block rounded-[3px] px-1.5 py-[1px] text-[10.5px] leading-tight text-sky-50" style={{ background: 'rgba(110,200,255,.24)', boxShadow: 'inset 0 0 0 1px rgba(210,248,255,.45)' }}>
            {labels[i]}
          </span>
          {b.hints.map((h) => (
            <span key={h} className="mr-1 inline-block rounded-[3px] px-1 py-[1px] text-[9.5px] leading-tight text-violet-50/90" style={{ background: 'rgba(170,140,255,.2)' }}>
              {lyricHintLabel(h)}
            </span>
          ))}
          {b.lines.map((l, j) => (
            <p key={j} className="m-0 pl-1 text-[12.5px] leading-snug text-white/85">
              {l}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}
