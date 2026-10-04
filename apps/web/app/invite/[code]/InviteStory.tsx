'use client';

import type { InviteView } from '@obolo/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { StoryPlayer } from '@/components/onboarding/StoryPlayer';
import { TomorrowScreen } from '@/components/onboarding/TomorrowScreen';
import { ApiError, getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n/client';
import { DAY1 } from '@/lib/onboarding/day1';
import { clearDay1, loadDay1, saveDay1, type SavedDay1 } from '@/lib/onboarding/progress';

/** /invite/<code> — the invitation link from the email. "resume" continues a story already begun. */
export function InviteStory({ code }: { code: string }) {
  const { m } = useI18n();
  const router = useRouter();
  const { status, me, signIn, setMe } = useAuth();
  const [invite, setInvite] = useState<InviteView | null>(null);
  const [error, setError] = useState<'invalid' | 'used' | 'expired' | 'member' | null>(null);
  const [saved, setSaved] = useState<SavedDay1 | null | undefined>(undefined);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    const playingDay1 = !!me && me.journeyDay === 1 && !me.journeyCompletedAt;
    if (status === 'authed' && me && !playingDay1 && !finished) {
      setError('member');
      return;
    }
    const s = loadDay1();
    const resuming = status === 'authed' && playingDay1;
    setSaved(s && (s.code === code || code === 'resume') ? s : null);
    if (resuming) {
      setInvite({ code, inviterName: me?.invitedByName ?? '', status: 'accepted', expiresAt: '' });
      return;
    }
    if (code === 'resume') {
      setError('invalid');
      return;
    }
    getApi()
      .getInvite(code)
      .then((inv) => {
        if (inv.status === 'accepted') setError('used');
        else if (inv.status !== 'pending') setError('expired');
        else setInvite(inv);
      })
      .catch(() => setError('invalid'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, code]);

  const onProgress = useCallback(
    (p: { i: number; name: string; answers: Record<string, string> }) => saveDay1({ ...p, code: saved?.code ?? code }),
    [code, saved],
  );

  const onName = useCallback(
    async (name: string) => {
      const api = getApi();
      try {
        if (status === 'authed') {
          setMe(await api.updateMe({ displayName: name }));
          return;
        }
        const r = await api.acceptInvite(code, name);
        signIn(r.token, r.user);
      } catch (e) {
        if (e instanceof ApiError && (e.code === 'INVITE_USED' || e.code === 'ALREADY_MEMBER')) throw new Error(m.gate.used);
        throw new Error(m.gate.nameError);
      }
    },
    [status, code, signIn, setMe, m],
  );

  const onEnd = useCallback(
    async (answers: Record<string, string>) => {
      try {
        setMe(await getApi().completeJourneyDay(1, answers));
      } catch {
        /* the finale still shows; progress is retried from the home gate */
      }
      clearDay1();
      setTimeout(() => setFinished(true), 1500);
    },
    [setMe],
  );

  if (finished && me) {
    return (
      <TomorrowScreen
        name={me.displayName}
        completedAt={me.journeyCompletedAt}
        onUnlocked={async (skipped) => {
          try {
            setMe(await getApi().advanceJourney(skipped));
          } finally {
            router.push('/');
          }
        }}
      />
    );
  }

  if (error) {
    const title =
      error === 'used' ? m.gate.used : error === 'expired' ? m.gate.expired : error === 'member' ? m.gate.alreadyMember : m.gate.invalid;
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-lg font-bold">{title}</p>
        {error === 'used' && <p className="text-sm text-white/60">{m.gate.usedLead}</p>}
        <Link href={error === 'member' ? '/' : '/earth'} className="btn btn-primary">
          {error === 'member' ? m.gate.toHome : m.gate.member}
        </Link>
      </div>
    );
  }

  if (!invite || saved === undefined) return <div className="fixed inset-0 bg-black" />;

  return (
    <StoryPlayer
      steps={DAY1}
      vars={{ name: me?.displayName ?? '', inviter: invite.inviterName }}
      initial={saved}
      onProgress={onProgress}
      onName={onName}
      onEnd={onEnd}
    />
  );
}
