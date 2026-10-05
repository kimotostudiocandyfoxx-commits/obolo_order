'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { hasMotion, motionUrl, spriteUrl, stillUrl, type MotionId } from '@/lib/onboarding/media';
import { Bgm } from '@/lib/onboarding/bgm';
import { DualVideo } from '@/lib/onboarding/dualVideo';
import { neoForm } from '@obolo/shared';
import { NeoChooser } from './NeoChooser';
import { JupiterTutorial } from '@/components/jupiter/JupiterTutorial';
import { MarsTutorial } from '@/components/mars/MarsTutorial';
import { MercuryTutorial } from '@/components/mercury/MercuryTutorial';
import { SaturnTutorial } from '@/components/saturn/SaturnTutorial';
import { bgmAt, fill, labelIndex, mediaAt, type Step, type StoryVars, type TimedCaption } from '@/lib/onboarding/script';

/**
 * Full-screen story player used by the invite-only onboarding.
 *  - Motion videos cannot be skipped (no controls, taps ignored while they play).
 *  - Dialogue stops at each line; a tap reveals the full line, the next tap continues.
 *  - Two stacked <video> elements are used as a double buffer (DualVideo): no black flashes between
 *    motions or at loop seams, and no stale frame. Both are unlocked by the first tap (iOS).
 *  - Progress is saved after every step so a reload resumes where the visitor was.
 */
export interface StoryProgress {
  i: number;
  name: string;
  answers: Record<string, string>;
}

interface Props {
  steps: Step[];
  vars: StoryVars;
  initial: StoryProgress | null;
  onProgress: (p: StoryProgress) => void;
  /** Called by the name step. Resolve to continue, reject with a message to stay. */
  onName: (name: string) => Promise<void>;
  /** Called by the 'neo' step with the chosen OBOLO NEO form id. */
  onNeo?: (id: string) => Promise<void>;
  onEnd: (answers: Record<string, string>) => void;
}

const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

export function StoryPlayer({ steps, vars, initial, onProgress, onName, onNeo, onEnd }: Props) {
  const videoA = useRef<HTMLVideoElement>(null);
  const videoB = useRef<HTMLVideoElement>(null);
  const dual = useRef<DualVideo | null>(null);
  const [started, setStarted] = useState(false);
  const [i, setIState] = useState(initial?.i ?? 0);
  const iRef = useRef(i);
  const [name, setName] = useState(initial?.name ?? '');
  const [answers, setAnswers] = useState<Record<string, string>>(initial?.answers ?? {});
  const stateRef = useRef({ name, answers });
  stateRef.current = { name, answers };

  const [backdrop, setBackdrop] = useState<string | null>(null);
  /** False until the first motion frame is on screen: the start light stays up instead of black. */
  const [ready, setReady] = useState(false);
  /** 'black' step: the screen stays black until the next motion has a frame on screen. */
  const [blackout, setBlackout] = useState(false);
  /** Character image standing in front of the motion ('sprite' steps). */
  const [sprite, setSprite] = useState<string | string[] | null>(null);
  /** Still background image ('still' steps), removed once the next motion is on screen. */
  const [still, setStill] = useState<string | null>(null);
  const clearStillOnShow = useRef(false);
  const [placeholder, setPlaceholder] = useState<MotionId | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [muted, setMuted] = useState(false);
  const placeholderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Motions still to play behind the dialogue after the current background motion (bgvideo.then). */
  const bgQueue = useRef<MotionId[]>([]);
  /** Timed captions of the motion that is starting (shown once its first frame is on screen). */
  const pendingCaptions = useRef<TimedCaption[]>([]);
  const captionTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [overlayCaption, setOverlayCaption] = useState<string | null>(null);
  const clearCaptions = useCallback(() => {
    captionTimers.current.forEach(clearTimeout);
    captionTimers.current = [];
    setOverlayCaption(null);
  }, []);
  const bgm = useRef<Bgm | null>(null);
  bgm.current ??= new Bgm();

  const step = steps[i];
  const v: StoryVars = { ...vars, name: name || vars.name, neo: neoForm(answers.neo)?.name ?? vars.neo };

  const setI = useCallback(
    (n: number) => {
      iRef.current = n;
      setIState(n);
      onProgress({ i: n, ...stateRef.current });
    },
    [onProgress],
  );

  /** Show a motion. freeze = jump to its last frame without playing (used when resuming). */
  const playMedia = useCallback((motion: MotionId, loop: boolean, freeze = false) => {
    const d = dual.current;
    if (!d) return;
    if (placeholderTimer.current) clearTimeout(placeholderTimer.current);
    if (!hasMotion(motion)) {
      d.pauseAll();
      setPlaceholder(motion);
      // the placeholder stands in for the motion, so it replaces the still / black screen too
      setBlackout(false);
      if (clearStillOnShow.current) {
        clearStillOnShow.current = false;
        setStill(null);
      }
      if (!loop && !freeze) placeholderTimer.current = setTimeout(() => onEndedRef.current(), 2600);
      return;
    }
    setPlaceholder(null);
    d.show(motionUrl(motion), loop, freeze);
  }, []);

  /** Advance from step `from`, running non-interactive steps until something needs the visitor. */
  const run = useCallback(
    (from: number) => {
      let n = from;
      for (let guard = 0; guard < 500; guard++) {
        const s = steps[n];
        if (!s) return;
        if (s.t === 'label') n++;
        else if (s.t === 'bgm') {
          bgm.current?.set(s.track);
          n++;
        }
        else if (s.t === 'goto') n = labelIndex(steps, s.id);
        else if (s.t === 'still') {
          setStill(s.image);
          n++;
        } else if (s.t === 'sprite') {
          setSprite(s.image);
          n++;
        } else if (s.t === 'black') {
          bgQueue.current = [];
          setBlackout(true);
          dual.current?.pauseAll();
          n++;
        } else if (s.t === 'loop') {
          clearStillOnShow.current = true;
          bgQueue.current = [];
          playMedia(s.motion, true);
          n++;
        } else if (s.t === 'bgvideo') {
          clearStillOnShow.current = true;
          bgQueue.current = [...(s.then ?? [])];
          playMedia(s.motion, false);
          n++;
        } else if (s.t === 'video') {
          clearStillOnShow.current = true;
          bgQueue.current = [];
          setSprite(null);
          clearCaptions();
          pendingCaptions.current = s.captions ?? [];
          playMedia(s.motion, false);
          setI(n);
          return;
        } else {
          setI(n);
          if (s.t === 'end') {
            bgm.current?.fadeOut();
            onEnd(stateRef.current.answers);
          }
          return;
        }
      }
    },
    [steps, playMedia, setI, onEnd, clearCaptions],
  );

  const onEndedRef = useRef(() => {});
  onEndedRef.current = () => {
    const s = steps[iRef.current];
    if (s?.t === 'video') {
      clearCaptions();
      run(iRef.current + 1);
    }
    else {
      // a background motion finished while the visitor reads: play the next one in its chain
      const next = bgQueue.current.shift();
      if (next !== undefined) playMedia(next, false);
    }
  };

  useEffect(() => {
    if (!videoA.current || !videoB.current) return;
    const d = new DualVideo([videoA.current, videoB.current], {
      onEnded: () => onEndedRef.current(),
      onBlocked: () => setBlocked(true),
      onShown: (url) => {
        setBlocked(false);
        setReady(true);
        setBlackout(false);
        if (clearStillOnShow.current) {
          clearStillOnShow.current = false;
          setStill(null);
        }
        // schedule the starting motion's timed captions from its first visible frame
        const caps = pendingCaptions.current;
        pendingCaptions.current = [];
        for (const c of caps) {
          captionTimers.current.push(setTimeout(() => setOverlayCaption(c.text), c.from * 1000));
          if (c.to !== undefined) captionTimers.current.push(setTimeout(() => setOverlayCaption(null), c.to * 1000));
        }
        setBackdrop(url.replace(/\.mp4$/, '.jpg'));
      },
    });
    dual.current = d;
    return () => d.dispose();
  }, []);

  useEffect(
    () => () => {
      if (placeholderTimer.current) clearTimeout(placeholderTimer.current);
      captionTimers.current.forEach(clearTimeout);
      bgm.current?.dispose();
    },
    [],
  );

  useEffect(() => {
    bgm.current?.setMuted(muted);
    dual.current?.setMuted(muted);
  }, [muted]);

  /** First tap: unlocks audio/video on iOS and starts (or resumes) the story inside the gesture. */
  const start = () => {
    setStarted(true);
    // Start the music inside the gesture (fresh start: the first track; resume: the track at that point).
    const firstBgm = steps.find((s) => s.t === 'bgm');
    bgm.current?.unlock(i === 0 ? (firstBgm?.t === 'bgm' ? firstBgm.track : null) : bgmAt(steps, i));
    const firstMedia = mediaAt(steps, Math.max(i, steps.findIndex((s) => s.t === 'video')));
    if (firstMedia && hasMotion(firstMedia.motion)) dual.current?.unlock(motionUrl(firstMedia.motion));
    const cur = steps[i];
    if (i === 0 || ['video', 'bgvideo', 'black', 'bgm', 'loop', 'label', 'goto'].includes(cur.t)) {
      run(i);
      return;
    }
    for (let k = i - 1; k >= 0; k--) {
      const s = steps[k];
      if (s.t === 'video' || s.t === 'loop') break;
      if (s.t === 'still') {
        setStill(s.image);
        setReady(true);
        break;
      }
    }
    for (let k = i - 1; k >= 0; k--) {
      const s = steps[k];
      if (s.t === 'sprite') {
        setSprite(s.image);
        break;
      }
      if (s.t === 'video') break;
    }
    const m = mediaAt(steps, i);
    if (m) playMedia(m.motion, m.loop, !m.loop);
    else {
      setBlackout(true);
      setReady(true);
    }
  };

  const next = () => run(iRef.current + 1);

  const choose = (key: string, label: string, goto?: string) => {
    const a = { ...stateRef.current.answers, [key]: label };
    stateRef.current = { ...stateRef.current, answers: a };
    setAnswers(a);
    run(goto ? labelIndex(steps, goto) : iRef.current + 1);
  };

  const interactiveTap = step && (step.t === 'caption' || step.t === 'say' || step.t === 'letter');
  // Keep the question visible while the visitor answers it (e.g. "お前の名前は？" above the name field).
  const prev = steps[i - 1];
  const prompt = step && (step.t === 'choice' || step.t === 'name' || step.t === 'action') && prev?.t === 'say' ? prev : null;

  return (
    <div className="fixed inset-0 z-[100] select-none overflow-hidden bg-black text-white" style={{ fontFamily: SERIF }}>
      {/* blurred backdrop so 9:16 motions fill wider screens (iPad) without cropping */}
      {backdrop && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={backdrop} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" aria-hidden />
      )}
      {/* double-buffered motion videos (see DualVideo) */}
      <div className="absolute inset-0 z-0">
        {[videoA, videoB].map((ref, k) => (
          <video
            key={k}
            ref={ref}
            className="absolute inset-0 h-full w-full object-contain"
            playsInline
            preload="auto"
            muted={muted}
            disablePictureInPicture
            controls={false}
            onContextMenu={(e) => e.preventDefault()}
          />
        ))}
      </div>
      {placeholder !== null && <MotionPlaceholder motion={placeholder} />}
      {blackout && <div className="pointer-events-none absolute inset-0 z-[4] bg-black" aria-hidden />}
      {still && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={stillUrl(still)} alt="" className="pointer-events-none absolute inset-0 z-[2] h-full w-full animate-[fadeUp_0.6s_ease-out] object-cover" aria-hidden />
      )}
      {sprite &&
        (Array.isArray(sprite) ? sprite : [sprite]).map((name, k, arr) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={name}
            src={spriteUrl(name)}
            alt=""
            className="pointer-events-none absolute bottom-[24%] z-[3] h-[50%] -translate-x-1/2 animate-[spriteIn_0.45s_ease-out] object-contain drop-shadow-[0_18px_40px_rgba(0,0,0,0.55)]"
            style={spriteSlot(k, arr.length)}
            aria-hidden
          />
        ))}
      {overlayCaption && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(18vh+env(safe-area-inset-bottom))] z-[6] flex animate-[fadeUp_0.8s_ease-out] justify-center">
          <div className="flex items-center gap-3 rounded-full bg-black/55 px-6 py-3 text-lg tracking-[0.2em] text-amber-100 backdrop-blur-sm">
            <span className="h-px w-6 bg-amber-200/60" />
            {fill(overlayCaption, v)}
            <span className="h-px w-6 bg-amber-200/60" />
          </div>
        </div>
      )}

      {started && (
        <div
          className={`pointer-events-none absolute inset-0 z-[5] flex items-center justify-center bg-black transition-opacity duration-700 ${ready || placeholder !== null ? 'opacity-0' : 'opacity-100'}`}
          aria-hidden
        >
          <span className="h-3 w-3 animate-pulse rounded-full bg-amber-100 shadow-[0_0_40px_12px_rgba(255,214,140,0.7)]" />
        </div>
      )}

      {/* tap layer for dialogue */}
      {started && interactiveTap && <TapLine key={i} step={step} vars={v} onNext={next} />}

      {started && prompt && (
        <div className="pointer-events-none absolute inset-x-0 z-10 px-4" style={{ bottom: `calc(${step?.t === 'choice' ? step.options.length * 64 + 40 : step?.t === 'name' ? 200 : 150}px + env(safe-area-inset-bottom))` }}>
          <div className="relative mx-auto w-full max-w-xl rounded-2xl border border-amber-200/35 bg-black/60 px-5 pb-5 pt-7 backdrop-blur-md">
            <span className="absolute -top-3.5 left-5 rounded-full border border-amber-200/50 bg-black px-3 py-0.5 text-xs font-bold tracking-[0.25em] text-amber-200">
              {prompt.who}
            </span>
            <p className="whitespace-pre-wrap text-[17px] leading-relaxed">{fill(prompt.text, v)}</p>
          </div>
        </div>
      )}
      {started && step?.t === 'action' && (
        <Buttons>
          <GoldButton onClick={next}>{step.label}</GoldButton>
        </Buttons>
      )}
      {started && step?.t === 'choice' && (
        <Buttons>
          {step.options.map((o) => (
            <GoldButton key={o.label} onClick={() => choose(step.key, o.label, o.goto)}>
              {o.label}
            </GoldButton>
          ))}
        </Buttons>
      )}
      {started && step?.t === 'saturn' && <SaturnTutorial onDone={next} />}
      {started && step?.t === 'jupiter' && <JupiterTutorial onDone={next} />}
      {started && step?.t === 'mercury' && <MercuryTutorial onDone={next} />}
      {started && step?.t === 'mars' && <MarsTutorial onDone={next} />}
      {started && step?.t === 'neo' && (
        <NeoChooser
          onChoose={async (id) => {
            await onNeo?.(id);
            choose('neo', id);
          }}
        />
      )}
      {started && step?.t === 'name' && (
        <NameInput
          placeholder={step.placeholder}
          submit={step.submit}
          initial={name}
          onSubmit={async (n) => {
            await onName(n);
            stateRef.current = { ...stateRef.current, name: n };
            setName(n);
            run(iRef.current + 1);
          }}
        />
      )}

      {!started && (
        <button className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black" onClick={start}>
          <span className="relative flex h-24 w-24 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-amber-200/20" />
            <span className="h-3 w-3 rounded-full bg-amber-100 shadow-[0_0_40px_12px_rgba(255,214,140,0.7)]" />
          </span>
          <span className="text-lg tracking-[0.3em] text-amber-100">{i === 0 ? '信号を受信する' : '続きから'}</span>
          <span className="text-xs tracking-widest text-white/40">TAP · 🔊 音を出してお楽しみください</span>
        </button>
      )}

      {started && blocked && (
        <button
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/50"
          onClick={() => {
            setBlocked(false);
            // A motion that cannot load must never trap the visitor: skip it.
            if (!dual.current?.retry()) onEndedRef.current();
          }}
        >
          <span className="rounded-full border border-amber-200/60 px-6 py-3 text-amber-100">▶ タップして続ける</span>
        </button>
      )}

      {started && (
        <button
          className="pt-safe absolute right-3 top-3 z-40 rounded-full bg-black/40 px-3 py-1.5 text-sm text-white/70"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'unmute' : 'mute'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      )}
    </div>
  );
}

function TapLine({ step, vars, onNext }: { step: Step; vars: StoryVars; onNext: () => void }) {
  const text = step.t === 'caption' || step.t === 'say' || step.t === 'letter' ? fill(step.text, vars) : '';
  const chars = [...text];
  const [shown, setShown] = useState(step.t === 'letter' ? chars.length : 0);
  const done = shown >= chars.length;

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setShown((n) => n + 1), chars[shown] === '\n' ? 120 : 55);
    return () => clearTimeout(t);
  }, [shown, done, chars]);

  const tap = () => (done ? onNext() : setShown(chars.length));
  const visible = chars.slice(0, shown).join('');

  if (step.t === 'letter') {
    return (
      <button className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 px-8" onClick={tap}>
        <div
          className="w-full max-w-sm -rotate-1 animate-[letterIn_0.8s_ease-out] whitespace-pre-wrap rounded-sm bg-[#f3e8d2] px-7 py-10 text-left text-lg leading-loose [word-break:keep-all] text-[#3b2a17] shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 10%, rgba(255,255,255,0.6), transparent 50%)' }}
        >
          {text}
        </div>
        <Cue />
      </button>
    );
  }

  if (step.t === 'caption') {
    return (
      <button className="absolute inset-0 z-10 flex items-end justify-center pb-[calc(18vh+env(safe-area-inset-bottom))]" onClick={tap}>
        <div className="flex items-center gap-3 rounded-full bg-black/55 px-6 py-3 text-lg tracking-[0.2em] text-amber-100 backdrop-blur-sm">
          <span className="h-px w-6 bg-amber-200/60" />
          {visible}
          <span className="h-px w-6 bg-amber-200/60" />
        </div>
        {done && <Cue />}
      </button>
    );
  }

  const who = step.t === 'say' ? step.who : '';
  return (
    <button className="absolute inset-0 z-10 flex items-end justify-center" onClick={tap}>
      <div className="pb-safe w-full bg-gradient-to-t from-black via-black/80 to-transparent px-4 pt-16">
        <div className="relative mx-auto mb-6 min-h-36 w-full max-w-xl rounded-2xl border border-amber-200/35 bg-black/60 px-5 pb-6 pt-7 text-left backdrop-blur-md">
          <span className="absolute -top-3.5 left-5 rounded-full border border-amber-200/50 bg-black px-3 py-0.5 text-xs font-bold tracking-[0.25em] text-amber-200">
            {who}
          </span>
          <p className="whitespace-pre-wrap text-[17px] leading-relaxed">{visible}</p>
          {done && <span className="absolute bottom-2 right-4 animate-bounce text-amber-200/80">▼</span>}
        </div>
      </div>
    </button>
  );
}

function Cue() {
  return <span className="pb-safe absolute bottom-6 left-1/2 -translate-x-1/2 animate-pulse text-xs tracking-widest text-white/50">TAP</span>;
}

function Buttons({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-safe absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-6 pt-10">
      <div className="mx-auto mb-5 flex max-w-sm animate-[fadeUp_0.6s_ease-out] flex-col gap-3">{children}</div>
    </div>
  );
}

function GoldButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="min-h-13 rounded-full border border-amber-200/70 bg-black/50 px-5 py-3.5 text-[17px] tracking-[0.08em] text-amber-50 [word-break:keep-all] shadow-[0_0_24px_rgba(255,210,130,0.25)] backdrop-blur-sm transition active:scale-[0.97] active:bg-amber-200/20"
    >
      {children}
    </button>
  );
}

function NameInput({
  placeholder,
  submit,
  initial,
  onSubmit,
}: {
  placeholder: string;
  submit: string;
  initial: string;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async (e: FormEvent) => {
    e.preventDefault();
    const n = value.trim();
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
    <form onSubmit={go} className="pb-safe absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/85 to-transparent px-6 pt-20">
      <div className="mx-auto mb-10 flex max-w-sm animate-[fadeUp_0.6s_ease-out] flex-col gap-3">
        <input
          className="rounded-full border border-amber-200/60 bg-black/60 px-6 py-3.5 text-center text-lg tracking-widest text-amber-50 outline-none placeholder:text-white/35 focus:border-amber-100"
          style={{ fontSize: 18 }}
          maxLength={20}
          autoFocus
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <GoldButton onClick={() => undefined}>{busy ? '……' : submit}</GoldButton>
        {err && <p className="text-center text-sm text-rose-300">{err}</p>}
      </div>
    </form>
  );
}

/** Spread 1–3 standing characters across the screen (three get a wider spread and narrower slots). */
function spriteSlot(k: number, n: number) {
  if (n === 1) return { left: '50%', maxWidth: '92%' };
  const span = n > 2 ? 62 : 44;
  return { left: `${50 - span / 2 + (span * k) / (n - 1)}%`, maxWidth: n > 2 ? '40%' : '52%' };
}

function MotionPlaceholder({ motion }: { motion: MotionId }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,#2a2140_0%,#07060d_70%)]">
      <div className="starfield" aria-hidden />
      <span className="text-xs tracking-[0.4em] text-amber-200/70">MOTION {motion}</span>
      <span className="mt-2 text-[11px] text-white/35">（動画準備中 · PLACEHOLDER）</span>
    </div>
  );
}
