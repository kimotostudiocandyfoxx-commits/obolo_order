'use client';

import { ConsentPanel } from '@/components/ConsentGate';

/** the review page of the start-of-app agreement (M-R247 / M-R248): shown as the invitation shows it; nothing is saved */
export default function ConsentReview() {
  return <ConsentPanel onAgree={() => undefined} />;
}
