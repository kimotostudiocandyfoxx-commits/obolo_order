'use client';

import { JOURNEY_DONE, JOURNEY_WAIT_MS } from '@obolo/shared';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { EntryScreen } from '@/components/onboarding/EntryScreen';
import { JourneyDayScreen } from '@/components/onboarding/JourneyDayScreen';
import { StoryDay } from '@/components/onboarding/StoryDay';
import { TomorrowScreen } from '@/components/onboarding/TomorrowScreen';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n/client';
import { loadDay1 } from '@/lib/onboarding/progress';
import { STORIES } from '@/lib/onboarding/stories';

const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

/**
 * Everything in front of the solar system (client decision 2026-10-04):
 *   guest            → email entry (invited → Day 1, member → continue)
 *   day 1–8, playing → that day's story (Day 1 = /invite story)
 *   day finished     → "〇〇、また明日。" 24 h countdown (or 明日まで待てへん)
 *   day 9            → the Eclipse day: story with the ¥88/month payment inside, then "また明日" too
 *   day 10 (ORDER)   → the solar system
 */
export function HomeGate({ children }: { children: ReactNode }) {
  const { status, me, setMe } = useAuth();

  if (status === 'loading') return <div className="fixed inset-0 bg-black" />;
  if (status === 'guest' || !me) return <EntryScreen />;

  const day = me.journeyDay;
  if (day >= JOURNEY_DONE) return <>{children}</>;
  if (me.journeyCompletedAt) {
    return (
      <TomorrowScreen
        key={`${day}-${me.journeyCompletedAt}`}
        name={me.displayName}
        completedAt={me.journeyCompletedAt}
        skipLabel={STORIES[day]?.skipLabel}
        onUnlocked={async (skipped) => {
          const elapsed = Date.now() >= Date.parse(me.journeyCompletedAt!) + JOURNEY_WAIT_MS;
          setMe(await getApi().advanceJourney(skipped || !elapsed));
        }}
      />
    );
  }
  if (day === 1) return <ResumeStory />;
  const story = STORIES[day];
  if (story) return <StoryDay key={day} day={day} story={story} />;
  return <JourneyDayScreen key={day} day={day} />;
}

function ResumeStory() {
  const { m } = useI18n();
  const [code, setCode] = useState('resume');
  useEffect(() => setCode(loadDay1()?.code ?? 'resume'), []);
  return (
    <main className="pt-safe pb-safe flex min-h-svh flex-col items-center justify-center gap-5 bg-black px-8 text-center" style={{ fontFamily: SERIF }}>
      <span className="text-xs tracking-[0.6em] text-amber-200/70">DAY 1</span>
      <p className="text-xl tracking-wider text-amber-50">{m.gate.resumeTitle}</p>
      <Link href={`/invite/${code}`} className="mt-2 rounded-full border border-amber-200/60 px-8 py-3 tracking-widest text-amber-100">
        {m.gate.resume}
      </Link>
    </main>
  );
}
