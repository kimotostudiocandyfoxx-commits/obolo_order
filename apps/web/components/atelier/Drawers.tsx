'use client';

import { useEffect, useRef, useState } from 'react';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { AtelierKind } from '@/lib/atelier/unlock';
import { HOME_OF_WORK, PLANET_HOMES, BLUENA_PLANETS, type BluenaPlanet, type MarkedKind, type TalkDayView } from '@obolo/shared';
import { PlanetMark } from '@/components/bluena/PlanetMark';
import { planetOpen } from '@/components/bluena/BluenaOrbit';
import { Glyph, GLYPH_NAMES } from '@/components/bluena/glyphs';
import { BatiShelf } from '@/components/bati/BatiShelf';
import { MarkNamesSheet, GearGlyph } from '@/components/finds/MarkNames';
import { StarButton, useMarkRing } from '@/components/finds/MarkRing';
import { SpiralList, type FindFilter, type SpiralRow } from '@/components/finds/SpiralList';
import { useMarks } from '@/lib/finds/marks';
import { findAll, KIND_PLANET, PLANET_COLOR, PLANET_GLYPH, PLANET_NAME, workMarkRef, type Found } from '@/lib/finds/works';
import { batiTalkDays } from '@/lib/finds/talks';
import { BATI_COLOR, colorOf, SELF_COLOR } from '@/lib/talk/looks';
import { discard, fly, type Ctx } from './makers';
import { shelf, talks, type Talk } from './shelf';
import type { ThreadInfo } from './threads';
import { KindMark, usePlay } from './WorkCard';
import { FLIES, type Work } from './work';

/** a picture that may live in this browser (the demo keeps uploads as idb:) */
function Img({ src, className }: { src: string; className?: string }) {
  const [url, setUrl] = useState(src.startsWith('idb:') ? '' : src);
  useEffect(() => {
    if (!src.startsWith('idb:')) return setUrl(src);
    let made = '';
    void import('@/lib/api/idb').then(async ({ getBlob }) => {
      const b = await getBlob(src.slice(4));
      if (b) setUrl((made = URL.createObjectURL(b)));
    });
    return () => void (made && URL.revokeObjectURL(made));
  }, [src]);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" className={className} /> : <span className={`block bg-white/10 ${className ?? ''}`} />;
}

/** what is in Bluena for one kind: the planets' own stores (the same items the planet's 「自分の場所」 shows), or this device */
async function load(kind: AtelierKind, meId: string | undefined, live: boolean, avatar?: string | null): Promise<Work[]> {
  const api = getApi();
  const w = (x: Partial<Work> & { id: string }): Work => ({ kind, prompt: '', status: 'ready', saved: true, ...x });
  if (kind === 'voice') {
    if (!meId) return [];
    const p = await api.saturnUserPosts(meId);
    return p.items.filter((x) => !x.replyToId).map((x) => w({ id: x.id, title: x.text, audio: x.voiceUrl, ref: { postId: x.id }, flown: !x.room }));
  }
  if (kind === 'art') return (await api.jupiterRoots()).filter((r) => r.kind === 'photo').map((r) => w({ id: r.id, image: r.url, ref: { rootId: r.id } }));
  if (kind === 'song' && live) return (await api.savedSongs()).map((s) => w({ id: s.id, title: s.title, audio: s.url, ref: { songId: s.id }, flown: s.posted }));
  if (kind === 'video') return (await api.marsBackstage()).map((v) => w({ id: v.id, title: v.title || '映像', video: v.url, poster: v.posterUrl, ref: { backstageId: v.id } }));
  if (kind === 'radio') return (await api.myRadioShows()).map((s) => w({ id: s.id, title: s.title, audio: s.audioUrl, ref: { showId: s.id }, flown: s.status === 'public' }));
  const kept = shelf().filter((x) => x.kind === kind);
  // the face shelf starts with the look worn now (made on day 2, M-R212) when it is not one kept here
  if (kind === 'look' && avatar && !kept.some((x) => x.image === avatar)) return [w({ id: 'profile', image: avatar, worn: true }), ...kept];
  return kept;
}

/** the Moon: your looks, {bati}'s cards and dress-ups, lookups and pictures (kept on this device) */
export function MoonShelf({ kinds, ctx, onOrigin }: { kinds: AtelierKind[]; ctx: Ctx; onOrigin?: (w: Work) => boolean }) {
  const { me } = useAuth();
  const [kind, setKind] = useState<AtelierKind | null>(kinds[0] ?? null);
  const [items, setItems] = useState<Work[] | null>(null);
  const [n, setN] = useState(0);
  const ring = useMarkRing();
  useEffect(() => {
    if (!kind) return;
    setItems(null);
    load(kind, me?.id, ctx.live, me?.avatarUrl)
      .then(setItems)
      .catch(() => setItems([]));
  }, [kind, me?.id, me?.avatarUrl, ctx.live, n]);
  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
      <BatiShelf />
      <div className="flex flex-wrap gap-1.5 border-b border-white/10 pb-2" role="tablist">
        {kinds.map((k) => (
          <button key={k} role="tab" aria-selected={k === kind} onClick={() => setKind(k)} className={`flex h-10 w-10 items-center justify-center rounded-xl ${k === kind ? 'bg-sky-300/25 text-sky-100 shadow-[0_0_12px_rgba(140,220,255,0.35)]' : 'text-white/55'}`}>
            <KindMark kind={k} />
          </button>
        ))}
      </div>
      <div className="mt-2 space-y-2 pb-6">
        {items === null && <p className="py-8 text-center text-xs text-white/45">…</p>}
        {items?.length === 0 && <p className="py-8 text-center text-xs text-white/45">まだ、なにもない</p>}
        {items?.map((it) => (
          <Item key={it.id} w={it} onOrigin={onOrigin && it.origin ? () => onOrigin(it) : undefined} onRing={(at) => ring.open('local', it.id, at)} onDiscard={it.id === 'profile' ? undefined : () => confirm('ブルーナから捨てる？') && void discard(it).then(() => setN((x) => x + 1))} />
        ))}
      </div>
      {ring.node}
    </div>
  );
}

/** one work opened from Bluena's list: play it, fly it, throw it away, back to the talk it was made in */
export function WorkSheet({ found: open, ctx, onClose, onLine, onChanged, onOrigin, onMaterial }: { found: Found; ctx: Ctx; onClose: () => void; onLine?: (l: string) => void; onChanged?: () => void; onOrigin?: (w: Work) => boolean; onMaterial?: (w: Work) => void }) {
  const { me } = useAuth();
  const ring = useMarkRing();
  const act = async (fn: () => Promise<void>, ok: string) => {
    try {
      await fn();
      onLine?.(ok);
      onClose();
      onChanged?.();
    } catch {
      onLine?.('うまくいかなかった…');
    }
  };
  const w = { ...open.work, origin: open.work.origin ?? open.origin ?? undefined, atelierId: open.work.atelierId ?? open.atelierId };
  return (
    <div className="absolute inset-x-2 bottom-3 z-20 rounded-2xl border border-white/10 bg-[#121a3a]/95 p-1 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] backdrop-blur">
      <Item
        w={w}
        onRing={(at) => ring.open(open.kind, open.id, at)}
        markRef={{ kind: open.kind, id: open.id }}
        tries={open.versionCount ?? w.versions?.length}
        onOrigin={onOrigin && w.origin ? () => onOrigin(w) : undefined}
        onDragOut={onMaterial ? () => onMaterial(w) : undefined}
        onFly={FLIES[w.kind] && !w.flown && (w.kind !== 'song' || ctx.live || !!w.ref?.demoSong) ? () => void act(() => fly(w, ctx), flownLine(w.kind, me?.displayName)) : undefined}
        onDiscard={w.kind === 'song' && ctx.live ? undefined : () => confirm('ブルーナから捨てる？') && void act(() => discard(w), '捨てた')}
      />
      <button onClick={onClose} aria-label="とじる" className="absolute -top-3 left-1/2 flex h-6 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-white/10 bg-[#121a3a] text-white/60">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {ring.node}
    </div>
  );
}

function Item({ w, onFly, onDiscard, onRing, markRef, tries, onOrigin, onDragOut }: { w: Work; onFly?: () => void; onDiscard?: () => void; onRing?: (at: { x: number; y: number }) => void; markRef?: { kind: MarkedKind; id: string }; /** M-R253 §1: tries inside the work */ tries?: number; /** §5: to the talk it was made in */ onOrigin?: () => void; /** §3: dragged out of Bluena (into the chat) */ onDragOut?: () => void }) {
  const ref = markRef ?? workMarkRef(w);
  const [on, toggle] = usePlay(w);
  const planet = FLIES[w.kind];
  // §3: drag the picture out of the drawer (to the left, into the chat) → material
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number; edge: number } | null>(null);
  const pic = w.image ?? w.poster ?? null;
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white/[0.06] p-2">
      <div
        className={`h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-black/30 text-amber-100/70 ${onDragOut ? 'cursor-grab touch-none' : ''}`}
        data-testid={onDragOut ? 'drag-material' : undefined}
        onPointerDown={(e) => {
          if (!onDragOut) return;
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          const aside = (e.currentTarget as HTMLElement).closest('aside');
          start.current = { x: e.clientX, y: e.clientY, edge: aside?.getBoundingClientRect().left ?? 0 };
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) setGhost({ x: e.clientX, y: e.clientY });
        }}
        onPointerUp={(e) => {
          const s0 = start.current;
          start.current = null;
          setGhost(null);
          if (s0 && onDragOut && e.clientX < s0.edge) onDragOut();
        }}
        onPointerCancel={() => ((start.current = null), setGhost(null))}
      >
        {w.image ? <Img src={w.image} className="h-full w-full object-cover" /> : w.poster ? <Img src={w.poster} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center"><KindMark kind={w.kind} /></span>}
      </div>
      {ghost && (
        <span className="pointer-events-none fixed z-[80] block h-14 w-14 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border-2 border-sky-200 bg-[#121a3a] opacity-90 shadow-[0_0_20px_rgba(140,220,255,.7)]" style={{ left: ghost.x, top: ghost.y }}>
          {pic ? <Img src={pic} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-amber-100"><KindMark kind={w.kind} /></span>}
        </span>
      )}
      <button className="min-w-0 flex-1 text-left" onClick={onOrigin} disabled={!onOrigin} aria-label={onOrigin ? '作った時の会話へ' : undefined}>
        <p className="line-clamp-2 text-[12px] leading-snug">{w.title || w.text || w.prompt}</p>
        <span className="flex items-center gap-1.5">
          {w.flown && planet && <PlanetMark id={planet} size={12} />}
          {!!tries && tries > 1 && <span className="text-[10px] text-sky-100/60">試し {tries}</span>}
          {onOrigin && <span className="text-[10px] text-amber-100/60 underline">作った時の会話</span>}
        </span>
      </button>
      <StarButton kind={ref.kind} id={ref.id} onRing={onRing} />
      {(w.audio || w.ref?.demoSong) && (
        <button onClick={() => void toggle()} aria-label={on ? '止める' : '再生'} className="h-8 w-8 shrink-0 rounded-full bg-white/15 text-xs">
          {on ? '❚❚' : '▶'}
        </button>
      )}
      {w.video && (
        <a href={w.video} target="_blank" rel="noreferrer" aria-label="再生" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs">
          ▶
        </a>
      )}
      {onFly && planet && (
        <button onClick={onFly} aria-label="星へ飛ばす" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-300">
          <PlanetMark id={planet} size={16} />
        </button>
      )}
      {onDiscard && (
        <button onClick={onDiscard} aria-label="捨てる" className="h-8 w-8 shrink-0 rounded-full bg-black/40 text-xs text-white/60">
          ✕
        </button>
      )}
    </div>
  );
}

/**
 * The conversations on the left (M-R212 → M-R237): while there are few, the threads ({bati} first, the ダチ, the group,
 * the order's news …) are a ring of faces to turn through (choosing = round); more than eight, a list. The chosen
 * thread's past talk is the spiral and the list (one dot / row = one day, the dot in the colour of who spoke the most;
 * the row: the date, the day's first words, ★, mark), with the strip and the search box. A row opens that day in the
 * side-by-side talk; 〔話す〕 opens the thread itself.
 */
export function ThreadsDrawer({
  bati,
  threads,
  current,
  onThread,
  onNew,
  onDay,
  onClose,
  extra,
}: {
  bati: { name: string; face: string };
  threads: ThreadInfo[];
  current: string;
  talkId?: string;
  onThread: (id: string) => void;
  onTalk?: (t: Talk) => void;
  onNew: () => void;
  /** open one day of a thread's past talk */
  onDay: (thread: string, day: string) => void;
  onClose: () => void;
  /** above the threads (a talk's settings, the looks …) */
  extra?: React.ReactNode;
}) {
  // R9 (client): KIMORIN⭐︎ lives in the ダチ tab, not in this drawer
  const all = [{ id: 'bati', name: bati.name, avatar: bati.face }, ...threads.filter((t) => t.id !== 'bati' && t.id !== 'kimorin')];
  const [sel, setSel] = useState(current || 'bati');
  const [filter, setFilter] = useState<FindFilter>({});
  const [days, setDays] = useState<TalkDayView[] | null>(null);
  const ring = all.length <= 8;
  useMarks();
  const key = JSON.stringify(filter);
  useEffect(() => {
    let live = true;
    setDays(null);
    const f = { star: filter.star, mark: filter.mark, q: filter.q };
    if (sel === 'bati') setDays(batiTalkDays(talks(), f));
    else
      void getApi()
        .findTalkDays({ thread: sel, ...f })
        .then((d) => live && setDays(d))
        .catch(() => live && setDays([]));
    return () => {
      live = false;
    };
  }, [sel, key]);
  const colorFor = (who: string) => (who === 'me' ? SELF_COLOR : who === 'bati' ? BATI_COLOR : colorOf(who));
  const rows: SpiralRow[] | null =
    days?.map((d) => ({
      id: d.day,
      at: `${d.day}T12:00:00`,
      color: colorFor(d.speakers[0] ?? 'me'),
      title: d.first || '♪ 声',
      sub: d.day.slice(5).replace('-', '/'),
      stars: d.stars,
      markId: d.mark,
    })) ?? null;
  const pick = all.find((t) => t.id === sel) ?? all[0];
  return (
    <Drawer side="left" onClose={onClose} label="会話">
      {extra}
      {ring ? (
        <ThreadRing all={all} sel={sel} onPick={(id) => (id === sel ? onThread(id) : setSel(id))} />
      ) : (
        <div className="no-scrollbar max-h-[34%] shrink-0 space-y-1 overflow-y-auto">
          {all.map((t) => (
            <button key={t.id} onClick={() => setSel(t.id)} className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left ${t.id === sel ? 'bg-amber-200/15' : ''}`}>
              <Face src={t.avatar} name={t.name} size={34} />
              <span className="min-w-0 flex-1 truncate text-[13px]">{t.name}</span>
              {!!(t as ThreadInfo).unread && <span className="h-2 w-2 shrink-0 rounded-full bg-sky-300" aria-label="新しいメッセージ" />}
            </button>
          ))}
        </div>
      )}
      <div className="flex shrink-0 items-center gap-2 py-2">
        <p className="min-w-0 flex-1 truncate text-[13px] tracking-[0.12em] text-amber-100/90">{pick.name}</p>
        {sel === 'bati' && (
          <button onClick={onNew} aria-label="新しく話す" className="rounded-full border border-amber-200/30 px-2.5 py-1 text-[11.5px] text-amber-100/85">
            ＋
          </button>
        )}
        <button onClick={() => onThread(sel)} className="rounded-full bg-amber-200/90 px-3 py-1 text-[11.5px] font-bold text-[#1b1208]">
          話す
        </button>
      </div>
      <SpiralList rows={rows} filter={filter} onFilter={setFilter} onRow={(r) => onDay(sel, r.id)} empty={filter.star || filter.mark || filter.q ? '見つからなかった' : 'まだ、話していない'} search="さがす" noSpiral />
    </Drawer>
  );
}

/** the threads as a ring of faces (few to choose from: round, M-R236 §1); a drag turns it, a tap on the chosen one opens it */
export function ThreadRing({ all, sel, onPick }: { all: { id: string; name: string; avatar?: string; unread?: number }[]; sel: string; onPick: (id: string) => void }) {
  const [spin, setSpin] = useState(0);
  const drag = useRef<{ x: number; spin: number; moved: number } | null>(null);
  const n = all.length;
  const R = n <= 2 ? 50 : 62;
  return (
    <div
      className="relative mx-auto h-[172px] w-full shrink-0 touch-none select-none"
      onPointerDown={(e) => (drag.current = { x: e.clientX, spin, moved: 0 })}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        d.moved = Math.max(d.moved, Math.abs(e.clientX - d.x));
        setSpin(d.spin + (e.clientX - d.x) / 70);
      }}
      onPointerUp={() => setTimeout(() => (drag.current = null), 0)}
      onPointerCancel={() => (drag.current = null)}
      onClickCapture={(e) => {
        if (drag.current && drag.current.moved > 8) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
    >
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <circle cx="50%" cy="50%" r={R} fill="none" stroke="rgba(255,226,170,0.16)" strokeDasharray="2 6" />
      </svg>
      {all.map((t, i) => {
        const a = spin - Math.PI / 2 + (i * Math.PI * 2) / Math.max(1, n);
        const on = t.id === sel;
        return (
          <button
            key={t.id}
            onClick={() => onPick(t.id)}
            aria-label={t.name}
            aria-pressed={on}
            className="absolute transition-transform"
            style={{ left: `calc(50% + ${n === 1 ? 0 : Math.cos(a) * R}px)`, top: `calc(50% + ${n === 1 ? 0 : Math.sin(a) * R}px)`, transform: `translate(-50%,-50%) scale(${on ? 1.18 : 0.92})` }}
          >
            <Face src={t.avatar} name={t.name} size={46} glow={on} />
            {!!t.unread && <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-sky-300 ring-2 ring-[#0b0f24]" aria-label="新しいメッセージ" />}
          </button>
        );
      })}
    </div>
  );
}

export function Face({ src, name, size, glow }: { src?: string; name?: string; size: number; glow?: boolean }) {
  return (
    <span className="relative block shrink-0 overflow-hidden rounded-full bg-white/10" style={{ width: size, height: size, boxShadow: glow ? '0 0 0 2px #f2c46b, 0 0 16px rgba(242,196,107,0.6)' : '0 0 0 1px rgba(255,255,255,0.15)' }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[15px] text-amber-100/80">{[...(name ?? '')][0]}</span>
      )}
    </span>
  );
}

export function Drawer({ side, label, onClose, children }: { side: 'left' | 'right'; label: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-40 bg-black/40" onClick={onClose}>
      <aside
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className={`pt-safe pb-safe absolute top-0 flex h-full w-[82%] max-w-xs flex-col bg-[#0b0f24]/95 px-3 pt-4 backdrop-blur-xl ${side === 'left' ? 'left-0 border-r' : 'right-0 border-l'} border-white/10`}
      >
        {children}
      </aside>
    </div>
  );
}

/** M-R258 §3: after 〔○○へ飛ばす〕 from Bluena, the planet home's line ({neo} = the member) */
const flownLine = (kind: string, neo?: string | null) => (HOME_OF_WORK[kind] ? PLANET_HOMES[HOME_OF_WORK[kind]].flown.replace('{neo}', neo ?? 'あなた') : '星へ飛ばした');
