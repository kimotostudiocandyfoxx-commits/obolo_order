'use client';

import { ruleBeats, talkSentences, type TalkBeat, type TalkFace, type TalkLook, type TalkMotion } from '@obolo/shared';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Figure, TALK_CSS, type FigureState } from './Figure';
import { unlockAudio } from '@/lib/onboarding/audio';
import { playClip, stopClip, type Clip } from '@/lib/voice/webVoice';

const MUTE_KEY = 'obolo.talk.muted';

/**
 * 隣に並ぶトーク (M-R232〜M-R235, docs/story-rewrite/会話の画面.md): the talk where the speakers stand side by side in the
 * lower half (you always at the right), with the place behind them. At most two bubbles over the heads — the new one
 * just above its speaker's head (its tail at them), the one before above it. When a third comes, the top one shrinks
 * into a circle at 12 o'clock of the ring above the two; the ring goes clockwise (12 = newest), eight at most — the
 * rest are in 〔過去の言葉〕 at the left. A circle shows the speaker's small face, the first few characters and their
 * colour (you: blue); a tap opens it as a bubble. From D04-S005c the circles are コロリン (M-R233). A long reply's
 * bubble reaches down and scrolls; a card sits small in its bubble and opens big on a tap. Three or more: everyone
 * in one row (you at the right end), up to five full length, six or more chest up in two rows; the one speaking steps
 * forward and glows; the group's name and count small at the top.
 */
export type TalkPerson = {
  id: string;
  name: string;
  look: TalkLook | null;
  color: string;
  self?: boolean;
  /** a round icon for the small face (else the look's head is cut round) */
  avatar?: string | null;
};

export type TalkItem = {
  id: string;
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
};

const RING_MAX = 8;

/** a line being said: its words come out over `dur`; `cuts` = where each sentence ends (characters) */
type Speech = { id: string; who: string; start: number; dur: number; len: number; cuts: number[]; beats: TalkBeat[]; typed: boolean; mouth: boolean; text: boolean; level?: () => number; clip?: Clip };
function speechOf(it: TalkItem, beats: TalkBeat[], streamed: boolean): Speech {
  const len = [...it.text].length;
  const parts = talkSentences(it.text);
  let c = 0;
  const cuts = parts.map((p) => (c += [...p].length + 1));
  const dur = streamed ? Math.max(900, parts.length * 900) : Math.min(7000, Math.max(1200, len * 75));
  return { id: it.id, who: it.who, start: Date.now(), dur, len: streamed ? cuts[cuts.length - 1] ?? len : len, cuts, beats, typed: !streamed, mouth: !streamed, text: len > 0 };
}
/** where the k-th newest circle sits: degrees from 12 o'clock, clockwise; past 3 o'clock it comes round from the left */
const SLOT = [0, 25, 50, 75, 100, -75, -50, -25];
const LONG = 70;

const reducedQuery = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function TalkScene({
  people,
  items,
  thinking,
  listening = false,
  kororin = false,
  place,
  group,
  composer,
  keyboard = false,
  top = 8,
  fixedSelfFace = false,
  audioSrc,
  onPlayingChange,
  logLabel = '過去の言葉',
  unreadFrom,
  loading = false,
}: {
  people: TalkPerson[];
  items: TalkItem[];
  /** who is making a reply (the 'thinking' face and a slow sway) */
  thinking?: string | null;
  /** you are recording or typing: the others turn to you and nod */
  listening?: boolean;
  /** M-R233: the ring shows コロリン */
  kororin?: boolean;
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
  logLabel?: string;
  /** M-R239: the first unread line (opening plays the last read one and every unread one); none = nothing unread */
  unreadFrom?: number | null;
  /** the lines are still being loaded (what is there when they come counts as already said) */
  loading?: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 390, h: 700 });
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(reducedQuery()), []);

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const self = people.find((p) => p.self);
  const others = people.filter((p) => !p.self);
  const row = self ? [...others, self] : others;
  const n = row.length;
  const isGroup = n >= 3;

  // who talks now (M-R238/M-R239): one line at a time is "said" — its words come out (or its voice plays), the speaker's
  // mouth moves, and each sentence's face and motion come in as the words reach it. Lines can be played in a row (a
  // thread opened with unread lines); a tap goes on to the next line, a long press to the end.
  const [speech, setSpeech] = useState<Speech | null>(null);
  const [hold, setHold] = useState<Record<string, { face: TalkFace; until: number }>>({});
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
  const finish = () => {
    setSpeech((cur) => {
      if (cur) {
        const last = cur.beats[cur.beats.length - 1];
        if (last) setHold((h) => ({ ...h, [cur.who]: { face: last.face, until: Date.now() + 2200 } }));
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
    const k = speech.typed || speech.text ? Math.max(0, speech.cuts.findIndex((c) => c > at * speech.len)) : Math.floor(at * speech.beats.length);
    return { who: speech.who, beat: speech.beats[Math.min(k, speech.beats.length - 1)], k };
  })();
  // a new sentence: its motion, once, and its face
  const lastBeat = useRef<string>('');
  useEffect(() => {
    if (!beatNow?.beat) return;
    const key = `${speech?.id}:${speech?.start}:${beatNow.k}`;
    if (key === lastBeat.current) return;
    lastBeat.current = key;
    const { who, beat } = beatNow;
    if (beat.motion && beat.motion !== 'none') setReact((r) => ({ ...r, [who]: { motion: beat.motion!, key: (r[who]?.key ?? 0) + 1 } }));
    setHold((h) => ({ ...h, [who]: { face: beat.face, until: Date.now() + 99_000 } }));
  });
  // the end: the last face stays a little, then plain again; the next line of a row
  useEffect(() => {
    if (speech && at >= 1) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech, at]);
  const talkingId = liveWho ?? (speech && at < 1 && speech.mouth ? speech.who : null);
  const faces = hold;
  const playing = cursor != null || !!speech;

  // a tap goes on to the next line, a long press to the end (M-R239); any tap also lets the voices sound (iOS)
  const press = useRef(0);
  const onDown = (e: React.PointerEvent) => {
    unlockAudio();
    if ((e.target as HTMLElement).closest('button,a,input,textarea,label')) return (press.current = 0);
    press.current = Date.now();
  };
  const onUp = () => {
    if (!press.current || !playing) return;
    const long = Date.now() - press.current > 550;
    press.current = 0;
    if (long) return skipAll();
    if (cursor != null) {
      const next = cursor + 1;
      after.current = null;
      stopClip();
      setSpeech(null);
      if (next < items.length) playFrom(next);
      else setCursor(null);
    } else finish();
  };
  // before the first play starts (the very first paint), already only up to the line it starts from
  const pending = !seen.current && !loading && unreadFrom != null && unreadFrom >= 0 && unreadFrom < items.length ? Math.max(0, unreadFrom - 1) : null;
  const upTo = cursor ?? pending;
  const visible = upTo == null ? items : items.slice(0, upTo + 1);

  // the two bubbles, the ring, the rest
  const shown = visible.slice(-2);
  const ring = visible.slice(0, -2).reverse().slice(0, RING_MAX);
  const older = visible.length - 2 - ring.length;
  const [opened, setOpened] = useState<TalkItem | null>(null);
  const [big, setBig] = useState<TalkItem | null>(null);
  const [log, setLog] = useState(false);

  // M-R233: the moment the ring becomes コロリン — the rims pop one by one and the コロリン roll out
  const wasK = useRef(kororin);
  const [popAt, setPopAt] = useState(0);
  useEffect(() => {
    if (kororin && !wasK.current) setPopAt(Date.now());
    wasK.current = kororin;
  }, [kororin]);

  // the layout (portrait first)
  const { w, h } = size;
  const composerH = keyboard ? 64 : 104;
  const floor = h - composerH - 6;
  const chest = keyboard || n >= 6;
  const figH = chest ? Math.min(h * 0.24, 200) * (n >= 6 ? 0.78 : 1) : Math.max(110, Math.min(h * (n <= 2 ? 0.4 : n <= 3 ? 0.34 : 0.29), 360, n >= 3 ? (w / n) * 1.6 : 999));
  const rows = n >= 6 ? [row.slice(0, Math.ceil(n / 2)), row.slice(Math.ceil(n / 2))] : [row];
  // x of each person (fractions), the front row last
  const spots = new Map<string, { x: number; bottom: number; h: number; z: number }>();
  rows.forEach((r, ri) => {
    const front = ri === rows.length - 1;
    const hh = figH * (rows.length > 1 ? (front ? 1 : 0.86) : 1);
    const b = rows.length > 1 && !front ? hh * 0.55 : 0;
    r.forEach((p, k) => {
      const x = n === 2 ? (k === 0 ? 0.3 : 0.7) : n === 1 ? 0.5 : (k + 0.5 + (rows.length > 1 && !front ? 0.25 : 0)) / (r.length + (rows.length > 1 && !front ? 0.5 : 0));
      spots.set(p.id, { x, bottom: b, h: hh, z: front ? 2 : 1 });
    });
  });
  const headY = floor - figH * (rows.length > 1 ? 1.5 : 1) + (chest ? 0 : figH * 0.04);
  // the ring: a half ellipse over the bubbles' place (9 → 12 → 3 o'clock), its ends at the sides beside the bubbles
  const cx = w / 2;
  const zone = Math.min(190, Math.max(120, (headY - top) * 0.45));
  const cy = Math.max(top + 110, headY - zone);
  const rx = w / 2 - 30;
  const ry = Math.max(70, Math.min(cy - top - 34, 160));
  const slot = (k: number) => {
    const a = (SLOT[k] * Math.PI) / 180;
    return { x: cx + rx * Math.sin(a), y: cy - ry * Math.cos(a) };
  };
  const last = shown[shown.length - 1];
  const long = !!last && (last.text.length > LONG || !!last.card);
  const bubbleBottom = h - (headY - 6);
  const bubbleTop = cy + 4;

  const stateOf = (p: TalkPerson): FigureState => (thinking === p.id ? 'think' : talkingId === p.id ? 'talk' : listening && !p.self ? 'listen' : 'idle');
  const faceOf = (p: TalkPerson): TalkFace => {
    if (thinking === p.id) return 'thinking';
    const f = faces[p.id];
    const face = f && f.until > now ? f.face : 'normal';
    if (p.self) return fixedSelfFace ? 'normal' : face === 'sad' || face === 'thinking' ? 'normal' : face;
    return face;
  };

  const speakerX = (id: string) => (spots.get(id)?.x ?? 0.5) * w;

  return (
    <div ref={wrap} className="relative min-h-0 flex-1 overflow-hidden" onPointerDown={onDown} onPointerUp={onUp}>
      <style>{TALK_CSS}</style>
      {/* M-R239: the voice is on from the start; a small mute at the top (kept on this device) */}
      <button
        onClick={() => {
          const m = !muted;
          setMuted(m);
          if (m) stopClip();
          try {
            localStorage.setItem(MUTE_KEY, m ? '1' : '0');
          } catch {
            /* no storage */
          }
        }}
        aria-label={muted ? '声を出す' : '声を消す'}
        aria-pressed={muted}
        className="absolute right-2 z-[7] flex h-8 w-8 items-center justify-center rounded-full border border-amber-200/25 bg-black/45 text-amber-100/85 backdrop-blur"
        style={{ top: top + 4 }}
      >
        <SpeakerGlyph off={muted} />
      </button>
      {/* the place, drifting very slowly behind the two (depth) */}
      {place && (
        <div className="absolute inset-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={place} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ animation: reduced ? undefined : 'talk-drift 38s ease-in-out infinite alternate', transform: 'scale(1.08)' }} />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(5,6,15,0.55),rgba(5,6,15,0.05)_45%,rgba(5,6,15,0.65))]" />
        </div>
      )}

      {group && (
        <p className="absolute inset-x-0 z-[6] text-center text-[11px] tracking-[0.2em] text-amber-100/75" style={{ top }}>
          {group.name}・{group.count}人
        </p>
      )}

      {/* the ring (a faint track and the circles), slowly rocking */}
      {ring.length > 0 && !keyboard && (
        <div className="pointer-events-none absolute inset-0 z-[3]">
          <svg className="absolute inset-0 h-full w-full" aria-hidden>
            <path d={`M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`} stroke="rgba(255,236,190,0.16)" strokeWidth="1.2" strokeDasharray="2 6" fill="none" />
          </svg>
          <div className="absolute inset-0" style={{ transformOrigin: `${cx}px ${cy}px`, animation: reduced ? undefined : 'talk-ring 16s ease-in-out infinite' }}>
            {ring.map((it, k) => {
              const p = slot(k);
              const who = byId.get(it.who);
              const fresh = k === 0;
              return (
                <button
                  key={it.id}
                  onClick={() => setOpened(it)}
                  aria-label={`${it.name ?? who?.name ?? ''}：${it.text}`}
                  className="pointer-events-auto absolute"
                  style={{ left: p.x, top: p.y, transform: 'translate(-50%,-50%)' }}
                >
                  <span className="block" style={{ animation: reduced ? undefined : 'talk-ring-up 16s ease-in-out infinite' }}>
                    <span
                      key={`${it.id}-${fresh}`}
                      className="block"
                      style={fresh && !reduced ? { ['--fx' as string]: `${(speakerX(it.who) - p.x) * 0.4}px`, ['--fy' as string]: `${(bubbleBottom > 0 ? h - bubbleBottom - p.y - 90 : 60) * 0.6}px`, animation: 'talk-shrinkin .6s cubic-bezier(.2,.8,.2,1) both' } : undefined}
                    >
                      {kororin ? <Kororin item={it} who={who} k={k} popAt={popAt} reduced={reduced} /> : <Circle item={it} who={who} />}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* the people, side by side (you at the right) */}
      <div className="pointer-events-none absolute inset-x-0 z-[2]" style={{ bottom: h - floor, height: figH * 2 }}>
        {row.map((p, k) => {
          const s = spots.get(p.id)!;
          const lit = isGroup && talkingId === p.id;
          return (
            <div key={p.id} className="absolute bottom-0 -translate-x-1/2 transition-[bottom,left] duration-300" style={{ left: `${s.x * 100}%`, bottom: s.bottom, zIndex: lit ? 5 : s.z }}>
              <Figure
                look={p.look}
                face={faceOf(p)}
                state={stateOf(p)}
                motion={react[p.id]?.motion}
                motionKey={react[p.id]?.key ?? 0}
                toward={p.self ? 'left' : 'right'}
                height={s.h}
                chest={chest}
                // the two breathe at their own pace (in step would look mechanical)
                breath={3.3 + ((k * 0.37) % 0.8)}
                calm={isGroup && !lit && talkingId != null}
                reduced={reduced}
                lit={lit}
                glow={lit ? p.color : undefined}
                level={speech?.who === p.id ? speech.level : undefined}
              />
            </div>
          );
        })}
      </div>

      {/* the two bubbles: the new one just above its speaker's head, the one before above it */}
      <div
        className="pointer-events-none absolute inset-x-0 z-[4] flex flex-col justify-end gap-2 px-3"
        style={long ? { top: bubbleTop, bottom: Math.max(composerH + 20, h - headY - figH * 0.16) } : { bottom: bubbleBottom, maxHeight: Math.max(120, h - bubbleBottom - bubbleTop + 40) }}
      >
        {shown.map((it, k) => {
          const newest = k === shown.length - 1;
          const who = byId.get(it.who);
          return (
            <Bubble
              key={it.id}
              item={it}
              who={who}
              newest={newest}
              clamp={!newest && (long || shown.length > 1)}
              grow={newest && long}
              tailX={speakerX(it.who)}
              width={w}
              onCard={() => setBig(it)}
              onOpen={() => setOpened(it)}
              playing={speech?.id === it.id && !!it.voice}
              muted={muted}
              onPlay={() => (speech?.id === it.id ? finish() : say(it))}
              onReplay={() => say(it)}
              shown={speech?.id === it.id && speech.typed && at < 1 ? Math.floor(at * speech.len) : undefined}
            />
          );
        })}
      </div>

      {/* 〔過去の言葉〕: the whole talk, at the left */}
      {items.length > 2 && (
        <button onClick={() => setLog(true)} className="absolute left-0 z-[6] rounded-r-full border border-l-0 border-amber-200/25 bg-black/45 py-2 pl-1.5 pr-2 text-[10.5px] tracking-[0.12em] text-amber-100/80 backdrop-blur" style={{ top: top + 6 }}>
          ‹ {logLabel}
          {older > 0 && <span className="ml-1 text-amber-200/60">+{older}</span>}
        </button>
      )}

      {composer && <div className="absolute inset-x-0 bottom-0 z-[8]">{composer}</div>}

      {opened && (
        <div className="absolute inset-0 z-[20] flex items-start justify-center bg-black/35 px-4 backdrop-blur-[1px]" style={{ paddingTop: top + 40 }} onClick={() => setOpened(null)}>
          <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <Bubble item={opened} who={byId.get(opened.who)} newest grow tailX={-1} width={w} onCard={() => setBig(opened)} onOpen={() => undefined} playing={speech?.id === opened.id} muted={muted} onPlay={() => say(opened)} onReplay={() => say(opened)} />
            <button onClick={() => setOpened(null)} className="mx-auto mt-2 block rounded-full bg-white/10 px-4 py-1.5 text-[12px] text-amber-50/80">
              とじる
            </button>
          </div>
        </div>
      )}
      {big && (
        <div className="absolute inset-0 z-[22] flex flex-col items-center justify-center bg-black/70 px-4 backdrop-blur" onClick={() => setBig(null)}>
          <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            {big.card?.full ?? big.card?.thumb}
          </div>
          <button className="mt-3 rounded-full bg-white/10 px-5 py-2 text-[13px] text-amber-50/85">とじる</button>
        </div>
      )}
      {log && (
        <div className="absolute inset-0 z-[24] flex bg-black/40" onClick={() => setLog(false)}>
          <div className="h-full w-[84%] max-w-sm overflow-y-auto border-r border-amber-200/15 bg-[#0d0a18]/95 px-3 pb-6 backdrop-blur" style={{ paddingTop: top + 8 }} onClick={(e) => e.stopPropagation()}>
            <p className="mb-2 text-center text-[12px] tracking-[0.2em] text-amber-100/80">{logLabel}</p>
            <div className="space-y-2">
              {items.map((it) => {
                const p = byId.get(it.who);
                return (
                  <button key={it.id} onClick={() => setOpened(it)} className="flex w-full items-start gap-2 text-left">
                    <SmallFace who={p} size={26} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] tracking-[0.18em]" style={{ color: p?.color }}>
                        {it.name ?? p?.name}
                      </span>
                      <span className="line-clamp-3 text-[13px] leading-snug text-amber-50/90">{it.text || (it.voice ? '（声のメッセージ）' : it.card?.label ?? '')}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
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

const firstWords = (t: string, n = 4) => [...t.replace(/\s+/g, '')].slice(0, n).join('');

/** day 2 → Saturn: a plain round rim with the face and the first words */
export function Circle({ item, who }: { item: TalkItem; who?: TalkPerson }) {
  return (
    <span className="flex h-[50px] w-[50px] flex-col items-center justify-center gap-[1px] rounded-full bg-[rgba(14,10,24,0.78)]" style={{ boxShadow: `0 0 0 2px ${who?.color ?? '#fff'}, 0 0 12px ${who?.color ?? '#fff'}55` }}>
      <SmallFace who={who} size={22} />
      <span className="max-w-[44px] truncate text-[9.5px] leading-none text-amber-50/90">{firstWords(item.text || (item.voice ? '♪声' : (item.card?.label ?? '')))}</span>
    </span>
  );
}

/** M-R233: the speaker as a little round コロリン holding the word tag (small sway, a hop now and then) */
export function Kororin({ item, who, k, popAt, reduced }: { item: TalkItem; who?: TalkPerson; k: number; popAt: number; reduced: boolean }) {
  const popping = popAt > 0 && Date.now() - popAt < 4000 && !reduced;
  const delay = k * 0.24;
  const mini = who?.look?.kororin;
  const body = (
    <span className="relative flex flex-col items-center" style={{ animation: reduced ? undefined : `talk-bob ${2.6 + (k % 3) * 0.4}s ease-in-out ${-k * 0.7}s infinite` }}>
      <span className="block" style={{ animation: reduced ? undefined : `talk-kohop ${5 + (k % 4)}s ease-in-out ${-k * 1.3}s infinite` }}>
        {mini ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mini} alt="" className="h-[48px] w-auto" />
        ) : (
          // no mini yet (or the demo / a test): the look's head, cut round, on a little round body
          <span className="relative block h-[46px] w-[44px]">
            <span className="absolute bottom-0 left-1/2 h-[24px] w-[34px] -translate-x-1/2 rounded-[50%]" style={{ background: who?.color ?? '#ccc', boxShadow: 'inset 0 -4px 6px rgba(0,0,0,.25)' }} />
            <span className="absolute left-1/2 top-0 -translate-x-1/2">
              <SmallFace who={who ? { ...who, avatar: null } : undefined} size={32} />
            </span>
          </span>
        )}
      </span>
      <span className="relative z-[1] -mt-3 rounded-md border bg-[#fff7e2] px-1 text-[9px] font-bold leading-[14px] text-[#3a2410] shadow" style={{ borderColor: who?.color }}>
        {firstWords(item.text || (item.voice ? '♪声' : (item.card?.label ?? '')), 3)}
      </span>
    </span>
  );
  if (!popping) return body;
  return (
    <span className="relative block">
      {/* the old rim pops… */}
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="block" style={{ animation: `talk-pop .45s ease-out ${delay}s both` }}>
          <Circle item={item} who={who} />
        </span>
      </span>
      {/* …and the コロリン rolls out */}
      <span className="block" style={{ animation: `talk-roll .7s cubic-bezier(.3,1.2,.5,1) ${delay + 0.25}s both` }}>
        {body}
      </span>
    </span>
  );
}

function Bubble({
  item,
  who,
  newest,
  clamp,
  grow,
  tailX,
  width,
  onCard,
  onOpen,
  playing: on,
  muted,
  onPlay,
  onReplay,
  shown,
}: {
  item: TalkItem;
  who?: TalkPerson;
  newest: boolean;
  clamp?: boolean;
  grow?: boolean;
  tailX: number;
  width: number;
  onCard: () => void;
  onOpen: () => void;
  playing: boolean;
  muted: boolean;
  /** ▶ / ❚❚ on a voice */
  onPlay: () => void;
  /** a tap on the words: say it again (M-R239) */
  onReplay: () => void;
  /** M-R238: the words come out (this many characters shown; the rest keeps its place) */
  shown?: number;
}) {
  const mine = !!who?.self;
  // inside the ring's ends (the circles at 3 and 9 o'clock stay clear)
  const edge = tailX < 0 ? 0 : Math.max(0, width * 0.15 - 12);
  const max = tailX < 0 ? width : Math.min(width - 24 - edge * 2, 300);
  // the bubble leans toward its speaker; the tail points at them
  const left = tailX < 0 ? 0 : mine ? undefined : Math.max(edge, Math.min(tailX - 70, width - max - 24 - edge));
  const right = tailX < 0 || !mine ? undefined : Math.max(edge, Math.min(width - tailX - 70, width - max - 24 - edge));
  const tail = tailX < 0 ? null : mine ? width - 12 - (right ?? 0) - tailX : tailX - 12 - (left ?? 0);
  const bg = mine ? 'linear-gradient(180deg, rgba(64,120,210,0.92), rgba(36,72,150,0.92))' : 'linear-gradient(180deg, rgba(38,28,56,0.92), rgba(16,11,28,0.92))';
  return (
    <div className={`pointer-events-auto relative flex min-h-0 flex-col ${mine ? 'items-end self-end' : 'items-start self-start'} ${grow ? 'flex-1' : ''}`} style={{ marginLeft: left, marginRight: right, maxWidth: max, animation: newest ? 'talk-in .35s cubic-bezier(.2,.8,.2,1) both' : undefined, opacity: newest ? 1 : 0.82 }}>
      {(item.name || !mine) && (
        <p className="mb-0.5 px-2 text-[10px] tracking-[0.2em]" style={{ color: who?.color }}>
          {item.name ?? who?.name}
        </p>
      )}
      <div
        className={`relative min-h-0 rounded-[18px] px-3.5 py-2 text-[15px] leading-[1.6] text-white/95 shadow-[0_6px_18px_rgba(0,0,0,0.35)] ${grow ? 'flex flex-col' : ''}`}
        style={{ background: bg, border: `1px solid ${mine ? 'rgba(170,210,255,0.45)' : `${who?.color ?? '#f0cd8c'}55`}` }}
      >
        <div className={`${grow ? 'no-scrollbar min-h-0 overflow-y-auto overscroll-contain' : ''}`} onClick={clamp ? onOpen : (e) => !(e.target as HTMLElement).closest('button,a') && onReplay()}>
          {item.voice && (
            <button onClick={onPlay} disabled={!item.voice.url} className="flex items-center gap-2 py-0.5" aria-label={on ? '止める' : muted ? '声を消して見る' : '聞く'}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm">{on ? '❚❚' : '▶'}</span>
              <span className="flex h-5 items-end gap-[3px]" aria-hidden>
                {Array.from({ length: 9 }, (_, k) => (
                  <span key={k} className="w-[3px] rounded-full bg-white/70" style={{ height: `${30 + ((k * 37) % 70)}%`, animation: on ? `talk-nod ${0.5 + (k % 3) * 0.15}s ease-in-out infinite` : undefined }} />
                ))}
              </span>
              {item.voice.seconds != null && <span className="text-xs text-white/70">{Math.max(1, Math.round(item.voice.seconds))}秒</span>}
            </button>
          )}
          {item.text && (
            <p className={`whitespace-pre-line ${clamp ? 'line-clamp-2 text-[13.5px]' : ''} ${item.voice ? 'mt-1 text-[12.5px] text-white/65' : ''}`}>
              {shown == null ? item.text : [...item.text].slice(0, shown).join('')}
              {shown != null && <span className="opacity-0">{[...item.text].slice(shown).join('')}</span>}
              {item.live && <span className="ml-0.5 inline-block animate-pulse">▍</span>}
            </p>
          )}
          {item.card && !clamp && (
            <button onClick={onCard} className="mt-1.5 block w-full max-w-[220px] overflow-hidden rounded-xl border border-amber-200/25 text-left" aria-label="大きく開く">
              {item.card.thumb}
            </button>
          )}
          {item.extra && !clamp && <div className="mt-1.5 space-y-1.5">{item.extra}</div>}
          {item.chips && item.chips.length > 0 && !clamp && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {item.chips.map((c) => (
                <button key={c.label} onClick={c.onPick} disabled={c.disabled} className="rounded-full border border-amber-200/45 bg-[rgba(16,11,26,0.62)] px-3 py-1.5 text-[13px] text-amber-50 disabled:opacity-40">
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {newest && tail != null && (
          <span
            aria-hidden
            className="absolute -bottom-[9px] h-[14px] w-[16px]"
            style={{ [mine ? 'right' : 'left']: `min(${Math.max(10, tail)}px, calc(100% - 26px))`, background: mine ? 'rgba(36,72,150,0.92)' : 'rgba(16,11,28,0.92)', clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }}
          />
        )}
      </div>
    </div>
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
