'use client';

import { useState } from 'react';
import { Sticker } from '@/components/jupiter/JupiterLesson';
import type { StickerMade } from '@/lib/onboarding/made';

/**
 * The sky atelier's press (L2-URANUS-S003): ① a shape, ② a picture of yours (your jackets, your look; a new
 * drawing is made at the atelier with mana, asked first), ③ turn the handle — a sample rises, ④ 〔自分のアトリエに
 * 飾る〕 or just look. A sample is never an order and never a payment.
 */
const SHAPES = [
  { id: 'tshirt', label: 'Tシャツ', icon: '👕' },
  { id: 'mug', label: 'マグカップ', icon: '☕' },
  { id: 'acrylic', label: 'アクリルスタンド', icon: '🪧' },
  { id: 'sticker', label: 'ステッカー', icon: '🏷️' },
  { id: 'badge', label: '缶バッジ', icon: '🔘' },
  { id: 'tote', label: 'トート', icon: '👜' },
] as const;
type Shape = (typeof SHAPES)[number];
type Phase = 'shape' | 'art' | 'press' | 'sample';

export function GoodsPress({ pictures, onDone }: { pictures: StickerMade[]; onDone: (a: Record<string, string>) => void }) {
  const [phase, setPhase] = useState<Phase>('shape');
  const [shape, setShape] = useState<Shape | null>(null);
  const [art, setArt] = useState<StickerMade | null>(null);
  const [turn, setTurn] = useState(0);
  const btn = 'w-full rounded-full border border-teal-200/50 bg-teal-200/10 py-3 text-[14px] tracking-wider active:scale-[0.98] disabled:opacity-40';
  const soft = 'w-full py-2 text-[13px] text-teal-50/60';
  const press = () => {
    setPhase('press');
    let n = 0;
    const t = setInterval(() => {
      setTurn(++n);
      if (n >= 6) {
        clearInterval(t);
        setPhase('sample');
      }
    }, 220);
  };
  return (
    <div className="absolute inset-0 z-[12] flex items-end justify-center bg-black/55 px-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md animate-[fadeUp_0.5s_ease-out] rounded-3xl border border-teal-100/25 bg-[#071614]/95 p-5 text-teal-50">
        <p className="text-center text-[15px] font-bold tracking-wider">🎨 天空のアトリエ</p>
        {phase === 'shape' && (
          <div className="mt-3 space-y-3">
            <p className="text-center text-[12px] text-teal-50/70">①形を選ぶ</p>
            <div className="grid grid-cols-3 gap-2">
              {SHAPES.map((s) => (
                <button key={s.id} onClick={() => setShape(s)} className={`rounded-2xl py-3 text-center ring-2 ${shape?.id === s.id ? 'bg-teal-200/20 ring-teal-200' : 'bg-white/5 ring-transparent'}`}>
                  <span className="block text-2xl">{s.icon}</span>
                  <span className="text-[11px]">{s.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setShape(SHAPES[Math.floor(Math.random() * SHAPES.length)])} className="mx-auto block rounded-full bg-white/10 px-4 py-1.5 text-[12px]">
              おまかせ！
            </button>
            <button onClick={() => setPhase('art')} disabled={!shape} className={btn}>
              次へ
            </button>
            <button onClick={() => onDone({ goods: 'none' })} className={soft}>
              今は作らない
            </button>
          </div>
        )}
        {phase === 'art' && (
          <div className="mt-3 space-y-3">
            <p className="text-center text-[12px] text-teal-50/70">②のせる絵を選ぶ</p>
            <div className="flex flex-wrap justify-center gap-2">
              {pictures.map((p, k) => (
                <button key={k} onClick={() => setArt(p)} className={`rounded-lg ring-2 ${art === p ? 'ring-teal-200' : 'ring-transparent'}`}>
                  <Sticker s={p} size={84} />
                </button>
              ))}
            </div>
            {!pictures.length && <p className="text-center text-[12px] text-teal-50/60">まだ、のせられる絵がありません。木星でジャケットを作ると、ここに並びます</p>}
            <p className="text-center text-[11px] text-teal-50/50">新しく描く時は、アトリエの〔🎙 話してみよう〕から（描く前に、マナを使うかたずねます）</p>
            <button onClick={press} disabled={!art} className={btn}>
              ③ハンドルを回す
            </button>
            <button onClick={() => setPhase('shape')} className={soft}>
              もどる
            </button>
          </div>
        )}
        {(phase === 'press' || phase === 'sample') && shape && art && (
          <div className="mt-3 space-y-3 text-center">
            <div className="relative mx-auto flex h-44 w-44 items-center justify-center">
              <span className="absolute -right-2 top-2 text-3xl transition-transform duration-200" style={{ transform: `rotate(${turn * 60}deg)` }}>
                ⚙️
              </span>
              <div className={`transition-all duration-700 ${phase === 'sample' ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-30'}`}>
                <div className="relative">
                  <span className="block text-[110px] leading-none">{shape.icon}</span>
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <Sticker s={{ ...art, text: '' }} size={52} />
                  </span>
                </div>
              </div>
            </div>
            {phase === 'sample' && (
              <>
                <p className="text-[13px]">
                  見本：{shape.label}（{art.text}）
                </p>
                <button onClick={() => onDone({ goods: 'display', goods_item: `${shape.label}（${art.text}）`.slice(0, 80) })} className={btn}>
                  ④自分のアトリエに飾る
                </button>
                <button onClick={() => onDone({ goods: 'enough' })} className={soft}>
                  見本を見るだけ
                </button>
                <p className="text-[11px] text-teal-50/50">見本だけでは、注文も支払いもしません</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
