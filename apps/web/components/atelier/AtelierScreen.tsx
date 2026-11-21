'use client';

import type { ReactNode } from 'react';

/**
 * The Moon atelier seen through Bluena during the first journey's practices (simple version, M-R185: 作るのは月):
 * a beam from Bluena's lens opens a square screen over the planet, and through it the workshop in the Moon temple —
 * the workbench, the night window — with {bati} on the bench. What is being made goes inside (children).
 * No new pictures: shapes and light only (the client's rule 2026-11-21). Shared by the day 4–7 practices so the
 * workshop looks the same wherever it opens.
 */
export function AtelierScreen({ bati, children, closing = false, caption }: { bati?: { name?: string; image?: string }; children?: ReactNode; closing?: boolean; caption?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 z-[11] flex items-center justify-center px-3 ${closing ? 'animate-[atelier-close_0.6s_ease-in_forwards]' : ''}`}>
      {/* the beam from Bluena (bottom right, where the Bluena door sits) */}
      <span className="absolute bottom-[8%] right-[10%] h-[60%] w-1 origin-bottom rotate-[-28deg] animate-[atelier-beam_0.9s_ease-out_forwards] rounded-full bg-gradient-to-t from-sky-200/0 via-sky-200/70 to-sky-100/0 blur-[2px]" />
      <div className="pointer-events-auto relative aspect-square w-full max-w-[min(92vw,440px)] animate-[atelier-open_0.9s_cubic-bezier(.5,0,.2,1)_both] overflow-hidden rounded-[28px] border border-sky-100/50 bg-[radial-gradient(120%_80%_at_50%_0%,#24356a_0%,#0e1636_55%,#070a1c_100%)] shadow-[0_0_50px_rgba(120,200,255,0.45)]">
        {/* the workshop: an arched night window with the Earth, a shelf, the workbench */}
        <div className="absolute left-1/2 top-[7%] h-[34%] w-[44%] -translate-x-1/2 rounded-t-full border border-amber-100/25 bg-[radial-gradient(circle_at_70%_30%,rgba(120,180,255,0.45),transparent_32%),radial-gradient(circle_at_50%_60%,#0b1640,#050816)]">
          <span className="absolute right-[22%] top-[22%] h-[18%] w-[18%] rounded-full bg-[radial-gradient(circle_at_35%_35%,#bfe3ff,#3a78c9_60%,#173866)] shadow-[0_0_18px_rgba(120,190,255,0.7)]" />
        </div>
        <div className="absolute inset-x-[10%] top-[44%] h-[2px] rounded bg-amber-100/15" />
        <div className="absolute inset-x-0 bottom-0 h-[24%] bg-gradient-to-t from-[#2a1d14] to-[#3b2a1c]/80">
          <div className="h-[3px] w-full bg-amber-200/30" />
        </div>
        {bati?.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bati.image} alt={bati.name ?? ''} className="absolute bottom-[14%] left-[5%] h-[26%] w-auto animate-[atelier-hop_0.6s_0.7s_ease-out_both] object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]" />
        )}
        {caption && <p className="absolute inset-x-0 top-2 text-center text-[11px] tracking-[0.25em] text-sky-100/70">{caption}</p>}
        <div className="absolute inset-0 flex items-center justify-center p-[9%]">{children}</div>
      </div>
    </div>
  );
}
