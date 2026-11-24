'use client';

import { useState } from 'react';
import { DachiLinkCard } from '@/components/DachiLinkCard';
import { GLASS } from '@/components/talk/TalkScene';
import { useAuth } from '@/lib/auth';
import { PLACE_BG } from '@/lib/talk/looks';
import { PlanetWorks } from './Drawers';
import { useAtelierCtx } from './ctx';
import type { RenderThread, ThreadInfo } from './threads';

/** the Moon chat's three tabs (client 2026-11-24), kept in the URL as ?tab= (none = {bati}) */
export type MoonTab = 'bati' | 'dachi' | 'bluena';
export const tabOf = (v: string | null): MoonTab => (v === 'dachi' || v === 'bluena' ? v : 'bati');

/**
 * The small segmented control under the Moon chat's bar: {bati}'s name | ダチ | ブルーナ. ブルーナ only once Bluena is
 * handed over (day 3, D04-S002; there is no Bluena before — M-R212).
 */
export function MoonTabs({ tab, bati, bluena, unread, onTab }: { tab: MoonTab; bati: string; bluena: boolean; /** a ダチ thread not heard yet */ unread?: boolean; onTab: (t: MoonTab) => void }) {
  const tabs: [MoonTab, string][] = [
    ['bati', bati || 'バティ'],
    ['dachi', 'ダチ'],
    ...(bluena ? ([['bluena', 'ブルーナ']] as [MoonTab, string][]) : []),
  ];
  return (
    <div role="tablist" aria-label="月の会話" className="flex h-[28px] items-stretch rounded-full border border-[rgba(210,220,255,.22)] bg-[rgba(10,14,44,.55)] p-[2px] backdrop-blur-[10px]" data-testid="moon-tabs">
      {tabs.map(([id, label]) => (
        <button
          key={id}
          role="tab"
          aria-selected={tab === id}
          onClick={() => tab !== id && onTab(id)}
          className={`relative min-w-[64px] max-w-[120px] truncate rounded-full px-3 text-[12px] font-bold tracking-[0.06em] transition-colors ${tab === id ? 'bg-[rgba(223,230,255,.92)] text-[#070b24]' : 'text-[#dfe4ff]/80'}`}
        >
          {label}
          {id === 'dachi' && unread && tab !== 'dachi' && <span className="absolute right-1.5 top-1 h-1.5 w-1.5 rounded-full bg-sky-300" />}
        </button>
      ))}
    </div>
  );
}

/** the small bar of a tab that is not a talk: ← back, the title, and the tabs under it (the same place as the talk's) */
function TabBar({ title, onBack, banner }: { title: string; onBack?: () => void; banner: React.ReactNode }) {
  return (
    <div className="relative z-[20] shrink-0">
      <header className="flex items-center gap-2.5 px-3.5 py-2.5">
        {onBack ? (
          <button onClick={onBack} aria-label="もどる" className={GLASS}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        ) : (
          <span className="w-[42px]" />
        )}
        <b className="min-w-0 flex-1 truncate text-center text-[15px] font-black tracking-[0.04em] [text-shadow:0_1px_8px_rgba(0,0,0,.5)]">{title}</b>
        <span className="w-[42px]" />
      </header>
      <div className="-mt-1 flex justify-center px-3.5">{banner}</div>
    </div>
  );
}

/**
 * ダチ tab: your ダチ stand in a row on the Moon (the same backdrop as the talk). A tap opens the two-person talk with
 * them — the ダチ thread as it is (DachiThread: the side-by-side talk, voice messages, works; the server keeps the
 * under-15 rules), with ← back to the row. None yet: a short line and 〔🤝 ダチの招待状〕.
 */
export function DachiTab({ threads, open, onOpen, onBack, banner, renderThread }: { threads: ThreadInfo[]; open: string | null; onOpen: (id: string | null) => void; onBack?: () => void; banner: React.ReactNode; renderThread?: RenderThread }) {
  const [invite, setInvite] = useState(false);
  const { me } = useAuth();
  if (open && renderThread)
    return (
      <div className="relative flex min-h-0 flex-1 flex-col">
        {renderThread(open, { openList: () => onOpen(null), back: () => onOpen(null), banner })}
      </div>
    );
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden" data-testid="dachi-tab">
      {/* the Moon behind, as in the talk */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PLACE_BG.moon} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={{ objectPosition: 'center 30%' }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(to bottom,rgba(7,11,36,.55) 0%,rgba(7,11,36,0) 22%,rgba(7,11,36,0) 62%,rgba(7,11,36,.7) 100%)' }} />
      <TabBar title="ダチ" onBack={onBack} banner={banner} />
      {threads.length ? (
        // standing on the Moon's ground: the row sits low, over the surface
        <div className="relative z-[5] mt-auto mb-[16svh] flex flex-wrap items-end justify-center gap-x-5 gap-y-6 px-5">
          {threads.map((t) => (
            <button key={t.id} onClick={() => onOpen(t.id)} className="group flex w-[76px] flex-col items-center gap-1.5" aria-label={`${t.name}と話す`}>
              <span className="relative block">
              <span className="relative block h-[68px] w-[68px] overflow-hidden rounded-full border-2 border-[rgba(223,230,255,.85)] bg-[#1a2150] shadow-[0_6px_18px_rgba(0,0,0,.45)] transition-transform group-active:scale-95">
                {t.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[22px] font-black text-[#dfe4ff]">{t.name.slice(0, 1)}</span>
                )}
              </span>
              {!!t.unread && <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full border-2 border-[#0b1027] bg-sky-300" aria-label="まだ聞いていない" />}
              </span>
              <span className="max-w-full truncate rounded-full bg-[rgba(10,14,44,.6)] px-2 py-0.5 text-[11px] font-bold text-[#f4f1ff] backdrop-blur">{t.name}</span>
              {/* the shadow on the ground */}
              <span className="-mt-1 block h-1.5 w-12 rounded-[50%] bg-black/35 blur-[2px]" aria-hidden />
            </button>
          ))}
        </div>
      ) : (
        <div className="relative z-[5] mt-auto mb-[14svh] flex flex-col items-center gap-4 px-8 text-center">
          {/* PLACEHOLDER (P-MOON-TABS-1): the words when there is no ダチ yet */}
          <p className="rounded-2xl bg-[rgba(10,14,44,.6)] px-4 py-2.5 text-[14px] font-bold leading-relaxed text-[#f4f1ff] backdrop-blur">
            {(me?.journeyDay ?? 0) < 3 ? 'ダチとは、もう少しあとで話せるようになるよ' : 'まだ、ダチはいないみたい。本当に知っている人に、招待状を渡してみよう'}
          </p>
          {(me?.journeyDay ?? 0) >= 3 && (
            <button onClick={() => setInvite(true)} className="rounded-full border border-[rgba(210,220,255,.3)] bg-[rgba(16,22,64,.7)] px-5 py-2.5 text-[14px] font-bold text-[#f4f1ff] backdrop-blur">
              🤝 ダチの招待状
            </button>
          )}
        </div>
      )}
      {invite && (
        <div className="absolute inset-0 z-[40] flex items-end justify-center bg-black/55 p-3" onClick={() => setInvite(false)}>
          <div className="max-h-[80%] w-full max-w-md overflow-y-auto rounded-3xl bg-[#121a3a] p-4" onClick={(e) => e.stopPropagation()}>
            <DachiLinkCard />
            <button onClick={() => setInvite(false)} className="mt-3 w-full rounded-full bg-white/10 py-2.5 text-[13px] text-white/80">
              とじる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ブルーナ tab: everything you made (pictures, videos, songs, kororin, radio, looks…) in one list — Bluena's own list of
 * all the planets (PlanetWorks with no planet: the server's works + this device's shelf); a tap opens or plays it as
 * Bluena does.
 */
export function BluenaTab({ onBack, banner }: { onBack?: () => void; banner: React.ReactNode }) {
  const { me } = useAuth();
  const ctx = useAtelierCtx();
  return (
    <div className="relative flex min-h-0 flex-1 flex-col" data-testid="bluena-tab">
      <TabBar title="ブルーナ" onBack={onBack} banner={banner} />
      <div className="relative mt-2 flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3">
        <PlanetWorks planet={null} day={me?.journeyDay} ctx={ctx} />
      </div>
    </div>
  );
}
