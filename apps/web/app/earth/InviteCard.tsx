'use client';

import type { MyInviteView } from '@obolo/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, getApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n/client';

/** Invite-only: members create invitation links. Email delivery is PLACEHOLDER (P-AUTH-2) — copy & send the link. */
export function InviteCard() {
  const { m } = useI18n();
  const [email, setEmail] = useState('');
  const [list, setList] = useState<MyInviteView[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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
      const inv = await getApi().createInvite(email.trim());
      setList((l) => [inv, ...l]);
      setEmail('');
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
      <h3 className="text-sm font-bold text-white/70">✉︎ {m.earth.invite}</h3>
      <p className="mt-1 text-[11px] text-white/45">{m.earth.inviteLead}</p>
      <form onSubmit={create} className="mt-3 flex gap-2">
        <input
          className="input flex-1"
          type="email"
          required
          placeholder={m.earth.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="btn btn-primary shrink-0 !px-4 text-sm" disabled={busy || !email}>
          {m.earth.inviteSend}
        </button>
      </form>
      {err && <p className="mt-2 text-sm text-rose-300">{err}</p>}
      {list.length > 0 && (
        <ul className="mt-3 divide-y divide-white/5">
          {list.map((i) => (
            <li key={i.code} className="flex items-center gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-white/80">{i.email}</span>
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
