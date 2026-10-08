'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

/**
 * The team's report review (calls /admin/reports with ADMIN_TOKEN, like /admin/invites).
 * Reports from members about mail, calls and people; for mail, the reported conversation.
 * Mark them handled; suspend (or reinstate) an account — a suspended person cannot log in or use
 * the app, and nobody can reach them. PLACEHOLDER: part of the admin console (spec §8).
 */
type Person = { id: string; handle: string; displayName: string | null; email: string; suspendedAt: string | null };
type Report = {
  id: string;
  kind: 'mail' | 'call' | 'person';
  reason: 'mean' | 'scary' | 'other';
  note: string;
  status: 'open' | 'reviewed';
  createdAt: string;
  reporter: Person | null;
  target: Person | null;
  targetReports: number;
  conversation: { id: string; fromTarget: boolean; text: string; createdAt: string }[];
};

const KIND = { mail: '✉️ メール', call: '📞 電話', person: '👤 人' } as const;
const REASON = { mean: 'いやなことを言われた', scary: 'こわい・あやしい', other: 'その他' } as const;
const when = (iso: string) => new Date(iso).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const nameOf = (p: Person | null) => (p ? `${p.displayName || p.handle}（@${p.handle}）` : '（不明）');

export default function AdminReportsPage() {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? '').trim().replace(/\/$/, '');
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<'open' | 'reviewed'>('open');
  const [list, setList] = useState<Report[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    try {
      setToken(sessionStorage.getItem('obolo.admin') ?? '');
    } catch {
      /* ignore */
    }
  }, []);

  const call = useCallback(
    async <T,>(path: string, body?: unknown): Promise<T> => {
      const res = await fetch(`${base}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { 'x-admin-token': token, ...(body ? { 'content-type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 404) throw new Error('管理トークンが違います');
      if (!res.ok) throw new Error(`エラー（${res.status}）`);
      return (await res.json()) as T;
    },
    [base, token],
  );

  const load = useCallback(async () => {
    setErr(null);
    try {
      setList(await call<Report[]>(`/admin/reports?status=${tab}`));
      setReady(true);
      sessionStorage.setItem('obolo.admin', token);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setReady(false);
    }
  }, [call, tab, token]);

  useEffect(() => {
    if (ready) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const act = async (key: string, path: string, body: unknown) => {
    setBusy(key);
    try {
      await call(path, body);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  if (!base)
    return (
      <main className="mx-auto max-w-md px-4 py-10 text-sm text-white/70">
        <h1 className="mb-3 text-xl font-black">通報の確認（運営用）</h1>
        <p>いまはデモモード（API未接続）なので、通報はありません。</p>
      </main>
    );

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black">🚩 通報の確認（運営用）</h1>
        <Link href="/admin/invites" className="text-xs text-white/50 underline">
          招待状の発行へ
        </Link>
      </div>

      {!ready && (
        <form
          className="card space-y-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <label className="block text-sm text-white/70">管理トークン（ADMIN_TOKEN）</label>
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} className="input w-full" autoComplete="off" />
          <button className="btn btn-primary w-full" disabled={!token}>
            ひらく
          </button>
        </form>
      )}
      {err && <p className="text-center text-sm text-rose-300">{err}</p>}

      {ready && (
        <>
          <div className="flex gap-2">
            {(
              [
                ['open', '未対応'],
                ['reviewed', '対応済み'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm ${tab === k ? 'bg-white text-black font-bold' : 'bg-white/10'}`}>
                {label}
              </button>
            ))}
            <button onClick={() => void load()} className="ml-auto rounded-full bg-white/10 px-4 py-1.5 text-sm">
              ↻ 更新
            </button>
          </div>
          {list?.length === 0 && <p className="py-10 text-center text-sm text-white/50">{tab === 'open' ? '未対応の通報はありません 🎉' : '対応済みの通報はありません'}</p>}
          {list?.map((r) => (
            <section key={r.id} className="card space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-white/10 px-2 py-0.5">{KIND[r.kind]}</span>
                <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-rose-200">{REASON[r.reason]}</span>
                <span className="text-white/45">{when(r.createdAt)}</span>
              </div>
              <div className="text-sm leading-relaxed">
                <p>
                  <span className="text-white/50">通報した人：</span>
                  {nameOf(r.reporter)}
                </p>
                <p>
                  <span className="text-white/50">通報された人：</span>
                  <b>{nameOf(r.target)}</b>
                  <span className="ml-2 text-xs text-amber-200">この人への通報 {r.targetReports}件</span>
                  {r.target?.suspendedAt && <span className="ml-2 rounded bg-rose-600 px-1.5 text-xs">停止中</span>}
                </p>
                {r.note && <p className="mt-1 rounded-lg bg-black/30 p-2 text-xs text-white/70">メモ：{r.note}</p>}
              </div>
              {r.kind === 'mail' && (
                <details className="rounded-xl bg-black/25 p-3">
                  <summary className="cursor-pointer text-xs text-white/60">2人のメール（最新30件）</summary>
                  <div className="mt-2 max-h-72 space-y-1.5 overflow-y-auto">
                    {r.conversation.length === 0 && <p className="text-xs text-white/40">メールはありません</p>}
                    {r.conversation.map((m) => (
                      <p key={m.id} className={`w-fit max-w-[85%] rounded-xl px-2.5 py-1.5 text-xs ${m.fromTarget ? 'bg-rose-500/25' : 'ml-auto bg-sky-500/25'}`}>
                        <span className="mr-1 text-[10px] text-white/45">{m.fromTarget ? '通報された人' : '通報した人'} {when(m.createdAt)}</span>
                        <br />
                        {m.text}
                      </p>
                    ))}
                  </div>
                </details>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={busy === r.id}
                  onClick={() => void act(r.id, `/admin/reports/${r.id}`, { status: r.status === 'open' ? 'reviewed' : 'open' })}
                  className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold disabled:opacity-50"
                >
                  {r.status === 'open' ? '✓ 対応済みにする' : '未対応にもどす'}
                </button>
                {r.target && (
                  <button
                    disabled={busy === r.target.id}
                    onClick={() => {
                      const on = !r.target!.suspendedAt;
                      if (on && !confirm(`${nameOf(r.target)} のアカウントを停止しますか？\nログインもアプリの利用もできなくなります。`)) return;
                      void act(r.target!.id, `/admin/users/${r.target!.id}/suspend`, { on });
                    }}
                    className={`rounded-full px-4 py-2 text-sm font-bold disabled:opacity-50 ${r.target.suspendedAt ? 'border border-white/30' : 'bg-rose-600'}`}
                  >
                    {r.target.suspendedAt ? '停止を解除する' : '⛔ アカウントを停止する'}
                  </button>
                )}
              </div>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
