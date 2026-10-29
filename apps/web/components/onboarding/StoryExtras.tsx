'use client';

import { isDemoMode } from '@/lib/onboarding/demoMode';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { motionUrl, SE_FILES, seUrl, spriteUrl } from '@/lib/onboarding/media';
import type { PictureFx, SoundFx } from '@/lib/onboarding/script';
import { playPreset, type Preset } from '@/lib/story/sfx';
import { IconButton } from '@/components/story/parts';
import { TicketArt } from '@/components/story/Ticket';
import { micTrouble, useDictation } from '@/lib/useDictation';
import { nameCharsOk } from '@obolo/shared';

/**
 * Pieces of the first journey's story (docs/story-rewrite/土星まで_UI引き継ぎ.md, 2026-10-14) that the
 * player shows on top of the pictures: the age answer, the eight riddle cards and the riddle book,
 * Bluena's square screen, the picture effects, the "stop for today" and the 88-minute screens.
 */

// --- sound effects ---------------------------------------------------------------------------------
let ctx: AudioContext | null = null;
/** Create the audio context inside the first tap (iOS). */
export function unlockSfx() {
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
  } catch {
    /* no audio */
  }
}
/** the made sounds a story sound falls back to when its file is not there */
const NEAREST: Record<string, Preset> = { 'gate-close': 'thud', smoke: 'whoosh', rocket: 'whoosh', crackers: 'pop', 'egg-crack': 'pop', paper: 'whoosh', stamp: 'thud', footsteps: 'knock', portal: 'magic' };
const seBuffers = new Map<string, Promise<AudioBuffer | null>>();
/** the sounds already decoded: played in the same moment as the tap, without waiting a turn */
const seReady = new Map<string, AudioBuffer>();
function seBuffer(id: string): Promise<AudioBuffer | null> {
  let p = seBuffers.get(id);
  if (!p && ctx) {
    const c = ctx;
    p = fetch(seUrl(id))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((b) => c.decodeAudioData(b))
      .then((buf) => (seReady.set(id, buf), buf))
      .catch(() => null);
    seBuffers.set(id, p);
  }
  return p ?? Promise.resolve(null);
}
/** Fetch a made sound ahead, so it plays on its cue. */
export function prefetchSfx(sound: SoundFx) {
  if (SE_FILES.has(sound)) void seBuffer(sound);
}
/** sounds that ring on behind the next lines until the player taps on (fadeLongSfx) */
const LONG: ReadonlySet<string> = new Set(['pinpon', 'pinpon-muffled']);
const ringing = new Set<GainNode>();
/** Fade out the sounds that ring on (a tap moved the story on). */
export function fadeLongSfx(ms = 400) {
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const g of ringing) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + ms / 1000);
  }
  ringing.clear();
}
export function playSfx(sound: SoundFx, muted: boolean, volume = 1) {
  if (muted || !ctx || volume <= 0) return;
  const c = ctx;
  const synth = () => {
    try {
      playPreset(c, (NEAREST[sound] ?? sound) as Preset, 0.45 * volume);
    } catch {
      /* ignore */
    }
  };
  if (!SE_FILES.has(sound)) return synth();
  const play = (buf: AudioBuffer | null) => {
    if (!buf) return synth();
    const src = c.createBufferSource();
    const g = c.createGain();
    g.gain.value = 0.8 * volume;
    src.buffer = buf;
    src.connect(g).connect(c.destination);
    if (LONG.has(sound)) {
      ringing.add(g);
      src.onended = () => ringing.delete(g);
    }
    src.start();
  };
  const ready = seReady.get(sound);
  if (ready) play(ready);
  else void seBuffer(sound).then(play);
}

// --- a text box with the mic first ----------------------------------------------------------------
/** Mic-first text input in the story's gold style: tap the mic and speak, or type. */
/**
 * Day 1 until Saturn: words are typed, no mic (story M-R41, 2026-10-15 — the voice comes out first on
 * Saturn). StoryPlayer provides false for those days.
 */
export const MicAllowed = createContext(true);

/** M-R130: the first time ⌨ is pressed, one line (then the keyboard opens); remembered on this device */
const KB_NOTICE = 'obolo.kbNotice';
function kbNoticeSeen() {
  try {
    return localStorage.getItem(KB_NOTICE) === '1';
  } catch {
    return false;
  }
}

/**
 * The input of every making screen (story M-R130 「声が主役、文字は非常口」): a big 〔🎙 話してみよう〕 in the
 * middle, the words heard shown above it; a small ⌨ in the corner only for when you cannot speak (the first
 * press shows 「声が出せる場所で、また来てね。ここは、声で作る宇宙です」 once, then the keyboard opens anyway).
 * `textFirst`: names (and the days before the voice comes out, MicAllowed=false) stay a plain text field.
 */
export function VoiceField({
  value,
  onChange,
  placeholder,
  maxLength = 20,
  multiline = false,
  light = false,
  textFirst = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  maxLength?: number;
  multiline?: boolean;
  /** on a white panel (the planet lessons): dark text */
  light?: boolean;
  /** a name: typed, not spoken */
  textFirst?: boolean;
}) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const mic = useDictation({ field: ref, value, onChange, maxLength });
  // while they speak, their own figure comes up big (M-R149, components/NeoSpeaking.tsx)
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('obolo:speaking', { detail: mic.listening }));
    return () => {
      if (mic.listening) window.dispatchEvent(new CustomEvent('obolo:speaking', { detail: false }));
    };
  }, [mic.listening]);
  const withMic = useContext(MicAllowed);
  const [typing, setTyping] = useState(false);
  const [notice, setNotice] = useState(false);
  // no recogniser on this phone: still the mic screen, with the reason in one line (never the keyboard by itself)
  const voiceFirst = withMic && !textFirst;
  const cls = light
    ? `min-w-0 flex-1 rounded-xl border bg-white px-3 py-2 text-slate-800 outline-none placeholder:text-slate-400 ${mic.listening ? 'border-rose-400' : 'border-slate-300 focus:border-amber-400'}`
    : `min-w-0 flex-1 border-b bg-transparent px-2 py-2 text-amber-50 outline-none placeholder:text-white/35 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)] ${mic.listening ? 'border-rose-300' : 'border-amber-100/45 focus:border-amber-200/90'}`;
  const field = multiline ? (
    <textarea ref={ref} className={`${cls} h-24 resize-none`} style={{ fontSize: 17 }} maxLength={maxLength} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
  ) : (
    <input ref={ref} className={`${cls} text-center tracking-widest`} style={{ fontSize: 18 }} maxLength={maxLength} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
  );
  const example = isDemoMode() && !value && (
    <button type="button" onClick={() => onChange(placeholder.split('／')[0].slice(0, maxLength))} className={`mt-1.5 text-[11px] tracking-wider underline ${light ? 'text-amber-600' : 'text-amber-200/70'}`}>
      例で進む
    </button>
  );

  if (!voiceFirst)
    return (
      <div>
        <div className="flex items-center gap-2">
          {field}
          {withMic && !textFirst && (
            <button type="button" onClick={mic.toggle} disabled={!mic.supported} aria-label="話して入力" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-200/70 bg-black/60 disabled:opacity-30">
              🎙
            </button>
          )}
        </div>
        {example}
      </div>
    );

  const sub = light ? 'text-slate-400' : 'text-white/55';
  return (
    <div className="relative flex flex-col items-center">
      {/* what was heard (tap ⌨ to touch it up by hand) */}
      {(value || typing) && <div className="mb-3 flex w-full items-center gap-2">{typing ? field : <p className={`w-full rounded-xl px-3 py-2 text-center text-[16px] font-bold ${light ? 'bg-amber-50 text-slate-700' : 'bg-white/10 text-amber-50'}`}>{value}</p>}</div>}
      <button
        type="button"
        onClick={mic.toggle}
        disabled={!mic.supported}
        aria-label={mic.listening ? '録音をとめる' : '話してみよう'}
        className="relative flex h-24 w-24 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-40"
      >
        {/* the gold mic of the voice answers (client 2026-10-29): rings of light while it listens, a slow breath while it waits */}
        {mic.listening ? (
          [0, 0.6, 1.2].map((d) => <span key={d} className="absolute inset-0 rounded-full border border-amber-200/70" style={{ animation: `micRing 1.8s ${d}s ease-out infinite` }} />)
        ) : (
          <span className="absolute -inset-2 rounded-full bg-[radial-gradient(circle,rgba(255,206,120,0.28),transparent_70%)]" style={{ animation: 'micBreath 2.6s ease-in-out infinite' }} />
        )}
        <span className={`absolute inset-0 rounded-full border transition-colors duration-300 ${mic.listening ? 'border-amber-100 bg-[radial-gradient(circle_at_50%_35%,rgba(255,214,140,0.35),rgba(40,26,8,0.92)_70%)] shadow-[0_0_34px_rgba(255,204,120,0.65)]' : 'border-amber-200/70 bg-[radial-gradient(circle_at_50%_30%,rgba(70,48,18,0.95),rgba(8,6,12,0.95)_72%)] shadow-[0_0_22px_rgba(255,204,120,0.3)]'}`} />
        <span className="absolute inset-[7px] rounded-full border border-amber-200/25" />
        <svg viewBox="0 0 24 24" className={`relative h-9 w-9 ${mic.listening ? 'text-amber-50' : 'text-amber-200'}`} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="9" y="3" width="6" height="11" rx="3" fill={mic.listening ? 'currentColor' : 'none'} />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
          <path d="M12 17.5V21M9 21h6" />
        </svg>
      </button>
      <p className={`mt-2 text-[15px] font-black ${light ? 'text-amber-700' : 'text-amber-100'}`}>{mic.listening ? '話しおわったら、もう一度タップ' : value ? 'もう一度、話してみる' : '話してみよう'}</p>
      <p className={`mt-0.5 text-center text-[11px] ${sub}`}>{mic.listening ? mic.interim || 'きいています…' : (micTrouble(mic.supported ? mic.code : 'unsupported') ?? `例「${placeholder.replace(/^例：/, '').split('／')[0]}」`)}</p>
      {example}
      {/* the emergency exit: only when you cannot speak */}
      {!typing && (
        <button
          type="button"
          onClick={() => {
            if (kbNoticeSeen()) return setTyping(true);
            setNotice(true);
          }}
          className={`absolute bottom-0 right-0 p-1.5 text-lg ${light ? 'text-slate-300' : 'text-white/40'}`}
          aria-label="声が出せない時だけ、文字で"
        >
          ⌨
        </button>
      )}
      {notice && (
        <div className={`mt-3 w-full rounded-2xl p-3 text-center text-[13px] leading-relaxed ${light ? 'bg-slate-100 text-slate-600' : 'bg-black/60 text-amber-50'}`}>
          声が出せる場所で、また来てね。ここは、声で作る宇宙です
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem(KB_NOTICE, '1');
              } catch {
                /* private mode */
              }
              setNotice(false);
              setTyping(true);
            }}
            className="mt-2 block w-full text-[12px] underline"
          >
            いまは文字で進む
          </button>
        </div>
      )}
    </div>
  );
}

const panel = 'pb-safe absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/85 to-transparent px-6 pt-20';
const gold =
  'w-full rounded-full border border-amber-200/80 bg-gradient-to-b from-amber-200/25 to-amber-500/10 py-3.5 text-lg tracking-widest text-amber-50 shadow-[0_0_24px_rgba(255,210,130,0.25)] disabled:opacity-40';
const plain = 'w-full rounded-full border border-white/30 bg-black/40 py-3 text-[15px] tracking-widest text-white/85';

// --- Day 1: age -------------------------------------------------------------------------------------
/** 「太陽をまわった回数」: answer (saved) or 「言わない」. */
export function AgeInput({ onAnswer, onSkip }: { onAnswer: (age: string) => void; onSkip: () => void }) {
  const [v, setV] = useState('');
  const n = v.replace(/[^0-9０-９]/g, '').replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  return (
    <div className={panel}>
      <div className="mx-auto mb-8 flex max-w-sm animate-[fadeUp_0.6s_ease-out] flex-col gap-3">
        <VoiceField textFirst value={v} onChange={setV} placeholder="太陽をまわった回数" maxLength={8} />
        <button className={gold} disabled={!n || Number(n) > 150} onClick={() => onAnswer(String(Number(n)))}>
          答える
        </button>
        <button className={plain} onClick={onSkip}>
          言わない
        </button>
      </div>
    </div>
  );
}

// --- Day 2: the NEO name ---------------------------------------------------------------------------
/** Names are written in hiragana, katakana or English letters (client decision 2026-10-16: the voices read them right). */
export function NameRule({ value }: { value: string }) {
  const bad = !!value.trim() && !nameCharsOk(value);
  return <p className={`w-full text-center text-xs ${bad ? 'text-amber-200' : 'text-white/55'}`}>{bad ? 'ひらがな・カタカナ・英語で入れてね' : 'ひらがな・カタカナ・英語で'}</p>;
}

export function NeoNameInput({ placeholder, submit, onSubmit }: { placeholder: string; submit: string; onSubmit: (name: string) => Promise<void> }) {
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    const n = v.trim();
    if (!n || !nameCharsOk(n)) return;
    setBusy(true);
    setErr(null);
    try {
      await onSubmit(n);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  return (
    <div className={panel}>
      <div className="mx-auto mb-8 flex max-w-sm animate-[fadeUp_0.6s_ease-out] flex-col gap-3">
        <VoiceField textFirst value={v} onChange={setV} placeholder={placeholder} />
        <button className={gold} disabled={!v.trim() || !nameCharsOk(v) || busy} onClick={go}>
          {busy ? '……' : submit}
        </button>
        <NameRule value={v} />
        <p className="text-center text-xs text-white/50">名前は、あとでいつでも変えられます</p>
        {err && <p className="text-center text-sm text-rose-300">{err}</p>}
      </div>
    </div>
  );
}

// --- the riddle cards and the book -----------------------------------------------------------------
/** The eight seals of the riddle book. `answer` appears once the riddle is solved. */
export const SEALS: Record<number, { q: string; answer?: string }> = {
  1: { q: 'oboloとは', answer: 'oboloは、町の名前。DJの町' },
  2: { q: 'Obolo Orderは全員……', answer: 'DJ' },
  3: { q: '結社の目的とは' },
  4: { q: 'Obolo Orderの敵は……', answer: 'ナガレ' },
  6: { q: 'OBOLONは……' },
  7: { q: 'コスモスは' },
  8: { q: '宝は' },
};
/** Cards whose words appear on Day 1. */
export const DAY1_SEALS = [1, 7, 8];
/** The words on the riddle cards by the journey day you are on (2 on Saturn, 3 on Jupiter, 6 on Mercury). */
export function knownSealsOn(day: number): number[] {
  // the book is handed over at the launch pit on day 2 (story M-R61): from day 3 the first three are known
  return [...(day >= 3 ? DAY1_SEALS : []), ...(day >= 4 ? [2] : []), ...(day >= 5 ? [3] : []), ...(day >= 6 ? [6] : []), ...(day >= 7 ? [4] : [])];
}
/** Answers that are open: 2 and 4 at the Sun for everyone (day 8), 1 with the Eclipse (draft 21) — so from day 9 on. */
export function solvedSealsOn(day: number, ordered = true): number[] {
  return day >= 9 ? (ordered ? [1, 2, 4] : [2, 4]) : [];
}

function Card({ n, lit, size = 64, style }: { n: number; lit: boolean; size?: number; style?: React.CSSProperties }) {
  return (
    <div
      className={`absolute flex flex-col items-center justify-center rounded-md border text-center transition-all duration-700 ${lit ? 'border-amber-200 bg-gradient-to-b from-amber-200/40 to-amber-600/20 shadow-[0_0_24px_rgba(255,214,140,0.8)]' : 'border-amber-200/50 bg-amber-100/10 shadow-[0_0_12px_rgba(255,214,140,0.35)]'}`}
      style={{ width: size, height: size * 1.45, ...style }}
    >
      <span className="text-[11px] text-amber-200/80">{n}</span>
      {lit && <span className="mt-1 px-1 text-[11px] leading-tight text-amber-50 [word-break:keep-all]">{SEALS[n]?.q}</span>}
    </div>
  );
}

/**
 * Day 1: the cards rise one by one in a circle behind MONBAN (all blank), then 1・7・8 get their words,
 * then they turn into light and are drawn into an old leather book. Tap to continue at the end.
 */
export function RiddleCards({ onDone }: { onDone: () => void }) {
  const [shown, setShown] = useState(0);
  const [lit, setLit] = useState(false);
  const [book, setBook] = useState(false);
  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];
    for (let k = 1; k <= 8; k++) ts.push(setTimeout(() => setShown(k), 350 * k));
    ts.push(setTimeout(() => setLit(true), 350 * 8 + 700));
    return () => ts.forEach(clearTimeout);
  }, []);
  const R = 'min(34vw, 150px)';
  return (
    <button className="absolute inset-0 z-[12] flex items-center justify-center bg-black/35" onClick={() => (book ? onDone() : lit && setBook(true))}>
      <div className="relative" style={{ width: 0, height: 0, top: '-8vh' }}>
        {Array.from({ length: 8 }, (_, k) => {
          const n = k + 1;
          const a = (k / 8) * Math.PI * 2 - Math.PI / 2;
          return (
            <Card
              key={n}
              n={n}
              lit={lit && DAY1_SEALS.includes(n)}
              style={{
                left: book ? -32 : `calc(${Math.cos(a).toFixed(3)} * ${R} - 32px)`,
                top: book ? -46 : `calc(${Math.sin(a).toFixed(3)} * ${R} - 46px)`,
                opacity: k < shown && !book ? 1 : 0,
                transform: book ? 'scale(0.2)' : 'scale(1)',
              }}
            />
          );
        })}
        {book && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/onboarding/s/book.jpg" alt="" className="absolute -left-[28vw] -top-[22vh] w-[56vw] max-w-[260px] animate-[fadeUp_0.8s_ease-out] rounded-3xl shadow-[0_0_60px_rgba(255,214,140,0.5)] [mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_72%)]" />
        )}
      </div>
      {(lit || book) && <span className="pb-safe absolute bottom-6 left-1/2 -translate-x-1/2 animate-pulse text-xs tracking-widest text-white/60">TAP</span>}
    </button>
  );
}

/** The riddle book: eight seals; known ones show their words (and the answer once solved). */
export function RiddleBook({ known, solved, fresh, onClose }: { known: number[]; solved: number[]; fresh?: number; onClose: () => void }) {
  const [reveal, setReveal] = useState(fresh === undefined);
  useEffect(() => {
    if (fresh === undefined) return;
    const t = setTimeout(() => setReveal(true), 1400);
    return () => clearTimeout(t);
  }, [fresh]);
  return (
    <button className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/80 px-5 backdrop-blur-sm" onClick={() => reveal && onClose()}>
      <p className="mb-4 text-sm tracking-[0.5em] text-amber-200/80">謎の書</p>
      <div className="grid w-full max-w-sm animate-[fadeUp_0.6s_ease-out] grid-cols-2 gap-3 rounded-3xl border border-amber-200/30 bg-[radial-gradient(ellipse_at_top,#3a2614_0%,#160d06_80%)] p-4 shadow-[0_0_60px_rgba(255,200,120,0.2)]">
        {Array.from({ length: 8 }, (_, k) => {
          const n = k + 1;
          const isFresh = n === fresh;
          const has = known.includes(n) && (!isFresh || reveal);
          const ans = solved.includes(n) && (!isFresh || reveal) ? SEALS[n]?.answer : undefined;
          return (
            <div
              key={n}
              className={`relative flex min-h-24 flex-col items-center justify-center rounded-2xl border px-2 py-3 text-center transition-all duration-1000 ${has ? 'border-amber-200/70 bg-amber-200/10' : 'border-amber-200/15 bg-black/30'} ${isFresh ? 'shadow-[0_0_30px_rgba(255,214,140,0.7)]' : ''}`}
            >
              <span className="absolute left-2 top-1.5 text-[10px] text-amber-200/60">札 {n}</span>
              {has ? <span className="text-sm leading-snug text-amber-50 [word-break:keep-all]">{SEALS[n]?.q}</span> : <span className="text-xs text-white/20">　</span>}
              {ans && <span className="mt-1 animate-[fadeUp_1s_ease-out] text-lg font-bold tracking-widest text-amber-200">{ans}</span>}
            </div>
          );
        })}
      </div>
      <p className="mt-4 max-w-xs text-center text-[11px] leading-relaxed text-white/50">残りの札は旅の中で文字が浮かび、答えは旅を進めると読めるようになります</p>
      <span className="pb-safe mt-4 text-xs tracking-widest text-white/50">{fresh === undefined ? 'とじる' : 'TAP'}</span>
    </button>
  );
}

/** The small book button (top left) once the riddle book is in your hands. */
export function BookButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="pt-safe absolute left-3 top-3 z-40">
      <IconButton icon="book" label="謎の書をひらく" onClick={onClick} />
    </div>
  );
}

// --- the space ticket ------------------------------------------------------------------------------
export const STAMPS = [
  { id: 'saturn', label: '土星', icon: '🪐' },
  { id: 'jupiter', label: '木星', icon: '🌳' },
  { id: 'mercury', label: '水星', icon: '🌊' },
  { id: 'mars', label: '火星', icon: '🎬' },
  // draft 21 (M-R124): Venus joins the first journey — its slot floats up at the end of Mars
  { id: 'venus', label: '金星', icon: '🎤' },
] as const;
export type StampId = (typeof STAMPS)[number]['id'];
/** The stamps you have by the journey day you are on (a planet's stamp is pressed at the end of its day). */
export function stampsOn(day: number): StampId[] {
  return STAMPS.filter((_, k) => day >= 4 + k).map((s) => s.id);
}

/**
 * The tour ticket (M-R18): the ticket picture with four star-shaped stamp slots — Saturn, Jupiter,
 * Mercury, Mars (+ Venus, draft 21). `fresh` stamps one now; `flip` turns to the back: the star map, the
 * four planets joined by a gold line running on to Venus, and Uranus, Neptune locked 『Obolo Orderのみ』.
 */
export function TicketCard({ stamps, fresh, flip, onDone }: { stamps: StampId[]; fresh?: StampId; flip?: boolean; onDone: () => void }) {
  const [pressed, setPressed] = useState(!fresh);
  const [back, setBack] = useState(false);
  useEffect(() => {
    const ts = [setTimeout(() => setPressed(true), 700)];
    if (flip) ts.push(setTimeout(() => setBack(true), 2200));
    return () => ts.forEach(clearTimeout);
  }, [flip]);
  const has = (id: StampId) => stamps.includes(id) || (id === fresh && pressed);
  return (
    <button className="absolute inset-0 z-[12]" onClick={onDone}>
      <TicketArt stamped={has} fresh={fresh} pressed={pressed} />
      <div className={`absolute inset-0 flex items-center justify-center bg-black/70 px-6 transition-opacity duration-1000 ${back ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        <div className="relative aspect-square w-[min(78vw,320px)]">
          {/* back: the star map */}
          <div className="absolute inset-0 rounded-2xl border border-amber-200/70 bg-[radial-gradient(ellipse_at_center,#1d1640_0%,#07060d_80%)] p-4">
            <svg viewBox="0 0 300 300" className="h-full w-full" aria-hidden>
              <polyline points="40,230 95,180 150,200 205,150" fill="none" stroke="#fcd34d" strokeWidth="2" />
              <line x1="205" y1="150" x2="235" y2="95" stroke="#fcd34d" strokeWidth="1.2" strokeDasharray="2 3" className="animate-pulse" />
              {[
                [40, 230, '土星'],
                [95, 180, '木星'],
                [150, 200, '水星'],
                [205, 150, '火星'],
              ].map(([x, y, t]) => (
                <g key={String(t)}>
                  <circle cx={Number(x)} cy={Number(y)} r="9" fill="#fcd34d" />
                  <text x={Number(x)} y={Number(y) + 24} textAnchor="middle" fontSize="11" fill="#fde68a">
                    {t}
                  </text>
                </g>
              ))}
              <g>
                <circle cx="235" cy="95" r="9" fill="none" stroke="#fcd34d" strokeWidth="1.5" className="animate-pulse" />
                <text x="235" y="119" textAnchor="middle" fontSize="11" fill="#fde68a">
                  金星
                </text>
              </g>
              {[
                [170, 70, '天王星'],
                [95, 95, '海王星'],
              ].map(([x, y, t]) => (
                <g key={String(t)} opacity=".75">
                  <circle cx={Number(x)} cy={Number(y)} r="9" fill="none" stroke="#a5b4fc" strokeDasharray="3 3" />
                  <text x={Number(x)} y={Number(y) + 4} textAnchor="middle" fontSize="10">
                    🔒
                  </text>
                  <text x={Number(x)} y={Number(y) + 24} textAnchor="middle" fontSize="11" fill="#c7d2fe">
                    {t}
                  </text>
                </g>
              ))}
              <text x="165" y="35" textAnchor="middle" fontSize="13" fill="#fde68a" letterSpacing="3">
                Obolo Orderのみ
              </text>
            </svg>
          </div>
        </div>
      </div>
      <span className="pb-safe absolute bottom-6 left-1/2 -translate-x-1/2 text-xs tracking-widest text-white/50">TAP</span>
    </button>
  );
}

// --- Bluena's square screen -------------------------------------------------------------------------
/** The square screen Bluena projects on a wall: MONBAN at the HQ gate (motion 9, looping, muted). */
export function BluenaScreen({ open }: { open: boolean }) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
    else {
      const t = setTimeout(() => setMounted(false), 500);
      return () => clearTimeout(t);
    }
  }, [open]);
  if (!mounted) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[calc(10svh+env(safe-area-inset-top))] z-[4] flex justify-center">
      <div
        className={`relative aspect-square w-[min(64vw,40svh)] overflow-hidden rounded-sm border border-sky-200/70 bg-black shadow-[0_0_50px_rgba(120,190,255,0.55)] transition-all duration-500 ${open ? 'scale-100 opacity-100' : 'scale-y-0 opacity-0'}`}
      >
        <video src={motionUrl('9-l')} poster="/onboarding/s/monban-screen.jpg" className="h-full w-full object-cover object-[50%_30%]" autoPlay loop muted playsInline />
        <span className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(150,210,255,0.08)_0px,rgba(150,210,255,0.08)_1px,transparent_1px,transparent_3px)]" />
        <span className="absolute inset-0 bg-sky-300/10 mix-blend-screen" />
      </div>
    </div>
  );
}

// --- Saturn: kororins --------------------------------------------------------------------------------
/** A kororin: a talking takoyaki, with a face picture when given. */
export function Takoyaki({ face, size, speaking = false, hue = 28 }: { face?: string | null; size: number; speaking?: boolean; hue?: number }) {
  return (
    <span className={`relative inline-block ${speaking ? 'animate-[wobble_0.6s_ease-in-out_infinite]' : ''}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
        <defs>
          <radialGradient id={`tk${hue}`} cx="38%" cy="32%" r="72%">
            <stop offset="0" stopColor={`hsl(${hue} 85% 72%)`} />
            <stop offset=".6" stopColor={`hsl(${hue} 70% 45%)`} />
            <stop offset="1" stopColor={`hsl(${hue - 8} 70% 28%)`} />
          </radialGradient>
        </defs>
        <ellipse cx="50" cy="95" rx="28" ry="4" fill="#000" opacity=".25" />
        <circle cx="50" cy="52" r="42" fill={`url(#tk${hue})`} />
        {/* sauce, mayo and aonori */}
        <path d="M14 42 Q30 20 50 22 Q72 20 86 42 Q78 34 66 38 Q56 30 46 36 Q34 30 24 40 Q18 38 14 42Z" fill="#4a230d" opacity=".9" />
        <path d="M22 36 l8 -6 l8 6 l8 -6 l8 6 l8 -6 l8 6 l8 -6" fill="none" stroke="#fff6d8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="34" cy="26" r="1.6" fill="#3f8a3a" />
        <circle cx="58" cy="24" r="1.4" fill="#3f8a3a" />
        <circle cx="70" cy="32" r="1.5" fill="#3f8a3a" />
        {!face && (
          <>
            <ellipse cx="38" cy="58" rx="4" ry="5.5" fill="#2a1406" />
            <ellipse cx="62" cy="58" rx="4" ry="5.5" fill="#2a1406" />
            <circle cx="39.5" cy="56" r="1.4" fill="#fff" />
            <circle cx="63.5" cy="56" r="1.4" fill="#fff" />
            {speaking ? <ellipse cx="50" cy="70" rx="5" ry="4" fill="#2a1406" /> : <path d="M44 68 q3 3 6 0 q3 3 6 0" fill="none" stroke="#2a1406" strokeWidth="2" strokeLinecap="round" />}
          </>
        )}
      </svg>
      {face && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={face} alt="" className="absolute rounded-full border-2 border-[#fff6d8]/80 object-cover" style={{ width: size * 0.5, height: size * 0.5, left: size * 0.25, top: size * 0.4 }} />
      )}
    </span>
  );
}

/** Picture effects over the background: the sky ring of kororins, KIMORIN⭐︎'s kororin. */
export function FxLayer({ fx }: { fx: PictureFx | null }) {
  if (!fx) return null;
  if (fx === 'kimorin-kororin')
    return (
      <div className="pointer-events-none absolute inset-x-0 top-[30svh] z-[3] flex animate-[fadeUp_0.5s_ease-out] justify-center">
        <span className="animate-[bob_2.4s_ease-in-out_infinite]">
          <Takoyaki face={spriteUrl('kimorin-face')} size={190} />
        </span>
      </div>
    );
  const N = 14;
  return (
    <div className="pointer-events-none absolute inset-0 z-[3] overflow-hidden" aria-hidden>
      {/* the ring: kororins orbiting on a tilted ellipse in the sky */}
      <div className="absolute left-1/2 top-[24svh] h-0 w-0">
        {Array.from({ length: N }, (_, k) => (
          <span key={k} className="absolute" style={{ animation: `kororinOrbit 22s linear infinite`, animationDelay: `${(-22 * k) / N}s` }}>
            <span className="block -translate-x-1/2 -translate-y-1/2">
              <Takoyaki size={34 + (k % 3) * 8} hue={18 + ((k * 13) % 30)} />
            </span>
          </span>
        ))}
      </div>
      {(fx === 'ring-drop' || fx === 'ring-star') && (
        <div className="absolute bottom-[34svh] left-1/2 -translate-x-1/2 animate-[kororinDrop_1.2s_cubic-bezier(.3,1.4,.6,1)]">
          <Takoyaki size={96} hue={24} speaking={fx === 'ring-drop'} />
          {fx === 'ring-star' && <span className="absolute -right-4 -top-5 animate-[fadeUp_0.4s_ease-out] text-4xl text-amber-300 drop-shadow-[0_0_14px_rgba(255,214,120,0.9)]">★</span>}
        </div>
      )}
    </div>
  );
}

// --- the day stops ------------------------------------------------------------------------------------
/** 「やめておく」: the day ends here; the next visit starts again from the same question. */
export function PauseScreen() {
  return (
    <div className="absolute inset-0 z-[70] flex animate-[fadeUp_1.2s_ease-out] flex-col items-center justify-center gap-4 bg-black px-8 text-center">
      <span className="h-3 w-3 rounded-full bg-amber-100 shadow-[0_0_40px_12px_rgba(255,214,140,0.45)]" />
      <p className="mt-4 text-lg tracking-[0.3em] text-amber-100">今日は、ここまで</p>
      <p className="text-sm leading-relaxed text-white/60">次に開くと、さっきの選択から続きます</p>
    </div>
  );
}

/**
 * SYS-S001: the day's space time passed 88 minutes. Bluena beeps, MONBAN on the square screen calls you
 * back to Earth, the screen closes, and the day's space time is over (tomorrow continues from here).
 */
export function TimeUpOverlay({ muted, onDone }: { muted: boolean; onDone: () => void }) {
  const [stage, setStage] = useState<'beep' | 'line' | 'closed'>('beep');
  useEffect(() => {
    playSfx('blip', muted);
    const t = setTimeout(() => setStage('line'), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="absolute inset-0 z-[80] bg-black/60">
      <BluenaScreen open={stage !== 'closed'} />
      {stage === 'line' && (
        <button className="absolute inset-0 flex items-end justify-center" onClick={() => setStage('closed')}>
          <Line who="MONBAN">……時間だ…。Bluenaが、停止する…。地球に、戻ってこい…。</Line>
        </button>
      )}
      {stage === 'closed' && (
        <button className="absolute inset-0 flex animate-[fadeUp_0.8s_ease-out] flex-col items-center justify-center gap-3 bg-black px-8 text-center" onClick={onDone}>
          <p className="text-lg tracking-[0.2em] text-amber-100">今日の宇宙の時間は終わりです</p>
          <p className="text-sm text-white/60">次の日は、この場面の続きから</p>
        </button>
      )}
    </div>
  );
}

function Line({ who, children }: { who: string; children: ReactNode }) {
  return (
    <div className="pb-safe w-full bg-gradient-to-t from-black via-black/80 to-transparent px-4 pt-16">
      <div className="relative mx-auto mb-6 min-h-28 w-full max-w-xl rounded-2xl border border-amber-200/35 bg-black/60 px-5 pb-6 pt-7 text-left backdrop-blur-md">
        <span className="absolute -top-3.5 left-5 rounded-full border border-amber-200/50 bg-black px-3 py-0.5 text-xs font-bold tracking-[0.25em] text-amber-200">{who}</span>
        <p className="whitespace-pre-wrap text-[17px] leading-relaxed">{children}</p>
      </div>
    </div>
  );
}
