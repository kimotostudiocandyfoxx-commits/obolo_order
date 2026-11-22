'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TalkComposer } from '@/components/talk/TalkComposer';
import { useTalkTone } from '@/components/talk/useTalkTone';
import { TalkScene, type TalkItem, type TalkPerson } from '@/components/talk/TalkScene';
import { BATI_COLOR, batiLook, characterLook, PLACE_BG, SELF_COLOR, selfLook, selfTone } from '@/lib/talk/looks';
import { ApiError, getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { batiLine, batiLineVoiceOf } from '@/lib/onboarding/batiLine';
import { batiDaysLeftLine, MARK_GLYPH, STAR_TIP_AT, STAR_TIP_KEY, STAR_TIP_LINE, TALK_FIXED_FACE_KEY, type BluenaPlanet, type ItemMarkId } from '@obolo/shared';
import { useMarkRing } from '@/components/finds/MarkRing';
import { markNames } from '@/lib/finds/marks';
import { findAll, PLANET_NAME, workMarkRef } from '@/lib/finds/works';
import { daysUntil, isOpen, openKinds, openLessons, type AtelierKind, type Lesson } from '@/lib/atelier/unlock';
import { usePartner } from '@/lib/partner';
import { useAtelierCtx } from './ctx';
import { ASK, DONE, detect, isBare, KIND_WORD } from './intent';
import { fly, failLine, keepShow, make, wear } from './makers';
import { saveTalk, type Talk } from './shelf';
import { cues, withWords, type StoryMode } from './story';
import { toggleAudio } from '@/lib/audio';
import { Teach } from './Teach';
import { KindMark, WorkCard } from './WorkCard';
import { FLIES, uid, type Msg, type Work } from './work';

const SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
const TAUGHT_KEY = 'obolo.atelier.taught';
const PLANET_WORD = { voice: '土星', art: '木星', song: '水星', video: '火星', radio: '金星' } as Record<string, string>;
const PLANET_OF = { voice: 'saturn', art: 'jupiter', song: 'mercury', video: 'mars', radio: 'venus' } as Record<string, string>;
const LESSON_OF: Partial<Record<AtelierKind, Lesson>> = { voice: 'voice', art: 'art', song: 'song', video: 'video', radio: 'radio' };
// PLACEHOLDER (P-ATELIER-5): {bati}'s opening line in the atelier
const HELLO = 'なにをする？ ことばで頼んでね';

/** a fresh talk with {bati} (its opening line offers what is open today) */
export function newTalk(day: number | null | undefined): Talk {
  return { id: uid(), at: new Date().toISOString(), msgs: [{ id: uid(), who: 'bati', text: HELLO, chips: openKinds(day).map((k) => KIND_WORD[k]) }] };
}

type Pending = { kind: AtelierKind } | { radioName: string } | { voiceAgain: true } | null;

/**
 * 月で作る (client M-R210/M-R211): one {bati} chat for everything — your look, {bati}'s dress-up / 変身, lookups, pictures,
 * then コロリン → アート → 曲 → 映像 → ラジオ as the journey's days open them. You ask in words; the result comes into the talk
 * as a card (〔再生〕〔やり直し〕〔星へ飛ばす〕) and is in Bluena at once. A change is asked in words too ("もっと明るく") and
 * makes a new card. The chat never changes its look while something is made. This is {bati}'s thread in the shell
 * (Shell.tsx: left = the conversations, right = Bluena from day 3). Opened from a story step it plays the day's script
 * lines at their moments and hands what was made back to the story (`story`, story.ts).
 */
export function AtelierChat({ first, talk, story, onList, onBluena, unread }: { first: AtelierKind | null; talk: Talk; story?: StoryMode; /** the shell's drawers, from the talk's top bar */ onList?: () => void; onBluena?: () => void; unread?: boolean }) {
  const { me, setMe } = useAuth();
  // M-R245: your bubble colour (picked once)
  const talkTone = useTalkTone();
  const own = usePartner();
  // in a story step the story's {bati} talks (the review page has no account: its {bati} is the story's)
  const partner = story ? { ...own, name: story.speaker('バティ').name, face: story.speaker('バティ').avatar ?? own.face } : own;
  const day = me?.journeyDay;
  const talkId = talk.id;
  const [msgs, setMsgs] = useState<Msg[]>(() => (story ? (story.works ?? []).map((work) => ({ id: uid(), who: 'work' as const, work })) : talk.msgs));
  const lines = cues(story?.lines);
  const [busy, setBusy] = useState(false);
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
    saveTalk({ id: talkId, at: new Date().toISOString(), msgs: msgs.filter((m) => m.who !== 'work' || m.work.status !== 'making') });
  }, [msgs, talkId]);

  // {bati}'s own lines in its personality's manner (M-R216); KIMORIN (no {bati} yet) as written
  const batiVoice = own.isBati ? batiLineVoiceOf(me?.bati) : undefined;
  const say = (text: string, chips?: string[], found?: Work[]) => setMsgs((m) => [...m, { id: uid(), who: 'bati', text: story ? story.voice('バティ', text) : batiLine(text, batiVoice), chips, found }]);
  const ring = useMarkRing();

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
  const put = (w: Work) => setMsgs((m) => (m.some((x) => x.who === 'work' && x.work.id === w.id) ? m.map((x) => (x.who === 'work' && x.work.id === w.id ? { ...x, work: w } : x)) : [...m, { id: uid(), who: 'work', work: w }]));
  const lastWork = () => [...msgs].reverse().find((m): m is Extract<Msg, { who: 'work' }> => m.who === 'work' && m.work.status !== 'making')?.work;

  const run = useCallback(
    async (kind: AtelierKind, prompt: string, prev?: Work) => {
      setBusy(true);
      if (story) {
        line(prev ? 'refine' : 'react');
        line('spell', prompt);
      }
      const shell: Work = { id: uid(), kind, prompt, status: 'making' };
      put(shell);
      try {
        const w = { ...(await make(kind, prompt, { ...ctx, lastSongId: lastSong.current }, prev)), id: shell.id };
        if (w.ref?.songId) lastSong.current = w.ref.songId;
        put(w);
        if (w.status === 'failed') {
          if (!(story && line('fail')) && w.note && !w.image) say(w.note);
        } else if (story) {
          // the card sings (a kororin), then the script's own words after it
          if (line('sing', w.text ?? prompt) && w.audio) void toggleAudio(w.audio).catch(() => undefined);
          if (w.status === 'ready') line('saved');
          line('after');
          line('fix');
        } else if (DONE[kind]) say(DONE[kind]);
        if (w.status === 'ready' && !story) void tipCheck();
      } catch (e) {
        put({ ...shell, status: 'failed', note: failLine(e) });
        if (story) line('fail');
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx],
  );

  /** a kind asked for (by words or a chip): locked → the day it opens; only its name → what should it be */
  const ask = (kind: AtelierKind, content: string) => {
    // a story step makes its kind whatever day the review page plays
    if (story) {
      setPending({ kind });
      return line('open');
    }
    if (!isOpen(kind, day)) return setMsgs((m) => [...m, { id: uid(), who: 'bati', text: batiDaysLeftLine(batiVoice?.personality ?? 'genki', daysUntil(kind, day)) }]);
    if (isBare(content)) {
      setPending({ kind });
      return say(ASK[kind]);
    }
    void run(kind, content);
  };

  const send = (text: string) => {
    setMsgs((m) => [...m, { id: uid(), who: 'me', text }]);
    const p = pending;
    setPending(null);
    if (p && 'radioName' in p) {
      const h = held.current.get(p.radioName);
      const w = msgs.find((m): m is Extract<Msg, { who: 'work' }> => m.who === 'work' && m.work.id === p.radioName)?.work;
      if (h && w) return void recorded({ ...w, title: text.slice(0, 40) }, h.blob, h.seconds);
    }
    // in a story step every message makes the day's kind again (a new card), unless it is a change of the last one
    if (story?.mode === 'make' && first && !p) {
      const last = lastWork();
      const it = detect(text, !!last);
      if (it.kind === 'refine' && last && last.kind !== 'voice' && last.kind !== 'radio') return void run(last.kind, it.content, last);
      return void run(first, text);
    }
    if (p && 'voiceAgain' in p) return void run('voice', text);
    if (p && 'kind' in p) return void run(p.kind, text);
    const last = lastWork();
    const it = detect(text, !!last, markNames());
    if (it.kind === 'find') return void showFound(it);
    if (it.kind === 'make') return ask(it.what, it.content);
    if (it.kind === 'refine' && last) {
      if (last.kind === 'voice') {
        setPending({ voiceAgain: true });
        return say('もう一回、つぶやきを言ってみて');
      }
      if (last.kind === 'radio') return say('カードの〔やり直し〕で、録り直せるよ');
      return void run(last.kind, it.content, last);
    }
    if (it.kind === 'ask') return say('どれにする？', it.options.map((k) => KIND_WORD[k]));
    return say(HELLO, openKinds(day).map((k) => KIND_WORD[k]));
  };

  const chip = (label: string) => {
    const k = (Object.keys(KIND_WORD) as AtelierKind[]).find((x) => KIND_WORD[x] === label);
    setMsgs((m) => [...m, { id: uid(), who: 'me', text: label }]);
    if (k) ask(k, '');
  };

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
    void run(w.kind, w.prompt);
  };

  const flyIt = async (w: Work) => {
    setBusy(true);
    try {
      await fly(w, ctx);
      put({ ...w, flown: true });
      // in a story the next lines say it; standalone {bati} says where it went
      if (story?.onFly) setTimeout(() => story.onFly!(PLANET_OF[w.kind] ?? ''), 900);
      else say(`${PLANET_WORD[w.kind] ?? '星'}へ飛んでいった。ロケットで行けば、見られるよ`);
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

  // M-R232: the side-by-side talk — you at the right, {bati} (or the story's speaker) at the left, the Moon behind
  const people: TalkPerson[] = [
    { id: 'bati', name: partner.name, look: own.isBati || story ? batiLook(me?.bati, partner.face) : characterLook('kimorin'), color: BATI_COLOR },
    { id: 'me', name: me?.displayName ?? '', look: selfLook(me), color: SELF_COLOR, tone: selfTone(me), self: true, avatar: me?.lookIcon },
  ];
  const items: TalkItem[] = msgs.map((m) =>
    m.who === 'me'
      ? { id: m.id, who: 'me', text: m.text, mark: { kind: 'local', id: m.id } }
      : m.who === 'bati'
        ? {
            id: m.id,
            who: 'bati',
            text: m.text,
            mark: { kind: 'local', id: m.id },
            card: m.found?.length
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
            chips: m.chips?.map((c) => ({ label: c, onPick: () => chip(c), disabled: busy })),
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
              full: (
                <WorkCard
                  w={m.work}
                  busy={busy}
                  onAgain={() => void again(m.work)}
                  onFly={() => void flyIt(m.work)}
                  onWear={() => void wearIt(m.work)}
                  onPick={(id) => put({ ...m.work, pick: id, image: m.work.candidates?.find((c) => c.id === id)?.url, worn: false })}
                  onRecorded={(blob, sec) => void recorded(m.work, blob, sec)}
                  onRing={(at) => ring.open(workMarkRef(m.work).kind, workMarkRef(m.work).id, at)}
                />
              ),
            },
          },
  );
  const making = msgs.some((m) => m.who === 'work' && m.work.status === 'making');

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" style={{ fontFamily: SERIF }}>
      <TalkScene
        askTone={talkTone.ask}
        onTone={talkTone.pick}
        people={people}
        items={items}
        thinking={busy || making ? 'bati' : null}
        listening={talkState.listening}
        keyboard={talkState.keyboard}
        place={PLACE_BG.moon}
        top={story ? 40 : 0}
        bar={{ title: partner.name, onList, onBluena, unread }}
        fixedSelfFace={me?.story?.[TALK_FIXED_FACE_KEY] === '1'}
        onRing={(it, at) => it.mark && ring.open(it.mark.kind, it.mark.id, at)}
        composer={
          <TalkComposer
            key={bar}
            placeholder={`${partner.name}に頼む`}
            disabled={busy}
            onState={setTalkState}
            onSend={(v) => {
              send(v);
              setBar((n) => n + 1);
            }}
          />
        }
      />
      {story && <StoryButton story={story} msgs={msgs} busy={busy} />}
      {ring.node}

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
        <span className="block text-[10.5px] text-amber-200/70">{w.status === 'making' ? '作っているよ…' : w.status === 'failed' ? 'うまくできなかった' : w.status === 'record' ? '押して、録る' : '押して、ひらく'}</span>
      </span>
    </span>
  );
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
