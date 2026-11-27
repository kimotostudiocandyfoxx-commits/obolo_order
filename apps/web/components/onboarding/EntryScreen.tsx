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
    // client 2026-11-27: the golden eclipse (the client's own picture) behind the entry; the words sit under the ring in its gold
    <main className="pt-safe pb-safe relative flex min-h-svh flex-col items-center overflow-hidden bg-black px-8 text-center" style={{ fontFamily: SERIF }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/onboarding/entry-eclipse.webp" alt="" aria-hidden draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-[50%_0%]" data-testid="entry-backdrop" />
      {/* the lower half goes darker, so the form reads */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0)_38%,rgba(0,0,0,.55)_58%,rgba(0,0,0,.78)_100%)]" />
      {/* the ring's own place: the words begin under it */}
      <div aria-hidden className="h-[45svh] min-h-[220px] w-full shrink-0" />
      <span className="relative text-xs tracking-[0.55em] text-[#f0cf8a] [text-shadow:0_0_14px_rgba(255,200,110,.45)]">OBOLO ORDER</span>

      {step === 'email' ? (
        <form onSubmit={send} className="relative mt-7 flex w-full max-w-xs animate-[fadeUp_0.8s_ease-out] flex-col gap-4">
          <p className="text-lg tracking-wider text-[#fff3d6] [text-shadow:0_1px_10px_rgba(0,0,0,.8)]">{m.entry.title}</p>
          <p className="-mt-2 text-xs leading-relaxed text-[#e9d3a3]/70">{m.entry.lead}</p>
          <input
            className="rounded-full border border-[#e2b866]/60 bg-black/70 px-6 py-3.5 text-center tracking-wider text-[#fff3d6] outline-none backdrop-blur-sm placeholder:text-[#e9d3a3]/35 focus:border-[#ffd98a] focus:shadow-[0_0_18px_rgba(255,200,110,.3)]"
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
            className="rounded-full border border-[#ffd98a]/80 bg-[linear-gradient(180deg,#2a1e08,#0c0802)] px-6 py-3.5 tracking-[0.2em] text-[#ffe9b8] shadow-[0_0_26px_rgba(255,200,110,0.32)] disabled:opacity-40"
            disabled={busy || !email}
          >
            {busy ? '……' : m.entry.next}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="relative mt-7 flex w-full max-w-xs animate-[fadeUp_0.8s_ease-out] flex-col gap-4">
          <p className="text-sm text-[#fff3d6]/85 [text-shadow:0_1px_8px_rgba(0,0,0,.8)]">{t(m.entry.codeSent, { email })}</p>
          {devCode && <p className="text-xs text-amber-200/80">{t(m.entry.demoCode, { code: devCode })}</p>}
          <input
            className="rounded-full border border-[#e2b866]/60 bg-black/70 px-6 py-3.5 text-center font-mono text-2xl tracking-[0.5em] text-[#fff3d6] outline-none backdrop-blur-sm focus:border-[#ffd98a] focus:shadow-[0_0_18px_rgba(255,200,110,.3)]"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <button
            className="rounded-full border border-[#ffd98a]/80 bg-[linear-gradient(180deg,#2a1e08,#0c0802)] px-6 py-3.5 tracking-[0.2em] text-[#ffe9b8] shadow-[0_0_26px_rgba(255,200,110,0.32)] disabled:opacity-40"
            disabled={busy || code.length !== 6}
          >
            {busy ? '……' : m.entry.enter}
          </button>
          <button type="button" className="text-xs text-[#e9d3a3]/60 underline" onClick={() => setStep('email')}>
            {m.entry.back}
          </button>
        </form>
      )}
      {err && <p className="relative mt-4 max-w-xs text-sm text-[#ffb09a] [text-shadow:0_1px_8px_rgba(0,0,0,.9)]">{err}</p>}
      {demo && step === 'email' && <p className="relative mt-8 max-w-xs text-[11px] text-[#e9d3a3]/45">{m.entry.demoHint}</p>}
    </main>
  );
}
