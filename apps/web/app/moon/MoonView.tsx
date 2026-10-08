'use client';

import type { BuddyMessageView, BuddyPersona, BuddyProfileView, BuddyQuotaView } from '@obolo/shared';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { DemoBanner } from '@/components/DemoBanner';
import { PlanetShell } from '@/components/PlanetShell';
import { PlanetSphere } from '@/components/PlanetSphere';
import { RequireAuth } from '@/components/RequireAuth';
import { ApiError, getApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n/client';

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
  // PLACEHOLDER (P-MOON-1): provisional Bati avatar (moon + face) until the character art exists.
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
  const api = getApi();
  const [profile, setProfile] = useState<BuddyProfileView | null>(null);
  const [messages, setMessages] = useState<BuddyMessageView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [quota, setQuota] = useState<BuddyQuotaView | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    void Promise.all([api.buddyProfile(), api.buddyMessages(), api.buddyQuota()]).then(([p, page, q]) => {
      setProfile(p);
      setMessages([...page.items].reverse());
      setCursor(page.nextCursor);
      setQuota(q);
    });
  }, [api]);

  useLayoutEffect(() => {
    if (stickToBottom.current) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, sending]);

  const loadOlder = async () => {
    if (!cursor) return;
    stickToBottom.current = false;
    const page = await api.buddyMessages(cursor);
    setMessages((cur) => [...[...page.items].reverse(), ...cur]);
    setCursor(page.nextCursor);
  };

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    stickToBottom.current = true;
    setSending(true);
    setNotice(null);
    const tempId = `tmp-${Date.now()}`;
    setMessages((cur) => [...cur, { id: tempId, role: 'user', text: body, createdAt: new Date().toISOString() }]);
    setText('');
    try {
      const r = await api.buddyChat(body, locale);
      setMessages((cur) => [...cur.filter((x) => x.id !== tempId), r.userMessage, r.reply]);
      setQuota(r.quota);
    } catch (err) {
      setMessages((cur) => cur.filter((x) => x.id !== tempId));
      setText(body);
      setNotice(err instanceof ApiError && err.code === 'BUDDY_QUOTA' ? m.moon.quotaReached : m.moon.unavailable);
    } finally {
      setSending(false);
    }
  };

  const name = profile?.buddyName ?? (locale === 'ja' ? 'バティ' : 'Bati');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Buddy header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <BatiFace size={44} />
        <div className="flex-1">
          <div className="font-black">{name}</div>
          <div className="text-[11px] text-white/50">{profile?.hasMemory ? `🧠 ${m.moon.memoryOn}` : m.moon.memoryOff}</div>
        </div>
        {quota && (
          <span className="chip bg-white/10 text-white/70">{t(m.moon.quota, { used: quota.usedToday, free: quota.freeDaily })}</span>
        )}
        <button className="btn btn-ghost h-9 w-9 !p-0" onClick={() => setSettingsOpen(true)} aria-label={m.moon.settings}>
          ⚙︎
        </button>
      </div>

      {/* Messages */}
      <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-4 pb-4" onScroll={(e) => {
        const el = e.currentTarget;
        stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}>
        {cursor && (
          <button className="mx-auto block text-xs text-white/50 underline" onClick={() => void loadOlder()}>
            {m.moon.olderMessages}
          </button>
        )}
        {profile && messages.length === 0 && <Bubble role="buddy" text={t(m.moon.greeting, { name })} />}
        {messages.map((msg) => (
          <Bubble key={msg.id} role={msg.role} text={msg.text} />
        ))}
        {sending && (
          <div className="flex items-end gap-2">
            <BatiFace size={28} />
            <div className="rounded-2xl rounded-bl-sm bg-white/10 px-4 py-2.5 text-sm text-white/60">
              <span className="animate-pulse">{t(m.moon.thinking, { name })}</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {notice && <p className="mx-4 mb-2 rounded-xl bg-amber-300/15 px-3 py-2 text-center text-xs text-amber-200">{notice}</p>}

      {/* Composer */}
      <form onSubmit={send} className="pb-safe flex items-end gap-2 border-t border-white/5 bg-[color:var(--color-space-950)]/80 px-3 py-3">
        <textarea
          className="input max-h-32 min-h-11 flex-1 resize-none !rounded-2xl"
          rows={1}
          maxLength={2000}
          placeholder={m.moon.placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button className="btn btn-primary h-11 !px-4" disabled={sending || !text.trim()}>
          {m.moon.send}
        </button>
      </form>

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

function Bubble({ role, text }: { role: 'user' | 'buddy'; text: string }) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-gradient-to-br from-sky-400/80 to-violet-500/80 px-4 py-2.5 text-[15px] text-white">
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-end gap-2">
      <BatiFace size={28} />
      <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-white/10 px-4 py-2.5 text-[15px] leading-relaxed">
        {text}
      </div>
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

  const slider = (key: keyof BuddyPersona, label: string, low: string, high: string) => (
    <label className="block">
      <div className="mb-1 flex justify-between text-xs text-white/70">
        <span className="font-bold">{label}</span>
        <span className="tabular-nums text-white/40">{persona[key]}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={persona[key]}
        onChange={(e) => setPersona({ ...persona, [key]: Number(e.target.value) })}
        className="w-full accent-sky-300"
      />
      <div className="flex justify-between text-[10px] text-white/40">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="card pb-safe w-full max-w-xl rounded-b-none p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-black">{m.moon.settings}</h3>
        <label className="mb-4 block text-xs text-white/70">
          <span className="font-bold">{m.moon.buddyName}</span>
          <input className="input mt-1" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="space-y-4">
          {slider('cheer', m.moon.cheer, m.moon.cheerLow, m.moon.cheerHigh)}
          {slider('polite', m.moon.polite, m.moon.politeLow, m.moon.politeHigh)}
          {slider('humor', m.moon.humor, m.moon.humorLow, m.moon.humorHigh)}
        </div>
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
