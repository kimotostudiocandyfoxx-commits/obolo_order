'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Artwork } from '@/components/Artwork';
import { Face, Mic } from '@/components/mercury/ComposeChat';
import { useAuth } from '@/lib/auth';
import { usePartner } from '@/lib/partner';
import { spriteUrl, stillUrl } from '@/lib/onboarding/media';
import { guessKind, makeItem } from '@/lib/venus/make';
import { ITEM_KINDS, ITEMS, MAKERS, type Item, type ItemKind } from '@/lib/venus/shop';
import { useVenus } from '@/lib/venus/state';

/**
 * Venus — the planet of making things (client decision 2026-10-05, docs/venus.md).
 * PLACEHOLDER LAYOUT (P-VENUS-1) until the client's design arrives:
 *  ショップ: goods from friends and follows (NEW = put up in the last 88 hours); buy with ★.
 *  つくる: talk to KIMORIN (Bati once you have one) and they make the goods; set a price and put them
 *     in your shop.
 *  自分の店: your goods on sale (sold count) and your collection.
 * Stars are the only currency — no real money, no real products. Square stage, controls below.
 */
export interface VenusEvents {
  onBuy?: () => void;
  onMyShop?: () => void;
  onMake?: () => void;
  onList?: () => void;
}

type View = 'shop' | 'make' | 'mine';

export function VenusWorld({ events, overlay }: { events?: VenusEvents; overlay?: ReactNode }) {
  const v = useVenus();
  const [view, setView] = useState<View>('shop');
  const [tab, setTab] = useState<'all' | 'follow' | 'friend'>('all');
  const [open, setOpen] = useState<Item | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const ev = useRef(events);
  ev.current = events;

  const say = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 2200);
  };

  // While the shop is open, now and then someone buys one of your goods (demo).
  const shopRef = useRef(v.shop);
  shopRef.current = v.shop;
  useEffect(() => {
    const id = setInterval(() => {
      const mine = shopRef.current;
      if (!mine.length || Math.random() < 0.5) return;
      const item = mine[Math.floor(Math.random() * mine.length)];
      const who = MAKERS[Math.floor(Math.random() * MAKERS.length)];
      v.sold(item.id);
      say(`🛍 @${who.handle} が「${item.name}」を買いました ＋★${item.price}`);
    }, 9000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (next: View) => {
    setView(next);
    if (next === 'mine') ev.current?.onMyShop?.();
    if (next === 'make') ev.current?.onMake?.();
  };
  const items = ITEMS.filter((i) => tab === 'all' || (tab === 'follow' ? i.follow : i.friend));

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#2a0f2a] text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={stillUrl('venus-market')} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40" aria-hidden />

      <div className="relative flex items-center gap-2 px-3 pt-[calc(10px+env(safe-area-inset-top))]">
        <p className="text-sm font-black tracking-[0.3em] text-amber-200">VENUS MARKET</p>
        <span className="ml-auto rounded-full border border-amber-300/60 bg-black/40 px-3 py-1 text-sm font-bold text-amber-200">★ {v.stars}</span>
      </div>

      {view === 'shop' && (
        <div className="relative min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <div className="mx-auto mt-2 flex max-w-md rounded-full border border-white/15 bg-black/30 p-1">
            {(
              [
                ['all', '全部'],
                ['follow', 'フォロー'],
                ['friend', 'ダチ'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-full py-1.5 text-sm ${tab === k ? 'bg-white/10 font-bold text-amber-200' : 'text-white/70'}`}>
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-[11px] text-white/50">星（★）で買えるグッズ・アイテム。本物のお金は使いません</p>
          <div className="mx-auto mt-3 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((i) => (
              <ItemCard key={i.id} item={i} owned={v.collection.some((c) => c.id === i.id)} onClick={() => setOpen(i)} />
            ))}
          </div>
        </div>
      )}

      {view === 'make' && (
        <MakeChat
          onList={(item) => {
            v.list(item);
            say(`🏪「${item.name}」を店に並べました（★${item.price}）`);
            ev.current?.onList?.();
          }}
          onOpenShop={() => go('mine')}
        />
      )}

      {view === 'mine' && <MyShop shop={v.shop} collection={v.collection} stars={v.stars} onOpen={setOpen} />}

      <nav className="relative z-20 mx-auto mb-[calc(10px+env(safe-area-inset-bottom))] flex w-[min(94%,560px)] items-center justify-around rounded-[2rem] border border-white/10 bg-black/50 px-6 py-2.5 backdrop-blur">
        <button onClick={() => go('shop')} className={`flex flex-col items-center text-xs ${view === 'shop' ? 'text-amber-200' : 'text-white/60'}`}>
          <span className="text-2xl">🛍</span>ショップ
        </button>
        <button onClick={() => go('make')} className={`-mt-8 flex flex-col items-center text-xs ${view === 'make' ? 'text-amber-200' : ''}`}>
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-pink-500 to-fuchsia-600 text-2xl shadow-[0_0_24px_rgba(255,120,200,0.6)]">🛠</span>
          つくる
        </button>
        <button onClick={() => go('mine')} className={`flex flex-col items-center text-xs ${view === 'mine' ? 'text-amber-200' : 'text-white/60'}`}>
          <span className="text-2xl">🏪</span>自分の店
        </button>
      </nav>

      {open && (
        <div className="absolute inset-0 z-[90] flex items-end justify-center bg-black/60" onClick={() => setOpen(null)}>
          <div className="w-full max-w-md rounded-t-3xl border-t border-amber-300/30 bg-gradient-to-b from-[#3a1438] to-[#1a0a1a] p-5 pb-[calc(24px+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto w-40 overflow-hidden rounded-3xl">
              <Artwork hue={open.hue} emoji={open.emoji} className="w-full" />
            </div>
            <p className="mt-3 text-center text-lg font-black">{open.name}</p>
            <p className="text-center text-xs text-white/60">
              {open.kind} ・ つくった人 @{open.maker}
            </p>
            {open.maker === 'you' || v.shop.some((s) => s.id === open.id) ? (
              <p className="mt-4 text-center text-sm text-amber-200">あなたの店の商品です（★{open.price}）</p>
            ) : v.collection.some((c) => c.id === open.id) ? (
              <p className="mt-4 text-center text-sm text-emerald-300">✓ コレクションに入っています</p>
            ) : (
              <button
                onClick={() => {
                  if (v.stars < open.price) {
                    say('星が足りません。ほかの惑星で星を集めよう');
                    return;
                  }
                  v.buy(open);
                  say(`✨「${open.name}」を買いました −★${open.price}`);
                  setOpen(null);
                  ev.current?.onBuy?.();
                }}
                className="mt-4 w-full rounded-full bg-gradient-to-r from-amber-400 to-pink-500 py-3 font-bold"
              >
                ★{open.price} で買う
              </button>
            )}
          </div>
        </div>
      )}
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(48px+env(safe-area-inset-top))] z-[95] flex justify-center px-4">
          <span className="rounded-full bg-black/80 px-4 py-2 text-center text-sm">{toast}</span>
        </div>
      )}
      {overlay}
    </div>
  );
}

function ItemCard({ item, owned, onClick }: { item: Item; owned?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="relative overflow-hidden rounded-2xl border border-amber-300/25 bg-black/40 text-left shadow-lg">
      <Artwork hue={item.hue} emoji={item.emoji} className="w-full" />
      {item.isNew && <span className="absolute left-2 top-2 rounded-full bg-pink-500 px-2 text-[10px] font-bold">NEW</span>}
      {owned && <span className="absolute right-2 top-2 rounded-full bg-emerald-500 px-2 text-[10px] font-bold">✓</span>}
      <div className="p-2">
        <p className="truncate text-sm font-bold">{item.name}</p>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/60">
          {item.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={spriteUrl(item.avatar)} alt="" className="h-4 w-4 rounded-full" />
          ) : (
            <span>🦊</span>
          )}
          <span className="truncate">@{item.maker}</span>
          <span className="ml-auto font-bold text-amber-200">★{item.price}</span>
        </div>
      </div>
    </button>
  );
}

function MyShop({ shop, collection, stars, onOpen }: { shop: Item[]; collection: Item[]; stars: number; onOpen: (i: Item) => void }) {
  const { me } = useAuth();
  const earned = shop.reduce((a, i) => a + i.sold * i.price, 0);
  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto px-3 pb-4">
      <div className="mx-auto mt-2 max-w-3xl rounded-3xl border border-amber-300/40 bg-black/40 p-4 text-center">
        <p className="text-lg font-black tracking-wide text-amber-100">🏪 {(me?.displayName || 'neo').toUpperCase()} SHOP</p>
        <p className="mt-1 text-xs text-white/65">
          売上 ★{earned} ・ 持っている星 ★{stars}
        </p>
      </div>
      <h3 className="mx-auto mb-2 mt-4 max-w-3xl text-xs tracking-widest text-white/60">店に並べている商品</h3>
      {shop.length ? (
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
          {shop.map((i) => (
            <ItemCard key={i.id} item={i} onClick={() => onOpen(i)} />
          ))}
        </div>
      ) : (
        <p className="mx-auto max-w-3xl text-xs text-white/45">まだ商品はありません。「つくる」でグッズを作って、店に並べよう。</p>
      )}
      <h3 className="mx-auto mb-2 mt-5 max-w-3xl text-xs tracking-widest text-white/60">コレクション（買ったもの）</h3>
      {collection.length ? (
        <div className="mx-auto grid max-w-3xl grid-cols-3 gap-2 sm:grid-cols-4">
          {collection.map((i) => (
            <button key={i.id} onClick={() => onOpen(i)} className="overflow-hidden rounded-xl" title={i.name}>
              <Artwork hue={i.hue} emoji={i.emoji} className="w-full" />
            </button>
          ))}
        </div>
      ) : (
        <p className="mx-auto max-w-3xl text-xs text-white/45">まだ何も持っていません。ショップで気に入ったものを集めよう。</p>
      )}
    </div>
  );
}

type Msg = { who: 'partner' | 'me'; text: string } | { who: 'item'; item: Item };
const PRICES = [3, 5, 10, 20];
const IDEAS = ['ラーメンのステッカー', '狐のバッジ', '星のぼうし', '猫のおきもの'];

function MakeChat({ onList, onOpenShop }: { onList: (i: Item) => void; onOpenShop: () => void }) {
  const { me } = useAuth();
  const partner = usePartner();
  const hasBati = partner.isBati;
  const [msgs, setMsgs] = useState<Msg[]>([
    { who: 'partner', text: hasBati ? '何をつくる？ 作りたいものを話して。わたしが形にするね。' : '何をつくるケン？ 作りたいものを話してみろ。オレが形にしてやるケン。' },
  ]);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [listed, setListed] = useState<Set<string>>(new Set());
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs, busy, pending]);

  const say = (t: string) => setMsgs((m) => [...m, { who: 'partner', text: t }]);
  const send = (value = text) => {
    const t = value.trim();
    if (!t || busy) return;
    setText('');
    setMsgs((m) => [...m, { who: 'me', text: t }]);
    setPending(t);
    setTimeout(() => say(`いいね！ どんな形にする${hasBati ? '？' : 'ケン？'}`), 500);
  };
  const make = (k: ItemKind | 'auto') => {
    if (!pending) return;
    const kind = k === 'auto' ? guessKind(pending) : k;
    setMsgs((m) => [...m, { who: 'me', text: k === 'auto' ? 'おまかせ！' : kind }]);
    const words = pending;
    setPending(null);
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setMsgs((m) => [...m, { who: 'partner', text: hasBati ? 'できたよ！ いくらで売る？' : 'できたケン！ いくらで売る？' }, { who: 'item', item: { ...makeItem(words, kind, 'you'), maker: me?.displayName || 'you' } }]);
    }, 2000);
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2">
        <Face face={partner.face} size={36} />
        <p className="text-sm font-bold">{partner.name}とつくる（仮の画面）</p>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.map((m, i) =>
          m.who === 'item' ? (
            <div key={i} className="mx-auto w-full max-w-xs rounded-3xl border border-amber-300/30 bg-gradient-to-b from-[#3a1438] to-[#1a0a1a] p-4 shadow-xl">
              <div className="mx-auto w-32 overflow-hidden rounded-2xl">
                <Artwork hue={m.item.hue} emoji={m.item.emoji} className="w-full" />
              </div>
              <p className="mt-2 text-center font-black">{m.item.name}</p>
              <p className="text-center text-[11px] text-white/55">{m.item.kind}</p>
              {listed.has(m.item.id) ? (
                <button onClick={onOpenShop} className="mt-3 w-full rounded-full border border-amber-200/50 py-2 text-sm">
                  🏪 店に並べました → 自分の店を見る
                </button>
              ) : (
                <>
                  <p className="mt-3 text-center text-[11px] text-white/60">値段（★）</p>
                  <div className="mt-1 flex justify-center gap-2">
                    {PRICES.map((p) => (
                      <button key={p} onClick={() => setPrices((s) => ({ ...s, [m.item.id]: p }))} className={`rounded-full px-3 py-1 text-xs ${(prices[m.item.id] ?? 5) === p ? 'bg-amber-400 font-bold text-black' : 'bg-white/10'}`}>
                        ★{p}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      const item = { ...m.item, price: prices[m.item.id] ?? 5 };
                      onList(item);
                      setListed((s) => new Set(s).add(m.item.id));
                      say(hasBati ? '店に並べたよ。売れたら星が入るね！' : '店に並べたケン。売れたら星が入るぞ！');
                    }}
                    className="mt-3 w-full rounded-full bg-gradient-to-r from-amber-400 to-pink-500 py-2.5 text-sm font-bold"
                  >
                    🏪 店に並べる
                  </button>
                </>
              )}
            </div>
          ) : (
            <div key={i} className={`flex items-end gap-2 ${m.who === 'me' ? 'justify-end' : ''}`}>
              {m.who === 'partner' && <Face face={partner.face} size={32} />}
              <p className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${m.who === 'me' ? 'rounded-br-sm bg-pink-600/90' : 'rounded-bl-sm bg-white/10'}`}>{m.text}</p>
            </div>
          ),
        )}
        {pending && !busy && (
          <div className="flex flex-wrap justify-end gap-2">
            {ITEM_KINDS.map((k) => (
              <button key={k} onClick={() => make(k)} className="rounded-full border border-pink-300/50 bg-pink-500/15 px-3 py-1.5 text-xs">
                {k}
              </button>
            ))}
            <button onClick={() => make('auto')} className="rounded-full bg-gradient-to-r from-amber-400 to-pink-500 px-3 py-1.5 text-xs font-bold">
              おまかせ
            </button>
          </div>
        )}
        {busy && (
          <div className="flex items-end gap-2">
            <Face face={partner.face} size={32} />
            <p className="animate-pulse rounded-2xl rounded-bl-sm bg-white/10 px-3 py-2 text-sm">🛠 つくっています…</p>
          </div>
        )}
        <div ref={end} />
      </div>
      {msgs.length === 1 && (
        <div className="flex flex-wrap gap-2 px-3 pb-2">
          {IDEAS.map((idea) => (
            <button key={idea} onClick={() => send(idea)} className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/80">
              {idea}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2">
        <Mic value={text} onChange={setText} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && send()}
          placeholder="作りたいものを話してみよう"
          className="min-w-0 flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm outline-none"
        />
        <button onClick={() => send()} disabled={!text.trim() || busy} className="rounded-full bg-pink-600 px-4 py-2.5 text-sm font-bold disabled:opacity-40">
          送る
        </button>
      </div>
    </div>
  );
}
