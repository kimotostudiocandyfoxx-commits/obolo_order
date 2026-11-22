'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageBar } from '@/components/story/Chat';
import { ApiError, getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { isOpen, lockLine, openKinds, openLessons, type AtelierKind, type Lesson } from '@/lib/atelier/unlock';
import { usePartner } from '@/lib/partner';
import { useAtelierCtx } from './ctx';
import { ASK, DONE, detect, isBare, KIND_WORD } from './intent';
import { fly, failLine, keepShow, make, wear } from './makers';
import { saveTalk, type Talk } from './shelf';
import { Teach } from './Teach';
import { WorkCard } from './WorkCard';
import { uid, type Msg, type Work } from './work';

const SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
const TAUGHT_KEY = 'obolo.atelier.taught';
const PLANET_WORD = { voice: '土星', art: '木星', song: '水星', video: '火星', radio: '金星' } as Record<string, string>;
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
 * (Shell.tsx: left = the conversations, right = Bluena from day 3).
 */
export function AtelierChat({ first, talk }: { first: AtelierKind | null; talk: Talk }) {
  const { me, setMe } = useAuth();
  const partner = usePartner();
  const day = me?.journeyDay;
  const talkId = talk.id;
  const [msgs, setMsgs] = useState<Msg[]>(talk.msgs);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [bar, setBar] = useState(0);
  const held = useRef(new Map<string, { blob: Blob; seconds: number }>());
  const lastSong = useRef<string | undefined>(undefined);
  const end = useRef<HTMLDivElement>(null);
  const ctx = useAtelierCtx();

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);
  // the talk is kept for the left drawer (the works themselves are in Bluena)
  useEffect(() => {
    saveTalk({ id: talkId, at: new Date().toISOString(), msgs: msgs.filter((m) => m.who !== 'work' || m.work.status !== 'making') });
  }, [msgs, talkId]);

  const say = (text: string, chips?: string[]) => setMsgs((m) => [...m, { id: uid(), who: 'bati', text, chips }]);
  const put = (w: Work) => setMsgs((m) => (m.some((x) => x.who === 'work' && x.work.id === w.id) ? m.map((x) => (x.who === 'work' && x.work.id === w.id ? { ...x, work: w } : x)) : [...m, { id: uid(), who: 'work', work: w }]));
  const lastWork = () => [...msgs].reverse().find((m): m is Extract<Msg, { who: 'work' }> => m.who === 'work' && m.work.status !== 'making')?.work;

  const run = useCallback(
    async (kind: AtelierKind, prompt: string, prev?: Work) => {
      setBusy(true);
      const shell: Work = { id: uid(), kind, prompt, status: 'making' };
      put(shell);
      try {
        const w = { ...(await make(kind, prompt, { ...ctx, lastSongId: lastSong.current }, prev)), id: shell.id };
        if (w.ref?.songId) lastSong.current = w.ref.songId;
        put(w);
        if (w.status === 'failed') {
          if (w.note && !w.image) say(w.note);
        } else if (DONE[kind]) say(DONE[kind]);
      } catch (e) {
        put({ ...shell, status: 'failed', note: failLine(e) });
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx],
  );

  /** a kind asked for (by words or a chip): locked → the day it opens; only its name → what should it be */
  const ask = (kind: AtelierKind, content: string) => {
    if (!isOpen(kind, day)) return say(lockLine(kind, day));
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
    if (p && 'voiceAgain' in p) return void run('voice', text);
    if (p && 'kind' in p) return void run(p.kind, text);
    const last = lastWork();
    const it = detect(text, !!last);
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
      say('ブルーナにしまったよ。聴いてみて。〔やり直し〕で、何度でも録り直せるよ');
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
      say(`${PLANET_WORD[w.kind] ?? '星'}へ飛んでいった。ロケットで行けば、見られるよ`);
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
    if (started.current || !first || !me) return;
    started.current = true;
    ask(first, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, me]);

  // OBOLON's lesson, once for each thing that opened (laid over the talk)
  const [lesson, setLesson] = useState<Lesson | null>(null);
  useEffect(() => {
    if (!me) return;
    let local: string[] = [];
    try {
      local = JSON.parse(localStorage.getItem(TAUGHT_KEY) ?? '[]') as string[];
    } catch {
      /* no memory on this device */
    }
    const next = openLessons(day).find((l) => !local.includes(l) && me.story?.[`sys.atelier_${l}`] !== '1');
    setLesson(next ?? null);
  }, [me, day]);
  const taught = (l: Lesson) => {
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
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" style={{ fontFamily: SERIF }}>
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3.5 pb-[calc(96px+env(safe-area-inset-bottom))] pt-1">
        {msgs.map((m) =>
          m.who === 'me' ? (
            <div key={m.id} className="flex justify-end pl-14">
              <p className="max-w-[78%] whitespace-pre-line rounded-[18px] rounded-tr-[5px] px-3.5 py-2 text-[15px] font-medium leading-[1.6] text-[#2b1b06]" style={{ background: 'linear-gradient(135deg, #fbe9b7 0%, #f0c873 55%, #d79d45 100%)' }}>
                {m.text}
              </p>
            </div>
          ) : m.who === 'bati' ? (
            <div key={m.id} className="flex items-end gap-2 pr-8">
              <span className="block h-9 w-9 shrink-0 overflow-hidden rounded-full p-[1.5px]" style={{ background: 'linear-gradient(140deg, #fff1c4, #c9923a 55%, #6b4a1c)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={partner.face} alt="" className="h-full w-full rounded-full bg-[#120c1c] object-cover" />
              </span>
              <div className="min-w-0">
                <div className="w-fit max-w-full rounded-[18px] rounded-tl-[5px] px-3.5 py-2 text-[15px] leading-[1.6] text-white/95" style={{ background: 'linear-gradient(180deg, rgba(38,28,56,0.80), rgba(14,10,24,0.80))', border: '1px solid rgba(240,205,140,0.22)' }}>
                  {m.text}
                </div>
                {m.chips && m.chips.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {m.chips.map((c) => (
                      <button key={c} onClick={() => chip(c)} disabled={busy} className="rounded-full border border-amber-200/45 bg-[rgba(16,11,26,0.62)] px-3 py-1.5 text-[13px] text-amber-50 disabled:opacity-40">
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <WorkCard
              key={m.id}
              w={m.work}
              busy={busy}
              onAgain={() => void again(m.work)}
              onFly={() => void flyIt(m.work)}
              onWear={() => void wearIt(m.work)}
              onPick={(id) => put({ ...m.work, pick: id, image: m.work.candidates?.find((c) => c.id === id)?.url, worn: false })}
              onRecorded={(blob, sec) => void recorded(m.work, blob, sec)}
            />
          ),
        )}
        <div ref={end} />
      </div>

      <MessageBar
        key={bar}
        placeholder={`${partner.name}に頼む`}
        valid={() => !busy}
        onSend={async (v) => {
          send(v);
          setBar((n) => n + 1);
        }}
      />

      {lesson && (
        <Teach
          lesson={lesson}
          onClose={() => {
            taught(lesson);
            setLesson(null);
          }}
        />
      )}
    </div>
  );
}
