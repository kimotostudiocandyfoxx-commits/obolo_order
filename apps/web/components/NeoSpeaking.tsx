'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';

/**
 * While the visitor speaks into 〔🎙〕, their own figure (the NEO look standing, without a background) comes up big
 * from the bottom behind the panels (the 〔🎙〕 stays in front), and goes back down when they stop (M-R149). The
 * portrait stands in until the figure is drawn.
 */
export function NeoSpeaking() {
  const { me } = useAuth();
  const [on, setOn] = useState(false);
  useEffect(() => {
    const f = (e: Event) => setOn(!!(e as CustomEvent<boolean>).detail);
    window.addEventListener('obolo:speaking', f);
    return () => window.removeEventListener('obolo:speaking', f);
  }, []);
  const src = me?.lookStandee || me?.avatarUrl;
  if (!src) return null;
  const standing = !!me?.lookStandee;
  return (
    <div className={`pointer-events-none fixed inset-x-0 bottom-0 z-[11] flex justify-center transition-all duration-500 ease-out ${on ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className={standing ? 'h-[62svh] max-w-[90vw] object-contain drop-shadow-[0_0_30px_rgba(255,214,140,0.45)]' : 'mb-[40svh] h-44 w-44 rounded-full object-cover ring-4 ring-amber-200/70'} />
    </div>
  );
}
