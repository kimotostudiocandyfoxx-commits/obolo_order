import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * The review pages (moved from /preview, client 2026-10-25: the old address had been passed around):
 * kept out of search engines; /preview now finds nothing.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function ReviewLayout({ children }: { children: ReactNode }) {
  return children;
}
