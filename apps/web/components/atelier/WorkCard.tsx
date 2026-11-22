'use client';

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
import { FLIES, type Work } from './work';

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

/**
 * A work in the talk (M-R210/M-R211): the result, then 〔再生〕〔やり直し〕〔星へ飛ばす〕. It is in Bluena already — the
 * card's edge flashes Bluena's light once when it was put away. The chat around it never changes while it is made.
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
}) {
  const [on, toggle] = usePlay(w);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!w.saved) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 1300);
    return () => clearTimeout(t);
  }, [w.saved]);
  const planet = FLIES[w.kind];
  const sound = !!w.audio || !!w.ref?.demoSong;

  return (
    <div
      className={`ml-11 max-w-[86%] rounded-[18px] border p-2.5 transition-shadow duration-700 ${flash ? 'border-sky-200/80 shadow-[0_0_22px_rgba(120,200,255,0.75)]' : 'border-amber-200/20 shadow-none'}`}
      style={{ background: 'linear-gradient(180deg, rgba(38,28,56,0.80), rgba(14,10,24,0.80))' }}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-amber-100/70">
        <KindMark kind={w.kind} className="h-4 w-4" />
        {w.title && <p className="truncate text-[13px] font-bold text-amber-50">{w.title}</p>}
        {/* M-R236: the small ★ at the card's top right */}
        {w.status === 'ready' && <StarButton {...workMarkRef(w)} onRing={onRing} className="ml-auto shrink-0" />}
      </div>

      {w.status === 'making' && (
        <div className="flex h-24 items-center justify-center" aria-label="作っている">
          <span className="relative block h-12 w-12" aria-hidden>
            <span className="absolute inset-0 animate-[spin_3s_linear_infinite] rounded-full border-2 border-dashed border-amber-200/70" />
            <span className="absolute inset-[14px] animate-pulse rounded-full bg-amber-100/80" />
          </span>
        </div>
      )}

      {w.status === 'record' && <RadioRecorder onDone={onRecorded} />}

      {w.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={w.image} alt={w.title ?? ''} className={`max-h-64 w-full rounded-xl bg-black/30 ${w.kind === 'bati' ? 'object-contain' : 'object-cover'}`} />
      )}
      {w.candidates && w.candidates.length > 1 && (
        <div className="mt-1.5 flex gap-1.5">
          {w.candidates.map((c) => (
            <button key={c.id} onClick={() => onPick(c.id)} aria-label="候補" className={`h-12 w-12 overflow-hidden rounded-lg border-2 ${w.pick === c.id ? 'border-amber-200' : 'border-transparent'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {w.video && <video src={w.video} poster={w.poster ?? undefined} controls playsInline className="w-full rounded-xl bg-black" />}
      {w.text && <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed text-white/90">{w.text}</p>}
      {w.source && (
        <a href={w.source.pageUrl} target="_blank" rel="noreferrer" className="mt-0.5 block text-[10px] text-amber-50/55 underline">
          出どころ：{w.source.source}
        </a>
      )}
      {w.kind === 'lookup' && w.status === 'ready' && <p className="mt-1 text-[10px] text-amber-50/45">答えが、まちがっていることもあります。大事なことは、自分でも確かめてね</p>}
      {w.note && <p className="mt-1 text-[12px] text-amber-100/70">{w.note}</p>}

      {(w.status === 'ready' || w.status === 'failed') && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sound && (
            <button onClick={() => void toggle()} className={`${btn} bg-white/15`} aria-label={on ? '止める' : '再生'}>
              {on ? '❚❚ 止める' : '▶ 再生'}
            </button>
          )}
          {onAgain && (
            <button onClick={onAgain} disabled={busy} className={`${btn} border border-white/20`}>
              やり直し
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
        </div>
      )}
    </div>
  );
}

/**
 * The recorded show (FM, M-R208): your songs from Bluena under your voice. 〔録る〕 starts the newest song and the mic;
 * 〔止める〕 keeps the take. Live streaming stays the members' booth on Venus.
 */
function RadioRecorder({ onDone }: { onDone: (blob: Blob, seconds: number) => void }) {
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
    const s = (await getApi().radioDeck().catch(() => [])).find((x) => x.from !== 'mine' || x.allowRadio !== false);
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
