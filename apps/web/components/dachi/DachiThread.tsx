'use client';

import type { DachiMessageView, DachiThreadView, DachiWorkCard } from '@obolo/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CHARACTER_AVATAR } from '@/lib/dachi/useDachiThreads';
import { loadBluenaWorks, workCard, WORK_WORD, type BluenaWork } from '@/lib/dachi/works';
import { Wave } from './HoldMic';
import { TapVoice, type VoiceToSend } from './TapVoice';
import { voicePartOf, voiceSendBody } from '@/lib/dachi/voiceSend';
import { playClip, readyClip, type Clip } from '@/lib/voice/webVoice';
import { CUTE_VOICE_WORDS, cuteVoiceMana, cuteVoiceMissWords, DACHI_PAGE, DACHI_TEXT_MAX, formatMana, linkDomain, TALK_FIXED_FACE_KEY, wordsAndLinks, type CuteVoiceInfo } from '@obolo/shared';
import { DeviceButton } from '@/components/atelier/DeviceButton';
import { GameById } from '@/components/atelier/GamePlay';
import { BookById } from '@/components/atelier/BookRead';
import { ClipRelic } from '@/components/relic/ClipRelics';
import { PortalRelic } from '@/components/relic/PortalRelic';
import { WorkRelic } from '@/components/relic/WorkRelic';
import { groupRelics, itemIndexOf } from '@/lib/relic/layout';
import { clipsChanged, useClipSend } from '@/lib/clip/useClip';
import type { Work } from '@/components/atelier/work';
import { TalkComposer } from '@/components/talk/TalkComposer';
import { TalkScene, type TalkItem, type TalkPerson } from '@/components/talk/TalkScene';
import { useMarkRing } from '@/components/finds/MarkRing';
import { talkDayOf } from '@/lib/finds/talks';
import { castLook } from '@/lib/talk/demoLooks';
import { characterLook, colorOf, DACHI_COLOR, PLACE_BG, SELF_COLOR, selfLook, selfTone } from '@/lib/talk/looks';


/** this device: '0' = the words of a member who is not recorded go without the cute voice */
const CUTE_KEY = 'obolo.dachi.cuteVoice';
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
  /** M-R232: where the talk is (the place behind the two) */
  place?: 'moon' | 'saturn' | null;
  /** M-R237: only this day's talk (YYYY-MM-DD), read only — a day opened from the past talks' list */
  day?: string;
  /** the Moon chat's tabs (MoonTabs), under the bar */
  banner?: React.ReactNode;
  /** a back control in the bar (the ダチ tab: back to the row of ダチ) */
  onBack?: () => void;
  /** R10: the Bluena device (bottom left, beside the mic), its works sent into this talk */
  onDevice?: () => void;
};

/**
 * One ダチ conversation (M-R212), in the same look as the {bati} chat (components/story/Chat.tsx bubbles and message bar):
 * voice messages and Bluena work cards. A tap starts the take, a tap ends it; it is made ready on the server and sent
 * from its draft card (TapVoice.tsx). Client 2026-11-27, after trying it: the sender does not hear their own voice —
 * not on the card, and not here (their own voice bubbles show the words and a small mark, no play control). Block and report are in the menu at the top right (a person's thread only). Messages go only
 * between dachi — the server refuses anything else. No live calls here (a later members' feature).
 */
export function DachiThread({ id, thread: given, onList, onSent, onRead, onGone, place = 'moon', day, banner, onBack, onDevice }: DachiThreadProps) {
  const ring = useMarkRing();
  const { me } = useAuth();
  const [thread, setThread] = useState<DachiThreadView | undefined>(given);
  const [msgs, setMsgs] = useState<DachiMessageView[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [works, setWorks] = useState<BluenaWork[] | null>(null);
  /** client 2026-11-24: the text field is open (the keyboard beside the mic) */
  const [typing, setTyping] = useState(false);
  // client 2026-11-27 (shared/cuteVoice.ts): a member who is not recorded — their words are read by the default cute
  // voice. Whether it is on here and the live price come from the server once; the switch is kept on this device.
  const [note, setNote] = useState<string | null>(null);
  const [cute, setCute] = useState<CuteVoiceInfo | null>(null);
  const [cuteWanted, setCuteWanted] = useState(true);
  useEffect(() => {
    if (!me || me.mediaOk) return setCute(null);
    try {
      setCuteWanted(localStorage.getItem(CUTE_KEY) !== '0');
    } catch {
      /* private mode: on */
    }
    let live = true;
    void getApi()
      .dachiCuteVoice()
      .then((c) => live && setCute(c))
      .catch(() => undefined);
    return () => void (live = false);
  }, [me?.id, me?.mediaOk]);
  const cuteOn = !!cute?.on && cuteWanted;
  const toggleCute = () => {
    const on = !cuteWanted;
    setCuteWanted(on);
    setNote(null);
    try {
      localStorage.setItem(CUTE_KEY, on ? '1' : '0');
    } catch {
      /* private mode */
    }
  };
  const cuteCost = (t: string) => {
    const mana = formatMana(cuteVoiceMana(t, cute?.rate));
    return { text: CUTE_VOICE_WORDS.price(mana), label: CUTE_VOICE_WORDS.priceLabel(mana) };
  };
  const [bar, setBar] = useState(0);
  const [keyboard, setKeyboard] = useState(false);
  /** R9: KIMORIN⭐︎'s answer is on its way (thinking … until its voice is ready) */
  const [waiting, setWaiting] = useState(false);
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
      // R10: the newest page (older pages come as the talk is scrolled up); a past day's talk: all of it
      const all = await getApi().dachiMessages(id, day ? {} : { limit: DACHI_PAGE });
      const list = day ? all.filter((m) => talkDayOf(m.createdAt) === day) : all;
      if (!day && older.current === null) older.current = all.length >= DACHI_PAGE;
      // R9: a voice not heard yet (KIMORIN⭐︎'s lines, a dachi's message) is fetched and decoded first (≤ 2.5 s), so its
      // bubble and its voice start together
      if (!day) {
        const fresh = list.filter((m) => !m.fromMe && m.read === false && m.audioUrl).slice(-3);
        if (fresh.length) await Promise.all(fresh.map((m) => readyClip(m.audioUrl)));
      }
      // the older pages already loaded stay above the newest one
      setMsgs((prev) => (day || !prev?.length || !list.length ? list : [...prev.filter((m) => m.createdAt < list[0].createdAt), ...list]));
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

  /** R10: scrolled to the top of the talk — the page before the oldest one here (no end, until there is no more) */
  const older = useRef<boolean | null>(null);
  const loadingOlder = useRef(false);
  const loadOlder = useCallback(async () => {
    if (day || !older.current || loadingOlder.current) return;
    const first = msgsRef.current?.[0];
    if (!first) return;
    loadingOlder.current = true;
    try {
      const page = await getApi().dachiMessages(id, { before: first.createdAt, limit: DACHI_PAGE });
      older.current = page.length >= DACHI_PAGE;
      if (page.length) setMsgs((prev) => [...page.filter((m) => !(prev ?? []).some((x) => x.id === m.id)), ...(prev ?? [])]);
    } catch {
      /* tried again at the next scroll to the top */
    } finally {
      loadingOlder.current = false;
    }
  }, [id, day]);
  const msgsRef = useRef<DachiMessageView[] | null>(null);
  msgsRef.current = msgs;

  // R10: a work sent from the Bluena device into this talk (〔送る〕)
  useEffect(() => {
    const got = (e: Event) => {
      const d = (e as CustomEvent<{ to: string; work: Work }>).detail;
      if (d?.to === id && d.work) void sendWork(workCard(d.work));
    };
    window.addEventListener('obolo:dachi-send', got);
    return () => window.removeEventListener('obolo:dachi-send', got);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Bluena's 📎: files from the device, sent into this talk one after another (the open talk only: not a past day)
  useClipSend('dachi', (files) => {
    if (day) return;
    void (async () => {
      for (const f of files) await sendBody({ fileId: f.id });
      clipsChanged();
    })();
  });

  useEffect(() => {
    setMsgs(null);
    void load();
    if (day) return;
    const t = setInterval(() => document.visibilityState === 'visible' && void load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const sent = (m: DachiMessageView) => {
    // R9: KIMORIN⭐︎'s answer comes back with the message (said in the talk like any line)
    const { reply, ...mine } = m;
    setMsgs((l) => [...(l ?? []), mine]);
    onSent?.(mine);
    if (!reply) return setWaiting(false);
    // R9: KIMORIN⭐︎'s words and voice together — the voice decoded first (≤ 2.5 s), the bubble at the moment it plays
    setWaiting(true);
    void readyClip(reply.audioUrl).finally(() => {
      setWaiting(false);
      setMsgs((l) => [...(l ?? []), reply]);
    });
  };

  /**
   * client 2026-11-27: the voice made ready (components/dachi/TapVoice.tsx): its caption and its sound go with it — the
   * recording (「そのまま」), or the caption to be read as the voice (「きれい」: with no mana, or when it cannot be made, the
   * words go alone and one calm line says so)
   */
  const sendVoice = async (v: VoiceToSend) => {
    setNote(null);
    if (id === 'kimorin') setWaiting(true);
    try {
      const { cute: c, ...m } = await getApi().sendDachiMessage(id, voiceSendBody(v));
      if (c && 'miss' in c) setNote(cuteVoiceMissWords(c.miss));
      sent(m);
    } catch (e) {
      setWaiting(false);
      throw e;
    }
  };

  /** client 2026-11-24: words typed in the talk (the small keyboard beside the mic) */
  const sendText = async (text: string) => {
    setErr(null);
    setNote(null);
    if (id === 'kimorin') setWaiting(true);
    try {
      // client 2026-11-27: a member who is not recorded — the words are read by the default cute voice (the switch on);
      // with no mana, or when it cannot be made, they go as words and one calm line says so (never an error)
      const { cute: c, ...m } = await getApi().sendDachiMessage(id, { text, ...(cuteOn ? { spoken: true } : {}) });
      if (c && 'miss' in c) setNote(cuteVoiceMissWords(c.miss));
      sent(m);
    } catch (e) {
      setWaiting(false);
      setErr(e instanceof ApiError && e.code === 'CONTENT_FLAGGED' ? 'その言葉は、送れないみたい' : e instanceof ApiError ? e.message : String(e));
    }
  };

  const sendWork = async (card: DachiWorkCard) => {
    setWorks(null);
    await sendBody({ work: card });
  };
  /** a work card or a 📎 file (KIMORIN⭐︎ answers these too) */
  const sendBody = async (body: { work: DachiWorkCard } | { fileId: string }) => {
    setErr(null);
    if (id === 'kimorin') setWaiting(true);
    try {
      sent(await getApi().sendDachiMessage(id, body));
    } catch (e) {
      setWaiting(false);
      setErr(e instanceof ApiError ? (e.code === 'FILE_NOT_FOUND' ? 'そのファイルは、もうないみたい' : e.message) : String(e));
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
  // R12: what was sent floats as relics — a 📎 file, a work, the portal of each URL in the words (the words stay in the
  // bubble); relics sent together by the same one float as one cluster (one item: the unread line counts in items)
  const list = msgs ?? [];
  const parts = list.map((m) => {
    const who = m.fromMe ? 'me' : m.character && m.character !== kind ? m.character : 'them';
    const links = m.kind === 'text' && m.text ? wordsAndLinks(m.text) : { words: m.text ?? '', urls: [] };
    const relics: React.ReactNode[] =
      m.kind === 'file' && m.file
        ? [<ClipRelic key={m.id} file={m.file} />]
        : m.kind === 'work' && m.work
          ? [<WorkRelic key={m.id} id={m.id} card={m.work} mine={m.fromMe} full={<WorkCardView card={m.work} big mine={m.fromMe} />} />]
          : links.urls.map((u, k) => <PortalRelic key={`${m.id}-${k}`} id={`${m.id}-${k}`} url={u} />);
    const label = m.kind === 'file' && m.file ? `📎 ${m.file.name}` : m.kind === 'work' && m.work ? `✦ ${m.work.title || WORK_WORD[m.work.kind]}` : links.urls.length ? `🔗 ${linkDomain(links.urls[0])}` : undefined;
    const words = m.kind === 'work' || m.kind === 'file' ? '' : m.kind === 'text' ? links.words : (m.text ?? '');
    return { m, who, relics, label, words, relicOnly: relics.length > 0 && !words && m.kind !== 'voice' };
  });
  const groups = groupRelics(parts.map((p) => ({ who: p.who, at: Date.parse(p.m.createdAt) || 0, relicOnly: p.relicOnly })));
  const itemAt = itemIndexOf(groups);
  // M-R239: the first line not heard yet (opening plays from the one before it)
  const firstUnread = list.findIndex((m) => !m.fromMe && m.read === false);
  const unreadFrom = firstUnread >= 0 ? itemAt[firstUnread] : null;
  const items: TalkItem[] = groups.map((g) => {
    const { m, who, words, label } = parts[g[0]];
    const relics = g.flatMap((i) => parts[i].relics);
    return {
      id: m.id,
      who,
      text: words,
      // M-R238: from the words (a character's line), else the sender's own face with it, else the rules
      face: m.faces ? undefined : (m.face ?? undefined),
      faces: m.faces,
      // your own voice is not played back to you: the words and a quiet mark (lib/dachi/voiceSend.ts)
      ...voicePartOf(m),
      mark: { kind: 'dachi_message' as const, id: m.id },
      ...(relics.length ? { relics, relicLabel: g.length > 1 ? `${label}ほか${g.length - 1}つ` : label, relicFan: g.every((i) => parts[i].m.file?.kind === 'photo') } : {}),
    };
  });

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* M-R232: the same side-by-side talk — you at the right, the dachi in the look they made at the left */}
      <TalkScene
        key={id}
        people={people}
        items={items}
        thinking={waiting ? 'them' : null}
        place={place ? PLACE_BG[place] : undefined}
        fixedSelfFace={me?.story?.[TALK_FIXED_FACE_KEY] === '1'}
        top={0}
        // the prototype's top bar: the conversations, the name (and the day of a past talk), ⋯ / mute / Bluena
        bar={{
          title: day ? `${name}・${day.slice(5).replace('-', '/')}` : name,
          onList,
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
        onReachTop={day ? undefined : () => void loadOlder()}
        loading={msgs === null}
        unreadFrom={day ? null : unreadFrom}
        onRing={(it, at) => it.mark && ring.open(it.mark.kind, it.mark.id, at)}
        composer={
          day ? undefined : <div>
            {err && <p className="mb-1 text-center text-xs text-rose-300">{err}</p>}
            {note && !err && (
              <p className="mb-1 text-center text-xs text-[#b9bde6] [text-shadow:0_1px_4px_#000]" role="status" data-testid="cute-voice-note">
                {note}
              </p>
            )}
            {msgs === null && <p className="mb-1 text-center text-xs text-white/40">…</p>}
            {typing ? (
              <TalkComposer key={bar} micPath="dachi" startTyping placeholder={`${name}に送る`} maxLength={DACHI_TEXT_MAX} onVoice={() => setTyping(false)} onState={(st) => setKeyboard(st.keyboard)} onSend={(t) => { void sendText(t); setBar((n) => n + 1); }} />
            ) : (
            // client 2026-11-27: a tap starts the recording, a tap ends it; the take is made ready on the server (the
            // trial). A member whose voice may not be recorded (under 13 …): the mic hears words only — nothing is kept
            (() => {
              const left = (
                onDevice ? (
                  <DeviceButton onClick={onDevice} />
                ) : (
                  <button onClick={() => void openWorks()} aria-label="作品を送る" className="grid h-[42px] w-[42px] place-items-center rounded-full border border-[rgba(210,220,255,.22)] bg-[rgba(16,22,64,.46)] text-[15px] text-[#f4f1ff] backdrop-blur-[10px]">
                    ✦
                  </button>
                )
              );
              return me?.mediaOk ? (
                <TapVoice
                  onSend={sendVoice}
                  disabled={!!err && msgs?.length === 0}
                  left={left}
                  right={
                    <button onClick={() => setTyping(true)} aria-label="文字で送る" className="grid h-[42px] w-[42px] place-items-center rounded-full border border-[rgba(210,220,255,.22)] bg-[rgba(16,22,64,.46)] text-[15px] text-[#f4f1ff] backdrop-blur-[10px]">
                      ⌨
                    </button>
                  }
                />
              ) : (
                <>
                  {cute?.on && (
                    <div className="mb-1.5 flex justify-center">
                      <button
                        type="button"
                        onClick={toggleCute}
                        aria-pressed={cuteOn}
                        aria-label={cuteOn ? CUTE_VOICE_WORDS.toggleOn : CUTE_VOICE_WORDS.toggleOff}
                        data-testid="cute-voice-toggle"
                        className={`rounded-full border px-3 py-1 text-[11.5px] font-bold transition active:scale-95 ${cuteOn ? 'border-[#dfe6ff] bg-[#dfe6ff] text-[#070b24]' : 'border-[rgba(210,220,255,.3)] bg-[rgba(16,22,64,.46)] text-[#dfe6ff]'}`}
                      >
                        <span aria-hidden>{cuteOn ? '✓ ' : ''}🔊 </span>
                        {CUTE_VOICE_WORDS.toggle}
                      </button>
                    </div>
                  )}
                  <TalkComposer key={`w${bar}`} micPath="dachi" placeholder={`${name}に送る`} maxLength={DACHI_TEXT_MAX} side={left} cost={cuteOn ? cuteCost : undefined} onState={(st) => setKeyboard(st.keyboard)} onSend={(t) => { void sendText(t); setBar((n) => n + 1); }} />
                </>
              );
            })()
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

const loadGame = (id: string) => getApi().game(id);
const loadBook = (id: string) => getApi().book(id);

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
        {/* client 2026-11-25: a book is read, a game played (in the same sandbox) — opened big */}
        {big && card.kind === 'game' && card.refId && <GameById id={card.refId} own={!!mine} load={loadGame} />}
        {big && card.kind === 'book' && card.refId && <BookById id={card.refId} load={loadBook} />}
        {!big && (card.kind === 'game' || card.kind === 'book') && card.refId && <p className="text-[11px] text-amber-100/70">{card.kind === 'game' ? '押して、遊ぶ' : '押して、読む'}</p>}
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
