'use client';

import { HANDLE_RE, type Me, type WalletView } from '@obolo/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { DemoBanner } from '@/components/DemoBanner';
import { Avatar } from '@/components/Avatar';
import { PlanetShell } from '@/components/PlanetShell';
import { ApiError, getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { InviteCard } from './InviteCard';
import { useI18n } from '@/lib/i18n/client';

export function EarthView() {
  const { status } = useAuth();
  const { m } = useI18n();
  return (
    <PlanetShell id="earth">
      <DemoBanner />
      {status === 'loading' && <p className="py-16 text-center text-white/60">{m.common.loading}</p>}
      {status === 'guest' && <LoginCard />}
      {status === 'authed' && <Home />}
    </PlanetShell>
  );
}

function LoginCard() {
  const { m, t } = useI18n();
  const { signIn } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await getApi().requestCode(email.trim());
      setDevCode(r.devCode ?? null);
      setStep('code');
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'NOT_INVITED' ? m.earth.notInvited : e instanceof ApiError ? e.message : m.common.error);
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
      signIn(r.token, r.user);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : m.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card mt-6 p-6">
      <h2 className="text-xl font-black">{m.earth.loginTitle}</h2>
      <p className="mt-1 text-sm text-white/60">{m.earth.loginLead}</p>
      {step === 'email' ? (
        <form onSubmit={send} className="mt-5 space-y-3">
          <input
            className="input"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder={m.earth.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn btn-primary w-full" disabled={busy || !email}>
            {m.earth.sendCode}
          </button>
          <p className="text-center text-[11px] text-white/40">🔑 {m.earth.passkeySoon}</p>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-5 space-y-3">
          <p className="text-sm text-white/70">{t(m.earth.codeSent, { email })}</p>
          {devCode && (
            <p className="rounded-xl bg-amber-300/15 px-3 py-2 text-center font-mono text-amber-200">
              {t(m.earth.demoCode, { code: devCode })}
            </p>
          )}
          <input
            className="input text-center font-mono text-2xl tracking-[0.5em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <button className="btn btn-primary w-full" disabled={busy || code.length !== 6}>
            {m.earth.verify}
          </button>
          <button type="button" className="w-full text-xs text-white/50 underline" onClick={() => setStep('email')}>
            {m.earth.changeEmail}
          </button>
        </form>
      )}
      {err && <p className="mt-3 text-center text-sm text-rose-300">{err}</p>}
    </section>
  );
}

function Home() {
  const { me, signOut } = useAuth();
  const { m } = useI18n();
  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [walletErr, setWalletErr] = useState(false);

  useEffect(() => {
    getApi()
      .wallet()
      .then(setWallet)
      .catch(() => setWalletErr(true));
  }, []);

  if (!me) return null;
  return (
    <div className="space-y-4">
      <ProfileCard me={me} />
      <WalletCard wallet={wallet} failed={walletErr} />
      <section className="card p-5">
        <h3 className="text-sm font-bold text-white/70">🏦 {m.earth.bank}</h3>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-sm text-white/60">{m.earth.earnings}</span>
          <span className="text-2xl font-black">¥{(wallet?.earningsBalanceJpy ?? 0).toLocaleString()}</span>
        </div>
        <p className="mt-2 text-[11px] text-white/45">{m.earth.bankHint}</p>
      </section>
      <InviteCard />
      <div className="grid grid-cols-2 gap-3">
        <FeatureTile icon="🎙️" title={m.earth.voice} hint={m.earth.voiceHint} />
        <FeatureTile icon="✉️" title={m.earth.messages} hint={m.earth.messagesHint} />
      </div>
      <button className="btn btn-ghost w-full" onClick={() => void signOut()}>
        {m.earth.logout}
      </button>
    </div>
  );
}

function FeatureTile({ icon, title, hint }: { icon: string; title: string; hint: string }) {
  const { m } = useI18n();
  return (
    <div className="card p-4 opacity-80">
      <div className="text-2xl">{icon}</div>
      <div className="mt-1 text-sm font-bold">{title}</div>
      <p className="mt-1 text-[11px] leading-snug text-white/50">{hint}</p>
      <span className="chip mt-2 bg-white/10 text-white/60">{m.common.comingSoon}</span>
    </div>
  );
}

function ProfileCard({ me }: { me: Me }) {
  const { m } = useI18n();
  const { setMe } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ displayName: me.displayName, handle: me.handle, bio: me.bio });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      setMe(await getApi().updateMe(form));
      setEditing(false);
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'HANDLE_TAKEN' ? m.earth.handleTaken : m.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-5">
      <div className="flex items-center gap-4">
        <Avatar name={me.displayName} size={64} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-black">{me.displayName}</div>
          <div className="truncate text-sm text-white/55">@{me.handle}</div>
          <span className="chip mt-1 bg-emerald-300/15 text-emerald-200">
            {me.subscriptionStatus === 'active' ? m.earth.subActive : m.earth.subDemo}
          </span>
        </div>
        {!editing && (
          <button className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setEditing(true)}>
            {m.common.edit}
          </button>
        )}
      </div>
      {!editing && me.bio && <p className="mt-3 whitespace-pre-wrap text-sm text-white/80">{me.bio}</p>}
      {editing && (
        <form onSubmit={save} className="mt-4 space-y-3">
          <label className="block text-xs text-white/60">
            {m.earth.displayName}
            <input
              className="input mt-1"
              maxLength={40}
              required
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            />
          </label>
          <label className="block text-xs text-white/60">
            {m.earth.handle} <span className="text-white/35">({m.earth.handleHint})</span>
            <input
              className="input mt-1"
              autoCapitalize="none"
              required
              value={form.handle}
              onChange={(e) => setForm({ ...form, handle: e.target.value.toLowerCase() })}
            />
          </label>
          <label className="block text-xs text-white/60">
            {m.earth.bio}
            <textarea
              className="input mt-1 min-h-20"
              maxLength={160}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </label>
          {err && <p className="text-sm text-rose-300">{err}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost flex-1" onClick={() => setEditing(false)}>
              {m.common.cancel}
            </button>
            <button className="btn btn-primary flex-1" disabled={busy || !HANDLE_RE.test(form.handle) || !form.displayName.trim()}>
              {m.common.save}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function WalletCard({ wallet, failed }: { wallet: WalletView | null; failed: boolean }) {
  const { m, t, locale } = useI18n();
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US');
  return (
    <section className="card overflow-hidden">
      <div className="bg-gradient-to-br from-violet-500/30 via-indigo-500/20 to-sky-400/20 p-5">
        <div className="text-sm font-bold text-white/70">✦ {m.earth.wallet}</div>
        <div className="mt-2 flex items-end gap-2">
          <span className="text-5xl font-black tabular-nums text-[color:var(--color-mana)]">
            {wallet ? wallet.manaBalance.toLocaleString() : failed ? '—' : '…'}
          </span>
          <span className="mb-1.5 font-bold text-white/70">MANA</span>
        </div>
        <p className="mt-1 text-[11px] text-white/55">{m.earth.monthlyGrant}</p>
        {wallet?.manaExpiresAt && (
          <p className="text-[11px] text-white/45">{t(m.earth.manaExpires, { date: fmtDate(wallet.manaExpiresAt) })}</p>
        )}
        <button className="btn btn-ghost mt-3 w-full !py-2 text-xs" disabled>
          {m.earth.manaNoBilling}
        </button>
      </div>
      <div className="p-5">
        <h4 className="text-xs font-bold text-white/60">{m.earth.recent}</h4>
        {wallet && wallet.recent.length === 0 && <p className="mt-2 text-sm text-white/40">{m.earth.noHistory}</p>}
        <ul className="mt-2 divide-y divide-white/5">
          {wallet?.recent.map((e) => (
            <li key={e.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-white/80">{m.earth.reasons[e.reason] ?? e.reason}</span>
              <span className="flex items-center gap-3">
                <span className="text-[11px] text-white/40">{fmtDate(e.createdAt)}</span>
                <span className={`font-bold tabular-nums ${e.delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {e.delta >= 0 ? '+' : ''}
                  {e.delta.toLocaleString()} {e.ledger === 'mana' ? 'MANA' : '¥'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
