'use client';

import { Suspense } from 'react';
import { BluenaView } from '@/components/bluena/BluenaView';
import { RequireAuth } from '@/components/RequireAuth';

/** Bluena: your works (〔作品〕) and your talks with your ダチ (〔通信〕) — docs/工房とブルーナ_設計.md §3.3・§11 */
export default function BluenaPage() {
  return (
    <RequireAuth>
      <Suspense>
        <BluenaView />
      </Suspense>
    </RequireAuth>
  );
}
