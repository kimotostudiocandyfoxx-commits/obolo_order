'use client';

import { Suspense } from 'react';
import { MoonAtelier } from '@/components/atelier/MoonAtelier';
import { DachiThread } from '@/components/dachi/DachiThread';
import { RequireAuth } from '@/components/RequireAuth';
import { useDachiThreads } from '@/lib/dachi/useDachiThreads';

/** 月の工房: make things with Bati; they go into Bluena (docs/工房とブルーナ_設計.md §3.2). ?kind=song|video|art|… */
export default function MoonAtelierPage() {
  return (
    <RequireAuth>
      <Suspense>
        <WithDachi />
      </Suspense>
    </RequireAuth>
  );
}

/** the ダチ threads (M-R212) under {bati} in the left drawer: from D04-S005c (day 3) on — the list is empty before */
function WithDachi() {
  const { threads, list, reload, markRead } = useDachiThreads();
  return (
    <MoonAtelier
      threads={threads}
      renderThread={(id, ctx) => (
        <DachiThread
          key={id}
          id={id}
          thread={list.find((t) => t.id === id)}
          onList={ctx.openList}
          onRead={markRead}
          onGone={() => {
            void reload();
            ctx.openList();
          }}
        />
      )}
    />
  );
}
