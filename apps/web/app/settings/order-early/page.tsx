'use client';

import { batiLineVoiceOf } from '@/lib/onboarding/batiLine';
import { useRouter } from 'next/navigation';
import { RequireAuth } from '@/components/RequireAuth';
import { StoryPlayer } from '@/components/onboarding/StoryPlayer';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { canJoinEarly, joinFlags } from '@/lib/onboarding/joinFlags';
import { useEffect, useState } from 'react';
import { SYS002_ALONE } from '@/lib/onboarding/sys002';

/**
 * 〔設定〕→〔毎月のマナ〕→〔先にObolo Orderになる〕: SYS-S002 always plays first (M-R202 — no way to pay that skips the
 * explanation), then the payment screen inside it. Its flags are saved as sys.* for day 8.
 */
export default function OrderEarlyPage() {
  return (
    <RequireAuth>
      <OrderEarly />
    </RequireAuth>
  );
}

function OrderEarly() {
  const { me, setMe } = useAuth();
  const router = useRouter();
  // M-R274: only from the end of day 4 to day 7 (a link from elsewhere goes back to the settings) — judged when the page
  // opens, so paying inside the scene does not close it
  const [open] = useState(() => !!me && canJoinEarly(me));
  useEffect(() => {
    if (me && !open) router.replace('/settings');
  }, [me, open, router]);
  if (!me || !open) return null;
  return (
    <StoryPlayer
      steps={SYS002_ALONE}
      vars={{
        name: me.displayName,
        inviter: me.invitedByName ?? 'MIKIE⭐︎DRILL',
        neo: me.displayName,
        kimorinStar: true,
        bati: me.bati?.name ?? undefined,
        batiImage: me.bati?.imageUrl ?? undefined,
        batiFaces: me.bati?.faces,
        batiFood: me.bati?.food,
        // M-R215–M-R217: {bati}'s lines in its own manner, and its card
        batiSpeech: batiLineVoiceOf(me.bati),
        batiCard: me.bati?.card,
        look: me.avatarUrl ?? undefined,
        story: { ...me.story, ...joinFlags(me.story) },
      }}
      initial={null}
      onProgress={() => {}}
      onName={async () => {}}
      ordered={!!me.orderedAt}
      orderApi={{
        checkout: () => getApi().orderCheckout(),
        confirm: async (sessionId) => {
          setMe(await getApi().confirmOrder(sessionId));
        },
        demo: async () => {
          setMe(await getApi().becomeOrder());
        },
      }}
      onEnd={async (a) => {
        const keep = Object.fromEntries(Object.entries(a).filter(([k]) => k === 'f_ej_heard_now' || k === 'f_join_early_now'));
        try {
          setMe(await getApi().saveSysStory(keep));
        } catch {
          /* the payment itself is already on the account; the flags only shorten day 8 */
        }
        router.push('/settings');
      }}
    />
  );
}
