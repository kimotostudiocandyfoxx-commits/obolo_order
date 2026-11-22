'use client';

import { useState } from 'react';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { batiLineVoiceOf } from '@/lib/onboarding/batiLine';
import type { StoryVars } from '@/lib/onboarding/script';
import { SYS003 } from '@/lib/onboarding/sys003';
import { StoryPlayer } from '@/components/onboarding/StoryPlayer';
import { madeFrom } from '@/lib/onboarding/made';

/**
 * SYS-S003 「たまごが、育った」 played from the Moon when the egg is ready (M-R224): the seed (a sound / a word), the
 * birth, the card, the name, the role; after the 2nd the shell becomes a small egg again, after the 3rd none.
 */
export function EggMorning({ onClose }: { onClose: () => void }) {
  const { me, setMe } = useAuth();
  // which one is born is fixed when the scene starts (the list grows inside it)
  const [nth] = useState(() => String(Math.min(3, (me?.batis?.length ?? 1) + 1)));
  if (!me) return null;
  const vars: StoryVars = {
    name: me.displayName,
    neo: me.displayName,
    inviter: me.invitedByName ?? '',
    kimorinStar: true,
    bati: me.bati?.name ?? undefined,
    batiImage: me.bati?.imageUrl ?? undefined,
    batiFaces: me.bati?.faces,
    batiFood: me.bati?.food,
    batiSpeech: batiLineVoiceOf(me.bati),
    batiCard: me.bati?.card,
    look: me.avatarUrl ?? undefined,
    story: { ...me.story, 'sys3.nth': nth },
    made: madeFrom(me.story),
  };
  return (
    <div className="fixed inset-0 z-[70] bg-black">
      <StoryPlayer
        steps={SYS003}
        vars={vars}
        initial={null}
        onProgress={() => undefined}
        onName={async () => undefined}
        onBatiName={async (n) => setMe(await getApi().batiName(n))}
        onEnd={onClose}
        autoStart
      />
    </div>
  );
}
