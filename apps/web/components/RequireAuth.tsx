'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n/client';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const { m } = useI18n();
  if (status === 'loading') return <p className="py-16 text-center text-white/60">{m.common.loading}</p>;
  if (status === 'guest') {
    return (
      <div className="card mx-auto mt-10 max-w-sm p-6 text-center">
        <p className="mb-4 text-white/80">{m.common.loginRequired}</p>
        <Link href="/earth" className="btn btn-primary">
          {m.common.goToEarth}
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
