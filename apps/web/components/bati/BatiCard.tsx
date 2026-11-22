'use client';

import { useEffect, useState } from 'react';
import type { BatiCard } from '@obolo/shared';
import { SmallEgg } from './SmallEgg';

/**
 * バティのカード (M-R217): name, birth date, egg, the favourite food as said, personality + 口ぐせ, the introduction.
 * A rare personality's card has a glowing gold edge. Exported as a picture (SNS / wallpaper) by drawing it on a canvas
 * here — no new art (the {bati}'s own picture and shapes).
 */
const eggName = (e: BatiCard['egg']) => (e === 'moon' ? '月のたまご' : '太陽のたまご');
export const bornDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

export function BatiCardView({ card, egg, eggGrowth, onExport }: { card: BatiCard; /** the small egg beside the card (M-R218), no numbers */ egg?: boolean; eggGrowth?: number; onExport?: () => void }) {
  return (
    <div className="relative flex items-end gap-2">
      <div
        className={`relative w-64 overflow-hidden rounded-2xl border-2 bg-gradient-to-b from-[#1d2a52] to-[#0b1027] p-4 text-amber-50 ${
          card.rare ? 'border-amber-300 shadow-[0_0_24px_4px_rgba(255,205,90,0.55)]' : 'border-amber-100/40'
        }`}
      >
        {card.rare && <span className="pointer-events-none absolute inset-0 animate-pulse rounded-2xl ring-2 ring-amber-200/60" />}
        <p className="text-[10px] tracking-[0.3em] text-amber-200/80">
          バティのカード{card.rare ? '　✦ めずらしい' : ''}
          {/* M-R230: the third, born from a wish */}
          {card.wish ? '　☾ ねがいの子' : ''}
        </p>
        <div className="mt-2 flex items-center gap-3">
          {card.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.imageUrl} alt="" className="h-20 w-20 rounded-xl bg-white/5 object-contain" />
          ) : (
            <span className="h-20 w-20 rounded-xl bg-white/5" />
          )}
          <div className="min-w-0">
            <p className="truncate text-xl font-bold">{card.name ?? '……'}</p>
            <p className="text-xs text-amber-100/70">{bornDate(card.bornAt)}生まれ</p>
            <p className="text-xs text-amber-100/70">{eggName(card.egg)}</p>
          </div>
        </div>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="shrink-0 text-amber-200/80">好物</dt>
            <dd className="break-all">{card.seed}</dd>
          </div>
          {/* M-R225: the trait is the card's only (never in the speech); the way of speaking and its 口ぐせ */}
          {card.trait && (
            <div className="flex gap-2">
              <dt className="shrink-0 text-amber-200/80">性格</dt>
              <dd>{card.trait}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="shrink-0 text-amber-200/80">話し方</dt>
            <dd>
              {card.label}｜口ぐせ：{card.catchphrase}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-sm leading-relaxed text-amber-50/90">{card.intro}</p>
        {onExport && (
          <button onClick={onExport} className="mt-3 w-full rounded-full border border-amber-200/50 py-1.5 text-xs tracking-widest text-amber-100">
            画像にする
          </button>
        )}
      </div>
      {egg && <SmallEgg growth={eggGrowth ?? 0} size={22} />}
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((r) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => r(im);
    im.onerror = () => r(null);
    im.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, lh: number) {
  let line = '';
  for (const ch of [...text]) {
    if (ctx.measureText(line + ch).width > w) {
      ctx.fillText(line, x, y);
      y += lh;
      line = ch;
    } else line += ch;
  }
  if (line) ctx.fillText(line, x, y);
  return y + lh;
}

/** the card as a PNG (1080×1920, a phone wallpaper; fits a story post too) */
export async function cardPng(card: BatiCard): Promise<Blob | null> {
  const W = 1080;
  const H = 1920;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1d2a52');
  bg.addColorStop(1, '#05060f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = card.rare ? '#f7cf62' : 'rgba(255,240,210,0.45)';
  ctx.lineWidth = card.rare ? 18 : 8;
  if (card.rare) {
    ctx.shadowColor = 'rgba(255,205,90,0.8)';
    ctx.shadowBlur = 40;
  }
  ctx.strokeRect(60, 60, W - 120, H - 120);
  ctx.shadowBlur = 0;
  const img = card.imageUrl ? await loadImage(card.imageUrl) : null;
  if (img) {
    const s = Math.min(760 / img.width, 760 / img.height);
    ctx.drawImage(img, (W - img.width * s) / 2, 220 + (760 - img.height * s) / 2, img.width * s, img.height * s);
  }
  const font = '"Hiragino Sans", "Noto Sans JP", sans-serif';
  ctx.fillStyle = '#fbe9c0';
  ctx.textAlign = 'center';
  ctx.font = `36px ${font}`;
  ctx.fillText(`バティのカード${card.rare ? ' ✦ めずらしい' : ''}${card.wish ? ' ☾ ねがいの子' : ''}`, W / 2, 160);
  ctx.font = `bold 88px ${font}`;
  ctx.fillText(card.name ?? '……', W / 2, 1100);
  ctx.font = `40px ${font}`;
  ctx.fillText(`${bornDate(card.bornAt)}生まれ・${eggName(card.egg)}`, W / 2, 1175);
  ctx.textAlign = 'left';
  ctx.font = `44px ${font}`;
  let y = wrap(ctx, `好物：${card.seed}`, 140, 1300, W - 280, 60);
  if (card.trait) y = wrap(ctx, `性格：${card.trait}`, 140, y + 10, W - 280, 60);
  y = wrap(ctx, `話し方：${card.label}`, 140, y + 10, W - 280, 60);
  y = wrap(ctx, `口ぐせ：${card.catchphrase}`, 140, y + 10, W - 280, 60);
  ctx.font = `40px ${font}`;
  wrap(ctx, card.intro, 140, y + 40, W - 280, 58);
  return new Promise((r) => {
    try {
      c.toBlob((b) => r(b), 'image/png');
    } catch {
      // a picture from another origin without CORS taints the canvas: the card is drawn again without it
      r(null);
    }
  });
}

/** share (phones) or download the card's picture */
export async function exportCard(card: BatiCard): Promise<boolean> {
  let blob = await cardPng(card);
  if (!blob && card.imageUrl) blob = await cardPng({ ...card, imageUrl: null });
  if (!blob) return false;
  const name = `bati-${card.name ?? 'card'}.png`;
  const file = new File([blob], name, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] });
      return true;
    } catch {
      /* closed: download instead */
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}

/** the 'baticard' story step: the card in the chat, then 〔次へ〕 (no card yet — an old account: it goes on) */
export function BatiCardStep({ card, onNext }: { card?: BatiCard; onNext: () => void }) {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!card) onNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!card) return null;
  return (
    <div className="absolute inset-0 z-[46] flex animate-[fadeIn_0.4s_ease-out] flex-col items-center justify-center gap-5 bg-black/60 px-6">
      <BatiCardView
        card={card}
        onExport={async () => {
          setBusy(true);
          await exportCard(card).catch(() => false);
          setBusy(false);
        }}
      />
      <button onClick={onNext} disabled={busy} className="rounded-full border border-amber-200/80 px-10 py-2.5 tracking-widest text-amber-50 disabled:opacity-40">
        次へ
      </button>
    </div>
  );
}
