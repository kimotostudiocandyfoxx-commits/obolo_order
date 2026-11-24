'use client';

import type { DachiHistoryRow } from '@obolo/shared';
import { useEffect, useRef, useState } from 'react';
import { getApi } from '@/lib/api';
import { CHARACTER_AVATAR } from '@/lib/dachi/useDachiThreads';
import { Drawer, Face } from './Drawers';

/** when the last message came: today → 14:05, this year → 11/24, else 2025/11/24 */
export function whenShort(iso: string | null, now = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  if (d.toDateString() === now.toDateString()) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return d.getFullYear() === now.getFullYear() ? `${d.getMonth() + 1}/${d.getDate()}` : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * R10 (client): the ダチ tab's ≡ — every ダチ talk (KIMORIN⭐︎ too) like a chat app's list: newest first, the face, the
 * name, what was said last (words, 🎤 a voice, ✦ a work), when, and the unread dot. More come as it is scrolled down
 * (GET /dachi/history, a cursor). A row opens that talk.
 */
export function DachiHistory({ onClose, onOpen }: { onClose: () => void; onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<DachiHistoryRow[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const more = useRef<HTMLDivElement>(null);
  const load = async (cursor: string | null) => {
    setBusy(true);
    try {
      const p = await getApi().dachiHistory(cursor);
      setRows((r) => [...(cursor ? (r ?? []) : []), ...p.items]);
      setNext(p.next);
    } catch {
      setRows((r) => r ?? []);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load(null);
  }, []);
  // the end of the list in view: the next page
  useEffect(() => {
    const el = more.current;
    if (!el || !next) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && !busy && void load(next));
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next, busy]);
  return (
    <Drawer side="left" onClose={onClose} label="ダチとの会話">
      <p className="shrink-0 pb-2 text-[13px] tracking-[0.12em] text-amber-100/90">ダチとの会話</p>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-6" data-testid="dachi-history">
        {rows === null && <p className="py-8 text-center text-xs text-white/45">…</p>}
        {rows?.length === 0 && <p className="py-8 text-center text-xs text-white/45">まだ、話していない</p>}
        {rows?.map((t) => {
          const p = t.preview;
          const line = !p ? 'まだ、話していない' : p.kind === 'voice' ? `🎤 ${p.text}` : p.kind === 'work' ? `✦ ${p.text}` : p.text;
          return (
            <button key={t.id} onClick={() => onOpen(t.id)} className="flex w-full items-center gap-2.5 rounded-xl px-1.5 py-2 text-left active:bg-white/5">
              <Face src={t.pic ?? CHARACTER_AVATAR[t.kind]} name={t.name} size={42} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <b className="min-w-0 flex-1 truncate text-[13.5px] text-[#f4f1ff]">{t.name}</b>
                  <span className="shrink-0 text-[10.5px] text-white/45">{whenShort(t.lastAt)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={`min-w-0 flex-1 truncate text-[12px] ${t.unread ? 'text-[#f4f1ff]' : 'text-white/55'}`}>
                    {p?.fromMe ? 'あなた：' : ''}
                    {line}
                  </span>
                  {t.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-sky-300" aria-label="新しいメッセージ" />}
                </span>
              </span>
            </button>
          );
        })}
        {next && <div ref={more} className="py-4 text-center text-xs text-white/40">…</div>}
      </div>
    </Drawer>
  );
}
