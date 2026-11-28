'use client';

import { useState } from 'react';
import { TomorrowScreen } from '@/components/onboarding/TomorrowScreen';
import { STORIES } from '@/lib/onboarding/stories';

/**
 * /kakunin-5798f28713/tomorrow — the 「また明日」 countdown after day 1 on its own (3 hours into the day), with the skip and
 * day 1's words (「宇宙行きの切符が届くまで」), to check its look
 */
export default function TomorrowPreview() {
  const [k, setK] = useState(0);
  const [at] = useState(() => new Date(Date.now() - 3 * 3600_000).toISOString());
  return <TomorrowScreen key={k} name="ユウ" completedAt={at} canSkip skippedText={STORIES[1].skippedText} untilText={STORIES[1].untilText} onUnlocked={() => setTimeout(() => setK((x) => x + 1), 1500)} />;
}
