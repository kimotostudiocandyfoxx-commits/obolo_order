'use client';

import type { BuddyMessageView, BuddyPersona, BuddyProfileView, BuddyQuotaView } from '@obolo/shared';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { DemoBanner } from '@/components/DemoBanner';
import { PlanetShell } from '@/components/PlanetShell';
import { PlanetSphere } from '@/components/PlanetSphere';
import { RequireAuth } from '@/components/RequireAuth';
import { ApiError, getApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n/client';
import { useAuth } from '@/lib/auth';

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
  const { me } = useAuth();
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

  // the member's own {bati} (named on the Moon) wins over the buddy profile's default name
  const name = me?.bati?.name || profile?.buddyName || (locale === 'ja' ? 'バティ' : 'Bati');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Buddy header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <BatiFace size={44} />
        <div className="flex-1">
          <div className="font-black">{name}</div>
          <div className="text-[11px] text-white/50">{profile?.hasMemory ? `🧠 ${m.moon.memoryOn}` : m.moon.memoryOff}</div>
        </div>
        {/* the day's count only when few are left (story chat 2026-11-02: no numbers on screen otherwise) */}
        {quota && quota.freeDaily - quota.usedToday <= 5 && (
          <span className="chip bg-white/10 text-white/70">🌙 今日は、あと少し話せるよ</span>
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
              {/* a small magic circle turning while {bati} looks it up (no "thinking…" words) */}
              <span className="relative block h-7 w-7" aria-label={t(m.moon.thinking, { name })}>
                <span className="absolute inset-0 animate-[spin_3s_linear_infinite] rounded-full border-2 border-dashed border-amber-200/70" />
                <span className="absolute inset-[5px] animate-[spin_2s_linear_infinite_reverse] rounded-full border border-sky-200/70" />
                <span className="absolute inset-[11px] animate-pulse rounded-full bg-amber-100/80" />
              </span>
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
