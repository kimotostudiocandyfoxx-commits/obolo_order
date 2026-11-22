'use client';

import type { MyInviteView } from '@obolo/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { HoldMic } from '@/components/dachi/HoldMic';
import { ApiError, getApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n/client';

/** Invite-only: members create invitation links. Email delivery is PLACEHOLDER (P-AUTH-2) — copy & send the link. */
export function InviteCard() {
  const { m } = useI18n();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [list, setList] = useState<MyInviteView[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // a short voice note of your own (M-R212): it arrives in their {inviter} thread when you become dachi on Saturn
  const [voice, setVoice] = useState<{ mediaId: string; seconds: number } | null>(null);
  const [voiceOn, setVoiceOn] = useState(false);

  useEffect(() => {
    getApi()
      .myInvites()
      .then(setList)
      .catch(() => undefined);
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const inv = await getApi().createInvite(email.trim(), message, voice ?? undefined);
      setList((l) => [inv, ...l]);
      setEmail('');
      setMessage('');
      setVoice(null);
      setVoiceOn(false);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : m.common.error);
    } finally {
      setBusy(false);
    }
  };

  const link = (code: string) => `${window.location.origin}/invite/${code}`;
  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(link(code));
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      prompt('URL', link(code));
    }
  };

  return (
    <section className="card p-5">
      <h3 className="text-sm font-bold text-white/70">{m.earth.invite}</h3>
      <p className="mt-1 text-[11px] text-white/45">{m.earth.inviteLead}</p>
      <form onSubmit={create} className="mt-3 flex flex-wrap gap-2">
        <input
          className="input flex-1"
          type="email"
          required
          placeholder={m.earth.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {/* the inviter's own words, printed on the invitation (story M-R61) */}
        <input
          className="input order-last w-full text-sm"
          maxLength={60}
          placeholder="招待状に書くひとこと（なくてもいい）"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        {/* optional: hold to record a short voice note (≤ 60 s), listen back, keep it */}
        <div className="order-last w-full">
          {voice ? (
            <p className="flex items-center gap-2 text-xs text-white/60">
              🎤 声のメモ（{Math.max(1, Math.round(voice.seconds))}秒）をつけました
              <button type="button" className="rounded-full bg-white/10 px-2.5 py-1 text-[11px]" onClick={() => setVoice(null)}>
                けす
              </button>
            </p>
          ) : voiceOn ? (
            <div className="-mx-3">
              <HoldMic
                sendLabel="つける"
                hint="押している間だけ録音。届いた人が土星でダチになった時に聞けます"
                onSend={async (blob, seconds) => {
                  const up = await getApi().uploadVoice(blob);
                  setVoice({ mediaId: up.id, seconds: Math.max(0.1, Math.round(seconds * 10) / 10) });
                  setVoiceOn(false);
                }}
              />
            </div>
          ) : (
            <button type="button" className="text-xs text-white/50 underline-offset-2 hover:underline" onClick={() => setVoiceOn(true)}>
              🎤 声のメモもつける（なくてもいい）
            </button>
          )}
        </div>
        <button className="btn btn-primary shrink-0 !px-4 text-sm" disabled={busy || !email}>
          {m.earth.inviteSend}
        </button>
      </form>
      {err && <p className="mt-2 text-sm text-rose-300">{err}</p>}
      {list.length > 0 && (
        <ul className="mt-3 divide-y divide-white/5">
          {list.map((i) => (
            <li key={i.code} className="flex items-center gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1 break-all text-[13px] leading-snug text-white/80">
                {i.email}
                {i.voice && <span className="ml-1.5 text-[11px] text-white/45">🎤</span>}
              </span>
              <span className="chip bg-white/10 text-white/60">{m.earth.inviteStatus[i.status] ?? i.status}</span>
              {i.status === 'pending' && (
                <button className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold" onClick={() => void copy(i.code)}>
                  {copied === i.code ? m.earth.inviteCopied : m.earth.inviteCopy}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
