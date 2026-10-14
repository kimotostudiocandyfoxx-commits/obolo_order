'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { hasMotion, motionUrl, spriteUrl, stillUrl, type MotionId } from '@/lib/onboarding/media';
import { Bgm } from '@/lib/onboarding/bgm';
import { DualVideo } from '@/lib/onboarding/dualVideo';
import { neoForm } from '@obolo/shared';
import { eggSvg } from '@/lib/look';
import { EggStep, HatchStep } from './BatiSteps';
import { EclipsePay, type OrderApi } from './EclipsePay';
import { LookMaker, type LookApi } from './LookMaker';
import { NeoChooser } from './NeoChooser';
import { JupiterTutorial } from '@/components/jupiter/JupiterTutorial';
import { MarsTutorial } from '@/components/mars/MarsTutorial';
import { MercuryTutorial } from '@/components/mercury/MercuryTutorial';
import { VenusTutorial } from '@/components/venus/VenusTutorial';
import { SaturnTutorial } from '@/components/saturn/SaturnTutorial';
import { bgmAt, fill, labelIndex, mediaAt, speakerName, type PictureFx, type Step, type StoryVars, type TimedCaption } from '@/lib/onboarding/script';
import {
  AgeInput,
  BluenaScreen,
  BookButton,
  DAY1_SEALS,
  FxLayer,
  KororinStep,
  NeoNameInput,
  PauseScreen,
  playSfx,
  RiddleBook,
  RiddleCards,
  SEALS,
  TimeUpOverlay,
  unlockSfx,
  VoiceField,
} from './StoryExtras';

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
  /** Day 3 'look' step: generate and choose the OBOLO NEO look. */
  lookApi?: LookApi;
  /** Day 3 'egg' step. */
  onEgg?: (food: string) => Promise<void>;
  /** Day 4 'hatch' step: resolves with the Bati picture. */
  onHatch?: () => Promise<string>;
  /** Day 4 'batiname' step. */
  onBatiName?: (name: string) => Promise<void>;
  /** The Eclipse day's 'order' step: the payment. `ordered` = already paid. */
  orderApi?: OrderApi;
  ordered?: boolean;
  /** Day 2 'neoname' step: the NEO name (becomes the display name). */
  onNeoName?: (name: string) => Promise<void>;
  /** Riddle-book seals already known / solved on earlier days (this day's steps add to them). */
  seals?: { known: number[]; solved: number[] };
  /**
   * The day's space time is over (88 minutes, SYS-S001): at the next calm moment MONBAN calls the
   * visitor back on Bluena's screen, then `onTimeUp`. Never during drawing, saving or paying.
   */
  timeUp?: boolean;
  onTimeUp?: () => void;
  /** 'pause' step: the day stops here (progress already points at the question to come back to). */
  onPause?: () => void;
  onEnd: (answers: Record<string, string>) => void;
}

const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
/** How far above the bottom the question stays while an input panel is open (px). */
const PROMPT_LIFT: Record<string, number> = { name: 230, batiname: 230, neoname: 260, age: 270, egg: 300 };

export function StoryPlayer({ steps, vars, initial, onProgress, onName, onNeo, lookApi, onEgg, onHatch, onBatiName, orderApi, ordered, onNeoName, seals, timeUp, onTimeUp, onPause, onEnd }: Props) {
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
  /** 'whiteout' step: the screen fades to white; the next scene fades in from it. */
  const [white, setWhite] = useState(false);
  const runRef = useRef<(from: number) => void>(() => {});
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
  /** Picture effect ('fx' steps) and Bluena's square screen ('screen' steps). */
  const [fx, setFx] = useState<PictureFx | null>(null);
  const [screen, setScreen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [timeUpShown, setTimeUpShown] = useState(false);
  const mutedRef = useRef(false);

  const step = steps[i];
  const v: StoryVars = {
    ...vars,
    name: name || vars.name,
    neo: neoForm(answers.neo)?.name ?? vars.neo,
    bati: answers.batiName ?? vars.bati,
    batiImage: answers.batiImage ?? vars.batiImage,
    batiFood: answers.food ?? vars.batiFood,
    look: answers.look ?? vars.look,
    age: answers.age ?? vars.age,
  };
  if (answers.neoName) v.neo = answers.neoName;
  // KIMORIN is "KIMORIN⭐︎" from his naming on the Moon (a day that starts later passes kimorinStar)
  const starAt = steps.findIndex((s) => s.t === 'say' && s.who === 'OBOLON' && s.text.includes('KIMORIN⭐︎。'));
  if (starAt >= 0 && i > starAt) v.kimorinStar = true;
  // the riddle book: seals known from earlier days + this day's
  const knownSeals = [...new Set([...(seals?.known ?? []), ...(answers.book ? DAY1_SEALS : []), ...Object.keys(answers).flatMap((k) => (/^seal\.\d$/.test(k) ? [Number(k.slice(5))] : []))])];
  const solvedSeals = [...new Set([...(seals?.solved ?? []), ...knownSeals.filter((n) => answers[`seal.${n}`] && SEALS[n]?.answer)])];
  /** '@bati' / '@egg' / '@me' sprites are the visitor's own pictures ('@bati-weak': out of mana). */
  const spriteSrc = (n: string) =>
    !n ? null : n === '@bati' || n === '@bati-weak' ? v.batiImage : n === '@egg' ? eggSvg(v.batiFood ?? '') : n === '@me' ? v.look : spriteUrl(n);
  /** Remember an answer (saved with the progress) without moving on. */
  const remember = (key: string, value: string) => {
    const a = { ...stateRef.current.answers, [key]: value };
    stateRef.current = { ...stateRef.current, answers: a };
    setAnswers(a);
  };

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
          setWhite(false);
          setStill(s.image);
          // a still is a full background: lift the start light / black screen
          setReady(true);
          setBlackout(false);
          n++;
        } else if (s.t === 'sprite') {
          setSprite(s.image);
          n++;
        } else if (s.t === 'se') {
          playSfx(s.sound, mutedRef.current);
          n++;
        } else if (s.t === 'fx') {
          setFx(s.fx);
          n++;
        } else if (s.t === 'screen') {
          setScreen(s.open);
          n++;
        } else if (s.t === 'pause') {
          // the day ends here; the saved progress points at the question to come back to
          bgm.current?.fadeOut();
          setScreen(false);
          let r = labelIndex(steps, s.resume);
          while (steps[r]?.t === 'label') r++;
          setI(r);
          setPaused(true);
          onPause?.();
          return;
        } else if (s.t === 'black') {
          bgQueue.current = [];
          setBlackout(true);
          dual.current?.pauseAll();
          n++;
        } else if (s.t === 'loop') {
          setWhite(false);
          clearStillOnShow.current = true;
          bgQueue.current = [];
          playMedia(s.motion, true);
          n++;
        } else if (s.t === 'bgvideo') {
          setWhite(false);
          clearStillOnShow.current = true;
          bgQueue.current = [...(s.then ?? [])];
          playMedia(s.motion, false);
          n++;
        } else if (s.t === 'whiteout') {
          setSprite(null);
          setWhite(true);
          setI(n);
          const after = n + 1;
          setTimeout(() => runRef.current(after), 3400);
          return;
        } else if (s.t === 'video') {
          setWhite(false);
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
    [steps, playMedia, setI, onEnd, clearCaptions, onPause],
  );
  runRef.current = run;

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
    mutedRef.current = muted;
    bgm.current?.setMuted(muted);
    dual.current?.setMuted(muted);
  }, [muted]);

  /** First tap: unlocks audio/video on iOS and starts (or resumes) the story inside the gesture. */
  const start = () => {
    setStarted(true);
    unlockSfx();
    // Start the music inside the gesture (fresh start: the first track; resume: the track at that point).
    const firstBgm = steps.find((s) => s.t === 'bgm');
    bgm.current?.unlock(i === 0 ? (firstBgm?.t === 'bgm' ? firstBgm.track : null) : bgmAt(steps, i));
    const firstMedia = mediaAt(steps, Math.max(i, steps.findIndex((s) => s.t === 'video')));
    if (firstMedia && hasMotion(firstMedia.motion)) dual.current?.unlock(motionUrl(firstMedia.motion));
    const cur = steps[i];
    if (i === 0) {
      run(0);
      return;
    }
    // resuming: restore what was on screen — the still (if newer than the last motion), the
    // characters, the picture effect and Bluena's screen — then the motion behind them
    const before = steps.slice(0, i).reverse();
    const lastFx = before.find((s) => s.t === 'fx');
    if (lastFx?.t === 'fx') setFx(lastFx.fx);
    const lastScreen = before.find((s) => s.t === 'screen');
    if (lastScreen?.t === 'screen') setScreen(lastScreen.open);
    const lastBack = before.find((s) => s.t === 'still' || s.t === 'video' || s.t === 'loop' || s.t === 'bgvideo' || s.t === 'black');
    const onStill = lastBack?.t === 'still';
    if (lastBack?.t === 'still') {
      setStill(lastBack.image);
      setReady(true);
    }
    const lastSprite = before.find((s) => s.t === 'sprite' || s.t === 'video');
    if (lastSprite?.t === 'sprite') setSprite(lastSprite.image);
    if (['video', 'bgvideo', 'black', 'bgm', 'loop', 'label', 'goto', 'still', 'sprite', 'whiteout', 'se', 'fx', 'screen', 'pause'].includes(cur.t)) {
      run(i);
      return;
    }
    const m = mediaAt(steps, i);
    if (onStill) return; // the still covers the screen: no motion needed behind it
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

  const interactiveTap = step && (step.t === 'caption' || step.t === 'say' || step.t === 'letter' || step.t === 'notice');
  // SYS-S001: only at a calm moment (a line, a button) — never while drawing, saving or paying
  const calm = step && ['caption', 'say', 'letter', 'notice', 'action', 'choice'].includes(step.t);
  useEffect(() => {
    if (timeUp && calm && started && !paused) setTimeUpShown(true);
  }, [timeUp, calm, started, paused]);
  // Keep the question visible while the visitor answers it (e.g. "お前の名前は？" above the name field).
  let pk = i - 1;
  while (steps[pk]?.t === 'label') pk--;
  const prev = steps[pk];
  const prompt =
    step && ['choice', 'name', 'action', 'egg', 'batiname', 'age', 'neoname'].includes(step.t) && !(step.t === 'choice' && step.prompt) && prev?.t === 'say' ? prev : null;

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
      <div className={`pointer-events-none absolute inset-0 z-[7] bg-white transition-opacity duration-[2600ms] ease-in-out ${white ? 'opacity-100' : 'opacity-0'}`} aria-hidden />
      {still && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={stillUrl(still)} alt="" className="pointer-events-none absolute inset-0 z-[2] h-full w-full animate-[fadeUp_0.6s_ease-out] object-cover" aria-hidden />
      )}
      {sprite &&
        (Array.isArray(sprite) ? sprite : [sprite]).map((name, k, arr) => {
          const src = spriteSrc(name);
          if (!src) return null;
          // the visitor's own pictures are square paintings: shown as rounded cards
          const own = name.startsWith('@') && name !== '@egg';
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={name}
              src={src}
              alt=""
              className={`pointer-events-none absolute z-[3] -translate-x-1/2 animate-[spriteIn_0.45s_ease-out] object-contain drop-shadow-[0_18px_40px_rgba(0,0,0,0.55)] ${name === 'obolon' ? 'bottom-[40%] h-[22%]' : name === 'kimorin-dragon' ? 'bottom-[18%] h-[66%]' : name === 'monban' ? 'bottom-[20%] h-[58%]' : name === 'unchi-pinpon' ? 'bottom-[26%] h-[26%]' : name === '@bati-weak' ? 'bottom-[26%] h-[30%] rotate-[-6deg] rounded-[2rem] border-2 border-white/20 opacity-80 brightness-75 saturate-[.35]' : own ? 'bottom-[30%] h-[34%] rounded-[2rem] border-2 border-amber-200/50' : name === '@egg' ? 'bottom-[30%] h-[36%] animate-[bob_3s_ease-in-out_infinite]' : screen ? 'bottom-[22%] h-[36%]' : 'bottom-[24%] h-[50%]'}`}
              style={spriteSlot(k, arr.length)}
              aria-hidden
            />
          );
        })}
      <FxLayer fx={fx} />
      <BluenaScreen open={screen} />
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
        <div className="pointer-events-none absolute inset-x-0 z-10 px-4" style={{ bottom: `calc(${step?.t === 'choice' ? step.options.length * 64 + 40 : PROMPT_LIFT[step?.t ?? ''] ?? 150}px + env(safe-area-inset-bottom))` }}>
          <div className="relative mx-auto w-full max-w-xl rounded-2xl border border-amber-200/35 bg-black/60 px-5 pb-5 pt-7 backdrop-blur-md">
            <span className="absolute -top-3.5 left-5 rounded-full border border-amber-200/50 bg-black px-3 py-0.5 text-xs font-bold tracking-[0.25em] text-amber-200">
              {speakerName(prompt.who, v)}
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
      {started && step?.t === 'choice' && step.prompt && (
        <div className="pointer-events-none absolute inset-x-0 z-10 px-4" style={{ bottom: `calc(${step.options.length * 64 + 40}px + env(safe-area-inset-bottom))` }}>
          <div className="mx-auto w-full max-w-xl rounded-2xl border border-amber-200/50 bg-black/70 px-5 py-4 text-center backdrop-blur-md">
            <p className="whitespace-pre-wrap text-[16px] leading-relaxed text-amber-50">{fill(step.prompt, v)}</p>
          </div>
        </div>
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
      {started && step?.t === 'venus' && <VenusTutorial onDone={next} />}
      {started && step?.t === 'order' && orderApi && (
        <EclipsePay api={orderApi} paid={!!ordered} onPaid={() => run(iRef.current + 1)} onCancel={() => run(labelIndex(steps, step.cancel))} />
      )}
      {started && step?.t === 'neo' && (
        <NeoChooser
          onChoose={async (id) => {
            await onNeo?.(id);
            choose('neo', id);
          }}
        />
      )}
      {started && step?.t === 'look' && lookApi && (
        <LookMaker
          api={lookApi}
          onDone={(url) => {
            if (url) remember('look', url);
            run(iRef.current + 1);
          }}
        />
      )}
      {started && step?.t === 'egg' && (
        <EggStep
          submit={step.submit}
          onEgg={async (food) => {
            await onEgg?.(food);
            remember('food', food);
            run(iRef.current + 1);
          }}
        />
      )}
      {started && step?.t === 'hatch' && (
        <HatchStep
          food={v.batiFood ?? ''}
          onHatch={() => (onHatch ? onHatch() : Promise.resolve(''))}
          onDone={(url) => {
            remember('batiImage', url);
            run(iRef.current + 1);
          }}
        />
      )}
      {started && step?.t === 'age' && (
        <AgeInput
          onAnswer={(age) => {
            remember('age', age);
            run(iRef.current + 1);
          }}
          onSkip={() => run(labelIndex(steps, step.skip))}
        />
      )}
      {started && step?.t === 'neoname' && (
        <NeoNameInput
          placeholder={step.placeholder}
          submit={step.submit}
          onSubmit={async (n) => {
            await onNeoName?.(n);
            remember('neoName', n);
            run(iRef.current + 1);
          }}
        />
      )}
      {started && step?.t === 'riddles' && (
        <RiddleCards
          onDone={() => {
            remember('book', '1');
            run(iRef.current + 1);
          }}
        />
      )}
      {started && step?.t === 'seal' && (
        <RiddleBook
          known={[...new Set([...knownSeals, step.n])]}
          solved={[...new Set([...solvedSeals, step.n])]}
          fresh={step.n}
          onClose={() => {
            remember(`seal.${step.n}`, '1');
            run(iRef.current + 1);
          }}
        />
      )}
      {started && step?.t === 'kororin' && (
        <KororinStep
          bati={v.bati || 'バティ'}
          batiImage={v.batiImage}
          face={v.look}
          onDone={(text) => {
            // PLACEHOLDER (P-SAT-*): the first journey's kororin stays in your own room — kept with the
            // day's answers (with the time), sent to nobody
            remember('kororin', JSON.stringify({ text, at: new Date().toISOString() }));
            run(iRef.current + 1);
          }}
        />
      )}
      {started && step?.t === 'batiname' && (
        <NameInput
          placeholder={step.placeholder}
          submit={step.submit}
          initial=""
          onSubmit={async (n) => {
            await onBatiName?.(n);
            remember('batiName', n);
            run(iRef.current + 1);
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

      {started && knownSeals.length > 0 && step?.t !== 'seal' && step?.t !== 'riddles' && <BookButton onClick={() => setBookOpen(true)} />}
      {bookOpen && <RiddleBook known={knownSeals} solved={solvedSeals} onClose={() => setBookOpen(false)} />}
      {paused && <PauseScreen />}
      {timeUpShown && (
        <TimeUpOverlay
          muted={muted}
          onDone={() => {
            setScreen(false);
            onTimeUp?.();
          }}
        />
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
  const text = step.t === 'caption' || step.t === 'say' || step.t === 'letter' || step.t === 'notice' ? fill(step.text, vars) : '';
  const chars = [...text];
  const [shown, setShown] = useState(step.t === 'letter' || step.t === 'notice' ? chars.length : 0);
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

  if (step.t === 'notice') {
    return (
      <button className="absolute inset-0 z-10 flex items-center justify-center bg-black/45 px-8" onClick={tap}>
        <div className="w-full max-w-sm animate-[fadeUp_0.5s_ease-out] whitespace-pre-wrap rounded-2xl border border-amber-200/40 bg-black/75 px-6 py-5 text-center text-[15px] leading-relaxed text-amber-50 [word-break:keep-all] backdrop-blur-md">
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

  const who = step.t === 'say' ? speakerName(step.who, vars) : '';
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
        <VoiceField value={value} onChange={setValue} placeholder={placeholder} />
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
