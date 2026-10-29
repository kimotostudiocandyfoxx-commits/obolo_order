/**
 * Story script engine types. The scripts themselves (day1.ts, later day2.ts …) are plain data so the
 * wording, order and motions can be changed without touching the player.
 *
 * Text placeholders: {name} = the name the visitor told OBOLON, {inviter} = who invited them, {age} = times round
 * the Sun, {neo} = the NEO name, {food} = the favourite food, {bati} = the Bati's name.
 */
import type { MotionId } from './media';

export type Speaker =
  | 'MONBAN'
  | 'OBOLON'
  | 'KIMORIN'
  | 'たこ焼きブラザー'
  | 'たこ焼きシスター'
  | '大根カイザー'
  | 'フリージー'
  | 'ヒポキン'
  | 'ロングG'
  | 'ハットG'
  | 'ボスG'
  | 'バティ'
  | 'うんちピンポンくん'
  | 'コロリン'
  /** a voice not seen yet (（声）「おい。」) */
  | '？？？';

/** Synthesised sound effects (lib/story/sfx.ts presets). */
export type SoundFx =
  | 'sparkle' | 'chime' | 'bell' | 'gong' | 'magic' | 'whoosh' | 'pop' | 'boing' | 'knock' | 'ding' | 'heartbeat' | 'blip' | 'thud'
  // recorded-style sounds made for the story (2026-10-25); without their file they fall back to the nearest preset
  | 'gate-close' | 'smoke' | 'rocket' | 'crackers' | 'egg-crack' | 'paper' | 'stamp' | 'footsteps' | 'portal'
  // a planet's arrival fanfare and the riddle-book sting (ACE-Step, 2026-10-27)
  | 'arrive' | 'riddle'
  // the client's own Pinpon 2.5 press (M-R128): it rings on behind the lines and fades on the next tap; muffled from inside the egg
  | 'pinpon' | 'pinpon-muffled'
  // the 'it clicked' sting under a 〔ピンとくる〕 cut-in (synthesised, 2026-10-29)
  | 'pin';

/** Picture effects drawn over the background ('fx' steps). */
export type PictureFx =
  /** Saturn: KIMORIN⭐︎'s kororin (a takoyaki with KIMORIN's face) */
  | 'kimorin-kororin'
  /** Saturn: the residents' kororins circle the sky as a ring */
  | 'ring'
  /** …one falls down to your feet */
  | 'ring-drop'
  /** …and gets a ☆ (the count is never shown) */
  | 'ring-star';

export type Step =
  /**
   * Play a motion once. Cannot be skipped; the last frame stays on screen afterwards.
   * `captions` appear on top while it plays (seconds from the start of the motion; no tap needed).
   */
  /** bgmAt: the music changes at a moment of the motion (MONBAN steps out of the smoke ~7 s in: QA 7 U1) */
  | { t: 'video'; motion: MotionId; captions?: TimedCaption[]; bgmAt?: { track: string; at: number } }
  /** Switch background music (crossfade). null = fade out. Continues immediately. */
  | { t: 'bgm'; track: string | null; /** null + fade: a slow fade-out over this many seconds */ fade?: number }
  /**
   * Play a motion once IN THE BACKGROUND and continue immediately, so the dialogue can be read while
   * it plays. `then` motions follow automatically when it ends; the last one holds its final frame.
   * Still unskippable: there are no controls, the dialogue just runs on top of it.
   */
  | { t: 'bgvideo'; motion: MotionId; then?: MotionId[] }
  /**
   * Show a character image (transparent PNG/WebP in public/onboarding, e.g. "kimorin-1") standing in
   * front of the background motion; it stays until the next sprite step, null, or a blocking video.
   */
  | { t: 'sprite'; image: string | string[] | null }
  /** Still background image (public/onboarding/<image>.jpg) for scenes without a motion yet. */
  /** fade: seconds to cross-fade from the still before (it stays underneath meanwhile), e.g. OBOLON's eyes narrowing (QA 9 R23) */
  | { t: 'still'; image: string; fade?: number }
  /**
   * Saturn: the story's kororin lesson on top of the real world (ころりんぱ) — listen, drop your own voice
   * to your own room (or skip), the sister's sunset kororin. Saves answers.f_d04_kororin (try/skip).
   */
  | { t: 'saturn' }
  /** Jupiter (day 4): two of the kororins become stickers → sticker book → sticker butterflies. Saves answers.stickers. */
  | { t: 'jupiter' }
  /** Mercury (day 5): one sticker becomes a song (lyrics → touch up → feel → sung); its jacket spins. Saves answers.song. */
  | { t: 'mercury' }
  /** Mars (day 6): the song gets an MV from the visitor's wish; kept in the 裏スタジオ. Saves answers.mv. */
  | { t: 'mars' }
  /** Venus (day 7, draft 21): the easy DJ — practice rhythm → your song, a kororin at the seam, 〔🎤 見せる〕. Saves answers.f_d07v_show. */
  | { t: 'venus' }
  /** Show what was made: the MV on Mars's big screen, … (tap to continue). */
  | { t: 'made'; what: 'mv' | 'film' }
  /** the second journey's screens (components/lap2/L2Screen.tsx); what they decide joins the answers */
  | { t: 'l2'; what: import('./lap2').L2What }
  /** a song played whole over a poster with its lines (L2-MARS-S001 『MIKIE⭐︎ドリル』, M-R134); 〔スキップ〕 at the corner */
  | { t: 'song'; id: 'mikie-drill' }
  /** 〔💬 バティに聞く〕: the chat with Bati (D03-S008 first, later on the Moon); `first` shows the how-to and the free first picture */
  | { t: 'batitalk'; first?: boolean; /** Obolo Order (L2 Moon, M-R166): 〔📖 記す〕 under answers */ spell?: boolean }
  // --- the stage's directions (production UI 3, 2026-10-15) ---
  /** 〔カメラ：寄る／引く／揺れ〕 on the background; `focus` = where it moves in ("50% 30%") */
  | { t: 'cam'; move: 'in' | 'out' | 'shake'; focus?: string }
  /** 〔表情：驚き〕 a character's expression (its picture name on stage) */
  | { t: 'face'; who: string; expr: string }
  /** 〔カットイン：MONBAN〕 */
  | { t: 'cutin'; who: string }
  /** 〔ピンとくる〕 (client 2026-10-29): a wide picture flashes across the screen with its sound, then the story goes on by itself */
  | { t: 'spark'; image: string; sound?: SoundFx }
  /** 〔登場：煙〕 the "appearance" pattern: smoke wells up, the character stands there (added to the cast) */
  | { t: 'enter'; who: string; fx?: 'smoke' | 'light' }
  /** 〔移動：惑星到着〕〔テロップ：到着〕 the "arrival" pattern: the new place fades in under a title (tap) */
  | { t: 'arrive'; image: string; caption: string }
  /** Day 1: the seal glows, the envelope bursts into light, the invitation card rises (words set in code) */
  | { t: 'invitation'; /** the motion before ends on the blank card: the words just seep in */ fromMotion?: boolean }
  /** gold motes drifting up (0 = none; at most 150) */
  | { t: 'motes'; count: number }
  /** Fade the whole screen to white (~3 s), then continue; the next still/motion fades in from white. */
  | { t: 'whiteout' }
  /** Let a moment play before the next step (e.g. the Earth comes up before KIMORIN gasps). */
  /** keepChat: the line before stays on screen meanwhile (a silent reaction to it, QA 10 R29) */
  | { t: 'wait'; s: number; keepChat?: boolean }
  /** Cut to a black screen (until the next motion appears) and continue immediately. */
  /** fade: seconds to darken (〔暗くフェード〕), the story waits until it is black (QA 12 R39); none = a cut (〔暗転〕) */
  | { t: 'black'; fade?: number }
  /** Start a looping background motion and continue immediately. */
  | { t: 'loop'; motion: MotionId }
  /** テロップ: a short line in the middle of the screen (e.g. "MONBANが現れた"). Never spoken. Tap to continue. */
  /** a title; `when`: only if that story value is there (e.g. the inviter's words) */
  | { t: 'caption'; text: string; when?: 'inviterMessage' }
  /** 〔画面：…〕 a short guidance note about how something works (e.g. the riddle book). Tap to continue. */
  | { t: 'notice'; text: string }
  /** Character line. Tap to continue. */
  /**
   * A luxury film (M-R90, client 2026-10-26): silent parts played one after another with the film's sound on
   * the music channel; 〔スキップ〕 at the corner; once watched (or skipped) it does not play again.
   */
  | { t: 'film'; id: string; parts: number }
  | {
      t: 'say';
      who: Speaker;
      text: string;
      /** whose voice speaks it, when the name on screen hides them (「？？？」) */
      voice?: Speaker;
      /** a line that is never tapped through before its voice ends, even heard before (OBOLON's core lines, M-R102) */
      hold?: boolean;
    }
  /** A single button the visitor must press ("封を開く"). */
  | { t: 'action'; label: string }
  /**
   * Several buttons. The answer is saved under `key`; `goto` jumps to a label. `prompt` is shown above
   * the buttons (a confirmation, e.g. "この姿と名前を…保存します").
   */
  | { t: 'choice'; key: string; options: { label: string; goto?: string }[]; prompt?: string; /** answered by voice (big 〔🎙〕, ⌨ in the corner: M-R169) */ voice?: boolean }
  /** Name input (Day 1: creates the account from the invitation). */
  | { t: 'name'; placeholder: string; submit: string }
  /** Day 1: how many times you went round the Sun (age, optional). 「言わない」 jumps to `skip`. Saved as answers.age. */
  | { t: 'age'; skip: string }
  /** Day 2: the name as an OBOLO NEO ({neo}); it becomes the display name. */
  | { t: 'neoname'; placeholder: string; submit: string }
  /** Day 1: the eight riddle cards rise in a ring, 1・7・8 get their words, and they become the riddle book. */
  | { t: 'riddles' }
  /**
   * The riddle book opens and card `n` gets its words (day 3: 2 「Obolo Orderは全員……」). `open`: its
   * answer opens too (day 7 at the Sun: 2 「DJ」, 1 「oboloは、町の名前」, 4 「ナガレ」).
   */
  | { t: 'seal'; n: number; open?: boolean }
  /**
   * The space ticket with its four stamp slots; `stamp` presses that planet's stamp, `flip` shows the star map on the back
   * (both wait for a tap). With neither it is the scene itself — `dest` its 本日の目的地 — and stays until the next scene.
   */
  | { t: 'ticket'; stamp?: 'saturn' | 'jupiter' | 'mercury' | 'mars' | 'venus'; flip?: boolean; dest?: string }
  /** The day's 88 minutes (M-R22): on from the first rocket departure, off in the temples of Earth and the Moon. */
  | { t: 'clock'; on: boolean }
  /** Bluena projects (open) or closes the square screen: MONBAN at the HQ gate. */
  | { t: 'screen'; open: boolean }
  /** A sound effect (synthesised). Continues immediately. */
  | { t: 'se'; sound: SoundFx }
  /** A picture effect over the background (null = clear). Continues immediately. */
  | { t: 'fx'; fx: PictureFx | null }
  /** Ends the day here (「やめておく」, Day 2). The next visit starts again at the label `resume`. */
  | { t: 'pause'; resume: string }
  /** Choose one of the eight OBOLO NEO forms (Day 3). Saved on the account. Fallback for 'look'. */
  | { t: 'neo' }
  /** Day 2: OBOLON's questions / own words or a picture / おまかせ → the water basin's four looks → choose one. */
  | { t: 'look' }
  /** The favourite food → the Bati (Day 2: the food is given to the egg on the altar). */
  | { t: 'egg'; submit?: string }
  /** The egg hatches (the Bati image is generated meanwhile). */
  | { t: 'hatch' }
  /** Name the newborn Bati. */
  | { t: 'batiname'; placeholder: string; submit: string }
  /**
   * The Eclipse day (7): the payment (¥88/month, Stripe inside the story). Continues once paid;
   * "もう少し考える" jumps to the `cancel` label.
   */
  | { t: 'order'; cancel: string }
  /** A handwritten-style letter card. Tap to continue. */
  | { t: 'letter'; text: string }
  /**
   * Go to a label by an earlier day's answer (Me.story, e.g. "d1.f_d01_talk"): `cases` maps answers to
   * labels, `otherwise` is the label for anything else (or no answer).
   */
  | { t: 'branch'; key: string; cases: Record<string, string>; otherwise: string }
  | { t: 'label'; id: string }
  | { t: 'goto'; id: string }
  | { t: 'end' };

export interface TimedCaption {
  text: string;
  /** seconds into the motion */
  from: number;
  /** seconds into the motion; omitted = until the motion ends */
  to?: number;
}

export interface StoryVars {
  name: string;
  /** The inviter's own words on the invitation ({inviter_message}); empty = not shown. */
  inviterMessage?: string;
  /** Times round the Sun ({age}). */
  age?: string;
  /** KIMORIN is shown as "KIMORIN⭐︎" (his NEO name, from the Moon's naming on). */
  kimorinStar?: boolean;
  /** Earlier days' answers ("d1.choice1" …), for 'branch' steps and {choice1}. */
  story?: Record<string, string>;
  /** What earlier days made (kororins → stickers → song → MV): lib/onboarding/made.ts. */
  made?: import('./made').Made;
  inviter: string;
  /** Name of the chosen OBOLO NEO form ({neo}). */
  neo?: string;
  /** The Bati's name ({bati}) and pictures used by the '@bati' / '@egg' / '@me' sprites. */
  bati?: string;
  batiImage?: string;
  /** Bati's expressions (M-R139): { t: 'face', who: '@bati', expr: 'smile' } shows one; missing → batiImage */
  batiFaces?: Partial<Record<string, string>>;
  batiFood?: string;
  look?: string;
  /** the small chibi NEO (M-R155/M-R161): the butterfly, the owl, the captain… */
  lookChibi?: string;
  /** the visitor standing, without a background (M-R149): behind the DJ deck on Venus (R21b) */
  lookStandee?: string;
}

export function fill(text: string, v: StoryVars): string {
  return text
    .replaceAll('{name}', v.name || '…')
    .replaceAll('{inviter_message}', v.inviterMessage || '')
    .replaceAll('{inviter}', v.inviter || '…')
    .replaceAll('{neo}', v.neo || '…')
    .replaceAll('{bati}', v.bati || 'バティ')
    .replaceAll('{food}', v.batiFood || '…')
    .replaceAll('{age}', v.age || '…')
    .replaceAll('{choice1}', v.story?.['d1.choice1'] || '…');
}

/** The name shown on a line: the Bati's own name, KIMORIN⭐︎ after his naming. */
export function speakerName(who: Speaker, v: StoryVars): string {
  if (who === 'バティ') return v.bati || 'バティ';
  if (who === 'KIMORIN' && v.kimorinStar) return 'KIMORIN⭐︎';
  return who;
}

export function labelIndex(steps: Step[], id: string): number {
  const i = steps.findIndex((s) => s.t === 'label' && s.id === id);
  if (i < 0) throw new Error(`unknown label ${id}`);
  return i;
}

/** The media that should be on screen at step i (for resuming mid-story). null = black screen. */
export function mediaAt(steps: Step[], i: number): { motion: MotionId; loop: boolean } | null {
  for (let k = Math.min(i, steps.length - 1); k >= 0; k--) {
    const s = steps[k];
    if (s.t === 'black') return null;
    if (s.t === 'video' || s.t === 'loop') return { motion: s.motion, loop: s.t === 'loop' };
    if (s.t === 'bgvideo') return { motion: s.then?.length ? s.then[s.then.length - 1] : s.motion, loop: false };
  }
  return null;
}

/** The BGM track that should be playing at step i (for resuming mid-story). */
export function bgmAt(steps: Step[], i: number): string | null {
  for (let k = Math.min(i, steps.length - 1); k >= 0; k--) {
    const s = steps[k];
    if (s.t === 'bgm') return s.track;
    // a motion before this step that brought its music in partway (`bgmAt`); the motion at `i` itself cues it when it plays
    if (s.t === 'video' && s.bgmAt && k < i) return s.bgmAt.track;
  }
  return null;
}
