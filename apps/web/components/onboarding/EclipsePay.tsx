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
    <div className="pt-safe pb-safe fixed inset-0 z-[90] animate-[fadeUp_0.5s_ease-out] overflow-y-auto bg-black/85 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-4 py-6">
        <div className="relative overflow-hidden rounded-3xl border border-amber-200/40 bg-gradient-to-b from-amber-200/10 to-black px-6 py-5 text-center">
          <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-200/20 blur-2xl" />
          <p className="text-[11px] tracking-[0.5em] text-amber-200/70">ECLIPSE</p>
          <p className="mt-1 text-lg tracking-[0.2em] text-amber-50">エクリプス</p>
          <p className="mt-1 text-xs tracking-widest text-white/50">支払いの最終確認</p>
          <dl className="mt-3 space-y-2.5 text-left text-[13px] leading-relaxed text-white/80">
            <div>
              <dt className="text-[11px] text-amber-200/70">値段</dt>
              <dd>
                月額<span className="mx-0.5 text-lg text-amber-100">{ORDER_PRICE_JPY}円</span>（税込・毎月のマナの代金）。初回は今日
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-amber-200/70">毎月の更新日</dt>
              <dd>
                毎月{renewDay}日。次の更新日は{nextRenew}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-amber-200/70">自動で続きます</dt>
              <dd>やめるまで、毎月の更新日に、月額{ORDER_PRICE_JPY}円のお支払いが自動で行われます</dd>
            </div>
            <div>
              <dt className="text-[11px] text-amber-200/70">やめ方</dt>
              <dd>〔設定〕→〔毎月のマナ〕→〔やめる〕から、いつでも。やめると、次の更新日から支払いが止まります。作ったものは消えません</dd>
            </div>
          </dl>
          <p className="mt-3 text-left text-[10px] leading-relaxed text-white/40">入会費はありません。値上げはしません。</p>
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
                className="w-full rounded-full border border-amber-200/80 bg-gradient-to-b from-amber-200/25 to-amber-500/10 py-3.5 text-lg tracking-[0.25em] text-amber-50 shadow-[0_0_30px_rgba(255,210,130,0.3)]"
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
