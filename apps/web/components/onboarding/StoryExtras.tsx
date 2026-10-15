'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { motionUrl, spriteUrl } from '@/lib/onboarding/media';
import type { PictureFx, SoundFx } from '@/lib/onboarding/script';
import { playPreset } from '@/lib/story/sfx';
import { IconButton } from '@/components/story/parts';
import { useDictation } from '@/lib/useDictation';

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
export function playSfx(sound: SoundFx, muted: boolean, volume = 1) {
  if (muted || !ctx || volume <= 0) return;
  try {
    playPreset(ctx, sound, 0.45 * volume);
  } catch {
    /* ignore */
  }
}

// --- a text box with the mic first ----------------------------------------------------------------
/** Mic-first text input in the story's gold style: tap the mic and speak, or type. */
/**
 * Day 1 until Saturn: words are typed, no mic (story M-R41, 2026-10-15 — the voice comes out first on
 * Saturn). StoryPlayer provides false for those days.
 */
export const MicAllowed = createContext(true);

export function VoiceField({
  value,
  onChange,
  placeholder,
  maxLength = 20,
  multiline = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  maxLength?: number;
  multiline?: boolean;
}) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const mic = useDictation({ field: ref, value, onChange, maxLength });
  const withMic = useContext(MicAllowed);
  const cls = `min-w-0 flex-1 border-b bg-transparent px-2 py-2 text-amber-50 outline-none placeholder:text-white/35 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)] ${mic.listening ? 'border-rose-300' : 'border-amber-100/45 focus:border-amber-200/90'}`;
  return (
    <div>
      <div className="flex items-center gap-2">
        {multiline ? (
          <textarea ref={ref} className={`${cls} h-24 resize-none`} style={{ fontSize: 17 }} maxLength={maxLength} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input ref={ref} className={`${cls} text-center tracking-widest`} style={{ fontSize: 18 }} maxLength={maxLength} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
        )}
        {withMic && (
        <button
          type="button"
          onClick={mic.toggle}
          disabled={!mic.supported}
          aria-label={mic.listening ? '録音をとめる' : '話して入力'}
          className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-30 ${mic.listening ? 'border-rose-200 bg-rose-500/80' : 'border-amber-200/70 bg-black/60'}`}
        >
          {mic.listening && <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/40" />}
          <svg className="relative" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fde68a" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <rect x="8.5" y="3" width="7" height="12" rx="3.5" fill={mic.listening ? '#fff' : 'none'} />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </button>
        )}
      </div>
      <p className="mt-1 min-h-4 text-center text-[11px] text-amber-100/60">
        {!withMic ? '' : mic.listening ? mic.interim || 'きいています… 話しおわったら、もう一度タップ' : mic.error === 'denied' ? 'マイクを許可してください' : mic.supported ? '🎙 を押して話すか、文字で入力' : ''}
      </p>
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
        <VoiceField value={v} onChange={setV} placeholder="太陽をまわった回数" maxLength={8} />
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
export function NeoNameInput({ placeholder, submit, onSubmit }: { placeholder: string; submit: string; onSubmit: (name: string) => Promise<void> }) {
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    const n = v.trim();
    if (!n) return;
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
        <VoiceField value={v} onChange={setV} placeholder={placeholder} />
        <button className={gold} disabled={!v.trim() || busy} onClick={go}>
          {busy ? '……' : submit}
        </button>
        <p className="text-center text-xs text-white/50">名前は、あとでいつでも変えられます</p>
        {err && <p className="text-center text-sm text-rose-300">{err}</p>}
      </div>
    </div>
  );
}

// --- the riddle cards and the book -----------------------------------------------------------------
/** The eight seals of the riddle book. `answer` appears once the riddle is solved. */
export const SEALS: Record<number, { q: string; answer?: string }> = {
  1: { q: 'OBOLOとは', answer: 'OBOLOは、町の名前' },
  2: { q: 'OBOLO ORDERは全員……', answer: '表現者' },
  3: { q: '結社の目的とは' },
  6: { q: 'オボロンは……' },
  7: { q: 'コスモスは' },
  8: { q: '宝は' },
};
/** Cards whose words appear on Day 1. */
export const DAY1_SEALS = [1, 7, 8];
/** The words on the riddle cards by the journey day you are on (2 on Saturn, 3 on Jupiter, 6 on Mercury). */
export function knownSealsOn(day: number): number[] {
  return [...DAY1_SEALS, ...(day >= 4 ? [2] : []), ...(day >= 5 ? [3] : []), ...(day >= 6 ? [6] : [])];
}
/** Answers that are open (both at the Sun, on day 7 — so from ORDER on). */
export function solvedSealsOn(day: number): number[] {
  return day >= 8 ? [1, 2] : [];
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
] as const;
export type StampId = (typeof STAMPS)[number]['id'];
/** The stamps you have by the journey day you are on (a planet's stamp is pressed at the end of its day). */
export function stampsOn(day: number): StampId[] {
  return STAMPS.filter((_, k) => day >= 4 + k).map((s) => s.id);
}

/**
 * The tour ticket (M-R18): a long golden ticket with four star-shaped stamp slots — Saturn, Jupiter,
 * Mercury, Mars. `fresh` stamps one now; `flip` turns it over: the star map, the four planets joined
 * by a gold line, and Venus, Uranus, Neptune locked 『ORDERのみ』. Tap to continue.
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
    <button className="absolute inset-0 z-[12] flex flex-col items-center justify-center bg-black/70 px-6" onClick={onDone}>
      <div className="relative w-[min(78vw,320px)] animate-[fadeUp_0.6s_ease-out] [perspective:900px]">
        <div className={`relative transition-transform duration-1000 [transform-style:preserve-3d] ${back ? '[transform:rotateY(180deg)]' : ''}`}>
          {/* front */}
          <div className="rounded-2xl border border-amber-200/70 bg-gradient-to-b from-[#3a2a10] to-[#120c04] p-4 shadow-[0_0_50px_rgba(255,200,110,0.35)] [backface-visibility:hidden]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/onboarding/s/ticket.jpg" alt="" className="mx-auto h-40 w-auto rounded-xl object-cover" />
            <p className="mt-2 text-center text-xs tracking-[0.5em] text-amber-200/80">宇宙行きの切符</p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {STAMPS.map((s) => (
                <div key={s.id} className="flex flex-col items-center gap-1">
                  <span
                    className={`flex h-12 w-12 items-center justify-center text-2xl transition-all duration-500 [clip-path:polygon(50%_0,61%_35%,98%_35%,68%_57%,79%_91%,50%_70%,21%_91%,32%_57%,2%_35%,39%_35%)] ${has(s.id) ? 'scale-100 bg-amber-300' : 'bg-amber-100/15'} ${s.id === fresh && pressed ? 'animate-[fadeUp_0.5s_ease-out]' : ''}`}
                  >
                    {has(s.id) ? s.icon : ''}
                  </span>
                  <span className="text-[10px] text-amber-100/70">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
          {/* back: the star map */}
          <div className="absolute inset-0 rounded-2xl border border-amber-200/70 bg-[radial-gradient(ellipse_at_center,#1d1640_0%,#07060d_80%)] p-4 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <svg viewBox="0 0 300 300" className="h-full w-full" aria-hidden>
              <polyline points="40,230 95,180 150,200 205,150" fill="none" stroke="#fcd34d" strokeWidth="2" />
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
              {[
                [235, 95, '金星'],
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
                ORDERのみ
              </text>
            </svg>
          </div>
        </div>
      </div>
      <span className="pb-safe absolute bottom-6 text-xs tracking-widest text-white/50">TAP</span>
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
        <video src={motionUrl(9)} poster="/onboarding/s/monban-screen.jpg" className="h-full w-full object-cover object-[50%_30%]" autoPlay loop muted playsInline />
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
