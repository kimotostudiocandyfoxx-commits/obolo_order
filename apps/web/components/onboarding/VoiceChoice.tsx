'use client';

import { useEffect, useRef, useState } from 'react';
import { ReplyChips } from '@/components/story/Chat';
import { micAdvice, RECORD_NOTICE_POLITE, recordNoticeOnce } from '@/lib/mic/core';
import { currentEngine, currentEnv } from '@/lib/mic/env';
import { hear, type HearPhase, type Hearing } from '@/lib/mic/hear';
import { LineIcon } from '@/components/LineIcon';
import { useVoiceEdit, VoiceText } from '@/components/mic/VoiceText';
import { insertAt } from '@/lib/mic/edit';

/**
 * A choice answered by voice (D01-S006, story M-R169): a big mic button 〔話してみよう〕 with the answers as a small
 * example; the corner ⌨ (for when one cannot speak) shows them as buttons. A tap listens at once — the phone asks for
 * the mic itself (client 2026-10-29: the 「声は残しません…［いいよ］［やめる］」 step is gone). What is heard shows as said
 * (client 2026-11-22) and is only matched to the nearest answer to choose the way on (the browser's own speech recognition; nothing is sent or kept). A miss stays on the mic with a
 * word of why (it used to drop to the buttons, which looked like the old choice coming back); only a mic that cannot
 * be used goes to the buttons, saying so.
 *
 * Client 2026-11-27: the heard words can be fixed here too (components/mic/VoiceText.tsx). They show for a moment and
 * the story goes on by itself, as before; a tap on them stops that — a caret stands in the sentence, 〔けす〕 takes a
 * character, the mic puts new words at the caret, and 〔これで答える〕 goes on with the sentence as it now is.
 */
/** the heard words stay this long before the story goes on (a tap on them holds it) */
export const VOICE_ANSWER_HOLD_MS = 1600;
/** PROVISIONAL wording: goes on with the fixed sentence */
export const VOICE_ANSWER_GO = 'これで答える';
export const VOICE_OK_KEY = 'obolo.voiceOk';
const SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

/** heard words → the answer they mean: a "not" wins over a "yes", unsure over nothing */
export function matchAnswer(heard: string, options: string[]): number {
  const h = heard.replace(/\s/g, '');
  const exact = options.findIndex((o) => h.includes(o));
  if (exact >= 0 && !options.some((o, k) => k !== exact && o.includes(options[exact]) && h.includes(o))) return exact;
  // 「秘密結社は、初めてか？」〔1回目〕〔2回目〕〔3回目以上〕 (client 2026-10-29): counts said any way
  if (options.length === 3 && options.every((o) => o.includes('回目'))) {
    if (/[3-9３-９]|三|四|五|六|七|八|九|十|さん|よん|何回|なんかい|何度|たくさん|いっぱい|以上|いじょう/.test(h)) return 2;
    if (/[2２]|二|にかい|にど|二度|いいえ|ちがう|違う|初めてじゃない|はじめてじゃない/.test(h)) return 1;
    return 0;
  }
  const neg = /たくない|いかない|行かない|いや|嫌|むり|無理|やだ/.test(h);
  const unsure = /わかん|わから|分から|まだ|どう|かな|迷/.test(h);
  const yes = /行き|いき|いく|行く|たい|うん|はい|もちろん|ぜひ/.test(h);
  const find = (re: RegExp) => options.findIndex((o) => re.test(o));
  if (neg) return Math.max(0, find(/たくない|ない$/));
  if (unsure) return Math.max(0, find(/わかん|まだ/));
  if (yes) return Math.max(0, find(/^行きたい$|たい$/));
  return Math.max(0, find(/わかん|まだ/));
}

export function VoiceChoice({ options, onPick }: { options: string[]; onPick: (k: number, words?: string) => void }) {
  const [mode, setMode] = useState<'mic' | 'listen' | 'keys'>('mic');
  const [heard, setHeard] = useState('');
  const heardRef = useRef('');
  heardRef.current = heard;
  const [note, setNote] = useState('');
  const [recordNote, setRecordNote] = useState(false);
  const [phase, setPhase] = useState<HearPhase | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const take = useRef<Hearing | null>(null);
  const done = useRef(false);
  // client 2026-11-27: the heard words being fixed (a tap on them): the story waits for 〔これで答える〕
  const [fixing, setFixing] = useState(false);
  const fixingRef = useRef(false);
  const edit = useVoiceEdit(heard, setHeard);
  const going = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answer = (words: string) => {
    if (done.current || !words.trim()) return;
    done.current = true;
    if (going.current) clearTimeout(going.current);
    onPick(matchAnswer(words, options), words.trim().slice(0, 120));
  };
  const hold = () => {
    if (done.current) return;
    if (going.current) clearTimeout(going.current);
    going.current = null;
    fixingRef.current = true;
    setFixing(true);
  };
  // no way to hear on this browser: the mic stays, with the reason in one line; ⌨ in the corner is the way on
  // (story chat 2026-10-29: never switch to the buttons by itself)
  useEffect(() => {
    if (!currentEngine()) setNote(micAdvice('unsupported', currentEnv()).text);
    return () => {
      take.current?.abort();
      if (going.current) clearTimeout(going.current);
    };
  }, []);

  // ends the take now (the tap, a quiet after words, the 9 s cap); set by listen()
  const stopNow = useRef<() => void>(() => undefined);
  // client 2026-11-27: the hearing is lib/mic/hear.ts — the browser's recogniser where it works, else the recorder and
  // the server's words (iPhone Chrome, in-app browsers: the mic used to be dead here)
  const listen = () => {
    if (take.current || done.current) return;
    // fixing: the new words go in at the caret (in place of a selected stretch), into the sentence as it is
    const base = fixingRef.current ? heardRef.current : '';
    const at = fixingRef.current ? edit.get() : null;
    const whole = (words: string) => (fixingRef.current ? insertAt(base, at, words) : { text: words, sel: null });
    let said = '';
    let ended = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let quiet: ReturnType<typeof setTimeout> | undefined;
    const stop = () => take.current?.stop();
    const soon = (ms: number) => {
      clearTimeout(quiet);
      quiet = setTimeout(stop, ms);
      timers.push(quiet);
    };
    if (!fixingRef.current) setHeard('');
    setNote('');
    setLevel(null);
    setPhase('opening');
    setMode('listen');
    const h = hear({
      path: 'story',
      // a short answer: the recorder gives up sooner than in a talk
      maxMs: 12000,
      onPhase: setPhase,
      onLevel: setLevel,
      onInterim: (t) => {
        if (!t) return;
        setHeard(whole(said + t).text);
        // iOS ends a one-shot recognition almost at once: listen on and stop ourselves after a short quiet
        soon(1400);
      },
      onFinal: (t) => {
        said += t;
        const w = whole(said);
        setHeard(w.text);
        if (w.sel) edit.setSel(w.sel);
        soon(400);
      },
      onEnd: (r) => {
        ended = true;
        take.current = null;
        timers.forEach(clearTimeout);
        setPhase(null);
        setLevel(null);
        setMode('mic');
        if (fixingRef.current) {
          // fixing: the sentence stays for 〔これで答える〕 (nothing heard this time: one line of why)
          if (!said.trim()) setNote(micAdvice(r.fault ?? 'empty', currentEnv()).text);
          return;
        }
        if (said.trim() && !done.current) {
          // shown as said for a moment, then the story goes on — unless the words are tapped to be fixed
          const words = said;
          going.current = setTimeout(() => answer(heardRef.current || words), VOICE_ANSWER_HOLD_MS);
          return;
        }
        setNote(micAdvice(r.fault ?? 'empty', currentEnv()).text);
      },
    });
    if (ended) return;
    take.current = h;
    stopNow.current = stop;
    // the recogniser never ends by itself while nothing is said: the cap (the recorder has its own quiet stop)
    if (h.engine() === 'speech') timers.push(setTimeout(stop, 9000));
    // story chat 2026-11-27: the first take sent to the server says, once, that the voice is not kept
    setRecordNote(h.engine() === 'record' && recordNoticeOnce());
  };

  if (mode === 'keys') return <ReplyChips options={options} onPick={onPick} />;
  const on = mode === 'listen';
  // the heard words, to be tapped and fixed (while listening for a first answer the line says what the mic does)
  const words = !!heard && (!on || fixing);
  const lineClass = 'mb-4 min-h-[2rem] rounded-2xl border border-amber-200/15 bg-black/55 px-4 py-1.5 text-center text-[12px] tracking-[0.08em] text-amber-50/85 backdrop-blur';
  return (
    <div className="voice-magic pb-safe absolute inset-x-0 bottom-0 z-20 flex flex-col items-center px-5 pb-8">
      {words ? (
        <VoiceText testId="voice-choice-line" value={heard} edit={edit} locked={on} hint={false} onTouch={hold} className={`${lineClass} ${fixing ? '!mb-2' : ''}`} toolClass="mb-3" />
      ) : (
        <p data-testid="voice-choice-line" className={lineClass} style={{ fontFamily: SERIF }}>
          {on && recordNote && !heard && phase !== 'thinking' ? RECORD_NOTICE_POLITE : on ? heard || (phase === 'thinking' ? '文字にしています……' : phase === 'hearing' ? '聞こえています……' : '聞いています……') : note || `例：${options.join('・')}`}
        </p>
      )}
      {fixing && !on && note && <div className="mb-2 text-center text-[11px] text-amber-100/80" style={{ fontFamily: SERIF }}>{note}</div>}
      <button onClick={on ? () => stopNow.current() : listen} className="relative flex h-24 w-24 items-center justify-center rounded-full active:scale-95" aria-label="話してみよう">
        {/* rings of light going out while it listens; a slow breath while it waits */}
        {on ? (
          [0, 0.6, 1.2].map((d) => <span key={d} className="absolute inset-0 rounded-full border border-amber-200/70" style={{ animation: `micRing 1.8s ${d}s ease-out infinite` }} />)
        ) : (
          <span className="absolute -inset-2 rounded-full bg-[radial-gradient(circle,rgba(255,206,120,0.28),transparent_70%)]" style={{ animation: 'micBreath 2.6s ease-in-out infinite' }} />
        )}
        <span className={`absolute inset-0 rounded-full border transition-colors duration-300 ${on ? 'border-amber-100 bg-[radial-gradient(circle_at_50%_35%,rgba(255,214,140,0.35),rgba(40,26,8,0.92)_70%)] shadow-[0_0_34px_rgba(255,204,120,0.65)]' : 'border-amber-200/70 bg-[radial-gradient(circle_at_50%_30%,rgba(70,48,18,0.95),rgba(8,6,12,0.95)_72%)] shadow-[0_0_22px_rgba(255,204,120,0.3)]'}`} />
        {on && level !== null && <span aria-hidden data-testid="mic-ring" className="absolute inset-0 rounded-full bg-amber-200/20" style={{ transform: `scale(${(1.05 + Math.min(1, level * 1.5) * 0.6).toFixed(3)})`, transition: 'transform 90ms linear' }} />}
        <span className="absolute inset-[7px] rounded-full border border-amber-200/25" />
        <svg viewBox="0 0 24 24" className={`relative h-9 w-9 transition-colors ${on ? 'text-amber-50' : 'text-amber-200'}`} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="9" y="3" width="6" height="11" rx="3" fill={on ? 'currentColor' : 'none'} />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
          <path d="M12 17.5V21M9 21h6" />
        </svg>
      </button>
      <p className="mt-3 text-[12px] tracking-[0.4em] text-amber-100/90" style={{ fontFamily: SERIF }}>
        {on ? '話してください' : '話してみよう'}
      </p>
      {fixing && !on && (
        <button onClick={() => answer(heard)} disabled={!heard.trim()} data-testid="voice-choice-go" className="mt-3 rounded-full border border-amber-200/80 bg-gradient-to-b from-amber-200/25 to-amber-500/10 px-7 py-2.5 text-[14px] tracking-[0.2em] text-amber-50 shadow-[0_0_24px_rgba(255,210,130,0.25)] disabled:opacity-40" style={{ fontFamily: SERIF }}>
          {VOICE_ANSWER_GO}
        </button>
      )}
      <button onClick={() => setMode('keys')} className="absolute bottom-[calc(12px+env(safe-area-inset-bottom))] right-4 rounded-lg bg-white/10 px-2 py-1 text-[16px] text-white/60" aria-label="文字で答える">
        <LineIcon id="keyboard" className="h-5 w-5" />
      </button>
    </div>
  );
}
