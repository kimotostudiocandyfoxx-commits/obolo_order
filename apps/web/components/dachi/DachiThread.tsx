'use client';

import type { DachiMessageView, DachiThreadView, DachiWorkCard } from '@obolo/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CHARACTER_AVATAR } from '@/lib/dachi/useDachiThreads';
import { loadBluenaWorks, WORK_WORD, type BluenaWork } from '@/lib/dachi/works';
import { HoldMic, Wave } from './HoldMic';

const SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
const CHAR_NAME: Record<string, string> = { kimorin: 'KIMORIN⭐︎', mikie: 'MIKIE⭐︎DRILL' };
const POLL_MS = 15_000;

export type DachiThreadProps = {
  /** the thread: a dachi's user id, or 'kimorin' / 'mikie' */
  id: string;
  /** the row from useDachiThreads().list (name, face, kind); looked up when left out */
  thread?: DachiThreadView;
  /** back to the conversation list (the shell's ctx.openList) */
  onList?: () => void;
  /** after a message went (the story sets f_d04_voice_reply from here) */
  onSent?: (m: DachiMessageView) => void;
  /** the thread was heard (its unread dot can go) */
  onRead?: (id: string) => void;
  /** you blocked them: the thread is gone (reload the list, go back to it) */
  onGone?: (id: string) => void;
};

/**
 * One ダチ conversation (M-R212), in the same look as the {bati} chat (components/story/Chat.tsx bubbles and message bar):
 * voice messages and Bluena work cards. The mic records only while held; released, the take is heard back before it is
 * sent or thrown away. Block and report are in the menu at the top right (a person's thread only). Messages go only
 * between dachi — the server refuses anything else. No live calls here (a later members' feature).
 */
export function DachiThread({ id, thread: given, onList, onSent, onRead, onGone }: DachiThreadProps) {
  const { me } = useAuth();
  const [thread, setThread] = useState<DachiThreadView | undefined>(given);
  const [msgs, setMsgs] = useState<DachiMessageView[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [works, setWorks] = useState<BluenaWork[] | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const readCb = useRef(onRead);
  readCb.current = onRead;
  const person = (thread?.kind ?? (id === 'kimorin' || id === 'mikie' ? id : 'dachi')) === 'dachi';

  useEffect(() => setThread(given), [given]);
  useEffect(() => {
    if (given) return;
    void getApi()
      .dachiThreads()
      .then((l) => setThread(l.find((t) => t.id === id)))
      .catch(() => undefined);
  }, [given, id]);

  const load = useCallback(async () => {
    try {
      const list = await getApi().dachiMessages(id);
      setMsgs(list);
      setErr(null);
      if (list.some((m) => !m.fromMe)) {
        void getApi()
          .readDachiThread(id)
          .then(() => readCb.current?.(id))
          .catch(() => undefined);
      }
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'NOT_DACHI' ? 'この会話は、もう開けません' : 'うまく読み込めませんでした');
      setMsgs((m) => m ?? []);
    }
  }, [id]);

  useEffect(() => {
    setMsgs(null);
    void load();
    const t = setInterval(() => document.visibilityState === 'visible' && void load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs?.length]);

  const sent = (m: DachiMessageView) => {
    setMsgs((l) => [...(l ?? []), m]);
    onSent?.(m);
  };

  const sendVoice = async (blob: Blob, seconds: number) => {
    const api = getApi();
    const up = await api.uploadVoice(blob);
    sent(await api.sendDachiMessage(id, { mediaId: up.id, seconds: Math.max(0.1, Math.round(seconds * 10) / 10) }));
  };

  const sendWork = async (card: DachiWorkCard) => {
    setWorks(null);
    try {
      sent(await getApi().sendDachiMessage(id, { work: card }));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e));
    }
  };

  const openWorks = async () => {
    if (!me) return;
    setWorks([]);
    setWorks(await loadBluenaWorks(me.id).catch(() => []));
  };

  const name = thread?.name ?? CHAR_NAME[id] ?? '';
  const face = thread?.pic ?? CHARACTER_AVATAR[thread?.kind ?? id];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" style={{ fontFamily: SERIF }}>
      <div className="flex items-center gap-2 px-3.5 pb-1.5">
        {onList && (
          <button onClick={onList} aria-label="会話の一覧" className="text-lg text-amber-100/70">
            ‹
          </button>
        )}
        <Face src={face} name={name} />
        <p className="min-w-0 flex-1 truncate text-[13px] tracking-[0.18em] text-amber-100/90">{name}</p>
        {person && (
          <button onClick={() => setMenu(true)} aria-label="メニュー" className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-amber-100/70">
            ⋯
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3.5 pb-4 pt-1">
        {msgs === null && <p className="py-8 text-center text-xs text-white/40">…</p>}
        {msgs?.map((m, k) => {
          const prev = msgs[k - 1];
          const grouped = !!prev && !prev.fromMe && !m.fromMe && prev.character === m.character;
          return m.fromMe ? <Mine key={m.id} m={m} /> : <Theirs key={m.id} m={m} grouped={grouped} name={m.character ? CHAR_NAME[m.character] : name} face={m.character ? CHARACTER_AVATAR[m.character] : face} />;
        })}
        {err && <p className="text-center text-xs text-rose-300">{err}</p>}
        <div ref={end} />
      </div>

      <HoldMic
        onSend={sendVoice}
        disabled={!!err && msgs?.length === 0}
        left={
          <button onClick={() => void openWorks()} className="rounded-full border border-amber-200/30 px-3 py-2 text-[12.5px] text-amber-50/90">
            ✦ 作品を送る
          </button>
        }
      />

      {works && <WorkPicker works={works} onPick={(c) => void sendWork(c)} onClose={() => setWorks(null)} />}
      {menu && thread && (
        <SafetyMenu
          who={thread}
          onClose={() => setMenu(false)}
          onBlocked={() => {
            setMenu(false);
            onGone?.(id);
          }}
        />
      )}
    </div>
  );
}

function Face({ src, name }: { src?: string | null; name: string }) {
  return (
    <span className="block h-9 w-9 shrink-0 overflow-hidden rounded-full p-[1.5px]" style={{ background: 'linear-gradient(140deg, #fff1c4, #c9923a 55%, #6b4a1c)' }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full rounded-full bg-[#120c1c] object-cover object-top" />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-[radial-gradient(circle_at_50%_35%,#3b2c52,#120c1c)] text-[13px] text-amber-100/80">{name.slice(0, 1)}</span>
      )}
    </span>
  );
}

const THEIR_BUBBLE = { background: 'linear-gradient(180deg, rgba(38,28,56,0.80), rgba(14,10,24,0.80))', border: '1px solid rgba(240,205,140,0.22)' };
const MY_BUBBLE = { background: 'linear-gradient(135deg, #fbe9b7 0%, #f0c873 55%, #d79d45 100%)' };

function Mine({ m }: { m: DachiMessageView }) {
  return (
    <div className="flex justify-end pl-14">
      {m.kind === 'work' && m.work ? (
        <WorkCardView card={m.work} mine />
      ) : (
        <div className="w-[min(78%,260px)] rounded-[18px] rounded-tr-[5px] px-2.5 py-1.5 text-[#2b1b06]" style={MY_BUBBLE}>
          <VoicePlay url={m.audioUrl} seconds={m.seconds} light />
        </div>
      )}
    </div>
  );
}

function Theirs({ m, grouped, name, face }: { m: DachiMessageView; grouped: boolean; name: string; face?: string | null }) {
  return (
    <div className="flex items-end gap-2 pr-8">
      <div className="w-9 shrink-0">{!grouped && <Face src={face} name={name} />}</div>
      <div className="min-w-0 flex-1">
        {!grouped && <p className="mb-1 ml-1 text-[10.5px] tracking-[0.22em] text-amber-200/90">{name}</p>}
        {m.kind === 'work' && m.work ? (
          <WorkCardView card={m.work} />
        ) : (
          <div className="w-[min(100%,260px)] rounded-[18px] rounded-tl-[5px] px-2.5 py-1.5 text-white/95" style={THEIR_BUBBLE}>
            {m.audioUrl ? <VoicePlay url={m.audioUrl} seconds={m.seconds} /> : null}
            {/* a character's line whose voice is not made yet: its words (VOICE PENDING, docs/placeholders.md P-DACHI-1/3) */}
            {m.text && <p className={`whitespace-pre-line px-1 text-[15px] leading-[1.6] ${m.audioUrl ? 'mt-1 text-[12.5px] text-white/60' : ''}`}>{m.text}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

let playing: HTMLAudioElement | null = null;
/** resolves a stored voice: an absolute URL, a path of this app (a character's line), or the demo's idb: blobs */
async function audioSrc(url: string): Promise<string | null> {
  if (!url.startsWith('idb:')) return url;
  const { getBlob } = await import('@/lib/api/idb');
  const b = await getBlob(url.slice(4));
  return b ? URL.createObjectURL(b) : null;
}

function VoicePlay({ url, seconds, light }: { url: string | null; seconds: number | null; light?: boolean }) {
  const [on, setOn] = useState(false);
  const toggle = async () => {
    if (!url) return;
    if (on) {
      playing?.pause();
      return setOn(false);
    }
    playing?.pause();
    const src = await audioSrc(url);
    if (!src) return;
    const a = new Audio(src);
    playing = a;
    a.onended = () => setOn(false);
    a.onpause = () => setOn(false);
    await a
      .play()
      .then(() => setOn(true))
      .catch(() => setOn(false));
  };
  return (
    <button onClick={() => void toggle()} disabled={!url} className="flex w-full items-center gap-2 py-0.5 text-left" aria-label={on ? '止める' : '聞く'}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${light ? 'bg-[#2b1b06]/15' : 'bg-white/15'}`}>{on ? '❚❚' : '▶'}</span>
      <Wave active={on} light={light} />
      {seconds != null && <span className={`shrink-0 text-xs ${light ? 'text-[#2b1b06]/70' : 'text-amber-100/70'}`}>{Math.max(1, Math.round(seconds))}秒</span>}
    </button>
  );
}

/** a Bluena work sent as a card */
function WorkCardView({ card, mine }: { card: DachiWorkCard; mine?: boolean }) {
  const sound = card.kind === 'song' || card.kind === 'kororin' || card.kind === 'radio';
  const film = card.kind === 'mv' || card.kind === 'video';
  return (
    <div className={`w-[min(78%,240px)] overflow-hidden rounded-2xl border border-amber-200/30 bg-[rgba(16,11,26,0.78)] ${mine ? 'rounded-tr-[5px]' : 'rounded-tl-[5px]'}`}>
      {card.posterUrl || (!sound && !film && card.url) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.posterUrl ?? card.url} alt="" className="aspect-square w-full object-cover" />
      ) : null}
      <div className="space-y-1 p-2.5">
        <p className="text-[10.5px] tracking-[0.2em] text-amber-200/80">✦ {WORK_WORD[card.kind]}</p>
        {(card.title || card.text) && <p className="line-clamp-3 text-[13.5px] leading-snug text-amber-50">{card.title || card.text}</p>}
        {sound && card.url && <VoicePlay url={card.url} seconds={null} />}
        {film && card.url && (
          <a href={card.url} target="_blank" rel="noreferrer" className="inline-block rounded-full border border-amber-200/40 px-3 py-1 text-xs text-amber-50">
            ▶ 見る
          </a>
        )}
      </div>
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 flex items-end bg-black/50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="pb-safe max-h-[70%] w-full overflow-y-auto rounded-t-3xl border-t border-amber-200/20 bg-[#0e0a1a]/95 p-4 backdrop-blur-xl">
        <p className="mb-3 text-center text-[13px] tracking-[0.2em] text-amber-100/80">{title}</p>
        {children}
      </div>
    </div>
  );
}

function WorkPicker({ works, onPick, onClose }: { works: BluenaWork[]; onPick: (c: DachiWorkCard) => void; onClose: () => void }) {
  return (
    <Sheet title="Bluenaの作品を、カードで送る" onClose={onClose}>
      {works.length === 0 ? (
        <p className="py-6 text-center text-xs text-white/45">まだ、送れる作品がありません</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {works.map((w) => (
            <button key={w.key} onClick={() => onPick(w.card)} className="overflow-hidden rounded-xl border border-white/10 bg-white/5 text-left">
              {w.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={w.image} alt="" className="aspect-square w-full object-cover" />
              ) : (
                <span className="flex aspect-square w-full items-center justify-center text-2xl text-amber-100/60">♪</span>
              )}
              <p className="truncate px-1.5 py-1 text-[11px] text-white/70">{w.card.title || w.card.text || WORK_WORD[w.card.kind]}</p>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}

/** the top-right menu: block / report (the existing comms paths: POST /comms/block/:id, POST /comms/report kind 'voice') */
function SafetyMenu({ who, onClose, onBlocked }: { who: DachiThreadView; onClose: () => void; onBlocked: () => void }) {
  const [step, setStep] = useState<'menu' | 'block' | 'report' | 'done'>('menu');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (f: () => Promise<unknown>, next: () => void) => {
    setBusy(true);
    setErr(null);
    try {
      await f();
      next();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const btn = 'w-full rounded-2xl border px-4 py-3 text-[14px] disabled:opacity-40';
  return (
    <Sheet title={who.name} onClose={onClose}>
      <div className="mx-auto max-w-sm space-y-2">
        {step === 'menu' && (
          <>
            <button className={`${btn} border-white/15 text-amber-50`} onClick={() => setStep('report')}>
              通報する
            </button>
            <button className={`${btn} border-rose-300/40 text-rose-200`} onClick={() => setStep('block')}>
              ブロックする
            </button>
          </>
        )}
        {step === 'block' && (
          <>
            <p className="px-1 text-[13px] leading-relaxed text-white/70">ブロックすると、おたがいにダチではなくなり、声のメッセージも届かなくなります。相手には知らされません。</p>
            <button disabled={busy} className={`${btn} border-rose-300/40 bg-rose-400/15 text-rose-100`} onClick={() => void run(() => getApi().blockPerson(who.id, true), onBlocked)}>
              ブロックする
            </button>
          </>
        )}
        {step === 'report' &&
          (
            [
              ['mean', 'いやなことを言われた'],
              ['scary', 'こわい・あぶない'],
              ['other', 'そのほか'],
            ] as const
          ).map(([reason, label]) => (
            <button key={reason} disabled={busy} className={`${btn} border-white/15 text-amber-50`} onClick={() => void run(() => getApi().reportPerson({ userId: who.id, kind: 'voice', reason }), () => setStep('done'))}>
              {label}
            </button>
          ))}
        {step === 'done' && <p className="py-3 text-center text-[13px] text-white/70">とどきました。運営が確認します。ブロックもできます。</p>}
        {step === 'done' && (
          <button className={`${btn} border-rose-300/40 text-rose-200`} onClick={() => setStep('block')}>
            ブロックする
          </button>
        )}
        {err && <p className="text-center text-xs text-rose-300">{err}</p>}
      </div>
    </Sheet>
  );
}
