'use client';

import { JUPITER_DEFAULT_BRANCHES, JUPITER_VIDEO_SECONDS, neoForm, type JupiterAuthor, type JupiterFlyer, type JupiterPostView, type JupiterRootView } from '@obolo/shared';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { BRANCHES, FLY_HOURS, RESIDENTS, type Resident } from '@/lib/jupiter/residents';
import { FILTERS, hoursSince, isFlying, useJupiter, type FilterId, type OwnPost, type RootItem } from '@/lib/jupiter/state';
import { spriteUrl } from '@/lib/onboarding/media';
import { Mic } from '@/components/mercury/ComposeChat';
import { PuniPicMaker } from '@/components/puni/PuniPicMaker';
import { Butterfly } from './Butterfly';
import { PostCircle, type CircleMedia } from './PostCircle';

/**
 * Jupiter — "パタパタ" (client design 2026-10-05, docs/jupiter.md). Replaces spec §2.4.
 *  空 (sky): up to 8 butterflies float; each is someone's posts of the last 88 hours. Tap → see them
 *           all (☆ them); when you close it the butterfly flies off and another one takes its place.
 *  たまご: opens your 根っこ (private folder) → pick a photo / 8-second video → make a round post
 *           (words, filter, branch) → it hatches into your butterfly.
 *  木 (tree): a profile. Leaves on the branches are posts that finished flying; the four branch
 *           signs can be renamed by the owner; 🦋 蝶を描いてもらう paints your butterfly.
 * `live`: everything goes through the server (the /jupiter page). Without it (the Day 5 tutorial)
 * your roots and posts stay on this device. Sample residents keep the みんな sky lively (P-JUP-2).
 */
export interface ViewPost {
  id: string;
  media: CircleMedia;
  text: string;
  filter: FilterId;
  hours: number;
  /** branch slot 0–3 */
  branch: number;
  /** server posts can get stars */
  star?: { count: number; mine: boolean };
}

interface Flyer {
  key: string;
  userId?: string;
  handle: string;
  art?: string;
  src?: string | null;
  emoji?: string;
  img?: string | null;
  wing?: string;
  hours: number;
  posts: ViewPost[];
  resident?: Resident;
  me?: boolean;
}

/** a root item, as both sources show it */
interface RootView {
  id: string;
  media: CircleMedia;
}

export interface PatapataEvents {
  onOpenFlyer?: () => void;
  onCloseViewer?: () => void;
  onEgg?: () => void;
  onPick?: () => void;
  onPosted?: () => void;
  onTree?: () => void;
}

type Tab = 'all' | 'following' | 'friends';
type TreeWho = { kind: 'me' } | { kind: 'resident'; r: Resident } | { kind: 'user'; id: string };
type View = { v: 'sky' } | { v: 'tree'; who: TreeWho } | { v: 'roots' } | { v: 'compose'; item: RootView } | { v: 'search' };

const TABS: [Tab, string][] = [
  ['all', 'みんな'],
  ['following', 'フォロー'],
  ['friends', 'ダチ'],
];

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
const BRANCH_IDS = BRANCHES.map((b) => b.id);

const residentPosts = (r: Resident, flying: boolean): ViewPost[] =>
  r.posts
    .filter((p) => (p.hoursAgo < FLY_HOURS) === flying)
    .sort((a, b) => a.hoursAgo - b.hoursAgo)
    .map((p) => ({ id: p.id, media: { kind: 'photo', sample: { emoji: p.emoji, hue: p.hue } }, text: p.text, filter: 'none', hours: p.hoursAgo, branch: Math.max(0, BRANCH_IDS.indexOf(p.branch)) }));

const localMedia = (r: RootItem): CircleMedia => ({ kind: r.kind, url: r.blobId ? `idb:${r.blobId}` : undefined, sample: r.sample });
const localView = (p: OwnPost): ViewPost => ({ id: p.id, media: localMedia(p.item), text: p.text, filter: p.filter, hours: hoursSince(p.createdAt), branch: Math.max(0, BRANCH_IDS.indexOf(p.branch)) });
const liveView = (p: JupiterPostView): ViewPost => ({
  id: p.id,
  media: { kind: p.kind, url: p.url, poster: p.posterUrl },
  text: p.text,
  filter: (FILTERS.some((f) => f.id === p.filter) ? p.filter : 'none') as FilterId,
  hours: hoursSince(new Date(p.createdAt).getTime()),
  branch: p.branch,
  star: { count: p.starCount, mine: p.starredByMe },
});
const liveRoot = (r: JupiterRootView): RootView => ({ id: r.id, media: { kind: r.kind, url: r.url, poster: r.posterUrl } });
const authorLook = (a: JupiterAuthor) => {
  const neo = neoForm(a.neoForm);
  return { src: a.butterfly ?? null, img: a.butterfly ? null : a.pic, emoji: neo?.emoji ?? '🦋', wing: neo?.color ?? '#e9b98a' };
};

export function PatapataWorld({ events, overlay, topInset = 0, live = false }: { events?: PatapataEvents; overlay?: ReactNode; topInset?: number; live?: boolean }) {
  const { me } = useAuth();
  const local = useJupiter();
  const [view, setView] = useState<View>({ v: 'sky' });
  const [tab, setTab] = useState<Tab>('all');
  const [viewer, setViewer] = useState<{ flyer: Flyer; slot: number | null; start?: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [hatching, setHatching] = useState(false);
  const [bfSize] = useState(() => (typeof window === 'undefined' ? 110 : Math.round(Math.min(150, Math.max(84, window.innerWidth * 0.2)))));
  const ev = useRef(events);
  ev.current = events;

  // ---- server data (live) ----
  const [sky, setSky] = useState<JupiterFlyer[] | null>(null);
  const [roots, setRoots] = useState<RootView[] | null>(null);
  const [skyKey, setSkyKey] = useState(0);
  useEffect(() => {
    if (!live || !me) return;
    let on = true;
    getApi()
      .jupiterSky(tab)
      .then((r) => on && setSky(r))
      .catch(() => on && setSky([]));
    return () => {
      on = false;
    };
  }, [live, me, tab, skyKey]);
  useEffect(() => {
    if (!live || !me || view.v !== 'roots') return;
    getApi()
      .jupiterRoots()
      .then((r) => setRoots(r.map(liveRoot)))
      .catch(() => setRoots([]));
  }, [live, me, view.v]);

  const say = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 2000);
  };

  const neo = neoForm(me?.neoForm);
  const myHandle = me?.displayName || 'neo';
  const myLook = { src: me?.butterfly ?? null, img: me?.butterfly ? null : (me?.puniPic ?? me?.avatarUrl), emoji: neo?.emoji ?? '🦋', wing: neo?.color ?? '#f0b27a' };
  const myFlying: ViewPost[] = live ? (sky?.find((f) => f.author.id === me?.id)?.posts.map(liveView) ?? []) : local.posts.filter((p) => isFlying(p.createdAt)).map(localView);

  const flyers = useMemo(() => {
    const real: Flyer[] = live
      ? (sky ?? [])
          .filter((f) => f.author.id !== me?.id)
          .map((f) => {
            const posts = f.posts.map(liveView);
            return { key: f.author.id, userId: f.author.id, handle: f.author.displayName || f.author.handle, ...authorLook(f.author), hours: posts[0]?.hours ?? 0, posts };
          })
      : [];
    // sample residents: the みんな sky (live), or the whole demo sky (tutorial)
    const residents: Flyer[] =
      live && tab !== 'all'
        ? []
        : RESIDENTS.filter((r) => live || tab === 'all' || r.friend).flatMap((r) => {
            const posts = residentPosts(r, true);
            return posts.length ? [{ key: r.id, handle: r.handle, art: r.art, emoji: r.emoji, wing: r.wing, hours: posts[0].hours, posts, resident: r }] : [];
          });
    return [...real, ...residents];
  }, [live, sky, me?.id, tab]);

  const meFlyer: Flyer | null = myFlying.length ? { key: 'me', userId: me?.id, handle: myHandle, ...myLook, hours: myFlying[0].hours, posts: myFlying, me: true } : null;

  // ---- the eight slots: who floats where, who is flying away ----
  const [slots, setSlots] = useState<(string | null)[]>([]);
  const [leaving, setLeaving] = useState<number | null>(null);
  const seen = useRef<string[]>([]);
  const flyerKeys = flyers.map((f) => f.key).join(',');
  useEffect(() => {
    const keys = [...(meFlyer ? ['me'] : []), ...flyers.map((f) => f.key)].slice(0, MAX_FLYERS);
    setSlots(Array.from({ length: MAX_FLYERS }, (_, i) => keys[i] ?? null));
    // re-seat when the list changes or the visitor's own butterfly appears
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyerKeys, !!meFlyer]);

  const byKey = (k: string | null) => (k === 'me' ? meFlyer : (flyers.find((f) => f.key === k) ?? null));

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
    if (!v.flyer.me && v.slot !== null) {
      seen.current = [...seen.current.filter((k) => k !== v.flyer.key), v.flyer.key];
      replace(v.slot);
    }
    ev.current?.onCloseViewer?.();
  };

  const go = (next: View) => {
    setView(next);
    if (next.v === 'tree') ev.current?.onTree?.();
  };

  // ---- adding to the roots / posting ----
  const [uploading, setUploading] = useState(false);
  const addFiles = async (files: FileList): Promise<RootView[]> => {
    if (!live) return (await local.addFiles(files)).map((r) => ({ id: r.id, media: localMedia(r) }));
    setUploading(true);
    const added: RootView[] = [];
    try {
      for (const f of Array.from(files)) {
        const kind = f.type.startsWith('video/') ? 'video' : f.type.startsWith('image/') ? 'photo' : null;
        if (!kind) continue;
        let r: JupiterRootView;
        if (kind === 'video') {
          const v = await getApi().uploadVideo(f, JUPITER_VIDEO_SECONDS);
          r = await getApi().addJupiterRoot({ mediaId: v.id, kind, ...(v.posterUrl ? { posterUrl: v.posterUrl } : {}) });
        } else {
          const ph = await getApi().uploadPhoto(f);
          r = await getApi().addJupiterRoot({ mediaId: ph.id, kind });
        }
        added.push(liveRoot(r));
      }
    } catch (e) {
      say(e instanceof ApiError && (e.code === 'BAD_VIDEO' || e.code === 'BAD_IMAGE') ? 'この写真・動画は読みこめなかった…' : e instanceof ApiError && e.code === 'STORAGE_FULL' ? '保存できる容量がいっぱいです' : 'うまく入れられなかった…もう一度');
    } finally {
      setUploading(false);
    }
    if (added.length) setRoots((cur) => [...added, ...(cur ?? [])]);
    return added;
  };

  const shownRoots: RootView[] = live ? (roots ?? []) : local.roots.map((r) => ({ id: r.id, media: localMedia(r) }));

  const post = async (item: RootView, p: { text: string; filter: FilterId; branch: number }) => {
    if (live) {
      try {
        await getApi().createJupiterPost({ rootId: item.id, text: p.text, filter: p.filter, branch: p.branch });
      } catch (e) {
        say(e instanceof ApiError && e.code === 'MODERATION' ? 'その言葉は使えないよ' : '投稿できなかった…もう一度');
        return;
      }
      setSkyKey(Date.now());
    } else {
      const root = local.roots.find((r) => r.id === item.id);
      if (!root) return;
      local.post({ item: root, text: p.text, filter: p.filter, branch: BRANCH_IDS[p.branch] ?? 'walk' });
    }
    setHatching(true);
    setTimeout(() => {
      setHatching(false);
      go({ v: 'sky' });
      ev.current?.onPosted?.();
    }, 1500);
  };

  const star = async (p: ViewPost) => {
    if (!p.star) return;
    const on = !p.star.mine;
    const upd = (x: ViewPost) => (x.id === p.id ? { ...x, star: { count: Math.max(0, x.star!.count + (on ? 1 : -1)), mine: on } } : x);
    setViewer((v) => (v ? { ...v, flyer: { ...v.flyer, posts: v.flyer.posts.map(upd) } } : v));
    getApi()
      .starJupiterPost(p.id, on)
      .catch(() => undefined);
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
                {TABS.map(([t, label]) => (
                  <button key={t} onClick={() => setTab(t)} className={`rounded-full px-5 py-1.5 text-sm tracking-[0.2em] transition ${tab === t ? 'bg-white shadow' : 'text-[#9b8068]'}`}>
                    {label}
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
                    style={{ left: `${SLOTS[i].x}%`, top: `${SLOTS[i].y}%`, animation: leaving === i ? 'flyAway 0.75s ease-in forwards' : 'flyIn 0.9s ease-out' }}
                    aria-label={`@${f.handle}`}
                  >
                    <div style={{ animation: `hover ${5 + (i % 3)}s ease-in-out ${i * 0.7}s infinite` }}>
                      <Butterfly art={f.art} src={f.src} emoji={f.emoji} img={f.img} wing={f.wing} size={bfSize} />
                    </div>
                    <span className={`mt-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] shadow-sm ${f.me ? 'bg-amber-200/90 text-amber-900' : f.hours <= 6 ? 'bg-orange-100/90' : 'bg-white/80'}`}>
                      @{f.handle} <span className="text-[#b09276]">{f.hours}h</span>
                    </span>
                  </button>
                );
              })}
              {!slots.some(Boolean) && (
                <p className="absolute inset-x-0 top-1/3 px-8 text-center text-sm text-[#a58c74]">
                  {tab === 'friends' ? 'ダチは、おたがいにフォローしている人。木をのぞいてフォローしてみてね' : tab === 'following' ? 'フォローした人の蝶が、ここに飛んでくるよ' : 'いまは誰も飛んでいないみたい'}
                </p>
              )}
            </div>
          </>
        )}

        {view.v === 'tree' && (
          <TreeView
            who={view.who}
            live={live}
            me={{ id: me?.id, handle: myHandle, ...myLook }}
            localLeaves={local.posts.filter((p) => !isFlying(p.createdAt)).map(localView)}
            localFlyer={view.who.kind === 'me' && !live ? meFlyer : null}
            residentFlyer={view.who.kind === 'resident' ? (flyers.find((f) => f.key === (view.who as { r: Resident }).r.id) ?? null) : null}
            onBack={() => go({ v: 'sky' })}
            onRoots={() => go({ v: 'roots' })}
            onOpen={(flyer, start) => setViewer({ flyer, slot: null, start })}
            say={say}
          />
        )}

        {view.v === 'roots' && (
          <RootsView
            roots={shownRoots}
            loading={live && roots === null}
            uploading={uploading}
            onBack={() => go({ v: 'sky' })}
            onAdd={async (files) => {
              const added = await addFiles(files);
              if (added.length === 1) {
                go({ v: 'compose', item: added[0] });
                ev.current?.onPick?.();
              }
            }}
            onPick={(item) => {
              go({ v: 'compose', item });
              ev.current?.onPick?.();
            }}
            onRemove={
              live
                ? (item) => {
                    setRoots((cur) => (cur ?? []).filter((r) => r.id !== item.id));
                    getApi()
                      .removeJupiterRoot(item.id)
                      .catch(() => undefined);
                  }
                : undefined
            }
          />
        )}

        {view.v === 'compose' && <Compose item={view.item} live={live} myId={me?.id} onBack={() => go({ v: 'roots' })} onPost={(p) => post(view.item, p)} />}

        {view.v === 'search' && <SearchView live={live} onOpen={(who) => go({ v: 'tree', who })} />}

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
              <button onClick={() => go({ v: 'tree', who: { kind: 'me' } })} className={`flex items-center gap-2 text-sm ${view.v === 'tree' ? 'font-bold' : ''}`}>
                🌳 木
              </button>
            </div>
          </nav>
        )}
      </div>

      {viewer && (
        <StoryViewer
          flyer={viewer.flyer}
          start={viewer.start ?? 0}
          onClose={closeViewer}
          onStar={star}
          onTree={
            viewer.flyer.me
              ? undefined
              : () => {
                  const f = viewer.flyer;
                  setViewer(null);
                  go({ v: 'tree', who: f.resident ? { kind: 'resident', r: f.resident } : { kind: 'user', id: f.userId! } });
                }
          }
        />
      )}

      {hatching && (
        <div className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center">
          <div className="animate-[hatch_1.5s_ease-out_forwards]">
            <Butterfly {...myLook} size={140} />
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
function StoryViewer({ flyer, start, onClose, onStar, onTree }: { flyer: Flyer; start: number; onClose: () => void; onStar: (p: ViewPost) => void; onTree?: () => void }) {
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
          <button onClick={onTree} disabled={!onTree} className="flex min-w-0 items-center gap-2 text-left" aria-label="木をみる">
            <Butterfly art={flyer.art} src={flyer.src} emoji={flyer.emoji} img={flyer.img} wing={flyer.wing} size={40} />
            <span className="truncate font-bold">@{flyer.handle}</span>
            {onTree && <span className="shrink-0 text-xs text-[#b09276]">🌳›</span>}
          </button>
          <span className="shrink-0 text-xs text-[#b09276]">{post.hours}h</span>
          <button onClick={onClose} className="ml-auto rounded-full bg-amber-50 px-3 py-1 text-sm" aria-label="とじる">
            ✕
          </button>
        </div>
        <div className="relative mx-auto w-[min(100%,340px)]" style={{ containerType: 'inline-size' }}>
          <PostCircle media={post.media} filter={post.filter} text={post.text} live className="shadow-[0_12px_40px_rgba(120,80,40,0.3)]" />
          <button onClick={prev} className="absolute inset-y-0 left-0 w-1/3" aria-label="まえ" />
          <button onClick={next} className="absolute inset-y-0 right-0 w-1/3" aria-label="つぎ" />
        </div>
        <div className="mt-3 flex items-center justify-center gap-3">
          <p className="text-xs text-[#b09276]">{flyer.posts.length > 1 ? `${i + 1} / ${flyer.posts.length}（88時間以内の投稿）` : '88時間以内の投稿'}</p>
          {post.star && (
            <button onClick={() => onStar(post)} className={`rounded-full px-3 py-1 text-xs font-bold ${post.star.mine ? 'bg-amber-100 text-amber-600' : 'bg-white text-[#9b8068] shadow-sm'}`} aria-label="star">
              {post.star.mine ? '★' : '☆'} {post.star.count}
            </button>
          )}
        </div>
        <button onClick={next} className="mt-3 w-full rounded-full bg-amber-500 py-2.5 text-sm font-bold text-white">
          {i + 1 < flyer.posts.length ? 'つぎへ' : 'とじる'}
        </button>
      </div>
    </div>
  );
}

/** Leaf slots on the tree art (px on the 750×710 image), per branch slot 0–3. */
const LEAF_SLOTS: [number, number][][] = [
  [
    [105, 193],
    [190, 155],
    [165, 235],
    [250, 245],
  ],
  [
    [600, 160],
    [580, 215],
    [645, 210],
  ],
  [
    [50, 450],
    [120, 445],
    [175, 490],
  ],
  [
    [558, 412],
    [618, 445],
    [682, 442],
    [560, 485],
  ],
];
/** The wooden signs painted on the tree art (centre x, y, width, height on 750×710): covered by code-drawn ones so names can change. */
const SIGNS: [number, number, number, number][] = [
  [130, 297, 128, 42],
  [625, 300, 112, 42],
  [72, 527, 124, 42],
  [668, 537, 116, 42],
];

interface TreeData {
  handle: string;
  art?: string;
  src?: string | null;
  emoji?: string;
  img?: string | null;
  wing?: string;
  branches: string[];
  leaves: ViewPost[];
  fruits: number;
  friends: number;
  flyer: Flyer | null;
  followed?: boolean;
  userId?: string;
}

function TreeView({
  who,
  live,
  me,
  localLeaves,
  localFlyer,
  residentFlyer,
  onBack,
  onRoots,
  onOpen,
  say,
}: {
  who: TreeWho;
  live: boolean;
  me: { id?: string; handle: string; src: string | null; img?: string | null; emoji: string; wing: string };
  localLeaves: ViewPost[];
  localFlyer: Flyer | null;
  residentFlyer: Flyer | null;
  onBack: () => void;
  onRoots: () => void;
  onOpen: (f: Flyer, start: number) => void;
  say: (t: string) => void;
}) {
  const isMe = who.kind === 'me' || (who.kind === 'user' && who.id === me.id);
  const [data, setData] = useState<TreeData | null>(null);
  const [all, setAll] = useState(false);
  const [rename, setRename] = useState<number | null>(null);
  const [painting, setPainting] = useState(false);

  useEffect(() => {
    if (who.kind === 'resident') {
      const r = who.r;
      setData({ handle: r.handle, art: r.art, emoji: r.emoji, wing: r.wing, branches: [...JUPITER_DEFAULT_BRANCHES], leaves: residentPosts(r, false), fruits: r.fruits, friends: r.friends, flyer: residentFlyer });
      return;
    }
    if (!live) {
      setData({ ...me, branches: [...JUPITER_DEFAULT_BRANCHES], leaves: localLeaves, fruits: 0, friends: 0, flyer: localFlyer });
      return;
    }
    const id = who.kind === 'me' ? me.id : who.id;
    if (!id) return;
    let on = true;
    getApi()
      .jupiterTree(id)
      .then((t) => {
        if (!on) return;
        const flying = t.flying.map(liveView);
        const look = authorLook(t.author);
        const handle = t.author.displayName || t.author.handle;
        setData({
          handle,
          ...look,
          branches: t.branches,
          leaves: t.leaves.map(liveView),
          fruits: t.fruits,
          friends: t.friends,
          followed: t.followedByMe,
          userId: t.author.id,
          flyer: flying.length ? { key: `tree-${t.author.id}`, userId: t.author.id, handle, ...look, hours: flying[0].hours, posts: flying, me: t.isMe } : null,
        });
      })
      .catch(() => on && say('木をひらけなかった…'));
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [who, live, me.id, me.src]);

  if (!data) return <div className="flex flex-1 items-center justify-center text-sm text-[#a58c74]">木をさがしています…</div>;
  const asFlyer = (posts: ViewPost[]): Flyer => ({ key: `leaves-${data.handle}`, handle: data.handle, art: data.art, src: data.src, emoji: data.emoji, img: data.img, wing: data.wing, hours: 0, posts });

  const follow = () => {
    if (who.kind === 'resident' || !data.userId) {
      setData({ ...data, followed: !data.followed });
      return;
    }
    const on = !data.followed;
    setData({ ...data, followed: on });
    getApi()
      .followSaturnUser(data.userId, on)
      .catch(() => say('フォローできなかった…'));
  };

  return (
    <div className="flex-1 overflow-y-auto pb-32">
      <div className="mx-auto max-w-2xl px-4 pt-[calc(14px+env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-2xl" aria-label="もどる">
            ‹
          </button>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/70 shadow">
            <Butterfly art={data.art} src={data.src} emoji={data.emoji} img={data.img} wing={data.wing} size={44} />
          </div>
          <span className="truncate font-bold">@{data.handle}</span>
          {isMe && live && (
            <button onClick={() => setPainting(true)} className="ml-auto shrink-0 rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold text-amber-800 shadow-sm">
              🦋 蝶を描いてもらう
            </button>
          )}
        </div>
        <div className="mt-3 flex items-center justify-around text-center">
          {[
            ['葉', data.leaves.length],
            ['実', data.fruits],
            ['トモダチ', data.friends],
          ].map(([k, v]) => (
            <div key={k as string}>
              <p className="text-[11px] tracking-widest text-[#a58c74]">{k}</p>
              <p className="text-xl">{v}</p>
            </div>
          ))}
          {!isMe && (
            <div className="flex flex-col gap-1.5">
              <button onClick={follow} className={`rounded-full px-4 py-1 text-xs ${data.followed ? 'bg-white/80' : 'bg-orange-400 text-white'}`}>
                {data.followed ? 'フォロー中' : 'フォロー'}
              </button>
              <button onClick={() => say('メッセージは準備中です')} className="rounded-full border border-[#e6d3bd] bg-white/60 px-4 py-1 text-xs">
                メッセージ
              </button>
            </div>
          )}
        </div>

        <div className="relative mx-auto mt-2 w-full max-w-[560px]" style={{ containerType: 'inline-size' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={spriteUrl('jupiter-tree')} alt="" className="w-full select-none" draggable={false} />
          {/* the branch signs (renamable by the owner) */}
          {SIGNS.map(([x, y, w, h], b) => (
            <button
              key={b}
              onClick={() => (isMe && live ? setRename(b) : undefined)}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[10px] border-2 border-[#8a6440]/70 text-[#5b4128] shadow-[0_2px_3px_rgba(90,60,30,.35)]"
              style={{ left: `${(x / 750) * 100}%`, top: `${(y / 710) * 100}%`, width: `${(w / 750) * 100}%`, height: `${(h / 710) * 100}%`, background: 'linear-gradient(180deg,#e9cfa6,#d4b083)', fontSize: 'clamp(9px,2.6cqw,16px)' }}
              aria-label={`枝：${data.branches[b]}`}
            >
              <span className="truncate px-1 font-bold tracking-wider">{data.branches[b]}</span>
              {isMe && live && <span className="absolute -right-1.5 -top-1.5 rounded-full bg-white px-1 text-[9px] shadow">✎</span>}
            </button>
          ))}
          {LEAF_SLOTS.map((spots, b) => {
            const leaves = data.leaves.filter((l) => l.branch === b);
            return spots.map(([x, y], k) => {
              const leaf = leaves[k];
              if (!leaf) return null;
              return (
                <button
                  key={`${b}-${k}`}
                  onClick={() => onOpen(asFlyer(leaves), k)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#e9d6bb] shadow"
                  style={{ left: `${(x / 750) * 100}%`, top: `${(y / 710) * 100}%`, width: '9.4%', containerType: 'inline-size' }}
                  aria-label={data.branches[b]}
                >
                  <PostCircle media={leaf.media} filter={leaf.filter} />
                </button>
              );
            });
          })}
          {/* the trunk: every photo */}
          <button onClick={() => setAll(true)} className="absolute" style={{ left: '42%', top: '58%', width: '18%', height: '30%' }} aria-label="全部の写真" />
          {data.flyer && (
            <button onClick={() => onOpen(data.flyer!, 0)} className="absolute right-[4%] top-[2%] flex flex-col items-center" aria-label="飛んでいる蝶">
              <div className="animate-[hover_6s_ease-in-out_infinite]">
                <Butterfly art={data.art} src={data.src} emoji={data.emoji} img={data.img} wing={data.wing} size={72} />
              </div>
              <span className="rounded-full bg-white/80 px-2 text-[11px]">{data.flyer.hours}h</span>
            </button>
          )}
        </div>
        <p className="mt-1 text-center text-xs tracking-widest text-[#a58c74]">幹をタップで全部の写真{isMe && live ? '・札をタップで枝の名前をかえる' : ''}</p>
        {isMe && (
          <div className="mt-4 text-center">
            {!data.leaves.length && <p className="mb-3 text-xs text-[#a58c74]">88時間飛び終えた蝶が、葉っぱになってここに戻ってきます</p>}
            <button onClick={onRoots} className="rounded-full border border-[#d9c0a0] bg-[#fff6ea] px-5 py-2 text-sm">
              🔒 根っこをひらく（自分だけ）
            </button>
          </div>
        )}
      </div>

      {all && (
        <div className="absolute inset-0 z-40 overflow-y-auto bg-[#fffaf2]/95 px-4 pb-24 pt-[calc(16px+env(safe-area-inset-top))]" onClick={() => setAll(false)}>
          <p className="mb-3 text-center text-sm tracking-widest">
            @{data.handle} の写真（{data.leaves.length}）
          </p>
          <div className="mx-auto grid max-w-lg grid-cols-3 gap-3" onClick={(e) => e.stopPropagation()}>
            {data.leaves.map((l, k) => (
              <button key={l.id} onClick={() => onOpen(asFlyer(data.leaves), k)} style={{ containerType: 'inline-size' }}>
                <PostCircle media={l.media} filter={l.filter} />
              </button>
            ))}
          </div>
          {!data.leaves.length && <p className="text-center text-xs text-[#a58c74]">まだ葉っぱはありません</p>}
          <button onClick={() => setAll(false)} className="mx-auto mt-6 block rounded-full bg-white px-6 py-2 text-sm shadow">
            とじる
          </button>
        </div>
      )}

      {rename !== null && (
        <RenameBranch
          name={data.branches[rename]}
          onClose={() => setRename(null)}
          onSave={async (name) => {
            try {
              const r = await getApi().renameJupiterBranch(rename, name);
              setData({ ...data, branches: r.branches });
              setRename(null);
            } catch (e) {
              say(e instanceof ApiError && e.code === 'MODERATION' ? 'その名前は使えないよ' : 'かえられなかった…');
            }
          }}
        />
      )}

      {painting && (
        <div className="fixed inset-0 z-[120]">
          <PuniPicMaker
            kind="butterfly"
            onClose={() => setPainting(false)}
            onSaved={(src) => {
              setPainting(false);
              setData({ ...data, src, img: src ? null : data.img });
              say(src ? 'あなたの蝶になったよ' : 'いつもの姿にもどしたよ');
            }}
          />
        </div>
      )}
    </div>
  );
}

function RenameBranch({ name, onClose, onSave }: { name: string; onClose: () => void; onSave: (name: string) => void }) {
  const [v, setV] = useState(name);
  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-[#5b4330]/50" onClick={onClose}>
      <div className="pb-safe w-full max-w-md rounded-t-3xl bg-[#fffaf2] p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-center text-sm font-bold tracking-widest">枝の名前をかえる</p>
        <div className="mt-3 flex items-center gap-2">
          <input value={v} onChange={(e) => setV(e.target.value.slice(0, 8))} className="h-11 min-w-0 flex-1 rounded-full border border-[#e6d3bd] bg-white px-4 text-[16px] outline-none" placeholder="例：カフェ、ねこ、旅" />
          <Mic value={v} onChange={(x) => setV(x.slice(0, 8))} />
        </div>
        <p className="mt-1 text-center text-[10px] text-[#a58c74]">8文字まで</p>
        <button disabled={!v.trim()} onClick={() => onSave(v.trim())} className="mt-3 w-full rounded-full bg-amber-500 py-3 text-sm font-bold text-white disabled:opacity-40">
          この名前にする
        </button>
      </div>
    </div>
  );
}

/** 探す: people on Jupiter (by name), plus the sample residents. */
function SearchView({ live, onOpen }: { live: boolean; onOpen: (who: TreeWho) => void }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<JupiterAuthor[]>([]);
  useEffect(() => {
    if (!live) return;
    const t = setTimeout(
      () =>
        getApi()
          .searchJupiter(q)
          .then(setFound)
          .catch(() => setFound([])),
      q ? 300 : 0,
    );
    return () => clearTimeout(t);
  }, [q, live]);
  const term = q.trim().toLowerCase();
  const residents = RESIDENTS.filter((r) => !term || r.handle.toLowerCase().includes(term));
  return (
    <div className="flex-1 overflow-y-auto px-4 pb-32 pt-[calc(16px+env(safe-area-inset-top))]">
      <h2 className="mb-3 text-center tracking-[0.4em]">サガス</h2>
      <div className="mx-auto mb-4 flex max-w-lg items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value.slice(0, 30))} placeholder="名前でさがす" className="h-11 min-w-0 flex-1 rounded-full border border-[#e6d3bd] bg-white/80 px-4 text-[16px] outline-none" enterKeyHint="search" />
        <Mic value={q} onChange={(v) => setQ(v.slice(0, 30))} />
      </div>
      <div className="mx-auto grid max-w-lg grid-cols-3 gap-3">
        {found.map((a) => {
          const look = authorLook(a);
          return (
            <button key={a.id} onClick={() => onOpen({ kind: 'user', id: a.id })} className="flex flex-col items-center rounded-2xl bg-white/70 p-2 shadow-sm">
              <Butterfly {...look} size={70} />
              <span className="mt-1 w-full truncate text-xs">@{a.displayName || a.handle}</span>
            </button>
          );
        })}
        {residents.map((r) => (
          <button key={r.id} onClick={() => onOpen({ kind: 'resident', r })} className="flex flex-col items-center rounded-2xl bg-white/50 p-2 shadow-sm">
            <Butterfly art={r.art} emoji={r.emoji} wing={r.wing} size={70} />
            <span className="mt-1 w-full truncate text-xs">@{r.handle}</span>
            {live && <span className="text-[9px] text-[#b09276]">サンプル</span>}
          </button>
        ))}
      </div>
      {live && term && !found.length && !residents.length && <p className="mt-6 text-center text-xs text-[#a58c74]">見つからなかった…</p>}
    </div>
  );
}

/** 根っこ: the private folder. Everything you add lands here first. */
function RootsView({
  roots,
  loading,
  uploading,
  onBack,
  onAdd,
  onPick,
  onRemove,
}: {
  roots: RootView[];
  loading: boolean;
  uploading: boolean;
  onBack: () => void;
  onAdd: (f: FileList) => void;
  onPick: (r: RootView) => void;
  onRemove?: (r: RootView) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-transparent to-[#e9dcc8]/70 pb-32">
      <div className="mx-auto max-w-2xl px-4 pt-[calc(14px+env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-2xl" aria-label="もどる">
            ‹
          </button>
          <h2 className="tracking-[0.3em]">🔒 根っこ</h2>
          {onRemove && roots.length > 0 && (
            <button onClick={() => setEditing(!editing)} className="ml-auto rounded-full bg-white/70 px-3 py-1 text-xs">
              {editing ? 'おわる' : '整理する'}
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-[#a58c74]">自分だけのデータフォルダ。撮った写真・動画（{JUPITER_VIDEO_SECONDS}秒まで）は、まずここにしまわれます。</p>
        <button onClick={() => input.current?.click()} disabled={uploading} className="mt-4 w-full rounded-2xl border-2 border-dashed border-[#d9c0a0] bg-white/50 py-4 text-sm disabled:opacity-60">
          {uploading ? 'しまっています…（動画は少し時間がかかります）' : '＋ 写真・動画を入れる'}
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
        <p className="mb-2 mt-5 text-xs tracking-widest text-[#a58c74]">{editing ? '✕ で根っこから消す' : 'ひとつ選んで、投稿をつくる'}</p>
        {loading && <p className="text-center text-xs text-[#a58c74]">ひらいています…</p>}
        {!loading && !roots.length && <p className="text-center text-xs text-[#a58c74]">まだ何も入っていません</p>}
        <div className="grid grid-cols-3 gap-2">
          {roots.map((r) => (
            <div key={r.id} className="relative">
              <button onClick={() => (editing ? undefined : onPick(r))} className="w-full overflow-hidden rounded-xl bg-white/50 p-1 shadow-sm" style={{ containerType: 'inline-size' }}>
                <PostCircle media={r.media} className="!rounded-lg" />
              </button>
              {editing && onRemove && (
                <button onClick={() => onRemove(r)} className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-stone-600 text-xs text-white shadow" aria-label="消す">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Make a round post from a root item: words, filter, branch → 投稿 (it becomes a butterfly). */
function Compose({ item, live, myId, onBack, onPost }: { item: RootView; live: boolean; myId?: string; onBack: () => void; onPost: (p: { text: string; filter: FilterId; branch: number }) => Promise<void> }) {
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<FilterId>('none');
  const [branch, setBranch] = useState(2);
  const [names, setNames] = useState<string[]>([...JUPITER_DEFAULT_BRANCHES]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!live || !myId) return;
    getApi()
      .jupiterTree(myId)
      .then((t) => setNames(t.branches))
      .catch(() => undefined);
  }, [live, myId]);
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
          <PostCircle media={item.media} filter={filter} text={text} live className="shadow-[0_12px_40px_rgba(120,80,40,0.3)]" />
        </div>
        {item.media.kind === 'video' && <p className="mt-2 text-center text-[11px] text-[#a58c74]">動画は{JUPITER_VIDEO_SECONDS}秒まで（長い動画は最初の{JUPITER_VIDEO_SECONDS}秒）</p>}
        <div className="mt-4 flex items-center gap-2">
          <input value={text} onChange={(e) => setText(e.target.value.slice(0, 30))} placeholder="ひとこと（なくてもOK）" className="h-11 min-w-0 flex-1 rounded-full border border-[#e6d3bd] bg-white/80 px-4 text-[16px] outline-none" />
          <Mic value={text} onChange={(v) => setText(v.slice(0, 30))} />
        </div>
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
          {names.map((n, b) => (
            <button key={b} onClick={() => setBranch(b)} className={`rounded-md border px-3 py-1 text-xs ${branch === b ? 'border-amber-600 bg-amber-100' : 'border-[#e6d3bd] bg-white/60'}`}>
              {n}
            </button>
          ))}
        </div>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onPost({ text: text.trim(), filter, branch });
            setBusy(false);
          }}
          className="mt-6 w-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 py-3 font-bold text-white shadow-lg disabled:opacity-50"
        >
          {busy ? '飛ばしています…' : '🦋 投稿する（88時間、空を飛ぶ）'}
        </button>
      </div>
    </div>
  );
}
