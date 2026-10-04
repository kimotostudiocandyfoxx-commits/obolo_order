'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n/client';

const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

/**
 * The first screen for everyone (invite-only, client decision 2026-10-04):
 * email → 6-digit code (proves the address is yours) →
 *   invited person → Day 1 story (/invite/<code>) · member → continue where they are.
 * PLACEHOLDER (P-AUTH-2): until email delivery is wired the code is shown on screen (demo).
 */
export function EntryScreen() {
  const { m, t } = useI18n();
  const router = useRouter();
  const { signIn } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  useEffect(() => setDemo(getApi().mode === 'demo'), []);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await getApi().requestCode(email.trim());
      setDevCode(r.devCode ?? null);
      // Demo convenience: pre-fill the code so the walkthrough stays smooth.
      if (r.devCode && getApi().mode === 'demo') setCode(r.devCode);
      setStep('code');
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'NOT_INVITED' ? m.entry.notInvited : m.common.error);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await getApi().verify(email.trim(), code.trim());
      if (r.kind === 'invited') router.push(`/invite/${r.inviteCode}`);
      else signIn(r.token, r.user);
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'CODE_INVALID' ? m.entry.wrongCode : m.common.error);
      setBusy(false);
    }
  };

  return (
    <main className="pt-safe pb-safe flex min-h-svh flex-col items-center justify-center px-8 text-center" style={{ fontFamily: SERIF }}>
      <div className="relative mb-6 flex h-28 w-28 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-amber-200/30" />
        <span className="absolute inset-3 animate-[spin-slow_40s_linear_infinite] rounded-full border border-dashed border-amber-200/25" />
        <span className="h-3 w-3 rounded-full bg-amber-100 shadow-[0_0_40px_12px_rgba(255,214,140,0.55)]" />
      </div>
      <span className="text-xs tracking-[0.5em] text-amber-200/70">OBOLO ORDER</span>

      {step === 'email' ? (
        <form onSubmit={send} className="mt-8 flex w-full max-w-xs animate-[fadeUp_0.8s_ease-out] flex-col gap-4">
          <p className="text-lg tracking-wider text-amber-50">{m.entry.title}</p>
          <p className="-mt-2 text-xs leading-relaxed text-white/45">{m.entry.lead}</p>
          <input
            className="rounded-full border border-amber-200/50 bg-black/60 px-6 py-3.5 text-center tracking-wider text-amber-50 outline-none placeholder:text-white/30 focus:border-amber-100"
            style={{ fontSize: 16 }}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            placeholder="mail@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            className="rounded-full border border-amber-200/70 bg-black px-6 py-3.5 tracking-[0.2em] text-amber-50 shadow-[0_0_24px_rgba(255,210,130,0.25)] disabled:opacity-40"
            disabled={busy || !email}
          >
            {busy ? '……' : m.entry.next}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-8 flex w-full max-w-xs animate-[fadeUp_0.8s_ease-out] flex-col gap-4">
          <p className="text-sm text-white/70">{t(m.entry.codeSent, { email })}</p>
          {devCode && <p className="text-xs text-amber-200/80">{t(m.entry.demoCode, { code: devCode })}</p>}
          <input
            className="rounded-full border border-amber-200/50 bg-black/60 px-6 py-3.5 text-center font-mono text-2xl tracking-[0.5em] text-amber-50 outline-none focus:border-amber-100"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <button
            className="rounded-full border border-amber-200/70 bg-black px-6 py-3.5 tracking-[0.2em] text-amber-50 shadow-[0_0_24px_rgba(255,210,130,0.25)] disabled:opacity-40"
            disabled={busy || code.length !== 6}
          >
            {busy ? '……' : m.entry.enter}
          </button>
          <button type="button" className="text-xs text-white/40 underline" onClick={() => setStep('email')}>
            {m.entry.back}
          </button>
        </form>
      )}
      {err && <p className="mt-4 max-w-xs text-sm text-rose-300">{err}</p>}
      {demo && step === 'email' && <p className="mt-10 max-w-xs text-[11px] text-white/30">{m.entry.demoHint}</p>}
    </main>
  );
}
