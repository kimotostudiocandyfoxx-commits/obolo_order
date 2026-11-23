'use client';

import Link from 'next/link';
import { JOURNEY_DONE, lap2Done, LAP2_DONE, type DachiThreadView, type Me, type MembersDay } from '@obolo/shared';
import { useEffect, useState } from 'react';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * The tester entrance (docs/本番の状態.md 「テスターの入口」): a small pill at the right edge, only for an account on the
 * server's allowlist (Me.tester). Its panel opens everything, jumps to a day (1–8, the members' days) with no wait,
 * skips to the next day, starts over, and goes straight to the Moon atelier / {bati}'s talk / the ダチ. Hidden while a
 * talk's keyboard is up (<html data-typing>), so it never sits over the input. Everything goes through the real API
 * (POST /me/tester/*): the daily caps stay on.
 */

/** this device's story progress (the scene inside a day): a jumped-to day starts from its beginning */
const STORY_KEYS = [/^obolo\.story\.day/, /^obolo\.after\./, /^obolo\.lap2\./, /^obolo\.kororinArrived$/, /^obolo\.demo\.eggReady/];
/** kept by 〔最初から〕 on this device: the login, the operator token, the agreement and the sound settings */
const KEEP_ON_RESET = [/^obolo\.token$/, /^obolo\.lookAdmin$/, /^obolo\.admin/, /^obolo\.consent/, /^obolo\.birthYear$/, /^obolo\.talk\.muted$/, /^obolo\.story\.mix$/];

function forget(match: (k: string) => boolean) {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('obolo.') && match(k)) localStorage.removeItem(k);
    for (const k of Object.keys(sessionStorage)) if (k.startsWith('obolo.') && match(k)) sessionStorage.removeItem(k);
  } catch {
    /* storage unavailable */
  }
}

/** where the account is now, in the panel's words */
function where(me: Me): string {
  if (me.journeyDay < JOURNEY_DONE) return `${me.journeyDay}日目${me.journeyCompletedAt ? '（おわり・つぎ待ち）' : ''}`;
  if (!me.orderedAt) return '旅のあと（住人）';
  const done = lap2Done(me.story);
  return done >= LAP2_DONE ? '会員の日・ぜんぶおわり' : `会員${done + 1}`;
}

const DAYS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const MEMBERS: { id: MembersDay; label: string }[] = [
  { id: 'm1', label: '会員1' },
  { id: 'm2', label: '会員2' },
  { id: 'm3', label: '会員3' },
];

export function TesterBar() {
  const { me, setMe } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [dachi, setDachi] = useState<DachiThreadView[]>([]);

  const tester = !!me?.tester;
  useEffect(() => {
    if (!open || !tester) return;
    let alive = true;
    getApi()
      .dachiThreads()
      .then((l) => alive && setDachi(l))
      .catch(() => alive && setDachi([]));
    return () => {
      alive = false;
    };
  }, [open, tester, me?.journeyDay]);

  if (!me || !tester) return null;

  /** one action: the server first, then this device's story progress, then the top (the day starts from there) */
  const run = async (label: string, call: () => Promise<Me>, after: 'home' | 'stay', clear: 'story' | 'all') => {
    setBusy(true);
    setMsg(null);
    try {
      const u = await call();
      setMe(u);
      forget(clear === 'all' ? (k) => !KEEP_ON_RESET.some((r) => r.test(k)) : (k) => STORY_KEYS.some((r) => r.test(k)));
      setMsg(`${label}：いま ${where(u)}`);
      if (after === 'home') window.location.assign('/');
    } catch (e) {
      setMsg(`できなかった：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
      setConfirmReset(false);
    }
  };
  const api = getApi();
  const btn = 'rounded-full px-3 py-1.5 text-xs disabled:opacity-40';

  return (
    <div className="fixed right-0 top-[38%] z-[470] [html[data-typing]_&]:hidden">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="テスター"
          className="rounded-l-full border border-r-0 border-amber-200/40 bg-black/70 px-2 py-1.5 text-[10px] font-bold tracking-widest text-amber-100/90 backdrop-blur"
        >
          テスト
        </button>
      ) : (
        <div className="mr-2 max-h-[70svh] w-[min(18rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-amber-200/30 bg-[#0b0a14]/95 p-3 text-white shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold tracking-widest text-amber-100">テスター</p>
            <button onClick={() => setOpen(false)} aria-label="とじる" className="h-7 w-7 rounded-full bg-white/10 text-sm">
              ×
            </button>
          </div>
          <p className="mt-1 text-[11px] text-white/60">いま：{where(me)}</p>

          <button disabled={busy} onClick={() => run('全部ひらいた', () => api.testerUnlockAll(), 'stay', 'story')} className={`${btn} mt-2 w-full bg-amber-400 font-bold text-black`}>
            全部ひらく
          </button>
          <p className="mt-1 text-[10px] leading-relaxed text-white/45">月の工房の全部・バティ・ブルーナ・ダチが使える状態にします（会員にもなります。請求なし）</p>

          <p className="mt-3 text-[11px] text-white/60">その日の最初へ（待ちなし）</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {DAYS.map((d) => (
              <button
                key={d}
                disabled={busy}
                onClick={() => run(`${d}日目へ`, () => api.testerJump(d), 'home', 'story')}
                className={`${btn} h-8 w-8 px-0 ${me.journeyDay === d ? 'bg-amber-300 font-bold text-black' : 'bg-white/10'}`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {MEMBERS.map((m) => (
              <button key={m.id} disabled={busy} onClick={() => run(`${m.label}へ`, () => api.testerJump(m.id), 'home', 'story')} className={`${btn} bg-white/10`}>
                {m.label}
              </button>
            ))}
          </div>

          <button disabled={busy} onClick={() => run('次の日へ', () => api.testerNext(), 'home', 'story')} className={`${btn} mt-3 w-full bg-white/15`}>
            次の日へ
          </button>

          <div className="mt-3 border-t border-white/10 pt-3">
            <p className="text-[11px] text-white/60">すぐ行く</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Link href="/moon/atelier" onClick={() => setOpen(false)} className={`${btn} bg-white/10`}>
                月の工房
              </Link>
              <Link href="/moon/atelier?thread=bati" onClick={() => setOpen(false)} className={`${btn} bg-white/10`}>
                バティと話す
              </Link>
              {dachi.map((t) => (
                <Link key={t.id} href={`/moon/atelier?thread=${encodeURIComponent(t.id)}`} onClick={() => setOpen(false)} className={`${btn} bg-white/10`}>
                  ダチ：{t.name}
                </Link>
              ))}
              <Link href="/earth" onClick={() => setOpen(false)} className={`${btn} bg-white/10`}>
                ダチの招待状
              </Link>
            </div>
            {dachi.length === 0 && <p className="mt-1 text-[10px] text-white/45">ダチは3日目から（〔全部ひらく〕でも出ます）</p>}
          </div>

          <div className="mt-3 border-t border-white/10 pt-3">
            {!confirmReset ? (
              <button disabled={busy} onClick={() => setConfirmReset(true)} className={`${btn} w-full bg-rose-500/20 text-rose-100`}>
                最初から
              </button>
            ) : (
              <div className="rounded-xl bg-rose-500/10 p-2">
                <p className="text-[11px] leading-relaxed text-rose-100">
                  1日目の前に戻します。旅・バティ・バティとの話・月の作品・姿は消えます。アカウント・ログイン・ダチは残ります。いいですか？
                </p>
                <div className="mt-2 flex gap-2">
                  <button disabled={busy} onClick={() => run('最初からにした', () => api.testerReset(), 'home', 'all')} className={`${btn} flex-1 bg-rose-500 font-bold text-white`}>
                    消して最初から
                  </button>
                  <button disabled={busy} onClick={() => setConfirmReset(false)} className={`${btn} flex-1 bg-white/10`}>
                    やめる
                  </button>
                </div>
              </div>
            )}
          </div>

          {busy && <p className="mt-2 text-[11px] text-amber-100/80">少し待ってね…</p>}
          {msg && <p className="mt-2 text-[11px] text-white/70">{msg}</p>}
        </div>
      )}
    </div>
  );
}
