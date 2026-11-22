'use client';

import { useState } from 'react';
import { TomorrowScreen } from '@/components/onboarding/TomorrowScreen';

/** /kakunin-5798f28713/tomorrow — the 「また明日」 countdown on its own (3 hours into the day), with the skip, to check its look */
export default function TomorrowPreview() {
  const [k, setK] = useState(0);
  const [at] = useState(() => new Date(Date.now() - 3 * 3600_000).toISOString());
  return <TomorrowScreen key={k} name="ユウ" completedAt={at} canSkip skippedText="24時間スキップした" onUnlocked={() => setTimeout(() => setK((x) => x + 1), 1500)} />;
}
