'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { TalkComposer } from '@/components/talk/TalkComposer';
import { talkMuted, TalkScene, type TalkItem, type TalkPerson } from '@/components/talk/TalkScene';
import { batiVoiceUrl, speakable } from '@/lib/atelier/batiSpeak';
import { canPlay, playClip, readyClip, VOICE_WAIT_MS } from '@/lib/voice/webVoice';
import { logVoice } from '@/lib/voice/voiceLog';
import { BATI_COLOR, batiLook, characterLook, SELF_COLOR, selfLook, selfTone } from '@/lib/talk/looks';
import { ApiError, getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { batiLine, batiLineVoiceOf } from '@/lib/onboarding/batiLine';
import { atelierMakeCost, CRAFT_LINES, KIND_HOME_PLANET, spellFrom, spellKey, type SpellTag, type SpellView, HOME_OF_WORK, PLANET_HOMES, TALK_BUBBLE_COLOUR, TALK_COLOR_KEY, type ChangeResult, type Me, changeableById, changeLines, changeRequest, etaMinutes, fillLine, homecomingSay, MOON_LINES, type RefineTarget, type WorkMaterial, MARK_GLYPH, STAR_TIP_AT, STAR_TIP_KEY, STAR_TIP_LINE, TALK_FIXED_FACE_KEY, type BluenaPlanet, type ItemMarkId, SPELL_TOOL_LINES, TOOL_STORY_LINES, bookMatch, findSpell, shouldSuggestBook, spellScore, spellFrom as spellFromWords, type CompassSpell, type SavedSpell, type SpellBookKind } from '@obolo/shared';
import { useMarkRing } from '@/components/finds/MarkRing';
import { viewsOf } from '@/lib/story/views';
import { markNames } from '@/lib/finds/marks';
import { findAll, PLANET_NAME, workMarkRef } from '@/lib/finds/works';
import { daysUntil, isOpen, KINDS, lockLine, openKinds, openLessons, type AtelierKind, type Lesson } from '@/lib/atelier/unlock';
import { historyOf, recentRequest } from './carry';
import { usePartner } from '@/lib/partner';
import { useAtelierCtx } from './ctx';
import { ASK, DONE, detect, greetingOf, isBare, KIND_WORD, wantsPicture } from './intent';
import { dropTry, fly, failLine, keep, keepFace, keepShow, make, wear, type MakeOpts } from './makers';
import { asMaterial, fromMaterial, PROPOSAL_ASK, proposalFor, usesOf } from './material';
import { dragLine } from './proposal';
import { saveTalk, talks, type Talk } from './shelf';
import { countdown, jobView, msLeft, onJobs, watchJob } from '@/lib/atelier/jobs';
import { dayOf } from '@/lib/finds/spiral';
import { nextLine } from '@/lib/atelier/lineTurn';
import { cues, withWords, type StoryMode } from './story';
import { contentOf } from './intent';
import { toggleAudio } from '@/lib/audio';
import { Teach } from './Teach';
import { KindMark, WorkCard } from './WorkCard';
import { ChangePreview } from './ChangePreview';
import { DeviceButton } from './DeviceButton';
import { clipItem } from './BluenaClip';
import { useClipSend } from '@/lib/clip/useClip';
import { BowlFx, TEMPLE_PLATE, type BowlState } from './BowlFx';
import { faceTo, FLIES, uid, versionsOf, type Msg, type Work } from './work';
import { isYes, planOf, spellKindOf, type Plan } from './plan';
import { FloatingSpell, floatLayout, MANA_H, SpellRecord, type FloatSpell } from './FloatingSpell';
import { spellLookFor } from './spellLooks';
import { useGameBroken } from './GamePlay';
import { BatiCompass, SpellBookFloat, BOOK_PER_PAGE, type BookMode, type BookSaving, type CompassPhase } from './BatiTools';
import { bookAt, bookKindOf, compassAt, saveToolMemory, toolMemory, toolStep, type ToolAsk } from './tools';
import { uploadClip } from '@/lib/clip/useClip';
import { craftAnswer, craftBegin, craftConfirmLine, craftDoneLines, craftSpellKind, craftStartLine, isCraftKind, wantsNew, type CraftAsk } from './craft';

const SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
const TAUGHT_KEY = 'obolo.atelier.taught';
// client 2026-11-25: each kind's home planet from the one shared map
const PLANET_OF = KIND_HOME_PLANET as Record<string, string>;
const PLANET_WORD = Object.fromEntries(Object.entries(KIND_HOME_PLANET).map(([k, p]) => [k, PLANET_NAME[p]])) as Record<string, string>;
const LESSON_OF: Partial<Record<AtelierKind, Lesson>> = { voice: 'voice', art: 'art', song: 'song', video: 'video', radio: 'radio' };
// PLACEHOLDER (P-ATELIER-5): {bati}'s line when the words were not understood (iPad feedback: no longer the opening)
const HELLO = 'なにをする？ ことばで頼んでね';
/** this visit has greeted already (the first new talk of a visit, after earlier talks, is 「おかえり！」) */
const VISIT_KEY = 'obolo.atelier.visit';
const USE = '使う';
const NEW_TODAY = '今日は新しく';
const PROPOSED_KEY = 'obolo.atelier.proposed';
/** client 2026-11-24: the morning offer is off (never steering toward making) */
const OFFER_ON_MORNING: boolean = false;

/** M-R253: the cards as they are now, for a card opened big (the talk keeps a copy of what was opened) */
const Cards = createContext<{ get: (id: string) => Work | undefined; render: (w: Work) => React.ReactNode }>({ get: () => undefined, render: () => null });
function LiveCard({ id, fallback }: { id: string; fallback: Work }) {
  const c = useContext(Cards);
  return <>{c.render(c.get(id) ?? fallback)}</>;
}

/**
 * a fresh talk with {bati}: iPad feedback — it opens with a short greeting only (やっほー！ / やっほー、{neo}！ / おかえり！),
 * no question and no row of kinds; what to make is asked in words. `bati`: {bati}'s manner (none: KIMORIN, as written).
 */
export function newTalk(me: Pick<Me, 'displayName' | 'bati'> | null | undefined, bati = true): Talk {
  let returning = false;
  try {
    // the visit's first talk (its start is kept; a second call at once — React's strict mode — is the same talk)
    const start = Number(sessionStorage.getItem(VISIT_KEY)) || 0;
    if (!start) sessionStorage.setItem(VISIT_KEY, String(Date.now()));
    returning = (!start || Date.now() - start < 1500) && talks().length > 0;
  } catch {
    /* no memory: the plain greeting */
  }
  const tpl = greetingOf({ neo: me?.displayName, returning, turn: returning ? 0 : Number(nextLine('hello', ['0', '1'] as const)) });
  const text = fillLine(bati ? batiLine(tpl, batiLineVoiceOf(me?.bati)) : tpl, { neo: me?.displayName ?? '' });
  return { id: uid(), at: new Date().toISOString(), msgs: [{ id: uid(), who: 'bati', text }] };
}

/** R11: a plan waiting for the member's yes (the message its card is on, what is made with it, its price) */
type PlanAsk = { id: string; plan: Plan; prompt: string; prev?: Work; opts: MakeOpts; price: number };
/** client 2026-11-25: {bati}'s questions for a book / a game (`craft`), and a book / a game just made (its next words change it: `after`) */
type Pending = { kind: AtelierKind } | { radioName: string } | { voiceAgain: true } | { use: AtelierKind; materials: Work[] } | { plan: PlanAsk } | { craft: CraftAsk } | { after: Work } | { tool: ToolAsk; spell?: SavedSpell; forKind?: AtelierKind; content?: string } | null;
/** R12: {bati}'s tool out in the sky (the compass while it reads; the spell book open, or taking a spell in) */
type ToolShow = { kind: 'compass'; phase: CompassPhase; leaving?: boolean; key: number } | { kind: 'book'; mode: BookMode; page: number; spells: SavedSpell[]; saving?: BookSaving; key: number } | null;

/** a fresh id for one yes (MakeConfirm.id: a UUID) */
function yesId(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * 月で作る (client M-R210/M-R211): one {bati} chat for everything — your look, {bati}'s dress-up / 変身, lookups, pictures,
 * then コロリン → アート → 曲 → 映像 → ラジオ as the journey's days open them. You ask in words; the result comes into the talk
 * as a card (〔再生〕〔やり直し〕〔星へ飛ばす〕) and is in Bluena at once. A change is asked in words too ("もっと明るく", or
 * pointing at the part on the card first) and is stacked inside the same card (M-R253; 「新しく作って」 makes a new one).
 * A slow one says when to come back and is finished by the app's job host wherever you are; on the morning a kind opens
 * {bati} offers earlier works as material; works back home from their planets are reported here. The chat never changes its look while something is made. This is {bati}'s thread in the shell
 * (Shell.tsx: left = the conversations, right = Bluena from day 3). Opened from a story step it plays the day's script
 * lines at their moments and hands what was made back to the story (`story`, story.ts).
 */
export function AtelierChat({ first, talk, story, onList, unread, onBack, welcome, banner, onDevice }: { first: AtelierKind | null; talk: Talk; story?: StoryMode; /** R10: the Bluena device (bottom left, beside the mic) */ onDevice?: () => void; /** the Moon chat's tabs, just under the bar (MoonTabs) */ banner?: React.ReactNode; /** M-R253 §6 ⑤: opened from the toast / the push — {bati}'s word for coming back */ welcome?: boolean; /** the shell's drawers, from the talk's top bar */ onList?: () => void; unread?: boolean; onBack?: () => void }) {
  const { me, setMe } = useAuth();
  const own = usePartner();
  // in a story step the story's {bati} talks (the review page has no account: its {bati} is the story's)
  const partner = story ? { ...own, name: story.speaker('バティ').name, face: story.speaker('バティ').avatar ?? own.face } : own;
  const day = me?.journeyDay;
  const talkId = talk.id;
  const [msgs, setMsgs] = useState<Msg[]>(() => (story ? (story.works ?? []).map((work) => ({ id: uid(), who: 'work' as const, work })) : talk.msgs));
  const lines = cues(story?.lines);
  const [busy, setBusy] = useState(false);
  /** 〔星へ飛ばす〕: the work flying up for a moment (its kind) */
  const [launch, setLaunch] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [bar, setBar] = useState(0);
  const [talkState, setTalkState] = useState({ listening: false, keyboard: false });
  const held = useRef(new Map<string, { blob: Blob; seconds: number }>());
  const lastSong = useRef<string | undefined>(undefined);
  const realCtx = useAtelierCtx();
  const test = !!story?.test;
  const ctx = useMemo(() => (test ? { ...realCtx, test } : realCtx), [realCtx, test]);

  // the talk is kept for the left drawer (the works themselves are in Bluena)
  useEffect(() => {
    if (story?.mode === 'fly') return;
    // a card waiting for its job is kept (it is finished later, wherever you are: M-R253 §4)
    saveTalk({ id: talkId, at: new Date().toISOString(), msgs: msgs.filter((m) => m.who !== 'work' || m.work.status !== 'making' || !!m.work.job) });
  }, [msgs, talkId]);

  // {bati}'s own lines in its personality's manner (M-R216); KIMORIN (no {bati} yet) as written
  const batiVoice = own.isBati ? batiLineVoiceOf(me?.bati) : undefined;
  const say = (text: string, chips?: string[], found?: Work[]) => setMsgs((m) => [...m, { id: uid(), who: 'bati', text: story ? story.voice('バティ', text) : batiLine(text, batiVoice), chips, found }]);
  const ring = useMarkRing();
  /** M-R253 §6: an official line in {bati}'s manner, then its placeholders */
  const tline = (tpl: string, vars: Record<string, string | number | undefined> = {}) => fillLine(story ? story.voice('バティ', tpl) : batiLine(tpl, batiVoice), { neo: me?.displayName ?? '', ...vars });
  const sayT = (tpl: string, vars: Record<string, string | number | undefined> = {}, chips?: string[], fix: [string, string][] = []) => {
    let text = tline(tpl, vars);
    for (const [a, b] of fix) text = text.replace(a, b);
    setMsgs((m) => [...m, { id: uid(), who: 'bati', text, chips }]);
  };
  // ② when to come back — R11 (client): to this talk; {bati} never tempts you elsewhere meanwhile
  const backLine = (kind: AtelierKind, ms: number) => {
    const n = etaMinutes(ms);
    if (kind === 'video') return sayT(MOON_LINES.backBig, { n });
    if (kind === 'song') return sayT(nextLine('back-song', [MOON_LINES.backSong, ...MOON_LINES.back]), { n });
    return sayT(nextLine('back', MOON_LINES.back), { n });
  };
  /**
   * R11 (client): {bati} casts — it goes to the left and casts into the bowl (which glows) for at least `ms`; it stays
   * there while a quick making runs, and comes back to the middle once a slow one is under way (the bowl shimmers)
   */
  const [castTill, setCastTill] = useState(0);
  const castNow = (ms = 1800) => {
    const t = Date.now() + ms;
    setCastTill(t);
    setTimeout(() => setCastTill((x) => (x === t ? 0 : x)), ms + 30);
  };
  const lates = useRef(new Map<string, number>());

  /** M-R236: 「★がついた曲、見せて」 — your works with that ★ / mark, as cards in the talk */
  const showFound = async (f: { star: boolean; mark?: ItemMarkId; planet?: BluenaPlanet }) => {
    setBusy(true);
    try {
      const list = (await findAll({ star: f.star || undefined, mark: f.mark, planet: f.planet })).slice(0, 12);
      // PLACEHOLDER (P-FINDS-1): {bati}'s words around what it found
      const what = `${f.star ? '★' : ''}${f.mark ? (markNames()[f.mark] || MARK_GLYPH[f.mark]) : ''}`;
      if (!list.length) say(`${what}がついたのは、まだないみたい`);
      else say(`${what}がついた${f.planet ? (PLANET_NAME[f.planet] + 'の') : ''}作品、これだよ！`, undefined, list.map((x) => x.work));
    } finally {
      setBusy(false);
    }
  };

  // M-R236 §4: the first time there are five works, {bati} tells about ★ and marks — once
  const tipped = useRef(false);
  const tipCheck = useCallback(async () => {
    if (tipped.current || story || !me || me.story?.[`sys.${STAR_TIP_KEY}`] === '1') return;
    const n = (await findAll({}).catch(() => [])).length;
    if (n < STAR_TIP_AT || tipped.current) return;
    tipped.current = true;
    say(STAR_TIP_LINE);
    void getApi()
      .saveSysStory({ [STAR_TIP_KEY]: '1' })
      .then(setMe)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, story]);
  /** a script line, word for word in its speaker's manner (then the made words in it, then the story's placeholders) */
  const line = (cue: keyof typeof lines, words = '') => {
    for (const l of lines[cue] ?? []) setMsgs((m) => [...m, { id: uid(), who: 'bati', speaker: l.who, text: story!.fill(withWords(story!.voice(l.who, l.text), words)) }]);
    return !!lines[cue]?.length;
  };
  const put = (w: Work) => setMsgs((m) => (m.some((x) => x.who === 'work' && x.work.id === w.id) ? m.map((x) => (x.who === 'work' && x.work.id === w.id ? { ...x, work: w } : x)) : [...m, { id: `m-${w.id}`, who: 'work', work: w }]));
  /** a card finished later (a redo, a slow one) comes to the end of the talk, so it is in view again */
  const putLast = (w: Work) => setMsgs((m) => [...m.filter((x) => !(x.who === 'work' && x.work.id === w.id)), { id: `m-${w.id}`, who: 'work', work: w }]);
  const cardOf = (id: string) => msgsRef.current.find((m): m is Extract<Msg, { who: 'work' }> => m.who === 'work' && m.work.id === id)?.work;
  const msgsRef = useRef(msgs);
  msgsRef.current = msgs;
  // §3: works chosen as material for the next thing made (from {bati}'s proposal, or dragged in from Bluena)
  const [mats, setMats] = useState<Work[]>([]);
  const [peek, setPeek] = useState<Work | null>(null);
  const matsRef = useRef(mats);
  matsRef.current = mats;
  const lastWork = () => [...msgs].reverse().find((m): m is Extract<Msg, { who: 'work' }> => m.who === 'work' && m.work.status !== 'making')?.work;

  const start = useCallback(
    async (kind: AtelierKind, prompt: string, prev?: Work, opts: MakeOpts = {}) => {
      setBusy(true);
      if (story) {
        line(prev ? 'refine' : 'react');
        line('spell', prompt);
      }
      const materials = opts.materials ?? (prev ? undefined : mats.length ? mats : undefined);
      if (materials) setMats([]);
      const id = prev?.id ?? uid();
      // M-R253 §1: a redo is made inside the same card (its tries stay; the new one comes on top)
      const shell: Work = prev
        ? { ...prev, status: 'making', versions: versionsOf(prev), target: opts.target, job: undefined }
        : { id, kind, prompt, status: 'making', materials: materials?.map(asMaterial), origin: { thread: 'bati', talkId, msgId: `m-${id}`, day: dayOf(new Date().toISOString()), at: new Date().toISOString() } };
      put(shell);
      try {
        const made = await make(kind, prompt, { ...ctx, lastSongId: lastSong.current }, prev, { ...opts, materials });
        const { started, ...res } = made;
        if (started) {
          // §4: slow → {bati} says when to come back; the card counts down; the app's host finishes it
          const ms = msLeft(started.job);
          const long = ms > 30_000;
          const card: Work = { ...shell, ...(prev ? {} : { prompt: res.prompt, title: res.title }), ref: res.ref ?? shell.ref, job: { id: started.job.id, long } };
          watchJob({ jobId: started.job.id, what: started.what, card, talkId, toast: long, words: started.words, extra: started.extra, since: Date.now() }, started.job);
          put(card);
          if (long) backLine(kind, ms);
          return;
        }
        if (res.status === 'failed') {
          // a redo that could not be made: the work stays as it was
          put(prev ?? { ...res, id: shell.id });
          if (!(story && line('fail')) && res.note && !res.image) say(res.note);
          return;
        }
        const w = res.status === 'ready' ? await keep(prev ? shell : undefined, { ...res, id: shell.id, materials: shell.materials, origin: shell.origin }, opts.target) : { ...res, id: shell.id, materials: shell.materials, origin: shell.origin };
        if (w.ref?.songId) lastSong.current = w.ref.songId;
        if (prev) putLast(w);
        else put(w);
        afterMade(w, prompt);
      } catch (e) {
        put(prev ?? { ...shell, status: 'failed', note: failLine(e) });
        if (prev) say(failLine(e));
        if (story) line('fail');
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, mats],
  );

  /**
   * R11 (client): a making. Free → at once. One that spends mana never starts on the ask: a vague ask gets one question
   * (a few ideas inside the sentence); otherwise {bati} lays out the spell (its talismans float over the bowl, the mana
   * under them) and asks; a yes in words (「OK」「いいよ」「作って」) casts it, other words change it — no buttons.
   */
  const run = (kind: AtelierKind, prompt: string, prev?: Work, opts: MakeOpts = {}) => {
    const cost = story?.test ? null : atelierMakeCost(kind, day, kind === 'game' && !!prev);
    if ((!cost && !(isCraftKind(kind) && !story)) || opts.confirm) return start(kind, prompt, prev, opts);
    if (!prev && !opts.materials?.length && isBare(prompt)) {
      setPending({ kind });
      return sayT(MOON_LINES.ask[kind as keyof typeof MOON_LINES.ask] ?? ASK[kind]);
    }
    return propose(kind, prompt, prev, opts);
  };
  const manaNow = () =>
    getApi()
      .wallet()
      .then((w) => w.manaBalance)
      .catch(() => null);
  /**
   * the spell (スペル): fresh for the words, or `before` changed by them (`view`: a change already made). Its talismans
   * float in the sky over the bowl (FloatingSpell, the scene's `stage`); the talk keeps 「じゃあ、こういうスペルになるね。」
   * with a small record of it, and {bati}'s question 「このスペルで作る？　それとも、どこか変える？」
   */
  const propose = async (kind: AtelierKind, said: string, prev: Work | undefined, opts: MakeOpts, before?: PlanAsk, view?: SpellView, extra?: { lead?: [string, Record<string, string>?]; from?: 'compass' | 'book' }) => {
    // client 2026-11-25: a book's spell is free (no mana words), a game's tweak costs its own; a chapter has its own spell
    const craft = isCraftKind(kind);
    const cost = atelierMakeCost(kind, day, kind === 'game' && !!prev) ?? (craft ? { kind: 'game' as const, mana: 0 } : null);
    const sk = craftSpellKind(kind, prev) ?? spellKindOf(kind);
    if (!cost || !sk) return start(kind, said, prev, opts);
    if (before) setMsgs((m) => m.map((x) => (x.id === before.id && x.who === 'bati' && x.plan ? { ...x, plan: { ...x.plan, done: 'changed' as const } } : x)));
    setBusy(true);
    const asked = before || craft ? said : prev ? `${prev.prompt}。${said}` : said;
    // a game's change edits the spell it was cast with (「もっと難しく」); a chapter's spell is fresh from the words
    const was = before ? before.plan.tags : kind === 'game' && prev?.spell?.length ? prev.spell : undefined;
    const v =
      view ??
      (await getApi()
        .moonSpell({ kind: sk, said: asked.slice(0, 200) || 'おまかせ', ...(was ? { tags: was } : {}) })
        .catch((): SpellView => (before ? { tags: before.plan.tags, added: [], removed: [] } : { tags: spellFrom(sk, asked), added: [], removed: [] })));
    const [have] = await Promise.all([manaNow()]);
    setBusy(false);
    const plan = planOf(kind, v);
    const id = uid();
    const text = extra?.lead ? tline(extra.lead[0], extra.lead[1]) : tline(before ? MOON_LINES.replan : MOON_LINES.plan);
    setMsgs((m) => [...m, { id, who: 'bati', text, plan: { kind, tags: plan.tags, price: cost.mana, have } }, { id: uid(), who: 'bati', text: tline(craft ? craftConfirmLine(kind, prev) : MOON_LINES.confirm) }]);
    setFloating((f) => ({ id: before && f ? f.id : id, kind, look: spellLookFor(kind), tags: plan.tags, removed: before ? plan.removed : [], price: cost.mana, have, from: extra?.from }));
    hinted.current.clear();
    // a redo is asked with the change's own words (the card's words carry over); a new one with the spell's
    setPending({ plan: { id, plan, prompt: craft ? (before ? `${before.prompt}、${said}` : said) : prev ? (before ? `${before.prompt}、${said}` : said) : plan.words, prev, opts, price: cost.mana } });
  };
  /** the spell floating over the bowl (from its first showing through its changes, until it is cast) */
  const [floating, setFloating] = useState<FloatSpell | null>(null);
  /** a talisman tapped: it wobbles; {bati} says, once a talisman, how to take it off (no ✕, no buttons) */
  const hinted = useRef(new Set<string>());
  const tapTag = (t: SpellTag) => {
    if (hinted.current.has(t.en) || hinted.current.size >= 2) return;
    hinted.current.add(t.en);
    sayT(MOON_LINES.tapHint, { tag: t.ja });
  };
  /** the cast: the talismans fly down into the bowl, then they are gone */
  const castSpell = () => {
    setFloating((f) => (f ? { ...f, removed: [], casting: true } : f));
    setTimeout(() => setFloating((f) => (f?.casting ? null : f)), 2200);
  };
  const markPlan = (id: string, done: 'yes' | 'changed' | 'short') => setMsgs((m) => m.map((x) => (x.id === id && x.who === 'bati' && x.plan ? { ...x, plan: { ...x.plan, done } } : x)));
  const accepted = useRef(new Set<string>());
  /** the yes: enough mana → charged with this yes and started ({bati} casts); not enough → said, and (members) the gems */
  const accept = async (pa: PlanAsk) => {
    if (accepted.current.has(pa.id)) return;
    accepted.current.add(pa.id);
    setPending(null);
    markPlan(pa.id, 'yes');
    const have = await manaNow();
    if (have != null && have < pa.price) {
      markPlan(pa.id, 'short');
      setFloating(null);
      sayT(MOON_LINES.noMana, { short: pa.price - have });
      // no story here: only a member is offered the mana gems (NoManaNotice)
      window.dispatchEvent(new CustomEvent('obolo:nomana', { detail: { plain: true } }));
      return;
    }
    sayT(isCraftKind(pa.plan.kind) ? craftStartLine(pa.plan.kind) : MOON_LINES.start);
    castNow();
    castSpell();
    const sk = craftSpellKind(pa.plan.kind, pa.prev) ?? spellKindOf(pa.plan.kind);
    // R12: the spell just cast (「しまっておいて」 keeps it; a happy word once its work is done may bring the offer)
    const bk = bookKindOf(sk);
    lastCast.current = bk ? { kind: bk, tags: pa.plan.tags, done: false } : lastCast.current;
    void start(pa.plan.kind, pa.prompt, pa.prev, { ...pa.opts, plan: pa.plan, confirm: { id: yesId(), price: pa.price, ...(sk ? { spell: spellKey(sk, pa.plan.tags) } : {}) } });
  };

  /** what is said once a card is made */
  const afterMade = (w: Work, prompt: string) => {
    if (story) {
      // the card sings (a kororin), then the script's own words after it
      if (line('sing', w.text ?? prompt) && w.audio) void toggleAudio(w.audio).catch(() => undefined);
      if (w.status === 'ready') line('saved');
      // R12 (day 4): {bati} keeps the spell of the art just made in its spell book (shown once)
      if (w.status === 'ready' && lines.book?.length) introBook(w, prompt);
      line('after');
      line('fix');
    } else if (isCraftKind(w.kind) && w.status === 'ready') {
      // client 2026-11-25: a chapter / a game made — {bati} asks what next; the next words change it (or start a new one)
      for (const l of craftDoneLines(w)) sayT(l.text, l.vars);
      if (!w.book?.done) setPending({ after: w });
    } else if (DONE[w.kind]) say(DONE[w.kind]);
    if (w.status === 'ready' && !story) void tipCheck();
    // R12: a work of the spell just cast is done (a happy word about it may bring {bati}'s offer to keep the spell)
    if (w.status === 'ready' && !story && lastCast.current && !lastCast.current.done) {
      lastCast.current = { ...lastCast.current, done: true };
      const m = toolMemory();
      saveToolMemory({ ...m, works: m.works + 1 });
    }
  };

  const sayTRef = useRef(sayT);
  sayTRef.current = sayT;
  const afterRef = useRef(afterMade);
  afterRef.current = afterMade;
  // M-R253 §4: the app's job host says how this talk's slow cards are doing
  useEffect(
    () =>
      onJobs((e) => {
        if (!e || !msgsRef.current.some((m) => m.who === 'work' && m.work.id === e.w.card.id)) return;
        const sayT = sayTRef.current;
        const n = etaMinutes(msLeft(e.job));
        if (e.kind === 'late') {
          // ③ a quick one is waited in place: no time, no "late"; the second delay has its own line
          if (!e.w.toast) return;
          const k = (lates.current.get(e.job.id) ?? 0) + 1;
          lates.current.set(e.job.id, k);
          sayT(k >= 2 ? MOON_LINES.late2 : nextLine('late', MOON_LINES.late), { n });
        } else if (e.kind === 'retrying') sayT(e.w.toast ? nextLine('retry', MOON_LINES.retry) : MOON_LINES.retryQuick, { n });
        else if (e.kind === 'done' && e.work) {
          if (e.work.ref?.songId) lastSong.current = e.work.ref.songId;
          putLast(e.work);
          // ⑤ a slow one: {bati}'s word for coming back to it; a quick one: as any card
          if (e.w.toast && !story) sayT(nextLine('welcome', MOON_LINES.welcome));
          if (!(e.w.toast && !story) || isCraftKind(e.work.kind)) afterRef.current(e.work, e.w.words);
        } else if (e.kind === 'failed') {
          const before = e.w.card.versions?.length ? faceTo({ ...e.w.card, status: 'ready', job: undefined }, e.w.card.versions.length - 1) : { ...e.w.card, status: 'failed' as const, job: undefined, note: undefined };
          // a game that could not be made: the one before stays (its mana is back: the server gave it)
          put(isCraftKind(e.w.card.kind) ? { ...e.w.card, status: e.w.card.game ? 'ready' : 'failed', job: undefined } : before);
          // ④ two failures in a row: the re-try stops
          sayT(isCraftKind(e.w.card.kind) ? CRAFT_LINES.gameBroken : MOON_LINES.stop);
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // client 2026-11-25: the maker's game did not run in its sandbox → {bati} says so, and its mana goes back
  useGameBroken((d) => {
    if (story) return;
    void getApi()
      .gameBroken(d.gameId, { version: d.version, reason: d.reason })
      .then((r) => sayTRef.current(r.refunded ? CRAFT_LINES.gameBroken : CRAFT_LINES.failed))
      .catch(() => sayTRef.current(CRAFT_LINES.failed));
  });

  /** a kind asked for (by words or a chip): locked → the day it opens; only its name → what should it be */
  const ask = (kind: AtelierKind, content: string) => {
    // a story step makes its kind whatever day the review page plays
    if (story) {
      setPending({ kind });
      const opened = line('open');
      // R12 (day 4): {bati} shows its compass for a moment
      if (line('compass')) showCompass('open', 3800);
      return opened;
    }
    // R12 (client): not open yet → the kind by name and the day it opens (「絵は、4日目から作れるようになるよ。」)
    if (!isOpen(kind, day)) return setMsgs((m) => [...m, { id: uid(), who: 'bati', text: lockLine(kind, day, batiVoice?.personality ?? 'genki') }]);
    // R12: only the kind named (「画像を作りたい」) → what was asked for a few turns ago (「空飛ぶクジラが…」)
    if (isBare(content)) {
      const r = recentRequest(msgsRef.current);
      if (r && r.what === kind && r.content) content = r.content;
    }
    // client 2026-11-25: a book / a game starts with {bati}'s 2–4 short questions
    if (isCraftKind(kind)) return craftAsk(craftBegin(kind, content, isBare(content)));
    // R12: a kept spell that fits the words — {bati} offers it now and then (「スペルブックの『…』をもとにする？」)
    if (suggestFromBook(kind, content)) return;
    // R11: one that spends mana: {bati}'s question or plan first (run)
    if (atelierMakeCost(kind, day)) return void run(kind, content);
    if (isBare(content)) {
      setPending({ kind });
      return say(ASK[kind]);
    }
    void run(kind, content);
  };

  /**
   * M-R263 (月の工房 §7): a change of something {bati} can change (the registry: @obolo/shared changeables). A choice →
   * it is changed at once and a card shows it (〔元に戻す〕); one that is not there → the nearest few; none → which one.
   * Returns false when the words are not about a changeable thing.
   */
  const changeAsk = (text: string, chipped = false): boolean => {
    const r = changeRequest(text);
    if (!r) return false;
    if ('ask' in r) {
      say(changeLines.ask(r.item), (r.item.offer?.(r.item.choices) ?? r.item.choices).map((c) => r.item.chip(c)));
      return true;
    }
    if ('near' in r) {
      say(changeLines.near(r.asked, r.near), r.near.map((c) => r.item.chip(c)));
      return true;
    }
    void chipped;
    setBusy(true);
    // R11: a change is cast into the bowl too
    castNow();
    getApi()
      .setChangeable(r.item.id, r.choice.id)
      .then((res) => {
        bubbleNow(res.id, res.to);
        setMsgs((m) => [...m, { id: uid(), who: 'bati', text: batiLine(r.item.doneLine(r.choice), batiVoice), changed: res }]);
      })
      .catch(() => say('いまは、うまく変えられなかった。もう一回言ってみて'))
      .finally(() => setBusy(false));
    return true;
  };
  /** iPad feedback: your bubble colour changed by {bati} shows at once (the server keeps it as Me.story 'sys.talk_color') */
  const bubbleNow = (id: ChangeResult['id'], to: string) => {
    if (id !== TALK_BUBBLE_COLOUR.id || !me) return;
    setMe({ ...me, story: { ...(me.story ?? {}), [TALK_COLOR_KEY]: to } });
  };
  /** 〔元に戻す〕 on a change card: the same change back to what it was */
  const undoChange = (msgId: string) => {
    const m = msgs.find((x): x is Extract<Msg, { who: 'bati' }> => x.id === msgId && x.who === 'bati');
    const ch = m?.changed;
    const item = ch ? changeableById(ch.id) : undefined;
    if (!ch || !item || ch.undone) return;
    setBusy(true);
    getApi()
      .setChangeable(ch.id, ch.from)
      .then(() => {
        bubbleNow(ch.id, ch.from);
        setMsgs((l) => [...l.map((x) => (x.id === msgId && x.who === 'bati' && x.changed ? { ...x, changed: { ...x.changed, undone: true } } : x)), { id: uid(), who: 'bati', text: batiLine(item.undoneLine(item.choices.find((c) => c.id === ch.from) ?? item.choices[0]), batiVoice) }]);
      })
      .catch(() => say('いまは、戻せなかった……'))
      .finally(() => setBusy(false));
  };

  /**
   * client 2026-11-24 (iPad, R7): {bati} answers in the talk itself — a question, a worry, a chat — through the buddy
   * (short, plain words; a health question gets kind general words and "see a doctor if it goes on", never a
   * diagnosis), then a picture as a picture bubble when one fits (never for a worry or a danger). No card to open.
   */
  const converse = async (text: string) => {
    setBusy(true);
    let handoff: AtelierKind | null = null;
    try {
      // R12 (client: "it forgets the message from two turns ago"): the talk itself goes with the message — the last 20
      // turns, the app's own lines and the cards made included — and the same call says when it is a making request
      const history = historyOf(msgsRef.current);
      const r = await Promise.race([getApi().buddyChat(text, 'ja', { history, canMake: !story }), new Promise<never>((_, no) => setTimeout(() => no(new Error('slow')), 25_000))]);
      if (r.make && (KINDS as string[]).includes(r.make)) {
        handoff = r.make as AtelierKind;
        return;
      }
      setMsgs((m) => [...m, { id: uid(), who: 'bati', text: r.reply.text }]);
      const noPic = !!r.kind && r.kind !== 'normal';
      const drawn = r.reply.image?.url;
      if (drawn) setMsgs((m) => [...m, { id: uid(), who: 'bati', text: '', pic: { url: drawn } }]);
      else if (!noPic && wantsPicture(text)) {
        const pic = await Promise.race([getApi().buddyPicture(text, r.reply.text), new Promise<never>((_, no) => setTimeout(() => no(new Error('slow')), 10_000))])
          .then((x) => x.picture)
          .catch(() => null);
        if (pic) setMsgs((m) => [...m, { id: uid(), who: 'bati', text: '', pic: { url: pic.url, title: pic.title, source: pic.source, pageUrl: pic.pageUrl } }]);
      }
    } catch {
      say('むむ…いまは、うまく答えられなかった。もう一回言ってみて');
    } finally {
      setBusy(false);
    }
    // R12: the reply's own classification found a making request the words missed → the making flow (no search)
    if (handoff) makeFrom(handoff, text);
  };
  /** R12: a making request → its kind's flow, with what was asked for in the turns before when this one names nothing */
  const makeFrom = (kind: AtelierKind, text: string) => {
    const own = contentOf(text);
    const r = recentRequest(msgsRef.current);
    ask(kind, !isBare(own) ? own : r && r.what === kind ? r.content : '');
  };
  /** 「〇〇の絵を見せて」: the picture straight into the talk */
  const showPicture = async (what: string) => {
    setBusy(true);
    try {
      const pic = (await getApi().buddyPicture(what)).picture;
      if (pic) setMsgs((m) => [...m, { id: uid(), who: 'bati', text: '', pic: { url: pic.url, title: pic.title, source: pic.source, pageUrl: pic.pageUrl } }]);
      else say('ぴったりの絵は、見つからなかった……');
    } catch {
      say('いまは、絵を見つけられなかった……');
    } finally {
      setBusy(false);
    }
  };

  /**
   * client 2026-11-25 (本・ゲーム): {bati}'s next question (no buttons; the examples are in the sentence), or — the answers
   * in — the spell distilled from them (its talismans float over the bowl; 「このスペルで作る？　それとも、どこか変える？」)
   */
  const craftAsk = async (a: CraftAsk) => {
    if (a.left.length) {
      setPending({ craft: a });
      return sayT(a.left[0].text);
    }
    const said = a.answers.map((x) => x.said).join('。').slice(0, 200) || 'おまかせ';
    setBusy(true);
    const view = await getApi()
      .moonSpell({ kind: a.kind, said, answers: a.answers })
      .catch(() => null);
    setBusy(false);
    void propose(a.kind, said, undefined, {}, undefined, view ?? undefined);
  };
  /** words after a book / a game: another kind asked for, or a new one of it — else a change (the next chapter, a tweak) */
  const craftAfter = (w: Work, text: string): boolean => {
    const it = detect(text, true, markNames());
    if (it.kind === 'find' || (it.kind === 'make' && it.what !== w.kind && it.what !== 'lookup')) return false;
    if (it.kind === 'make' && it.what === w.kind && wantsNew(text)) {
      void craftAsk(craftBegin(w.kind as 'novel' | 'game', '', true));
      return true;
    }
    void run(w.kind, text, cardOf(w.id) ?? w);
    return true;
  };


  // ── R12 (client 2026-11-25): {bati}'s two tools — the compass (reads a spell from a photo / a YouTube link) and the
  // spell book (keeps the spells liked). Never shown all the time: they float up over the bowl only while used. ──
  const [tool, setTool] = useState<ToolShow>(null);
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const toolTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const later = (ms: number, f: () => void) => {
    if (toolTimer.current) clearTimeout(toolTimer.current);
    toolTimer.current = setTimeout(f, ms);
  };
  /** the spell just cast in this talk (its work done or not), and whether it is in the book */
  const lastCast = useRef<{ kind: SpellBookKind; tags: SpellTag[]; done: boolean; kept?: SavedSpell } | null>(null);
  const lastKept = useRef<SavedSpell | null>(null);
  const bookList = useRef<SavedSpell[] | null>(null);
  const loadBook = async (fresh = false) => {
    if (!bookList.current || fresh) bookList.current = await getApi().spellBook().catch(() => bookList.current ?? []);
    return bookList.current;
  };
  useEffect(() => {
    if (story || !me) return;
    void loadBook();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, story]);
  const showCompass = (phase: CompassPhase, awayIn?: number) => {
    const key = toolRef.current?.kind === 'compass' ? toolRef.current.key : Date.now();
    setTool({ kind: 'compass', phase, key });
    if (awayIn) later(awayIn, () => compassAway());
    else if (toolTimer.current) clearTimeout(toolTimer.current);
  };
  const compassAway = () => {
    setTool((t) => (t?.kind === 'compass' ? { ...t, leaving: true } : t));
    later(950, () => setTool((t) => (t?.kind === 'compass' ? null : t)));
  };
  const bookAway = () => {
    setTool((t) => (t?.kind === 'book' ? { ...t, mode: 'close' } : t));
    later(1250, () => setTool((t) => (t?.kind === 'book' ? null : t)));
  };
  /** the compass reads: the spell's talismans come out of it, and the usual 「このスペルで作る？」 */
  const compassRead = async (body: { fileId?: string; url?: string; image?: { mime: string; data: string } }, sayReading: boolean) => {
    showCompass('reading');
    if (sayReading) sayT(SPELL_TOOL_LINES.compassReading);
    setBusy(true);
    let r: CompassSpell | null = null;
    try {
      r = await getApi().compassSpell(body);
    } catch {
      r = null;
    }
    setBusy(false);
    if (!r) {
      compassAway();
      return sayT(SPELL_TOOL_LINES.compassFail);
    }
    const kind = r.kind as AtelierKind;
    if (!isOpen(kind, day)) {
      compassAway();
      return sayT(SPELL_TOOL_LINES.compassLocked, { d: daysUntil(kind, day) });
    }
    showCompass('done', 1500);
    const words = r.tags.filter((t) => t.group === 'theme').map((t) => t.ja).join('、') || r.tags.map((t) => t.ja).join('、');
    void propose(kind, words, undefined, {}, undefined, { tags: r.tags, added: [], removed: [] }, { lead: [SPELL_TOOL_LINES.compassRead], from: 'compass' });
  };
  /** 「しまっておいて」 / a yes to {bati}'s offer: the spell just cast goes into the book (it floats up and takes it in) */
  const keepCast = async (name?: string) => {
    const c = lastCast.current;
    if (!c) return sayT(SPELL_TOOL_LINES.bookNothing);
    if (c.kept && !name) return sayT(SPELL_TOOL_LINES.bookAlready, { spell: c.kept.name });
    setBusy(true);
    try {
      const r = await getApi().saveSpell({ kind: c.kind, tags: c.tags, ...(name ? { name } : {}) });
      lastCast.current = { ...c, kept: r };
      lastKept.current = r;
      if (r.already) return sayT(SPELL_TOOL_LINES.bookAlready, { spell: r.name });
      bookList.current = [r, ...(bookList.current ?? []).filter((x) => x.id !== r.id)];
      setTool({ kind: 'book', mode: 'save', page: 0, spells: [], saving: { kind: c.kind, tags: c.tags, name: r.name }, key: Date.now() });
      later(4600, () => setTool((t) => (t?.kind === 'book' && t.mode === 'save' ? null : t)));
      sayT(SPELL_TOOL_LINES.bookSaved, { spell: r.name });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'SPELL_BOOK_FULL') sayT(SPELL_TOOL_LINES.bookFull);
      else say('いまは、うまくしまえなかった……。もう一回言ってみて');
    } finally {
      setBusy(false);
    }
  };
  const openBook = async () => {
    setBusy(true);
    const spells = await loadBook(true);
    setBusy(false);
    setTool({ kind: 'book', mode: 'open', page: 0, spells, key: Date.now() });
    if (toolTimer.current) clearTimeout(toolTimer.current);
    sayT(spells.length ? SPELL_TOOL_LINES.bookOpen : SPELL_TOOL_LINES.bookEmpty);
    if (!spells.length) later(3600, bookAway);
  };
  const turnPage = (step: 1 | -1) =>
    setTool((t) => {
      if (t?.kind !== 'book' || t.mode !== 'open') return t;
      const spreads = Math.max(1, Math.ceil(t.spells.length / (BOOK_PER_PAGE * 2)));
      const page = Math.max(0, Math.min(spreads - 1, t.page + step));
      return page === t.page ? t : { ...t, page };
    });
  /** a kept spell brought back: it becomes the spell (its talismans come out of the book), then the usual question */
  const useKept = (sp: SavedSpell) => {
    const kind = sp.kind as AtelierKind;
    if (!isOpen(kind, day)) return sayT(SPELL_TOOL_LINES.bookLocked, { spell: sp.name, d: daysUntil(kind, day) });
    const wasOpen = toolRef.current?.kind === 'book';
    if (!wasOpen) setTool({ kind: 'book', mode: 'open', page: 0, spells: [sp], key: Date.now() });
    later(wasOpen ? 250 : 1300, bookAway);
    void getApi().usedSpell(sp.id).catch(() => undefined);
    lastKept.current = sp;
    void propose(kind, sp.name, undefined, {}, undefined, { tags: sp.tags, added: [], removed: [] }, { lead: [SPELL_TOOL_LINES.bookUse, { spell: sp.name }], from: 'book' });
  };
  /** R12: a kind asked for, and a kept spell of that kind fits the words — {bati} asks (now and then) */
  const suggestFromBook = (kind: AtelierKind, content: string): boolean => {
    const sk = spellKindOf(kind);
    if (story || !sk || isBare(content) || !bookList.current?.length) return false;
    const m = toolMemory();
    const asks = m.asks + 1;
    const hit = bookMatch(sk, content, bookList.current);
    if (!hit || !shouldSuggestBook({ ...m, asks })) {
      saveToolMemory({ ...m, asks });
      return false;
    }
    saveToolMemory({ ...m, asks, suggestedAt: asks });
    sayT(SPELL_TOOL_LINES.bookSuggest, { spell: hit.name });
    setPending({ tool: 'base', spell: hit, forKind: kind, content });
    return true;
  };
  /** R12 (day 4, the story): the art just made — its spell goes into {bati}'s spell book (kept for real, not on the review page) */
  const introBook = (w: Work, prompt: string) => {
    const tags = lastCast.current?.tags ?? spellFromWords('art', prompt || w.prompt || 'アート');
    setTool({ kind: 'book', mode: 'save', page: 0, spells: [], saving: { kind: 'art', tags, name: '' }, key: Date.now() });
    later(4600, () => setTool((t) => (t?.kind === 'book' ? null : t)));
    line('book');
    if (!story?.test) void getApi().saveSpell({ kind: 'art', tags }).catch(() => undefined);
  };
  /** the words for the tools (true: done here) */
  const toolSend = (text: string, p: Pending): boolean => {
    const asked = p && 'tool' in p ? p.tool : null;
    const a = toolStep(text, {
      asked,
      plan: !!(p && 'plan' in p),
      bookOpen: toolRef.current?.kind === 'book' && toolRef.current.mode === 'open',
      cast: !!lastCast.current,
      castDone: !!lastCast.current?.done,
      kept: !!lastCast.current?.kept,
      mem: toolMemory(),
    });
    // the spell waiting for its yes stays (the book's words go before it); a new spell replaces it
    const keepPlan = () => p && 'plan' in p && setPending(p);
    if (!a) {
      if (asked === 'compass') compassAway();
      return false;
    }
    switch (a.do) {
      case 'compassLink':
        if (!isOpen('song', day)) {
          sayT(SPELL_TOOL_LINES.compassLocked, { d: daysUntil('song', day) });
          return true;
        }
        void compassRead({ url: a.url }, true);
        return true;
      case 'compassOpen':
        showCompass('open');
        sayT(SPELL_TOOL_LINES.compassOpen);
        setPending({ tool: 'compass' });
        return true;
      case 'bookOpen':
        keepPlan();
        void openBook();
        return true;
      case 'bookClose':
        bookAway();
        if (a.quiet) return false;
        keepPlan();
        sayT(SPELL_TOOL_LINES.bookClosed);
        return true;
      case 'page':
        keepPlan();
        turnPage(a.step);
        return true;
      case 'save':
        keepPlan();
        void keepCast();
        return true;
      case 'rename': {
        keepPlan();
        const k = lastKept.current;
        if (!k) {
          if (lastCast.current) void keepCast(a.name);
          else sayT(SPELL_TOOL_LINES.bookNoName);
          return true;
        }
        void getApi()
          .renameSpell(k.id, a.name)
          .then((r) => {
            lastKept.current = r;
            bookList.current = (bookList.current ?? []).map((x) => (x.id === r.id ? r : x));
            if (lastCast.current?.kept?.id === r.id) lastCast.current = { ...lastCast.current, kept: r };
            setTool((t) => (t?.kind === 'book' ? { ...t, spells: t.spells.map((x) => (x.id === r.id ? r : x)) } : t));
            sayT(SPELL_TOOL_LINES.bookRenamed, { spell: r.name });
          })
          .catch(() => sayT(SPELL_TOOL_LINES.bookNotFound));
        return true;
      }
      case 'discard': {
        keepPlan();
        const f = findSpell(a.query, bookList.current ?? []);
        if (!f.spell) {
          if (f.close.length) sayT(SPELL_TOOL_LINES.bookWhich, { list: f.close.map((x) => `『${x.name}』`).join('と') });
          else sayT(SPELL_TOOL_LINES.bookNotFound);
          return true;
        }
        sayT(SPELL_TOOL_LINES.bookDropAsk, { spell: f.spell.name });
        setPending({ tool: 'drop', spell: f.spell });
        return true;
      }
      case 'use': {
        const f = findSpell(a.query, bookList.current ?? []);
        // a plain 「〇〇使って」 (the book not open, no スペルブック) is the book's only when it names a kept spell well
        if (!a.named && !(f.spell && spellScore(a.query, f.spell) >= 0.9)) return false;
        if (!f.spell) {
          keepPlan();
          if (f.close.length) sayT(SPELL_TOOL_LINES.bookWhich, { list: f.close.map((x) => `『${x.name}』`).join('と') });
          else sayT(SPELL_TOOL_LINES.bookNotFound);
          return true;
        }
        useKept(f.spell);
        return true;
      }
      case 'offer': {
        const m = toolMemory();
        saveToolMemory({ ...m, offeredAt: m.works });
        sayT(SPELL_TOOL_LINES.bookAsk);
        setPending({ tool: 'save' });
        return true;
      }
      case 'yes':
        if (a.to === 'save') void keepCast();
        else if (a.to === 'drop' && p && 'tool' in p && p.spell) {
          const sp = p.spell;
          void getApi()
            .dropSpell(sp.id)
            .then(() => {
              bookList.current = (bookList.current ?? []).filter((x) => x.id !== sp.id);
              if (lastKept.current?.id === sp.id) lastKept.current = null;
              if (lastCast.current?.kept?.id === sp.id) lastCast.current = { ...lastCast.current, kept: undefined };
              setTool((t) => (t?.kind === 'book' ? { ...t, spells: t.spells.filter((x) => x.id !== sp.id) } : t));
              sayT(SPELL_TOOL_LINES.bookDropped, { spell: sp.name });
            })
            .catch(() => sayT(SPELL_TOOL_LINES.bookNotFound));
        } else if (a.to === 'base' && p && 'tool' in p && p.spell) useKept(p.spell);
        return true;
      case 'no':
        if (a.to === 'save') sayT(SPELL_TOOL_LINES.bookKeepNot);
        else if (a.to === 'drop') sayT(SPELL_TOOL_LINES.bookDropNot);
        else if (a.to === 'base' && p && 'tool' in p && p.forKind) {
          // a fresh spell for the words, as asked
          void run(p.forKind, p.content ?? '');
        }
        return true;
    }
  };
  // R12: an image pasted in the talk is handed to {bati} like a 📎 photo (kept in Bluena, read with the compass)
  useEffect(() => {
    if (story) return;
    const onPaste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/'));
      if (!f || !isOpen('art', day)) return;
      e.preventDefault();
      void (async () => {
        showCompass('reading');
        const file = await uploadClip(new File([f], f.name || 'image.png', { type: f.type }), () => undefined).catch(() => null);
        if (!file) {
          compassAway();
          return sayT(SPELL_TOOL_LINES.compassFail);
        }
        setMsgs((m) => [...m, { id: uid(), who: 'me', text: '', file }]);
        void compassRead({ fileId: file.id }, false);
      })();
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, story]);

  const send = (text: string) => {
    setMsgs((m) => [...m, { id: uid(), who: 'me', text }]);
    const p = pending;
    setPending(null);
    // R12: {bati}'s compass and spell book (a link, their names, the answers to its questions, the offer)
    if (!story && toolSend(text, p)) return;
    // R11: the plan waiting for a yes — a yes starts it, any other words change it
    if (p && 'plan' in p) {
      if (isYes(text)) return void accept(p.plan);
      return void propose(p.plan.plan.kind, text, p.plan.prev, p.plan.opts, p.plan);
    }
    if (p && 'radioName' in p) {
      const h = held.current.get(p.radioName);
      const w = msgs.find((m): m is Extract<Msg, { who: 'work' }> => m.who === 'work' && m.work.id === p.radioName)?.work;
      if (h && w) return void recorded({ ...w, title: text.slice(0, 40) }, h.blob, h.seconds);
    }
    // client 2026-11-25: an answer to {bati}'s question for a book / a game (unless another kind is asked for)
    if (p && 'craft' in p) {
      const it = detect(text, false, markNames());
      if (!(it.kind === 'make' && it.what !== p.craft.kind && it.what !== 'lookup') && it.kind !== 'find') return void craftAsk(craftAnswer(p.craft, text));
    }
    if (p && 'after' in p && !story && craftAfter(p.after, text)) return;
    // in a story step every message makes the day's kind again (a new card), unless it is a change of the last one
    if (story?.mode === 'make' && first && !p) {
      const last = lastWork();
      const it = detect(text, !!last);
      if (it.kind === 'refine' && last && last.kind !== 'voice' && last.kind !== 'radio') return void run(last.kind, it.content, last);
      return void run(first, text);
    }
    // M-R263: 「土星のレコード、ピンクにして」 — {bati} changes it (no buttons on the planets)
    if (!story && changeAsk(text)) return;
    if (p && 'voiceAgain' in p) return void run('voice', text);
    if (p && 'use' in p) return void run(p.use, text, undefined, { materials: p.materials });
    // R12: the answer to {bati}'s question — unless it asks for another kind, or to make it (「魔法で作って欲しい」
    // after 「なんの絵を見る？」 is the picture asked for before, made — not searched)
    const again = p && 'kind' in p ? detect(text, false, markNames()) : null;
    const other = (again?.kind === 'make' && p && 'kind' in p && again.what !== p.kind && again.what !== 'lookup') || (again?.kind === 'makeAny' && p && 'kind' in p && p.kind === 'lookup');
    if (p && 'kind' in p && !other) {
      if (again?.kind === 'makeAny') return makeFrom(p.kind === 'image' ? 'art' : p.kind, text);
      if (again?.kind === 'make' && again.what === p.kind) return ask(p.kind, again.content);
      if (p.kind === 'lookup') return void converse(text);
      if (p.kind === 'image') return void showPicture(text);
      return void run(p.kind, text);
    }
    const last = lastWork();
    const it = detect(text, !!last, markNames());
    // R12: 「魔法で作って欲しい」 — the making request of the turns before (「空飛ぶクジラの画像…」); none → which kind
    if (it.kind === 'makeAny') {
      const r = recentRequest(msgsRef.current);
      if (r) return ask(r.what, r.content);
      if (!story) return void converse(text);
    }
    if (it.kind === 'find') return void showFound(it);
    // client 2026-11-24: a lookup is answered right in the talk (short, plain words; a picture as a picture bubble)
    if (it.kind === 'make' && it.what === 'lookup') return void converse(text);
    if (it.kind === 'make' && it.what === 'image' && !isBare(it.content)) return void showPicture(it.content);
    if (it.kind === 'make') return ask(it.what, it.content);
    // M-R253 §1: 「新しく作って」 — a new card of the same kind (a change is made inside the card)
    if (last && /新しく|あたらしく|別の|べつの/.test(text)) {
      const c = contentOf(text).replace(/新しく|あたらしく|別の|べつの|を?作って|のを?/g, '').trim();
      if (isBare(c)) {
        setPending({ kind: last.kind });
        return say(ASK[last.kind]);
      }
      return void run(last.kind, c);
    }
    if (it.kind === 'refine' && last) {
      if (last.kind === 'voice') {
        setPending({ voiceAgain: true });
        return say('もう一回、つぶやきを言ってみて');
      }
      if (last.kind === 'radio') return say('カードの〔やり直し〕で、録り直せるよ');
      return void run(last.kind, it.content, last);
    }
    if (it.kind === 'ask') return say('どれにする？', it.options.map((k) => KIND_WORD[k]));
    // client 2026-11-24: no 「なにをする？」 and no menu — anything else is talk, answered by {bati} itself
    return void converse(text);
  };

  const chip = (label: string, from?: string) => {
    const k = (Object.keys(KIND_WORD) as AtelierKind[]).find((x) => KIND_WORD[x] === label);
    setMsgs((m) => [...m, { id: uid(), who: 'me', text: label }]);
    if (!story && changeAsk(label, true)) return;
    // M-R253 §3: {bati}'s proposal of the material
    if (label === USE && proposal.current) {
      const pr = proposal.current;
      proposal.current = null;
      return void run(pr.kind, PROPOSAL_ASK[pr.kind] ?? '', undefined, { materials: pr.materials });
    }
    if (label === NEW_TODAY && proposal.current) {
      // ① 「了解！　まっさらから、いこう。」 and the day's own way to make
      const k2 = proposal.current.kind;
      proposal.current = null;
      return sayT(MOON_LINES.fresh, {}, [KIND_WORD[k2]]);
    }
    // ⑦ a material asked into a kind not open yet
    if (k && mats.length && mats.some((x) => usesOf(x.kind).includes(k)) && !isOpen(k, day) && !story) return sayT(MOON_LINES.dragLocked, { d: daysUntil(k, day) });
    if (k && mats.length && mats.some((x) => usesOf(x.kind).includes(k))) {
      setPending({ use: k, materials: mats });
      return say(ASK[k]);
    }
    if (k) ask(k, '');
  };

  // M-R253 §3 (the morning's offer of earlier works as material) — client 2026-11-24 (iPad, R7): {bati} never steers
  // toward making, so it no longer offers on its own; works dragged in from Bluena are still material
  const proposal = useRef<{ kind: AtelierKind; materials: Work[] } | null>(null);
  useEffect(() => {
    if (OFFER_ON_MORNING === false || story || !me || !day) return;
    const key = `${PROPOSED_KEY}.${day}`;
    try {
      if (localStorage.getItem(key)) return;
    } catch {
      return;
    }
    let live = true;
    void findAll({})
      .then((all) => {
        const pr = proposalFor(day, all.map((x) => ({ work: x.work, createdAt: x.createdAt })));
        if (!live || !pr || !isOpen(pr.kind, day)) return;
        proposal.current = { kind: pr.kind, materials: pr.materials };
        try {
          localStorage.setItem(key, '1');
        } catch {
          /* said again next time */
        }
        sayT(pr.line, pr.vars, [USE, NEW_TODAY], pr.fix);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, day]);

  // M-R253 §6 ⑤: back to a finished slow card (from the toast / the push)
  const welcomed = useRef(false);
  useEffect(() => {
    if (!welcome || welcomed.current || story) return;
    welcomed.current = true;
    sayT(nextLine('welcome', MOON_LINES.welcome));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcome]);

  // M-R253 §3: a work dragged in from Bluena is material
  useEffect(() => {
    const got = (e: Event) => {
      const w = (e as CustomEvent<Work>).detail;
      if (!w) return;
      const all = [...matsRef.current.filter((x) => x.id !== w.id), w].slice(-3);
      setMats(all);
      // M-R253 §6 ⑦: two or more works / the one kind it can be made into today / a kind not open yet / as a rule
      const name = (x: Work) => (x.title || x.text || KIND_WORD[x.kind]).slice(0, 16);
      const d = dragLine(all, day, name, (k) => KIND_WORD[k], !!story);
      if (d.only) setPending({ use: d.only, materials: all });
      sayT(d.line, d.vars, d.kinds.map((k) => KIND_WORD[k]));
    };
    window.addEventListener('obolo:material', got);
    return () => window.removeEventListener('obolo:material', got);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  // Bluena's 📎: files from the device handed to {bati} — shown on your side; a picture is looked at, the rest answered
  useClipSend('bati', (files) => {
    setMsgs((m) => [...m, ...files.map((file) => ({ id: uid(), who: 'me' as const, text: '', file }))]);
    // R12: a photo handed to {bati} — it brings out its compass and reads the photo's spell
    const photo = files.find((f) => f.kind === 'photo');
    if (photo && !story && isOpen('art', day)) {
      setPending(null);
      void compassRead({ fileId: photo.id }, false);
      if (files.length > 1) say(`${files.length}こ、うけとったよ。ブルーナにも、しまってあるからね`);
      return;
    }
    void (async () => {
      const first = files.find((f) => f.kind === 'photo') ?? files[0];
      const r = await getApi()
        .lookClip(first.id)
        .catch(() => null);
      if (r?.line) say(r.line);
      if (files.length > 1) say(`${files.length}こ、うけとったよ。ブルーナにも、しまってあるからね`);
    })();
  });

  // M-R253 §5: works back home from their planets — {bati} tells who reacted (under 15: only the dachi; the server)
  useEffect(() => {
    if (story || !me) return;
    let live = true;
    void getApi()
      .homecomings()
      .then((hs) => {
        if (!live || !hs.length) return;
        for (const h of hs) for (const l of homecomingSay(h)) sayT(l.text, l.vars);
        void getApi().homecomingsTold(hs.map((h) => h.key)).catch(() => undefined);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  /** §2: the part pointed at on a card, then the words */
  const askAt = (w: Work, text: string, target: RefineTarget) => {
    setMsgs((m) => [...m, { id: uid(), who: 'me', text }]);
    if (w.kind === 'voice' && target.kind === 'span') {
      // the words chosen are said anew: 「」 words replace them
      const now = w.text ?? '';
      const put2 = contentOf(text) || text;
      return void run('voice', `${now.slice(0, target.start)}${put2}${now.slice(target.end)}`.slice(0, 140));
    }
    if (w.kind === 'radio') return say('カードの〔やり直し〕で、録り直せるよ');
    void run(w.kind, text, w, { target });
  };
  const faceIt = (w: Work, i: number) => {
    const f = faceTo(w, i);
    put(f);
    keepFace(f);
  };
  const dropIt = async (w: Work, i: number) => put(await dropTry(w, i));
  const openMaterial = (m: WorkMaterial) => setPeek(msgsRef.current.flatMap((x) => (x.who === 'work' && (x.work.id === m.id || x.work.atelierId === m.id) ? [x.work] : []))[0] ?? fromMaterial(m));

  const recorded = async (w: Work, blob: Blob, seconds: number) => {
    setBusy(true);
    try {
      const out = await keepShow(w, blob, seconds);
      held.current.delete(w.id);
      put(out);
      if (!(story && line('saved'))) say('ブルーナにしまったよ。聴いてみて。〔やり直し〕で、何度でも録り直せるよ');
    } catch (e) {
      put(w);
      if (e instanceof ApiError && e.code === 'MODERATION') {
        // the take is kept: only the name has to change
        held.current.set(w.id, { blob, seconds });
        setPending({ radioName: w.id });
        say('その番組の名前は使えないみたい。別の名前を教えて');
      } else say(failLine(e));
    } finally {
      setBusy(false);
    }
  };

  const again = async (w: Work) => {
    if (story) line('again');
    if (w.kind === 'radio') {
      if (w.ref?.showId) await getApi().removeRadioShow(w.ref.showId).catch(() => undefined);
      return put({ ...w, status: 'record', audio: undefined, ref: {}, saved: false, flown: false });
    }
    void run(w.kind, w.prompt, w);
  };

  const flyIt = async (w: Work) => {
    setBusy(true);
    try {
      await fly(w, ctx);
      put({ ...w, flown: true });
      // in a story the next lines say it; standalone {bati} says where it went
      if (story?.onFly) setTimeout(() => story.onFly!(PLANET_OF[w.kind] ?? ''), 900);
      else {
        // M-R258 §3: a short launch (the work flies up), then {bati}'s line for that planet's home
        const home = HOME_OF_WORK[w.kind];
        setLaunch(w.kind);
        setTimeout(() => {
          setLaunch(null);
          if (home) sayT(PLANET_HOMES[home].flown);
          else say(`${PLANET_WORD[w.kind] ?? '星'}へ飛んでいった。ロケットで行けば、見られるよ`);
        }, 1300);
      }
    } catch (e) {
      say(failLine(e));
    } finally {
      setBusy(false);
    }
  };

  const wearIt = async (w: Work) => {
    setBusy(true);
    try {
      const m = await wear(w);
      if (m) setMe(m);
      put({ ...w, worn: true });
    } catch (e) {
      say(failLine(e));
    } finally {
      setBusy(false);
    }
  };

  // coming with a kind (a Bluena folder's 〔月で作る〕, Saturn's 〔つぶやく〕): ask for it once
  const started = useRef(false);
  useEffect(() => {
    // a story step asks at once (the review page plays it with no account)
    if (started.current || !first || (!me && !story)) return;
    started.current = true;
    ask(first, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, me]);

  // OBOLON's lesson, once for each thing that opened (laid over the talk)
  const [lesson, setLesson] = useState<Lesson | null>(null);
  useEffect(() => {
    if (!me) return;
    // from a story step the morning scene has taught: no sheet here, and the standalone atelier will not teach it again
    if (story) {
      const l = first ? LESSON_OF[first] : undefined;
      if (l && me.story?.[`sys.atelier_${l}`] !== '1') taught(l);
      return;
    }
    let local: string[] = [];
    try {
      local = JSON.parse(localStorage.getItem(TAUGHT_KEY) ?? '[]') as string[];
    } catch {
      /* no memory on this device */
    }
    const next = openLessons(day).find((l) => !local.includes(l) && me.story?.[`sys.atelier_${l}`] !== '1');
    setLesson(next ?? null);
  }, [me, day]);
  function taught(l: Lesson) {
    try {
      const local = JSON.parse(localStorage.getItem(TAUGHT_KEY) ?? '[]') as string[];
      localStorage.setItem(TAUGHT_KEY, JSON.stringify([...new Set([...local, l])]));
    } catch {
      /* ignore */
    }
    void getApi()
      .saveSysStory({ [`atelier_${l}`]: '1' })
      .then(setMe)
      .catch(() => setLesson(null));
  }

  // client 2026-11-24: {bati} speaks its replies aloud (batiSpeak.ts): each new {bati} line once, the newest one when several
  // come together; not in a story step (its script lines are the story's); quiet when muted / not unlocked / no voice.
  // R9 (client): the bubble and the voice start together — a new line is held back (… thinking) while its voice is
  // fetched and decoded, at most VOICE_WAIT_MS (2.5 s); then the bubble shows as the voice starts. Not ready by then:
  // the bubble shows, and the voice plays when it comes.
  const [speaking, setSpeaking] = useState<{ who: string; level: () => number } | null>(null);
  const known = useRef<Set<string> | null>(null);
  // what was in the talk when it opened shows at once and is not read again (the greeting of a fresh talk is)
  if (known.current === null) known.current = new Set(msgs.filter((m) => story || m.who !== 'bati' || msgs.some((x) => x.who === 'me')).map((m) => m.id));
  const voiceHeld = useRef(new Set<string>());
  const [, rerender] = useState(0);
  const [toPlay, setToPlay] = useState<{ url: string; g: number } | null>(null);
  const speakGen = useRef(0);
  const speakClip = useRef<{ stop: () => void } | null>(null);
  /** a {bati} line not shown yet: new (not looked at yet) or waiting for its voice */
  const hidden = (m: Msg) => !story && m.who === 'bati' && (!known.current!.has(m.id) || voiceHeld.current.has(m.id));
  useEffect(() => {
    if (story) return;
    const fresh = msgs.filter((m) => !known.current!.has(m.id));
    if (!fresh.length) return;
    for (const m of fresh) known.current!.add(m.id);
    const said = fresh.filter((m): m is Extract<Msg, { who: 'bati' }> => m.who === 'bati' && !!m.text);
    const last = said.at(-1);
    const words = last ? speakable(last.text) : '';
    if (!last || !words || talkMuted()) return void rerender((n) => n + 1);
    const g = ++speakGen.current;
    voiceHeld.current.add(last.id);
    rerender((n) => n + 1);
    const t0 = performance.now();
    void (async () => {
      const urlP = batiVoiceUrl(words);
      const url = await Promise.race([urlP, new Promise<null>((r) => setTimeout(() => r(null), VOICE_WAIT_MS))]);
      const ready = url ? await readyClip(url, Math.max(0, VOICE_WAIT_MS - (performance.now() - t0))) : false;
      if (g !== speakGen.current) return;
      voiceHeld.current.delete(last.id);
      if (ready && url && canPlay()) {
        // the bubble and the voice in the same frame (the clip starts in the effect after the talk has shown the line)
        logVoice('together', last.id, performance.now() - t0);
        setToPlay({ url, g });
        return;
      }
      logVoice('words first', last.id, performance.now() - t0);
      rerender((n) => n + 1);
      // the voice was late: it plays when it comes
      const late = url ?? (await urlP);
      if (late && g === speakGen.current && !talkMuted()) setToPlay({ url: late, g });
    })();
  }, [msgs, story]);
  useEffect(() => {
    if (!toPlay || toPlay.g !== speakGen.current || talkMuted()) return;
    const { url, g } = toPlay;
    void (async () => {
      const clip = await playClip(url);
      if (!clip || g !== speakGen.current) return void clip?.stop();
      speakClip.current = clip;
      setSpeaking({ who: 'bati', level: clip.level });
      await clip.done;
      if (g === speakGen.current) setSpeaking(null);
    })();
  }, [toPlay]);
  useEffect(() => () => void (speakGen.current++, speakClip.current?.stop()), []);

  // M-R232: the side-by-side talk — you at the right, {bati} (or the story's speaker) at the left, the Moon behind
  const people: TalkPerson[] = [
    // (no {bati} yet: the neutral stand-in, the egg, smaller — client 2026-11-24)
    { id: 'bati', name: partner.name, look: batiLook(me?.bati, partner.face), color: BATI_COLOR, ...(own.placeholder && !story ? { scale: 0.55, headAt: 0.5 } : {}) },
    // client 2026-11-24: face to face over your shoulder — your back in the front (the talk cast's back: looks have no
    // back view painted yet)
    { id: 'me', name: me?.displayName ?? '', look: selfLook(me), color: SELF_COLOR, tone: selfTone(me), self: true, avatar: me?.lookIcon, views: viewsOf('talk-user') },
  ];
  const items: TalkItem[] = msgs.filter((m) => !hidden(m)).map((m) =>
    m.who === 'me'
      ? { id: m.id, who: 'me', text: m.text, mark: { kind: 'local', id: m.id }, ...(m.file ? clipItem(m.file) : {}) }
      : m.who === 'bati'
        ? {
            id: m.id,
            who: 'bati',
            text: m.text,
            mark: { kind: 'local', id: m.id },
            card: m.changed
              ? { label: m.text, thumb: <ChangePreview change={m.changed} />, full: <ChangePreview change={m.changed} big /> }
              : m.found?.length
              ? {
                  label: m.text,
                  thumb: <FoundThumb works={m.found} />,
                  full: (
                    <div className="no-scrollbar max-h-[70svh] space-y-2 overflow-y-auto">
                      {m.found.map((w) => (
                        <WorkCard key={w.id} w={w} busy={busy} onFly={() => void flyIt(w)} onWear={() => undefined} onPick={() => undefined} onRecorded={() => undefined} onRing={(at) => ring.open(workMarkRef(w).kind, workMarkRef(w).id, at)} />
                      ))}
                    </div>
                  ),
                }
              : undefined,
            name: m.speaker && story ? story.speaker(m.speaker).name : undefined,
            // client 2026-11-24: a picture right in the talk (where it came from, small under it); R11: the plan's card
            // client 2026-11-25: the spell itself floats over the bowl; the talk keeps a small record of it
            extra: m.pic ? <PicBubble pic={m.pic} /> : m.plan ? <SpellRecord tags={m.plan.tags} /> : undefined,
            chips: m.changed
              ? [{ label: m.changed.undone ? '元に戻した' : '元に戻す', onPick: () => undoChange(m.id), disabled: busy || !!m.changed.undone }]
              : m.plan
                ? undefined
                : m.chips?.map((c) => ({ label: c, onPick: () => chip(c), disabled: busy })),
          }
        : {
            id: m.id,
            who: 'bati',
            text: m.work.status === 'making' ? '' : (m.work.title ?? ''),
            mark: m.work.status === 'ready' ? workMarkRef(m.work) : undefined,
            // 〔星へ飛ばす〕 right on the bubble (the story's fly choice is made here), as on the opened card
            chips:
              FLIES[m.work.kind] && m.work.status === 'ready' && (m.work.saved || !!story)
                ? [{ label: m.work.flown ? '飛んでいった' : '星へ飛ばす', onPick: () => void flyIt(m.work), disabled: busy || !!m.work.flown }]
                : undefined,
            card: {
              label: m.work.title ?? m.work.prompt,
              thumb: <WorkThumb w={m.work} />,
              full: <LiveCard id={m.work.id} fallback={m.work} />,
            },
          },
  );
  // R9 (client): making something — the bowl's water glows while it is made; when it is done, the work rises out of it
  const [rising, setRising] = useState<{ key: string; image?: string | null; kind: AtelierKind } | null>(null);
  const workState = useRef(new Map<string, string>());
  useEffect(() => {
    const was = workState.current;
    let done: Work | null = null;
    for (const m of msgs) {
      if (m.who !== 'work') continue;
      const before = was.get(m.work.id);
      if (before === 'making' && m.work.status === 'ready') done = m.work;
      was.set(m.work.id, m.work.status);
    }
    if (!done) return;
    const key = `${done.id}-${Date.now()}`;
    setRising({ key, image: done.image ?? done.poster ?? done.candidates?.[0]?.url, kind: done.kind });
    const t = setTimeout(() => setRising((r) => (r?.key === key ? null : r)), 1800);
    return () => clearTimeout(t);
  }, [msgs]);
  // R11 (client): every making — the cast (at least a moment; the whole of a quick one) lights the bowl with {bati} at the
  // left; a slow one still running after the cast keeps a soft shimmer with {bati} back in the middle
  const quickMaking = msgs.some((m) => m.who === 'work' && m.work.status === 'making' && !m.work.job?.long);
  const slowMaking = msgs.some((m) => m.who === 'work' && m.work.status === 'making' && !!m.work.job?.long);
  const bowl: BowlState = rising ? { rise: rising } : castTill > 0 || quickMaking ? 'glow' : slowMaking ? 'shimmer' : 'idle';
  const casting = bowl === 'glow' || typeof bowl === 'object';
  const reducedMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // a slow card does not keep {bati} 'thinking' (you may go away meanwhile)
  const making = msgs.some((m) => m.who === 'work' && m.work.status === 'making' && !m.work.job?.long);
  const renderCard = (w: Work) => (
    <WorkCard
      w={w}
      busy={busy}
      onAgain={() => void again(w)}
      onFly={() => void flyIt(w)}
      onWear={() => void wearIt(w)}
      onPick={(id) => put({ ...w, pick: id, image: w.candidates?.find((c) => c.id === id)?.url, worn: false })}
      onRecorded={(blob, sec) => void recorded(w, blob, sec)}
      onRing={(at) => ring.open(workMarkRef(w).kind, workMarkRef(w).id, at)}
      onFace={(i) => faceIt(w, i)}
      onDropTry={(i) => void dropIt(w, i)}
      onAsk={(text, target) => askAt(w, text, target)}
      onMaterial={openMaterial}
      songUrl={(() => {
        const sm = w.materials?.find((x) => x.kind === 'song' && x.audio);
        return sm ? { url: sm.audio!, title: sm.title } : undefined;
      })()}
    />
  );
  const cards = { get: cardOf, render: renderCard };

  return (
    <Cards.Provider value={cards}>
    <div className="relative flex min-h-0 flex-1 flex-col" style={{ fontFamily: SERIF }}>
      {launch && <FlyLaunch kind={launch} />}
      <TalkScene
        people={people}
        items={items}
        thinking={!casting && (busy || making || voiceHeld.current.size > 0) ? 'bati' : null}
        castBy={casting ? 'bati' : null}
        voice={speaking ?? undefined}
        log
        framing="ots"
        listening={talkState.listening}
        keyboard={talkState.keyboard}
        // R9 (client): {bati} in the Moon temple, before the water bowl — R11: in a story day's making too (the client's
        // song on its day had no bowl and no cast: the story kept its own place then)
        place={TEMPLE_PLATE.src}
        placeAspect={TEMPLE_PLATE.aspect}
        placeFx={(m) => <BowlFx state={bowl} at={m.at} scale={m.scale} reduced={reducedMotion} />}
        // client 2026-11-25: the spell's talismans in the sky over the bowl (the talk ends above them)
        stage={
          floating || tool
            ? (m) => {
                const bb = m.at(TEMPLE_PLATE.bowl.u, TEMPLE_PLATE.bowl.v);
                const bot = bb.y - TEMPLE_PLATE.bowl.w * m.scale * 0.13;
                const cp = compassAt(bb, bot, m.scale, m.top + 110);
                const bk = bookAt(m.w, bot, m.top + 96);
                const toolNode =
                  tool?.kind === 'compass' ? (
                    <BatiCompass key={tool.key} phase={tool.phase} leaving={tool.leaving} cx={cp.x} cy={cp.y} size={cp.size} />
                  ) : tool?.kind === 'book' ? (
                    <SpellBookFloat key={tool.key} mode={tool.mode} spells={tool.spells} page={tool.page} saving={tool.saving} cx={bb.x} top={bk.top} w={bk.w} onPage={(step) => turnPage(step)} />
                  ) : null;
                if (!floating) return { top: tool?.kind === 'book' ? bk.top : cp.y - cp.size / 2, node: toolNode };
                const b = m.at(TEMPLE_PLATE.bowl.u, TEMPLE_PLATE.bowl.v);
                const bottom = b.y - TEMPLE_PLATE.bowl.w * m.scale * 0.13;
                const layout = floatLayout(floating.look, floating.tags, m.w);
                const need = layout.height + (floating.price > 0 ? MANA_H : 0);
                // room for at least a short line of the talk above them
                const scale = Math.max(0.6, Math.min(1, (bottom - (m.top + 110)) / need));
                const from = floating.from === 'compass' ? { x: cp.x, y: cp.y } : floating.from === 'book' ? { x: bb.x, y: bk.top + bk.h / 2 } : undefined;
                return {
                  top: Math.min(bottom - need * scale, tool?.kind === 'book' ? bk.top : bottom),
                  node: (
                    <>
                      {toolNode}
                      <FloatingSpell key={floating.id} spell={floating} layout={layout} cx={b.x} bottom={bottom} bowl={b} scale={scale} onTap={tapTag} from={from} />
                    </>
                  ),
                };
              }
            : undefined
        }
        // R10 (client): {bati} in the middle, facing you, a step in front of the bowl (big enough to hide its lower rim);
        // only while it casts (the bowl glows: something is being made or changed) it goes to the left and casts into the
        // bowl behind it, then comes back to the middle
        otsAt={casting ? 0.21 : 0.5}
        otsStand={casting ? TEMPLE_PLATE.bati : TEMPLE_PLATE.batiFront}
        top={story ? 40 : 0}
        bar={{ title: partner.name, onList, unread, onBack, below: banner }}
        fixedSelfFace={me?.story?.[TALK_FIXED_FACE_KEY] === '1'}
        onRing={(it, at) => it.mark && ring.open(it.mark.kind, it.mark.id, at)}
        composer={
          <TalkComposer
            key={bar}
            placeholder={`${partner.name}に頼む`}
            disabled={busy}
            onState={setTalkState}
            side={onDevice && !story ? <DeviceButton onClick={onDevice} /> : undefined}
            onSend={(v) => {
              send(v);
              setBar((n) => n + 1);
            }}
          />
        }
      />
      {story && <StoryButton story={story} msgs={msgs} busy={busy} />}
      {ring.node}
      {/* §3: the materials waiting for the next thing made */}
      {!!mats.length && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[118px] z-20 flex justify-center">
          <span className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-sky-200/40 bg-[rgba(16,22,64,.8)] px-2.5 py-1 text-[11px] text-sky-100 backdrop-blur" data-testid="material-tray">
            材料
            {mats.map((w) => (
              <span key={w.id} className="block h-6 w-6 overflow-hidden rounded-md bg-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {w.image || w.poster ? <img src={(w.image ?? w.poster)!} alt="" className="h-full w-full object-cover" /> : <KindMark kind={w.kind} className="m-1 h-4 w-4" />}
              </span>
            ))}
            <button onClick={() => setMats([])} aria-label="材料をやめる" className="ml-0.5 text-sky-100/60">
              ✕
            </button>
          </span>
        </div>
      )}
      {peek && (
        <div className="absolute inset-0 z-[35] flex items-center justify-center bg-black/55 px-4" onClick={() => setPeek(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm">
            <WorkCard w={peek} busy={busy} onFly={() => void flyIt(peek)} onWear={() => undefined} onPick={() => undefined} onRecorded={() => undefined} />
          </div>
        </div>
      )}

      {lesson && (
        <Teach
          lesson={lesson}
          neo={me?.displayName ?? ''}
          bati={partner.name}
          onClose={() => {
            taught(lesson);
            setLesson(null);
          }}
        />
      )}
    </div>
    </Cards.Provider>
  );
}

/** client 2026-11-24: a picture {bati} found or drew, as a picture bubble (the source small under it) */
function PicBubble({ pic }: { pic: NonNullable<Extract<Msg, { who: 'bati' }>['pic']> }) {
  return (
    <span className="block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={pic.url} alt={pic.title ?? ''} className="block max-h-[220px] w-[min(240px,60vw)] rounded-xl object-cover" />
      {(pic.source || pic.title) && (
        <a href={pic.pageUrl} target="_blank" rel="noreferrer" className="mt-1 block truncate text-[10.5px] text-[#4a3410]/70 underline-offset-2 hover:underline">
          {[pic.title, pic.source].filter(Boolean).join('・')}
        </a>
      )}
    </span>
  );
}

/** 〔次へ〕 once something was made (or could not be), or 〔今は飛ばさない〕 on the fly choice */
function StoryButton({ story, msgs, busy }: { story: StoryMode; msgs: Msg[]; busy: boolean }) {
  // anything on the table counts (a show not recorded yet too: no mic must not stop the day)
  const works = msgs.flatMap((m) => (m.who === 'work' && m.work.status !== 'making' ? [m.work] : []));
  const fly = story.mode === 'fly';
  const ok = fly || works.length > 0;
  return (
    <button
      onClick={() => (fly ? story.onSkip?.() : story.onDone?.(works.filter((w) => w.status === 'ready')))}
      disabled={!ok || busy}
      className="absolute left-1/2 top-1 z-20 -translate-x-1/2 rounded-full border border-amber-200/50 bg-black/55 px-4 py-1.5 text-xs tracking-[0.2em] text-amber-100 backdrop-blur disabled:opacity-0"
    >
      {fly ? '今は飛ばさない' : '次へ'}
    </button>
  );
}

/** a work small in {bati}'s bubble (M-R232 §2): its picture, or its mark and name; a tap opens the whole card */
function WorkThumb({ w }: { w: Work }) {
  const pic = w.image ?? w.poster ?? w.candidates?.[0]?.url;
  return (
    <span className="flex items-center gap-2 bg-[rgba(16,11,26,0.7)] p-1.5">
      {pic ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pic} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white/5 text-amber-100/80">
          <KindMark kind={w.kind} className="h-6 w-6" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-amber-50">{w.title || w.text || w.prompt}</span>
        <span className="block text-[10.5px] text-amber-200/70">{w.status === 'making' ? <ThumbLeft w={w} /> : w.status === 'failed' ? 'うまくできなかった' : w.status === 'record' ? '押して、録る' : '押して、ひらく'}</span>
      </span>
    </span>
  );
}

/** M-R253 §4: a slow card's count in the bubble too (「作っているよ・あと3分」) */
function ThumbLeft({ w }: { w: Work }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    const off = onJobs(() => tick((n) => n + 1));
    return () => {
      clearInterval(t);
      off();
    };
  }, []);
  const c = countdown(jobView(w.job?.id), Date.now(), !!w.job?.long);
  return <>{c.left ? `作っているよ・${c.left}` : '作っているよ…'}</>;
}

/** the works {bati} found, small in its bubble: a row of their pictures / marks (a tap opens them all) */
function FoundThumb({ works }: { works: Work[] }) {
  return (
    <span className="flex items-center gap-1.5 bg-[rgba(16,11,26,0.7)] p-1.5">
      {works.slice(0, 4).map((w) => {
        const pic = w.image ?? w.poster ?? undefined;
        return pic && !pic.startsWith('idb:') ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={w.id} src={pic} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
        ) : (
          <span key={w.id} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/5 text-amber-100/80">
            <KindMark kind={w.kind} className="h-5 w-5" />
          </span>
        );
      })}
      {works.length > 4 && <span className="text-[12px] text-amber-100/70">+{works.length - 4}</span>}
    </span>
  );
}

/** 〔星へ飛ばす〕: the work goes up into the sky for a moment (the home's art takes over from here) */
function FlyLaunch({ kind }: { kind: string }) {
  const home = HOME_OF_WORK[kind];
  const sprite = home ? PLANET_HOMES[home].art.sprite : null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[60] overflow-hidden" aria-hidden>
      <style>{'@keyframes fly-launch{0%{transform:translate(-50%,0) scale(.6);opacity:0}15%{opacity:1}100%{transform:translate(-50%,-120vh) scale(1.1);opacity:.2}}'}</style>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {sprite && <img src={sprite} alt="" className="absolute bottom-[18%] left-1/2 w-24" style={{ animation: 'fly-launch 1.2s cubic-bezier(.5,0,.8,.4) forwards' }} />}
    </div>
  );
}
