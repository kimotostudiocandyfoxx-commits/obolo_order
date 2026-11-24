'use client';

import { ORDER_PRICE_JPY, type OrderCheckout } from '@obolo/shared';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import { LineVoice } from '@/lib/story/lineVoice';
import { BIRTH_YEAR_KEY } from './SealGate';

export interface OrderApi {
  checkout(): Promise<OrderCheckout>;
  /** Embedded Checkout finished: the server checks the session (throws NOT_PAID while pending). */
  confirm(sessionId: string): Promise<void>;
  /** Billing not configured: record the order without a charge. */
  demo(): Promise<void>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

/**
 * Day 7 (D08-S006): the visitor chose to begin the Eclipse. The final confirmation (M-R20): ¥88 a month
 * (tax included, the monthly mana), the renewal day, that it renews by itself, and how to stop — then
 * Stripe Embedded Checkout inside the story (no redirect, so the story goes on right after paying).
 * Demo mode (no Stripe key on the server) pays without a charge. The age is known from the start of the app (M-R252:
 * the birth year asked by ConsentGate / the seal, obolo.birthYear): no tick box here; under 18 sees one line,
 * 「家の人と一緒に読んでね」, adults nothing (M-R251 review).
 * PLACEHOLDER (P-BILL-3): the wording must be checked by the operator. Stopping: 〔設定〕→〔エクリプス（月¥88）〕
 * (P-BILL-4, the Stripe Customer Portal); the 特定商取引法に基づく表記 opens in a new tab so the story stays here.
 */
export function EclipsePay({
  api,
  paid,
  onPaid,
  onCancel,
  failLine = { who: 'MONBAN', text: '……まだ、終わっていない…。決めたら、また来い…。' },
  birthYear,
}: {
  /** the year they were born (the account's, asked at the start of the app); else this device's obolo.birthYear */
  birthYear?: number | null;
  api: OrderApi;
  paid: boolean;
  onPaid: () => void;
  onCancel: () => void;
  /** D08-S006: the line when the payment did not go through (from the day's script) */
  failLine?: { who: string; text: string };
}) {
  const [phase, setPhase] = useState<'loading' | 'stripe' | 'demo' | 'confirming' | 'error' | 'done'>('loading');
  useEffect(() => {
    if (phase !== 'error') return;
    const v = new LineVoice();
    v.unlock();
    // the day's own line (D08-S006's failLine), as shown under the error
    void v.say(failLine.who, failLine.text);
    return () => v.dispose();
  }, [phase, failLine.who, failLine.text]);
  // under 18 (by the year asked at the start): one line to read it with the family
  const [minor, setMinor] = useState(false);
  useEffect(() => {
    let y = birthYear ?? 0;
    if (!y) {
      try {
        y = Number(localStorage.getItem(BIRTH_YEAR_KEY)) || 0;
      } catch {
        /* no storage */
      }
    }
    setMinor(y > 1900 && new Date().getFullYear() - y < 18);
  }, [birthYear]);
  const [err, setErr] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  // already paid (e.g. the page was reloaded right after paying) → continue the story
  useEffect(() => {
    if (paid && !done.current) {
      done.current = true;
      onPaidRef.current();
    }
  }, [paid]);

  useEffect(() => {
    if (paid) return;
    let cancelled = false;
    let destroy: (() => void) | undefined;
    (async () => {
      try {
        const c = await api.checkout();
        if (cancelled) return;
        if (c.mode === 'demo') {
          setPhase('demo');
          return;
        }
        const { loadStripe } = await import('@stripe/stripe-js');
        const stripe = await loadStripe(c.publishableKey);
        if (!stripe) throw new Error('Stripe を読み込めませんでした');
        const ec = await stripe.createEmbeddedCheckoutPage({
          fetchClientSecret: async () => c.clientSecret,
          onComplete: () => void finish(c.sessionId),
        });
        if (cancelled || !box.current) {
          ec.destroy();
          return;
        }
        destroy = () => ec.destroy();
        setPhase('stripe');
        ec.mount(box.current);
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof ApiError && e.code === 'ALREADY_ORDERED' ? null : e instanceof Error ? e.message : String(e));
        if (e instanceof ApiError && e.code === 'ALREADY_ORDERED') finishNow();
        else setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
      destroy?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, paid]);

  // paid: the golden corona flares out over the screen, then the story goes on
  const finishNow = () => {
    if (done.current) return;
    done.current = true;
    setPhase('done');
    setTimeout(() => onPaidRef.current(), 1600);
  };

  const finish = async (sessionId: string) => {
    setPhase('confirming');
    for (let k = 0; k < 8; k++) {
      try {
        await api.confirm(sessionId);
        finishNow();
        return;
      } catch (e) {
        if (!(e instanceof ApiError && e.code === 'NOT_PAID')) {
          setErr(e instanceof Error ? e.message : String(e));
          break;
        }
        await sleep(1500);
      }
    }
    setErr((x) => x ?? '支払いの確認に時間がかかっています。少し待ってから、もう一度開いてください。');
    setPhase('error');
  };

  const payDemo = async () => {
    setPhase('confirming');
    try {
      await api.demo();
      finishNow();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  };

  if (paid) return null;
  const today = new Date();
  const renewDay = today.getDate();
  const next = new Date(today.getFullYear(), today.getMonth() + 1, Math.min(renewDay, new Date(today.getFullYear(), today.getMonth() + 2, 0).getDate()));
  const nextRenew = next.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
  return (
    <div
      className="pt-safe pb-safe fixed inset-0 z-[90] animate-[fadeUp_0.6s_ease-out] overflow-y-auto"
      style={{ fontFamily: SERIF, background: 'radial-gradient(ellipse at 50% 18%, rgba(255,196,110,0.18) 0%, rgba(40,24,6,0.9) 38%, #050403 72%)' }}
    >
      <div className="mx-auto flex min-h-full max-w-md flex-col px-5 py-6">
        {/* the eclipse: a black sun in a slowly turning golden corona */}
        <div className="relative mx-auto mt-1 h-16 w-16" aria-hidden>
          <span className="absolute inset-0 animate-[spin_28s_linear_infinite] rounded-full opacity-90" style={{ background: 'conic-gradient(from 0deg, rgba(255,214,140,0) 0deg, rgba(255,214,140,0.85) 40deg, rgba(255,240,200,0) 90deg, rgba(255,214,140,0.7) 160deg, rgba(255,214,140,0) 220deg, rgba(255,230,170,0.9) 290deg, rgba(255,214,140,0) 360deg)', filter: 'blur(6px)' }} />
          <span className="absolute inset-[14%] rounded-full bg-black shadow-[0_0_40px_12px_rgba(255,200,120,0.55),inset_0_0_18px_rgba(255,220,160,0.25)]" />
          <span className="absolute inset-[14%] rounded-full ring-1 ring-amber-100/70" />
        </div>
        <p className="mt-4 text-center text-[11px] tracking-[0.6em] text-amber-200/80">ECLIPSE</p>
        <p className="mt-1 text-center text-[26px] tracking-[0.3em] text-amber-50">エクリプス</p>
        <p className="mt-1 text-center text-xs tracking-[0.3em] text-white/55">支払いの最終確認</p>

        <div className="relative mt-5 overflow-hidden rounded-2xl border border-amber-200/45 bg-gradient-to-b from-[#2a1d0b]/90 to-black/90 px-6 py-5 shadow-[0_0_50px_rgba(255,200,120,0.18)]">
          <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-amber-100/80 to-transparent" />
          <p className="text-center text-white/80">
            <span className="text-sm tracking-[0.2em]">月額</span>
            <span className="mx-1.5 text-[40px] leading-none tracking-wide text-amber-50 drop-shadow-[0_0_12px_rgba(255,214,140,0.55)]">{ORDER_PRICE_JPY}</span>
            <span className="text-sm">円</span>
          </p>
          <p className="mt-1 text-center text-[12px] text-white/60">税込・毎月のマナの代金。初回は今日</p>
          <dl className="mt-4 divide-y divide-amber-200/15 text-left text-[13px] leading-relaxed text-white/85">
            <div className="py-2.5">
              <dt className="text-[11px] tracking-[0.2em] text-amber-200/80">毎月の更新日</dt>
              <dd>
                毎月{renewDay}日。次の更新日は{nextRenew}
              </dd>
            </div>
            <div className="py-2.5">
              <dt className="text-[11px] tracking-[0.2em] text-amber-200/80">自動で続きます</dt>
              <dd>やめるまで、毎月の更新日に、月額{ORDER_PRICE_JPY}円のお支払いが自動で行われます</dd>
            </div>
            <div className="py-2.5">
              <dt className="text-[11px] tracking-[0.2em] text-amber-200/80">いつから</dt>
              <dd>支払いが済んだその時から、Obolo Orderの一員です</dd>
            </div>
            <div className="py-2.5">
              <dt className="text-[11px] tracking-[0.2em] text-amber-200/80">支払い方法</dt>
              <dd>クレジットカード・デビットカード（この画面の下で入力します）</dd>
            </div>
            <div className="py-2.5">
              {/* PLACEHOLDER (P-BILL-4): the refund wording is the operator's to confirm */}
              <dt className="text-[11px] tracking-[0.2em] text-amber-200/80">返金</dt>
              <dd>始めた月の分は、返金されません。まちがって二重に支払われた時は、お問い合わせから返金します</dd>
            </div>
            <div className="py-2.5">
              <dt className="text-[11px] tracking-[0.2em] text-amber-200/80">やめ方</dt>
              <dd>〔設定〕→〔エクリプス（月¥88）〕→〔支払い方法の変更・解約〕から、いつでも。やめると、次の更新日から支払いが止まり、その月の終わりまでは使えます。作ったものは消えません</dd>
            </div>
          </dl>
          <p className="mt-2 text-left text-[11px] leading-relaxed text-white/50">入会費はありません。値上げはしません。</p>
          <a href="/tokushoho" target="_blank" rel="noopener" className="mt-2 inline-block text-[11px] text-amber-200/80 underline underline-offset-4">
            特定商取引法に基づく表記
          </a>
        </div>

        {minor && <p className="mt-4 text-center text-[13px] leading-relaxed text-amber-100/90">家の人と一緒に読んでね</p>}

        <div className="mt-4 flex-1">
          {/* Stripe Embedded Checkout mounts here */}
          <div ref={box} className={phase === 'stripe' ? 'overflow-hidden rounded-2xl bg-white' : 'hidden'} />
          {phase === 'loading' && <p className="py-10 text-center text-sm tracking-widest text-amber-100/70">秘密ロケットの手配中……</p>}
          {/* before the check: the button is there already, asleep (story chat 2026-11-02: only 〔戻る〕 could be seen) */}
          {phase === 'confirming' && <p className="py-10 text-center text-sm tracking-widest text-amber-100/80">エクリプスの準備をしています……</p>}
          {phase === 'demo' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-center text-xs text-amber-200/70">デモモード：実際の請求はありません</p>
              <button
                onClick={() => void payDemo()}
                className="w-full rounded-full border border-amber-100/90 bg-gradient-to-b from-[#f6dc9a] via-[#d9a94e] to-[#9c6a1f] py-4 text-lg tracking-[0.4em] text-[#2a1806] shadow-[0_0_36px_rgba(255,210,130,0.45)] active:scale-[0.98]"
              >
                支払う
              </button>
            </div>
          )}
          {phase === 'error' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm font-bold text-rose-300">支払いは完了していません</p>
              {err && <p className="text-xs text-rose-200/70">{err}</p>}
              {/* D08-S006: the payment did not go through */}
              <p className="text-[13px] text-amber-100/90">
                <span className="mr-1 text-[11px] text-amber-200/60">{failLine.who}</span>
                {failLine.text}
              </p>
              <button
                onClick={() => {
                  setErr(null);
                  setPhase('loading');
                  setAttempt((a) => a + 1);
                }}
                className="rounded-full border border-amber-200/60 px-6 py-2.5 text-sm tracking-widest text-amber-100"
              >
                もう一度ためす
              </button>
              <button onClick={onCancel} className="text-xs tracking-widest text-white/50 underline">
                戻る
              </button>
            </div>
          )}
        </div>

        {phase === 'done' && (
          <div className="pointer-events-none fixed inset-0 z-[95] flex items-center justify-center" aria-hidden>
            <span className="h-28 w-28 animate-[coronaFlare_1.6s_cubic-bezier(.2,.7,.2,1)_forwards] rounded-full" style={{ boxShadow: '0 0 60px 30px rgba(255,214,140,0.9), inset 0 0 40px rgba(255,236,190,0.9)' }} />
          </div>
        )}
        {phase !== 'confirming' && phase !== 'done' && (
          <button onClick={onCancel} className="mt-4 w-full rounded-full border border-white/35 py-3 text-sm tracking-[0.3em] text-white/80">
            戻る
          </button>
        )}
      </div>
    </div>
  );
}
