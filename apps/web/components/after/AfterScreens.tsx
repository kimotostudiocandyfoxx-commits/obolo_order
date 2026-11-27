'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AtelierScreen } from '@/components/atelier/AtelierScreen';
import { SaturnStage } from '@/components/neptune/NagareTrial';
import { VoiceField } from '@/components/onboarding/StoryExtras';
import { NeoOwl } from '@/components/uranus/NeoOwl';
import { type Book, loadDrawer, putInDrawer } from '@/components/uranus/drawer';
import { getApi } from '@/lib/api';
import { realLessonApi, type LessonApi } from '@/lib/onboarding/lessonApi';
import type { StoryVars } from '@/lib/onboarding/script';
import { Glyph } from '@/components/bluena/glyphs';
import { LineIcon } from '@/components/LineIcon';

/**
 * The making screens of the outer planets' days — days 8–10 of the first journey since M-R341 (lib/onboarding/outer.ts),
 * and the days after joining of the eight-day journey's accounts (lib/onboarding/after.ts); script P05m: goods on Uranus, a story on
 * Pluto, a little game on Neptune — made in the Moon atelier (AtelierScreen), kept in Bluena, shown on the planet.
 * The real makers are not built yet, so these are the simplest honest versions with what exists:
 * - goods: one of your own works from the journey on a goods mock-up (no new picture, no order, no payment);
 * - a story: your own words become the spell cards; members get the feather pen's story from the existing story
 *   writer (getApi().writeStory, mana asked first by the story), the review pages your own words as the pages;
 * - a game: your art as the background, your song as the BGM, your kororin catching notes (made here, no server).
 * What is kept stays on this device (「Bluena」 below = this device's drawer) until the server keeps these folders;
 * 〔公開する〕 is shown, and says plainly that nobody else sees it yet. No character lines here: they are the story's.
 */
export type AfterWhat =
  | 'm-goods' | 'm-publish-goods' | 'm-shop' | 'm-shop-locked'
  | 'm-story-seed' | 'm-story-cards' | 'm-story-write' | 'm-picturebook' | 'm-publish-book'
  | 'm-nagare' | 'm-game-seed' | 'm-game-cards' | 'm-game-play' | 'm-publish-game';

type Done = (a: Record<string, string>) => void;
type Art = { text: string; url: string | null };

const BLUENA_KEY = 'obolo.bluena.after';
type Kept = { goods?: { shape: string; art: Art }; game?: { title: string; cards: string[] } };
function loadKept(): Kept {
  try {
    return JSON.parse(localStorage.getItem(BLUENA_KEY) ?? '{}') as Kept;
  } catch {
    return {};
  }
}
function keep(k: Kept) {
  try {
    localStorage.setItem(BLUENA_KEY, JSON.stringify({ ...loadKept(), ...k }));
  } catch {
    /* private window: it shows this time only */
  }
}

/** your works from the journey (Bluena): Jupiter's stickers, else the words of your kororins, else your look */
function myArts(v: StoryVars): Art[] {
  const arts: Art[] = [...(v.made?.stickers ?? [])];
  if (v.look) arts.push({ text: v.neo || v.name, url: v.look });
  for (const w of v.made?.kororins ?? []) if (arts.length < 6) arts.push({ text: w, url: null });
  return arts.length ? arts : [{ text: v.neo || v.name || '★', url: null }];
}

const btn = 'w-full rounded-full border border-sky-200/60 bg-sky-200/15 py-3 text-[14px] font-bold tracking-wider text-sky-50 active:scale-[0.98] disabled:opacity-40';
const sub = 'w-full py-1.5 text-[12px] text-white/60';

/** the Moon atelier over the planet (top) and the controls (bottom) */
function Workshop({ v, children, panel, closing, caption }: { v: StoryVars; children?: ReactNode; panel: ReactNode; closing?: boolean; caption?: string }) {
  return (
    <div className="absolute inset-0 z-[12] flex flex-col bg-black/35">
      <div className="relative min-h-[48svh] flex-1">
        <AtelierScreen bati={{ name: v.bati, image: v.batiImage }} closing={closing} caption={caption ?? '月で作る'}>
          {children}
        </AtelierScreen>
      </div>
      <div className="relative z-[13] mx-auto w-full max-w-md space-y-2 rounded-t-3xl border-t border-sky-100/20 bg-[#070b1e]/92 p-4 pb-[calc(16px+env(safe-area-inset-bottom))] text-sky-50">{panel}</div>
    </div>
  );
}

/** a moment shown on the planet itself (publishing): tap or wait */
function Moment({ children, note, onDone, bg = 'bg-black/40' }: { children: ReactNode; note: string; onDone: () => void; bg?: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 2600);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={`absolute inset-0 z-[12] flex flex-col items-center justify-end overflow-hidden ${bg} px-4 pb-[calc(20px+env(safe-area-inset-bottom))]`}>
      <div className="relative flex w-full max-w-sm flex-1 items-center justify-center">{children}</div>
      <p className="mb-2 text-center text-[11px] text-white/60">{note}</p>
      <button onClick={onDone} disabled={!ready} className={`${btn} max-w-xs`}>
        つぎへ
      </button>
    </div>
  );
}

function ArtTile({ art, size = 64 }: { art: Art; size?: number }) {
  return art.url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={art.url} alt="" className="rounded-lg object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex items-center justify-center rounded-lg bg-amber-100 p-1 text-center font-bold leading-tight text-amber-900" style={{ width: size, height: size, fontSize: Math.max(9, size / 7) }}>
      {art.text}
    </span>
  );
}

// --- 天王星：グッズ ----------------------------------------------------------------------------------------------

const SHAPES = [
  { id: 'tshirt', label: 'Tシャツ' },
  { id: 'mug', label: 'マグカップ' },
  { id: 'acrylic', label: 'アクリルスタンド' },
  { id: 'sticker', label: 'ステッカー' },
  { id: 'badge', label: '缶バッジ' },
  { id: 'tote', label: 'トート' },
  { id: 'auto', label: 'おまかせ！' },
] as const;

/** the sample: the art on the chosen shape, drawn with shapes only */
function Mock({ shape, art, size = 150 }: { shape: string; art: Art; size?: number }) {
  const inner = <ArtTile art={art} size={size * 0.42} />;
  const s = size;
  switch (shape) {
    case 'tshirt':
      return (
        <div className="relative" style={{ width: s, height: s }}>
          <svg viewBox="0 0 100 100" className="absolute inset-0">
            <path d="M30 8 L42 4 Q50 12 58 4 L70 8 L94 26 L82 40 L74 34 L74 96 L26 96 L26 34 L18 40 L6 26 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
          </svg>
          <div className="absolute left-1/2 top-[32%] -translate-x-1/2">{inner}</div>
        </div>
      );
    case 'mug':
      return (
        <div className="relative" style={{ width: s, height: s * 0.85 }}>
          <div className="absolute right-0 top-[22%] h-[46%] w-[26%] rounded-r-full border-[6px] border-l-0 border-slate-100" />
          <div className="absolute inset-y-0 left-0 flex w-[78%] items-center justify-center rounded-b-3xl rounded-t-lg bg-slate-50 shadow-inner">{inner}</div>
        </div>
      );
    case 'acrylic':
      return (
        <div className="flex flex-col items-center" style={{ width: s }}>
          <div className="rounded-2xl border-2 border-white/80 bg-white/25 p-2 shadow-[0_0_12px_rgba(255,255,255,0.5)] backdrop-blur">
            <ArtTile art={art} size={s * 0.55} />
          </div>
          <div className="h-3 w-[70%] rounded-full bg-white/50" />
        </div>
      );
    case 'badge':
      return (
        <div className="flex items-center justify-center overflow-hidden rounded-full border-4 border-slate-200 bg-white shadow-lg" style={{ width: s * 0.7, height: s * 0.7 }}>
          <ArtTile art={art} size={s * 0.62} />
        </div>
      );
    case 'tote':
      return (
        <div className="relative" style={{ width: s * 0.8, height: s }}>
          <div className="absolute left-[22%] top-0 h-[30%] w-[56%] rounded-t-full border-[5px] border-b-0 border-amber-100" />
          <div className="absolute inset-x-0 bottom-0 top-[24%] flex items-center justify-center rounded-md bg-amber-50 shadow">{inner}</div>
        </div>
      );
    default:
      // sticker
      return (
        <div className="rounded-3xl bg-white p-1.5 shadow-lg" style={{ transform: 'rotate(-6deg)' }}>
          <ArtTile art={art} size={s * 0.6} />
        </div>
      );
  }
}

function GoodsMaker({ v, onDone }: { v: StoryVars; onDone: Done }) {
  const arts = myArts(v);
  const [shape, setShape] = useState<string | null>(null);
  const [art, setArt] = useState<Art | null>(null);
  const [made, setMade] = useState(false);
  const [closing, setClosing] = useState(false);
  const realShape = useRef<string>('sticker');
  const turn = () => {
    realShape.current = shape === 'auto' ? SHAPES[Math.floor(Math.random() * 6)].id : (shape ?? 'sticker');
    setMade(true);
  };
  const finish = () => {
    const a = art ?? arts[0];
    keep({ goods: { shape: realShape.current, art: a } });
    setClosing(true);
    setTimeout(() => onDone({ f_m_uranus_template: shape ?? 'auto', goods_art: a.text.slice(0, 40) }), 600);
  };
  return (
    <Workshop
      v={v}
      closing={closing}
      panel={
        !made ? (
          <>
            <p className="text-[11px] text-sky-50/60">①形を選ぶ</p>
            <div className="flex flex-wrap gap-1.5">
              {SHAPES.map((s) => (
                <button key={s.id} onClick={() => setShape(s.id)} className={`rounded-full px-3 py-1 text-[12px] ${shape === s.id ? 'bg-sky-200 text-slate-900' : 'bg-white/10'}`}>
                  {s.label}
                </button>
              ))}
            </div>
            <p className="pt-1 text-[11px] text-sky-50/60">②のせる絵を、Bluenaの中の自分のアートから選ぶ</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {arts.map((a, k) => (
                <button key={k} onClick={() => setArt(a)} className={`shrink-0 rounded-xl border-2 ${art === a ? 'border-sky-200' : 'border-transparent'}`}>
                  <ArtTile art={a} size={56} />
                </button>
              ))}
            </div>
            <button onClick={turn} disabled={!shape || !art} className={btn}>
              ③ハンドルを回す
            </button>
          </>
        ) : (
          <>
            <p className="text-center text-[12px] text-sky-50/70">見本ができました。見本だけでは、注文も支払いもしません</p>
            <button onClick={finish} className={btn}>
              Bluenaにしまう
            </button>
          </>
        )
      }
    >
      {made && art ? (
        <div className="animate-[fadeUp_0.8s_ease-out]">
          <Mock shape={realShape.current} art={art} />
        </div>
      ) : (
        // the iron press with its handle
        <div className="flex flex-col items-center opacity-80">
          <div className="h-16 w-28 rounded-md border-2 border-slate-500 bg-slate-800" />
          <div className="h-3 w-36 rounded bg-slate-600" />
          <span className="mt-1 text-[10px] text-sky-50/50">{shape ? SHAPES.find((s) => s.id === shape)?.label : '刷り台'}</span>
        </div>
      )}
    </Workshop>
  );
}

function PublishGoods({ v, onDone }: { v: StoryVars; onDone: Done }) {
  const g = loadKept().goods ?? { shape: 'sticker', art: myArts(v)[0] };
  return (
    <Moment note="（お店の棚は、いまはこの端末の中だけに並びます。ダチには、まだ見えません）" onDone={() => onDone({})}>
      <span className="absolute bottom-[-10%] right-[6%] h-[80%] w-1 origin-bottom rotate-[-24deg] animate-[atelier-beam_0.9s_ease-out_forwards] rounded-full bg-gradient-to-t from-sky-200/0 via-sky-100/80 to-sky-50/0 blur-[2px]" />
      <div className="relative rounded-2xl border-4 border-amber-900/80 bg-amber-100/15 p-5 shadow-[0_0_40px_rgba(255,220,140,0.55)] animate-[fadeIn_1.2s_0.8s_both]">
        <Mock shape={g.shape} art={g.art} size={130} />
        <div className="mt-2 h-2 rounded bg-amber-900/70" />
        <span className="absolute -top-3 right-3 h-3 w-3 animate-pulse rounded-full bg-amber-200 shadow-[0_0_14px_#fde68a]" />
      </div>
    </Moment>
  );
}

/** the script's screen when the locked 〔購入〕 is pressed (M-URANUS-S002, M-R341) */
export const SHOP_LOCKED_NOTE = '本物のグッズの注文は、Obolo Orderになってからできます。見て回るのと、お店に並べるのは、いまもできます';

function ShopTag({ locked = false, onDone }: { /** not an Obolo Order yet: 〔購入〕 with a lock, pressing it tells why */ locked?: boolean; onDone: Done }) {
  const [buy, setBuy] = useState(false);
  return (
    <div className="absolute inset-0 z-[12] flex items-end justify-center bg-black/40 px-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm animate-[fadeUp_0.4s_ease-out] rounded-2xl bg-[#fbf6ea] p-4 text-amber-950 shadow-2xl">
        <p className="text-center text-[15px] font-bold">たこ焼き柄のトートバッグ</p>
        <p className="mt-2 rounded-lg bg-amber-900/10 px-2 py-1 text-center text-[12px]">受注生産：注文が入ってから作って届けます</p>
        {buy && locked ? (
          <p data-testid="shop-locked-note" className="mt-3 text-[12px] leading-relaxed text-amber-900/80">{SHOP_LOCKED_NOTE}</p>
        ) : buy ? (
          <p className="mt-3 text-[12px] leading-relaxed text-amber-900/80">購入の手続きは、まだ開いていません。開いたら、商品代・送料・合計・届け先の地域・届くまでの目安が出ます。月額88円とは別の料金です。住所はこの手続きの中だけで入力します</p>
        ) : (
          <button onClick={() => setBuy(true)} data-testid="shop-buy" data-locked={locked ? '1' : undefined} className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-[14px] font-bold text-amber-50 ${locked ? 'bg-amber-900/55' : 'bg-amber-900'}`}>
            {locked && <LineIcon id="lock" className="h-4 w-4" />}
            購入
          </button>
        )}
        <button onClick={() => onDone({ f_m_uranus_order: buy && !locked ? 'unavailable' : 'none' })} className="mt-2 w-full py-1.5 text-[12px] text-amber-900/60">
          とじる
        </button>
      </div>
    </div>
  );
}

// --- 冥王星：お話 ------------------------------------------------------------------------------------------------

const STORY_SEEDS = ['たこ焼きが、屋台から転がり落ちて、宇宙の果てまで旅をする話', '雨の日にだけ開く、小さな本屋さんの話', '星を拾い集める、ねぼすけなフクロウの話'];

/** words → spell cards, made here (no server): the phrases of what was said, a short story/game at the end */
function toCards(said: string, tail: string[]): string[] {
  const parts = said
    .split(/[、。,.！!？?\s　]+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .map((x) => x.slice(0, 16));
  return [...new Set([...parts.slice(0, 5), ...tail])].slice(0, 7);
}

function Seed({ v, kind, how, onDone }: { v: StoryVars; kind: 'story' | 'game'; how: string; onDone: Done }) {
  const arts = myArts(v);
  const [talk, setTalk] = useState('');
  const [trip, setTrip] = useState<Art | null>(null);
  const omakase = () => {
    const mine = kind === 'story' ? [...(v.made?.kororins ?? []), ...(v.made?.stickers ?? []).map((s) => s.text)] : [];
    if (kind === 'game') return `${v.neo || v.name}のコロリンが、空から落ちてくる音符を集めるゲーム`;
    return mine.length ? `「${mine[Math.floor(Math.random() * mine.length)]}」から始まる話` : STORY_SEEDS[Math.floor(Math.random() * STORY_SEEDS.length)];
  };
  const placeholder = kind === 'game' ? 'わたしのコロリンが、空から落ちてくる音符を集めるゲーム' : how === 'trip' ? 'この絵の場所で、迷子になる話' : 'たこ焼きが、屋台から転がり落ちて、宇宙の果てまで旅をする話。最後は、ちょっと泣ける感じ';
  const send = (seed: string) => onDone({ [`${kind}_seed`]: seed.slice(0, 190), [`${kind}_trip`]: trip?.text.slice(0, 40) ?? '' });
  return (
    <Workshop
      v={v}
      panel={
        how === 'auto' ? (
          <>
            <p className="text-center text-[12px] text-sky-50/70">{kind === 'story' ? `Bluenaの中の、${v.neo || v.name}の旅で作ったものから、${v.bati || 'バティ'}がお話の種を選びます` : `Bluenaの中の、${v.neo || v.name}の曲とアートから、${v.bati || 'バティ'}が小さなゲームの種を選びます`}</p>
            <button onClick={() => send(omakase())} className={btn}>
              おまかせ
            </button>
          </>
        ) : (
          <>
            {how === 'trip' && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {arts.map((a, k) => (
                  <button key={k} onClick={() => setTrip(a)} className={`shrink-0 rounded-xl border-2 ${trip === a ? 'border-amber-300' : 'border-transparent'}`}>
                    <ArtTile art={a} size={56} />
                  </button>
                ))}
              </div>
            )}
            <VoiceField value={talk} onChange={setTalk} placeholder={placeholder} maxLength={120} multiline />
            <button onClick={() => send(trip ? `${trip.text}。${talk.trim()}` : talk.trim())} disabled={!talk.trim() || (how === 'trip' && !trip)} className={btn}>
              これで話す
            </button>
          </>
        )
      }
    >
      {kind === 'story' ? (
        <div className="relative flex h-[60%] w-[90%] rounded-md bg-[#fbf6ea] shadow-xl">
          <div className="flex-1 border-r border-amber-900/15" />
          <div className="flex-1" />
          <span className="absolute left-[56%] top-[-18%] text-4xl">🪶</span>
          {trip && <span className="absolute -left-2 -top-2">{<ArtTile art={trip} size={40} />}</span>}
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-2">
          {arts.slice(0, 3).map((a, k) => (
            <ArtTile key={k} art={a} size={52} />
          ))}
          {v.made?.song && <span className="flex h-[52px] items-center rounded-lg bg-sky-900/60 px-2 text-[11px]">♪ {v.made.song.title}</span>}
        </div>
      )}
    </Workshop>
  );
}

/** the most spell cards on the desk (more did not fit and ran over the picture) */
const CARDS_MAX = 12;

/** 〔スペルの札が並ぶ〕 + 〔✏️ スペルを組み替える〕 */
function Cards({ v, kind, answers, onDone }: { v: StoryVars; kind: 'story' | 'game'; answers: Record<string, string>; onDone: Done }) {
  const seed = answers[`${kind}_seed`] ?? '';
  const art = myArts(v).find((a) => a.url);
  const tail = kind === 'story' ? ['短いお話'] : [...(v.made?.song ? [`BGM：${v.made.song.title}`.slice(0, 16)] : []), ...(art ? [`背景：${(v.neo || v.name).slice(0, 8)}のアート`] : []), '1分で終わる'];
  const [cards, setCards] = useState(() => toCards(seed, tail));
  const [edit, setEdit] = useState(false);
  const [add, setAdd] = useState('');
  return (
    <Workshop
      v={v}
      panel={
        <>
          {edit ? (
            <div className="space-y-2">
              <p className="text-center text-[11px] text-sky-50/60">札を押すと外れます。話すと、札が足されます</p>
              <VoiceField value={add} onChange={setAdd} placeholder={kind === 'story' ? '主人公：ねこ' : '主人公：コロリン'} maxLength={16} />
              <button
                onClick={() => {
                  // a card once (the cards are keyed by their words), and no more than fit on the desk
                  const t = add.trim();
                  if (t) setCards((x) => (x.includes(t) || x.length >= CARDS_MAX ? x : [...x, t]));
                  setAdd('');
                }}
                disabled={!add.trim() || cards.length >= CARDS_MAX}
                className="w-full rounded-full bg-white/10 py-2 text-[12px] disabled:opacity-40"
              >
                札を足す
              </button>
              <button onClick={() => setEdit(false)} className={sub}>
                組み替えおわり
              </button>
            </div>
          ) : (
            <button onClick={() => setEdit(true)} className="w-full text-center text-[12px] text-amber-200">
              スペルを組み替える
            </button>
          )}
          <button onClick={() => onDone({ [`${kind}_cards`]: cards.join('|').slice(0, 190) })} disabled={!cards.length} className={btn}>
            このスペルにする
          </button>
        </>
      }
    >
      <div className="flex flex-wrap justify-center gap-1.5">
        {cards.map((c) => (
          <button key={c} disabled={!edit} onClick={() => setCards((x) => x.filter((y) => y !== c))} className="rounded-md bg-gradient-to-b from-amber-50 to-amber-200 px-2 py-0.5 font-serif text-[12px] font-bold text-amber-900">
            〈{c}〉{edit && <span className="ml-1 text-amber-900/50">×</span>}
          </button>
        ))}
      </div>
    </Workshop>
  );
}

/** the feather pen writes: members get the story writer's story; the review pages, the words said, as pages */
function StoryWrite({ v, answers, lessonApi, onDone }: { v: StoryVars; answers: Record<string, string>; lessonApi?: LessonApi; onDone: Done }) {
  const cards = (answers.story_cards ?? '').split('|').filter(Boolean);
  const [book, setBook] = useState<Book | null>(null);
  const [page, setPage] = useState(-1);
  const [note, setNote] = useState('');
  useEffect(() => {
    let off = false;
    const own = (): Book => {
      const said = (answers.story_seed ?? '').split(/(?<=[。！？!?])/).map((x) => x.trim()).filter(Boolean);
      return { id: `${Date.now()}`, title: `${v.neo || v.name}のお話`, pages: (said.length ? said : [cards.join('、')]).slice(0, 4).map((text) => ({ text, scene: '' })), cards, made: Date.now() };
    };
    const live = lessonApi === realLessonApi;
    const t0 = Date.now();
    (live ? getApi().writeStory(cards).then((r): Book => ({ id: `${Date.now()}`, title: r.title, pages: r.pages, cards, made: Date.now() })) : Promise.reject(new Error('preview')))
      .catch((e: unknown) => {
        setNote(live ? ((e as { code?: string })?.code === 'NO_MANA' ? 'マナジェムが、光らなかった。話した言葉を、そのままページにしました' : '羽ペンが、止まってしまった……。話した言葉を、そのままページにしました') : '（確認用：AIは動かさず、話した言葉をそのままページにしています）');
        return own();
      })
      .then((b) => {
        putInDrawer(b);
        // the pen runs a moment at least
        setTimeout(() => !off && setBook(b), Math.max(0, 1800 - (Date.now() - t0)));
      });
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Workshop
      v={v}
      panel={
        !book ? (
          <p className="animate-pulse text-center text-[13px]">羽ペンが走りだす……</p>
        ) : (
          <>
            <p className="text-center text-[11px] text-sky-50/60">お話ができました</p>
            <p className="text-center font-serif text-[16px] font-bold">『{book.title}』</p>
            {note && <p className="text-center text-[10px] text-sky-50/50">{note}</p>}
            <button onClick={() => setPage((p) => (p + 1 < book.pages.length ? p + 1 : -1))} className="w-full rounded-full bg-white/10 py-2 text-[13px]">
              {page < 0 ? '▶ 読む' : page + 1 < book.pages.length ? 'つぎのページ →' : '表紙にもどる'}
            </button>
            <p className="text-center text-[10px] text-sky-50/50">絵本にする（ページごとに絵をつけます。あとからでもできます）</p>
            <button onClick={() => onDone({ story_title: book.title.slice(0, 40) })} className={btn}>
              つぎへ
            </button>
          </>
        )
      }
    >
      <div className="relative flex h-[66%] w-[92%] rounded-md bg-[#fbf6ea] p-2 shadow-xl">
        <div className="flex-1 overflow-hidden border-r border-amber-900/15 p-1 text-[10px] leading-relaxed text-amber-950/85">{book ? (page >= 0 ? book.pages[page]?.text : `『${book.title}』`) : ''}</div>
        <div className="flex-1 p-1 text-center text-[10px] text-amber-950/60">{book && page >= 0 ? `― ${page + 1} ―` : ''}</div>
        {!book && <span className="absolute left-[50%] top-[10%] animate-[wobble_0.6s_ease-in-out_infinite] text-4xl">🪶</span>}
      </div>
    </Workshop>
  );
}

/** 絵本にする: each page takes a picture from your art book, or stays words only (Bati's drawing and photos come later) */
function PictureBookMini({ v, onDone }: { v: StoryVars; onDone: Done }) {
  const arts = myArts(v).filter((a) => a.url);
  const [book] = useState<Book | null>(() => loadDrawer().at(-1) ?? null);
  const [at, setAt] = useState(0);
  const [pics, setPics] = useState<(string | null)[]>([]);
  const [shut, setShut] = useState(false);
  const pages = book?.pages ?? [{ text: '', scene: '' }];
  const pick = (url: string | null) => {
    const next = [...pics, url];
    setPics(next);
    if (next.length < pages.length) return setAt(at + 1);
    if (book) putInDrawer({ ...book, picture: true, pages: book.pages.map((p, k) => ({ ...p, pic: next[k] ?? null, how: next[k] ? 'book' : 'words' })) });
    setShut(true);
  };
  return (
    <Workshop
      v={v}
      panel={
        shut ? (
          <button onClick={() => onDone({})} className={btn}>
            つぎへ
          </button>
        ) : (
          <>
            <p className="text-center text-[11px] text-sky-50/60">
              {at + 1}ページ目の絵の作り方を選ぶ（{at + 1}／{pages.length}）
            </p>
            {arts.length > 0 && <p className="text-[11px] text-sky-50/60">アート帳から選ぶ</p>}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {arts.map((a, k) => (
                <button key={k} onClick={() => pick(a.url)} className="shrink-0">
                  <ArtTile art={a} size={56} />
                </button>
              ))}
            </div>
            <button onClick={() => pick(null)} className="w-full rounded-full bg-white/10 py-2 text-[13px]">
              字だけ
            </button>
          </>
        )
      }
    >
      {shut ? (
        <div className="flex h-[70%] w-[56%] animate-[fadeUp_0.6s_ease-out] flex-col items-center justify-center rounded-r-lg border-l-8 border-amber-900 bg-[#fbf6ea] p-2 shadow-2xl">
          {pics.find(Boolean) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pics.find(Boolean)!} alt="" className="aspect-square w-[80%] rounded object-cover" />
          ) : null}
          <p className="mt-1 text-center font-serif text-[11px] font-bold text-amber-950">『{book?.title ?? ''}』</p>
        </div>
      ) : (
        <div className="flex h-[66%] w-[92%] rounded-md bg-[#fbf6ea] p-2 shadow-xl">
          <div className="flex-1 overflow-hidden border-r border-amber-900/15 p-1 text-[10px] leading-relaxed text-amber-950/85">{pages[at]?.text}</div>
          <div className="flex flex-1 items-center justify-center text-2xl text-amber-900/30"><Glyph id="art" label={false} className="h-7 w-7" /></div>
        </div>
      )}
    </Workshop>
  );
}

function PublishBook({ v, onDone }: { v: StoryVars; onDone: Done }) {
  const book = loadDrawer().at(-1);
  return (
    <Moment bg="bg-gradient-to-b from-[#020414]/90 via-[#0b1838]/70 to-black/30" note="（図書館の棚と空の灯りは、いまはこの端末の中だけです。ダチには、まだ届きません）" onDone={() => onDone({})}>
      {/* the light in the dark sky */}
      <span className="absolute left-[24%] top-[6%] h-2.5 w-2.5 animate-[fadeIn_1s_1.6s_both] rounded-full bg-amber-100 shadow-[0_0_18px_6px_rgba(255,236,170,0.7)]" />
      <div className="flex items-end gap-3">
        {/* the book in its ice crystal on the shelf (and the picture book beside it) */}
        {[book, ...(book?.picture ? [book] : [])].map((b, k) => (
          <div key={k} className="flex h-28 w-20 animate-[fadeUp_0.9s_ease-out_both] items-center justify-center p-2 text-center font-serif text-[10px] text-sky-950" style={{ clipPath: 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)', background: 'linear-gradient(160deg,#e0f2fe,#7dd3fc 60%,#bae6fd)', animationDelay: `${0.4 + k * 0.4}s` }}>
            {k === 1 && b?.pages.find((p) => p.pic)?.pic ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.pages.find((p) => p.pic)!.pic!} alt="" className="w-full rounded object-cover" />
            ) : (
              `『${b?.title ?? ''}』`
            )}
          </div>
        ))}
      </div>
      {/* the owl with {neo}'s face hugs the book and flies off into the dark sky */}
      <div className="absolute right-[8%] top-[4%] animate-[flyAway_3s_1.8s_ease-in_both]">
        <NeoOwl face={v.lookChibi || v.look} title={book?.title} size={80} />
      </div>
    </Moment>
  );
}

// --- 海王星：ゲーム ----------------------------------------------------------------------------------------------

/** 『ナガレを越えて』: little {neo} hops onto the Saturn square, the Saturn stage, 〔画面：クリア〕 */
function Nagare({ v, onDone }: { v: StoryVars; onDone: Done }) {
  const [phase, setPhase] = useState<'map' | 'stage' | 'clear'>('map');
  useEffect(() => {
    if (phase !== 'map') return;
    const t = setTimeout(() => setPhase('stage'), 1800);
    return () => clearTimeout(t);
  }, [phase]);
  const face = v.lookChibi || v.look;
  return (
    <div className="absolute inset-0 z-[12] bg-[#020b16] text-cyan-50">
      {phase === 'map' && (
        <div className="flex h-full items-center justify-center">
          <div className="relative flex items-center gap-6">
            {['土星', '…', '…'].map((sq, k) => (
              <div key={k} className="flex flex-col items-center">
                <span className={`flex h-12 w-12 items-center justify-center rounded-full text-xl ${k === 0 ? 'bg-amber-300 text-amber-950' : 'bg-stone-700/80 text-stone-400'}`}>{k === 0 ? '★' : '▦'}</span>
                <span className="text-[10px] text-cyan-50/70">{sq}</span>
              </div>
            ))}
            <span className="absolute -top-12 left-0 animate-bounce">
              {face ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={face} alt="" className="h-10 w-10 rounded-full border-2 border-white object-cover object-top" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-amber-200 text-amber-900">✦</span>
              )}
            </span>
          </div>
        </div>
      )}
      {phase === 'stage' && <SaturnStage face={face} onClear={() => setPhase('clear')} />}
      {/* out of the stage without clearing (as in the trial on the island: NagareTrial), so nobody is kept in it */}
      {phase === 'stage' && (
        <button onClick={() => onDone({ f_m_neptune_trial: 'none' })} className="absolute right-3 top-[calc(52px+env(safe-area-inset-top))] z-10 rounded-full bg-black/40 px-3 py-1 text-[11px] text-white/70">
          とじる
        </button>
      )}
      {phase === 'clear' && (
        <div className="flex h-full flex-col items-center justify-center gap-6 px-6">
          <p className="animate-[fadeUp_0.5s_ease-out] text-4xl font-bold tracking-[0.3em] text-amber-200 drop-shadow-[0_0_20px_rgba(255,214,120,0.8)]">クリア</p>
          <button onClick={() => onDone({ f_m_neptune_trial: 'saturn' })} className={`${btn} max-w-xs`}>
            つぎへ
          </button>
        </div>
      )}
    </div>
  );
}

let actx: AudioContext | null = null;
function jingle() {
  try {
    actx ??= new AudioContext();
    const t = actx.currentTime;
    [523, 659, 784, 1047].forEach((f, k) => {
      const o = actx!.createOscillator();
      const g = actx!.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t + k * 0.14);
      g.gain.linearRampToValueAtTime(0.12, t + k * 0.14 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + k * 0.14 + 0.35);
      o.connect(g).connect(actx!.destination);
      o.start(t + k * 0.14);
      o.stop(t + k * 0.14 + 0.4);
    });
  } catch {
    /* no sound here */
  }
}

type Note = { id: number; x: number; y: number };
const NEED = 8;

/** the little game: your art behind, your song playing, notes falling, your kororin catching them (drag or tap) */
function GamePlay({ v, answers, onDone }: { v: StoryVars; answers: Record<string, string>; onDone: Done }) {
  const cards = (answers.game_cards ?? '').split('|').filter(Boolean);
  const title = `${(cards[0] ?? v.neo ?? v.name ?? '').slice(0, 12)}のゲーム`;
  const art = myArts(v).find((a) => a.url)?.url ?? null;
  const [phase, setPhase] = useState<'made' | 'play' | 'won'>('made');
  const sim = useRef({ notes: [] as Note[], x: 50, caught: 0, seq: 0, spawn: 0, done: false });
  const [, draw] = useState(0);
  const field = useRef<HTMLDivElement>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (phase !== 'play') return;
    if (v.made?.song?.url) {
      audio.current = new Audio(v.made.song.url);
      audio.current.volume = 0.5;
      audio.current.loop = true;
      void audio.current.play().catch(() => undefined);
    }
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const m = sim.current;
      m.spawn -= dt;
      if (m.spawn <= 0 && !m.done) {
        m.spawn = 0.9;
        m.seq++;
        m.notes.push({ id: m.seq, x: 10 + Math.random() * 80, y: -5 });
      }
      m.notes = m.notes
        .map((n) => ({ ...n, y: n.y + 28 * dt }))
        .filter((n) => {
          if (n.y > 80 && n.y < 90 && Math.abs(n.x - m.x) < 12) {
            m.caught++;
            return false;
          }
          return n.y < 105;
        });
      if (m.caught >= NEED && !m.done) {
        m.done = true;
        jingle();
        setTimeout(() => setPhase('won'), 900);
      }
      draw((k) => k + 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      audio.current?.pause();
    };
  }, [phase, v.made?.song?.url]);
  const move = (clientX: number) => {
    const r = field.current?.getBoundingClientRect();
    if (r) sim.current.x = Math.max(6, Math.min(94, ((clientX - r.left) / r.width) * 100));
  };
  const finish = () => {
    keep({ game: { title, cards } });
    onDone({ game_title: title.slice(0, 40) });
  };
  const m = sim.current;
  return (
    <Workshop
      v={v}
      caption={phase === 'play' ? title : undefined}
      panel={
        phase === 'made' ? (
          <>
            <p className="text-center text-[12px] text-sky-50/70">ゲームができました｜『{title}』</p>
            <button onClick={() => setPhase('play')} className={btn}>
              ▶ 遊んでみる
            </button>
          </>
        ) : phase === 'play' ? (
          <p className="text-center text-[12px] text-sky-50/70">コロリンを左右に動かして、落ちてくる音符を受け止める（{Math.min(m.caught, NEED)}／{NEED}）</p>
        ) : (
          <>
            <p className="text-center text-[12px] text-sky-50/70">音符を、ぜんぶ受け止めた</p>
            <button onClick={finish} className={btn}>
              Bluenaにしまう
            </button>
          </>
        )
      }
    >
      <div
        ref={field}
        className="relative h-full w-full touch-none overflow-hidden rounded-xl bg-gradient-to-b from-indigo-900 to-sky-700"
        onPointerDown={(e) => move(e.clientX)}
        onPointerMove={(e) => e.buttons && move(e.clientX)}
      >
        {art && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        )}
        {m.notes.map((n) => (
          <span key={n.id} className="absolute -translate-x-1/2 text-xl text-amber-100 drop-shadow" style={{ left: `${n.x}%`, top: `${n.y}%` }}>
            ♪
          </span>
        ))}
        <span className="absolute top-[82%] flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-b from-amber-500 to-amber-800 text-[11px] shadow-lg" style={{ left: `${m.x}%` }}>
          🕶
        </span>
        {phase === 'won' && <span className="absolute left-1/2 top-[60%] -translate-x-1/2 animate-bounce text-2xl">♪</span>}
      </div>
    </Workshop>
  );
}

function PublishGame({ v, onDone }: { v: StoryVars; onDone: Done }) {
  const g = loadKept().game;
  const dots = Array.from({ length: 12 }, (_, k) => k);
  return (
    <Moment bg="bg-gradient-to-b from-[#010812]/90 to-[#04213a]/80" note="（深海の都の館は、いまはこの端末の中だけに灯ります。ほかの人には、まだ見えません）" onDone={() => onDone({})}>
      <div className="relative flex h-44 w-44 items-center justify-center">
        {/* the shell house, its rim lighting up in neon, one by one */}
        <div className="absolute inset-0 rounded-[50%_50%_45%_45%] border-2 border-slate-600 bg-slate-800/70" />
        {dots.map((k) => {
          const a = (k / dots.length) * Math.PI * 2;
          return (
            <span
              key={k}
              className="absolute h-2 w-2 animate-[fadeIn_0.3s_both] rounded-full bg-fuchsia-300 shadow-[0_0_10px_3px_rgba(240,150,255,0.8)]"
              style={{ left: `${50 + Math.cos(a) * 48}%`, top: `${50 + Math.sin(a) * 48}%`, animationDelay: `${0.8 + k * 0.12}s` }}
            />
          );
        })}
        <span className="relative animate-[fadeIn_0.6s_2.4s_both] rounded bg-cyan-300/20 px-2 py-1 text-center text-[12px] font-bold text-cyan-100 shadow-[0_0_12px_rgba(120,230,255,0.7)]">{g?.title ?? `${v.neo || v.name}のゲーム`}</span>
      </div>
    </Moment>
  );
}

/** one after-joining screen ({ t: 'l2', what: 'm-…' }) */
export function AfterStep({ what, vars: v, answers, lessonApi, onDone }: { what: AfterWhat; vars: StoryVars; answers: Record<string, string>; lessonApi?: LessonApi; onDone: Done }) {
  switch (what) {
    case 'm-goods':
      return <GoodsMaker v={v} onDone={onDone} />;
    case 'm-publish-goods':
      return <PublishGoods v={v} onDone={onDone} />;
    case 'm-shop':
      return <ShopTag onDone={onDone} />;
    case 'm-shop-locked':
      // M-R341 (day 10, before the Eclipse): 〔購入〕 wears a lock until Obolo Order; someone who joined early has it open
      return <ShopTag locked={answers.f_join_early !== 'true' && v.story?.f_join_early !== 'true'} onDone={onDone} />;
    case 'm-story-seed':
      return <Seed v={v} kind="story" how={answers.f_m_pluto_story ?? 'talk'} onDone={onDone} />;
    case 'm-story-cards':
      return <Cards v={v} kind="story" answers={answers} onDone={onDone} />;
    case 'm-story-write':
      return <StoryWrite v={v} answers={answers} lessonApi={lessonApi} onDone={onDone} />;
    case 'm-picturebook':
      return <PictureBookMini v={v} onDone={onDone} />;
    case 'm-publish-book':
      return <PublishBook v={v} onDone={onDone} />;
    case 'm-nagare':
      return <Nagare v={v} onDone={onDone} />;
    case 'm-game-seed':
      return <Seed v={v} kind="game" how={answers.f_m_neptune_game ?? 'talk'} onDone={onDone} />;
    case 'm-game-cards':
      return <Cards v={v} kind="game" answers={answers} onDone={onDone} />;
    case 'm-game-play':
      return <GamePlay v={v} answers={answers} onDone={onDone} />;
    case 'm-publish-game':
      return <PublishGame v={v} onDone={onDone} />;
  }
}
