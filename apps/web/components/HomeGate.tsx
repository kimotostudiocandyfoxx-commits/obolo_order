'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n/client';
import { DEMO_INVITE_CODE } from '@/lib/api/demo';
import { TomorrowScreen } from '@/components/onboarding/TomorrowScreen';
import { isDay2Unlocked, loadDay1, markDay2Unlocked } from '@/lib/onboarding/progress';

const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

/**
 * Invite-only gate in front of the solar system (client decision 2026-10-04):
 *  guest → "invitation only" · story in progress → resume · Day 1 done today → "come back tomorrow".
 * Day 2 (KIMORIN, payment, profile image, Bati creation) is not built yet: on the next day the
 * member reaches the solar system after the wait or the skip (PLACEHOLDER P-OB-1).
 */
export function HomeGate({ children }: { children: ReactNode }) {
  const { status, me } = useAuth();
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  useEffect(() => {
    if (me) setUnlocked(isDay2Unlocked(me.id, me.day1CompletedAt));
  }, [me]);

  if (status === 'loading') return <div className="min-h-svh" />;
  if (status === 'guest') return <InviteOnly />;
  if (me?.onboardingStage === 'day1') return <ResumeStory />;
  if (me?.onboardingStage === 'day1_done') {
    if (unlocked === null) return <div className="fixed inset-0 bg-black" />;
    if (!unlocked) {
      return (
        <TomorrowScreen
          name={me.displayName}
          completedAt={me.day1CompletedAt}
          onUnlocked={() => {
            markDay2Unlocked(me.id);
            setUnlocked(true);
          }}
        />
      );
    }
  }
  return <>{children}</>;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="pt-safe pb-safe flex min-h-svh flex-col items-center justify-center gap-5 px-8 text-center" style={{ fontFamily: SERIF }}>
      <div className="relative mb-2 flex h-28 w-28 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-amber-200/30" />
        <span className="absolute inset-3 rounded-full border border-dashed border-amber-200/20" />
        <span className="h-3 w-3 rounded-full bg-amber-100 shadow-[0_0_40px_12px_rgba(255,214,140,0.55)]" />
      </div>
      <span className="text-xs tracking-[0.5em] text-amber-200/70">OBOLO ORDER</span>
      {children}
    </main>
  );
}

function InviteOnly() {
  const { m } = useI18n();
  const [demo, setDemo] = useState(false);
  useEffect(() => setDemo(getApi().mode === 'demo'), []);
  return (
    <Shell>
      <p className="text-lg tracking-wider text-amber-50 [word-break:keep-all]">{m.gate.inviteOnly}</p>
      <p className="max-w-xs text-sm leading-relaxed text-white/55">{m.gate.inviteOnlyLead}</p>
      {demo && (
        <Link href={`/invite/${DEMO_INVITE_CODE}`} className="mt-4 rounded-full border border-amber-200/60 px-7 py-3 tracking-widest text-amber-100">
          ✉︎ {m.gate.demoInvite}
        </Link>
      )}
      <Link href="/earth" className="mt-2 text-xs text-white/45 underline">
        {m.gate.member}
      </Link>
    </Shell>
  );
}

function ResumeStory() {
  const { m } = useI18n();
  const [code, setCode] = useState('resume');
  useEffect(() => setCode(loadDay1()?.code ?? 'resume'), []);
  return (
    <Shell>
      <p className="text-xl tracking-wider text-amber-50">{m.gate.resumeTitle}</p>
      <Link href={`/invite/${code}`} className="mt-2 rounded-full border border-amber-200/60 px-8 py-3 tracking-widest text-amber-100">
        {m.gate.resume}
      </Link>
    </Shell>
  );
}
