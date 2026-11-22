'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Drawer, ThreadRing, ThreadsDrawer, Face } from '@/components/atelier/Drawers';
import { SpiralList, type FindFilter, type SpiralRow } from '@/components/finds/SpiralList';
import { useDachiThreads } from '@/lib/dachi/useDachiThreads';
import { usePartner } from '@/lib/partner';

/** one conversation in a talk's left drawer ({bati}, a ダチ, a group, the society's notices) */
export type TalkThread = { id: string; name: string; avatar?: string; unread?: number };

/**
 * The left drawer of a talk outside the atelier (M-R237, the same parts as the atelier's): the conversations at the
 * top (a ring while few), the chosen one's past as the spiral and the list below.
 *
 * AppThreads — the signed-in app ({bati}'s talk on the moon): the real threads; choosing one goes to the atelier,
 * which opens it (or that day of it).
 */
export function AppThreads({ current = 'bati', extra, onClose }: { current?: string; extra?: ReactNode; onClose: () => void }) {
  const router = useRouter();
  const partner = usePartner();
  const { threads } = useDachiThreads();
  const go = (q: string) => router.push(`/moon/atelier${q}`);
  return (
    <ThreadsDrawer
      bati={{ name: partner.name, face: partner.face }}
      threads={threads}
      current={current}
      extra={
        <>
          <div className="h-3 shrink-0" />
          {extra}
        </>
      }
      onThread={(id) => (id === current ? onClose() : go(`?thread=${encodeURIComponent(id)}`))}
      onNew={() => go('')}
      onDay={(id, day) => go(`?thread=${encodeURIComponent(id)}&day=${encodeURIComponent(day)}`)}
      onClose={onClose}
    />
  );
}

/**
 * HereThreads — a talk that stays where it is (the story's chats, the review page): the threads given (else just this
 * one); this talk's past is its own lines (a row goes back to that line), another thread's what `days` gives.
 */
export function HereThreads({
  threads,
  current,
  rows,
  days,
  extra,
  onRow,
  onClose,
}: {
  threads: TalkThread[];
  current: string;
  /** this talk's own past */
  rows: SpiralRow[];
  /** another thread's past (one row a day) */
  days?: (thread: string) => SpiralRow[];
  extra?: ReactNode;
  onRow: (row: SpiralRow) => void;
  onClose: () => void;
}) {
  const [sel, setSel] = useState(current);
  const [filter, setFilter] = useState<FindFilter>({});
  const pick = threads.find((t) => t.id === sel) ?? threads[0];
  const q = filter.q?.trim();
  const all = sel === current ? rows : (days?.(sel) ?? []);
  const shown = all.filter((r) => (!q || r.title.includes(q)) && (!filter.star || (r.stars ?? 0) > 0) && (!filter.mark || r.markId === filter.mark));
  return (
    <Drawer side="left" onClose={onClose} label="会話">
      <div className="h-3 shrink-0" />
      {extra}
      {threads.length <= 8 ? (
        <ThreadRing all={threads} sel={sel} onPick={(id) => (id === sel && id === current ? onClose() : setSel(id))} />
      ) : (
        <div className="no-scrollbar max-h-[34%] shrink-0 space-y-1 overflow-y-auto">
          {threads.map((t) => (
            <button key={t.id} onClick={() => setSel(t.id)} className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left ${t.id === sel ? 'bg-amber-200/15' : ''}`}>
              <Face src={t.avatar} name={t.name} size={34} />
              <span className="min-w-0 flex-1 truncate text-[13px]">{t.name}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex shrink-0 items-center gap-2 py-2">
        <p className="min-w-0 flex-1 truncate text-[13px] tracking-[0.12em] text-amber-100/90">{pick?.name}</p>
        {sel === current && (
          <button onClick={onClose} className="rounded-full bg-amber-200/90 px-3 py-1 text-[11.5px] font-bold text-[#1b1208]">
            話す
          </button>
        )}
      </div>
      <SpiralList rows={shown} filter={filter} onFilter={setFilter} onRow={(r) => (sel === current ? onRow(r) : onClose())} empty={q || filter.star || filter.mark ? '見つからなかった' : 'まだ、話していない'} search="言葉" />
    </Drawer>
  );
}
