'use client';

import { neoForm } from '@obolo/shared';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { BRANCHES, FLY_HOURS, RESIDENTS, type BranchId, type Resident } from '@/lib/jupiter/residents';
import { FILTERS, hoursSince, isFlying, useJupiter, VIDEO_MAX_SECONDS, type FilterId, type OwnPost, type RootItem } from '@/lib/jupiter/state';
import { spriteUrl } from '@/lib/onboarding/media';
import { Butterfly } from './Butterfly';
import { PostCircle, type CircleMedia } from './PostCircle';

/**
 * Jupiter — "パタパタ" (client design 2026-10-05, docs/jupiter.md). Replaces spec §2.4.
 *  空 (sky): up to 8 butterflies float; each is someone's posts of the last 88 hours. Tap → see them
 *           all; when you close it the butterfly flies off and another one takes its place.
 *  たまご: opens your 根っこ (private data folder) → pick a photo / 8-second video → make a round
 *           post (text, filter, branch) → it hatches into your butterfly.
 *  木 (tree): your profile. Leaves on the branches are posts that finished flying.
 * VISUAL DEMO with sample residents; your own roots and posts stay on this device (P-JUP-2).
 */
export interface ViewPost {
  id: string;
  media: CircleMedia;
  text: string;
  filter: FilterId;
  hours: number;
  branch: BranchId;
}

interface Flyer {
  key: string;
  handle: string;
  art?: string;
  emoji?: string;
  wing?: string;
  hours: number;
  posts: ViewPost[];
  resident?: Resident;
  me?: boolean;
}

export interface PatapataEvents {
  onOpenFlyer?: () => void;
  onCloseViewer?: () => void;
  onEgg?: () => void;
  onPick?: () => void;
  onPosted?: () => void;
  onTree?: () => void;
}

type View = { v: 'sky' } | { v: 'tree'; who: 'me' | Resident } | { v: 'roots' } | { v: 'compose'; item: RootItem } | { v: 'search' };

/** Where the eight butterflies float (% of the sky), after the client's mock. */
const SLOTS = [
  { x: 22, y: 2 },
  { x: 68, y: 4 },
  { x: 44, y: 22 },
  { x: 80, y: 33 },
  { x: 18, y: 42 },
  { x: 40, y: 58 },
  { x: 62, y: 73 },
  { x: 84, y: 60 },
];
const MAX_FLYERS = SLOTS.length;

const residentPosts = (r: Resident, flying: boolean): ViewPost[] =>
  r.posts
    .filter((p) => (p.hoursAgo < FLY_HOURS) === flying)
    .sort((a, b) => a.hoursAgo - b.hoursAgo)
    .map((p) => ({ id: p.id, media: { kind: 'photo', sample: { emoji: p.emoji, hue: p.hue } }, text: p.text, filter: 'none', hours: p.hoursAgo, branch: p.branch }));

const ownView = (p: OwnPost): ViewPost => ({ id: p.id, media: p.item, text: p.text, filter: p.filter, hours: hoursSince(p.createdAt), branch: p.branch });

export function PatapataWorld({ events, overlay, topInset = 0 }: { events?: PatapataEvents; overlay?: ReactNode; topInset?: number }) {
  const { me } = useAuth();
  const jupiter = useJupiter();
  const [view, setView] = useState<View>({ v: 'sky' });
  const [tab, setTab] = useState<'all' | 'friends'>('all');
  const [viewer, setViewer] = useState<{ flyer: Flyer; slot: number | null; start?: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [hatching, setHatching] = useState(false);
  const [bfSize] = useState(() => (typeof window === 'undefined' ? 110 : Math.round(Math.min(150, Math.max(84, window.innerWidth * 0.2)))));
  const ev = useRef(events);
  ev.current = events;

  const neo = neoForm(me?.neoForm);
  const myHandle = me?.displayName || 'neo';
  const myFlying = jupiter.posts.filter((p) => isFlying(p.createdAt)).map(ownView);
  const myLeaves = jupiter.posts.filter((p) => !isFlying(p.createdAt)).map(ownView);

  const flyers = useMemo(() => {
    const list: Flyer[] = RESIDENTS.filter((r) => tab === 'all' || r.friend).flatMap((r) => {
      const posts = residentPosts(r, true);
      return posts.length ? [{ key: r.id, handle: r.handle, art: r.art, emoji: r.emoji, wing: r.wing, hours: posts[0].hours, posts, resident: r }] : [];
    });
    return list;
  }, [tab]);

  const meFlyer: Flyer | null = myFlying.length
    ? { key: 'me', handle: myHandle, emoji: neo?.emoji ?? '🦋', wing: neo?.color ?? '#f0b27a', hours: myFlying[0].hours, posts: myFlying, me: true }
    : null;

  // ---- the eight slots: who floats where, who is flying away ----
  const [slots, setSlots] = useState<(string | null)[]>([]);
  const [leaving, setLeaving] = useState<number | null>(null);
  const seen = useRef<string[]>([]);
  useEffect(() => {
    const keys = [...(meFlyer ? ['me'] : []), ...flyers.map((f) => f.key)].slice(0, MAX_FLYERS);
    setSlots(Array.from({ length: MAX_FLYERS }, (_, i) => keys[i] ?? null));
    // re-seat when the tab changes or the visitor's own butterfly appears
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyers, !!meFlyer]);

  const byKey = (k: string | null) => (k === 'me' ? meFlyer : flyers.find((f) => f.key === k) ?? null);

  const replace = useCallback(
    (slot: number) => {
      setLeaving(slot);
      setTimeout(() => {
        setSlots((cur) => {
          const visible = new Set(cur.filter(Boolean));
          const waiting = flyers.filter((f) => !visible.has(f.key));
          const unseen = waiting.filter((f) => !seen.current.includes(f.key));
          const next = unseen[0] ?? [...waiting].sort((a, b) => seen.current.indexOf(a.key) - seen.current.indexOf(b.key))[0];
          if (!next) return cur;
          const copy = [...cur];
          copy[slot] = next.key;
          return copy;
        });
        setLeaving(null);
      }, 750);
    },
    [flyers],
  );

  const closeViewer = () => {
    const v = viewer;
    setViewer(null);
    if (!v) return;
    if (!v.flyer.me) {
      seen.current = [...seen.current.filter((k) => k !== v.flyer.key), v.flyer.key];
      if (v.slot !== null) replace(v.slot);
    }
    ev.current?.onCloseViewer?.();
  };

  const say = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 1800);
  };

  const go = (next: View) => {
    setView(next);
    if (next.v === 'tree') ev.current?.onTree?.();
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-[#fbe9d7] via-[#f4efe6] to-[#d9e8f5] text-[#7a5b3e]">
      <div className="pointer-events-none absolute left-[8%] top-[6%] h-20 w-20 rounded-full bg-white/50 blur-[1px]" aria-hidden />
      <div className="pointer-events-none absolute right-[6%] top-[14%] h-10 w-36 rounded-full bg-white/50 blur-sm" aria-hidden />

      <div className="relative z-10 flex h-full flex-col" style={{ paddingTop: topInset }}>
        {view.v === 'sky' && (
          <>
            <header className="relative px-4 pt-[calc(14px+env(safe-area-inset-top))] text-center">
              <h1 className="text-xl tracking-[0.7em] text-[#8a6a4c]">パタパタ</h1>
              <button onClick={() => say('お知らせはまだありません')} className="absolute right-4 top-[calc(12px+env(safe-area-inset-top))] text-xl" aria-label="お知らせ">
                🔔
              </button>
              <div className="mx-auto mt-3 inline-flex rounded-full bg-white/50 p-1 shadow-inner">
                {(['all', 'friends'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`rounded-full px-6 py-1.5 text-sm tracking-[0.3em] transition ${tab === t ? 'bg-white shadow' : 'text-[#9b8068]'}`}
                  >
                    {t === 'all' ? 'ミンナ' : 'トモダチ'}
                  </button>
                ))}
              </div>
            </header>
            <div className="relative mx-auto mb-[calc(118px+env(safe-area-inset-bottom))] mt-2 w-full max-w-2xl flex-1">
              {slots.map((k, i) => {
                const f = byKey(k);
                if (!f) return null;
                return (
                  <button
                    key={`${i}-${f.key}`}
                    onClick={() => {
                      setViewer({ flyer: f, slot: i });
                      ev.current?.onOpenFlyer?.();
                    }}
                    className="absolute flex -translate-x-1/2 flex-col items-center"
                    style={{
                      left: `${SLOTS[i].x}%`,
                      top: `${SLOTS[i].y}%`,
                      animation: leaving === i ? 'flyAway 0.75s ease-in forwards' : 'flyIn 0.9s ease-out',
                    }}
                    aria-label={`@${f.handle}`}
                  >
                    <div style={{ animation: `hover ${5 + (i % 3)}s ease-in-out ${i * 0.7}s infinite` }}>
                      <Butterfly art={f.art} emoji={f.emoji} wing={f.wing} size={bfSize} />
                    </div>
                    <span className={`mt-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] shadow-sm ${f.me ? 'bg-amber-200/90 text-amber-900' : f.hours <= 6 ? 'bg-orange-100/90' : 'bg-white/80'}`}>
                      @{f.handle} <span className="text-[#b09276]">{f.hours}h</span>
                    </span>
                  </button>
                );
              })}
              {!slots.some(Boolean) && <p className="absolute inset-x-0 top-1/3 text-center text-sm text-[#a58c74]">いまは誰も飛んでいないみたい</p>}
            </div>
          </>
        )}

        {view.v === 'tree' && (
          <TreeView
            owner={
              view.who === 'me'
                ? { handle: myHandle, emoji: neo?.emoji ?? '🦋', wing: neo?.color, leaves: myLeaves, fruits: 0, friends: 0, flyer: meFlyer }
                : {
                    handle: view.who.handle,
                    art: view.who.art,
                    emoji: view.who.emoji,
                    wing: view.who.wing,
                    leaves: residentPosts(view.who, false),
                    fruits: view.who.fruits,
                    friends: view.who.friends,
                    flyer: flyers.find((f) => f.key === (view.who as Resident).id) ?? null,
                  }
            }
            isMe={view.who === 'me'}
            onBack={() => go({ v: 'sky' })}
            onRoots={() => go({ v: 'roots' })}
            onOpen={(flyer, start) => setViewer({ flyer, slot: null, start })}
            say={say}
          />
        )}

        {view.v === 'roots' && (
          <RootsView
            roots={jupiter.roots}
            onBack={() => go({ v: 'sky' })}
            onAdd={async (files) => {
              const added = await jupiter.addFiles(files);
              if (added.length === 1) {
                go({ v: 'compose', item: added[0] });
                ev.current?.onPick?.();
              }
            }}
            onPick={(item) => {
              go({ v: 'compose', item });
              ev.current?.onPick?.();
            }}
          />
        )}

        {view.v === 'compose' && (
          <Compose
            item={view.item}
            onBack={() => go({ v: 'roots' })}
            onPost={(p) => {
              jupiter.post({ item: view.item, ...p });
              setHatching(true);
              setTimeout(() => {
                setHatching(false);
                go({ v: 'sky' });
                ev.current?.onPosted?.();
              }, 1500);
            }}
          />
        )}

        {view.v === 'search' && (
          <div className="flex-1 overflow-y-auto px-4 pb-32 pt-[calc(16px+env(safe-area-inset-top))]">
            <h2 className="mb-3 text-center tracking-[0.4em]">サガス</h2>
            <div className="mx-auto grid max-w-lg grid-cols-3 gap-3">
              {RESIDENTS.map((r) => (
                <button key={r.id} onClick={() => go({ v: 'tree', who: r })} className="flex flex-col items-center rounded-2xl bg-white/60 p-2 shadow-sm">
                  <Butterfly art={r.art} emoji={r.emoji} wing={r.wing} size={70} />
                  <span className="mt-1 truncate text-xs">@{r.handle}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* bottom bar: 探す / たまご / 木 */}
        {view.v !== 'compose' && (
          <nav className="pointer-events-none absolute inset-x-0 bottom-[calc(14px+env(safe-area-inset-bottom))] z-20 flex justify-center">
            <div className="pointer-events-auto relative flex w-[min(92%,520px)] items-center justify-between rounded-full bg-white/75 px-8 py-3 shadow-lg backdrop-blur">
              <button onClick={() => go(view.v === 'search' ? { v: 'sky' } : { v: 'search' })} className={`flex items-center gap-2 text-sm ${view.v === 'search' ? 'font-bold' : ''}`}>
                🔍 探す
              </button>
              <button
                onClick={() => {
                  go({ v: 'roots' });
                  ev.current?.onEgg?.();
                }}
                className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-4 border-[#f6ead9] bg-[#fffaf2] shadow-lg"
                aria-label="たまご"
              >
                <span className="text-3xl">🥚</span>
                <span className="text-[10px] tracking-widest">たまご</span>
              </button>
              <button onClick={() => go({ v: 'tree', who: 'me' })} className={`flex items-center gap-2 text-sm ${view.v === 'tree' ? 'font-bold' : ''}`}>
                🌳 木
              </button>
            </div>
          </nav>
        )}
      </div>

      {viewer && <StoryViewer flyer={viewer.flyer} start={viewer.start ?? 0} onClose={closeViewer} />}

      {hatching && (
        <div className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center">
          <div className="animate-[hatch_1.5s_ease-out_forwards]">
            <Butterfly emoji={neo?.emoji ?? '🦋'} wing={neo?.color ?? '#f0b27a'} size={140} />
          </div>
        </div>
      )}
      {toast && (
        <div className="absolute inset-x-0 bottom-32 z-[70] flex justify-center">
          <span className="rounded-full bg-[#7a5b3e]/85 px-4 py-2 text-sm text-white">{toast}</span>
        </div>
      )}
      {overlay}
    </div>
  );
}

/** Someone's posts of the last 88 hours, one after another (like stories). */
function StoryViewer({ flyer, start, onClose }: { flyer: Flyer; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const post = flyer.posts[i];
  const next = () => (i + 1 < flyer.posts.length ? setI(i + 1) : onClose());
  const prev = () => setI(Math.max(0, i - 1));
  if (!post) return null;
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#5b4330]/55 px-5 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-[2rem] bg-[#fffaf2] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex gap-1">
          {flyer.posts.map((p, k) => (
            <span key={p.id} className={`h-1 flex-1 rounded-full ${k <= i ? 'bg-amber-400' : 'bg-amber-100'}`} />
          ))}
        </div>
        <div className="mb-3 flex items-center gap-2">
          <Butterfly art={flyer.art} emoji={flyer.emoji} wing={flyer.wing} size={40} />
          <span className="font-bold">@{flyer.handle}</span>
          <span className="text-xs text-[#b09276]">{post.hours}h</span>
          <button onClick={onClose} className="ml-auto rounded-full bg-amber-50 px-3 py-1 text-sm" aria-label="とじる">
            ✕
          </button>
        </div>
        <div className="relative mx-auto w-[min(100%,340px)]" style={{ containerType: 'inline-size' }}>
          <PostCircle media={post.media} filter={post.filter} text={post.text} live className="shadow-[0_12px_40px_rgba(120,80,40,0.3)]" />
          <button onClick={prev} className="absolute inset-y-0 left-0 w-1/3" aria-label="まえ" />
          <button onClick={next} className="absolute inset-y-0 right-0 w-1/3" aria-label="つぎ" />
        </div>
        <p className="mt-3 text-center text-xs text-[#b09276]">
          {flyer.posts.length > 1 ? `${i + 1} / ${flyer.posts.length}（88時間以内の投稿）` : '88時間以内の投稿'}
        </p>
        <button onClick={next} className="mt-3 w-full rounded-full bg-amber-500 py-2.5 text-sm font-bold text-white">
          {i + 1 < flyer.posts.length ? 'つぎへ' : 'とじる'}
        </button>
      </div>
    </div>
  );
}

/** Leaf slots on the tree art (px on the 750×710 image), grouped by branch. */
const LEAF_SLOTS: Record<BranchId, [number, number][]> = {
  trip: [
    [105, 193],
    [190, 155],
    [165, 235],
    [250, 245],
  ],
  food: [
    [600, 160],
    [580, 215],
    [645, 210],
  ],
  walk: [
    [50, 450],
    [120, 445],
    [175, 490],
  ],
  festival: [
    [558, 412],
    [618, 445],
    [682, 442],
    [560, 485],
  ],
};

interface TreeOwner {
  handle: string;
  art?: string;
  emoji?: string;
  wing?: string;
  leaves: ViewPost[];
  fruits: number;
  friends: number;
  flyer: Flyer | null;
}

function TreeView({
  owner,
  isMe,
  onBack,
  onRoots,
  onOpen,
  say,
}: {
  owner: TreeOwner;
  isMe: boolean;
  onBack: () => void;
  onRoots: () => void;
  onOpen: (f: Flyer, start: number) => void;
  say: (t: string) => void;
}) {
  const [all, setAll] = useState(false);
  const [following, setFollowing] = useState(false);
  const asFlyer = (posts: ViewPost[]): Flyer => ({ key: `leaves-${owner.handle}`, handle: owner.handle, art: owner.art, emoji: owner.emoji, wing: owner.wing, hours: 0, posts });

  return (
    <div className="flex-1 overflow-y-auto pb-32">
      <div className="mx-auto max-w-2xl px-4 pt-[calc(14px+env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-2xl" aria-label="もどる">
            ‹
          </button>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/70 shadow">
            <Butterfly art={owner.art} emoji={owner.emoji} wing={owner.wing} size={44} />
          </div>
          <span className="truncate font-bold">@{owner.handle}</span>
        </div>
        <div className="mt-3 flex items-center justify-around text-center">
          {[
            ['葉', owner.leaves.length],
            ['実', owner.fruits],
            ['トモダチ', owner.friends],
          ].map(([k, v]) => (
            <div key={k as string}>
              <p className="text-[11px] tracking-widest text-[#a58c74]">{k}</p>
              <p className="text-xl">{v}</p>
            </div>
          ))}
          {!isMe && (
            <div className="flex flex-col gap-1.5">
              <button onClick={() => setFollowing(!following)} className={`rounded-full px-4 py-1 text-xs ${following ? 'bg-white/80' : 'bg-orange-400 text-white'}`}>
                {following ? 'フォロー中' : 'フォロー'}
              </button>
              <button onClick={() => say('メッセージは準備中です')} className="rounded-full border border-[#e6d3bd] bg-white/60 px-4 py-1 text-xs">
                メッセージ
              </button>
            </div>
          )}
        </div>

        <div className="relative mx-auto mt-2 w-full max-w-[560px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={spriteUrl('jupiter-tree')} alt="" className="w-full select-none" draggable={false} />
          {BRANCHES.map((b) => {
            const leaves = owner.leaves.filter((l) => l.branch === b.id);
            return LEAF_SLOTS[b.id].map(([x, y], k) => {
              const leaf = leaves[k];
              if (!leaf) return null;
              return (
                <button
                  key={`${b.id}-${k}`}
                  onClick={() => onOpen(asFlyer(leaves), k)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#e9d6bb] shadow"
                  style={{ left: `${(x / 750) * 100}%`, top: `${(y / 710) * 100}%`, width: '9.4%', containerType: 'inline-size' }}
                  aria-label={b.label}
                >
                  <PostCircle media={leaf.media} filter={leaf.filter} />
                </button>
              );
            });
          })}
          {/* the trunk: every photo */}
          <button onClick={() => setAll(true)} className="absolute" style={{ left: '42%', top: '58%', width: '18%', height: '30%' }} aria-label="全部の写真" />
          {owner.flyer && (
            <button onClick={() => onOpen(owner.flyer!, 0)} className="absolute right-[4%] top-[2%] flex flex-col items-center" aria-label="飛んでいる蝶">
              <div className="animate-[hover_6s_ease-in-out_infinite]">
                <Butterfly art={owner.art} emoji={owner.emoji} wing={owner.wing} size={72} />
              </div>
              <span className="rounded-full bg-white/80 px-2 text-[11px]">{owner.flyer.hours}h</span>
            </button>
          )}
        </div>
        <p className="mt-1 text-center text-xs tracking-widest text-[#a58c74]">幹をタップで全部の写真</p>
        {isMe && (
          <div className="mt-4 text-center">
            {!owner.leaves.length && <p className="mb-3 text-xs text-[#a58c74]">88時間飛び終えた蝶が、葉っぱになってここに戻ってきます</p>}
            <button onClick={onRoots} className="rounded-full border border-[#d9c0a0] bg-[#fff6ea] px-5 py-2 text-sm">
              🔒 根っこをひらく（自分だけ）
            </button>
          </div>
        )}
      </div>

      {all && (
        <div className="absolute inset-0 z-40 overflow-y-auto bg-[#fffaf2]/95 px-4 pb-24 pt-[calc(16px+env(safe-area-inset-top))]" onClick={() => setAll(false)}>
          <p className="mb-3 text-center text-sm tracking-widest">@{owner.handle} の写真（{owner.leaves.length}）</p>
          <div className="mx-auto grid max-w-lg grid-cols-3 gap-3" onClick={(e) => e.stopPropagation()}>
            {owner.leaves.map((l, k) => (
              <button key={l.id} onClick={() => onOpen(asFlyer(owner.leaves), k)} style={{ containerType: 'inline-size' }}>
                <PostCircle media={l.media} filter={l.filter} />
              </button>
            ))}
          </div>
          {!owner.leaves.length && <p className="text-center text-xs text-[#a58c74]">まだ葉っぱはありません</p>}
          <button onClick={() => setAll(false)} className="mx-auto mt-6 block rounded-full bg-white px-6 py-2 text-sm shadow">
            とじる
          </button>
        </div>
      )}
    </div>
  );
}

/** 根っこ: the private data folder. Everything you add lands here first. */
function RootsView({ roots, onBack, onAdd, onPick }: { roots: RootItem[]; onBack: () => void; onAdd: (f: FileList) => void; onPick: (r: RootItem) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-transparent to-[#e9dcc8]/70 pb-32">
      <div className="mx-auto max-w-2xl px-4 pt-[calc(14px+env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-2xl" aria-label="もどる">
            ‹
          </button>
          <h2 className="tracking-[0.3em]">🔒 根っこ</h2>
        </div>
        <p className="mt-1 text-xs text-[#a58c74]">自分だけのデータフォルダ。撮った写真・動画（8秒まで）は、まずここにしまわれます。</p>
        <button onClick={() => input.current?.click()} className="mt-4 w-full rounded-2xl border-2 border-dashed border-[#d9c0a0] bg-white/50 py-4 text-sm">
          ＋ 写真・動画を入れる
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onAdd(e.target.files);
            e.target.value = '';
          }}
        />
        <p className="mb-2 mt-5 text-xs tracking-widest text-[#a58c74]">ひとつ選んで、投稿をつくる</p>
        <div className="grid grid-cols-3 gap-2">
          {roots.map((r) => (
            <button key={r.id} onClick={() => onPick(r)} className="overflow-hidden rounded-xl bg-white/50 p-1 shadow-sm" style={{ containerType: 'inline-size' }}>
              <PostCircle media={r} className="!rounded-lg" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Make a round post from a root item: text, filter, branch → 投稿 (it becomes a butterfly). */
function Compose({ item, onBack, onPost }: { item: RootItem; onBack: () => void; onPost: (p: { text: string; filter: FilterId; branch: BranchId }) => void }) {
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<FilterId>('none');
  const [branch, setBranch] = useState<BranchId>('walk');
  const [long, setLong] = useState(false);
  return (
    <div className="flex-1 overflow-y-auto pb-10">
      <div className="mx-auto max-w-md px-4 pt-[calc(14px+env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-2xl" aria-label="もどる">
            ‹
          </button>
          <h2 className="tracking-[0.3em]">丸い投稿をつくる</h2>
        </div>
        <div className="mx-auto mt-4 w-[min(78vw,300px)]" style={{ containerType: 'inline-size' }}>
          <PostCircle media={item} filter={filter} text={text} live className="shadow-[0_12px_40px_rgba(120,80,40,0.3)]" />
        </div>
        {item.kind === 'video' && (
          <VideoLength blobId={item.blobId} onLong={setLong} />
        )}
        {long && <p className="mt-2 text-center text-xs text-orange-700">動画は8秒まで。最初の{VIDEO_MAX_SECONDS}秒が使われます</p>}
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 30))}
          placeholder="ひとこと（なくてもOK）"
          className="mt-4 w-full rounded-full border border-[#e6d3bd] bg-white/80 px-4 py-2.5 text-sm outline-none"
        />
        <p className="mb-1.5 mt-4 text-xs tracking-widest text-[#a58c74]">加工</p>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)} className={`rounded-full px-3 py-1 text-xs ${filter === f.id ? 'bg-amber-500 text-white' : 'bg-white/70'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <p className="mb-1.5 mt-4 text-xs tracking-widest text-[#a58c74]">どの枝に実らせる？</p>
        <div className="flex flex-wrap gap-2">
          {BRANCHES.map((b) => (
            <button key={b.id} onClick={() => setBranch(b.id)} className={`rounded-md border px-3 py-1 text-xs ${branch === b.id ? 'border-amber-600 bg-amber-100' : 'border-[#e6d3bd] bg-white/60'}`}>
              {b.label}
            </button>
          ))}
        </div>
        <button onClick={() => onPost({ text: text.trim(), filter, branch })} className="mt-6 w-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 py-3 font-bold text-white shadow-lg">
          🦋 投稿する（88時間、空を飛ぶ）
        </button>
      </div>
    </div>
  );
}

function VideoLength({ blobId, onLong }: { blobId?: string; onLong: (long: boolean) => void }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!blobId) return;
    let u: string | null = null;
    import('@/lib/api/idb').then(({ getBlob }) =>
      getBlob(blobId).then((b) => {
        if (b) {
          u = URL.createObjectURL(b);
          setSrc(u);
        }
      }),
    );
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [blobId]);
  if (!src) return null;
  return <video src={src} preload="metadata" className="hidden" onLoadedMetadata={(e) => onLong(e.currentTarget.duration > VIDEO_MAX_SECONDS + 0.2)} />;
}
