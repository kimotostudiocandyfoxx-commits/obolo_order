'use client';

import { isActiveMember, MANA_GEMS, membershipEnded, type GemCheckout, type ManaGem } from '@obolo/shared';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ApiError, getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/** open the 〔マナジェムを買う〕 sheet from anywhere (the wallet, the settings); NoManaNotice hosts it */
export const openManaGems = () => window.dispatchEvent(new Event('obolo:managems'));
/** the mana balance changed (a gem was bought): ManaChip, the Earth wallet and the settings read it again */
export const WALLET_CHANGED = 'obolo:wallet';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const yen = (n: number) => n.toLocaleString('ja-JP');

type Phase = { k: 'pick' } | { k: 'loading'; gem: ManaGem } | { k: 'stripe'; gem: ManaGem } | { k: 'confirming'; gem: ManaGem } | { k: 'done'; gem: ManaGem; added: number; balance: number; note?: string } | { k: 'error'; gem: ManaGem; msg: string };

/**
 * P-BILL-1: 〔マナジェムを買う〕 — the three gems (MANA_GEMS: price and the mana each adds). A gem opens Stripe Embedded
 * Checkout in the sheet (one-time payment, the same UI as the Eclipse); when it completes the server adds the mana
 * (POST /billing/gems/confirm, once per session) and the balance is read again. Demo mode adds the mana at once.
 * Active members only (isActiveMember); a resident is offered the Eclipse elsewhere, an ended member 〔もう一度はじめる〕.
 */
export function ManaGemSheet({ lead, onClose }: { lead?: { who: string; text: string }; onClose: () => void }) {
  const { me } = useAuth();
  const [phase, setPhase] = useState<Phase>({ k: 'pick' });
  const box = useRef<HTMLDivElement>(null);
  const destroy = useRef<(() => void) | undefined>(undefined);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  useEffect(() => () => destroy.current?.(), []);

  const member = isActiveMember(me);
  const ended = membershipEnded(me);

  const credited = (gem: ManaGem, added: number, balance: number, note?: string) => {
    destroy.current?.();
    destroy.current = undefined;
    window.dispatchEvent(new CustomEvent(WALLET_CHANGED, { detail: { manaBalance: balance } }));
    setPhase({ k: 'done', gem, added, balance, note });
  };

  const confirm = async (gem: ManaGem, sessionId: string) => {
    setPhase({ k: 'confirming', gem });
    for (let k = 0; k < 8; k++) {
      try {
        const c = await getApi().confirmGem(sessionId);
        credited(gem, c.manaAdded, c.manaBalance);
        return;
      } catch (e) {
        if (!(e instanceof ApiError && e.code === 'NOT_PAID')) {
          setPhase({ k: 'error', gem, msg: e instanceof Error ? e.message : String(e) });
          return;
        }
        await sleep(1500);
      }
    }
    setPhase({ k: 'error', gem, msg: '支払いの確認に時間がかかっています。少しあとで、マナの残りを見てください（支払いが済んでいれば、自動で加わります）。' });
  };

  const buy = async (gem: ManaGem) => {
    setPhase({ k: 'loading', gem });
    try {
      const c: GemCheckout = await getApi().gemCheckout(gem.id);
      if (c.mode === 'demo') {
        credited(gem, c.credit.manaAdded, c.credit.manaBalance, c.note);
        return;
      }
      const { loadStripe } = await import('@stripe/stripe-js');
      const stripe = await loadStripe(c.publishableKey);
      if (!stripe) throw new Error('Stripe を読み込めませんでした');
      const ec = await stripe.createEmbeddedCheckoutPage({
        fetchClientSecret: async () => c.clientSecret,
        onComplete: () => void confirm(gem, c.sessionId),
      });
      destroy.current = () => ec.destroy();
      setPhase({ k: 'stripe', gem });
      // the box is rendered (hidden) in every phase, so it is there to mount into
      if (box.current) ec.mount(box.current);
    } catch (e) {
      setPhase({ k: 'error', gem, msg: e instanceof ApiError && e.code === 'MEMBERS_ONLY' ? 'マナジェムは、Obolo Order の方だけが買えます' : e instanceof Error ? e.message : String(e) });
    }
  };

  const back = () => {
    destroy.current?.();
    destroy.current = undefined;
    setPhase({ k: 'pick' });
  };
  const busy = phase.k === 'loading' || phase.k === 'confirming';

  if (!host) return null;
  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-end justify-center bg-black/65" onClick={() => !busy && onClose()} role="dialog" aria-label="マナジェムを買う">
      <div
        className="pb-safe max-h-[92svh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-sky-200/25 bg-[#0b1020] px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-5 text-sky-50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" aria-hidden />
        {lead && phase.k === 'pick' && (
          <div className="mb-4 text-center">
            <p className="text-[11px] tracking-[0.3em] text-sky-200/70">{lead.who}</p>
            <p className="mt-1 text-[15px] leading-relaxed">{lead.text}</p>
          </div>
        )}
        <h2 className="text-center text-base font-black tracking-[0.2em] text-[color:var(--color-mana)]">マナジェムを買う</h2>

        {!member ? (
          <div className="mt-4 text-center text-[13px] leading-relaxed text-sky-100/80">
            <p>マナジェムは、Obolo Order の方が買えます。</p>
            {ended && (
              <Link href="/settings/order-again" onClick={onClose} className="mt-4 block w-full rounded-full border border-amber-200/60 py-3 tracking-[0.2em] text-amber-100">
                エクリプスをもう一度はじめる
              </Link>
            )}
          </div>
        ) : phase.k === 'pick' ? (
          <>
            <p className="mt-1 text-center text-[12px] text-sky-100/60">マナが足りない時に。買ったその時に、マナが加わります</p>
            <ul className="mt-4 space-y-2.5">
              {MANA_GEMS.map((g) => (
                <li key={g.id}>
                  <button
                    onClick={() => void buy(g)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-sky-200/30 bg-sky-200/[0.06] px-4 py-3.5 text-left active:scale-[0.99]"
                  >
                    <GemIcon size={g.priceJpy} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] font-black tabular-nums text-[color:var(--color-mana)]">＋{yen(g.mana)} マナ</span>
                      <span className="block text-[11px] text-sky-100/55">マナジェム</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-sky-100 px-3.5 py-1.5 text-[14px] font-black tabular-nums text-[#0b1020]">{yen(g.priceJpy)}円</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[11px] leading-relaxed text-sky-100/50">
              価格は税込です。お支払いはクレジットカード（Stripe）。マナはアプリの中だけで使え、人にあげたり、お金に換えたりはできません。デジタルの品のため、マナが加わった後の返金はできません（法律で必要な場合を除きます）。
            </p>
            <a href="/tokushoho" target="_blank" rel="noopener" className="mt-1 inline-block text-[11px] text-sky-200/80 underline underline-offset-4">
              特定商取引法に基づく表記
            </a>
          </>
        ) : (
          <div className="mt-3">
            <p className="text-center text-[13px] text-sky-100/80">
              マナジェム {yen(phase.gem.priceJpy)}円（＋{yen(phase.gem.mana)} マナ）
            </p>
            {phase.k === 'loading' && <p className="py-10 text-center text-sm tracking-widest text-sky-100/70">マナジェムを用意しています……</p>}
            {phase.k === 'confirming' && <p className="py-10 text-center text-sm tracking-widest text-sky-100/70">マナを加えています……</p>}
            {phase.k === 'done' && (
              <div className="py-6 text-center">
                <p className="text-2xl font-black tabular-nums text-[color:var(--color-mana)]">＋{yen(phase.added)} マナ</p>
                <p className="mt-2 text-[13px] text-sky-100/75">マナの残り：{yen(phase.balance)}</p>
                {phase.note && <p className="mt-2 text-[11px] text-amber-200/80">{phase.note}</p>}
              </div>
            )}
            {phase.k === 'error' && (
              <div className="py-6 text-center">
                <p className="text-sm font-bold text-rose-300">マナジェムは、まだ買えていません</p>
                <p className="mt-1 text-xs text-rose-200/70">{phase.msg}</p>
              </div>
            )}
          </div>
        )}
        {/* Stripe Embedded Checkout mounts here */}
        <div ref={box} className={phase.k === 'stripe' ? 'mt-3 overflow-hidden rounded-2xl bg-white' : 'hidden'} />

        {phase.k === 'done' ? (
          <button onClick={onClose} className="mt-3 w-full rounded-full border border-sky-200/50 bg-sky-200/10 py-3 tracking-[0.2em]">
            とじる
          </button>
        ) : phase.k === 'stripe' || phase.k === 'error' ? (
          <button onClick={back} className="mt-3 w-full py-2 text-sm text-sky-100/60">
            ほかのジェムを選ぶ
          </button>
        ) : (
          !busy && (
            <button onClick={onClose} className="mt-3 w-full py-2 text-sm text-sky-100/60">
              今はいい
            </button>
          )
        )}
      </div>
    </div>,
    host,
  );
}

/** a cut gem, bigger and brighter for the bigger ones */
function GemIcon({ size }: { size: number }) {
  const s = size >= 8888 ? 40 : size >= 888 ? 34 : 28;
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center" aria-hidden>
      <svg width={s} height={s} viewBox="0 0 32 32">
        <defs>
          <linearGradient id={`g${size}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e0f2ff" />
            <stop offset="0.5" stopColor="#7cc4ff" />
            <stop offset="1" stopColor="#6d5cff" />
          </linearGradient>
        </defs>
        <path d="M9 4h14l7 8-14 17L2 12z" fill={`url(#g${size})`} stroke="#e0f2ff" strokeOpacity="0.7" strokeWidth="1" />
        <path d="M2 12h28M9 4l7 25M23 4l-7 25M9 4l-2 8M23 4l2 8" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="0.8" fill="none" />
      </svg>
    </span>
  );
}
