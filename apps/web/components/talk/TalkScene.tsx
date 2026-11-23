'use client';

import { ruleBeats, talkChunks, talkPlain, talkRuns, talkSentences, type TalkMark, type TalkIn, type TalkShape, type MarkedKind, type TalkBeat, type TalkFace, type TalkLook, type TalkMotion } from '@obolo/shared';
import { holdProps, StarButton } from '@/components/finds/MarkRing';
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Figure, TALK_CSS, type FigureState } from './Figure';
import { AppThreads, HereThreads, type TalkThread } from './TalkThreads';
import type { SpiralRow } from '@/components/finds/SpiralList';
import { SELF_TONES, TONES, toneOf, type TalkTone } from '@/lib/talk/looks';
import { CAMERA, type Direction, type Move } from '@/lib/talk/direction';
import { Subtitle, SubtitleScrim, SUBTITLE_CSS, subtitleStyle } from '@/components/story/Subtitle';
import { unlockAudio } from '@/lib/onboarding/audio';
import { playClip, stopClip, type Clip } from '@/lib/voice/webVoice';

const MUTE_KEY = 'obolo.talk.muted';

/**
 * 隣に並ぶトーク (M-R232〜M-R242, docs/story-rewrite/会話の画面.md, design/talk/proto.html): only the two standing side by
 * side low on the screen (you always at the right) with the place behind them, and at most two bubbles over their heads
 * (the newest lower, its tail toward its speaker). No ring, no circles (M-R241). Expressions and poses change with the
 * words, sentence by sentence (M-R238/M-R240); the camera moves in toward the one speaking (M-R242). Going back: dragging
 * down brings the past bubbles down one by one and both stand as they were then; 〔いまに戻る〕 comes back. A long bubble
 * scrolls inside; a card sits small in its bubble and opens big on a tap. Three or more: everyone in one row (you at the
 * right end), up to five full length, six or more chest up in two rows; the one speaking steps forward and glows; the
 * group's name and count small at the top.
 */
export type TalkPerson = {
  id: string;
  name: string;
  look: TalkLook | null;
  color: string;
  self?: boolean;
  /** a round icon for the small face (else the look's head is cut round) */
  avatar?: string | null;
  /** M-R245: the bubble colour (fixed per person); none = from `color` (you: 月光パール, {bati}: はちみつ, a dachi: セージ) */
  tone?: TalkTone;
  /** heard, not standing in the row (a voice from off the screen, 「？？？」): their bubbles only */
  offstage?: boolean;
  /** the figure's size in the row (a small round character stands smaller); 1 = the row's height */
  scale?: number;
  /** where their head is, down from the top of the row's height (0..1; default 0.16, the talk looks' headroom) */
  headAt?: number;
  /**
   * stands in the back row (the story, M-R251 review: the front row holds the one speaking, the one they talk to and
   * you; everyone else stands behind them at about 80%, a little darker, until they speak)
   */
  back?: boolean;
  /** other views of this person (lib/story/views.json): seen from behind, from the side and at 3/4 (both facing left) */
  views?: { back?: string; side?: string; q3?: string };
};

/** the row camera (TalkScene onCamera / the 'obolo:camera' event) */
export type TalkCamera = { x: number; y: number; scale: number; originX: number; originY: number; turn: number; ms: number; stageBottom: number; stageHeight: number };

export type TalkItem = {
  id: string;
  /** the directed scene (lib/talk/direction.ts): the shot and the moves for this line; none = the plain talk camera */
  direction?: Direction;
  /** a TalkPerson id */
  who: string;
  text: string;
  /** shown instead of the person's name (a story line by someone else) */
  name?: string;
  /** a single face for the whole line (else the sentences' faces, else the rules from the words) */
  face?: TalkFace;
  motion?: TalkMotion;
  /** M-R238: each sentence's face and motion (they switch as the words come out) */
  faces?: TalkBeat[];
  /** a work / picture card: small in the bubble, big on a tap */
  card?: { thumb: ReactNode; full?: ReactNode; label?: string };
  /** a voice message: a play button in the bubble (the speaker's mouth moves while it plays) */
  voice?: { url: string | null; seconds: number | null };
  chips?: { label: string; onPick: () => void; disabled?: boolean }[];
  /** under the words: the pages looked up, a map, a note */
  extra?: ReactNode;
  /** still being written (streaming) */
  live?: boolean;
  /** M-R236: where its ★ / mark is kept (a small ★ at the bubble's / コロリン's top right; a long press opens the ring) */
  mark?: { kind: MarkedKind; id: string };
  /** a named pose of the speaker's look for this line (TalkLook.named: a story character's painted gesture) */
  pose?: string;
};


/**
 * a line being said: its words come out on a timeline (`times[i]` = ms when the i-th character shows), sentence by
 * sentence at each sentence's pace (M-R243, the prototype: 60 ms a character, 34 for a slam, 105 for a slow one; a
 * longer stop at 、。！？…, and 0.65 s between sentences); `cuts` = where each sentence ends (characters of the plain words)
 */
type Speech = { id: string; who: string; start: number; dur: number; len: number; cuts: number[]; times: number[]; beats: TalkBeat[]; typed: boolean; mouth: boolean; text: boolean; level?: () => number; clip?: Clip };
function speechOf(it: TalkItem, beats: TalkBeat[], streamed: boolean): Speech {
  const plain = [...talkPlain(it.text)];
  const len = plain.length;
  const parts = talkSentences(it.text);
  const flat = plain.join('');
  let from = 0;
  const cuts = parts.map((p) => {
    const i = flat.indexOf(p, from);
    from = (i < 0 ? from : i) + p.length;
    return [...flat.slice(0, from)].length;
  });
  const times: number[] = [];
  let t = 0;
  let k = 0;
  for (let i = 0; i < len; i++) {
    while (k < cuts.length - 1 && i >= cuts[k]) {
      k++;
      t += 650;
    }
    const pace = beats[Math.min(k, beats.length - 1)]?.in;
    const prev = plain[i - 1] ?? '';
    t += /[、。！？…!?]/.test(prev) ? (pace === 'slow' ? 380 : 210) : pace === 'slow' ? 105 : pace === 'slam' ? 34 : 60;
    times.push(t);
  }
  const dur = streamed ? Math.max(900, parts.length * 900) : Math.max(900, t + 250);
  return { id: it.id, who: it.who, start: Date.now(), dur, len, cuts, times, beats, typed: !streamed, mouth: !streamed, text: len > 0 };
}
/** M-R244: one bubble of an utterance (its words as written, where they start among the plain characters, its sentences) */
type Unit = { key: string; item: TalkItem; text: string; first: boolean; last: boolean; from: number; len: number; s0: number; s1: number; beats: TalkBeat[] };
function unitsOf(it: TalkItem, beats: TalkBeat[]): Unit[] {
  if (!it.text) return [{ key: it.id, item: it, text: '', first: true, last: true, from: 0, len: 0, s0: 0, s1: 1, beats }];
  const chunks = talkChunks(it.text, beats);
  let from = 0;
  return chunks.map((c, k) => {
    const len = [...talkPlain(c.text)].length;
    const u = { key: chunks.length > 1 ? `${it.id}#${k}` : it.id, item: it, text: c.text, first: k === 0, last: k === chunks.length - 1, from, len, s0: c.from, s1: c.to, beats: beats.slice(c.from, c.to) };
    from += len;
    return u;
  });
}
/** how many characters are out after `ms` */
const charsAt = (sp: Speech, ms: number) => {
  if (!sp.typed) return Math.floor((ms / sp.dur) * sp.len);
  let n = 0;
  while (n < sp.times.length && sp.times[n] <= ms) n++;
  return n;
};
/** the prototype's glass round button (design/talk/proto.html .ib) */
const GLASS = 'relative grid h-[42px] w-[42px] flex-none place-items-center rounded-full border border-[rgba(210,220,255,.22)] bg-[rgba(16,22,64,.46)] text-[#f4f1ff] backdrop-blur-[10px]';
const PILL = 'rounded-full border border-[rgba(210,220,255,.22)] bg-[rgba(16,22,64,.6)] px-5 py-2 text-[13px] font-bold text-[#f4f1ff] backdrop-blur-[10px]';
/** the story's own bubbles (Mincho, dark glass with a gold line, yours in gold): its scenes keep their world in the row */
export type TalkSkin = 'app' | 'story';
const SkinCtx = createContext<TalkSkin>('app');
export const STORY_SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
const STORY_THEM: TalkTone = { id: 'story', name: 'story', a: 'rgba(40,30,60,.86)', b: 'rgba(16,11,27,.9)', line: 'rgba(240,205,140,.42)', ink: '#f8f2e6' };
const STORY_ME: TalkTone = { id: 'story-me', name: 'story-me', a: '#fbe9b7', b: '#dca552', line: '#c98f3a', ink: '#2b1b06' };
export const TALK_FONT = "'Zen Maru Gothic','Hiragino Maru Gothic ProN','Yu Gothic',system-ui,sans-serif";
const LONG = 70;

const reducedQuery = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function TalkScene({
  people,
  items,
  thinking,
  listening = false,
  place,
  group,
  composer,
  keyboard = false,
  top = 8,
  fixedSelfFace = false,
  audioSrc,
  onPlayingChange,
  unreadFrom,
  loading = false,
  onRing,
  bar,
  hint = true,
  askTone = false,
  onTone,
  onTap,
  voice,
  noMute = false,
  dock,
  transparent = false,
  stageStyle,
  tapThrough = false,
  skin = 'app',
  lines = 'bubbles',
  selfName,
  plate,
  onCamera,
}: {
  people: TalkPerson[];
  items: TalkItem[];
  /** who is making a reply (the 'thinking' face and a slow sway) */
  thinking?: string | null;
  /** you are recording or typing: the others turn to you and nod */
  listening?: boolean;
  /** the place behind them (an image URL); none = what is behind the talk */
  place?: string;
  group?: { name: string; count: number };
  composer?: ReactNode;
  /** the keyboard is up: chest up and moved up */
  keyboard?: boolean;
  /** px kept free at the top (the shell's buttons) */
  top?: number;
  /** M-R234 「表情を変えない」 */
  fixedSelfFace?: boolean;
  audioSrc?: (url: string) => Promise<string | null>;
  onPlayingChange?: (playing: boolean) => void;
  /** M-R239: the first unread line (opening plays the last read one and every unread one); none = nothing unread */
  unreadFrom?: number | null;
  /** the lines are still being loaded (what is there when they come counts as already said) */
  loading?: boolean;
  /** M-R236: a long press on a line (its ★ / mark ring) */
  onRing?: (item: TalkItem, at: { x: number; y: number }) => void;
  /** the top bar (glass buttons): the conversations (or 〔過去の言葉〕), the partner's name, the mute and Bluena */
  bar?: {
    title: ReactNode;
    /** the shell's left drawer (the conversations); none = this talk's own drawer of what was said */
    onList?: () => void;
    onBluena?: () => void;
    onBack?: () => void;
    unread?: boolean;
    left?: ReactNode;
    right?: ReactNode;
    /** at the top of this talk's own drawer (settings, the looks …) */
    drawer?: ReactNode;
    /** this talk's own drawer: 'app' = the signed-in app's threads (choosing one goes to the atelier); else the threads given */
    threads?: 'app' | { list: TalkThread[]; current: string; days?: (thread: string) => SpiralRow[] };
  };
  /** 「画面を押すと、次の言葉へ進みます」 while lines are played in a row */
  hint?: boolean;
  /** M-R245: show the one-time picker of your bubble colour */
  askTone?: boolean;
  onTone?: (id: string) => void;
  /** a tap while nothing is being said (the story goes on to its next step) */
  onTap?: () => void;
  /** a voice played outside (the story's line voices): whose mouth moves, and its loudness */
  voice?: { who: string | null; level?: () => number };
  /** the page has its own mute button */
  noMute?: boolean;
  /** px kept free at the bottom (the answers under the talk); default 110 (64 with the keyboard) */
  dock?: number;
  /** no background of its own: the scene behind shows through (the story's stills and motions) */
  transparent?: boolean;
  /** on the row of people (the story's vanish) */
  stageStyle?: React.CSSProperties;
  /** a tap on a bubble is a tap on the screen (the story: it goes on; no replay, no opening) */
  tapThrough?: boolean;
  /** the bubbles' look: the app's (default) or the story's own */
  skin?: TalkSkin;
  /** 'subtitles': the story's lines as film subtitles at the lower third, no bubbles ("bubbles = chat, subtitles = story") */
  lines?: 'bubbles' | 'subtitles';
  /** your name over your subtitles (else 「あなた」) */
  selfName?: string;
  /** a background plate made for the row (lib/onboarding/plates.ts): its floor at the row's ground line, moved by the camera with the row */
  plate?: { src: string; floorY: number; aspect: number };
  /**
   * the row camera now (the directed scene), for layers that follow it with parallax (the ambient sky and dust): x / y
   * the shift in px, scale, the point it scales about (px from the stage's top-left), its move in ms. Also sent as the
   * window event 'obolo:camera'.
   */
  onCamera?: (c: TalkCamera) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 390, h: 700 });
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    // a moment with no size (the talk hidden behind a full-screen step, a page in the background) is not a size: the
    // last real one stays (else the row collapsed to nothing and stayed so — M-R251 review playthroughs)
    const measure = () => {
      const w = el.clientWidth || window.innerWidth;
      const h = el.clientHeight || window.innerHeight;
      if (w > 0 && h > 0) setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(reducedQuery()), []);

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  // each standing picture's width / height (to keep a wide one inside the screen)
  const [aspects, setAspects] = useState<Record<string, number>>({});
  const standKey = people.map((p) => p.look?.stand ?? '').join('|');
  useEffect(() => {
    for (const p of people) {
      const u = p.look?.stand;
      if (!u || aspects[u]) continue;
      const im = new Image();
      im.onload = () => setAspects((a) => ({ ...a, [u]: im.naturalWidth / im.naturalHeight }));
      im.src = u;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standKey]);
  const self = people.find((p) => p.self);
  const others = people.filter((p) => !p.self && !p.offstage);
  // M-R249: no look of yours yet (day 1 until the look is made on day 2's Moon) — first person: you are not shown, the
  // partners stand in the middle facing you, your words come from the bottom right with the tail off the screen toward you
  const firstPerson = !!self && !self.look;
  const row = self && !firstPerson ? [...others, self] : others;
  // the moment your look is made: you step in beside the partner for the first time (light gathering into you, ~1.1 s)
  const wasFirst = useRef(firstPerson);
  const [arriving, setArriving] = useState(false);
  useEffect(() => {
    const was = wasFirst.current;
    wasFirst.current = firstPerson;
    if (!was || firstPerson) return;
    setArriving(true);
    const t = setTimeout(() => setArriving(false), 1400);
    return () => clearTimeout(t);
  }, [firstPerson]);
  const n = row.length;
  const isGroup = n >= 3;

  // who talks now (M-R238/M-R239): one line at a time is "said" — its words come out (or its voice plays), the speaker's
  // mouth moves, and each sentence's face and motion come in as the words reach it. Lines can be played in a row (a
  // thread opened with unread lines); a tap goes on to the next line, a long press to the end.
  const [speech, setSpeech] = useState<Speech | null>(null);
  const [hold, setHold] = useState<Record<string, { face: TalkFace; until: number }>>({});
  // the named pose each speaker shows (a story line's painted gesture), until their next line
  const [poseHold, setPoseHold] = useState<Record<string, string | undefined>>({});
  const [react, setReact] = useState<Record<string, { motion: TalkMotion; key: number }>>({});
  const [cursor, setCursor] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    try {
      setMuted(localStorage.getItem(MUTE_KEY) === '1');
    } catch {
      /* no storage */
    }
  }, []);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const after = useRef<(() => void) | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const streamedIds = useRef(new Set<string>());
  for (const i of items) if (i.live) streamedIds.current.add(i.id);
  const beatsOf = (it: TalkItem) => (it.faces?.length ? it.faces : it.face ? [{ face: it.face, motion: it.motion }] : ruleBeats(it.text, !!byId.get(it.who)?.self));

  /** says one line; `then` runs when it is over (or cut short) */
  const say = (it: TalkItem, then?: () => void, streamed = false) => {
    stopClip();
    after.current = then ?? null;
    setPoseHold((h) => (h[it.who] === it.pose ? h : { ...h, [it.who]: it.pose }));
    const base = speechOf(it, beatsOf(it), streamed);
    if (it.voice) {
      const secs = it.voice.seconds ?? 3;
      // no sound (muted, not unlocked yet, no file): the words and the mouth only, for the voice's length
      const quiet = { ...base, dur: Math.max(900, secs * 1000), typed: false, mouth: true };
      setSpeech(quiet);
      onPlayingChange?.(true);
      if (!mutedRef.current && it.voice.url)
        void (async () => {
          const url = audioSrc ? await audioSrc(it.voice!.url!) : it.voice!.url!;
          const clip = url ? await playClip(url) : null;
          if (!clip) return;
          setSpeech((cur) => (cur?.id === it.id ? { ...cur, start: Date.now(), dur: clip.duration * 1000 + 150, level: clip.level, clip } : cur));
        })();
      return;
    }
    setSpeech(base);
  };
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  /** a named pose stays a little after the line, then the plain picture again (not while their voice still plays) */
  const dropPose = (who: string, pose: string | undefined) => {
    if (!pose) return;
    setTimeout(() => {
      if (!alive.current) return;
      if (voiceRef.current?.who === who) return dropPose(who, pose);
      setPoseHold((h) => (h[who] === pose ? { ...h, [who]: undefined } : h));
    }, 2200);
  };
  const finish = () => {
    setSpeech((cur) => {
      if (cur) {
        const last = cur.beats[cur.beats.length - 1];
        if (last) setHold((h) => ({ ...h, [cur.who]: { face: last.face, until: Date.now() + 2200 } }));
        dropPose(cur.who, itemsRef.current.find((x) => x.id === cur.id)?.pose);
        cur.clip?.stop();
      }
      return null;
    });
    onPlayingChange?.(false);
    const then = after.current;
    after.current = null;
    then?.();
  };
  /** plays from line i to the end, one after another */
  const playFrom = (i: number) => {
    const list = itemsRef.current;
    if (i >= list.length) return setCursor(null);
    setCursor(i);
    say(list[i], () => playFrom(i + 1));
  };
  const skipAll = () => {
    after.current = null;
    stopClip();
    setSpeech(null);
    setCursor(null);
    onPlayingChange?.(false);
  };

  useEffect(() => {
    if (!seen.current) {
      if (loading) return;
      seen.current = new Set(items.filter((i) => !i.live).map((i) => i.id));
      // M-R239: opened with unread lines — the last read one and every unread one, in order, to the end
      if (unreadFrom != null && unreadFrom >= 0 && unreadFrom < items.length) {
        const from = Math.max(0, unreadFrom - 1);
        setCursor(from);
        // once (the effect runs again on every new list of people; this must not be cleared by it)
        setTimeout(() => alive.current && playFrom(from), 500);
      }
      return;
    }
    const fresh = items.filter((i) => !seen.current!.has(i.id) && !i.live);
    for (const i of fresh) seen.current.add(i.id);
    const last = fresh[fresh.length - 1];
    // a new line while lines are being played joins the row by itself
    if (!last || cursor != null) return;
    // a line that was streamed has shown its words already: its faces run on quicker, nothing is typed again
    say(last, undefined, streamedIds.current.has(last.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, byId, loading]);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      after.current = null;
      stopClip();
    };
  }, []);
  // a line being streamed: its speaker talks meanwhile
  const liveWho = items.find((i) => i.live)?.who;
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), speech ? 90 : 400);
    return () => clearInterval(t);
  }, [speech]);
  const now = Date.now();
  // where the speech is: the characters out, the sentence, its beat
  const at = speech ? Math.min(1, (now - speech.start) / speech.dur) : 1;
  const beatNow = (() => {
    if (!speech || at >= 1 || !speech.beats.length) return null;
    const out = charsAt(speech, now - speech.start);
    const idx = speech.cuts.findIndex((c) => c > out);
    const k = speech.typed || speech.text ? (idx < 0 ? speech.cuts.length - 1 : idx) : Math.floor(at * speech.beats.length);
    return { who: speech.who, beat: speech.beats[Math.min(k, speech.beats.length - 1)], k };
  })();
  // a new sentence: its motion, once, and its face
  const lastBeat = useRef<string>('');
  const [quake, setQuake] = useState(0);
  /** the bubble's shape and entrance: the sentence being said now, else its last sentence's */
  const bubbleBeat = (it: TalkItem): { shape?: TalkShape; in?: TalkIn; key: number } => {
    if (speech?.id === it.id && beatNow) return { shape: beatNow.beat?.shape, in: beatNow.beat?.in, key: beatNow.k };
    const b = beatsOf(it);
    const l = b[b.length - 1];
    return { shape: l?.shape, key: -1 };
  };
  useEffect(() => {
    if (!beatNow?.beat) return;
    const key = `${speech?.id}:${speech?.start}:${beatNow.k}`;
    if (key === lastBeat.current) return;
    lastBeat.current = key;
    const { who, beat } = beatNow;
    // M-R243: a slam shakes the whole screen a little (0.28 s)
    if (beat.in === 'slam' && !reduced) setQuake((q) => q + 1);
    if (beat.motion && beat.motion !== 'none') setReact((r) => ({ ...r, [who]: { motion: beat.motion!, key: (r[who]?.key ?? 0) + 1 } }));
    // the one listening nods to each sentence (a group's quiet ones keep still)
    if (people.length <= 2) for (const p of people) if (p.id !== who) setReact((r) => ({ ...r, [p.id]: { motion: 'nod', key: (r[p.id]?.key ?? 0) + 1 } }));
    setHold((h) => ({ ...h, [who]: { face: beat.face, until: Date.now() + 99_000 } }));
  });
  // the end: the last face stays a little, then plain again; the next line of a row
  useEffect(() => {
    if (speech && at >= 1) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech, at]);
  const talkingId = liveWho ?? (voice?.who ? voice.who : speech && at < 1 && speech.mouth ? speech.who : null);
  const faces = hold;
  const playing = cursor != null || !!speech;

  // before the first play starts (the very first paint), already only up to the line it starts from
  const pending = !seen.current && !loading && unreadFrom != null && unreadFrom >= 0 && unreadFrom < items.length ? Math.max(0, unreadFrom - 1) : null;
  const upTo = cursor ?? pending;
  const said = (it: TalkItem) => !!(it.text || it.card || it.voice || it.chips?.length || it.extra);
  const visible = (upTo == null ? items : items.slice(0, upTo + 1)).filter(said);
  // M-R244: a long utterance is shown as several bubbles in a row (the words unchanged; the cuts from the same call as
  // the faces, else every ~60 characters at a sentence end); while it is said, its bubbles come one by one
  const outNow = speech && speech.typed && at < 1 ? charsAt(speech, now - speech.start) : null;
  const units: Unit[] = visible.flatMap((it) => {
    const list = unitsOf(it, beatsOf(it));
    if (outNow == null || speech?.id !== it.id) return list;
    return list.filter((u) => u.first || u.from < outNow);
  });

  // M-R241: going back — dragging down brings the past bubbles down from above one by one (one step per 64 px), dragging
  // up goes toward the newest; where the finger lets go it stays. Meanwhile the row stops, both stand as they were then
  // and a small 〔いまに戻る〕 shows.
  const [back, setBack] = useState(0);
  const backRef = useRef(0);
  backRef.current = back;
  const resumeAt = useRef<number | null>(null);
  const backToNow = () => {
    setBack(0);
    const r = resumeAt.current;
    resumeAt.current = null;
    // a row that was stopped goes on from the line it stopped at
    if (r != null && r < itemsRef.current.length) setTimeout(() => alive.current && playFrom(r), 300);
  };
  const goBack = (v: number) => {
    const max = Math.max(0, units.length - 1);
    const nv = Math.max(0, Math.min(max, v));
    if (nv === backRef.current) return;
    if (nv > 0 && backRef.current === 0) {
      // stop the row (and what is being said) where it is
      resumeAt.current = cursor;
      after.current = null;
      stopClip();
      setSpeech(null);
      onPlayingChange?.(false);
    }
    backRef.current = nv;
    if (nv === 0) return backToNow();
    setBack(nv);
  };
  const end = units.length - back;
  const shown = units.slice(Math.max(0, end - 2), end);
  const past = back > 0;
  /** the face someone had at their last line up to the one in view (their last sentence's) */
  const faceThen = (id: string): TalkFace => {
    for (let i = end - 1; i >= 0; i--) {
      const it = units[i].item;
      if (it.who !== id) continue;
      // the face of the last sentence of that bubble
      const b = units[i].beats;
      return b[b.length - 1]?.face ?? 'normal';
    }
    return 'normal';
  };

  // a tap goes on to the next line, a long press to the end (M-R239); a drag goes back (M-R241); a tap in the past comes
  // back to now; any tap also lets the voices sound (iOS)
  const press = useRef<{ at: number; y: number; acc: number; moved: boolean } | null>(null);
  const wheel = useRef(0);
  const STEP_PX = 64;
  const onDown = (e: React.PointerEvent) => {
    unlockAudio();
    if ((e.target as HTMLElement).closest('button,a,input,textarea,label')) return (press.current = null);
    press.current = { at: Date.now(), y: e.clientY, acc: 0, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const pr = press.current;
    if (!pr) return;
    pr.acc += e.clientY - pr.y;
    pr.y = e.clientY;
    if (Math.abs(pr.acc) > 10) pr.moved = true;
    while (Math.abs(pr.acc) >= STEP_PX) {
      const dir = Math.sign(pr.acc);
      goBack(backRef.current + dir);
      pr.acc -= dir * STEP_PX;
    }
  };
  const onUp = () => {
    const pr = press.current;
    press.current = null;
    if (!pr || pr.moved) return;
    if (backRef.current > 0) return backToNow();
    if (!playing) return onTap?.();
    if (Date.now() - pr.at > 550) return skipAll();
    if (cursor != null) {
      const next = cursor + 1;
      after.current = null;
      stopClip();
      setSpeech(null);
      if (next < items.length) playFrom(next);
      else setCursor(null);
    } else finish();
  };
  const onWheel = (e: React.WheelEvent) => {
    wheel.current += -e.deltaY;
    while (Math.abs(wheel.current) >= STEP_PX) {
      const dir = Math.sign(wheel.current);
      goBack(backRef.current + dir);
      wheel.current -= dir * STEP_PX;
    }
  };

  // the top bubble when a third comes: it floats up and fades
  const [leaving, setLeaving] = useState<TalkItem | null>(null);
  const lastTop = useRef<string[]>([]);
  useEffect(() => {
    const ids = shown.map((x) => x.key);
    const prev = lastTop.current;
    lastTop.current = ids;
    const gone = prev.find((id) => !ids.includes(id));
    const out = gone ? units.find((x) => x.key === gone) : undefined;
    if (!out || reduced || past) return;
    setLeaving({ ...out.item, id: out.key, text: out.text });
    const t = setTimeout(() => setLeaving(null), 620);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown.map((x) => x.key).join('|')]);
  const [opened, setOpened] = useState<TalkItem | null>(null);
  const [big, setBig] = useState<TalkItem | null>(null);
  const [drawer, setDrawer] = useState(false);
  // this talk's past for the drawer: one row an utterance (today), the dot in the speaker's colour
  const pastRows: SpiralRow[] = drawer
    ? visible.map((it, k) => {
        const t = toneFor(byId.get(it.who));
        return { id: it.id, at: new Date(Date.now() - (visible.length - k) * 60_000).toISOString(), color: t.line, title: talkPlain(it.text) || (it.voice ? '♪ 声' : (it.card?.label ?? '')), sub: it.name ?? byId.get(it.who)?.name };
      })
    : [];
  // <html data-sidetalk>: you stand in the row here (NeoSpeaking's big figure from below stays away)
  useEffect(() => {
    document.documentElement.dataset.sidetalk = '1';
    return () => void delete document.documentElement.dataset.sidetalk;
  }, []);
  // typing: <html data-typing> (a review page's build stamp steps out of the input's way)
  useEffect(() => {
    if (!keyboard) return;
    document.documentElement.dataset.typing = '1';
    return () => void delete document.documentElement.dataset.typing;
  }, [keyboard]);

  // M-R242 the camera: while a line plays it moves in toward the one speaking (the stage to 1.1 from their side, 3% their
  // way, 0.9 s; the place 1.5% and 1.07, 1.2 s — parallax) and eases back 0.7 s after the line; none in the past
  const [cam, setCam] = useState<string | null>(null);
  useEffect(() => {
    if (reduced || past) return setCam(null);
    if (talkingId) return setCam(talkingId);
    const t = setTimeout(() => setCam(null), 700);
    return () => clearTimeout(t);
  }, [talkingId, past, reduced]);

  // the layout (phone portrait first; the client's prototype, design/talk/proto.html)
  const { w, h } = size;
  const barH = bar ? 62 : 0;
  // subtitles: a band of their own under the row (the words never sit over the people)
  const subBand = lines === 'subtitles' ? 96 : 0;
  const dockH = (dock ?? (keyboard ? 64 : 110)) + subBand;
  const chest = keyboard;
  // the pair stands low (design/talk/proto.html): at most 46% of the height (420 px), each 40% wide with 6% between;
  // the pictures share one canvas with headroom for raised arms, so the heads are about 16% down into it
  const stageH = chest ? Math.min(h * 0.26, 220) : Math.min(h * 0.46, 420);
  const stageTop = h - dockH - stageH;
  // a big group (5 or more): at most four full length in the front row, large and low (you at the right end, the one
  // speaking — or who spoke last — steps into it); the rest behind them, smaller, higher, chest up, each between two
  // of the front (staggered by half, not squeezed)
  const lead = talkingId ?? shown[shown.length - 1]?.item.who ?? null;
  // the story's two rows (M-R251 review): the ones marked `back` stand behind the front row, about 80% of its size; one
  // coming forward takes the place of the one going back (the others keep theirs)
  const backRow = row.filter((p) => p.back);
  const frontIds = row.filter((p) => !p.back && !p.self).map((p) => p.id);
  const lastFront = useRef<string[]>([]);
  const frontOrder = (() => {
    const was = lastFront.current;
    if (!backRow.length && !was.length) return frontIds;
    const stay = was.filter((id) => frontIds.includes(id));
    const come = frontIds.filter((id) => !was.includes(id));
    // the newcomers take the places of the ones gone back, in order; any left over go at the end
    const out = was.map((id) => (frontIds.includes(id) ? id : (come.shift() ?? null))).filter((x): x is string => !!x);
    return stay.length || out.length ? [...out, ...come] : frontIds;
  })();
  useEffect(() => {
    lastFront.current = frontOrder;
  });
  let rows: TalkPerson[][] = [row];
  if (backRow.length) {
    const front = frontOrder.map((id) => row.find((p) => p.id === id)!).filter(Boolean);
    rows = [backRow, self && !firstPerson ? [...front, self] : front];
  } else if (n >= 5) {
    const others = self ? row.slice(0, -1) : row;
    let front = others.slice(0, self ? 3 : 4);
    if (lead && lead !== self?.id && !front.some((p) => p.id === lead)) front = [...front.slice(0, -1), others.find((p) => p.id === lead)!];
    front = others.filter((p) => front.includes(p));
    rows = [others.filter((p) => !front.includes(p)), self ? [...front, self] : front];
  }
  const spots = new Map<string, { x: number; bottom: number; h: number; z: number; w: number; chest: boolean; dim?: boolean }>();
  if (backRow.length) {
    // the front row as a row of its own size; the back row in the gaps between them (then toward the ends), 80% as
    // tall, standing a little higher (further away) and darker
    const front = rows[1];
    const fn = front.length;
    const fh = stageH * (fn <= 2 ? 1 : 0.86);
    const fx = (k: number) => (fn === 1 ? (front[k].self ? 0.73 : 0.5) : fn === 2 ? (k === 0 ? 0.27 : 0.73) : 0.07 + (0.86 * (k + 0.5)) / fn);
    front.forEach((p, k) => spots.set(p.id, { x: Math.min(0.93, Math.max(0.07, fx(k))), bottom: 0, h: fh, z: 2, w: fn <= 2 ? 0.4 : 0.9 / fn, chest }));
    const xs = front.map((_, k) => fx(k));
    const gaps = xs.slice(1).map((x, k) => (x + xs[k]) / 2);
    const ends = [Math.max(0.1, (xs[0] ?? 0.5) - 0.2), Math.min(0.9, (xs[xs.length - 1] ?? 0.5) + 0.2)];
    const places = [...gaps, ...ends, 0.5, 0.2, 0.8];
    backRow.forEach((p, k) => spots.set(p.id, { x: Math.min(0.9, Math.max(0.1, places[k % places.length])), bottom: stageH * 0.07, h: fh * 0.8, z: 1, w: 0.3, chest, dim: true }));
  } else
  rows.forEach((r, ri) => {
    const back = rows.length > 1 && ri === 0;
    const fn = rows[rows.length - 1].length;
    const hh = n <= 2 ? stageH : back ? stageH * 0.27 : stageH * (n <= 3 ? 0.86 : 0.72);
    r.forEach((p, k) => {
      // the back row sits in the gaps of the front one (between 1–2, 2–3, 3–4, then the ends)
      const gap = [1, 2, 3, 0, 4][k % 5];
      // a row of three or more keeps its ends inside the screen (the figures are wider than their share)
      // you are always at the right, alone too (nobody beside you yet: the place stays where they will stand)
      const x = n === 2 ? (k === 0 ? 0.27 : 0.73) : n === 1 ? (p.self ? 0.73 : 0.5) : back ? gap / fn : 0.07 + (0.86 * (k + 0.5)) / r.length;
      spots.set(p.id, { x: Math.min(0.93, Math.max(0.07, x)), bottom: back ? stageH * 0.52 : 0, h: hh, z: back ? 1 : 2, w: n <= 2 ? 0.4 : back ? 0.2 : 0.9 / r.length, chest: chest || back });
    });
  });
  // a wide picture at an end of the row (a painted resident with something held out to one side) is kept inside the
  // screen: its whole width, from its picture's own proportions
  for (const p of row) {
    const sp = spots.get(p.id);
    const r = p.look?.stand ? aspects[p.look.stand] : undefined;
    // (the talk cast's pictures share a padded canvas: their figures are well inside it)
    if (!sp || !r || sp.chest || p.look?.poses) continue;
    const half = (sp.h * (p.scale ?? 1) * (r > 0.9 ? 0.58 : 1) * r) / 2 / w;
    const m = 4 / w;
    if (sp.x - half < m && sp.x + half <= 1 - m) sp.x = Math.min(0.5, m + half);
    else if (sp.x + half > 1 - m && sp.x - half >= m) sp.x = Math.max(0.5, 1 - m - half);
  }
  // with the keyboard up the bubbles sit over the canvas's top edge, clear of the two faces
  // the tallest in the row sets where the bubbles start (a small one alone lets them come down to its head)
  // (the story's back row: their heads by where they stand — lower and smaller than the front)
  const headOf = (p: TalkPerson) => {
    const s = spots.get(p.id);
    const at = p.headAt ?? 0.16;
    if (!backRow.length || !s) return at;
    return 1 - (s.bottom + s.h * (1 - at)) / stageH;
  };
  const headAt = Math.min(...row.map(headOf), 0.9);
  const heads = chest ? stageTop - 6 : stageTop + stageH * (row.length ? headAt : 0.16) * (rows.length > 1 && !backRow.length ? 0.5 : 1);
  // the bubbles stack from just above the heads; each at most half the free room tall (a long one scrolls inside)
  const room = Math.max(120, heads - (barH + top + 56) - 48);
  const bubbleBottom = h - heads + 8;
  // the camera's side: the one speaking (a group pushes toward them the same way)
  const camX = cam ? (spots.get(cam)?.x ?? 0.5) : 0.5;
  const camShift = n <= 2 ? (camX < 0.5 ? 3 : -3) : (0.5 - camX) * 6;

  // blocking: someone new in the row walks in from their side; someone leaving walks out (kept a moment for it)
  const rowKey = row.map((p) => p.id).join('|');
  const seenRow = useRef<Map<string, { p: TalkPerson; spot: NonNullable<ReturnType<typeof spots.get>> }> | null>(null);
  const [entering, setEntering] = useState<Record<string, 'l' | 'r'>>({});
  const [gone, setGone] = useState<{ p: TalkPerson; spot: NonNullable<ReturnType<typeof spots.get>>; side: 'l' | 'r' }[]>([]);
  useEffect(() => {
    const was = seenRow.current;
    const nowMap = new Map(row.map((p) => [p.id, { p, spot: spots.get(p.id)! }]));
    seenRow.current = nowMap;
    if (!was || !directed) return;
    const sideOf = (id: string, x: number): 'l' | 'r' => {
      const m = items.find((it) => it.direction?.moves?.[id] || (it.who === id && it.direction?.move))?.direction;
      const mv = m?.moves?.[id] ?? m?.move;
      if (mv === 'enter-left' || mv === 'exit-left') return 'l';
      if (mv === 'enter-right' || mv === 'exit-right') return 'r';
      return x < 0.5 ? 'l' : 'r';
    };
    const add: Record<string, 'l' | 'r'> = {};
    for (const [id, v] of nowMap) if (!was.has(id) && v.spot && !v.p.self) add[id] = sideOf(id, v.spot.x);
    const left = [...was.values()].filter((v) => !nowMap.has(v.p.id) && v.spot && !v.p.self).map((v) => ({ ...v, side: sideOf(v.p.id, v.spot.x) }));
    if (Object.keys(add).length) setEntering(add);
    if (left.length) setGone(left);
    const t = setTimeout(() => {
      setEntering({});
      setGone([]);
    }, 750);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowKey]);

  // --- the directed scene (lib/talk/direction.ts, docs/story-direction.md): the line's shot and the people's moves ---
  const directed = items.some((it) => !!it.direction);
  const nowUnit = shown[shown.length - 1];
  const nowItem = speech ? (items.find((it) => it.id === speech.id) ?? nowUnit?.item) : nowUnit?.item;
  const dir = !past && directed ? nowItem?.direction : undefined;
  const saying = !!speech && speech.id === nowItem?.id && at < 1;
  const phase = dir?.after && !saying ? 'after' : 'during';
  const shot = dir ? (phase === 'after' ? dir.after! : dir.shot) : null;
  const shotOn = dir ? (phase === 'after' ? dir.afterOn : dir.on) : undefined;
  const shotKey = `${nowItem?.id ?? ''}:${phase}`;
  const lastShot = useRef('');
  const shotChanged = lastShot.current !== shotKey;
  useEffect(() => {
    lastShot.current = shotKey;
  });
  /** a person's face in the stage's own px (from where they stand and their headroom) */
  const faceAt = (id?: string | null) => {
    const sp = id ? spots.get(id) : undefined;
    const p = id ? byId.get(id) : undefined;
    if (!sp || !p) return null;
    return { x: sp.x * w, y: stageH - sp.bottom - sp.h + sp.h * Math.min(0.92, (p.headAt ?? 0.16) + 0.07) };
  };
  // the angled cuts (3/4, side, over the shoulder): where the two stand and how, for this shot only. The 180° rule:
  // whoever stands left of the other in the row stays on the left in these cuts too
  type Angle = { x: number; scale: number; bottom?: number; hide?: boolean; mirror?: boolean; turn?: number; dim?: boolean; blur?: number; look?: TalkLook; z?: number };
  const viewLook = (id: string, url?: string): TalkLook | undefined => (url ? { of: `${id}-view`, stand: url, faces: { normal: { kind: 'image', url } } } : undefined);
  const angle = ((): Record<string, Angle> | null => {
    if (!shot || !nowItem || !(shot === 'q3' || shot === 'side' || shot === 'ots')) return null;
    const A = nowItem.who;
    const B = shotOn;
    const sa = spots.get(A);
    const sb = B ? spots.get(B) : undefined;
    const pa = byId.get(A);
    if (!sa || !pa) return null;
    const out: Record<string, Angle> = {};
    if (shot === 'q3') {
      const facesRight = (sb?.x ?? (sa.x < 0.5 ? 1 : 0)) > sa.x;
      // (the 3/4 and side views face left: mirrored to face right)
      out[A] = { x: sa.x, scale: 1, look: viewLook(A, pa.views?.q3), ...(pa.views?.q3 ? { mirror: facesRight } : { turn: facesRight ? CAMERA.q3.figureTurn : -CAMERA.q3.figureTurn }) };
      return out;
    }
    const pb = B ? byId.get(B) : undefined;
    if (!sb || !pb || !B) return null;
    const aLeft = sa.x < sb.x;
    for (const p of row) if (p.id !== A && p.id !== B) out[p.id] = { x: spots.get(p.id)!.x, scale: 1, hide: true };
    if (shot === 'side') {
      const C = CAMERA.side;
      // the one on the left faces right: a side view (facing left) is mirrored there; a front figure is mirrored on the right
      const put = (p: TalkPerson, left: boolean): Angle => ({ x: left ? C.at : 1 - C.at, scale: 1, look: viewLook(p.id, p.views?.side), mirror: p.views?.side ? left : !left });
      out[A] = put(pa, aLeft);
      out[B] = put(pb, !aLeft);
      return out;
    }
    // over the shoulder: needs the listener's back view (else no such cut: the plain two-shot stands)
    if (!pb.views?.back) return null;
    const C = CAMERA.ots;
    out[A] = { x: aLeft ? C.at : 1 - C.at, scale: C.far, bottom: stageH * 0.1 };
    out[B] = { x: aLeft ? C.nearAt : 1 - C.nearAt, scale: C.near, bottom: -stageH * C.drop, blur: 2.2, dim: true, look: viewLook(B, pb.views.back), z: 6 };
    return out;
  })();
  const frame = (() => {
    const f = { ox: w / 2, oy: stageH * 0.4, s: 1, tx: 0, ms: 700, push: 1, shake: false, turn: 0 };
    if (!shot) return f;
    const C = CAMERA[shot];
    if (shot === 'side' || shot === 'ots' || shot === 'q3') {
      // no angle possible (a missing view, nobody to face): the plain two-shot framing
      if (!angle) return f;
      const a = faceAt(nowItem?.who);
      if (shot === 'q3' && a) {
        const facesRight = (angle[nowItem!.who]?.turn ?? 1) > 0 || angle[nowItem!.who]?.mirror === false;
        Object.assign(f, { ox: a.x, oy: a.y, s: CAMERA.q3.scale, tx: w * (facesRight ? CAMERA.q3.at : 1 - CAMERA.q3.at) - a.x, turn: facesRight ? CAMERA.q3.turn : -CAMERA.q3.turn });
      } else Object.assign(f, { ox: w / 2, oy: stageH * 0.35, s: shot === 'side' ? CAMERA.side.scale : 1 });
      f.ms = shotChanged ? 0 : 600;
      if (reduced) Object.assign(f, { s: Math.min(f.s, CAMERA.reducedMax), turn: 0, tx: f.tx * 0.3, ms: 400 });
      return f;
    }
    const a = faceAt(shot === 'reaction' ? shotOn : nowItem?.who);
    if (shot === 'two') {
      const b = faceAt(shotOn);
      if (a && b) Object.assign(f, { ox: (a.x + b.x) / 2, oy: Math.min(a.y, b.y), s: Math.max(1, Math.min(C.scale, (w * 0.9) / (Math.abs(a.x - b.x) + w * 0.38))) });
      else if (a) Object.assign(f, { ox: a.x, oy: a.y, s: C.scale });
    } else if (shot !== 'wide' && a) Object.assign(f, { ox: a.x, oy: a.y, s: shot === 'push' ? CAMERA.two.scale : C.scale });
    f.tx = (w / 2 - f.ox) * CAMERA.center * (f.s > 1 ? 1 : 0);
    void C;
    // a new speaker (or the reaction after a question): a cut; else the camera moves
    f.ms = shotChanged && (dir!.cut || phase === 'after') ? 0 : shot === 'push' ? CAMERA.two.ms : C.ms;
    f.push = shot === 'push' ? CAMERA.push.scale / CAMERA.two.scale : 1;
    f.shake = shot === 'punch';
    if (reduced) Object.assign(f, { s: Math.min(f.s, CAMERA.reducedMax), tx: f.tx * 0.3, ms: Math.max(f.ms, 400), push: 1, shake: false });
    return f;
  })();
  const camKey = `${frame.tx.toFixed(1)}|${frame.s.toFixed(3)}|${frame.ox.toFixed(0)}|${frame.oy.toFixed(0)}|${frame.turn}`;
  const onCam = useRef(onCamera);
  onCam.current = onCamera;
  useEffect(() => {
    if (!directed) return;
    const c: TalkCamera = { x: frame.tx, y: 0, scale: frame.s, originX: frame.ox, originY: frame.oy, turn: frame.turn, ms: frame.ms, stageBottom: dockH, stageHeight: stageH };
    onCam.current?.(c);
    window.dispatchEvent(new CustomEvent('obolo:camera', { detail: c }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camKey, directed]);
  const lastAngled = useRef(false);
  useEffect(() => {
    lastAngled.current = !!angle;
  });
  const dirKey = nowItem ? 100000 + ([...nowItem.id].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7) % 100000) * 2 + (phase === 'after' ? 1 : 0) : 0;
  const speakerX = nowItem ? spots.get(nowItem.who)?.x : undefined;
  /** the move someone makes on this line (the speaker's, or one named in an override), as a talk motion and a facing */
  const moveOf = (p: TalkPerson): { motion: TalkMotion; toward?: 'left' | 'right'; mirror?: boolean } | null => {
    if (!dir || phase === 'after') return null;
    const m: Move | undefined = dir.moves?.[p.id] ?? (nowItem?.who === p.id ? dir.move : undefined);
    const lx = spots.get(dir.on ?? dir.afterOn ?? '')?.x;
    const toListener: 'left' | 'right' = lx != null && lx < (spots.get(p.id)?.x ?? 0.5) ? 'left' : 'right';
    const away: 'left' | 'right' = toListener === 'left' ? 'right' : 'left';
    // talk-lean tips away from `toward`: leaning in = toward set away from the listener
    if (m === 'lean') return { motion: 'lean', toward: away };
    if (m === 'step-back') return { motion: 'lean', toward: toListener };
    if (m === 'hop') return { motion: 'hop' };
    if (m === 'turn') return { motion: 'nod', mirror: true };
    if (p.back && dir.stir) return { motion: nowItem && /[？?]/.test(nowItem.text) ? 'nod' : 'shrink' };
    return null;
  };
  const stateOf = (p: TalkPerson): FigureState =>
    past ? 'idle' : thinking === p.id ? 'think' : talkingId === p.id ? 'talk' : listening && !p.self ? 'listen' : directed && talkingId && !p.back && !p.self ? 'listen' : 'idle';
  const faceOf = (p: TalkPerson): TalkFace => {
    // in the past: the face (and pose) they had at that line
    const pick = (face: TalkFace) => (p.self ? (fixedSelfFace ? 'normal' : face === 'sad' || face === 'thinking' ? 'normal' : face) : face);
    if (past) return pick(faceThen(p.id));
    if (thinking === p.id) return 'thinking';
    const f = faces[p.id];
    return pick(f && f.until > now ? f.face : 'normal');
  };
  /** the named pose shown (a story character's painted gesture): the one of their line in view, else their last */
  const poseOf = (p: TalkPerson) => {
    const named = p.look?.named;
    if (!named) return null;
    let key: string | undefined;
    if (past) {
      for (let i = end - 1; i >= 0; i--) if (units[i].item.who === p.id) {
        key = units[i].item.pose;
        break;
      }
    } else key = poseHold[p.id];
    return (key && named[key]) || null;
  };
  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    if (m) stopClip();
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      /* no storage */
    }
  };
  const muteButton = (
    <button onClick={toggleMute} aria-label={muted ? '声を出す' : '声を消す'} aria-pressed={muted} className={GLASS}>
      <SpeakerGlyph off={muted} />
    </button>
  );
  const ease = 'cubic-bezier(.33,.1,.2,1)';

  return (
    <SkinCtx.Provider value={skin}>
    <div
      ref={wrap}
      className={`relative min-h-0 flex-1 touch-none select-none overflow-hidden text-[#f4f1ff] ${transparent ? '' : 'bg-[#070b24]'}`}
      style={{ fontFamily: TALK_FONT, WebkitTapHighlightColor: 'transparent', animation: quake && !reduced ? `talk-quake${quake % 2} .28s linear` : undefined }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => (press.current = null)}
      onWheel={onWheel}
    >
      <style>{TALK_CSS}</style>
      {/* the place, drifting very slowly behind the two; the camera moves it a little less than them (parallax) */}
      {place && (
        <div className="pointer-events-none absolute inset-0" style={{ transform: cam ? `translateX(${camShift / 2}%) scale(1.07)` : undefined, transition: `transform 1.2s ${ease}` }}>
          <div className="absolute inset-[-4%_-4%_0]" style={{ animation: reduced ? undefined : 'talk-drift 60s ease-in-out infinite alternate' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={place} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: 'center 30%' }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom,rgba(7,11,36,.55) 0%,rgba(7,11,36,0) 22%,rgba(7,11,36,0) 62%,rgba(7,11,36,.7) 100%)' }} />
          </div>
        </div>
      )}

      {/* the top bar (small): the conversations at the left, the partner's name, the mute and Bluena at the right */}
      {bar ? (
        <header className="absolute inset-x-0 z-[20] flex items-center gap-2.5 px-3.5 py-2.5" style={{ top }}>
          {/* the left: back (where the page has no other way out), then the conversations — the shell's drawer, or this talk's own */}
          <span className="flex flex-none gap-2">
            {bar.onBack && (
              <button onClick={bar.onBack} aria-label="もどる" className={GLASS}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </button>
            )}
            <button onClick={() => (bar.onList ? bar.onList() : setDrawer(true))} aria-label="会話の一覧を開く" className={GLASS}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                <path d="M4 7h16M4 12h11M4 17h7" />
              </svg>
              {bar.unread && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-sky-300" />}
            </button>
            {bar.left}
          </span>
          <div className="flex min-w-0 flex-1 flex-col items-center">
            <b className="truncate text-[15px] font-black tracking-[0.04em] [text-shadow:0_1px_8px_rgba(0,0,0,.5)]">{group ? group.name : bar.title}</b>
            {group && <span className="text-[11px] font-bold text-[#b9bde6]">{group.count}人</span>}
          </div>
          {bar.right}
          {!noMute && muteButton}
          {bar.onBluena && (
            <button onClick={bar.onBluena} aria-label="Bluenaを開く" className={GLASS}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path d="M12 3c4 0 7 6 7 10.5A7 7 0 0 1 5 13.5C5 9 8 3 12 3z" />
                <circle cx="12" cy="13" r="2.6" />
              </svg>
            </button>
          )}
        </header>
      ) : (
        !noMute && (
          <div className="absolute right-3.5 z-[20] flex gap-2.5" style={{ top: top + 10 }}>
            {muteButton}
          </div>
        )
      )}
      {!bar && group && (
        <p className="absolute inset-x-0 z-[6] text-center text-[12px] font-bold tracking-[0.1em] text-[#f4f1ff]/85" style={{ top: top + 18 }}>
          {group.name}・{group.count}人
        </p>
      )}

      {/* the plate behind the row: the same box and the same camera as the row, so the feet stay on its floor */}
      {plate && (
        <div
          className="pointer-events-none absolute inset-x-0 z-[1]"
          style={{
            bottom: dockH,
            height: stageH,
            ...(directed ? { transformOrigin: `${frame.ox}px ${frame.oy}px`, transform: `${frame.turn ? `perspective(1100px) rotateY(${frame.turn}deg) ` : ''}translateX(${frame.tx}px) scale(${frame.s})`, transition: `transform ${frame.ms}ms cubic-bezier(.2,.75,.25,1), filter .5s ease` } : {}),
            // sharp; a little soft only in a close-up (depth of field)
            filter: directed && frame.s > 1.2 && !reduced ? 'blur(1.4px)' : undefined,
          }}
        >
          {(() => {
            // tall enough that its top is above the screen's, wide enough to pan
            const ih = Math.max((h - dockH) / plate.floorY, (w * 1.25) / plate.aspect) * 1.04;
            // eslint-disable-next-line @next/next/no-img-element
            return <img src={plate.src} alt="" className="absolute left-1/2 max-w-none -translate-x-1/2 select-none" style={{ height: ih, width: ih * plate.aspect, bottom: -(1 - plate.floorY) * ih }} />;
          })()}
        </div>
      )}

      {/* the people, side by side (you at the right), standing low; the camera moves in toward the one speaking (the
          directed scene: the line's shot — framed on a face, cut or moved — and a slow drift inside it) */}
      <div
        className="pointer-events-none absolute inset-x-0 z-[6]"
        style={{
          bottom: dockH,
          height: stageH,
          ...(directed
            ? { transformOrigin: `${frame.ox}px ${frame.oy}px`, transform: `${frame.turn ? `perspective(1100px) rotateY(${frame.turn}deg) ` : ''}translateX(${frame.tx}px) scale(${frame.s})`, transition: `transform ${frame.ms}ms cubic-bezier(.2,.75,.25,1), bottom .4s ease` }
            : {
                transformOrigin: `${Math.round(camX * 100) === 27 ? 30 : Math.round(camX * 100) === 73 ? 70 : Math.round(camX * 100)}% 85%`,
                transform: cam ? `scale(1.1) translateX(${camShift}%)` : undefined,
                transition: `transform .9s ${ease}, bottom .4s ease`,
              }),
          willChange: 'transform',
          ...stageStyle,
        }}
      >
        <div
          key={directed ? shotKey : 'still'}
          className="absolute inset-0"
          style={
            directed && shot && !reduced
              ? {
                  transformOrigin: `${frame.ox}px ${frame.oy}px`,
                  ['--cd' as string]: frame.push !== 1 ? frame.push : CAMERA.drift.scale,
                  animation: frame.shake ? 'talk-camshake .36s .1s ease-in-out, talk-camdrift 7s .5s ease-out forwards' : frame.push !== 1 ? `talk-camdrift ${CAMERA.push.ms}ms ease-out forwards` : `talk-camdrift ${CAMERA.drift.ms}ms ease-out forwards`,
                }
              : undefined
          }
        >
        {[...row, ...gone.filter((g) => !row.some((p) => p.id === g.p.id)).map((g) => g.p)].map((p, k) => {
          const g = gone.find((x) => x.p.id === p.id && !row.some((r) => r.id === p.id));
          const s0 = g ? g.spot : spots.get(p.id)!;
          const ag = !g && angle ? angle[p.id] : undefined;
          const s = ag ? { ...s0, x: ag.x, bottom: ag.bottom ?? s0.bottom, z: ag.z ?? s0.z, dim: ag.dim || s0.dim } : s0;
          const speaking = talkingId === p.id && !past;
          const mv = g ? null : moveOf(p);
          const towardSpeaker: 'left' | 'right' | undefined = directed && speakerX != null && nowItem?.who !== p.id ? (speakerX < s.x ? 'left' : 'right') : undefined;
          const enter = entering[p.id];
          const motion = { animation: g ? `talk-exit .6s ease-in forwards` : enter && !reduced ? `talk-enter .7s cubic-bezier(.2,.8,.25,1) both` : arriving && p.self ? 'talk-arrive 1.1s ease-out both' : undefined, ['--ex' as string]: `${(g ? g.side : enter) === 'l' ? -w * 0.6 : w * 0.6}px` };
          return (
            <div key={p.id} className={`absolute flex -translate-x-1/2 items-end justify-center transition-[bottom,left,height,filter] ${arriving || (wasFirst.current && !firstPerson) ? 'duration-[900ms] ease-out' : 'duration-300'}`} style={{ left: `${s.x * 100}%`, bottom: s.bottom, width: `${s.w * 100}%`, height: s.h, zIndex: speaking ? 5 : s.z, filter: [s.dim ? 'brightness(.68) saturate(.85)' : '', ag?.blur ? `blur(${ag.blur}px)` : ''].join(' ').trim() || undefined, opacity: ag?.hide ? 0 : undefined, transitionDuration: angle || lastAngled.current ? (shotChanged ? '0ms' : undefined) : undefined, ...motion }}>
              {arriving && p.self && <ArrivalMotes />}
              <div className="flex h-full items-end justify-center" style={mv?.mirror || ag?.mirror || ag?.turn ? { transform: `${mv?.mirror !== !!ag?.mirror && (mv?.mirror || ag?.mirror) ? 'scaleX(-1) ' : ''}${ag?.turn ? `perspective(700px) rotateY(${ag.turn}deg)` : ''}`.trim() } : undefined}>
              <Figure
                look={ag?.look ?? p.look}
                face={faceOf(p)}
                named={poseOf(p)}
                state={g ? 'idle' : stateOf(p)}
                motion={past ? undefined : (mv?.motion ?? react[p.id]?.motion)}
                motionKey={past ? 0 : mv ? dirKey : (react[p.id]?.key ?? 0)}
                toward={mv?.toward ?? towardSpeaker ?? (p.self ? 'left' : 'right')}
                height={s.h * (p.scale ?? 1) * (ag?.scale ?? 1)}
                chest={s.chest}
                // the two breathe at their own pace (in step would look mechanical): 3.4 s and 4.1 s
                breath={p.self ? 4.1 : 3.4 + ((k * 0.37) % 0.5)}
                calm={isGroup && !speaking && talkingId != null && (!directed || !!p.back)}
                reduced={reduced}
                lit={speaking}
                glow={isGroup && speaking && !directed ? p.color : undefined}
                level={voice?.who === p.id && voice.level ? voice.level : speech?.who === p.id ? speech.level : undefined}
              />
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* the story's lines as film subtitles (no bubbles): the newest at the lower third, a log of the past ones when
          dragged back */}
      {lines === 'subtitles' && (
        <>
          <style>{SUBTITLE_CSS}</style>
          <SubtitleScrim bottom={dockH - subBand} height={subBand + 150} />
          <div className="pointer-events-none absolute inset-x-0 z-[9] flex flex-col items-center justify-end gap-3 px-5" style={{ bottom: dockH - subBand + 8, maxHeight: past ? dockH + stageH * 0.6 : undefined }}>
            {(past ? units.slice(Math.max(0, end - 4), end) : nowUnit ? [nowUnit] : []).map((u, k, list) => {
              const it = u.item;
              const who = byId.get(it.who);
              const live = speech?.id === it.id && outNow != null;
              const b = live && beatNow && beatNow.k >= u.s0 && beatNow.k < u.s1 ? beatNow.beat : u.beats[0];
              const nm = it.name ?? (who?.self ? selfName || 'あなた' : who?.name);
              return (
                <Subtitle
                  key={past ? `p${u.key}` : u.key}
                  lineKey={u.key}
                  name={u.first || past ? nm : null}
                  color={who ? toneFor(who).line : undefined}
                  text={u.text}
                  shown={live && outNow! < u.from + u.len ? Math.max(0, outNow! - u.from) : undefined}
                  style={subtitleStyle(talkPlain(u.text), b?.shape, b?.in)}
                  dim={past && k < list.length - 1}
                />
              );
            })}
          </div>
        </>
      )}

      {/* the bubbles: two at most over the heads (the newest lower), 62 px from the sides */}
      {lines === 'bubbles' && (
      <div className="pointer-events-none absolute inset-x-0 z-[8] flex flex-col items-center justify-end gap-2.5" style={{ paddingLeft: 62, paddingRight: 62, bottom: bubbleBottom }}>
        {leaving && !past && <Ghost key={`g-${leaving.id}`} item={leaving} who={byId.get(leaving.who)} />}
        {(firstPerson ? shown.filter((u) => !byId.get(u.item.who)?.self) : shown).map((u, k, list) => {
          const it = u.item;
          const newest = k === list.length - 1;
          const who = byId.get(it.who);
          const live = speech?.id === it.id && outNow != null;
          // one utterance: its name over the first bubble, its card, choices, ★ on the last
          const view: TalkItem = { ...it, text: u.text, ...(u.first ? {} : { name: undefined }), ...(u.last ? {} : { card: undefined, chips: undefined, extra: undefined, mark: undefined, voice: undefined }) };
          return (
            <Bubble
              key={u.key}
              item={view}
              who={who}
              newest={newest}
              past={past}
              clamp={false}
              maxH={view.card ? Math.max(room * 0.8, 200) : room / 2}
              named={(isGroup || !!it.name) && u.first}
              right={firstPerson && !who?.self && (spots.get(it.who)?.x ?? 0) > 0.55}
              onCard={() => setBig(it)}
              onOpen={() => setOpened(it)}
              playing={speech?.id === it.id && !!it.voice}
              muted={muted}
              onPlay={() => (speech?.id === it.id ? finish() : say(it))}
              onReplay={() => !past && say(it)}
              onRing={onRing && it.mark ? (at) => onRing(it, at) : undefined}
              passive={tapThrough}
              shown={live && outNow! < u.from + u.len ? Math.max(0, outNow! - u.from) : undefined}
              beat={live && beatNow && beatNow.k >= u.s0 && beatNow.k < u.s1 ? { shape: beatNow.beat?.shape, in: beatNow.beat?.in, key: beatNow.k } : { shape: u.beats[u.beats.length - 1]?.shape, key: -1 }}
            />
          );
        })}
      </div>
      )}

      {/* M-R249 first person: your newest words, from the bottom right, the tail off the screen toward you */}
      {firstPerson && lines === 'bubbles' &&
        shown
          .filter((u) => byId.get(u.item.who)?.self)
          .slice(-1)
          .map((u) => (
            <div key={`fp-${u.key}`} className="pointer-events-none absolute right-3 z-[9] flex max-w-[72%] flex-col items-end" style={{ bottom: dockH + 14 }}>
              <Bubble
                item={{ ...u.item, text: u.text }}
                who={byId.get(u.item.who)}
                newest
                past={past}
                out
                maxH={room / 2}
                onCard={() => setBig(u.item)}
                onOpen={() => setOpened(u.item)}
                playing={false}
                muted={muted}
                onPlay={() => undefined}
                onReplay={() => undefined}
                beat={{ shape: u.beats[u.beats.length - 1]?.shape, key: -1 }}
                passive={tapThrough}
              />
            </div>
          ))}

      {past ? (
        <button onClick={backToNow} className="absolute left-1/2 z-[21] -translate-x-1/2 rounded-full bg-[rgba(223,230,255,.92)] px-4 py-[7px] text-[12px] font-bold text-[#070b24] shadow-[0_4px_14px_rgba(0,0,0,.35)]" style={subBand ? { top: top + 56 } : { bottom: dockH - 6 }}>
          いまに戻る
        </button>
      ) : (
        cursor != null && hint && <p className="pointer-events-none absolute inset-x-0 z-[19] text-center text-[11px] text-[#b9bde6] [text-shadow:0_1px_4px_#000]" style={{ bottom: dockH - 10 }}>押すと次へ・下へなぞると過去へ</p>
      )}

      {composer && <div className="absolute inset-x-0 bottom-0 z-[20]">{composer}</div>}

      {askTone && onTone && <TonePicker onPick={onTone} />}

      {/* the left drawer of a talk with no shell around it (M-R237: the conversations, then the chosen one's past as the
          spiral and the list — the atelier's parts); this talk's own past is its lines, a row goes back to that line */}
      {drawer &&
        (bar?.threads === 'app' ? (
          <AppThreads extra={bar.drawer && <div onClick={() => setDrawer(false)}>{bar.drawer}</div>} onClose={() => setDrawer(false)} />
        ) : (
          <HereThreads
            threads={bar?.threads?.list ?? [{ id: 'here', name: typeof bar?.title === 'string' && bar.title ? bar.title : (row[0]?.name ?? '') }]}
            current={bar?.threads?.current ?? 'here'}
            days={bar?.threads?.days}
            rows={pastRows}
            extra={bar?.drawer && <div onClick={() => setDrawer(false)}>{bar.drawer}</div>}
            onRow={(r) => {
              setDrawer(false);
              const k = units.findIndex((u) => u.item.id === r.id);
              if (k >= 0) goBack(units.length - 1 - k);
            }}
            onClose={() => setDrawer(false)}
          />
        ))}

      {opened && (
        <div className="absolute inset-0 z-[30] flex items-start justify-center bg-black/40 px-6" style={{ paddingTop: barH + top + 60 }} onClick={() => setOpened(null)}>
          <div className="flex w-full max-w-sm flex-col" onClick={(e) => e.stopPropagation()}>
            <Bubble item={opened} who={byId.get(opened.who)} newest grow named onCard={() => setBig(opened)} onOpen={() => undefined} playing={speech?.id === opened.id} muted={muted} onPlay={() => say(opened)} onReplay={() => say(opened)} onRing={onRing ? (at) => onRing(opened, at) : undefined} />
            <button onClick={() => setOpened(null)} className={`${PILL} mx-auto mt-4`}>
              とじる
            </button>
          </div>
        </div>
      )}
      {big && (
        <div className="absolute inset-0 z-[32] flex flex-col items-center justify-center bg-[rgba(7,11,36,.82)] px-4 backdrop-blur" onClick={() => setBig(null)}>
          <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            {big.card?.full ?? big.card?.thumb}
          </div>
          <button className={`${PILL} mt-4`}>とじる</button>
        </div>
      )}
    </div>
    </SkinCtx.Provider>
  );
}

/** M-R249: light motes gathering into you as you first stand beside the partner (fixed positions: no random in render) */
const MOTES = Array.from({ length: 22 }, (_, k) => {
  const r = (n: number) => (((Math.sin(k * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1;
  return { x: 15 + r(1) * 70, y: 10 + r(2) * 80, s: 2 + r(3) * 4, dx: (r(4) - 0.5) * 60, dy: 20 + r(5) * 50, d: r(6) * 0.35 };
});
function ArrivalMotes() {
  return (
    <span className="pointer-events-none absolute inset-0 z-[1]" aria-hidden>
      {MOTES.map((m, k) => (
        <span
          key={k}
          className="absolute rounded-full"
          style={{ left: `${m.x}%`, top: `${m.y}%`, width: m.s, height: m.s, background: 'radial-gradient(circle,#fff 0%,#ffe6b0 45%,rgba(255,220,150,0) 70%)', ['--mx' as string]: `${m.dx}px`, ['--my' as string]: `${m.dy}px`, animation: `talk-gather .9s ${m.d}s ease-in both` }}
        />
      ))}
    </span>
  );
}

/** a speaker's small round face: their icon, or the head of their look cut round */
export function SmallFace({ who, size }: { who?: TalkPerson; size: number }) {
  const src = who?.avatar || who?.look?.stand;
  // the head: around the eyes when the look knows where they are, else near the top of the figure
  const n = who?.look?.faces?.normal;
  const eb = n?.kind === 'image' ? n.eyesBox : undefined;
  const fy = eb ? eb.y + eb.h * 0.6 : 0.2;
  const fx = eb ? eb.x + eb.w / 2 : 0.5;
  return (
    <span className="relative block shrink-0 overflow-hidden rounded-full bg-[#1a1328]" style={{ width: size, height: size, boxShadow: `0 0 0 1.5px ${who?.color ?? '#fff6'}` }}>
      {src &&
        (who?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          // the look's head: the top of the standing figure, enlarged
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="absolute h-[300%] w-auto max-w-none" style={{ left: '50%', top: size * 0.5 - fy * size * 3, transform: `translateX(-${fx * 100}%)` }} />
        ))}
    </span>
  );
}

/** a person's bubble colour (M-R245) */
export function toneFor(who?: TalkPerson): TalkTone {
  if (who?.tone) return who.tone;
  const c = who?.color?.toLowerCase();
  const known = Object.values(TONES).find((t) => t.line === c);
  if (known) return known;
  return who?.self ? TONES.pearl : toneOf(who?.id ?? 'x');
}
/** the ink on a speaker's bubble */
export const inkOf = (color?: string) => (Object.values(TONES).find((t) => t.line === color?.toLowerCase()) ?? TONES.pearl).ink;

/** the top bubble when a third comes: it floats up and fades */
function Ghost({ item, who }: { item: TalkItem; who?: TalkPerson }) {
  const story = useContext(SkinCtx) === 'story';
  const t = story ? (who?.self ? STORY_ME : STORY_THEM) : toneFor(who);
  return (
    <div className={`relative max-w-full rounded-[20px] px-4 pb-3 pt-[11px] text-[15px] font-bold leading-[1.55] ${who?.self ? 'self-end' : 'self-start'}`} style={{ background: `linear-gradient(170deg,${t.a},${t.b})`, color: t.ink, border: `1.5px solid ${t.line}`, fontFamily: story ? STORY_SERIF : undefined, animation: 'talk-fly .6s cubic-bezier(.4,.1,.2,1) forwards', transformOrigin: '50% 0' }}>
      <p className="line-clamp-2">{talkPlain(item.text)}</p>
    </div>
  );
}

function Bubble({
  item,
  who,
  newest,
  clamp,
  grow,
  named,
  past,
  maxH,
  onCard,
  onOpen,
  playing: on,
  muted,
  onPlay,
  onReplay,
  onRing,
  shown,
  beat,
  out = false,
  right = false,
  passive = false,
}: {
  /** taps go through it to the screen */
  passive?: boolean;
  /** the speaker stands at the right (M-R249 first person, two partners): the bubble leans and points that way */
  right?: boolean;
  /** M-R249 first person: your words, the tail off the bottom right of the screen (toward you) */
  out?: boolean;
  item: TalkItem;
  who?: TalkPerson;
  newest: boolean;
  clamp?: boolean;
  grow?: boolean;
  /** the speaker's name over it (a group, or a story line by someone else) */
  named?: boolean;
  /** px: at most this tall; a long one scrolls inside */
  maxH?: number;
  /** a line from the past being looked at (M-R241) */
  past?: boolean;
  onCard: () => void;
  onOpen: () => void;
  playing: boolean;
  muted: boolean;
  /** ▶ / ❚❚ on a voice */
  onPlay: () => void;
  /** a tap on the words: say it again (M-R239) */
  onReplay: () => void;
  /** M-R236: a long press opens the ★ / mark ring */
  onRing?: (at: { x: number; y: number }) => void;
  /** M-R238: the words come out (this many characters shown; the rest keeps its place) */
  shown?: number;
  /** M-R243: the shape, and how the sentence being said comes in (key = which sentence) */
  beat?: { shape?: TalkShape; in?: TalkIn; key: number };
}) {
  // the side it leans to and its tail points to: yours at the right; a partner standing at the right (first person with two) too
  const mine = !!who?.self || right;
  const story = useContext(SkinCtx) === 'story';
  const tone = story ? (who?.self ? STORY_ME : STORY_THEM) : toneFor(who);
  const bg = tone.b;
  const ink = tone.ink;
  const line = tone.line;
  const shape = beat?.shape ?? 'round';
  const entry = beat && beat.key >= 0 && beat.in && beat.in !== 'pop' && !past ? beat.in : null;
  const entryAnim = entry === 'slam' ? 'talk-slam .5s cubic-bezier(.2,1.7,.4,1)' : entry === 'slow' ? 'talk-slowin .9s ease-out' : entry === 'shake' ? 'talk-shakeb .45s ease-in-out' : undefined;
  // the shapes (design/talk/proto.html): a jagged shout, a puffy musing cloud, a dotted whisper in a soft hand
  // M-R245: a faint vertical gradient, a 1.5 px line in the same hue, corners each a little different (hand-drawn)
  const box: React.CSSProperties = Object.assign(
    {
      background: `linear-gradient(170deg,${tone.a},${tone.b})`,
      border: `1.5px solid ${line}`,
      borderRadius: '24px 20px 26px 19px / 20px 25px 19px 24px',
      boxShadow: story ? (who?.self ? '0 6px 22px rgba(230,170,70,.35)' : '0 8px 26px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.07)') : '0 1px 0 rgba(255,255,255,.7) inset,0 8px 22px rgba(4,8,30,.32)',
      ...(story ? { borderWidth: 1, borderRadius: who?.self ? '20px 6px 20px 20px' : '6px 20px 20px 20px', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', fontFamily: STORY_SERIF } : {}),
    },
    shape === 'burst'
      ? { borderRadius: 0, clipPath: BURST, boxShadow: 'none', border: 0 }
      : shape === 'cloud'
        ? { borderRadius: '46% 54% 50% 50%/62% 58% 42% 38%' }
        : shape === 'whisper'
          ? { borderStyle: 'dashed', boxShadow: '0 6px 16px rgba(4,8,30,.25)', opacity: 0.95 }
          : {},
  );
  const pad = shape === 'burst' ? 'px-[42px] py-[30px] text-[16px]' : shape === 'cloud' ? 'px-[22px] pb-4 pt-[15px] text-[15px]' : shape === 'whisper' ? 'px-[17px] pb-[13px] pt-3 text-[14px]' : 'px-[17px] pb-[13px] pt-3 text-[15px]';
  return (
    <div className={`${passive ? 'pointer-events-none' : 'pointer-events-auto'} relative flex min-h-0 flex-col ${shape === 'burst' ? 'mx-[-20px] max-w-[min(calc(100%+40px),330px)]' : 'max-w-[min(100%,380px)]'} ${mine ? 'items-end self-end' : 'items-start self-start'} ${grow ? 'flex-1' : ''}`} style={{ animation: newest && !past && !entry ? 'talk-in .35s cubic-bezier(.3,1.4,.5,1) both' : undefined, opacity: newest ? (past ? 0.97 : 1) : 0.86 }}>
      {named && (
        <p className={`mb-1 px-2 text-[10.5px] [text-shadow:0_1px_4px_#000] ${story ? 'tracking-[0.22em]' : 'font-bold tracking-[0.12em]'}`} style={story ? { color: 'rgba(253,230,170,.92)', fontFamily: STORY_SERIF } : { color: tone.a }}>
          {item.name ?? who?.name}
        </p>
      )}
      {item.mark && <StarButton kind={item.mark.kind} id={item.mark.id} size={10} onRing={onRing} className={`absolute -top-1 z-[1] ${mine ? 'left-1' : 'right-1'}`} />}
      <div key={entry ? `in${beat?.key}` : 'still'} className={`relative min-h-0 ${grow ? 'flex flex-col' : ''}`} style={{ animation: entryAnim, rotate: mine ? '.4deg' : '-.5deg', filter: shape === 'burst' ? `drop-shadow(1.5px 0 0 ${line}) drop-shadow(-1.5px 0 0 ${line}) drop-shadow(0 1.5px 0 ${line}) drop-shadow(0 -1.5px 0 ${line}) drop-shadow(0 8px 14px rgba(4,8,30,.3))` : undefined }}>
      <div
        {...(onRing && item.mark ? holdProps(onRing) : {})}
        className={`relative min-h-0 ${grow ? 'flex flex-col' : ''}`}
        style={{ color: ink, ...box }}
      >
        <div className={`${pad} ${story ? 'font-medium' : 'font-bold'} leading-[1.6] ${grow || (maxH && shape !== 'burst') ? 'no-scrollbar min-h-0 overflow-y-auto overscroll-contain' : ''}`} style={{ ...(maxH && shape !== 'burst' ? { maxHeight: maxH } : {}), ...(shape === 'whisper' ? { fontFamily: "'Klee One', " + TALK_FONT, fontWeight: 600 } : {}) }} onClick={clamp ? onOpen : (e) => !(e.target as HTMLElement).closest('button,a') && onReplay()}>
          {item.voice && (
            <button onClick={onPlay} disabled={!item.voice.url} className="flex items-center gap-2 py-0.5" aria-label={on ? '止める' : muted ? '声を消して見る' : '聞く'}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm" style={{ background: `${ink}1f` }}>{on ? '❚❚' : '▶'}</span>
              <span className="flex h-5 items-end gap-[3px]" aria-hidden>
                {Array.from({ length: 9 }, (_, k) => (
                  <span key={k} className="w-[3px] rounded-full" style={{ background: ink, opacity: 0.55, height: `${30 + ((k * 37) % 70)}%`, animation: on ? `talk-nod ${0.5 + (k % 3) * 0.15}s ease-in-out infinite` : undefined }} />
                ))}
              </span>
              {item.voice.seconds != null && <span className="text-xs opacity-70">{Math.max(1, Math.round(item.voice.seconds))}秒</span>}
            </button>
          )}
          {item.text && (
            <p className={`whitespace-pre-line ${clamp ? 'line-clamp-2' : ''} ${item.voice ? 'mt-1 text-[12.5px] opacity-75' : ''}`}>
              <Marked text={item.text} upto={shown} />
              {shown != null && <i className="ml-0.5 inline-block h-[1em] w-[6px] rounded-[2px] align-[-2px] opacity-50" style={{ background: 'currentColor', animation: 'talk-caret .8s steps(2) infinite' }} />}
              {item.live && <i className="ml-0.5 inline-block h-[1em] w-[6px] rounded-[2px] align-[-2px] opacity-50" style={{ background: 'currentColor', animation: 'talk-caret .8s steps(2) infinite' }} />}
            </p>
          )}
          {item.card && !clamp && (
            <button onClick={onCard} className="mt-2 block max-h-[140px] w-full max-w-[180px] overflow-hidden rounded-xl text-left shadow-[0_2px_8px_rgba(0,0,0,.25)]" aria-label="大きく開く">
              {item.card.thumb}
            </button>
          )}
          {item.extra && !clamp && <div className="mt-1.5 space-y-1.5 text-[#f4f1ff]">{item.extra}</div>}
        </div>
        {/* the choices stay in view under a long one (〔星へ飛ばす〕 on a card …) */}
        {item.chips && item.chips.length > 0 && !clamp && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-3 -mt-1">
            {item.chips.map((c) => (
              <button key={c.label} onClick={c.onPick} disabled={c.disabled} className="rounded-full px-3 py-1.5 text-[13px] font-bold disabled:opacity-40" style={{ background: `${ink}1a`, color: ink, boxShadow: `inset 0 0 0 1px ${ink}33` }}>
                {c.label}
              </button>
            ))}
          </div>
        )}
        {/* the tail, toward the speaker (none on the older one, none on a shout; a cloud trails two small puffs) */}
        {newest && shape !== 'burst' && shape !== 'cloud' && (
          // a small curved tail with the same line (M-R245)
          <span
            aria-hidden
            className="absolute bottom-[-11px] h-4 w-4"
            style={{ background: bg, borderRight: `1.5px ${shape === 'whisper' ? 'dashed' : 'solid'} ${line}`, borderBottom: `1.5px ${shape === 'whisper' ? 'dashed' : 'solid'} ${line}`, borderRadius: '0 0 14px 0', [mine ? 'right' : 'left']: out ? '6%' : '20%', transform: out ? 'rotate(20deg) skewX(-34deg) translate(4px,2px)' : mine ? 'rotate(30deg) skewX(-12deg)' : 'rotate(60deg) skewY(12deg)' }}
          />
        )}
      </div>
        {newest && shape === 'cloud' && (
          <>
            <span aria-hidden className="absolute bottom-[-18px] h-[13px] w-[13px] rounded-full" style={{ background: bg, border: `1.5px solid ${line}`, [mine ? 'right' : 'left']: '22%' }} />
            <span aria-hidden className="absolute bottom-[-31px] h-2 w-2 rounded-full" style={{ background: bg, border: `1.5px solid ${line}`, [mine ? 'right' : 'left']: '18%' }} />
          </>
        )}
      </div>
    </div>
  );
}

/** the marks' looks (design/talk/proto.html): always outlined, so they read on any bubble colour */
const DELA = "'Dela Gothic One', " + "'Zen Maru Gothic', sans-serif";
const MARK_STYLE: Record<TalkMark, React.CSSProperties> = {
  b: { fontWeight: 900 },
  big: { fontWeight: 900, fontSize: '1.3em', lineHeight: 1.2 },
  shout: { fontFamily: DELA, fontSize: '1.38em', lineHeight: 1.2, letterSpacing: '.02em' },
  gold: {
    fontFamily: DELA,
    fontSize: '1.32em',
    lineHeight: 1.2,
    background: 'linear-gradient(180deg,#fff6c8 0%,#f2c14e 45%,#b9801c 100%)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    WebkitTextStroke: '1.1px #5a3b06',
    paintOrder: 'stroke fill',
    filter: 'drop-shadow(0 0 1px #5a3b06) drop-shadow(0 0 6px rgba(255,214,110,.8))',
  },
  red: { fontFamily: DELA, fontSize: '1.34em', lineHeight: 1.2, color: '#e0322b', WebkitTextStroke: '.8px #3a0c0a', paintOrder: 'stroke fill' },
  cute: { fontFamily: "'Yusei Magic', 'Zen Maru Gothic', sans-serif", fontSize: '1.18em', color: '#d4567e', letterSpacing: '.03em', textShadow: '0 0 1px #fff, 0 0 2px #fff' },
  eerie: { fontFamily: "'Shippori Mincho', serif", fontWeight: 700, fontSize: '1.08em', letterSpacing: '.12em', color: '#3b3f63', textShadow: '0 0 4px rgba(59,63,99,.45)' },
};

const BURST =
  'polygon(50% 0,57% 9%,68% 2%,71% 12%,84% 8%,82% 19%,96% 20%,89% 31%,100% 40%,90% 48%,99% 60%,88% 64%,93% 78%,80% 77%,79% 91%,67% 84%,60% 98%,52% 87%,42% 99%,37% 86%,24% 94%,23% 81%,9% 84%,13% 70%,0 62%,10% 53%,1% 41%,12% 35%,5% 21%,19% 20%,18% 7%,31% 12%,36% 1%,44% 10%)';

/**
 * M-R243: the words with their marks — **bold** 900, ^^larger^^ 1.3em, !!shout!! Dela Gothic One 1.38em. Rendered as
 * text runs (React escapes them): nothing but these three marks ever becomes markup. `upto`: only that many characters.
 */
export function Marked({ text, upto }: { text: string; upto?: number }) {
  let left = upto ?? Infinity;
  return (
    <>
      {talkRuns(text).map((r, k) => {
        if (left <= 0) return null;
        const chars = [...r.t];
        const part = chars.slice(0, left).join('');
        left -= chars.length;
        if (!r.c) return <span key={k}>{part}</span>;
        const st: React.CSSProperties = MARK_STYLE[r.c];
        return (
          <em key={k} className="not-italic" style={st}>
            {part}
          </em>
        );
      })}
    </>
  );
}

function SpeakerGlyph({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" fillOpacity={0.25} />
      {off ? <path d="M16 9.5l5 5M21 9.5l-5 5" /> : <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />}
    </svg>
  );
}

/** M-R245: your bubble colour, picked once at the first talk (changeable in the settings) */
export function TonePicker({ onPick, current, inline = false }: { onPick: (id: string) => void; current?: string; inline?: boolean }) {
  const list = (
    <div className="flex flex-wrap justify-center gap-2.5">
      {SELF_TONES.map((id) => {
        const t = TONES[id];
        return (
          <button key={id} onClick={() => onPick(id)} aria-label={t.name} aria-pressed={current === id} className="flex flex-col items-center gap-1">
            <span className="block h-10 w-14" style={{ background: `linear-gradient(170deg,${t.a},${t.b})`, border: `1.5px solid ${t.line}`, borderRadius: '16px 13px 17px 12px / 13px 16px 12px 15px', boxShadow: current === id ? `0 0 0 2px #fff, 0 0 0 4px ${t.line}` : undefined }} />
            <span className="text-[10.5px] font-bold" style={{ color: inline ? undefined : '#f4f1ff' }}>{t.name}</span>
          </button>
        );
      })}
    </div>
  );
  if (inline) return list;
  return (
    <div className="absolute inset-x-4 bottom-[128px] z-[26] rounded-[22px] border border-[rgba(210,220,255,.22)] bg-[rgba(10,14,44,.9)] px-4 pb-4 pt-3 backdrop-blur-xl">
      <p className="mb-3 text-center text-[13px] font-bold text-[#f4f1ff]">あなたの吹き出しの色を、えらんでね</p>
      {list}
      <p className="mt-2 text-center text-[10.5px] text-[#b9bde6]">あとから設定で変えられます</p>
    </div>
  );
}
