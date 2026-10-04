'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { DEMO_INVITE_CODE } from '@/lib/api/demo';

/**
 * Operator page to issue the first invitations (calls POST /admin/invites with ADMIN_TOKEN).
 * PLACEHOLDER: a proper admin console (spec §8) will replace this.
 */
export default function AdminInvitesPage() {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? '').trim().replace(/\/$/, '');
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [inviterName, setInviterName] = useState('KIMORIN');
  const [links, setLinks] = useState<{ email: string; url: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      setToken(sessionStorage.getItem('obolo.admin') ?? '');
    } catch {
      /* ignore */
    }
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      sessionStorage.setItem('obolo.admin', token);
      const res = await fetch(`${base}/admin/invites`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ email, inviterName }),
      });
      const json = (await res.json()) as { code?: string; error?: { code: string; message: string } };
      if (!res.ok || !json.code) throw new Error(json.error?.code === 'NOT_FOUND' ? '管理トークンが違います' : (json.error?.message ?? 'error'));
      setLinks((l) => [{ email, url: `${window.location.origin}/invite/${json.code}` }, ...l]);
      setEmail('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-10">
      <h1 className="text-xl font-black">招待状の発行（運営用）</h1>
      {!base ? (
        <div className="card space-y-3 p-5 text-sm text-white/80">
          <p>いまはデモモード（API未接続）です。デモ用の招待リンクがいつでも使えます：</p>
          <Link className="btn btn-primary w-full" href={`/invite/${DEMO_INVITE_CODE}`}>
            /invite/{DEMO_INVITE_CODE} を開く
          </Link>
          <p className="text-xs text-white/50">※ デモの招待は何度でも使えます。データはその端末の中だけに保存されます。</p>
        </div>
      ) : (
        <form onSubmit={submit} className="card space-y-3 p-5">
          <label className="block text-xs text-white/60">
            管理トークン（ADMIN_TOKEN）
            <input className="input mt-1" type="password" required value={token} onChange={(e) => setToken(e.target.value)} />
          </label>
          <label className="block text-xs text-white/60">
            招待する人のメールアドレス
            <input className="input mt-1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block text-xs text-white/60">
            招待者名（物語の中で表示）
            <input className="input mt-1" required maxLength={40} value={inviterName} onChange={(e) => setInviterName(e.target.value)} />
          </label>
          <button className="btn btn-primary w-full" disabled={busy}>
            招待リンクをつくる
          </button>
          {err && <p className="text-sm text-rose-300">{err}</p>}
        </form>
      )}
      {links.map((l) => (
        <div key={l.url} className="card space-y-2 p-4 text-sm">
          <div className="text-white/60">{l.email}</div>
          <div className="break-all font-mono text-xs">{l.url}</div>
          <button className="btn btn-ghost w-full text-xs" onClick={() => void navigator.clipboard.writeText(l.url)}>
            リンクをコピー
          </button>
        </div>
      ))}
    </main>
  );
}
