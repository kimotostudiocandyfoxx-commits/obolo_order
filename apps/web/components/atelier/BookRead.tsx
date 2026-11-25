'use client';

import type { BookView } from '@obolo/shared';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSpellFont } from './spellLooks';

/** a chapter number in kanji (第一章 … 第三十章: the brush font's 1 reads as 7) */
export function kanjiNum(n: number): string {
  const d = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (n <= 0 || n >= 100) return String(n);
  const t = Math.floor(n / 10);
  return (t ? (t > 1 ? d[t] : '') + '十' : '') + d[n % 10];
}

/**
 * Client 2026-11-25 (本): a book made on the Moon — its cover, its card, and a reader. No painted cover yet (open
 * decision for the client: the image generator costs per picture), so the cover is typographic in the A look (霊符: the
 * yellow talisman paper, the cinnabar brush title written downwards, the 月 seal). The reader: 縦書き with pages to turn
 * (a tap on the left half, a swipe, or the arrows) or 横書き to scroll, and the chapters to jump to.
 */
const esc = (s: string) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c]!);

/** the typographic cover as an SVG data URL (Bluena's icon, the card) */
export function bookCoverUrl(title: string, sub = ''): string {
  const t = [...(title || 'わたしの本')].slice(0, 9);
  const size = t.length > 6 ? 30 : 36;
  const top = 118 - (t.length * size) / 2 + size * 0.5;
  const chars = t.map((c, i) => `<text x="120" y="${(top + i * size * 1.05 + 60).toFixed(1)}" font-size="${size}" text-anchor="middle">${esc(c)}</text>`).join('');
  const s = [...sub].slice(0, 10).map((c, i) => `<text x="44" y="${(84 + i * 15).toFixed(1)}" font-size="13" text-anchor="middle">${esc(c)}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 340"><defs><linearGradient id="p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6dc6a"/><stop offset="1" stop-color="#e3b232"/></linearGradient><filter id="f"><feTurbulence type="fractalNoise" baseFrequency=".9 .05" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .45 0 0 0 0 .3 0 0 0 0 .05 0 0 0 .16 0"/><feComposite in2="SourceGraphic" operator="in"/></filter></defs><rect width="240" height="340" rx="6" fill="#2a1410"/><rect x="14" y="10" width="212" height="320" rx="3" fill="url(#p)"/><rect x="14" y="10" width="212" height="320" rx="3" fill="#fff" filter="url(#f)"/><rect x="24" y="20" width="192" height="300" fill="none" stroke="#a8120a" stroke-width="2.5"/><rect x="29" y="25" width="182" height="290" fill="none" stroke="#a8120a" stroke-width="1"/><g fill="#a8120a" font-family="'Yuji Boku','Shippori Mincho',serif">${chars}</g><g fill="#7a1a0e" font-family="'Shippori Mincho',serif" opacity=".8">${s}</g><rect x="172" y="262" width="34" height="34" fill="#b51a0e" transform="rotate(6 189 279)"/><text x="189" y="288" font-size="22" text-anchor="middle" fill="#ffe9b0" font-family="'Yuji Boku',serif" transform="rotate(6 189 279)">月</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
export const bookSub = (b: Pick<BookView, 'tags'>) => b.tags.find((t) => t.group === 'world')?.ja ?? b.tags.find((t) => t.group === 'genre')?.ja ?? '';

/** a book on its card in the talk / in Bluena: the cover, the chapters so far, 〔読む〕 */
export function BookFace({ book }: { book: BookView }) {
  useSpellFont('reifu');
  const [open, setOpen] = useState<number | null>(null);
  const last = book.chapters.at(-1);
  return (
    <div className="flex gap-2.5" data-testid="book-face">
      <button onClick={() => setOpen(Math.max(0, book.chapters.length - 1))} aria-label="読む" className="w-[92px] shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={book.cover ?? bookCoverUrl(book.title, bookSub(book))} alt="" className="w-full rounded-md shadow-[0_6px_16px_rgba(0,0,0,.45)]" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-amber-100/60">{book.done ? `全${book.chapters.length}章・おしまい` : `第${book.chapters.length}章まで`}</p>
        <ol className="mt-1 space-y-0.5">
          {book.chapters.slice(-4).map((c) => (
            <li key={c.n}>
              <button onClick={() => setOpen(c.n - 1)} className="w-full truncate text-left text-[12.5px] text-amber-50/90 underline-offset-2 hover:underline">
                第{kanjiNum(c.n)}章　{c.title}
              </button>
            </li>
          ))}
        </ol>
        {last && <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-white/60">{last.text.replace(/\s+/g, '').slice(0, 60)}…</p>}
        <button onClick={() => setOpen(Math.max(0, book.chapters.length - 1))} className="mt-1.5 rounded-full bg-amber-200 px-3 py-1.5 text-[12px] font-bold text-slate-950" data-testid="book-read">
          読む
        </button>
      </div>
      {open != null && <BookReader book={book} start={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

const MODE_KEY = 'obolo.reader.mode';

/** the reader, full screen: 縦書き (pages) or 横書き (scroll); the chapter list; ✕ */
export function BookReader({ book, start = 0, onClose }: { book: BookView; start?: number; onClose: () => void }) {
  useSpellFont('reifu');
  const [ch, setCh] = useState(Math.max(0, Math.min(book.chapters.length - 1, start)));
  const [mode, setMode] = useState<'tate' | 'yoko'>(() => {
    try {
      return localStorage.getItem(MODE_KEY) === 'yoko' ? 'yoko' : 'tate';
    } catch {
      return 'tate';
    }
  });
  const [list, setList] = useState(false);
  const pane = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState({ at: 0, of: 1 });
  const c = book.chapters[ch];
  const setM = (m: 'tate' | 'yoko') => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* this time only */
    }
  };
  // which page of the chapter is showing (縦書き: the pane scrolls leftwards a page at a time)
  const measure = () => {
    const el = pane.current;
    if (!el || mode !== 'tate') return;
    const w = el.clientWidth || 1;
    setPage({ at: Math.round(Math.abs(el.scrollLeft) / w), of: Math.max(1, Math.round(el.scrollWidth / w)) });
  };
  useEffect(() => {
    const el = pane.current;
    if (!el) return;
    el.scrollTo({ left: 0, top: 0 });
    const t = setTimeout(measure, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ch, mode]);
  const turn = (dir: 1 | -1) => {
    const el = pane.current;
    if (!el) return;
    if (mode === 'yoko') return void el.scrollBy({ top: dir * el.clientHeight * 0.85, behavior: 'smooth' });
    if (dir > 0 && page.at >= page.of - 1) return ch < book.chapters.length - 1 && setCh(ch + 1);
    if (dir < 0 && page.at <= 0) return ch > 0 && setCh(ch - 1);
    // vertical-rl: the next page is to the left
    el.scrollBy({ left: -dir * el.clientWidth, behavior: 'smooth' });
  };
  const swipe = useRef<number | null>(null);
  if (typeof document === 'undefined' || !c) return null;
  const paras = c.text.split(/\n+/).filter((p) => p.trim());
  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#1b1310] text-[#2b1a10]" role="dialog" aria-label={book.title} data-testid="book-reader">
      <div className="pt-safe flex items-center gap-2 bg-[#2a1712] px-3 py-2 text-[#f6dc9a]">
        <button onClick={() => setList((v) => !v)} aria-pressed={list} className="rounded-full border border-[#f6dc9a]/40 px-2.5 py-1 text-[12px]" data-testid="reader-chapters">
          目次
        </button>
        <b className="min-w-0 flex-1 truncate text-center text-[14px]" style={{ fontFamily: '"Yuji Boku", "Shippori Mincho", serif' }}>
          {book.title}
        </b>
        <span className="flex overflow-hidden rounded-full border border-[#f6dc9a]/40 text-[11.5px]">
          <button onClick={() => setM('tate')} aria-pressed={mode === 'tate'} className={`px-2 py-1 ${mode === 'tate' ? 'bg-[#f6dc9a] text-[#2a1712]' : ''}`}>
            縦
          </button>
          <button onClick={() => setM('yoko')} aria-pressed={mode === 'yoko'} className={`px-2 py-1 ${mode === 'yoko' ? 'bg-[#f6dc9a] text-[#2a1712]' : ''}`}>
            横
          </button>
        </span>
        <button onClick={onClose} aria-label="とじる" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-base">
          ✕
        </button>
      </div>
      <div className="relative min-h-0 flex-1 p-3">
        <div className="relative h-full overflow-hidden rounded-[4px] shadow-[0_10px_30px_rgba(0,0,0,.5)]" style={{ background: 'linear-gradient(180deg,#fbf3dc,#f3e5bf)' }}>
          <div
            ref={pane}
            onScroll={measure}
            onPointerDown={(e) => (swipe.current = e.clientX)}
            onPointerUp={(e) => {
              const s = swipe.current;
              swipe.current = null;
              if (s == null || mode !== 'tate') return;
              const dx = e.clientX - s;
              if (Math.abs(dx) > 40) return turn(dx > 0 ? 1 : -1);
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              turn(e.clientX < r.left + r.width / 2 ? 1 : -1);
            }}
            className={mode === 'tate' ? 'no-scrollbar h-full w-full overflow-x-auto overflow-y-hidden' : 'h-full w-full overflow-y-auto px-5 py-5'}
            style={
              mode === 'tate'
                ? { writingMode: 'vertical-rl', columnWidth: 'auto', fontFamily: '"Shippori Mincho", "Hiragino Mincho ProN", serif', fontSize: 17, lineHeight: 1.9, padding: '22px 22px', textOrientation: 'mixed' }
                : { fontFamily: '"Shippori Mincho", "Hiragino Mincho ProN", serif', fontSize: 16, lineHeight: 1.95 }
            }
            data-testid="reader-pane"
            data-mode={mode}
          >
            <h2 className={mode === 'tate' ? 'ml-6 text-[20px] font-bold text-[#8a1a0e]' : 'mb-4 text-[19px] font-bold text-[#8a1a0e]'} style={{ fontFamily: '"Yuji Boku", "Shippori Mincho", serif' }}>
              第{kanjiNum(c.n)}章　{c.title}
            </h2>
            {paras.map((p, i) => (
              <p key={i} className={mode === 'tate' ? 'ml-[0.4em]' : 'mb-[0.6em]'} style={{ textIndent: /^[「『（]/.test(p) ? 0 : '1em' }}>
                {p}
              </p>
            ))}
            {ch === book.chapters.length - 1 && <p className={`${mode === 'tate' ? 'mr-8' : 'mt-6'} text-[13px] text-[#8a1a0e]/80`}>{book.done ? '― おしまい ―' : '（つづく）'}</p>}
          </div>
        </div>
        {list && (
          <div className="absolute inset-x-3 top-3 z-10 max-h-[70%] overflow-y-auto rounded-xl bg-[#2a1712]/95 p-2 text-[#f6dc9a] shadow-xl" data-testid="reader-list">
            {book.chapters.map((x, i) => (
              <button key={x.n} onClick={() => (setCh(i), setList(false))} className={`block w-full rounded-lg px-3 py-2 text-left text-[13.5px] ${i === ch ? 'bg-[#f6dc9a]/15' : ''}`}>
                第{kanjiNum(x.n)}章　{x.title}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="pb-safe flex items-center justify-between px-4 pb-3 text-[12px] text-[#f6dc9a]/80">
        <button onClick={() => turn(1)} className="rounded-full border border-[#f6dc9a]/30 px-3 py-1.5" aria-label="次へ">
          {mode === 'tate' ? '‹ 次へ' : '↓ 次へ'}
        </button>
        <span className="tabular-nums">
          第{kanjiNum(c.n)}章{mode === 'tate' ? `・${page.at + 1}/${page.of}` : ''}
        </span>
        <button onClick={() => turn(-1)} className="rounded-full border border-[#f6dc9a]/30 px-3 py-1.5" aria-label="前へ">
          {mode === 'tate' ? '前へ ›' : '↑ 前へ'}
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** a book fetched by its id (a ダチ's card, Bluena) */
export function BookById({ id, load }: { id: string; load: (id: string) => Promise<BookView> }) {
  const [b, setB] = useState<BookView | null | 'none'>(null);
  useEffect(() => {
    let live = true;
    load(id)
      .then((x) => live && setB(x))
      .catch(() => live && setB('none'));
    return () => {
      live = false;
    };
  }, [id, load]);
  if (b === 'none') return <p className="text-[12px] text-white/70">この本は、いまは読めないみたい</p>;
  if (!b) return <p className="text-[12px] text-white/60">…</p>;
  return <BookFace book={b} />;
}
