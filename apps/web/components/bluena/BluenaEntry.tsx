'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getApi } from '@/lib/api';

/**
 * The two doors that sit in the same place on every screen (docs/工房とブルーナ_設計.md §3.1):
 * 〔つくる〕 (the Moon's mark) and 〔ブルーナ〕 (Bluena's own picture). A new talk in 〔通信〕 lights a small dot on
 * Bluena — never a number.
 */
export function BluenaEntry() {
  const [lit, setLit] = useState(false);
  useEffect(() => {
    let live = true;
    getApi()
      .commsStatus()
      .then((st) => (st.open ? getApi().commsContacts() : []))
      .then((c) => live && setLit(c.some((x) => x.unread)))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return (
    <div className="flex items-center gap-1.5">
      {/* PLACEHOLDER (P-ATELIER-1): the Moon atelier is not built yet — 〔つくる〕 opens the Moon, where Bati lives */}
      <Link href="/moon" aria-label="つくる" className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-100/30 bg-amber-100/10 text-amber-100">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden>
          <path d="M15.5 3.5a8.5 8.5 0 1 0 5 13.6A7 7 0 0 1 15.5 3.5z" />
        </svg>
      </Link>
      <Link href="/bluena" aria-label={lit ? 'ブルーナ（新しいやり取りがある）' : 'ブルーナ'} className="relative block h-9 w-9 overflow-hidden rounded-full border border-sky-200/40 bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ui/bluena-icon.webp" alt="" className="h-full w-full scale-125 object-cover" />
        {lit && <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-sky-300 shadow-[0_0_8px_rgba(140,220,255,1)]" />}
      </Link>
    </div>
  );
}
