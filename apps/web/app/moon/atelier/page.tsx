'use client';

import { Suspense } from 'react';
import { MoonAtelier } from '@/components/atelier/MoonAtelier';
import { RequireAuth } from '@/components/RequireAuth';

/** 月の工房: make things with Bati; they go into Bluena (docs/工房とブルーナ_設計.md §3.2). ?kind=song|video|art|… */
export default function MoonAtelierPage() {
  return (
    <RequireAuth>
      <Suspense>
        <MoonAtelier />
      </Suspense>
    </RequireAuth>
  );
}
