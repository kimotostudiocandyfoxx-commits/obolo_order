'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { KINDS, type AtelierKind } from '@/lib/atelier/unlock';
import { useAuth } from '@/lib/auth';
import { usePartner } from '@/lib/partner';
import { BluenaDevice, DachiTab, MoonTabs, tabOf, type MoonTab } from './MoonTabs';
import type { Work } from './work';
import { BluenaView, type ViewItem } from './BluenaView';
import { MiniPlayer } from './MiniPlayer';
import { useAtelierCtx } from './ctx';
import { editWithBati, VIEW_EVENT, type ViewAsk } from '@/lib/bluena/edit';
import { hasBluena, Shell } from './Shell';
import { dachiLinkOf, threadsInDrawer, type RenderThread, type ThreadInfo } from './threads';

/** the old atelier kinds a link may still carry (?kind=…) → what the chat asks for */
const OLD: Record<string, AtelierKind> = { voice: 'voice', art: 'art', song: 'song', video: 'video', radio: 'radio' };
const kindOf = (k: string | null): AtelierKind | null => (k && (KINDS as string[]).includes(k) ? (k as AtelierKind) : k ? (OLD[k] ?? null) : null);

/**
 * 月で作る (/moon/atelier). Since M-R210/M-R211 it is one {bati} chat with the same look for everything (AtelierChat):
 * Bluena's gate opens, and you ask {bati} in words. Coming with ?kind=… (a Bluena folder's 〔月で作る〕, Saturn's
 * 〔つぶやく〕) {bati} asks for that kind at once — or says on which day it opens. Other conversations (ダチ) plug in through
 * `threads` / `renderThread` (threads.ts). Making happens only here (M-R208),
 * and it does not use the day's 88 minutes (§13).
 * Client 2026-11-24: a small segmented control under the bar — {bati} | ダチ | ブルーナ (?tab=dachi|bluena, ?dachi=<id>
 * for the open ダチ talk), so back and refresh keep the place. {bati}'s chat stays mounted under the other tabs (its talk
 * goes on where it was).
 */
export function MoonAtelier({ threads, renderThread }: { threads?: ThreadInfo[]; renderThread?: RenderThread } = {}) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname() ?? '/moon/atelier';
  const { me } = useAuth();
  const partner = usePartner();
  const [gate, setGate] = useState(true);
  const bluena = hasBluena(me);
  // R10 (client): Bluena is a device, not a tab — ダチ | {bati}; an old ?tab=bluena link opens the device over {bati}
  const asked = tabOf(params.get('tab'));
  const tab: MoonTab = asked === 'bluena' ? 'bati' : asked;
  const dachi = tab === 'dachi' ? params.get('dachi') : null;
  const [device, setDevice] = useState(false);
  // R15: {bati}'s chat holds {bati}'s talks only — a ?thread=<a ダチ> link (an old drawer's, the tester bar's) opens it in
  // the ダチ tab
  const dachiLink = dachiLinkOf(params.get('thread'));
  useEffect(() => {
    if (dachiLink) router.replace(`${path}?tab=dachi&dachi=${encodeURIComponent(dachiLink)}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dachiLink]);
  useEffect(() => {
    if (params.get('tab') !== 'bluena') return;
    if (bluena) setDevice(true);
    router.replace(path, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const openDevice = bluena ? () => setDevice(true) : undefined;
  /** from a talk, each work can be sent: to the ダチ of the open talk, or to {bati} as material (the drag-a-work-in path) */
  const sendTo: ((w: Work) => void) | undefined = tab === 'dachi' ? (dachi ? (w) => window.dispatchEvent(new CustomEvent('obolo:dachi-send', { detail: { to: dachi, work: w } })) : undefined) : (w) => window.dispatchEvent(new CustomEvent('obolo:material', { detail: w }));
  // R16: a work opened from Bluena (a tap, or {bati} asked 「〇〇流して」) — its viewer over everything; the ones opened are
  // remembered so the corner player opens its song again
  const [view, setView] = useState<ViewAsk | null>(null);
  const viewed = useRef(new Map<string, ViewItem>());
  const show = (a: ViewAsk) => {
    viewed.current.set(a.item.key, a.item);
    setView(a);
  };
  useEffect(() => {
    const on = (e: Event) => {
      const a = (e as CustomEvent<ViewAsk>).detail;
      if (a?.item) show(a);
    };
    window.addEventListener(VIEW_EVENT, on);
    return () => window.removeEventListener(VIEW_EVENT, on);
  }, []);
  const ctx = useAtelierCtx();
  /** 〔バティといじる〕: to {bati}'s talk, the work on the table */
  const edit = (w: Work) => {
    setView(null);
    setDevice(false);
    if (tab !== 'bati') go('bati');
    editWithBati(w);
  };

  // the gate plays once per visit; reduced motion → straight in
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return setGate(false);
    const t = setTimeout(() => setGate(false), 1500);
    return () => clearTimeout(t);
  }, []);

  /** a tab / a ダチ talk is a step in the history (back returns to it); the one-time links (?kind, ?job …) are dropped */
  const go = (t: MoonTab, with_: string | null = null) => {
    const q = new URLSearchParams();
    if (t !== 'bati') q.set('tab', t);
    if (t === 'dachi' && with_) q.set('dachi', with_);
    const s = q.toString();
    router.push(s ? `${path}?${s}` : path, { scroll: false });
  };
  const banner = <MoonTabs tab={tab} bati={partner.name} unread={threads?.some((t) => !!t.unread)} onTab={(t) => go(t)} />;
  const back = () => router.back();
  // a ダチ talk opened here goes back by the history; one opened by a link / a refresh goes to the row in its place
  const openedHere = useRef(false);
  const openDachi = (id: string | null) => {
    if (id) {
      openedHere.current = true;
      return go('dachi', id);
    }
    if (openedHere.current) {
      openedHere.current = false;
      return router.back();
    }
    router.replace(`${path}?tab=dachi`, { scroll: false });
  };

  return (
    <main className="pt-safe relative mx-auto flex h-svh max-w-xl flex-col overflow-hidden bg-[radial-gradient(130%_70%_at_50%_0%,#1d2a52_0%,#0b1027_55%,#05060f_100%)] text-amber-50">
      {/* one bar: the talk's own (← back, the conversations, {bati}, Bluena) with the tabs under it — no page header above */}
      <div className={tab === 'dachi' ? 'hidden' : 'relative flex min-h-0 flex-1 flex-col'} data-testid="bati-place">
        <Shell first={kindOf(params.get('kind'))} onBack={back} banner={banner} onDevice={openDevice} open={(params.get('thread') && !dachiLink) || params.get('job') ? { thread: 'bati', day: params.get('day') ?? undefined, at: params.get('at') ?? undefined, job: params.get('job') ?? undefined } : undefined} />
      </div>
      {tab === 'dachi' && <DachiTab threads={threadsInDrawer('dachi', { name: partner.name }, threads ?? [])} open={dachi} onOpen={openDachi} onBack={back} banner={banner} renderThread={renderThread} onDevice={openDevice} />}
      {/* R10: the Bluena device, over whatever is open (the place behind blurs); from a talk each work can be sent */}
      {device && <BluenaDevice onClose={() => setDevice(false)} onSend={sendTo} sendTo={tab === 'dachi' ? 'dachi' : 'bati'} onView={(item) => show({ item })} />}
      {/* R16: the song goes on in the corner when its viewer is closed */}
      <MiniPlayer onOpen={(id) => {
        const item = viewed.current.get(id.split('#')[0]);
        if (item) show({ item });
      }} />
      {view && (
        <BluenaView
          key={view.item.key}
          item={view.item}
          ctx={ctx}
          autoplay={view.autoplay}
          autoOpen={view.autoOpen}
          onClose={() => setView(null)}
          onEdit={edit}
          onSend={sendTo ? (w) => (sendTo(w), setView(null), setDevice(false)) : undefined}
        />
      )}
      {gate && <Gate onSkip={() => setGate(false)} />}
    </main>
  );
}

/** Bluena's gate opens and a square screen widens into the atelier (no new pictures: shapes and light only) */
function Gate({ onSkip }: { onSkip: () => void }) {
  return (
    <button onClick={onSkip} aria-label="月へ入る" className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#03040b]">
      <span className="absolute h-[70vmin] w-[70vmin] animate-[atelier-glow_1.5s_ease-out_forwards] rounded-full bg-[radial-gradient(circle,rgba(140,210,255,0.55),rgba(80,140,255,0.15)_45%,transparent_70%)]" />
      {/* the square screen */}
      <span className="absolute aspect-square w-[62vmin] animate-[atelier-screen_1.5s_cubic-bezier(.6,0,.3,1)_forwards] rounded-3xl border border-sky-100/50 bg-[radial-gradient(130%_70%_at_50%_0%,#1d2a52_0%,#0b1027_70%)] shadow-[0_0_60px_rgba(120,200,255,0.5)]" />
      {/* the two doors of the gate */}
      <span className="absolute left-0 top-0 h-full w-1/2 animate-[atelier-door-l_1.5s_cubic-bezier(.7,0,.3,1)_forwards] border-r border-sky-200/40 bg-gradient-to-l from-[#0e1840] to-[#03040b]" />
      <span className="absolute right-0 top-0 h-full w-1/2 animate-[atelier-door-r_1.5s_cubic-bezier(.7,0,.3,1)_forwards] border-l border-sky-200/40 bg-gradient-to-r from-[#0e1840] to-[#03040b]" />
      <span className="absolute h-16 w-16 animate-[atelier-key_1.5s_ease-out_forwards] overflow-hidden rounded-full border border-sky-200/60 shadow-[0_0_30px_rgba(140,220,255,0.9)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ui/bluena-icon.webp" alt="" className="h-full w-full scale-125 object-cover" />
      </span>
    </button>
  );
}
