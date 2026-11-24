'use client';

import type { DachiMessageView, DachiThreadView, DachiWorkCard } from '@obolo/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CHARACTER_AVATAR } from '@/lib/dachi/useDachiThreads';
import { loadBluenaWorks, WORK_WORD, type BluenaWork } from '@/lib/dachi/works';
import { HoldMic, Wave } from './HoldMic';
import { playClip, type Clip } from '@/lib/voice/webVoice';
import { DACHI_TEXT_MAX, TALK_FIXED_FACE_KEY } from '@obolo/shared';
import { TalkComposer } from '@/components/talk/TalkComposer';
import { TalkScene, type TalkItem, type TalkPerson } from '@/components/talk/TalkScene';
import { useMarkRing } from '@/components/finds/MarkRing';
import { talkDayOf } from '@/lib/finds/talks';
import { castLook } from '@/lib/talk/demoLooks';
import { characterLook, colorOf, DACHI_COLOR, PLACE_BG, SELF_COLOR, selfLook, selfTone } from '@/lib/talk/looks';


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
  /** open Bluena (the shell's right drawer) from the talk's top bar */
  onBluena?: () => void;
  /** after a message went (the story sets f_d04_voice_reply from here) */
  onSent?: (m: DachiMessageView) => void;
  /** the thread was heard (its unread dot can go) */
  onRead?: (id: string) => void;
  /** you blocked them: the thread is gone (reload the list, go back to it) */
  onGone?: (id: string) => void;
  /** M-R232: where the talk is (the place behind the two) */
  place?: 'moon' | 'saturn' | null;
  /** M-R237: only this day's talk (YYYY-MM-DD), read only — a day opened from the past talks' list */
  day?: string;
  /** the Moon chat's tabs (MoonTabs), under the bar */
  banner?: React.ReactNode;
  /** a back control in the bar (the ダチ tab: back to the row of ダチ) */
  onBack?: () => void;
};

/**
 * One ダチ conversation (M-R212), in the same look as the {bati} chat (components/story/Chat.tsx bubbles and message bar):
 * voice messages and Bluena work cards. The mic records only while held; released, the take is heard back before it is
 * sent or thrown away. Block and report are in the menu at the top right (a person's thread only). Messages go only
 * between dachi — the server refuses anything else. No live calls here (a later members' feature).
 */
export function DachiThread({ id, thread: given, onList, onBluena, onSent, onRead, onGone, place = 'moon', day, banner, onBack }: DachiThreadProps) {
  const ring = useMarkRing();
  const { me } = useAuth();
  const [thread, setThread] = useState<DachiThreadView | undefined>(given);
  const [msgs, setMsgs] = useState<DachiMessageView[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [works, setWorks] = useState<BluenaWork[] | null>(null);
  /** client 2026-11-24: the text field is open (the keyboard beside the mic) */
  const [typing, setTyping] = useState(false);
  const [bar, setBar] = useState(0);
  const [keyboard, setKeyboard] = useState(false);
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
      const all = await getApi().dachiMessages(id);
      const list = day ? all.filter((m) => talkDayOf(m.createdAt) === day) : all;
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
  }, [id, day]);

  useEffect(() => {
    setMsgs(null);
    void load();
    if (day) return;
    const t = setInterval(() => document.visibilityState === 'visible' && void load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const sent = (m: DachiMessageView) => {
    setMsgs((l) => [...(l ?? []), m]);
    onSent?.(m);
  };

  const sendVoice = async (blob: Blob, seconds: number) => {
    const api = getApi();
    const up = await api.uploadVoice(blob);
    sent(await api.sendDachiMessage(id, { mediaId: up.id, seconds: Math.max(0.1, Math.round(seconds * 10) / 10) }));
  };

  /** client 2026-11-24: words typed in the talk (the small keyboard beside the mic) */
  const sendText = async (text: string) => {
    setErr(null);
    try {
      sent(await getApi().sendDachiMessage(id, { text }));
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'CONTENT_FLAGGED' ? 'その言葉は、送れないみたい' : e instanceof ApiError ? e.message : String(e));
    }
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
  const pic = thread?.pic ?? CHARACTER_AVATAR[thread?.kind ?? id];
  const kind = thread?.kind ?? (id === 'kimorin' || id === 'mikie' ? id : 'dachi');
  // the people: the dachi (their own look, or a character's story art), a character speaking in their thread, you
  const people: TalkPerson[] = [
    { id: 'them', name, look: thread?.talk ?? characterLook(kind) ?? (pic ? { of: pic, stand: pic } : null), color: DACHI_COLOR, avatar: kind === 'dachi' ? pic : undefined },
    ...[...new Set((msgs ?? []).filter((m) => m.character && m.character !== kind).map((m) => m.character!))].map((c) => ({ id: c, name: CHAR_NAME[c] ?? c, look: characterLook(c), color: colorOf(c, 3) })),
    // client 2026-11-24: you stand beside them, side by side, as in the story (no look yet: the talk cast's stand-in)
    { id: 'me', name: me?.displayName ?? '', look: selfLook(me) ?? castLook('user'), color: SELF_COLOR, tone: selfTone(me), self: true, avatar: me?.lookIcon },
  ];
  // M-R239: the first line not heard yet (opening plays from the one before it)
  const firstUnread = (msgs ?? []).findIndex((m) => !m.fromMe && m.read === false);
  const unreadFrom = firstUnread >= 0 ? firstUnread : null;
  const items: TalkItem[] = (msgs ?? []).map((m) => ({
    id: m.id,
    who: m.fromMe ? 'me' : m.character && m.character !== kind ? m.character : 'them',
    text: m.kind === 'work' ? '' : (m.text ?? ''),
    // M-R238: from the words (a character's line), else the sender's own face with it, else the rules
    face: m.faces ? undefined : (m.face ?? undefined),
    faces: m.faces,
    voice: m.kind === 'voice' ? { url: m.audioUrl, seconds: m.seconds } : undefined,
    mark: { kind: 'dachi_message' as const, id: m.id },
    card: m.kind === 'work' && m.work ? { label: m.work.title || WORK_WORD[m.work.kind], thumb: <WorkCardView card={m.work} />, full: <WorkCardView card={m.work} big /> } : undefined,
  }));

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* M-R232: the same side-by-side talk — you at the right, the dachi in the look they made at the left */}
      <TalkScene
        key={id}
        people={people}
        items={items}
        place={place ? PLACE_BG[place] : undefined}
        fixedSelfFace={me?.story?.[TALK_FIXED_FACE_KEY] === '1'}
        top={0}
        // the prototype's top bar: the conversations, the name (and the day of a past talk), ⋯ / mute / Bluena
        bar={{
          title: day ? `${name}・${day.slice(5).replace('-', '/')}` : name,
          onList,
          onBluena,
          onBack,
          below: banner,
          right: person ? (
            <button onClick={() => setMenu(true)} aria-label="メニュー" className="grid h-[42px] w-[42px] flex-none place-items-center rounded-full border border-[rgba(210,220,255,.22)] bg-[rgba(16,22,64,.46)] text-lg text-[#f4f1ff] backdrop-blur-[10px]">
              ⋯
            </button>
          ) : undefined,
        }}
        keyboard={typing && keyboard}
        log
        loading={msgs === null}
        unreadFrom={day ? null : unreadFrom}
        onRing={(it, at) => it.mark && ring.open(it.mark.kind, it.mark.id, at)}
        composer={
          day ? undefined : <div>
            {err && <p className="mb-1 text-center text-xs text-rose-300">{err}</p>}
            {msgs === null && <p className="mb-1 text-center text-xs text-white/40">…</p>}
            {typing ? (
              <TalkComposer key={bar} startTyping placeholder={`${name}に送る`} maxLength={DACHI_TEXT_MAX} onVoice={() => setTyping(false)} onState={(st) => setKeyboard(st.keyboard)} onSend={(t) => { void sendText(t); setBar((n) => n + 1); }} />
            ) : (
            <HoldMic
              big
              onSend={sendVoice}
              disabled={!!err && msgs?.length === 0}
              right={
                <button onClick={() => setTyping(true)} aria-label="文字で送る" className="grid h-[42px] w-[42px] place-items-center rounded-full border border-[rgba(210,220,255,.22)] bg-[rgba(16,22,64,.46)] text-[15px] text-[#f4f1ff] backdrop-blur-[10px]">
                  ⌨
                </button>
              }
              left={
                <button onClick={() => void openWorks()} aria-label="作品を送る" className="grid h-[42px] w-[42px] place-items-center rounded-full border border-[rgba(210,220,255,.22)] bg-[rgba(16,22,64,.46)] text-[15px] text-[#f4f1ff] backdrop-blur-[10px]">
                  ✦
                </button>
              }
            />
            )}
          </div>
        }
      />

      {ring.node}
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

function VoicePlay({ url, seconds, light }: { url: string | null; seconds: number | null; light?: boolean }) {
  const [on, setOn] = useState(false);
  const clip = useRef<Clip | null>(null);
  useEffect(() => () => clip.current?.stop(), []);
  // M-R239: through Web Audio (quiet with the silent switch on); idb: recordings are read by the player
  const toggle = async () => {
    if (!url) return;
    if (on) {
      clip.current?.stop();
      return setOn(false);
    }
    const c = await playClip(url);
    if (!c) return;
    clip.current = c;
    setOn(true);
    void c.done.then(() => setOn(false));
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
function WorkCardView({ card, mine, big }: { card: DachiWorkCard; mine?: boolean; big?: boolean }) {
  const sound = card.kind === 'song' || card.kind === 'kororin' || card.kind === 'radio';
  const film = card.kind === 'mv' || card.kind === 'video';
  return (
    <div className={`${big ? 'w-full' : 'w-full max-w-[220px]'} overflow-hidden rounded-2xl border border-amber-200/30 bg-[rgba(16,11,26,0.78)] ${mine ? 'rounded-tr-[5px]' : 'rounded-tl-[5px]'}`}>
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
