'use client';

import { BIRTH_YEAR_KEY } from '@/components/onboarding/SealGate';
import { BIRTH_YEAR_REQUIRED_WORDS, type InviteView } from '@obolo/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { agreedNow, agreeLocally, ConsentPanel, localBirthYear, localConsent, sendLocalConsent } from '@/components/ConsentGate';
import { StoryPlayer } from '@/components/onboarding/StoryPlayer';
import { TomorrowScreen } from '@/components/onboarding/TomorrowScreen';
import { ApiError, getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n/client';
import { DAY1 } from '@/lib/onboarding/day1';
import { STORIES } from '@/lib/onboarding/stories';
import { clearDay1, loadDay1, saveDay1, type SavedDay1 } from '@/lib/onboarding/progress';

/** /invite/<code> — the invitation link from the email. "resume" continues a story already begun. */
export function InviteStory({ code }: { code: string }) {
  const { m } = useI18n();
  const router = useRouter();
  const { status, me, signIn, setMe, signOut } = useAuth();
  const [invite, setInvite] = useState<InviteView | null>(null);
  const [error, setError] = useState<'invalid' | 'used' | 'expired' | 'member' | null>(null);
  const [saved, setSaved] = useState<SavedDay1 | null | undefined>(undefined);
  const [finished, setFinished] = useState(false);
  // M-R247: the start-of-app agreement (terms, privacy, photos and voice) before day 1 begins
  const [agreed, setAgreed] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    if (status === 'loading') return;
    // client 2026-11-27: and never without the birth year (the account's, or the one chosen on this device) — a device
    // that agreed with 〔答えない・分からない〕 before is asked again
    setAgreed((agreedNow(me) || !!localConsent()) && (!!me?.birthYear || !!localBirthYear()));
    // agreed on this device before but not on the account yet (a reload in between): sent now
    if (me && !agreedNow(me) && localConsent()) void sendLocalConsent().then((u) => u && setMe(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, me?.consent?.version, me?.birthYear]);

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
      setInvite({ code, inviterName: me?.invitedByName ?? '', inviterMessage: me?.invitedByMessage ?? null, status: 'accepted', expiresAt: '' });
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
        // client 2026-11-27: the account is made with the birth year (the server makes none without it)
        const r = await api.acceptInvite(code, name, localBirthYear());
        signIn(r.token, r.user);
        // the agreement given at the start, now that the account exists — with the year asked there (M-R252: kept once
        // as the birth year, so the start screen's year is the one the age rules follow)
        const agreed = await sendLocalConsent();
        if (agreed) setMe(agreed);
        // the year chosen at the seal (M-R150), now that the account exists — when the start screen had none
        try {
          const y = Number(localStorage.getItem(BIRTH_YEAR_KEY));
          if (y && !(agreed ?? r.user).birthYear) setMe(await api.updateMe({ birthYear: y }));
        } catch {
          /* asked again later */
        }
      } catch (e) {
        if (e instanceof ApiError && (e.code === 'INVITE_USED' || e.code === 'ALREADY_MEMBER')) throw new Error(m.gate.used);
        // no year on this device after all (its storage was cleared meanwhile): the start screen asks it again
        if (e instanceof ApiError && e.code === 'BIRTH_YEAR_REQUIRED') {
          setAgreed(false);
          throw new Error(BIRTH_YEAR_REQUIRED_WORDS);
        }
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
        canSkip
        name={me.displayName}
        completedAt={me.journeyCompletedAt}
        skipLabel={STORIES[1].skipLabel}
        skippedText={STORIES[1].skippedText}
        untilText={STORIES[1].untilText}
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
        {error === 'member' && me && (
          // this device is logged in as someone else: the invited person logs out here first
          <div className="max-w-sm rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/75">
            <p>
              この端末は <b className="text-white">{me.displayName || me.handle}</b>（{me.email}）でログインしています。
            </p>
            <p className="mt-2">招待された人として始めるときは、ログアウトしてから招待を受け取ってください。</p>
            <button
              onClick={() => {
                setError(null);
                void signOut();
              }}
              className="btn mt-3 w-full bg-amber-500 text-black"
            >
              ログアウトして招待を受け取る
            </button>
          </div>
        )}
        <Link href={error === 'member' ? '/' : '/earth'} className="btn btn-primary">
          {error === 'member' ? m.gate.toHome : m.gate.member}
        </Link>
      </div>
    );
  }

  if (!invite || saved === undefined || agreed === undefined) return <div className="fixed inset-0 bg-black" />;
  if (!agreed)
    return (
      <ConsentPanel
        knownYear={me?.birthYear ?? null}
        onAgree={(c) => {
          agreeLocally(c);
          setAgreed(true);
          if (status === 'authed') void sendLocalConsent().then((u) => u && setMe(u));
        }}
      />
    );

  return (
    <StoryPlayer
      steps={DAY1}
      vars={{ name: me?.displayName ?? '', birthYear: me?.birthYear ?? null, inviter: invite.inviterName, inviterMessage: invite.inviterMessage ?? undefined }}
      initial={saved}
      onProgress={onProgress}
      onName={onName}
      onEnd={onEnd}
    />
  );
}
