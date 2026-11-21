'use client';

import { useEffect, useState } from 'react';

/**
 * The review mode's bar (client request 2026-11-21): the script scene now playing is always on screen, so a fix can
 * be sent as 「D04-S007 の2行目」; a note per scene, kept in this browser and exported all together; jump to a day.
 * Only on the review pages (/kakunin-…), never in the members' app.
 */
const KEY = 'obolo.review.notes';
type Notes = Record<string, string>;

const load = (): Notes => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Notes;
  } catch {
    return {};
  }
};
const store = (n: Notes) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(n));
  } catch {
    /* private window: notes last this visit only */
  }
};

export const REVIEW_DAYS: { label: string; href: string }[] = [
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((d) => ({ label: `${d}日目`, href: `/kakunin-5798f28713/play?day=${d}&thru=8` })),
  // after joining (天王星・冥王星・海王星 + the end)
  ...[1, 2, 3].map((d) => ({ label: `会員${d}日目`, href: `/kakunin-5798f28713/play?day=m${d}` })),
];

export function exportNotes(notes: Notes) {
  const ids = Object.keys(notes)
    .filter((k) => notes[k].trim())
    .sort();
  return ['# 直したいメモ', '', ...ids.flatMap((id) => [`## ${id}`, notes[id].trim(), ''])].join('\n');
}

/** day: the day's number, or a label of its own (「会員1日目」) */
export function ReviewBar({ day, scene }: { day: number | string | null; scene: string | null }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Notes>({});
  const [copied, setCopied] = useState(false);
  useEffect(() => setNotes(load()), [open]);
  const dayLabel = typeof day === 'string' ? day : day ? `${day}日目` : null;
  const key = scene ?? dayLabel ?? '全体';
  const count = Object.values(notes).filter((v) => v.trim()).length;
  const set = (v: string) => {
    const n = { ...notes, [key]: v };
    setNotes(n);
    store(n);
  };
  const doExport = async () => {
    const text = exportNotes(notes);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* no clipboard: the download still works */
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
    a.download = `obolo-review-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
  };

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed right-2 top-[calc(6px+env(safe-area-inset-top))] z-[450] flex items-center gap-1.5 rounded-full border border-amber-200/40 bg-black/70 px-2.5 py-1 font-mono text-[11px] text-amber-100 backdrop-blur"
        aria-label="確認用のメモ"
      >
        {scene ?? dayLabel ?? '確認'}
        {notes[key]?.trim() ? <span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> : <span className="text-white/40">✎</span>}
      </button>
      {open && (
        <div className="fixed inset-x-0 bottom-0 top-[calc(40px+env(safe-area-inset-top))] z-[449] overflow-y-auto bg-black/92 px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-3 text-white backdrop-blur">
          <p className="text-xs text-white/50">いまの場面</p>
          <p className="font-mono text-lg font-bold text-amber-100">{key}</p>
          <textarea
            value={notes[key] ?? ''}
            onChange={(e) => set(e.target.value)}
            placeholder="直したいこと（例：2行目の「〜」を短く／この画面の文字が小さい）"
            rows={5}
            className="mt-2 w-full rounded-2xl border border-white/15 bg-white/5 p-3 text-sm outline-none"
          />
          <div className="mt-2 flex gap-2">
            <button onClick={() => void doExport()} disabled={!count} className="flex-1 rounded-full bg-amber-300 py-2.5 text-sm font-black text-slate-950 disabled:opacity-40">
              {copied ? 'コピーした' : `メモを書き出す（${count}件）`}
            </button>
            <button onClick={() => setOpen(false)} className="rounded-full border border-white/20 px-5 py-2.5 text-sm">
              とじる
            </button>
          </div>
          <p className="mt-6 text-xs text-white/50">日を選んで飛ぶ</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {REVIEW_DAYS.map((d) => (
              <a key={d.href} href={d.href} className={`rounded-xl py-2 text-center text-sm ${d.label === dayLabel ? 'bg-amber-300/25 text-amber-100' : 'bg-white/10'}`}>
                {d.label}
              </a>
            ))}
          </div>
          {count > 0 && (
            <>
              <p className="mt-6 text-xs text-white/50">書いたメモ</p>
              <div className="mt-2 space-y-2">
                {Object.entries(notes)
                  .filter(([, v]) => v.trim())
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([id, v]) => (
                    <div key={id} className="rounded-xl bg-white/5 p-2 text-xs">
                      <p className="font-mono text-amber-100/80">{id}</p>
                      <p className="whitespace-pre-wrap text-white/75">{v}</p>
                    </div>
                  ))}
              </div>
            </>
          )}
          <p className="mt-6 text-[11px] leading-relaxed text-white/40">
            確認用モード：24時間の待ちは〔明日まで待てない〕で飛ばせます。支払い・公開・AI で作る所はテストの形で、本物のお金と公開は動きません。メモはこの端末の中だけに残ります。
          </p>
        </div>
      )}
    </>
  );
}
