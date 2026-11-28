'use client';

import { journeyWaitSkippable } from '@obolo/shared';
import { useEffect, useState } from 'react';
import { TomorrowScreen } from '@/components/onboarding/TomorrowScreen';
import { STORIES } from '@/lib/onboarding/stories';
import { noSkipWaitWords, WAIT_SKIP_LABEL, WAIT_SKIPPED_TEXT } from '@/lib/onboarding/waitWords';

/**
 * /kakunin-5798f28713/tomorrow — the 「また明日」 countdown after day 1 on its own (3 hours into the day), with the skip and
 * day 1's words (「宇宙行きの切符が届くまで」), to check its look. ?after=N shows the wait after day N as a member sees it
 * (client 2026-11-28: ?after=3 and ?after=7 are the two waits that cannot be skipped).
 */
export default function TomorrowPreview() {
  const [k, setK] = useState(0);
  const [at] = useState(() => new Date(Date.now() - 3 * 3600_000).toISOString());
  const [day, setDay] = useState(1);
  useEffect(() => {
    const n = Number(new URLSearchParams(window.location.search).get('after'));
    if (Number.isInteger(n) && n >= 1 && n <= 11) setDay(n);
  }, []);
  const bati = 'バティ';
  const noSkip = noSkipWaitWords(day, bati);
  return (
    <TomorrowScreen
      key={`${day}-${k}`}
      name="ユウ"
      completedAt={at}
      canSkip={journeyWaitSkippable(day)}
      skipLabel={STORIES[day]?.skipLabel ?? WAIT_SKIP_LABEL}
      skippedText={STORIES[day]?.skippedText ?? WAIT_SKIPPED_TEXT}
      untilText={STORIES[day]?.untilText}
      doneText={STORIES[day]?.doneText}
      bati={day >= 2 ? { name: bati } : undefined}
      note={STORIES[day]?.waitNote?.replaceAll('{bati}', bati)}
      noSkip={noSkip && { ...noSkip, bati }}
      onUnlocked={() => setTimeout(() => setK((x) => x + 1), 1500)}
    />
  );
}
