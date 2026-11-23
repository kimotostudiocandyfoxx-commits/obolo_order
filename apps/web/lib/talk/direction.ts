import { ruleBeats } from '@obolo/shared';

/**
 * The directed scene (client review of M-R251, 2026-11-23: "like a TV drama, not a chat"): for every line of a story
 * scene in the row a small direction — which shot the camera takes and how the people move — derived from the line
 * itself, with an optional override the story team can write in a script line (`shot: 'reaction:MONBAN'`,
 * `move: 'enter-left'`). The vocabulary is documented in docs/story-direction.md; TalkScene plays it (camera and
 * blocking), the cinema of days 1–2 uses the same classification for its push-ins.
 */

/** the shots */
export const SHOTS = ['wide', 'two', 'mcu', 'reaction', 'push', 'punch', 'q3', 'side', 'ots'] as const;
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

/** which views of each person exist (lib/story/views.json): no back view → no over-the-shoulder for them */
export type ViewsAvailable = { back: Set<string>; side: Set<string>; q3: Set<string> };

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
  // 'ots:A>B': over A's shoulder… A speaks, B in the foreground (the listener); 'q3:A' a 3/4 cut on A
  if (shot === 'ots' && on?.includes('>')) {
    const [a, b] = on.split('>');
    return { shot: 'ots' as Shot, on: b || undefined, speaker: a || undefined };
  }
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
export function directLines(lines: { id: string; who: string; text: string; override?: DirectionOverride }[], selfId = 'me', views?: ViewsAvailable): Map<string, Direction> {
  const out = new Map<string, Direction>();
  const shots: Shot[] = [];
  // the angled cuts (3/4, side, over the shoulder): only in a two-person exchange or on an emotional beat, about one
  // line in four or five (never two of them within four lines)
  let lastAngle = -99;
  let angleTurn = 0;
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
    // a two-person exchange (the last lines go back and forth between these two) or an emotional beat (a muse, a
    // question): now and then an angled cut instead
    const pair = k >= 2 && lines[k - 1].who === listenTo && lines[k - 2].who === l.who;
    const emotional = kind === 'muse';
    if (k >= 2 && k - lastAngle >= 4 && (pair || emotional) && d.shot !== 'punch') {
      const order: Shot[] = ['side', 'q3', 'ots'];
      for (let t = 0; t < order.length; t++) {
        const pick = order[(angleTurn + t) % order.length];
        // over the shoulder needs the listener's back view; a 3/4 cut, a side cut fall back to the front figure
        if (pick === 'ots' && !(views?.back.has(listenTo) && listenTo !== selfId)) continue;
        if (pick !== 'q3' && emotional && !pair) continue;
        d = { ...d, shot: pick, on: pick === 'q3' ? undefined : listenTo, after: undefined, afterOn: undefined };
        angleTurn = (angleTurn + t + 1) % order.length;
        lastAngle = k;
        break;
      }
    }
    // no shot three times running
    const n = shots.length;
    if (n >= 2 && shots[n - 1] === d.shot && shots[n - 2] === d.shot) d = { ...d, shot: d.shot === 'two' ? 'wide' : 'two' };
    // the story team's override
    const so = parseShot(l.override?.shot);
    if (so) d = { ...d, shot: so.shot, on: so.on, ...(so.shot === 'reaction' || so.shot === 'ots' || so.shot === 'side' || so.shot === 'q3' ? { after: undefined } : {}) };
    const mo = parseMove(l.override?.move);
    if (mo) {
      if (mo.who && mo.who !== l.who) d = { ...d, moves: { ...(d.moves ?? {}), [mo.who]: mo.move } };
      else d = { ...d, move: mo.move };
    }
    if ((d.shot === 'two' || d.shot === 'side' || d.shot === 'ots') && !d.on) d.on = listenTo;
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
  /** 3/4: the speaker at 42% / 58% of the width (toward the one they face), the stage turned this many degrees */
  q3: { scale: 1.24, ms: 0, at: 0.42, turn: 7, figureTurn: 16 },
  /** side: the two at 34% / 66%, facing each other (a mirrored front figure where no side view exists) */
  side: { scale: 1.16, ms: 0, at: 0.34 },
  /** over the shoulder: the speaker back at 32% (0.72×), the listener seen from behind in front at 76% (1.55×, cut at the waist, soft, darker) */
  ots: { scale: 1, ms: 0, at: 0.32, far: 0.72, near: 1.55, nearAt: 0.76, drop: 1.05 },
  /** how far the framed point is brought toward the middle of the screen (0 = stays, 1 = centred) */
  center: 0.7,
  /** where the face is put, from the top of the stage (0..1) — under the bubbles */
  faceAt: 0.3,
  /** the slow drift while one person talks: this much more scale over this long */
  drift: { scale: 1.035, ms: 7000 },
  /** reduced motion: at most this scale, no drift, no shake */
  reducedMax: 1.06,
} as const;
