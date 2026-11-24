'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { LegalText, type LegalKind } from '@/components/LegalText';

/** M-R252: /terms and /privacy (and /tokushoho, its own children) — the full text as a simple page (from the settings); ← goes back */
export function LegalPage({ kind, children }: { kind?: LegalKind; children?: ReactNode }) {
  const router = useRouter();
  return (
    <main className="pt-safe pb-safe mx-auto min-h-svh max-w-md px-4 py-4">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.back() : router.push('/settings'))}
        className="btn btn-ghost h-9 w-9 !p-0 text-lg"
        aria-label="もどる"
      >
        ←
      </button>
      <div className="mt-3">
        {kind ? <LegalText kind={kind} /> : children}
      </div>
    </main>
  );
}
