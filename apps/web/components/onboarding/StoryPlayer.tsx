'use client';

import { L2Step } from '@/components/lap2/L2Step';
import { BatiChat } from './BatiChat';
import { SongShow } from '@/components/lap2/SongShow';
import { MIKIE_DRILL } from '@/lib/onboarding/lap2';
import { useCallback, useEffect, useRef, useState } from 'react';
import { hasMotion, motionUrl, spriteUrl, stillShows, stillUrl, type MotionId } from '@/lib/onboarding/media';
import { Bgm } from '@/lib/onboarding/bgm';
import { DualVideo } from '@/lib/onboarding/dualVideo';
import { nameCharsOk, neoForm } from '@obolo/shared';
import { eggSvg } from '@/lib/look';
import { EggStep, HatchStep } from './BatiSteps';
import { EclipsePay, type OrderApi } from './EclipsePay';
import { LookMaker, type LookApi } from './LookMaker';
import { NeoChooser } from './NeoChooser';
import { JupiterLesson } from '@/components/jupiter/JupiterLesson';
import { saveAtelier } from '@/components/lap2/AtelierVisit';
import { islandCards } from '@/components/mercury/MyIsland';
import { saveIsland } from '@/components/lap2/IslandWorks';
import { MarsLesson } from '@/components/mars/MarsLesson';
import { MercuryLesson } from '@/components/mercury/MercuryLesson';
import type { LessonApi } from '@/lib/onboarding/lessonApi';
import { madeFrom } from '@/lib/onboarding/made';
import { Camera, Cast, CutIn, Motes, OFFSTAGE, Smoke, speakerSprite } from '@/components/story/Stage';
import { exprFor, reactFor } from '@/lib/story/expression';
import { DialogueWindow, IconButton, MixerPanel, Telop } from '@/components/story/parts';
import { markHeard, noWaitVoice, setNoWaitVoice, wasHeard } from '@/lib/story/heard';
import { filmWatched, markFilmWatched } from '@/lib/story/films';
import { LineVoice, loadMix, saveMix, VOICE_DIP, type Mix } from '@/lib/story/lineVoice';
import { useNameVoices } from '@/lib/story/useNameVoices';
import { FilmReel } from './FilmReel';
import { SaturnLesson } from '@/components/saturn/SaturnLesson';
import { SealGate, sealGateSeen } from './SealGate';
import { VenusLesson } from '@/components/venus/VenusLesson';
import { bgmAt, fill, labelIndex, mediaAt, speakerName, type PictureFx, type Speaker, type Step, type StoryVars, type TimedCaption } from '@/lib/onboarding/script';
import { ChatLog, MessageBar, ReplyChips, type Avatar, type ChatEntry, type ChatReveal } from '@/components/story/Chat';
import { VoiceChoice } from './VoiceChoice';
import { Invitation } from '@/components/story/Invitation';
import { TicketArt } from '@/components/story/Ticket';
import {
  AgeInput,
  BluenaScreen,
  BookButton,
  DAY1_SEALS,
  FxLayer,
  PauseScreen,
  fadeLongSfx,
  playSfx,
  prefetchSfx,
  RiddleBook,
  RiddleCards,
  SEALS,
  type StampId,
  TicketCard,
  TimeUpOverlay,
  unlockSfx,
  MicAllowed,
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
  onEgg?: (food: string, egg: 'sun' | 'earth') => Promise<void>;
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
  /** The planet lessons' server calls (stickers, lyrics, songs, MVs). */
  lessonApi?: LessonApi;
  /** The ticket's stamps from earlier days. */
  stamps?: StampId[];
  /** 'clock' steps: the day's 88 minutes run (on) or pause (off) — M-R22. */
  onClock?: (on: boolean) => void;
  /**
   * The day's space time is over (88 minutes, SYS-S001): at the next calm moment MONBAN calls the
   * visitor back on Bluena's screen, then `onTimeUp`. Never during drawing, saving or paying.
   */
  timeUp?: boolean;
  onTimeUp?: () => void;
  /** 'pause' step: the day stops here (progress already points at the question to come back to). */
  onPause?: () => void;
  onEnd: (answers: Record<string, string>) => void;
  /** Day 1 until Saturn: answers are typed, no mic (M-R41) */
  textOnly?: boolean;
  /** straight on from a tap that already woke the sound (the second journey's next chapter): no start screen */
  autoStart?: boolean;
}

const SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

// --- the story as a chat (client decision 2026-10-19) ---
/** a line of the scene's thread, as written (names are filled in when shown) */
type ChatRaw = { id: string; kind: 'them'; who: Speaker; text: string } | { id: string; kind: 'me'; text: string; action?: boolean } | { id: string; kind: 'sys'; text: string };
/** each speaker's face in the thread */
const AVATARS: Partial<Record<Speaker, Avatar>> = {
  MONBAN: { src: '/story/avatars/monban.webp', dark: true },
  OBOLON: { src: '/story/avatars/obolon.webp', dark: true },
  KIMORIN: { src: '/story/avatars/kimorin.webp' },
  たこ焼きブラザー: { src: '/story/avatars/brother.webp' },
  たこ焼きシスター: { src: '/story/avatars/sister.webp' },
  うんちピンポンくん: { src: '/story/avatars/pinpon.webp' },
  大根カイザー: { src: '/onboarding/kaiser-face.webp' },
  フリージー: { src: '/onboarding/freezy-face.webp' },
  ヒポキン: { src: '/onboarding/hipokin-face.webp' },
  ロングG: { src: '/onboarding/longg-face.webp' },
  ハットG: { src: '/onboarding/hatg-face.webp' },
  ボスG: { src: '/onboarding/bossg-face.webp' },
};
/** the day's title (「1日目」) stays a quiet title over the picture, not a line of the thread */
const DAY_TITLE = /^\d+日目$/;
/** a step that goes into the thread when it is reached */
function chatLine(s: Step, id: string): ChatRaw | null {
  if (s.t === 'say') return { id, kind: 'them', who: s.who, text: s.text };
  if (s.t === 'caption' && !DAY_TITLE.test(s.text) && !s.when) return { id, kind: 'sys', text: s.text };
  if (s.t === 'notice') return { id, kind: 'sys', text: s.text };
  if (s.t === 'arrive') return { id, kind: 'sys', text: s.caption };
  return null;
}
/** room the replies / message bar take at the bottom (px) */
function chatBottom(s: Step | undefined): number {
  if (!s) return 28;
  if (s.t === 'action') return 78;
  // the voice answer (a big 〔🎙〕) needs the room under the question (QA 6 R2)
  if (s.t === 'choice' && s.voice) return 230;
  if (s.t === 'choice') return s.options.length > 2 ? 128 : 78;
  if (s.t === 'name' || s.t === 'batiname' || s.t === 'neoname') return 112;
  return 30;
}

/** an answer picked is {neo} speaking too (M-R170): their own figure comes up big for a moment, like with 〔🎙〕 */
function neoSays() {
  window.dispatchEvent(new CustomEvent('obolo:speaking', { detail: true }));
  setTimeout(() => window.dispatchEvent(new CustomEvent('obolo:speaking', { detail: false })), 1800);
}

/** day 2's stills with KIMORIN drawn in, and the look he has in them */
const STILL_LOOK: Record<string, string> = {
  's/d2-gate-two-inside': 'kimorin-i',
  's/d2-hall-kimorin': 'kimorin-i',
  's/d2-hall-kimorin-squint': 'kimorin-i',
  's/d2-hall-dark-kimorin': 'kimorin-i',
  's/d2-hall-kimorin-up': 'kimorin-iu',
  's/d2-hall-sky-monban': 'kimorin-iu',
  's/d2-moon-kimorin': 'kimorin-iu',
  's/d2-moon-kimorin-squint': 'kimorin-iu',
  's/d2-moon-kimorin-half': 'kimorin-iu',
};

export function StoryPlayer({ steps, vars, initial, onProgress, onName, onNeo, lookApi, onEgg, onHatch, onBatiName, orderApi, ordered, onNeoName, lessonApi, seals, stamps, onClock, timeUp, onTimeUp, onPause, onEnd, textOnly = false, autoStart = false }: Props) {
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
  const [blackFade, setBlackFade] = useState(0);
  const [still, setStillState] = useState<string | null>(null);
  // the still on screen, known at once (several steps run before the next render: QA 10 R28)
  const stillRef = useRef<string | null>(null);
  // how each still came in: a fade-up, or a cross-fade over the one before (kept for as long as it shows: R27)
  const [stillAnim, setStillAnim] = useState('fadeUp 0.6s ease-out');
  // the still drawn on screen now (stillRef runs ahead while the next one loads)
  const shownStill = useRef<string | null>(null);
  // stills come in their order, each once it is decoded (QA 12: a slow one was skipped); a direct set starts a new line
  const stillGen = useRef(0);
  const stillLine = useRef<Promise<void>>(Promise.resolve());
  // the decoded pictures, kept (the loaded Image objects stay alive so the browser keeps them ready)
  const stillCache = useRef(new Map<string, { img: HTMLImageElement; ready: Promise<void> }>());
  const loadStill = (img: string) => {
    let c = stillCache.current.get(img);
    if (!c) {
      const el = new Image();
      el.src = stillUrl(img);
      c = { img: el, ready: (el.decode ? el.decode() : Promise.resolve()).catch(() => undefined) };
      stillCache.current.set(img, c);
      if (stillCache.current.size > 24) stillCache.current.delete(stillCache.current.keys().next().value!);
    }
    return c.ready;
  };
  const setStill = (img: string | null) => {
    stillGen.current++;
    stillLine.current = Promise.resolve();
    stillRef.current = img;
    shownStill.current = img;
    setStillState(img);
  };
  /**
   * A still from a still always cross-fades over the one before (0.5 s unless the step says): cutting showed the motion
   * frame or black underneath for a moment (QA 11 R32). It starts once the new picture is decoded, the one before staying
   * until then (R33). From a motion or black (no still before) it fades up as before.
   */
  const showStill = (img: string, fade?: number) => {
    const gen = stillGen.current;
    stillRef.current = img;
    const ready = loadStill(img);
    const go = () => {
      if (gen !== stillGen.current) return;
      const prev = shownStill.current;
      clearTimeout(underTimer.current);
      if (prev && prev !== img) {
        const f = fade ?? 0.5;
        setUnder({ image: prev, fade: f });
        setStillAnim(`stillIn ${f}s linear both`);
        underTimer.current = setTimeout(() => setUnder(null), f * 1000 + 100);
      } else {
        setUnder(null);
        if (prev !== img) setStillAnim('fadeUp 0.6s ease-out');
      }
      shownStill.current = img;
      setStillState(img);
    };
    stillLine.current = stillLine.current.then(() => ready).then(go);
  };
  // a cross-fade between two stills: the one before stays underneath (the same <img>) while the new one fades in
  const [under, setUnder] = useState<{ image: string; fade: number } | null>(null);
  const underTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clearStillOnShow = useRef(false);
  const [placeholder, setPlaceholder] = useState<MotionId | null>(null);
  /** 'whiteout' step: the screen fades to white; the next scene fades in from it. */
  const [white, setWhite] = useState(false);
  const runRef = useRef<(from: number) => void>(() => {});
  const varsRef = useRef(vars);
  varsRef.current = vars;
  const [blocked, setBlocked] = useState(false);
  const [muted, setMuted] = useState(false);
  const placeholderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Motions still to play behind the dialogue after the current background motion (bgvideo.then). */
  const bgQueue = useRef<MotionId[]>([]);
  /** Timed captions of the motion that is starting (shown once its first frame is on screen). */
  const pendingCaptions = useRef<TimedCaption[]>([]);
  const captionTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pendingBgm = useRef<{ track: string; at: number } | null>(null);
  const cueDue = useRef<string | null>(null);
  const [overlayCaption, setOverlayCaption] = useState<string | null>(null);
  // the scene's thread (cleared when the scene changes: a motion, an arrival, black)
  const [log, setLog] = useState<ChatRaw[]>([]);
  const addLine = useCallback((e: ChatRaw | null) => {
    if (e) setLog((l) => (l[l.length - 1]?.id === e.id ? l : [...l, e]));
  }, []);
  const reveal = useRef<ChatReveal>({ done: true, finish: () => {} });
  // the thread as it was shown last, and whether it is fading out (QA 12 R35)
  const lastChat = useRef<{ entries: ChatEntry[]; bottom: number }>({ entries: [], bottom: 0 });
  const [chatLeaving, setChatLeaving] = useState(false);
  const chatWas = useRef(false);
  /** Day 1's invitation card is on screen (leaving: its words lift away as the next motion starts under it) */
  /** the space ticket picture as the scene (a `ticket` step with no stamp or flip): stays until the next scene */
  const [ticketArt, setTicketArt] = useState<{ dest?: string; leaving?: boolean } | null>(null);
  /** a motion that starts from the ticket picture (the paper airplane): the words lift off and the ticket hands over to it */
  const leaveTicket = useCallback(() => {
    setTicketArt((t) => (t && !t.leaving ? { ...t, leaving: true } : t));
    setTimeout(() => setTicketArt((t) => (t?.leaving ? null : t)), 1300);
  }, []);
  const [invite, setInviteState] = useState(false);
  const [inviteLeaving, setInviteLeaving] = useState(false);
  const inviteOn = useRef(false);
  const setInvite = useCallback((on: boolean) => {
    inviteOn.current = on;
    setInviteState(on);
    if (on) setInviteLeaving(false);
  }, []);
  const leaveInvite = useCallback(() => {
    if (!inviteOn.current) return;
    inviteOn.current = false;
    setInviteLeaving(true);
    setTimeout(() => {
      if (inviteOn.current) return;
      setInviteState(false);
      setInviteLeaving(false);
    }, 1500);
  }, []);
  const clearCaptions = useCallback(() => {
    captionTimers.current.forEach(clearTimeout);
    captionTimers.current = [];
    // a motion left before its music cue: the music still changes
    if (cueDue.current) bgm.current?.set(cueDue.current);
    cueDue.current = null;
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
  // the stage (production UI 3–5): camera, expressions, cut-ins, smoke, motes, voices, the mixer
  const [cam, setCam] = useState<{ move: 'in' | 'out' | 'shake'; focus?: string } | null>(null);
  const [expressions, setExpressions] = useState<Record<string, string>>({});
  const [cutin, setCutin] = useState<string | null>(null);
  const [smoke, setSmoke] = useState(0);
  const [motes, setMotes] = useState(0);
  const [talking, setTalking] = useState(false);
  const [mix, setMix] = useState<Mix>(() => (typeof window === 'undefined' ? { bgm: 0.8, se: 0.8, voice: 1 } : loadMix()));
  const mixRef = useRef(mix);
  mixRef.current = mix;
  const [mixerOpen, setMixerOpen] = useState(false);
  const [noWait, setNoWait] = useState(false);
  useEffect(() => setNoWait(noWaitVoice()), []);
  const voice = useRef<LineVoice | null>(null);
  if (typeof window !== 'undefined') voice.current ??= new LineVoice();

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
  // what earlier days made, with today's pieces on top
  const todayMade = madeFrom(undefined, answers);
  v.made = { ...vars.made, ...Object.fromEntries(Object.entries(todayMade).filter(([, x]) => x !== undefined)) };
  // KIMORIN is "KIMORIN⭐︎" from his naming on the Moon (a day that starts later passes kimorinStar)
  const starAt = steps.findIndex((s) => s.t === 'say' && s.who === 'OBOLON' && s.text.includes('KIMORIN⭐︎。'));
  if (starAt >= 0 && i > starAt) v.kimorinStar = true;
  // the riddle book: seals known from earlier days + this day's
  const knownSeals = [...new Set([...(seals?.known ?? []), ...(answers.book ? DAY1_SEALS : []), ...Object.keys(answers).flatMap((k) => (/^seal\.\d$/.test(k) ? [Number(k.slice(5))] : []))])];
  const solvedSeals = [...new Set([...(seals?.solved ?? []), ...Object.keys(answers).flatMap((k) => (/^open\.\d$/.test(k) && SEALS[Number(k.slice(5))]?.answer ? [Number(k.slice(5))] : []))])];
  // the ticket's stamps: earlier days' + this day's
  const stampList = [...new Set([...(stamps ?? []), ...Object.keys(answers).flatMap((k) => (k.startsWith('stamp.') ? [k.slice(6) as StampId] : []))])];
  /** '@bati' / '@egg' / '@me' sprites are the visitor's own pictures ('@bati-weak': out of mana). */
  const spriteSrc = (n: string) =>
    !n ? null : n === '@bati' ? (expressions['@bati'] && v.batiFaces?.[expressions['@bati']]) || v.batiImage : n === '@bati-weak' ? v.batiImage : n === '@egg' ? eggSvg(v.batiFood ?? '') : n === '@me' ? v.look : spriteUrl(n);
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
        else if (s.t === 'caption' && s.when && !varsRef.current[s.when]) n++;
        else if (s.t === 'bgm') {
          if (s.track === null && s.fade) bgm.current?.fadeOut(s.fade);
          else bgm.current?.set(s.track);
          n++;
        }
        else if (s.t === 'goto') n = labelIndex(steps, s.id);
        // an answer given earlier today first (the egg), else one from an earlier day
        else if (s.t === 'branch') n = labelIndex(steps, s.cases[stateRef.current.answers[s.key] ?? varsRef.current.story?.[s.key] ?? ''] ?? s.otherwise);
        else if (s.t === 'ticket' && !s.stamp && !s.flip) {
          setTicketArt({ dest: s.dest });
          setReady(true);
          setBlackout(false);
          n++;
        } else if (s.t === 'still') {
          setWhite(false);
          setTicketArt(null);
          showStill(s.image, s.fade);
          // a still is a full background: lift the start light / black screen
          setReady(true);
          setBlackout(false);
          n++;
        } else if (s.t === 'sprite') {
          setSprite(s.image);
          n++;
        } else if (s.t === 'se') {
          playSfx(s.sound, mutedRef.current, mixRef.current.se);
          n++;
        } else if (s.t === 'cam') {
          // a move without a focus keeps the one before (QA 11 R34: the picture jumped back to 50% 40%)
          setCam((c) => ({ move: s.move, focus: s.focus ?? c?.focus }));
          if (s.move === 'shake') setTimeout(() => setCam((c) => (c?.move === 'shake' ? null : c)), 1100);
          n++;
        } else if (s.t === 'face') {
          setExpressions((e) => ({ ...e, [s.who]: s.expr }));
          n++;
        } else if (s.t === 'cutin') {
          setCutin(s.who);
          n++;
        } else if (s.t === 'motes') {
          setMotes(s.count);
          n++;
        } else if (s.t === 'enter') {
          // the "appearance" pattern: smoke first, then the character is there
          if (s.fx !== 'light') setSmoke((k) => k + 1);
          const who = s.who;
          setTimeout(() => setSprite((cur) => (Array.isArray(cur) ? (cur.includes(who) ? cur : [...cur, who]) : cur && cur !== who ? [cur, who] : who)), s.fx === 'light' ? 0 : 650);
          n++;
        } else if (s.t === 'arrive') {
          // the "arrival" pattern: the new place under a title; waits for a tap
          setWhite(false);
          setSprite(null);
          setCam(null);
          setTicketArt(null);
          setStill(s.image);
          setReady(true);
          setBlackout(false);
          setInvite(false);
          setLog([]);
          addLine(chatLine(s, `s${n}`));
          setI(n);
          return;
        } else if (s.t === 'invitation') {
          setLog([]);
          setInvite(true);
          // the card is a full scene of its own: lift the start light / black screen
          setReady(true);
          setBlackout(false);
          setI(n);
          return;
        } else if (s.t === 'fx') {
          setFx(s.fx);
          n++;
        } else if (s.t === 'screen') {
          setScreen(s.open);
          n++;
        } else if (s.t === 'clock') {
          onClock?.(s.on);
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
          setTicketArt(null);
          setBlackFade(s.fade ?? 0);
          setBlackout(true);
          if (s.fade) {
            // darkening: the picture stays under it until it is black, then the story goes on
            const after = n + 1;
            setI(n);
            setTimeout(() => {
              setLog([]);
              dual.current?.pauseAll();
              runRef.current(after);
            }, s.fade * 1000);
            return;
          }
          setLog([]);
          dual.current?.pauseAll();
          n++;
        } else if (s.t === 'loop') {
          setWhite(false);
          clearStillOnShow.current = true;
          bgQueue.current = [];
          setTicketArt(null);
          playMedia(s.motion, true);
          n++;
        } else if (s.t === 'bgvideo') {
          setWhite(false);
          clearStillOnShow.current = true;
          bgQueue.current = [...(s.then ?? [])];
          setTicketArt(null);
          playMedia(s.motion, false);
          n++;
        } else if (s.t === 'wait') {
          setI(n);
          const after = n + 1;
          setTimeout(() => runRef.current(after), s.s * 1000);
          return;
        } else if (s.t === 'whiteout') {
          setSprite(null);
          setWhite(true);
          setLog([]);
          setI(n);
          const after = n + 1;
          setTimeout(() => runRef.current(after), 3400);
          return;
        } else if (s.t === 'film') {
          // a film watched before (or skipped) does not play again, also after a restart
          if (filmWatched(s.id)) {
            n++;
            continue;
          }
          setWhite(false);
          clearStillOnShow.current = true;
          bgQueue.current = [];
          setSprite(null);
          setCam(null);
          setLog([]);
          leaveTicket();
          leaveInvite();
          clearCaptions();
          filmPart.current = 0;
          bgm.current?.set(`film-${s.id}`);
          playMedia(`film-${s.id}-1`, false);
          if (s.parts > 1) dual.current?.preload(motionUrl(`film-${s.id}-2`));
          setI(n);
          return;
        } else if (s.t === 'video') {
          setWhite(false);
          clearStillOnShow.current = true;
          bgQueue.current = [];
          setSprite(null);
          setCam(null);
          setLog([]);
          leaveTicket();
          leaveInvite();
          clearCaptions();
          pendingCaptions.current = s.captions ?? [];
          pendingBgm.current = s.bgmAt ?? null;
          playMedia(s.motion, false);
          setI(n);
          return;
        } else {
          addLine(chatLine(s, `s${n}`));
          setI(n);
          if (s.t === 'end') {
            bgm.current?.fadeOut();
            onEnd(stateRef.current.answers);
          }
          return;
        }
      }
    },
    [steps, playMedia, setI, onEnd, clearCaptions, onPause, onClock, addLine, setInvite, leaveInvite, leaveTicket],
  );
  runRef.current = run;

  // E-0 (M-R131): the seal before the invitation, only the very first time (read after mount: no hydration gap)
  const [gateSeen, setGateSeen] = useState(true);
  useEffect(() => setGateSeen(sealGateSeen()), []);
  const filmPart = useRef(0);
  const endFilm = () => {
    const s = steps[iRef.current];
    if (s?.t !== 'film') return;
    markFilmWatched(s.id);
    bgm.current?.fadeOut(0.8);
    // the film's last frame does not stay under what follows (「1日目」 sat on the snowy village)
    dual.current?.pauseAll();
    setBlackout(true);
    run(iRef.current + 1);
  };
  const onEndedRef = useRef(() => {});
  onEndedRef.current = () => {
    const s = steps[iRef.current];
    if (s?.t === 'film') {
      const k = ++filmPart.current;
      if (k >= s.parts) return endFilm();
      playMedia(`film-${s.id}-${k + 1}`, false);
      if (k + 1 < s.parts) dual.current?.preload(motionUrl(`film-${s.id}-${k + 2}`));
      return;
    }
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
        const cue = pendingBgm.current;
        pendingBgm.current = null;
        if (cue) {
          cueDue.current = cue.track;
          captionTimers.current.push(
            setTimeout(() => {
              cueDue.current = null;
              bgm.current?.set(cue.track);
            }, cue.at * 1000),
          );
        }
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

  useEffect(() => {
    // strict mode mounts twice in development: the first cleanup disposed the music for good (QA 5 N23)
    bgm.current?.revive();
    return () => {
      if (placeholderTimer.current) clearTimeout(placeholderTimer.current);
      captionTimers.current.forEach(clearTimeout);
      bgm.current?.dispose();
    };
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
    bgm.current?.setMuted(muted);
    dual.current?.setMuted(muted);
    voice.current?.setMuted(muted);
  }, [muted]);

  // the mixer: music (dipping while someone speaks), sounds, voices
  // a lesson can quiet the music under itself (Saturn: low while kororins sing, silent while the mic records — QA 5 N14)
  const [duck, setDuck] = useState(1);
  useEffect(() => {
    const f = (e: Event) => setDuck(Math.max(0, Math.min(1, Number((e as CustomEvent<number>).detail))));
    window.addEventListener('obolo:bgm-duck', f);
    return () => window.removeEventListener('obolo:bgm-duck', f);
  }, []);
  useEffect(() => {
    saveMix(mix);
    voice.current?.setVolume(mix.voice);
    bgm.current?.setScale(mix.bgm * (talking ? VOICE_DIP : 1) * duck, talking ? 0.25 : 0.6);
  }, [mix, talking, duck]);
  useEffect(() => {
    const vc = voice.current;
    if (!vc) return;
    vc.onSpeaking = setTalking;
    return () => vc.dispose();
  }, []);
  // the lines with the member's names in them: their own voices, made in the background
  useNameVoices(voice.current, steps, { name: v.name, neo: v.neo, bati: answers.batiName ?? vars.bati, food: v.batiFood, inviter: v.inviter });
  // each spoken line plays its voice (when it has one)
  // the voice's loudness for the speaker's lip sync, and the line's small reaction
  const voiceLevel = useCallback(() => voice.current?.level() ?? 0, []);
  const sayReact = steps[i]?.t === 'say' ? reactFor((steps[i] as Extract<Step, { t: 'say' }>).who, (steps[i] as Extract<Step, { t: 'say' }>).text) : undefined;
  // KIMORIN / MONBAN speaking over a still that does not show them: their pose picture steps in (client
  // 2026-10-25). KIMORIN in the look he last had on stage that day (kimorin-i / -iu: the inventor, goggles on / up; kimorin-g at the gate with the
  // sunglasses on, kimorin-n before the dragon, kimorin-sun after); none yet → he stays off.
  // KIMORIN's look on stage now (the last kimorin-* standee of the day): his chat icon follows it
  // KIMORIN's look now: the last sprite that shows him, or a still with him drawn in (day 2's stills hold the cast:
  // QA 6 R4 — the portrait went missing when the sprites gave way to those stills)
  const lookBefore = (from: number) => {
    for (let k = from; k >= 0; k--) {
      const x = steps[k];
      if (x?.t === 'still' && STILL_LOOK[x.image]) return STILL_LOOK[x.image];
      if (x?.t !== 'sprite') continue;
      const look = (Array.isArray(x.image) ? x.image : [x.image]).find((n) => n === 'kimorin-sun' || n === 'kimorin-n' || n === 'kimorin-g' || n === 'kimorin-i' || n === 'kimorin-iu');
      if (look) return look;
    }
    return null;
  };
  const kimorinLook = lookBefore(i);
  // the inventor (day 2 until the Moon), then the round sunglasses over his eyes (story M-R112)
  const kimorinAvatar: Avatar | undefined =
    kimorinLook === 'kimorin-i' || kimorinLook === 'kimorin-iu' ? { src: `/story/avatars/${kimorinLook}.webp` } : kimorinLook === 'kimorin-sun' ? { src: '/story/avatars/kimorin-glasses.webp' } : undefined;
  const autoStandee = (() => {
    const st = steps[i];
    if (st?.t !== 'say' || sprite || !still || screen || placeholder) return null;
    if (st.who === 'MONBAN') return stillShows(still, 'MONBAN') ? null : 'monban';
    if (st.who === 'KIMORIN' && !stillShows(still, 'KIMORIN')) return lookBefore(i - 1);
    return null;
  })();
  // the speaker's face and gesture for this line (picked from the words; a 'face' step still wins until the next line)
  const sayExpressions = (set: Record<string, string>, on?: string[]) => {
    const st = steps[i];
    if (st?.t !== 'say' || (!sprite && !on)) return set;
    const names = on ?? (Array.isArray(sprite) ? sprite : [sprite]).filter((x): x is string => !!x);
    const who = speakerSprite(st.who, names);
    return who && who !== OFFSTAGE ? { ...set, [who]: exprFor(st.who, st.text) } : set;
  };
  const sayNow = started && steps[i]?.t === 'say' ? (steps[i] as Extract<Step, { t: 'say' }>) : null;
  // the next line's voice is fetched while this one is read, so it starts the moment it shows
  useEffect(() => {
    for (let k = i + 1; k < Math.min(steps.length, i + 8); k++) {
      const s = steps[k];
      if (s.t === 'say') {
        void voice.current?.prefetch(s.voice ?? s.who, s.text);
        break;
      }
    }
  }, [i, steps]);
  // the next motion loads behind the one on screen
  useEffect(() => {
    if (!started) return;
    for (let k = i + 1; k < Math.min(steps.length, i + 12); k++) {
      const s = steps[k];
      if (s.t === 'film') {
        if (!filmWatched(s.id)) dual.current?.preload(motionUrl(`film-${s.id}-1`));
        break;
      }
      if (s.t === 'video' || s.t === 'loop' || s.t === 'bgvideo') {
        if (hasMotion(s.motion)) dual.current?.preload(motionUrl(s.motion));
        break;
      }
    }
  }, [i, steps, started]);
  // the sounds coming up are fetched ahead
  useEffect(() => {
    for (let k = i; k < Math.min(steps.length, i + 10); k++) {
      const s = steps[k];
      if (s.t === 'se') prefetchSfx(s.sound);
    }
  }, [i, steps]);
  // a motion whose music cue was never scheduled (it did not show): the music changes once the story moves past it
  useEffect(() => {
    if (pendingBgm.current && steps[i]?.t !== 'video') {
      bgm.current?.set(pendingBgm.current.track);
      pendingBgm.current = null;
    }
  }, [i, steps]);
  // the next stills are loaded ahead (QA 11 R33)
  useEffect(() => {
    for (let k = i + 1; k < Math.min(steps.length, i + 12); k++) {
      const s = steps[k];
      const img = s.t === 'still' || s.t === 'arrive' ? s.image : null;
      if (img) void loadStill(img);
    }
  }, [i, steps]);
  // the next theme is decoded ahead
  useEffect(() => {
    for (let k = i + 1; k < Math.min(steps.length, i + 30); k++) {
      const s = steps[k];
      // a motion's timed music cue too, so it starts on time (QA 8, R21)
      if (s.t === 'video' && s.bgmAt) {
        bgm.current?.prefetch(s.bgmAt.track);
        break;
      }
      if (s.t === 'bgm') {
        bgm.current?.prefetch(s.track);
        break;
      }
    }
  }, [i, steps]);
  useEffect(() => {
    if (sayNow) void voice.current?.say(sayNow.voice ?? sayNow.who, sayNow.text);
    else voice.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, started]);

  /** First tap: unlocks audio/video on iOS and starts (or resumes) the story inside the gesture. */
  const start = () => {
    setStarted(true);
    unlockSfx();
    voice.current?.unlock();
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
    const lastClock = before.find((s) => s.t === 'clock');
    if (lastClock?.t === 'clock') onClock?.(lastClock.on);
    const lastBack = before.find((s) => s.t === 'still' || s.t === 'video' || s.t === 'loop' || s.t === 'bgvideo' || s.t === 'black');
    const onStill = lastBack?.t === 'still';
    if (lastBack?.t === 'still') {
      // from black, once the picture is decoded (QA 12 R40: it came up in two or three frames); the motion behind is hidden
      const img = lastBack.image;
      dual.current?.pauseAll();
      void loadStill(img).then(() => {
        setStill(img);
        setReady(true);
      });
    }
    const lastSprite = before.find((s) => s.t === 'sprite' || s.t === 'video');
    if (lastSprite?.t === 'sprite') setSprite(lastSprite.image);
    // the invitation card stays up after it opened (until the next motion)
    const lastCard = before.find((s) => s.t === 'invitation' || s.t === 'video' || s.t === 'arrive');
    if (lastCard?.t === 'invitation') setInvite(true);
    const lastTicket = before.find((s) => s.t === 'ticket' || s.t === 'still' || s.t === 'video' || s.t === 'loop' || s.t === 'bgvideo' || s.t === 'black' || s.t === 'arrive');
    if (lastTicket?.t === 'ticket' && !lastTicket.stamp && !lastTicket.flip) {
      setTicketArt({ dest: lastTicket.dest });
      setReady(true);
    }
    // the thread starts again from the line on screen (or the question being answered)
    let q = i - 1;
    while (steps[q]?.t === 'label') q--;
    addLine(chatLine(cur, `s${i}`) ?? (steps[q] ? chatLine(steps[q], `s${q}`) : null));
    if (['video', 'bgvideo', 'black', 'bgm', 'loop', 'label', 'goto', 'still', 'sprite', 'whiteout', 'wait', 'se', 'fx', 'screen', 'pause', 'clock', 'branch', 'invitation'].includes(cur.t)) {
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

  // the second journey's next chapter, straight from 〔…へ向かう〕: the sound is already awake
  useEffect(() => {
    if (autoStart) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const next = () => {
    const st = steps[iRef.current];
    if (st?.t === 'say') markHeard(st.who, st.text);
    voice.current?.stop();
    fadeLongSfx();
    run(iRef.current + 1);
  };
  // M-R102: a first-time line moves on only after its voice (a tap meanwhile shows the rest of the words);
  // a line heard before goes any time; "声を待たずに進む" or the voices turned off lift the wait; core lines hold
  const sayStep = step?.t === 'say' ? step : null;
  // never stuck behind a voice that did not end: past the line's own length, the tap goes through
  const [waitOver, setWaitOver] = useState(false);
  useEffect(() => {
    setWaitOver(false);
    if (steps[i]?.t !== 'say') return;
    const t = setTimeout(() => setWaitOver(true), 4000 + (steps[i] as { text: string }).text.length * 260);
    return () => clearTimeout(t);
  }, [i, steps]);
  const mustWait = !!sayStep && talking && !waitOver && (!!sayStep.hold || (!noWait && mix.voice > 0 && !wasHeard(sayStep.who, sayStep.text)));
  const tapLine = () => {
    if (sayStep && !sayStep.hold && wasHeard(sayStep.who, sayStep.text)) return next();
    if (!reveal.current.done) return reveal.current.finish();
    if (mustWait) return;
    next();
  };

  const choose = (key: string, label: string, goto?: string) => {
    const a = { ...stateRef.current.answers, [key]: label };
    stateRef.current = { ...stateRef.current, answers: a };
    setAnswers(a);
    run(goto ? labelIndex(steps, goto) : iRef.current + 1);
  };

  const interactiveTap = step && (step.t === 'caption' || step.t === 'say' || step.t === 'letter' || step.t === 'notice' || step.t === 'arrive');
  // SYS-S001: only at a calm moment (a line, a button) — never while drawing, saving or paying
  const calm = step && ['caption', 'say', 'letter', 'notice', 'action', 'choice'].includes(step.t);
  const chatOn = !!(started && log.length > 0 && step && (chatLine(step, '') || ['action', 'choice', 'name', 'batiname', 'neoname'].includes(step.t) || (step.t === 'wait' && step.keepChat)));
  const chatEntries = log.map((e): ChatEntry => (e.kind === 'them' ? { ...e, name: speakerName(e.who, v), text: fill(e.text, v), avatar: e.who === 'バティ' && v.batiImage ? { src: v.batiImage } : (e.who === 'KIMORIN' && kimorinAvatar) || AVATARS[e.who] } : { ...e, text: fill(e.text, v) }));
  if (chatOn && step) lastChat.current = { entries: chatEntries, bottom: chatBottom(step) };
  useEffect(() => {
    if (chatWas.current && !chatOn) {
      setChatLeaving(true);
      const t = setTimeout(() => setChatLeaving(false), 320);
      chatWas.current = chatOn;
      return () => clearTimeout(t);
    }
    chatWas.current = chatOn;
    if (chatOn) setChatLeaving(false);
  }, [chatOn]);
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
    <MicAllowed.Provider value={!textOnly}>
    <div className="fixed inset-0 z-[100] select-none overflow-hidden bg-black text-white" style={{ fontFamily: SERIF }}>
      {/* motions and stills fill a phone the same way (cover); on wider screens (iPad) both sit whole over the blurred
          backdrop — the picture no longer changes size between a motion and a still (QA 5 N6) */}
      <style>{'.story-fit{object-fit:cover}@media (min-aspect-ratio: 9/16){.story-fit{object-fit:contain}}'}</style>
      {/* blurred backdrop so 9:16 motions fill wider screens (iPad) without cropping */}
      {backdrop && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={backdrop} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" aria-hidden />
      )}
      {/* the background layers move with the camera (〔カメラ：寄る／揺れ〕) */}
      <Camera move={cam?.move ?? null} focus={cam?.focus}>
      {/* double-buffered motion videos (see DualVideo) */}
      <div className="absolute inset-0 z-0">
        {[videoA, videoB].map((ref, k) => (
          <video
            key={k}
            ref={ref}
            className="story-fit absolute inset-0 h-full w-full"
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
      {/* to black at once, back from black softly (QA 11 R36) */}
      <div className={`pointer-events-none absolute inset-0 z-[4] bg-black transition-opacity ${blackout ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDuration: blackout ? `${blackFade}s` : '0.7s' }} aria-hidden />
      <div className={`pointer-events-none absolute inset-0 z-[7] bg-white transition-opacity duration-[2600ms] ease-in-out ${white ? 'opacity-100' : 'opacity-0'}`} aria-hidden />
      {/* the still before (during a cross-fade) and the still now, keyed by picture: the one before is the same <img>
          left in place, and a still's animation is set once, when it comes in (QA 10 R27) */}
      {[...(under && under.image !== still ? [under.image] : []), ...(still ? [still] : [])].map((img) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={img} src={stillUrl(img)} alt="" className="story-fit pointer-events-none absolute inset-0 z-[2] h-full w-full" style={img === still ? { animation: stillAnim } : undefined} aria-hidden />
      ))}
      <style>{'@keyframes stillIn{from{opacity:0}to{opacity:1}}'}</style>
      </Camera>
      {!sprite && autoStandee && (
        <Cast names={[autoStandee]} src={(n) => spriteSrc(n) ?? null} speaking={autoStandee} talking={talking} expressions={sayExpressions({}, [autoStandee])} level={voiceLevel} react={sayReact} slot={spriteSlot} />
      )}
      {sprite && (
        <Cast
          names={Array.isArray(sprite) ? sprite : [sprite]}
          src={(n) => spriteSrc(n) ?? null}
          speaking={speakerSprite(step?.t === 'say' ? step.who : prompt?.who, (Array.isArray(sprite) ? sprite : [sprite]).filter(Boolean))}
          talking={talking}
          expressions={sayExpressions(expressions)}
          level={voiceLevel}
          react={sayReact}
          slot={spriteSlot}
        />
      )}
      {smoke > 0 && <Smoke key={smoke} />}
      {motes > 0 && <Motes count={motes} />}
      {cutin && spriteSrc(cutin) && <CutIn key={cutin} url={spriteSrc(cutin)!} onDone={() => setCutin(null)} />}
      <FxLayer fx={fx} />
      <BluenaScreen open={screen} />
      {overlayCaption && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(18vh+env(safe-area-inset-bottom))] z-[6] flex animate-[fadeUp_0.8s_ease-out] justify-center">
          <Telop text={fill(overlayCaption, v)} />
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

      {started && step?.t === 'film' && (
        <button
          onClick={endFilm}
          className="absolute bottom-[calc(28px+env(safe-area-inset-bottom))] right-4 z-[60] rounded-full border border-white/30 bg-black/40 px-4 py-1.5 text-xs tracking-[0.3em] text-white/80 backdrop-blur"
          style={{ fontFamily: '"Shippori Mincho", serif' }}
        >
          スキップ
        </button>
      )}
      {/* tap layer for dialogue */}
      {/* the thread: a line is tapped through anywhere (the newest finishes typing first) */}
      {started && step && chatLine(step, '') ? (
        <button className="absolute inset-0 z-10 cursor-default" aria-label="つぎへ" onClick={tapLine} />
      ) : (
        started && interactiveTap && <TapLine key={i} step={step} vars={v} onNext={next} />
      )}
      {ticketArt && <TicketArt dest={ticketArt.dest} leaving={ticketArt.leaving} stamped={(id) => stampList.includes(id)} />}
      {invite && <Invitation inviter={v.inviter} message={v.inviterMessage} settled={step?.t !== 'invitation'} leaving={inviteLeaving} fromMotion={steps.slice(0, i + 1).reverse().find((x) => x.t === 'invitation')?.t === 'invitation' && (steps.slice(0, i + 1).reverse().find((x) => x.t === 'invitation') as { fromMotion?: boolean }).fromMotion} onOpened={() => run(iRef.current + 1)} />}
      {(chatOn || chatLeaving) && (
        // the thread and its shade fade out over 0.3 s when they go (QA 12 R35), with what they showed last
        <div className="pointer-events-none absolute inset-0 z-[10] transition-opacity duration-300" style={{ opacity: chatOn ? 1 : 0 }}>
          {/* a soft shade under the thread so it reads on any picture */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] animate-[fadeUp_0.6s_ease-out] bg-gradient-to-t from-black/75 via-black/35 to-transparent" aria-hidden />
          <ChatLog
            entries={chatOn ? chatEntries : lastChat.current.entries}
            talking={chatOn && talking}
            reveal={reveal}
            live={chatOn && step?.t === 'say' && !mustWait}
            bottom={chatOn && step ? chatBottom(step) : lastChat.current.bottom}
          />
        </div>
      )}

      {started && step?.t === 'action' && (
        <ReplyChips
          key={i}
          action
          options={[step.label]}
          onPick={() => {
            addLine({ id: `a${i}`, kind: 'me', text: step.label, action: true });
            next();
          }}
        />
      )}
      {started && step?.t === 'choice' && step.prompt && (
        <div className="pointer-events-none absolute inset-x-0 z-10 px-4" style={{ bottom: `calc(${step.options.length * 50 + 36}px + env(safe-area-inset-bottom))` }}>
          <DialogueWindow>{fill(step.prompt, v)}</DialogueWindow>
        </div>
      )}
      {started && step?.t === 'choice' && !step.voice && (
        <ReplyChips
          key={i}
          options={step.options.map((o) => o.label)}
          onPick={(k) => {
            addLine({ id: `c${i}`, kind: 'me', text: step.options[k].label });
            neoSays();
            choose(step.key, step.options[k].label, step.options[k].goto);
          }}
        />
      )}
      {started && step?.t === 'choice' && step.voice && (
        <VoiceChoice
          key={i}
          options={step.options.map((o) => o.label)}
          onPick={(k, words) => {
            // the words themselves stay in their own record (M-R169: D08-S007 quotes them)
            if (words) remember(`${step.key}Words`, words);
            addLine({ id: `c${i}`, kind: 'me', text: step.options[k].label });
            neoSays();
            choose(step.key, step.options[k].label, step.options[k].goto);
          }}
        />
      )}
      {started && step?.t === 'saturn' && (
        <SaturnLesson
          bati={v.bati || 'バティ'}
          neo={v.neo || v.name}
          inviter={v.inviter || 'ともだち'}
          inviterMessage={v.inviterMessage}
          batiImage={v.batiImage}
          food={v.batiFood}
          api={lessonApi ?? undefined}
          onDone={(made) => {
            // the day's kororins (their words) — Jupiter turns two of them into stickers tomorrow
            remember('f_d04_kororin', made.length ? 'try' : 'skip');
            remember('kororins', JSON.stringify(made));
            // the practice left through black: the story comes back up from it (QA 12 R38)
            setBlackout(true);
            run(iRef.current + 1);
          }}
        />
      )}
      {started && step?.t === 'jupiter' && lessonApi && (
        <JupiterLesson
          api={lessonApi}
          kororins={v.made?.kororins ?? []}
          neo={v.neo || v.name}
          bati={v.bati || 'バティ'}
          inviter={v.inviter || 'ともだち'}
          batiImage={v.batiImage}
          look={v.look}
          chibi={v.lookChibi}
          onDone={(stickers, atelier, sent) => {
            remember('stickers', JSON.stringify(stickers));
            remember('my_atelier', JSON.stringify(atelier));
            saveAtelier(atelier);
            remember('f_d05_tree_parts', atelier.parts.join('|').slice(0, 200));
            remember('f_d05_send', sent ? 'send' : 'keep');
            run(iRef.current + 1);
          }}
        />
      )}
      {started && step?.t === 'mercury' && lessonApi && (
        <MercuryLesson
          api={lessonApi}
          look={v.look}
          chibi={v.lookChibi}
          stickers={v.made?.stickers ?? []}
          neo={v.neo || v.name}
          bati={v.bati || 'バティ'}
          inviter={v.inviter || 'ともだち'}
          batiImage={v.batiImage}
          onDone={(song, island, sailed) => {
            remember('f_song_from', song ? 'made' : 'none');
            if (song) remember('song', JSON.stringify(song));
            remember('my_island', JSON.stringify(island));
            remember('f_d06_island_parts', islandCards(island).join('|'));
            saveIsland(island);
            remember('f_d06_sail', sailed ? 'sail' : 'keep');
            run(iRef.current + 1);
          }}
        />
      )}
      {started && step?.t === 'mars' && lessonApi && (
        <MarsLesson
          api={lessonApi}
          song={v.made?.song ?? null}
          stickers={v.made?.stickers ?? []}
          look={v.look}
          chibi={v.lookChibi}
          neo={v.neo || v.name}
          bati={v.bati || 'バティ'}
          inviter={v.inviter || 'ともだち'}
          batiImage={v.batiImage}
          onDone={(r) => {
            if (r.mv) remember('mv', JSON.stringify(r.mv));
            if (r.studio) {
              remember('my_studio', JSON.stringify(r.studio));
              remember('f_d07_studio_parts', r.studio.parts.join('|'));
            }
            remember('f_d07_send', r.sent ? 'send' : 'keep');
            remember('f_d07_screen', r.mv ? 'big' : 'pick');
            if (r.frame) remember('mars_frame', r.frame);
            run(iRef.current + 1);
          }}
        />
      )}
      {started && step?.t === 'venus' && (
        <VenusLesson
          standee={v.lookStandee}
          song={v.made?.song ?? null}
          mv={v.made?.mv ?? null}
          kororins={v.made?.kororins ?? []}
          neo={v.neo || v.name}
          inviter={v.inviter || 'ともだち'}
          deliver={lessonApi ? (b) => lessonApi.deliver(b) : undefined}
          onDone={(r) => {
            remember('f_d07v_show', r.shown ? 'dachi' : 'self');
            remember('f_d07v_mode', r.mode);
            run(iRef.current + 1);
          }}
        />
      )}
      {started && step?.t === 'l2' && (
        <L2Step
          key={i}
          what={step.what}
          vars={v}
          answers={answers}
          lessonApi={lessonApi}
          fill={(t) => fill(t, v)}
          onDone={(a) => {
            for (const [k, val] of Object.entries(a)) remember(k, val);
            run(iRef.current + 1);
          }}
        />
      )}
      {started && step?.t === 'batitalk' && (
        <BatiChat
          key={i}
          bati={v.bati ?? 'バティ'}
          neo={v.neo || v.name}
          image={v.batiImage}
          faces={v.batiFaces}
          first={!!step.first}
          spell={!!step.spell}
          me={v.look}
          onDone={() => {
            remember('f_d03_bati_talk', 'true');
            run(iRef.current + 1);
          }}
        />
      )}
      {started && step?.t === 'song' && (
        <SongShow key={i} src={MIKIE_DRILL.src} title={MIKIE_DRILL.title} poster="/onboarding/mikie.webp" lines={MIKIE_DRILL.lines} muted={muted} onDone={next} />
      )}
      {started && step?.t === 'made' && step.what === 'film' && <FilmReel made={v.made ?? {}} neo={v.neo || v.name} muted={muted} onDone={next} />}
      {started && step?.t === 'made' && step.what === 'mv' && (
        <button className="absolute inset-0 z-[12] flex flex-col items-center justify-center bg-black/55 px-4" onClick={next}>
          <div className="w-full max-w-lg animate-[fadeUp_0.6s_ease-out] rounded-xl border-[6px] border-[#2a2a2a] bg-black shadow-[0_0_80px_rgba(255,120,80,0.45)]">
            {v.made?.mv ? (
              <video src={v.made.mv.url} poster={v.made.mv.poster ?? undefined} autoPlay playsInline controls muted={muted} className="aspect-video w-full object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/onboarding/s/mars-frame-${answers.mars_frame ?? 'sunset'}.jpg`} alt="" className="aspect-video w-full object-cover" />
            )}
          </div>
          <span className="pb-safe absolute bottom-6 text-xs tracking-widest text-white/50">TAP</span>
        </button>
      )}
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
            // the egg chosen on the altar picks the Bati's body types (client decision 2026-10-25)
            await onEgg?.(food, /地球/.test(answers.egg ?? '') ? 'earth' : 'sun');
            remember('food', food);
            run(iRef.current + 1);
          }}
        />
      )}
      {started && step?.t === 'hatch' && (
        <HatchStep
          food={v.batiFood ?? ''}
          egg={(stateRef.current.answers.egg ?? v.story?.egg ?? '').includes('太陽') ? 'sun' : 'earth'}
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
        <MessageBar
          key={i}
          placeholder={step.placeholder}
          valid={nameCharsOk}
          note={(t) => <NameNote value={t} extra="名前は、あとでいつでも変えられます" />}
          onSend={async (n) => {
            await onNeoName?.(n);
            remember('neoName', n);
            addLine({ id: `n${i}`, kind: 'me', text: n });
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
          solved={step.open ? [...new Set([...solvedSeals, step.n])] : solvedSeals}
          fresh={step.n}
          onClose={() => {
            remember(step.open ? `open.${step.n}` : `seal.${step.n}`, '1');
            run(iRef.current + 1);
          }}
        />
      )}
      {started && step?.t === 'ticket' && (step.stamp || step.flip) && (
        <TicketCard
          stamps={stampList}
          fresh={step.stamp}
          flip={step.flip}
          onDone={() => {
            if (step.stamp) remember(`stamp.${step.stamp}`, '1');
            run(iRef.current + 1);
          }}
        />
      )}
      {started && step?.t === 'batiname' && (
        <MessageBar
          key={i}
          placeholder={step.placeholder}
          valid={nameCharsOk}
          note={(t) => <NameNote value={t} />}
          onSend={async (n) => {
            await onBatiName?.(n);
            remember('batiName', n);
            addLine({ id: `n${i}`, kind: 'me', text: n });
            run(iRef.current + 1);
          }}
        />
      )}
      {started && step?.t === 'name' && (
        <MessageBar
          key={i}
          placeholder={step.placeholder}
          initial={name}
          valid={nameCharsOk}
          note={(t) => <NameNote value={t} />}
          onSend={async (n) => {
            await onName(n);
            stateRef.current = { ...stateRef.current, name: n };
            setName(n);
            addLine({ id: `n${i}`, kind: 'me', text: n });
            run(iRef.current + 1);
          }}
        />
      )}

      {!started && i === 0 && steps[0]?.t === 'film' && steps[0].id === 'signal' && !gateSeen && <SealGate onOpen={start} />}
      {!started && !(i === 0 && steps[0]?.t === 'film' && steps[0].id === 'signal' && !gateSeen) && (
        <button className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black" onClick={start}>
          <span className="relative flex h-24 w-24 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-amber-200/20" />
            <span className="h-3 w-3 rounded-full bg-amber-100 shadow-[0_0_40px_12px_rgba(255,214,140,0.7)]" />
          </span>
          <span className="text-lg tracking-[0.3em] text-amber-100">{i === 0 ? '信号を受信する' : '続きから'}</span>
          <span className="text-xs tracking-[0.3em] text-white/40">音を出してお楽しみください</span>
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

      {started && knownSeals.length > 0 && step?.t !== 'seal' && step?.t !== 'riddles' && step?.t !== 'video' && step?.t !== 'whiteout' && <BookButton onClick={() => setBookOpen(true)} />}
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

      {started && step?.t !== 'video' && step?.t !== 'whiteout' && (
        <div className="pt-safe absolute right-3 top-3 z-40 flex gap-2">
          <IconButton icon="mixer" label="音の大きさ" onClick={() => setMixerOpen(true)} />
          <IconButton icon={muted ? 'mute' : 'sound'} label={muted ? '音を出す' : '音を消す'} onClick={() => setMuted((m) => !m)} />
        </div>
      )}
      {mixerOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setMixerOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <MixerPanel
              mix={mix}
              onChange={setMix}
              onClose={() => setMixerOpen(false)}
              noWait={noWait}
              onNoWait={(on) => {
                setNoWait(on);
                setNoWaitVoice(on);
              }}
            />
          </div>
        </div>
      )}
    </div>
    </MicAllowed.Provider>
  );
}

function TapLine({ step, vars, onNext }: { step: Step; vars: StoryVars; onNext: () => void }) {
  const text = step.t === 'caption' || step.t === 'say' || step.t === 'letter' || step.t === 'notice' ? fill(step.text, vars) : step.t === 'arrive' ? fill(step.caption, vars) : '';
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
        <div className="w-full max-w-sm animate-[fadeUp_0.5s_ease-out] text-center [word-break:keep-all]">
          <DialogueWindow>{text}</DialogueWindow>
        </div>
        <Cue />
      </button>
    );
  }

  // the inviter's own words: the invitation dims, the words come up in the middle
  if (step.t === 'caption' && step.when === 'inviterMessage') {
    const [words, from] = text.split('\u3000');
    return (
      <button className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 px-8 backdrop-blur-[3px]" onClick={() => onNext()}>
        <p className="animate-[subIn_2.6s_ease-out_both] text-center text-[19px] leading-relaxed tracking-[0.08em] text-amber-50 [word-break:keep-all]">{words}</p>
        {from && <p className="mt-3 animate-[subIn_2.6s_ease-out_0.4s_both] text-[13px] tracking-[0.3em] text-amber-200/80">— {from}</p>}
        <Cue />
      </button>
    );
  }

  // the day's title (「1日目」) goes on by itself: right after the opening film nobody knew a tap was wanted (client 2026-10-26)
  if (step.t === 'caption' && DAY_TITLE.test(text)) return <DayTitle text={text} onNext={onNext} />;
  if (step.t === 'caption' || step.t === 'arrive') {
    return (
      <button className="absolute inset-0 z-10 flex items-end justify-center pb-[calc(18vh+env(safe-area-inset-bottom))]" onClick={() => onNext()}>
        <div className="animate-[fadeUp_0.8s_ease-out]">
          <Telop text={text} />
        </div>
        <Cue />
      </button>
    );
  }

  const who = step.t === 'say' ? speakerName(step.who, vars) : '';
  return (
    <button className="absolute inset-0 z-10 flex items-end justify-center" onClick={tap}>
      <div className="pb-safe w-full px-0 pt-16">
        <div className="mb-5 animate-[fadeUp_0.25s_ease-out]">
          <DialogueWindow name={who} done={done}>
            {visible}
          </DialogueWindow>
        </div>
      </div>
    </button>
  );
}

/** under the message bar: names in hiragana, katakana or English (the voices read them right) */
function NameNote({ value, extra }: { value: string; extra?: string }) {
  const bad = !!value.trim() && !nameCharsOk(value);
  return <p className={`text-[11px] tracking-wide ${bad ? 'text-amber-200' : 'text-white/45'}`}>{bad ? 'ひらがな・カタカナ・英語で入れてね' : `ひらがな・カタカナ・英語で${extra ? `　${extra}` : ''}`}</p>;
}

function DayTitle({ text, onNext }: { text: string; onNext: () => void }) {
  useEffect(() => {
    const t = setTimeout(onNext, 2600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <button className="absolute inset-0 z-10 flex items-center justify-center" onClick={onNext}>
      <span className="animate-[subIn_2.6s_ease-out_both] text-3xl tracking-[0.5em] text-amber-100 drop-shadow-[0_0_18px_rgba(255,210,120,0.6)]" style={{ fontFamily: '"Shippori Mincho", serif' }}>
        {text}
      </span>
    </button>
  );
}

function Cue() {
  return (
    <span className="pb-safe absolute bottom-6 left-1/2 block h-4 w-4 -translate-x-1/2" aria-hidden>
      <svg viewBox="0 0 20 20" className="h-full w-full animate-[nextBob_1.2s_ease-in-out_infinite] drop-shadow-[0_0_6px_rgba(255,210,120,0.9)]">
        <path d="M3 5 L10 15 L17 5 L10 8 Z" fill="#f5d48a" />
      </svg>
    </span>
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
      <span className="sr-only">{motion}</span>
    </div>
  );
}
