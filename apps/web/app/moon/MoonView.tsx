'use client';

import { callRequest, kororinRing, TALK_FIXED_FACE_KEY } from '@obolo/shared';
import type { BuddyMessageView, BuddyPersona, BuddyProfileView, BuddyQuotaView } from '@obolo/shared';
import { DrawnPicture, PlaceMap, SourceChips, placeOf } from '@/components/chat/BuddyExtras';
import { useCallback, useEffect, useState } from 'react';
import { DemoBanner } from '@/components/DemoBanner';
import { PlanetShell } from '@/components/PlanetShell';
import { PlanetSphere } from '@/components/PlanetSphere';
import { RequireAuth } from '@/components/RequireAuth';
import { ApiError, getApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n/client';
import { useAuth } from '@/lib/auth';
import { RoomSheet, type RoomMode } from './BatiRoom';
import { LineIcon } from '@/components/LineIcon';
import { BatiSettings, MoonEgg, eggReady } from '@/components/bati/BatiSheet';
import { EggMorning } from '@/components/bati/EggMorning';
import { TalkComposer } from '@/components/talk/TalkComposer';
import { TalkScene } from '@/components/talk/TalkScene';
import { BATI_COLOR, batiLook, characterLook, SELF_COLOR, selfLook } from '@/lib/talk/looks';

export function MoonView() {
  return (
    <PlanetShell id="moon" bare backdrop="moon-bg">
      <div className="mx-auto flex h-[calc(100svh-56px-env(safe-area-inset-top))] max-w-xl flex-col">
        <DemoBanner />
        <RequireAuth>
          <Chat />
        </RequireAuth>
      </div>
    </PlanetShell>
  );
}

function BatiFace({ size = 36 }: { size?: number }) {
  const { me } = useAuth();
  // the member's own hatched Bati (its smile when drawn); Bati's room (P-BATI-ROOM)
  const pic = me?.bati?.faces?.smile ?? me?.bati?.imageUrl;
  if (pic)
    return (
      <span className="relative inline-block shrink-0 rounded-full bg-[radial-gradient(circle_at_50%_40%,rgba(255,240,210,0.22),rgba(255,255,255,0.04)_70%)]" style={{ width: size, height: size }} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pic} alt="" className="h-full w-full object-contain" />
      </span>
    );
  // PLACEHOLDER (P-MOON-1): provisional Bati avatar (moon + face) before the hatching.
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }} aria-hidden>
      <PlanetSphere id="moon" size={size} />
      <span className="absolute inset-0 flex items-center justify-center" style={{ fontSize: size * 0.36, paddingTop: size * 0.08 }}>
        <span className="text-slate-700">• ᴗ •</span>
      </span>
    </span>
  );
}

function Chat() {
  const { m, t, locale } = useI18n();
  const { me, setMe } = useAuth();
  const api = getApi();
  const [eggOpen, setEggOpen] = useState(false);
  // SYS-S003: the morning the egg has grown, the scene opens by itself on the Moon (once a visit; the egg stays tappable)
  useEffect(() => {
    if (!eggReady(me)) return;
    try {
      if (sessionStorage.getItem('obolo.eggMorning') === String(me?.batiEgg?.nth)) return;
      sessionStorage.setItem('obolo.eggMorning', String(me?.batiEgg?.nth));
    } catch {
      /* private window: open it anyway */
    }
    setEggOpen(true);
  }, [me]);
  const [profile, setProfile] = useState<BuddyProfileView | null>(null);
  const [messages, setMessages] = useState<BuddyMessageView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [quota, setQuota] = useState<BuddyQuotaView | null>(null);
  const [text, setText] = useState('');
  const [talkState, setTalkState] = useState({ listening: false, keyboard: false });
  const [streamId, setStreamId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [room, setRoom] = useState<RoomMode | null>(null);

  useEffect(() => {
    void Promise.all([api.buddyProfile(), api.buddyMessages(), api.buddyQuota()]).then(([p, page, q]) => {
      setProfile(p);
      setMessages([...page.items].reverse());
      setCursor(page.nextCursor);
      setQuota(q);
    });
  }, [api]);

  const loadOlder = async () => {
    if (!cursor) return;
    const page = await api.buddyMessages(cursor);
    setMessages((cur) => [...[...page.items].reverse(), ...cur]);
    setCursor(page.nextCursor);
  };

  const send = async (said?: string) => {
    const body = (said ?? text).trim();
    if (!body || sending) return;
    setSending(true);
    setNotice(null);
    const tempId = `tmp-${Date.now()}`;
    setMessages((cur) => [...cur, { id: tempId, role: 'user', text: body, createdAt: new Date().toISOString() }]);
    setText('');
    const liveId = `live-${Date.now()}`;
    setStreamId(liveId);
    try {
      // Claude writes the answer as it comes (2026-11-21): the bubble fills while it is written, then the saved reply takes its place
      const r = api.buddyChatStream
        ? await api.buddyChatStream(body, locale, (piece) =>
            setMessages((cur) => {
              const at = cur.findIndex((x) => x.id === liveId);
              if (at < 0) return [...cur, { id: liveId, role: 'buddy', text: piece, createdAt: new Date().toISOString() }];
              const next = [...cur];
              next[at] = { ...next[at], text: next[at].text + piece };
              return next;
            }),
          )
        : await api.buddyChat(body, locale);
      // the same ids stay (the talk does not say them again); a streamed reply keeps its place and gets its faces
      setMessages((cur) => {
        const streamed = cur.some((x) => x.id === liveId);
        return [...cur.filter((x) => x.id !== tempId && x.id !== liveId), { ...r.userMessage, id: tempId }, { ...r.reply, id: streamed ? liveId : r.reply.id }];
      });
      setStreamId(null);
      // M-R222: 「覚えといて」 / 「〇〇って呼んで」 changed {bati} on the server: the card follows
      if (r.reply.remembered || callRequest(body)) void api.me().then(setMe).catch(() => undefined);
      setQuota(r.quota);
    } catch (err) {
      setMessages((cur) => cur.filter((x) => x.id !== tempId && x.id !== liveId));
      setStreamId(null);
      setText(body);
      setNotice(err instanceof ApiError && err.code === 'BUDDY_QUOTA' ? m.moon.quotaReached : m.moon.unavailable);
    } finally {
      setSending(false);
    }
  };

  // the member's own {bati} (named on the Moon) wins over the buddy profile's default name
  const name = me?.bati?.name || profile?.buddyName || (locale === 'ja' ? 'バティ' : 'Bati');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Buddy header */}
      <div className="flex items-center gap-3 px-4 pb-2 pt-3">
        {/* M-R223: a tap on {bati}'s face or your own small one changes the look (no big buttons) */}
        {me?.bati?.imageUrl ? (
          <button type="button" onClick={() => setRoom('bati')} aria-label={`${me.bati.name || 'バティ'}の見た目を変える`} className="shrink-0 rounded-full active:scale-95">
            <BatiFace size={56} />
          </button>
        ) : (
          <BatiFace size={44} />
        )}
        <div className="flex-1">
          <div className="font-black">{name}</div>
          <div className="text-[11px] text-white/50">{profile?.hasMemory ? `${m.moon.memoryOn}` : m.moon.memoryOff}</div>
        </div>
        {/* the day's count only when few are left (story chat 2026-11-02: no numbers on screen otherwise) */}
        {quota && quota.freeDaily - quota.usedToday <= 5 && (
          <span className="chip bg-white/10 text-white/70">今日は、あと少し話せるよ</span>
        )}
        {/* M-R218: the small egg on the temple's altar — bigger and brighter with the days, no number; ready: tap to hatch */}
        <MoonEgg me={me} onHatch={() => setEggOpen(true)} />
        {(me?.lookIcon || me?.avatarUrl) && (
          <button type="button" onClick={() => setRoom('me')} aria-label="自分の見た目を変える" className="h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-sky-100/30 active:scale-95">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={(me.lookIcon || me.avatarUrl)!} alt="" className="h-full w-full object-cover" />
          </button>
        )}
        <button className="btn btn-ghost h-9 w-9 !p-0" onClick={() => setSettingsOpen(true)} aria-label={m.moon.settings}>
          <LineIcon id="gear" className="h-5 w-5" />
        </button>
      </div>

      {/* M-R232: the side-by-side talk — {bati} at the left, you at the right, the Moon behind */}
      <TalkScene
        people={[
          { id: 'bati', name, look: me?.bati ? batiLook(me.bati) : characterLook('kimorin'), color: BATI_COLOR },
          { id: 'me', name: me?.displayName ?? '', look: selfLook(me), color: SELF_COLOR, self: true, avatar: me?.lookIcon },
        ]}
        items={[
          ...(profile && messages.length === 0 ? [{ id: 'hello', who: 'bati', text: t(m.moon.greeting, { name }), face: 'smile' as const }] : []),
          ...messages.map((msg, k) => ({
            id: msg.id,
            who: msg.role === 'user' ? 'me' : 'bati',
            text: msg.text,
            face: msg.faces ? undefined : msg.face,
            motion: msg.motion,
            faces: msg.faces,
            live: msg.id === streamId,
            // M-R208: a picture it drew sits small in the bubble; the pages it looked up and a place's map under the words
            card: msg.image?.url ? { label: '絵', thumb: <DrawnPicture url={msg.image.url} alt={msg.text} />, full: <DrawnPicture url={msg.image.url} alt={msg.text} /> } : undefined,
            extra:
              msg.role === 'buddy' && (msg.sources?.length || placeOf(messages[k - 1]?.text ?? '')) ? (
                <>
                  <SourceChips sources={msg.sources} />
                  {messages[k - 1]?.role === 'user' && placeOf(messages[k - 1].text) && <PlaceMap place={placeOf(messages[k - 1].text)!} />}
                </>
              ) : undefined,
          })),
        ]}
        // M-R234: 'thinking' while it looks it up and writes (not three dots)
        thinking={sending && !messages.some((x) => x.id === streamId) ? 'bati' : null}
        listening={talkState.listening}
        keyboard={talkState.keyboard}
        kororin={kororinRing(me)}
        loading={!profile}
        fixedSelfFace={me?.story?.[TALK_FIXED_FACE_KEY] === '1'}
        top={6}
        composer={
          <TalkComposer
            key={`c-${text}`}
            initial={text}
            placeholder={m.moon.placeholder}
            disabled={sending}
            onState={setTalkState}
            onSend={(v) => void send(v)}
          />
        }
      />
      {cursor && (
        <button className="absolute left-1/2 top-[76px] z-20 -translate-x-1/2 text-[11px] text-white/45 underline" onClick={() => void loadOlder()}>
          {m.moon.olderMessages}
        </button>
      )}

      {notice && <p className="absolute inset-x-4 bottom-[120px] z-20 rounded-xl bg-amber-300/15 px-3 py-2 text-center text-xs text-amber-200">{notice}</p>}

      {/* SYS-S003 「たまごが、育った」 (M-R224), played by the story player */}
      {eggOpen && me && <EggMorning onClose={() => setEggOpen(false)} />}
      {room && (
        <RoomSheet
          mode={room}
          onClose={() => setRoom(null)}
          // Bati's word after the change, in the chat for now (not saved)
          onDone={(line) => {
            setMessages((cur) => [...cur, { id: `room-${Date.now()}`, role: 'buddy', text: line, createdAt: new Date().toISOString() }]);
          }}
        />
      )}

      {settingsOpen && profile && (
        <SettingsSheet
          profile={profile}
          onClose={() => setSettingsOpen(false)}
          onSaved={setProfile}
          onForget={() => {
            setMessages([]);
            setCursor(null);
            setProfile({ ...profile, hasMemory: false });
          }}
        />
      )}
    </div>
  );
}

function SettingsSheet({
  profile,
  onClose,
  onSaved,
  onForget,
}: {
  profile: BuddyProfileView;
  onClose: () => void;
  onSaved: (p: BuddyProfileView) => void;
  onForget: () => void;
}) {
  const { m } = useI18n();
  const { me, setMe } = useAuth();
  const [name, setName] = useState(profile.buddyName);
  const [persona, setPersona] = useState<BuddyPersona>(profile.persona);
  const [busy, setBusy] = useState(false);

  const save = useCallback(async () => {
    setBusy(true);
    try {
      onSaved(await getApi().updateBuddyProfile({ buddyName: name.trim() || profile.buddyName, persona }));
      onClose();
    } finally {
      setBusy(false);
    }
  }, [name, persona, profile.buddyName, onSaved, onClose]);

  const forget = async () => {
    if (!confirm(m.moon.forgetConfirm)) return;
    await getApi().buddyForget();
    onForget();
    onClose();
  };

  // three words instead of a number (story chat 2026-11-02): low / middle / high
  const slider = (key: keyof BuddyPersona, label: string, low: string, high: string) => {
    const steps: [number, string][] = [
      [15, low],
      [50, 'ふつう'],
      [85, high],
    ];
    const at = persona[key] < 34 ? 0 : persona[key] > 66 ? 2 : 1;
    return (
      <div className="block">
        <p className="mb-1.5 text-xs font-bold text-white/70">{label}</p>
        <div className="grid grid-cols-3 gap-1.5">
          {steps.map(([v, word], k) => (
            <button
              key={word}
              type="button"
              onClick={() => setPersona({ ...persona, [key]: v })}
              className={`min-h-11 rounded-xl px-2 text-[13px] font-bold ${k === at ? 'bg-sky-300 text-sky-950' : 'bg-white/10 text-white/70'}`}
            >
              {word}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="card max-h-[88svh] w-full max-w-xl overflow-y-auto rounded-b-none p-5 pb-[calc(76px+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-black">{m.moon.settings}</h3>
        <label className="mb-4 block text-xs text-white/70">
          <span className="font-bold">{m.moon.buddyName}</span>
          <input className="input mt-1" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {/* M-R215: a {bati} with a personality talks in it (never changes): only its 呼び方 / 一人称, and which one is in the chat */}
        {me?.bati?.personality ? (
          <BatiSettings me={me} onMe={setMe} />
        ) : (
          <div className="space-y-4">
            {slider('cheer', m.moon.cheer, m.moon.cheerLow, m.moon.cheerHigh)}
            {slider('polite', m.moon.polite, m.moon.politeLow, m.moon.politeHigh)}
            {slider('humor', m.moon.humor, m.moon.humorLow, m.moon.humorHigh)}
          </div>
        )}
        {/* M-R234: your own figure keeps its plain face in the talk */}
        <label className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2.5 text-[13px] font-bold text-white/80">
          表情を変えない
          <input
            type="checkbox"
            className="h-5 w-5 accent-sky-300"
            checked={me?.story?.[TALK_FIXED_FACE_KEY] === '1'}
            onChange={(e) => void getApi().saveSysStory({ [TALK_FIXED_FACE_KEY.replace(/^sys\./, '')]: e.target.checked ? '1' : '0' }).then(setMe).catch(() => undefined)}
          />
        </label>
        <div className="mt-5 flex gap-2">
          <button className="btn btn-ghost flex-1" onClick={onClose}>
            {m.common.cancel}
          </button>
          <button className="btn btn-primary flex-1" disabled={busy} onClick={() => void save()}>
            {m.common.save}
          </button>
        </div>
        <button className="mt-4 w-full text-xs text-rose-300/80 underline" onClick={() => void forget()}>
          {m.moon.forget}
        </button>
      </div>
    </div>
  );
}
