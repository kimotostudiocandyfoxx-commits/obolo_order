import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * The review pages (moved from /preview, client 2026-10-25: the old address had been passed around):
 * kept out of search engines; /preview now finds nothing.
 * A tiny build stamp (the deployed commit) sits in the corner so a reviewer can tell which version is live; it hides
 * while a talk's keyboard is up (TalkScene marks <html data-typing>) so it never sits over the input.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

const COMMIT = (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_BUILD_SHA ?? 'local').slice(0, 7);
const BRANCH = process.env.VERCEL_GIT_COMMIT_REF ?? '';

export default function ReviewLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <span
        aria-hidden
        className="pointer-events-none fixed [html[data-typing]_&]:hidden bottom-[env(safe-area-inset-bottom)] left-1/2 z-[460] -translate-x-1/2 select-none font-mono text-[8px] leading-none tracking-wider text-white/20"
        title={BRANCH}
      >
        build {COMMIT}
      </span>
    </>
  );
}
