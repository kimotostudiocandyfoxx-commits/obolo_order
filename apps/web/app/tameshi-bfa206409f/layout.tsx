import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/** The testers' link (client 2026-10-26): kept out of search engines, no way back to the review pages. */
export const metadata: Metadata = { title: 'Obolo Order', robots: { index: false, follow: false } };

export default function TesterLayout({ children }: { children: ReactNode }) {
  return children;
}
