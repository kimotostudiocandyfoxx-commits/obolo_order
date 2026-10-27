'use client';

import { JOURNEY_DONE, JOURNEY_PAYMENT } from '@obolo/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { madeFrom } from '@/lib/onboarding/made';
import { labelIndex } from '@/lib/onboarding/script';
import { DAY8 } from '@/lib/onboarding/day8';
import { realLessonApi } from '@/lib/onboarding/lessonApi';
import { solvedSealsOn, knownSealsOn, stampsOn } from './StoryExtras';
import { StoryPlayer } from './StoryPlayer';

const SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

/** a resident: the first journey is over and the Eclipse was not taken (draft 21, M-R124) */
export function useResident(): boolean {
  const { me } = useAuth();
  return !!me && me.journeyDay >= JOURNEY_DONE && !me.orderedAt;
}

/**
 * The Eclipse, offered only when a resident presses something that needs it (story D08-S005, M-R124): the
 * mana-using making, the doors of Uranus and Neptune, the second journey. No notices, badges or red dots
 * anywhere else. 〔太陽の神殿へ〕 takes them back to the choice at the Sun (/eclipse).
 */
export function EclipseGuide({ what, onClose }: { what: string; onClose: () => void }) {
  // out of the planet's transformed / filtered box, onto the whole screen
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  if (!host) return null;
  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-end justify-center bg-black/65 px-4 pb-[calc(24px+env(safe-area-inset-bottom))]" onClick={onClose} style={{ fontFamily: SERIF }}>
      <div className="w-full max-w-sm rounded-3xl border border-amber-200/30 bg-[#0d0a16] p-6 text-center text-amber-50 shadow-[0_0_40px_rgba(255,200,110,0.25)]" onClick={(e) => e.stopPropagation()}>
        <p className="text-[11px] tracking-[0.3em] text-amber-200/70">MONBAN</p>
        <p className="mt-2 text-[15px] leading-relaxed">……{what}は、エクリプスを受けてからだ…。太陽の神殿で、いつでも受けられる…。</p>
        <Link href="/eclipse" className="mt-5 block rounded-full border border-amber-200/70 bg-amber-200/10 py-3 tracking-[0.25em] text-amber-100">
          太陽の神殿へ
        </Link>
        <button onClick={onClose} className="mt-3 text-[13px] text-white/50">
          今はいい
        </button>
      </div>
    </div>,
    host,
  );
}

/**
 * /eclipse — a resident comes back to the Sun temple (D08-S003 「再開した人」): OBOLON 「、、、来たか。」 → the
 * star map → 〔エクリプスを受ける〕〔今は、住人のままでいる〕. Paying plays the Eclipse, riddle 1 and records
 * II・III; staying goes back to the map. Members (ORDER) and people still on the journey are sent home.
 */
export function EclipseReturn() {
  const { me, setMe } = useAuth();
  const router = useRouter();
  const resident = useResident();
  useEffect(() => {
    if (me && !resident) router.replace('/');
  }, [me, resident, router]);
  if (!me || !resident) return <div className="fixed inset-0 bg-black" />;
  const day = JOURNEY_PAYMENT;
  return (
    <StoryPlayer
      steps={DAY8}
      vars={{
        name: me.displayName,
        inviter: me.invitedByName ?? '',
        neo: me.displayName,
        kimorinStar: true,
        bati: me.bati?.name ?? undefined,
        batiImage: me.bati?.imageUrl ?? undefined,
        batiFood: me.bati?.food,
        look: me.avatarUrl ?? undefined,
        story: me.story,
        made: madeFrom(me.story),
      }}
      lessonApi={realLessonApi}
      seals={{ known: knownSealsOn(day + 1), solved: solvedSealsOn(day + 1, false) }}
      stamps={stampsOn(day)}
      initial={{ i: labelIndex(DAY8, 'resume'), name: me.displayName, answers: {} }}
      onProgress={() => undefined}
      onName={async () => undefined}
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
      onEnd={() => setTimeout(() => router.replace('/'), 1500)}
    />
  );
}
