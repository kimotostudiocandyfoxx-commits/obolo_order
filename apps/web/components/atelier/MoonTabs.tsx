'use client';

import { useEffect, useRef, useState } from 'react';
import { castLook } from '@/lib/talk/demoLooks';
import { DachiLinkCard } from '@/components/DachiLinkCard';
import { GLASS } from '@/components/talk/TalkScene';
import { useAuth } from '@/lib/auth';
import { characterLook, PLACE_BG } from '@/lib/talk/looks';
import { MoonShelf, WorkSheet } from './Drawers';
import { KindMark } from './WorkCard';
import { KIND_WORD } from './intent';
import { findAll, KIND_PLANET, PLANET_COLOR, type Found } from '@/lib/finds/works';
import { useMarks } from '@/lib/finds/marks';
import { openKinds } from '@/lib/atelier/unlock';
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
 * them — the ダチ thread as it is (DachiThread: the side-by-side talk, voice and text messages, works; the server keeps
 * the under-15 rules), with ← back to the row. KIMORIN⭐︎ is always there (everyone's ダチ, client 2026-11-24); with no
 * real ダチ yet 〔🤝 ダチの招待状〕 sits under the row.
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
        <>
          {/* R9 (client): your ダチ as full figures, strolling on the Moon's ground */}
          <Strollers threads={threads} onOpen={onOpen} />
          {/* only the story's ダチ so far (KIMORIN⭐︎ is everyone's): the invitation to a real one */}
          {!threads.some((t) => t.id !== 'kimorin' && t.id !== 'mikie') && (me?.journeyDay ?? 0) >= 3 && (
            <div className="absolute inset-x-0 bottom-[4svh] z-[6] flex justify-center">
              <button onClick={() => setInvite(true)} className="rounded-full border border-[rgba(210,220,255,.3)] bg-[rgba(16,22,64,.7)] px-4 py-2 text-[13px] font-bold text-[#f4f1ff] backdrop-blur">
                🤝 ダチの招待状
              </button>
            </div>
          )}
        </>
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
 * ブルーナ tab (client 2026-11-24, iPad R7): the Moon behind (not black); your works float as icons in a column at the
 * left, each gently bobbing, with a short line to its right — what it is called (or what it is) and when it was made.
 * A tap opens or plays it as Bluena does (WorkSheet). Your looks and {bati} (the Moon's shelf) are behind 〔姿とバティ〕.
 * No orbit (the planets going round are gone everywhere).
 */
export function BluenaTab({ onBack, banner }: { onBack?: () => void; banner: React.ReactNode }) {
  const { me } = useAuth();
  const ctx = useAtelierCtx();
  const [found, setFound] = useState<Found[] | null>(null);
  const [open, setOpen] = useState<Found | null>(null);
  const [line, setLine] = useState('');
  const [n, setN] = useState(0);
  const [shelf, setShelf] = useState(false);
  useMarks();
  useEffect(() => {
    let live = true;
    void findAll({})
      .then((x) => live && setFound(x))
      .catch(() => live && setFound([]));
    return () => {
      live = false;
    };
  }, [n]);
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden" data-testid="bluena-tab">
      <style>{'@keyframes bluena-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}'}</style>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PLACE_BG.moon} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={{ objectPosition: 'center 30%' }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(to bottom,rgba(7,11,36,.6) 0%,rgba(7,11,36,.15) 30%,rgba(7,11,36,.2) 70%,rgba(7,11,36,.7) 100%)' }} />
      <TabBar title="ブルーナ" onBack={onBack} banner={banner} />
      <div className="relative z-[5] flex justify-end px-4 pt-2">
        <button onClick={() => setShelf(true)} className="rounded-full border border-[rgba(210,220,255,.3)] bg-[rgba(16,22,64,.6)] px-3 py-1 text-[12px] font-bold text-[#f4f1ff] backdrop-blur">
          姿とバティ
        </button>
      </div>
      {line && <p className="relative z-[5] pt-1 text-center text-[11px] text-sky-100/80 [text-shadow:0_1px_4px_#000]">{line}</p>}
      <div className="no-scrollbar relative z-[5] min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2">
        {found === null && <p className="py-10 text-center text-xs text-white/60">…</p>}
        {found?.length === 0 && <p className="py-10 text-center text-[13px] text-white/75 [text-shadow:0_1px_4px_#000]">まだ、なにもない</p>}
        <ul className="space-y-3.5">
          {found?.map((x, k) => (
            <li key={`${x.kind}:${x.id}`}>
              <button onClick={() => setOpen(x)} className="flex w-full items-center gap-3 text-left" data-testid="bluena-work">
                <span className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 shadow-[0_6px_16px_rgba(0,0,0,.45)]" style={{ borderColor: PLANET_COLOR[x.planet], background: '#141b44', animation: `bluena-bob ${3.2 + (k % 3) * 0.5}s ease-in-out ${(k % 5) * 0.4}s infinite` }}>
                  {x.image && !x.image.startsWith('idb:') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={x.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center" style={{ color: PLANET_COLOR[x.planet] }}>
                      <KindMark kind={x.work.kind} className="h-6 w-6" />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1 rounded-2xl bg-[rgba(10,14,44,.55)] px-3 py-1.5 backdrop-blur-sm">
                  <span className="block truncate text-[13.5px] font-bold text-[#f4f1ff]">{x.title || x.work.prompt || KIND_WORD[x.work.kind]}</span>
                  <span className="block text-[11px] text-[#c9cff5]/80">
                    {KIND_WORD[x.work.kind]}・{madeWhen(x.createdAt)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {open && <WorkSheet found={open} ctx={ctx} onClose={() => setOpen(null)} onLine={setLine} onChanged={() => setN((v) => v + 1)} />}
      {shelf && (
        <div className="absolute inset-0 z-[30] flex flex-col bg-[rgba(8,12,36,.94)] px-4 pb-4 pt-3 backdrop-blur">
          <div className="flex items-center pb-2">
            <button onClick={() => setShelf(false)} aria-label="もどる" className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-sky-100/80">
              ‹
            </button>
            <b className="flex-1 text-center text-[14px] text-[#f4f1ff]">姿とバティ</b>
            <span className="w-8" />
          </div>
          <MoonShelf kinds={openKinds(me?.journeyDay).filter((k) => !KIND_PLANET[k])} ctx={ctx} />
        </div>
      )}
    </div>
  );
}

/** when a work was made: today → きょう 06:49, else 11/24 06:49 */
export function madeWhen(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() <= 0) return '';
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return d.toDateString() === now.toDateString() ? `きょう ${hm}` : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

/** a ダチ's full figure (their look's standing picture; KIMORIN⭐︎'s sprite; else the talk cast's friend) */
const standOf = (t: ThreadInfo) => t.stand || (t.id === 'kimorin' ? characterLook('kimorin')?.stand : t.id === 'mikie' ? characterLook('mikie')?.stand : undefined) || castLook('friend').stand;

/**
 * R9 (client): the ダチ stroll on the Moon — each in a stretch of ground of its own (so they never stand on each other),
 * walking slowly left and right with a small bob, facing the way they walk, stopping now and then. One rAF loop moves
 * them by transform only (no React render per frame: 60 fps on the iPad). Reduced motion: standing, a gentle idle.
 * Their names under their feet; a tap opens the talk; the unread dot by the head.
 */
function Strollers({ threads, onOpen }: { threads: ThreadInfo[]; onOpen: (id: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const els = useRef<(HTMLButtonElement | null)[]>([]);
  const figs = useRef<(HTMLImageElement | null)[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const n = threads.length;
  const reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = Math.round(Math.min(size.h * (n <= 2 ? 0.44 : n <= 4 ? 0.36 : 0.28), n <= 2 ? 320 : 240));
  const W = Math.round(H * 0.62);
  const key = threads.map((t) => t.id).join('|');
  useEffect(() => {
    if (!size.w || !H) return;
    const lane = size.w / n;
    const place = (i: number, x: number, bob: number, dir: number) => {
      const b = els.current[i];
      const f = figs.current[i];
      if (b) b.style.transform = `translate3d(${(x - W / 2).toFixed(1)}px, ${bob.toFixed(1)}px, 0)`;
      if (f) f.style.transform = dir < 0 ? 'scaleX(-1)' : 'none';
    };
    const st = threads.map((_, i) => ({ x: lane * (i + 0.5), dir: i % 2 ? -1 : 1, pause: 0.6 + i * 0.7, speed: 16 + ((i * 7) % 5) * 2, t: i * 1.7 }));
    if (reduced) {
      st.forEach((s, i) => place(i, s.x, 0, 1));
      return;
    }
    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      st.forEach((s, i) => {
        // each in its own stretch, the figure's half-width kept inside it (and inside the screen)
        const lo = Math.max(W / 2 + 6, lane * i + Math.min(W / 2, lane * 0.3));
        const hi = Math.min(size.w - W / 2 - 6, lane * (i + 1) - Math.min(W / 2, lane * 0.3));
        let walking = false;
        if (s.pause > 0) s.pause -= dt;
        else {
          walking = true;
          s.t += dt;
          s.x += s.dir * s.speed * dt;
          if (s.x <= lo || s.x >= hi || hi - lo < 8) {
            s.x = Math.max(lo, Math.min(hi, s.x));
            s.dir = -s.dir;
            s.pause = 0.9 + Math.random() * 1.8;
          } else if (Math.random() < dt * 0.12) s.pause = 0.8 + Math.random() * 1.6;
        }
        place(i, s.x, walking ? -Math.abs(Math.sin(s.t * 5.2)) * 4 : 0, s.dir);
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, size.w, H, W, reduced]);
  return (
    <div ref={box} className="absolute inset-x-0 bottom-0 top-[30%] z-[5]" data-testid="dachi-strollers">
      <style>{'@keyframes dachi-idle{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.012)}}'}</style>
      {threads.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => void (els.current[i] = el)}
          onClick={() => onOpen(t.id)}
          aria-label={`${t.name}と話す`}
          className="absolute left-0 flex flex-col items-center will-change-transform"
          style={{ bottom: '13%', width: W, transform: `translate3d(${(size.w / n) * (i + 0.5) - W / 2}px,0,0)` }}
        >
          <span className="relative block" style={{ width: W, height: H, animation: reduced ? 'dachi-idle 4.5s ease-in-out infinite' : undefined, transformOrigin: '50% 100%' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={(el) => void (figs.current[i] = el)} src={standOf(t)} alt="" draggable={false} className="h-full w-full select-none object-contain object-bottom drop-shadow-[0_8px_10px_rgba(0,0,0,.35)]" />
            {!!t.unread && <span className="absolute right-[18%] top-[6%] h-3.5 w-3.5 rounded-full border-2 border-[#0b1027] bg-sky-300" aria-label="まだ聞いていない" />}
          </span>
          {/* the shadow on the ground, the name under the feet */}
          <span className="-mt-2 block h-2 rounded-[50%] bg-black/35 blur-[2px]" style={{ width: W * 0.55 }} aria-hidden />
          <span className="mt-1 max-w-[150%] truncate whitespace-nowrap rounded-full bg-[rgba(10,14,44,.6)] px-2 py-0.5 text-[11px] font-bold text-[#f4f1ff] backdrop-blur">{t.name}</span>
        </button>
      ))}
    </div>
  );
}
