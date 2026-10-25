'use client';

import { ORDER_PRICE_JPY, type OrderCheckout } from '@obolo/shared';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';

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
 * Demo mode (no Stripe key on the server) pays without a charge. Minors are checked on the payment side.
 * PLACEHOLDER (P-BILL-3): the wording must be checked by the operator; the 〔設定〕→〔毎月のマナ〕→〔やめる〕
 * screen does not exist yet (P-BILL-4: the operator stops it in Stripe).
 */
export function EclipsePay({ api, paid, onPaid, onCancel }: { api: OrderApi; paid: boolean; onPaid: () => void; onCancel: () => void }) {
  const [phase, setPhase] = useState<'loading' | 'stripe' | 'demo' | 'confirming' | 'error'>('loading');
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

  const finishNow = () => {
    if (done.current) return;
    done.current = true;
    onPaidRef.current();
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
        <div className="relative mx-auto mt-2 h-28 w-28" aria-hidden>
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
              <dt className="text-[11px] tracking-[0.2em] text-amber-200/80">やめ方</dt>
              <dd>〔設定〕→〔毎月のマナ〕→〔やめる〕から、いつでも。やめると、次の更新日から支払いが止まります。作ったものは消えません</dd>
            </div>
          </dl>
          <p className="mt-2 text-left text-[11px] leading-relaxed text-white/50">入会費はありません。値上げはしません。</p>
        </div>

        <div className="mt-4 flex-1">
          {/* Stripe Embedded Checkout mounts here */}
          <div ref={box} className={phase === 'stripe' ? 'overflow-hidden rounded-2xl bg-white' : 'hidden'} />
          {phase === 'loading' && <p className="py-10 text-center text-sm tracking-widest text-amber-100/70">秘密ロケットの手配中……</p>}
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
              <p className="text-sm text-rose-300">{err ?? 'うまくいかなかった。'}</p>
              <button
                onClick={() => {
                  setErr(null);
                  setPhase('loading');
                  setAttempt((a) => a + 1);
                }}
                className="rounded-full border border-amber-200/60 px-6 py-2.5 text-sm tracking-widest text-amber-100"
              >
                もう一度
              </button>
            </div>
          )}
        </div>

        {phase !== 'confirming' && (
          <button onClick={onCancel} className="mt-4 self-center py-2 text-xs tracking-widest text-white/50 underline">
            戻る
          </button>
        )}
      </div>
    </div>
  );
}
