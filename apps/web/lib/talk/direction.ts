import { ruleBeats } from '@obolo/shared';

/**
 * The directed scene (client review of M-R251, 2026-11-23: "like a TV drama, not a chat"): for every line of a story
 * scene in the row a small direction — which shot the camera takes and how the people move — derived from the line
 * itself, with an optional override the story team can write in a script line (`shot: 'reaction:MONBAN'`,
 * `move: 'enter-left'`). The vocabulary is documented in docs/story-direction.md; TalkScene plays it (camera and
 * blocking), the cinema of days 1–2 uses the same classification for its push-ins.
 */

/** the shots */
export const SHOTS = ['wide', 'two', 'mcu', 'reaction', 'push', 'punch'] as const;
export type Shot = (typeof SHOTS)[number];
/** the moves of the one speaking (or, with a target, of someone else) */
export const MOVES = ['enter-left', 'enter-right', 'exit-left', 'exit-right', 'turn', 'lean', 'hop', 'step-back'] as const;
export type Move = (typeof MOVES)[number];

export type Direction = {
  shot: Shot;
  /** who the shot is on (a reaction: the listener; else the speaker) — a TalkPerson id */
  on?: string;
  /** the shot after the words are out, held until the next line (a question's reaction) */
  after?: Shot;
  afterOn?: string;
  /** the camera arrives by a cut (a new speaker) or moves (the same speaker) */
  cut: boolean;
  /** the speaker's move */
  move?: Move;
  /** someone else's move (an override: 'enter-left:MONBAN') */
  moves?: Record<string, Move>;
  /** the back row reacts (a small nod / shrink) */
  stir?: boolean;
};

/** the override a script line may carry: shot 'mcu' | 'reaction:MONBAN' | 'two:KIMORIN' …, move 'lean' | 'enter-left:MONBAN' */
export type DirectionOverride = { shot?: string; move?: string };

/** what a line is like, from its bubble rules (ruleBeats: shape / in) and its punctuation */
export function lineKind(text: string): 'shout' | 'muse' | 'question' | 'joy' | 'shock' | 'plain' {
  const beats = ruleBeats(text);
  const t = text.trim();
  if (beats.some((b) => b.shape === 'burst' || b.in === 'slam') || /[！!]{2,}/.test(t)) return 'shout';
  if (/[！!][？?]|[？?][！!]/.test(t)) return 'shock';
  if (beats.some((b) => b.shape === 'cloud' || b.shape === 'whisper' || b.in === 'slow') || /^(…|‥){2}|(…|‥){2}[。]?$/.test(t)) return 'muse';
  if (/[？?]」?$/.test(t)) return 'question';
  if (/[！!]$/.test(t) && beats.some((b) => b.motion === 'hop' || b.face === 'smile')) return 'joy';
  return 'plain';
}

const parseShot = (s?: string) => {
  if (!s) return null;
  const [shot, on] = s.split(':');
  return (SHOTS as readonly string[]).includes(shot) ? { shot: shot as Shot, on: on || undefined } : null;
};
const parseMove = (s?: string) => {
  if (!s) return null;
  const [move, who] = s.split(':');
  return (MOVES as readonly string[]).includes(move) ? { move: move as Move, who: who || undefined } : null;
};

/**
 * The directions for a thread of lines, in order. Rules:
 *  - the first line of a scene (and the first after someone new comes in): wide
 *  - a shout (！！, a burst / slam bubble): punch — a quick push-in with a small shake; the back row stirs
 *  - a muse (……, a cloud / whisper bubble): push — a slow push-in on the speaker
 *  - a question (？): medium close-up on the speaker, then, once the words are out, a reaction shot of the listener;
 *    the speaker leans in
 *  - joy (！ with a smile): two-shot, the speaker hops; shock (！？): medium close-up, the speaker steps back
 *  - otherwise: a new speaker → medium close-up, the same speaker again → two-shot (they alternate)
 *  - never the same shot three times in a row (the third becomes a two-shot, or wide after two two-shots)
 *  - a new speaker → the camera cuts; the same speaker → it moves (and drifts slowly while they talk)
 * `listener`: whom they talk to (the one who spoke before, else you).
 */
export function directLines(lines: { id: string; who: string; text: string; override?: DirectionOverride }[], selfId = 'me'): Map<string, Direction> {
  const out = new Map<string, Direction>();
  const shots: Shot[] = [];
  let prevWho: string | null = null;
  let before: string | null = null;
  for (const [k, l] of lines.entries()) {
    const newSpeaker = l.who !== prevWho;
    const listener = (newSpeaker ? prevWho : before) ?? selfId;
    const listenTo = listener === l.who ? selfId : listener;
    const kind = l.who === selfId ? 'plain' : lineKind(l.text);
    let d: Direction;
    if (k === 0) d = { shot: 'wide', cut: true };
    else if (kind === 'shout') d = { shot: 'punch', cut: newSpeaker, stir: true };
    else if (kind === 'muse') d = { shot: 'push', cut: newSpeaker };
    else if (kind === 'question') d = { shot: 'mcu', cut: newSpeaker, move: 'lean', after: 'reaction', afterOn: listenTo };
    else if (kind === 'joy') d = { shot: 'two', cut: newSpeaker, move: 'hop', on: undefined };
    else if (kind === 'shock') d = { shot: 'mcu', cut: newSpeaker, move: 'step-back', stir: true };
    else d = { shot: newSpeaker ? 'mcu' : 'two', cut: newSpeaker };
    // your own lines: a two-shot of you and the one you answer (your figure is small in the corner otherwise)
    if (l.who === selfId && k > 0) d = { shot: 'two', cut: newSpeaker };
    // no shot three times running
    const n = shots.length;
    if (n >= 2 && shots[n - 1] === d.shot && shots[n - 2] === d.shot) d = { ...d, shot: d.shot === 'two' ? 'wide' : 'two' };
    // the story team's override
    const so = parseShot(l.override?.shot);
    if (so) d = { ...d, shot: so.shot, on: so.on, ...(so.shot === 'reaction' ? { after: undefined } : {}) };
    const mo = parseMove(l.override?.move);
    if (mo) {
      if (mo.who && mo.who !== l.who) d = { ...d, moves: { ...(d.moves ?? {}), [mo.who]: mo.move } };
      else d = { ...d, move: mo.move };
    }
    if (d.shot === 'two' && !d.on) d.on = listenTo;
    if (d.shot === 'reaction' && !d.on) d.on = listenTo;
    out.set(l.id, d);
    shots.push(d.shot);
    if (newSpeaker) {
      before = prevWho;
      prevWho = l.who;
    }
  }
  return out;
}

/** the camera numbers (one place to tune them): scale, how far toward the centre, how long the move, in ms */
export const CAMERA = {
  wide: { scale: 1, ms: 700 },
  two: { scale: 1.12, ms: 700 },
  mcu: { scale: 1.3, ms: 650 },
  reaction: { scale: 1.26, ms: 0 },
  push: { scale: 1.36, ms: 5200 },
  punch: { scale: 1.42, ms: 170 },
  /** how far the framed point is brought toward the middle of the screen (0 = stays, 1 = centred) */
  center: 0.7,
  /** where the face is put, from the top of the stage (0..1) — under the bubbles */
  faceAt: 0.3,
  /** the slow drift while one person talks: this much more scale over this long */
  drift: { scale: 1.035, ms: 7000 },
  /** reduced motion: at most this scale, no drift, no shake */
  reducedMax: 1.06,
} as const;
