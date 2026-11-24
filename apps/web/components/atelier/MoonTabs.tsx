'use client';

import { useEffect, useRef, useState } from 'react';
import { castLook } from '@/lib/talk/demoLooks';
import { HALL_ROWS, MOON_ZONES, MOON_ZONES_EYE, strollSlots } from '@/lib/talk/zones';
import { placeLabels, type LabelFig, type LabelSpot, type Rect } from '@/lib/talk/labels';
import { SelfBack, selfBackRects } from '@/components/talk/SelfBack';
import { dachiZones } from '@obolo/shared';
import { DachiLinkCard } from '@/components/DachiLinkCard';
import { GLASS } from '@/components/talk/TalkScene';
import { useAuth } from '@/lib/auth';
import { characterLook, PLACE_BG } from '@/lib/talk/looks';
import { MoonShelf, WorkSheet } from './Drawers';
import { DeviceButton } from './DeviceButton';
import { DachiHistory } from './DachiHistory';
import type { Work } from './work';
import { KindMark } from './WorkCard';
import { KIND_WORD } from './intent';
import { findAll, KIND_PLANET, PLANET_COLOR, type Found } from '@/lib/finds/works';
import { useMarks } from '@/lib/finds/marks';
import { StarButton, useMarkRing } from '@/components/finds/MarkRing';
import { openKinds } from '@/lib/atelier/unlock';
import { useAtelierCtx } from './ctx';
import type { RenderThread, ThreadInfo } from './threads';

/** the Moon chat's three tabs (client 2026-11-24), kept in the URL as ?tab= (none = {bati}) */
export type MoonTab = 'bati' | 'dachi' | 'bluena';
export const tabOf = (v: string | null): MoonTab => (v === 'dachi' || v === 'bluena' ? v : 'bati');

/**
 * The small segmented control under the Moon chat's bar: ダチ | {bati}'s name | ブルーナ (R9). ブルーナ only once Bluena is
 * handed over (day 3, D04-S002; there is no Bluena before — M-R212).
 */
export function MoonTabs({ tab, bati, unread, onTab }: { tab: MoonTab; bati: string; /** a ダチ thread not heard yet */ unread?: boolean; onTab: (t: MoonTab) => void }) {
  // R10 (client): ダチ | {bati}, {bati} the default — Bluena is a device now (BluenaDevice, from the header's button)
  const tabs: [MoonTab, string][] = [
    ['dachi', 'ダチ'],
    ['bati', bati || 'バティ'],
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
function TabBar({ title, onBack, banner, right, onList }: { title: string; onBack?: () => void; banner: React.ReactNode; right?: React.ReactNode; /** R10: ≡ the conversations (as the Bati tab's) */ onList?: () => void }) {
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
        {onList && (
          <button onClick={onList} aria-label="会話の一覧を開く" className={GLASS} data-testid="dachi-history-button">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <path d="M4 7h16M4 12h11M4 17h7" />
            </svg>
          </button>
        )}
        <b className="min-w-0 flex-1 truncate text-center text-[15px] font-black tracking-[0.04em] [text-shadow:0_1px_8px_rgba(0,0,0,.5)]">{title}</b>
        {right ?? <span className={onList ? 'w-[94px]' : 'w-[42px]'} />}
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
export function DachiTab({ threads, open, onOpen, onBack, banner, renderThread, onDevice }: { threads: ThreadInfo[]; open: string | null; onOpen: (id: string | null) => void; onBack?: () => void; banner: React.ReactNode; renderThread?: RenderThread; /** R10: the Bluena device */ onDevice?: () => void }) {
  const [invite, setInvite] = useState(false);
  const { me } = useAuth();
  const scroller = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState(false);
  // R10 (client): your own back, big and blurred at the lower right, as in the {bati} talk (SelfBack)
  const host = useRef<HTMLDivElement>(null);
  const [hs, setHs] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHs({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);
  if (open && renderThread)
    return (
      <div className="relative flex min-h-0 flex-1 flex-col">
        {renderThread(open, { openList: () => onOpen(null), back: () => onOpen(null), banner, openDevice: onDevice })}
      </div>
    );
  const { hall, outside } = dachiZones(threads);
  const lonely = !threads.some((t) => t.id !== 'kimorin' && t.id !== 'mikie') && (me?.journeyDay ?? 0) >= 3;
  // the back stands as in the talk, only on a short screen a little lower, its head no higher than 72% down (so the
  // hall's middle row stays clear of it; the front row keeps out of its way, Strollers' `back`)
  const lift = hs.h ? -Math.max(0, hs.h * 0.72 - (selfBackRects(hs.w, hs.h)[0]?.y ?? hs.h)) : 0;
  const back = hall.length || outside.length ? { rects: selfBackRects(hs.w, hs.h, lift), host } : undefined;
  return (
    <div ref={host} className="relative flex min-h-0 flex-1 flex-col overflow-hidden" data-testid="dachi-tab">
      <div className="absolute inset-x-0 top-0 z-[20]">
        <TabBar title="ダチ" onBack={onBack} banner={banner} onList={() => setHistory(true)} />
      </div>
      {/* R9 (client): the temple's great hall (the ダチ you talk with most, at most 8), and below its front stairs the
          plain (everyone else) — a scroll / swipe down is a smooth camera move between them */}
      <div ref={scroller} className="no-scrollbar absolute inset-0 snap-y snap-mandatory overflow-y-auto overscroll-contain" data-testid="dachi-zones">
        <section className="relative h-full snap-start overflow-hidden" data-zone="hall">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MOON_ZONES.hall} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={{ objectPosition: 'center 30%' }} />
          <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(to bottom,rgba(7,11,36,.55) 0%,rgba(7,11,36,0) 22%,rgba(7,11,36,0) 62%,rgba(7,11,36,.7) 100%)' }} />
          {hall.length ? (
            <Strollers threads={hall} onOpen={onOpen} rowsAt={[0.11, 0.29, 0.355]} eye={MOON_ZONES_EYE.hall} back={back} />
          ) : (
            <div className="absolute inset-x-0 bottom-[14%] z-[5] flex flex-col items-center gap-4 px-8 text-center">
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
          {/* only the story's ダチ so far (KIMORIN⭐︎ is everyone's): the invitation to a real one */}
          {!!hall.length && lonely && (
            <div className="absolute inset-x-0 bottom-[4%] z-[12] flex justify-center">
              <button onClick={() => setInvite(true)} className="rounded-full border border-[rgba(210,220,255,.3)] bg-[rgba(16,22,64,.7)] px-4 py-2 text-[13px] font-bold text-[#f4f1ff] backdrop-blur">
                🤝 ダチの招待状
              </button>
            </div>
          )}
          {/* the way down the stairs: 「みんな」 */}
          {!!outside.length && (
            <button
              onClick={() => scroller.current?.scrollTo({ top: scroller.current.clientHeight, behavior: 'smooth' })}
              className="absolute bottom-[2.5%] left-1/2 z-[12] flex -translate-x-1/2 flex-col items-center text-[12px] font-bold tracking-[0.2em] text-[#f4f1ff]/90 [text-shadow:0_1px_6px_#000]"
              data-testid="dachi-everyone"
            >
              みんな
              <svg viewBox="0 0 24 24" className="h-5 w-5 animate-bounce" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          )}
        </section>
        {!!outside.length && (
          <section className="relative h-full snap-start overflow-hidden" data-zone="outside">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MOON_ZONES.outside} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={{ objectPosition: 'center 60%' }} />
            <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(to bottom,rgba(7,11,36,.45) 0%,rgba(7,11,36,0) 25%,rgba(7,11,36,0) 70%,rgba(7,11,36,.5) 100%)' }} />
            <p className="absolute inset-x-0 top-[13.5%] z-[12] text-center text-[12px] font-bold tracking-[0.3em] text-[#f4f1ff]/80 [text-shadow:0_1px_6px_#000]">みんな</p>
            <Strollers threads={outside} onOpen={onOpen} far ground={0.1} backRow={0.28} eye={MOON_ZONES_EYE.outside} back={back} />
          </section>
        )}
      </div>
      {/* R10 (client): your back in front, over the ダチ (never in the way of a tap); their names stay above it */}
      {back && <SelfBack w={hs.w} h={hs.h} lift={lift} className="z-[18]" />}
      {/* R10: the Bluena device, bottom left, where it sits beside the mic in a talk */}
      {onDevice && <DeviceButton onClick={onDevice} floating />}
      {/* R10: ≡ every ダチ talk, newest first (like a chat app's list) */}
      {history && <DachiHistory onClose={() => setHistory(false)} onOpen={(id) => (setHistory(false), onOpen(id))} />}
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
 * R10 (client): Bluena is a device. Opened from the header's button over whatever is on screen (the Bati chat, the ダチ
 * hall or plain, a ダチ talk) — the place behind blurs; the works float as icons in a column with their short line
 * (what it is called, what it is and when it was made); a tap opens or plays it as Bluena does (WorkSheet). From a talk
 * each work has 〔送る〕: in a ダチ talk it goes to that friend as a work card, in the Bati chat to {bati} as material
 * (as when a work is dragged in). A tap outside or ✕ closes it. Your looks and {bati} are behind 〔姿とバティ〕.
 */
export function BluenaDevice({ onClose, onSend, sendTo }: { onClose: () => void; onSend?: (w: Work) => void; sendTo: 'bati' | 'dachi' }) {
  const { me } = useAuth();
  const ctx = useAtelierCtx();
  const [found, setFound] = useState<Found[] | null>(null);
  const [open, setOpen] = useState<Found | null>(null);
  const [line, setLine] = useState('');
  const [n, setN] = useState(0);
  const [shelf, setShelf] = useState(false);
  // R10: starring lives here only (the works' ★, kept in item_marks as before), with its filter
  const [starOnly, setStarOnly] = useState(false);
  const ring = useMarkRing();
  useMarks();
  useEffect(() => {
    let live = true;
    void findAll(starOnly ? { star: true } : {})
      .then((x) => live && setFound(x))
      .catch(() => live && setFound([]));
    return () => {
      live = false;
    };
  }, [n, starOnly]);
  const send = onSend
    ? (w: Work) => {
        onSend(w);
        onClose();
      }
    : undefined;
  return (
    <div className="absolute inset-0 z-[45] flex flex-col" data-testid="bluena-device" role="dialog" aria-label="ブルーナ">
      <style>{'@keyframes bluena-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}@keyframes bluena-in{from{opacity:0}to{opacity:1}}'}</style>
      {/* the place behind, blurred and dimmed; a tap outside closes */}
      <button aria-label="とじる" onClick={onClose} className="absolute inset-0 cursor-default bg-[rgba(7,11,36,.45)] backdrop-blur-[8px]" style={{ animation: 'bluena-in .3s ease-out both', WebkitBackdropFilter: 'blur(8px)' }} />
      <div className="pointer-events-none relative z-[1] flex min-h-0 flex-1 flex-col pt-safe" style={{ animation: 'bluena-in .3s ease-out both' }}>
        <header className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5">
          <span className="block h-[42px] w-[42px] overflow-hidden rounded-full border border-sky-200/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ui/bluena-icon.webp" alt="" className="h-full w-full scale-[1.3] object-cover" />
          </span>
          <b className="min-w-0 flex-1 truncate text-center text-[15px] font-black tracking-[0.04em] [text-shadow:0_1px_8px_rgba(0,0,0,.5)]">ブルーナ</b>
          <button onClick={onClose} aria-label="とじる" className={GLASS}>
            ✕
          </button>
        </header>
        <div className="pointer-events-auto flex items-center justify-between px-4 pt-1">
          <span className="text-[11px] text-sky-100/80 [text-shadow:0_1px_4px_#000]">{send ? (sendTo === 'dachi' ? '〔送る〕で、この会話に送れるよ' : '〔送る〕で、バティに材料をわたせるよ') : ''}</span>
          <span className="flex items-center gap-1.5">
            <button onClick={() => setStarOnly((v) => !v)} aria-pressed={starOnly} aria-label="お気に入りだけ" className={`h-7 min-w-7 rounded-full border px-2 text-[13px] ${starOnly ? 'border-amber-200/70 bg-amber-300/25' : 'border-[rgba(210,220,255,.3)] bg-[rgba(16,22,64,.6)]'}`} data-testid="bluena-star-filter">
              <span className="text-amber-300">★</span>
            </button>
            <button onClick={() => setShelf(true)} className="rounded-full border border-[rgba(210,220,255,.3)] bg-[rgba(16,22,64,.6)] px-3 py-1 text-[12px] font-bold text-[#f4f1ff] backdrop-blur">
              姿とバティ
            </button>
          </span>
        </div>
        {line && <p className="pt-1 text-center text-[11px] text-sky-100/80 [text-shadow:0_1px_4px_#000]">{line}</p>}
        <div className="no-scrollbar pointer-events-auto min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2">
          {found === null && <p className="py-10 text-center text-xs text-white/60">…</p>}
          {found?.length === 0 && <p className="py-10 text-center text-[13px] text-white/75 [text-shadow:0_1px_4px_#000]">まだ、なにもない</p>}
          <ul className="space-y-3.5">
            {found?.map((x, k) => (
              <li key={`${x.kind}:${x.id}`} className="flex items-center gap-2">
                <button onClick={() => setOpen(x)} className="flex min-w-0 flex-1 items-center gap-3 text-left" data-testid="bluena-work">
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
                  <span className="min-w-0 flex-1 rounded-2xl bg-[rgba(10,14,44,.6)] px-3 py-1.5 backdrop-blur-sm">
                    <span className="block truncate text-[13.5px] font-bold text-[#f4f1ff]">{x.title || x.work.prompt || KIND_WORD[x.work.kind]}</span>
                    <span className="block text-[11px] text-[#c9cff5]/80">
                      {KIND_WORD[x.work.kind]}・{madeWhen(x.createdAt)}
                    </span>
                  </span>
                </button>
                <StarButton kind={x.kind} id={x.id} onRing={(at) => ring.open(x.kind, x.id, at)} />
                {send && (
                  <button onClick={() => send(x.work)} className="shrink-0 rounded-full bg-[rgba(223,230,255,.92)] px-3 py-1.5 text-[12px] font-bold text-[#070b24] shadow-[0_4px_12px_rgba(0,0,0,.35)]" data-testid="bluena-send">
                    送る
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {ring.node}
      {open && (
        <div className="relative z-[2]">
          <WorkSheet found={open} ctx={ctx} onClose={() => setOpen(null)} onLine={setLine} onChanged={() => setN((v) => v + 1)} />
        </div>
      )}
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
 * walking slowly left and right with a small bob, facing the way they walk, stopping now and then. Many: in rows, the
 * back ones higher and smaller (further away). One rAF loop moves them by transform only (no React render per frame:
 * 60 fps on the iPad). Reduced motion: standing, a gentle idle. Their names under their feet; a tap opens the talk; the
 * unread dot by the head. `far`: the plain outside (smaller, more of them).
 */
/** the strollers' box: the lower 78% of the zone (the tab bar above) */
const BOX = 0.78;

/**
 * Where a standing picture's figure begins (its head): the top of its opaque pixels and the middle of that top row, as
 * fractions of the picture, with its natural aspect (width / height) — so the unread dot sits by the head, not in the
 * picture's empty padding. Measured once per picture on a small canvas.
 */
type Head = { top: number; cx: number; aspect: number; /** the figure's opaque box: left, right, bottom (fractions) */ l: number; r: number; b: number };
const HEADS = new Map<string, Head | Promise<Head | null>>();
function headOf(src: string): Promise<Head | null> {
  const got = HEADS.get(src);
  if (got) return Promise.resolve(got);
  const p = new Promise<Head | null>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = 64;
        const h = Math.max(1, Math.round((64 * img.naturalHeight) / Math.max(1, img.naturalWidth)));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d', { willReadFrequently: true });
        if (!g) return resolve(null);
        g.drawImage(img, 0, 0, w, h);
        const d = g.getImageData(0, 0, w, h).data;
        let top = -1;
        let cx = 0.5;
        let l = w;
        let r = -1;
        let b = -1;
        for (let y = 0; y < h; y++) {
          let lo = -1;
          let hi = -1;
          for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) (lo < 0 && (lo = x), (hi = x));
          if (lo < 0) continue;
          if (top < 0) (top = y), (cx = (lo + hi + 1) / 2 / w);
          l = Math.min(l, lo);
          r = Math.max(r, hi);
          b = y;
        }
        if (top < 0) return resolve(null);
        const head = { top: top / h, cx, aspect: img.naturalWidth / Math.max(1, img.naturalHeight), l: l / w, r: (r + 1) / w, b: (b + 1) / h };
        HEADS.set(src, head);
        resolve(head);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
  HEADS.set(src, p as Promise<Head | null>);
  return p;
}
function useHeads(srcs: string[]) {
  const [heads, setHeads] = useState<Record<string, Head>>({});
  const key = srcs.join('|');
  useEffect(() => {
    let live = true;
    for (const src of new Set(srcs))
      void headOf(src).then((h) => {
        if (live && h) setHeads((was) => (was[src] ? was : { ...was, [src]: h }));
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return heads;
}

/** where a figure's picture lies in its W × H box (contained, at the bottom) and the unread dot by its head */
function pictureIn(W: number, H: number, hd: Head | undefined) {
  const dw = hd ? (hd.aspect < W / H ? H * hd.aspect : W) : W;
  const dh = hd ? (hd.aspect < W / H ? H : W / hd.aspect) : H;
  const dot = hd ? { top: H - dh + hd.top * dh, left: (W - dw) / 2 + hd.cx * dw + Math.max(6, W * 0.1) } : { top: H * 0.06, left: W * 0.72 };
  return { dw, dh, dot };
}

function Strollers({ threads, onOpen, far = false, ground = 0.1, backRow = 0.28, eye, rowsAt, back }: {
  threads: ThreadInfo[];
  onOpen: (id: string) => void;
  far?: boolean;
  /** where the front row's feet are, the farthest row's, and the plate's horizon (eye level): fractions of the zone's height from its bottom */
  ground?: number;
  backRow?: number;
  eye: number;
  /** the hall: its three depth rows' feet (front, middle, back), with HALL_ROWS' places in each, instead of ground / backRow */
  rowsAt?: readonly number[];
  /** R10: your back in front (SelfBack): its visible parts in `host`'s coordinates — a row it would cover keeps left of it, and the names keep off it */
  back?: { rects: Rect[]; host: React.RefObject<HTMLDivElement | null> };
}) {
  const box = useRef<HTMLDivElement>(null);
  const els = useRef<(HTMLButtonElement | null)[]>([]);
  const figs = useRef<(HTMLImageElement | null)[]>([]);
  const labs = useRef<(HTMLSpanElement | null)[]>([]);
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
  // the rows (0 = nearest): the hall in three depths by rank (client: the top 2 large in front, ranks 3–6 in the middle,
  // 7–8 far at the back, filled front first); the plain in up to three rows, dealt in turn
  const slots = strollSlots(n, rowsAt ? HALL_ROWS : null);
  const rows = Math.max(1, ...slots.map((x) => x.r + 1));
  const rowOf = (i: number) => slots[i]?.r ?? 0;
  const perRow = (r: number) => slots.filter((x) => x.r === r).length;
  // the plates are eye-level (moon-zone-*): a row further back stands higher, toward the horizon, and is smaller by just
  // as much (its height is in proportion to its feet's distance below the horizon), so they all stand on the floor
  const zoneH = size.h / BOX;
  const at = (r: number) => (rowsAt ? rowsAt[Math.min(r, rowsAt.length - 1)] : ground + (rows > 1 ? ((backRow - ground) * r) / (rows - 1) : 0));
  const feetOf = (r: number) => zoneH * at(r);
  const scaleOf = (r: number) => (eye - at(r)) / (eye - at(0));
  // your back, in this box's coordinates once the zone fills the screen (the box is the zone's lower BOX)
  const backRects = (back?.rects ?? []).map((q) => ({ ...q, y: q.y - zoneH * (1 - BOX) }));
  // a row the back would cover walks only left of it (a figure may reach a third of its width behind it)
  const widthOf = (r: number, h0: number) => {
    const H = h0 * scaleOf(r);
    const top = size.h - feetOf(r) - H;
    const bottom = size.h - feetOf(r);
    let right = size.w;
    for (const q of backRects) if (q.y < bottom - H * 0.15 && q.y + q.h > top) right = Math.min(right, q.x + H * 0.62 * 0.3);
    return Math.max(size.w * 0.55, right);
  };
  // as tall as the ground allows, but never wider than a figure's own stretch in its row (they must not stand on each other)
  const tall = (wOf: (r: number) => number) => {
    const fit = Math.min(...Array.from({ length: rows }, (_, r) => ((wOf(r) / Math.max(1, perRow(r))) * 1.25) / 0.62 / scaleOf(r)));
    return Math.round(Math.min(zoneH * (eye - at(0)) * (far ? 0.55 : 0.47), far ? 220 : 320, fit));
  };
  const H1 = tall(() => size.w);
  const rowW = Array.from({ length: rows }, (_, r) => widthOf(r, H1));
  const H0 = tall((r) => rowW[r]);
  const key = threads.map((t) => t.id).join('|');
  const heads = useHeads(threads.map(standOf));
  const headsRef = useRef(heads);
  headsRef.current = heads;
  const rowWKey = rowW.map((x) => Math.round(x)).join(',');
  useEffect(() => {
    if (!size.w || !H0) return;
    // the names, in a layer of their own above every figure (and above your back): under each one's feet, and where
    // that would lie on another figure, another name or your back, beside it, above its head or higher (lib/talk/labels)
    const xs: number[] = [];
    const dirs: number[] = [];
    const place = (i: number, x: number, bob: number, dir: number, half: number) => {
      const b = els.current[i];
      const f = figs.current[i];
      if (b) b.style.transform = `translate3d(${(x - half).toFixed(1)}px, ${bob.toFixed(1)}px, 0)`;
      if (f) f.style.transform = dir < 0 ? 'scaleX(-1)' : 'none';
      xs[i] = x;
      dirs[i] = dir;
    };
    const sizes: { w: number; h: number }[] = [];
    let prev: (LabelSpot | undefined)[] = [];
    const order = threads.map((_, i) => i).sort((a, b) => rowOf(a) - rowOf(b) || a - b);
    const bodyOf = (i: number): Rect => {
      const r = rowOf(i);
      const H = Math.round(H0 * scaleOf(r));
      const W = Math.round(H * 0.62);
      const feet = size.h - feetOf(r);
      const hd = headsRef.current[standOf(threads[i])];
      const { dw, dh, dot } = pictureIn(W, H, hd);
      const left = xs[i] - W / 2;
      let body: Rect;
      if (hd) {
        const [l, rr] = dirs[i] < 0 ? [1 - hd.r, 1 - hd.l] : [hd.l, hd.r];
        const px = left + (W - dw) / 2;
        const py = feet - dh;
        body = { x: px + l * dw, y: py + hd.top * dh, w: (rr - l) * dw, h: (hd.b - hd.top) * dh };
      } else body = { x: xs[i] - W * 0.3, y: feet - H * 0.95, w: W * 0.6, h: H * 0.95 };
      if (threads[i].unread) {
        // the unread dot (14 px, by the head) is part of the figure
        const d = { x: left + dot.left - 7, y: feet - H + Math.max(0, dot.top - 4), w: 14, h: 14 };
        const x0 = Math.min(body.x, d.x);
        const y0 = Math.min(body.y, d.y);
        body = { x: x0, y: y0, w: Math.max(body.x + body.w, d.x + d.w) - x0, h: Math.max(body.y + body.h, d.y + d.h) - y0 };
      }
      return body;
    };
    const names = () => {
      const figsNow: LabelFig[] = [];
      for (let i = 0; i < threads.length; i++) {
        const l = labs.current[i];
        if (!l || xs[i] == null) continue;
        if (!sizes[i]?.w) sizes[i] = { w: l.offsetWidth, h: l.offsetHeight };
        figsNow[i] = { cx: xs[i], feet: size.h - feetOf(rowOf(i)), body: bodyOf(i), w: sizes[i].w, h: sizes[i].h };
      }
      // your back where it is now (it stays put while the zones scroll under it)
      let soft: Rect[] = [];
      const hostEl = back?.host.current;
      if (back?.rects.length && hostEl && box.current) {
        const a = box.current.getBoundingClientRect();
        const o = hostEl.getBoundingClientRect();
        soft = back.rects.map((q) => ({ ...q, x: q.x + o.left - a.left, y: q.y + o.top - a.top }));
      }
      (window as unknown as Record<string, unknown>)[far ? "__dachiPlain" : "__dachiLabels"] = { figsNow, soft, w: size.w, h: size.h, prev };
      prev = placeLabels(figsNow, { width: size.w, height: size.h, soft, prev, order: order.filter((i) => figsNow[i]) });
      prev.forEach((sp, i) => {
        const l = labs.current[i];
        if (l && sp) l.style.transform = `translate3d(${sp.x.toFixed(1)}px, ${sp.y.toFixed(1)}px, 0)`;
      });
    };
    const st = threads.map((_, i) => {
      const { r, k } = slots[i];
      const w = rowW[r] ?? size.w;
      const lane = w / Math.max(1, perRow(r));
      const half = (H0 * scaleOf(r) * 0.62) / 2;
      // the hall's big front pair strolls only a little, in the gaps between the middle row (so it never stands on their names)
      // and the far pair near the back of the hall, either side of the entrance (the middle of the picture)
      const farPair = !!rowsAt && rows === 3 && r === 2;
      const roam = rowsAt && r === 0 && rows > 1 ? lane * 0.14 : farPair ? size.w * 0.05 : null;
      const mid = farPair ? size.w * (0.5 + (k - (perRow(r) - 1) / 2) * 0.3) : lane * (k + 0.5);
      return { r, lane, half, w, lo: roam ? mid - roam - half : lane * k, hi: roam ? mid + roam + half : lane * (k + 1), roam: !!roam, x: mid + (!rowsAt && r % 2 ? lane * 0.25 : 0), dir: i % 2 ? -1 : 1, pause: 0.6 + (i % 5) * 0.6, speed: (14 + ((i * 7) % 5) * 2) * scaleOf(r), t: i * 1.7 };
    });
    if (reduced) {
      st.forEach((s, i) => place(i, Math.max(s.half, Math.min(s.w - s.half, s.x)), 0, 1, s.half));
      names();
      // (the names keep clear of your back as the zones scroll)
      const sc = box.current?.closest('[data-testid=dachi-zones]');
      const onScroll = () => names();
      sc?.addEventListener('scroll', onScroll, { passive: true });
      return () => sc?.removeEventListener('scroll', onScroll);
    }
    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      st.forEach((s, i) => {
        // each in its own stretch, the figure's half-width kept inside it (and inside the screen, left of your back)
        const lo = Math.max(s.half + 6, s.lo + (s.roam ? s.half : Math.min(s.half, s.lane * 0.3)));
        const hi = Math.min(s.w - s.half - 6, s.hi - (s.roam ? s.half : Math.min(s.half, s.lane * 0.3)));
        let walking = false;
        if (s.pause > 0) s.pause -= dt;
        else if (hi - lo < 8) s.x = (lo + hi) / 2;
        else {
          walking = true;
          s.t += dt;
          s.x += s.dir * s.speed * dt;
          if (s.x <= lo || s.x >= hi) {
            s.x = Math.max(lo, Math.min(hi, s.x));
            s.dir = -s.dir;
            s.pause = 0.9 + Math.random() * 1.8;
          } else if (Math.random() < dt * 0.12) s.pause = 0.8 + Math.random() * 1.6;
        }
        place(i, s.x, walking ? -Math.abs(Math.sin(s.t * 5.2)) * 4 * scaleOf(s.r) : 0, s.dir, s.half);
      });
      names();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, size.w, size.h, H0, reduced, rowWKey, back?.rects.map((q) => q.y.toFixed(0)).join(',')]);
  return (
    <div ref={box} className="absolute inset-x-0 bottom-0" style={{ top: `${(1 - BOX) * 100}%` }} data-testid={far ? 'dachi-outside' : 'dachi-strollers'}>
      <style>{'@keyframes dachi-idle{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.012)}}'}</style>
      {threads.map((t, i) => {
        const r = rowOf(i);
        const H = Math.round(H0 * scaleOf(r));
        const W = Math.round(H * 0.62);
        // the unread dot by the head: the picture is contained at the bottom of its W × H box
        const { dot } = pictureIn(W, H, heads[standOf(t)]);
        return (
          <button
            key={t.id}
            ref={(el) => void (els.current[i] = el)}
            onClick={() => onOpen(t.id)}
            aria-label={`${t.name}と話す`}
            className="absolute left-0 flex flex-col items-center will-change-transform"
            style={{ bottom: feetOf(r), width: W, zIndex: 10 - r, filter: r ? `brightness(${1 - r * 0.1})` : undefined, transform: `translate3d(${((rowW[r] ?? size.w) / Math.max(1, perRow(r))) * ((slots[i]?.k ?? 0) + 0.5) - W / 2}px,0,0)` }}
          >
            <span className="relative block" style={{ width: W, height: H, animation: reduced ? 'dachi-idle 4.5s ease-in-out infinite' : undefined, transformOrigin: '50% 100%' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={(el) => void (figs.current[i] = el)} src={standOf(t)} alt="" draggable={false} className="h-full w-full select-none object-contain object-bottom drop-shadow-[0_8px_10px_rgba(0,0,0,.35)]" />
              {!!t.unread && <span className="absolute h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-[#0b1027] bg-sky-300" style={{ top: Math.max(0, dot.top - 4), left: dot.left }} aria-label="まだ聞いていない" />}
            </span>
            {/* the shadow on the ground (the name is in the layer above) */}
            <span className="-mt-2 block h-2 rounded-[50%] bg-black/35 blur-[2px]" style={{ width: W * 0.55 }} aria-hidden />
          </button>
        );
      })}
      {/* the names, above every figure and your back; placed each frame so none lies on a figure or another name */}
      {threads.map((t, i) => (
        <span
          key={`n-${t.id}`}
          ref={(el) => void (labs.current[i] = el)}
          className={`pointer-events-none absolute left-0 top-0 z-[19] max-w-[40%] truncate whitespace-nowrap rounded-full bg-[rgba(10,14,44,.72)] px-2 py-0.5 font-bold text-[#f4f1ff] backdrop-blur will-change-transform ${far || rowOf(i) ? 'text-[10px]' : 'text-[11px]'}`}
          style={{ transform: `translate3d(${((rowW[rowOf(i)] ?? size.w) / Math.max(1, perRow(rowOf(i)))) * ((slots[i]?.k ?? 0) + 0.5)}px,${(size.h - feetOf(rowOf(i)) + 3).toFixed(1)}px,0)` }}
          aria-hidden
        >
          {t.name}
        </span>
      ))}
    </div>
  );
}
