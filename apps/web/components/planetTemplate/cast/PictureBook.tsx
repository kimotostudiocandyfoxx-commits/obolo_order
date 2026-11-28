'use client';

import { useEffect, useRef, useState } from 'react';
import { narrate, setNarrationRate, stopNarration } from '@/lib/planetTemplate/castAudio';
import { BOOK_MS, BOOK_SPEEDS, bookTapSide, bookTurn, storeBookSpeed, storedBookSpeed } from '@/lib/planetTemplate/castBook';
import { castAsset, type CastWorks } from '@/lib/planetTemplate/castWorks';
import { soundScope } from '@/lib/planetTemplate/sfx';
import c from './Cast.module.css';

/** one square page: the picture, its number, the title on the first, the words on the band at the bottom */
function Face({ cast, i }: { cast: CastWorks; i: number }) {
  return (
    <div className={c.sq} style={{ backgroundImage: `url(${castAsset(cast.key, `book-${i + 1}.webp`)})` }} data-testid="book-page" data-page={i + 1}>
      <span className={c.pno}>
        {i + 1} / {cast.pages.length}
      </span>
      {i === 0 && <h4>{cast.book}</h4>}
      <p className={c.cap}>{cast.pages[i]}</p>
    </div>
  );
}

/**
 * Pluto: the cast's picture book (handoff planets-08 §3 / §6, the prototype's sapBook). The maker reads the title and
 * then each page in their own voice; a page read turns to the next by itself, 〔‹〕〔›〕 and the page's edges turn it by
 * hand (the right edge forward), the three speed buttons change how fast it is read (not how high; remembered), and
 * after the last page — read to the end, or 〔›〕 pressed on it — the book closes and flies away (`onFinish`).
 * `touch` false (▶): nothing is pressed; it reads from the start until the play view moves on.
 */
export function PictureBook({ cast, touch = true, onFinish, away }: { cast: CastWorks; touch?: boolean; onFinish?: () => void; away: (on: boolean) => void }) {
  const n = cast.pages.length;
  const [page, setPage] = useState(0);
  const [under, setUnder] = useState(0);
  const [leaf, setLeaf] = useState<{ dir: 'fwd' | 'back'; page: number } | null>(null);
  const [speed, setSpeed] = useState(1);
  const [closing, setClosing] = useState(false);
  const st = useRef({ p: 0, busy: false, done: false, sp: 1, auto: null as ReturnType<typeof setTimeout> | null, timers: [] as ReturnType<typeof setTimeout>[] });
  const snd = useRef(soundScope());
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  const awayRef = useRef(away);
  awayRef.current = away;
  const api = useRef<{ turn: (d: -1 | 1) => void; setSpeed: (r: number) => void }>({ turn: () => undefined, setSpeed: () => undefined });

  useEffect(() => {
    const s = st.current;
    const sc = snd.current;
    s.p = 0;
    s.busy = false;
    s.done = false;
    const later = (f: () => void, ms: number) => {
      const id = setTimeout(f, ms);
      s.timers.push(id);
      return id;
    };
    const clearAuto = () => {
      if (s.auto) clearTimeout(s.auto);
      s.auto = null;
    };
    const voice = (file: string) => castAsset(cast.key, file);
    const read = () => {
      clearAuto();
      const p = s.p;
      narrate(voice(`page${p + 1}.mp3`), {
        rate: s.sp,
        then: () => {
          s.auto = later(() => (p < n - 1 ? turn(1) : finish()), p < n - 1 ? BOOK_MS.next : BOOK_MS.last);
        },
      });
    };
    function finish() {
      if (s.done) return;
      s.done = true;
      clearAuto();
      stopNarration();
      sc.sfx('page');
      setClosing(true);
      later(() => {
        sc.sfx('bookFly');
        awayRef.current(true);
      }, BOOK_MS.close);
      later(() => finishRef.current?.(), BOOK_MS.close + BOOK_MS.fly);
    }
    function turn(d: -1 | 1) {
      if (s.busy || s.done) return;
      const to = bookTurn(s.p, d, n);
      if (to === null) return;
      if (to === 'finish') return finish();
      s.busy = true;
      clearAuto();
      stopNarration();
      sc.sfx('page');
      // forward: the old page lifts off the new one; back: the page before comes down over this one
      if (d > 0) {
        setLeaf({ dir: 'fwd', page: s.p });
        setUnder(to);
      } else setLeaf({ dir: 'back', page: to });
      s.p = to;
      setPage(to);
      later(() => {
        setUnder(to);
        setLeaf(null);
        s.busy = false;
        read();
      }, BOOK_MS.turn);
    }
    api.current = {
      turn,
      setSpeed: (r) => {
        sc.sfx('tick');
        s.sp = r;
        setSpeed(r);
        storeBookSpeed(r);
        setNarrationRate(r);
      },
    };
    s.sp = storedBookSpeed();
    setSpeed(s.sp);
    // the title first (the tap itself started it, when there was one), then the first page
    narrate(voice('bookv.mp3'), { rate: s.sp, then: () => void later(read, BOOK_MS.afterTitle) });
    return () => {
      clearAuto();
      s.timers.forEach(clearTimeout);
      s.timers = [];
      s.done = true;
      stopNarration();
      sc.stop();
    };
  }, [cast, n]);

  const last = page >= n - 1;
  return (
    <div data-testid="picture-book" data-page={page + 1} data-pages={n} data-closing={closing ? '1' : '0'} onClick={touch ? (e) => e.stopPropagation() : undefined}>
      <div
        className={`${c.bk} ${closing ? c.closing : ''}`}
        onClick={
          touch
            ? (e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const side = bookTapSide(e.clientX - r.left, r.width);
                if (side) api.current.turn(side);
              }
            : undefined
        }
      >
        <div className={c.cover} />
        <div className={c.under}>
          <Face cast={cast} i={under} />
        </div>
        {leaf && (
          <div className={`${c.leaf} ${leaf.dir === 'fwd' ? c.fwd : c.back}`}>
            <Face cast={cast} i={leaf.page} />
            <i className={c.shade} />
          </div>
        )}
      </div>
      {touch && (
        <div className={c.nav}>
          <button type="button" onClick={() => api.current.turn(-1)} disabled={page === 0} aria-label="まえのページ" data-testid="book-prev">
            ‹
          </button>
          <div className={c.spd} role="group" aria-label="読む速さ">
            {BOOK_SPEEDS.map((b) => (
              <button key={b.rate} type="button" aria-pressed={b.rate === speed} onClick={() => api.current.setSpeed(b.rate)} data-testid={`book-speed-${b.rate}`}>
                {b.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => api.current.turn(1)} aria-label={last ? '本をとじる' : 'つぎのページ'} data-testid="book-next">
            ›
          </button>
        </div>
      )}
    </div>
  );
}
