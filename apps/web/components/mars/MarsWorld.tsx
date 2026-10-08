'use client';

import { neoForm, type PlanetFlyer, type PlanetPostView, type PlanetProfileView } from '@obolo/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { P } from '@/lib/mercury/sea';
import { CREATORS, fmtLen, KIND_COLOR, STUDIO, THEMES, type Creator, type Theme, type Video } from '@/lib/mars/sky';
import { flying, hoursSince, useMars } from '@/lib/mars/state';
import { spriteUrl, stillUrl } from '@/lib/onboarding/media';
import { synth } from '@/lib/synth';
import { ART_BASE, ArtStage, pickUfo, Vessel } from '@/components/art/Stage';
import { Backstage } from './Backstage';
import { Frame } from './Frame';
import { UfoPlayer, type CrewMember } from './UfoPlayer';
import { LiveShoot } from './LiveMars';
import { ShootChat } from './ShootChat';

/**
 * Mars — the planet of video (client design 2026-10-05, docs/mars.md).
 *  星図 (timeline): friends' videos of the last 88 hours arrive as UFOs with their cards. Tap one to
 *     watch. 全部 / フォロー / ダチ, 「今 N人がライブ中」.
 *  スタジオ (profile): every user has a studio; released videos land there after 88 hours. Your own
 *     studio has a locker of unreleased videos; 公開 sends one off as a UFO.
 *  撮影: talk to KIMORIN (Bati once you have one) and they make a video (placeholder chat).
 *  Two looks — 郊外 (canyon) / 街中 (city) — chosen with 「スタジオを飾る」.
 * `live` (the /mars page, client decision 2026-10-07): like Saturn / Jupiter — real movies (square)
 * fly as UFOs in the slots of the sample ones; posting = talk to Bati → pick a video from your
 * 裏スタジオ → it is cut square and flies for 88 hours, then stays in your studio. Without it (the
 * Day 7 tutorial) everything stays on this device with the sample movies.
 */
export interface MarsEvents {
  onUfo?: () => void;
  onStudio?: () => void;
  onLocker?: () => void;
  onRelease?: () => void;
}

type Person = { userId: string; name: string };
type View =
  | { v: 'sky' }
  | { v: 'shoot' }
  | { v: 'studio'; who: 'me' | Creator }
  | { v: 'live-studio'; who: 'me' | Person }
  | { v: 'play'; crew: Crew[]; start: number; video: number; back: View };
/** A UFO in the player: whose it is (for「スタジオへ」). */
type Crew = CrewMember & { creator?: Creator; person?: Person };

const hash = (t: string) => [...t].reduce((n, c) => n + c.charCodeAt(0), 0);
/** A posted movie as the 星図 / studio show it. */
export const videoOf = (p: PlanetPostView): Video => ({
  id: p.id,
  postId: p.id,
  starred: p.starredByMe,
  repliers: p.repliers,
  title: p.title || p.text || 'ムービー',
  kind: 'MV',
  author: p.author.displayName || p.author.handle,
  hue: hash(p.author.id) % 360,
  emoji: '🎬',
  seconds: Math.max(1, Math.round(p.seconds ?? 30)),
  scenes: [p.text || p.title || ''],
  bgm: P(100, 60, 'major', [0, 4, 5, 3], 'triangle'),
  url: p.url,
  poster: p.posterUrl,
  hoursAgo: Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 3600_000),
});

export function MarsWorld({ events, overlay, live = false }: { events?: MarsEvents; overlay?: ReactNode; live?: boolean }) {
  const { me } = useAuth();
  const mine = useMars();
  const [view, setView] = useState<View>({ v: 'sky' });
  const [tab, setTab] = useState<'all' | 'follow' | 'friend'>(live ? 'all' : 'friend');
  const [sky, setSky] = useState<PlanetFlyer[]>([]);
  const [skyKey, setSkyKey] = useState(0);
  useEffect(() => {
    if (!live || !me) return;
    let on = true;
    getApi()
      .planetSky('mars', tab === 'all' ? 'all' : tab === 'follow' ? 'following' : 'friends')
      .then((r) => on && setSky(r))
      .catch(() => on && setSky([]));
    return () => {
      on = false;
    };
  }, [live, me, tab, skyKey]);
  const realOthers = sky.filter((f) => f.author.id !== me?.id).slice(0, CREATORS.length);
  const myLive = sky.find((f) => f.author.id === me?.id)?.posts.map(videoOf) ?? [];
  const [toast, setToast] = useState<string | null>(null);
  const ev = useRef(events);
  ev.current = events;
  useEffect(() => () => synth.stop(), []);

  const theme = mine.theme;
  const myHandle = me?.displayName || 'neo';
  const neo = neoForm(me?.neoForm);
  const myFlying = live ? myLive.map((video) => ({ video, at: Date.now() - (video.hoursAgo ?? 0) * 3600_000 })) : mine.released.filter((r) => flying(r.at));
  const myWorks = mine.released.filter((r) => !flying(r.at)).map((r) => r.video);
  // live: real UFOs take the first slots; samples fill the rest of the みんな sky only
  const visible = (c: Creator) => {
    if (live) return CREATORS.indexOf(c) >= realOthers.length && tab === 'all';
    return tab === 'all' || (tab === 'follow' ? c.follow : c.friend);
  };
  const liveCount = CREATORS.filter((c) => visible(c) && c.live).length;

  // the UFOs in the sky, in the player's order: you first, then real UFOs, then samples (みんな)
  const crew: Crew[] = [
    ...(myFlying.length ? [{ key: 'me', name: myHandle, isMe: true, videos: myFlying.map((r) => r.video), img: me?.puniPic ?? me?.avatarUrl, emoji: neo?.emoji ?? '🦊' }] : []),
    ...realOthers.map((f) => {
      const name = f.author.displayName || f.author.handle;
      return { key: f.author.id, name, person: { userId: f.author.id, name }, videos: f.posts.map(videoOf), img: f.author.pic, emoji: neoForm(f.author.neoForm)?.emoji ?? '🛸' };
    }),
    ...CREATORS.filter(visible).map((c) => ({ key: c.id, name: c.handle, creator: c, videos: c.flying, img: SAMPLE_FACES.has(c.id) ? spriteUrl(`av-${c.id}`) : null, emoji: c.flying[0]?.emoji ?? '🛸' })),
  ].filter((m) => m.videos.length > 0);
  const riders = crew.slice(0, UFO_SLOTS.length).map((m) => ({ ...m, video: m.videos[0], mine: m.isMe }));

  const say = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 1800);
  };
  const go = (next: View) => {
    if (next.v !== 'play') synth.stop();
    setView(next);
    if (next.v === 'studio' && next.who === 'me') ev.current?.onStudio?.();
  };
  const back = view.v === 'play' ? view.back : view;
  /** from the sky: every UFO, starting at this one */
  const playCrew = (key: string) => go({ v: 'play', crew, start: Math.max(0, crew.findIndex((m) => m.key === key)), video: 0, back });
  /** from a studio / a preview: that person's movies */
  const play = (videos: Video[], owner: string, creator?: Creator, start = 0, person?: Person) => {
    const isMe = !creator && !person;
    const img = creator ? (SAMPLE_FACES.has(creator.id) ? spriteUrl(`av-${creator.id}`) : null) : isMe ? (me?.puniPic ?? me?.avatarUrl) : null;
    const emoji = creator ? (creator.flying[0]?.emoji ?? '🛸') : isMe ? (neo?.emoji ?? '🦊') : '🛸';
    go({ v: 'play', crew: [{ key: creator?.id ?? person?.userId ?? 'me', name: owner, isMe, creator, person, videos, img, emoji }], start: 0, video: start, back });
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#2a2140] text-white">
      {view.v === 'sky' && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 px-3 pt-[calc(10px+env(safe-area-inset-top))]">
            <div className="flex flex-1 rounded-full border border-white/15 bg-black/40 p-1">
              {(
                [
                  ['all', 'みんな'],
                  ['follow', 'フォロー'],
                  ['friend', 'ダチ'],
                ] as const
              ).map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-full py-1.5 text-sm ${tab === k ? 'bg-white/10 font-bold text-amber-200' : 'text-white/70'}`}>
                  {label}
                </button>
              ))}
            </div>
            <span className="shrink-0 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs">
              <span className="text-red-500">●</span> 今 {liveCount}人がライブ中
            </span>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-2">
            <ArtStage name={`mars-sky-${theme}`} reserve={210}>
                {riders.map((r, i) => {
                  const at = UFO_SLOTS[i];
                  return (
                    <button
                      key={r.key}
                      onClick={() => {
                        playCrew(r.key);
                        ev.current?.onUfo?.();
                      }}
                      className="absolute"
                      style={{ left: `${at.x}%`, top: `${at.y}%`, width: `${at.w}%`, transform: 'translate(-50%, -100%)', zIndex: Math.round(at.y) }}
                      aria-label={`${r.name}の映像`}
                    >
                      <span className="flex w-full items-end gap-[3%]" style={{ animation: `ufo ${3 + (i % 3) * 0.7}s ease-in-out ${i * 0.4}s infinite` }}>
                        <span className="w-[50%] shrink-0">
                          <Vessel ride={pickUfo(r.key)} img={r.img} emoji={r.emoji} />
                        </span>
                        <span className="mb-[6%] min-w-0 flex-1 overflow-hidden rounded-lg border border-amber-300/70 bg-black/80 text-left shadow-[0_0_18px_rgba(255,170,90,0.35)]">
                          <span className="block aspect-square w-full overflow-hidden" style={{ containerType: 'inline-size' }}>
                            {r.video && <Frame video={r.video} className="h-full w-full" />}
                          </span>
                          <span className="block truncate px-1 py-0.5 text-[clamp(7px,1.2vw,12px)] leading-tight">{r.mine ? 'あなた' : r.name}</span>
                          <span className="block truncate px-1 pb-0.5 text-[clamp(7px,1.2vw,12px)] leading-tight text-white/70">{r.video?.title}</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
            </ArtStage>
          </div>
        </div>
      )}

      {view.v === 'shoot' &&
        (live ? (
          <LiveShoot
            onPosted={() => {
              setSkyKey(Date.now());
              go({ v: 'sky' });
              say('🛸 公開！ 88時間、みんなの星図をとびます');
              ev.current?.onRelease?.();
            }}
          />
        ) : (
          <ShootChat onKeep={(v) => mine.keep(v)} onOpenStudio={() => go({ v: 'studio', who: 'me' })} onPreview={(v) => play([v], myHandle)} />
        ))}

      {view.v === 'live-studio' && (
        <LiveStudio
          theme={theme}
          who={view.who}
          myId={me?.id}
          myName={myHandle}
          refreshKey={skyKey}
          onPlay={(videos, i, owner, person) => play(videos, owner, undefined, i, person)}
          onTheme={(t) => {
            mine.setTheme(t);
            say(`スタジオを「${THEMES.find((x) => x.id === t)!.label}」にしました`);
          }}
          onPosted={() => {
            setSkyKey(Date.now());
            say('🛸 公開！ 88時間、みんなの星図をとびます');
            ev.current?.onRelease?.();
          }}
          onShoot={() => go({ v: 'shoot' })}
        />
      )}

      {view.v === 'studio' && (
        <StudioView
          theme={theme}
          title={view.who === 'me' ? myHandle : view.who.handle}
          isMe={view.who === 'me'}
          works={view.who === 'me' ? myWorks : view.who.works}
          flyingCount={view.who === 'me' ? myFlying.length : view.who.flying.length}
          locker={view.who === 'me' ? mine.locker : []}
          onPlay={(videos, i) => play(videos, view.who === 'me' ? myHandle : (view.who as Creator).handle, view.who === 'me' ? undefined : view.who, i)}
          onTheme={(t) => {
            mine.setTheme(t);
            say(`スタジオを「${THEMES.find((x) => x.id === t)!.label}」にしました`);
          }}
          onLocker={() => ev.current?.onLocker?.()}
          onRelease={(id) => {
            mine.release(id);
            say('🛸 公開！ 88時間、みんなの星図をとびます');
            ev.current?.onRelease?.();
          }}
          say={say}
        />
      )}

      {view.v === 'play' && (
        <UfoPlayer
          key={`${view.crew.map((m) => m.key).join()}-${view.start}-${view.video}`}
          crew={view.crew}
          start={view.start}
          startVideo={view.video}
          theme={theme}
          onStudio={(m) => {
            const c = m as Crew;
            if (c.creator) go({ v: 'studio', who: c.creator });
            else if (c.person) go({ v: 'live-studio', who: c.person });
            else if (c.isMe) go(live ? { v: 'live-studio', who: 'me' } : { v: 'studio', who: 'me' });
          }}
        />
      )}

      {/* controls: 星図 / 撮影 / スタジオ */}
      <nav className="relative z-20 mx-auto mb-[calc(10px+env(safe-area-inset-bottom))] flex w-[min(94%,560px)] items-center justify-around rounded-[2rem] border border-white/10 bg-black/60 px-6 py-2.5 backdrop-blur">
        <button onClick={() => go({ v: 'sky' })} className={`flex flex-col items-center text-xs ${view.v === 'sky' ? 'text-amber-200' : 'text-white/60'}`}>
          <span className="text-2xl">✨</span>星図
        </button>
        <button onClick={() => go({ v: 'shoot' })} className={`-mt-8 flex flex-col items-center text-xs ${view.v === 'shoot' ? 'text-amber-200' : ''}`}>
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 via-violet-600 to-indigo-600 text-2xl shadow-[0_0_24px_rgba(200,90,255,0.6)]">🎥</span>
          撮影
        </button>
        <button onClick={() => go(live ? { v: 'live-studio', who: 'me' } : { v: 'studio', who: 'me' })} className={`flex flex-col items-center text-xs ${view.v === 'studio' || view.v === 'live-studio' ? 'text-amber-200' : 'text-white/60'}`}>
          <span className="text-2xl">🎬</span>myスタジオ
        </button>
      </nav>

      {toast && (
        <div className="absolute inset-x-0 bottom-28 z-[70] flex justify-center px-4">
          <span className="rounded-full bg-black/80 px-4 py-2 text-center text-sm">{toast}</span>
        </div>
      )}
      {overlay}
    </div>
  );
}

/** Where UFOs hover in the painted sky (4:3), front first: bottom-centre of UFO + its movie card, width — in %. */
const UFO_SLOTS = [
  { x: 50, y: 97, w: 31 },
  { x: 17, y: 92, w: 30 },
  { x: 83, y: 92, w: 30 },
  { x: 50, y: 58, w: 28 },
  { x: 17, y: 50, w: 28 },
  { x: 83, y: 50, w: 28 },
];
/** Sample creators that have a round face picture (public/onboarding/av-*.webp). */
const SAMPLE_FACES = new Set(['onigiri', 'wani_queen', 'kaba_boss', 'gori4545', 'samurai806', 'kong_dread', 'pen_lady']);

function StudioView({
  theme,
  title,
  isMe,
  works,
  flyingCount,
  locker,
  onPlay,
  onTheme,
  onLocker,
  onRelease,
  say,
  followed,
  onFollow,
  onPublished,
  layout,
  pic,
  emoji,
}: {
  theme: Theme;
  title: string;
  isMe: boolean;
  works: Video[];
  flyingCount: number;
  locker: Video[];
  onPlay: (videos: Video[], i: number) => void;
  onTheme: (t: Theme) => void;
  onLocker: () => void;
  onRelease: (id: string) => void;
  say: (t: string) => void;
  /** live: the real follow state and toggle */
  followed?: boolean;
  onFollow?: (on: boolean) => void;
  /** live: a 裏スタジオ video was sent out as a UFO */
  onPublished?: () => void;
  /** live: the Art workshop studio, with its owner standing on the stage */
  layout?: typeof LIVE_STUDIO;
  pic?: string | null;
  emoji?: string;
}) {
  const st = layout ?? STUDIO[theme];
  const [decor, setDecor] = useState(false);
  const [open, setOpen] = useState(false);
  const [following, setFollowing] = useState(followed ?? false);
  useEffect(() => setFollowing(followed ?? false), [followed]);
  const pct = (r: { left: number; top: number; width: number; height: number }) => ({ left: `${r.left}%`, top: `${r.top}%`, width: `${r.width}%`, height: `${r.height}%` });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-4">
      <div className="relative mx-auto w-full max-w-[min(100%,calc((100svh-150px)*1.1))]" style={{ aspectRatio: st.aspect }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={layout ? layout.src : stillUrl(st.art)} alt="" className="absolute inset-0 h-full w-full select-none" draggable={false} />
        {layout ? (
          // the owner stands on the studio's stage
          <span
            className="absolute flex aspect-square -translate-x-1/2 items-center justify-center overflow-hidden rounded-full border-[3px] border-[#f3e3c3] bg-[#2a2140] shadow-[0_0_24px_rgba(255,160,80,0.6)]"
            style={{ left: `${layout.rider.x}%`, bottom: `${100 - layout.rider.bottom}%`, width: `${layout.rider.size}%`, animation: 'ufo 3s ease-in-out infinite' }}
          >
            {pic ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pic} alt="" className="h-full w-full object-cover" draggable={false} />
            ) : (
              <span className="text-[clamp(24px,6vw,56px)] leading-none">{emoji ?? '🎬'}</span>
            )}
          </span>
        ) : (
          <div className="pointer-events-none absolute bottom-0 left-1/2 h-[5%] w-[16%] -translate-x-1/2 rounded-t-full bg-black/85 blur-md" />
        )}
        {/* our title + stats over the ones drawn on the art */}
        <div className="absolute flex flex-col items-center justify-center rounded-2xl border border-amber-400/60 bg-[#1c0d08]/95 text-center shadow-[0_0_24px_rgba(255,150,60,0.35)]" style={{ ...pct(st.title), containerType: 'inline-size' }}>
          <p className="truncate px-2 text-[clamp(14px,9cqw,44px)] font-black tracking-wide text-amber-50">{isMe ? 'myスタジオ' : `${title.toUpperCase()} STUDIO`}</p>
          <p className="text-[clamp(9px,3.4cqw,15px)] text-white/75">
            {flyingCount ? '🛸 いま映像がとんでいます' : 'ようこそ'}
          </p>
        </div>
        <div className="absolute flex gap-[3%]" style={pct(st.buttons)}>
          {isMe ? (
            <>
              <button
                onClick={() => {
                  setOpen(true);
                  onLocker();
                }}
                className="flex-1 rounded-full border border-white/25 bg-[#1c0d08]/95 text-[clamp(8px,1.3vw,13px)] whitespace-nowrap"
              >
                🔒 裏スタジオ {locker.length}
              </button>
              <button onClick={() => setDecor(true)} className="flex-1 rounded-full border border-amber-400/70 bg-[#1c0d08]/95 text-[clamp(8px,1.3vw,13px)] whitespace-nowrap text-amber-200">
                🎨 飾る
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setFollowing(!following);
                  onFollow?.(!following);
                }} className={`flex-1 rounded-full text-[clamp(8px,1.3vw,13px)] whitespace-nowrap ${following ? 'border border-white/30 bg-[#1c0d08]/95' : 'bg-violet-600'}`}>
                {following ? 'フォロー中' : 'フォロー'}
              </button>
              <button onClick={() => say('スタジオを飾るのは本人だけです')} className="flex-1 rounded-full border border-amber-400/50 bg-[#1c0d08]/95 text-[clamp(8px,1.3vw,13px)] whitespace-nowrap text-amber-200/70">
                🎨 スタジオ
              </button>
            </>
          )}
        </div>
        {/* the works: our cards over the ones drawn on the art */}
        {st.slots.map((r, k) => {
          const w = works[k];
          return (
            <div key={k} className="absolute overflow-hidden rounded-xl border border-amber-500/50 bg-[#120806]" style={{ ...pct(r), containerType: 'inline-size' }}>
              {w ? (
                <button onClick={() => onPlay(works, k)} className="flex h-full w-full flex-col text-left">
                  <Frame video={w} className="min-h-0 w-full flex-1" />
                  <div className="shrink-0 bg-black/80 px-[4cqw] py-[2cqw]">
                    <p className="truncate text-[clamp(8px,7cqw,15px)]">
                      <span className={`mr-1 rounded px-1 text-[0.8em] ${KIND_COLOR[w.kind]}`}>{w.kind}</span>
                      {w.title}
                    </p>
                  </div>
                </button>
              ) : (
                <div className="flex h-full w-full items-center justify-center p-[6cqw] text-center text-[clamp(7px,6cqw,13px)] text-white/35">
                  {k === 0 && isMe ? '公開した映像は、88時間とんだあと、ここに並びます' : 'まだ作品はありません'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {layout && works.length > st.slots.length && (
        <div className="mx-auto mt-3 flex max-w-[min(100%,calc((100svh-150px)*1.1))] gap-3 overflow-x-auto px-3 pb-2">
          {works.slice(st.slots.length).map((w, j) => (
            <button key={w.id} onClick={() => onPlay(works, st.slots.length + j)} className="w-28 shrink-0 overflow-hidden rounded-xl border border-amber-300/50 bg-black/40 text-left">
              <Frame video={w} className="aspect-square w-full" />
              <p className="truncate px-1.5 py-1 text-[11px]">{w.title}</p>
            </button>
          ))}
        </div>
      )}

      {decor && (
        <Sheet onClose={() => setDecor(false)} title="🎨 スタジオを飾る">
          <p className="mb-3 text-center text-[11px] text-white/55">星図とスタジオの見た目を選べます</p>
          <div className="grid grid-cols-2 gap-3">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onTheme(t.id);
                  setDecor(false);
                }}
                className={`overflow-hidden rounded-2xl border-2 ${theme === t.id ? 'border-amber-400' : 'border-white/15'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={stillUrl(STUDIO[t.id].art)} alt="" className="aspect-square w-full object-cover" />
                <p className="py-1.5 text-sm">{t.label}</p>
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {open && (
        <Sheet onClose={() => setOpen(false)} title="🔒 裏スタジオ（自分だけ）">
          <div className="max-h-[70svh] overflow-y-auto">
          <Backstage
            onPublish={
              onPublished
                ? () => {
                    setOpen(false);
                    onPublished();
                  }
                : undefined
            }
          />
          <p className="mb-2 text-xs font-bold text-amber-100">🎞 撮影した映像（未公開）</p>
          <p className="mb-3 text-center text-[11px] text-white/55">公開すると、UFOになって88時間、ダチやフォロワーの星図をとびます。</p>
          <div className="space-y-3">
            {locker.map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-2xl bg-black/30 p-2">
                <button onClick={() => onPlay([v], 0)} className="w-24 shrink-0 overflow-hidden rounded-lg" aria-label={`${v.title}を見る`}>
                  <Frame video={v} className="aspect-video w-full" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{v.title}</p>
                  <p className="text-[11px] text-white/50">
                    {v.kind} ・ {fmtLen(v.seconds)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    onRelease(v.id);
                    setOpen(false);
                  }}
                  className="rounded-full bg-gradient-to-r from-orange-500 to-fuchsia-600 px-3 py-1.5 text-xs font-bold"
                >
                  🛸 公開する
                </button>
              </div>
            ))}
            {!locker.length && <p className="text-center text-xs text-white/50">撮影した映像はまだありません（撮影すると、ここにしまわれます）</p>}
          </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-[90] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-3xl border-t border-amber-300/30 bg-gradient-to-b from-[#2a120c] to-[#120706] p-5 pb-[calc(24px+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <p className="mb-2 text-center text-sm font-bold">{title}</p>
        {children}
      </div>
    </div>
  );
}

/**
 * The live studio (Art workshop, retro screen-print poster; square): the title over the top wall,
 * the works on the big screen, the owner on the round stage — in % of the picture.
 */
const LIVE_STUDIO = {
  src: `${ART_BASE}/mars-studio.jpg`,
  art: 'mars-studio',
  aspect: '1 / 1',
  title: { left: 20, top: 1.5, width: 60, height: 10.5 },
  buttons: { left: 60, top: 64.5, width: 37, height: 5 },
  slots: [
    { left: 60.5, top: 13, width: 36, height: 33 },
    { left: 60.5, top: 47.5, width: 11.3, height: 15 },
    { left: 72.8, top: 47.5, width: 11.3, height: 15 },
    { left: 85.1, top: 47.5, width: 11.3, height: 15 },
  ],
  rider: { x: 52, bottom: 84, size: 17 },
};

/** A real studio (live): works = movies back from 88 hours in the sky; your 裏スタジオ inside. */
function LiveStudio({
  theme,
  who,
  myId,
  myName,
  refreshKey,
  onPlay,
  onTheme,
  onPosted,
  onShoot,
}: {
  theme: Theme;
  who: 'me' | { userId: string; name: string };
  myId?: string;
  myName: string;
  refreshKey: number;
  onPlay: (videos: Video[], i: number, owner: string, person?: { userId: string; name: string }) => void;
  onTheme: (t: Theme) => void;
  onPosted: () => void;
  onShoot: () => void;
}) {
  const id = who === 'me' ? myId : who.userId;
  const name = who === 'me' ? myName : who.name;
  const [profile, setProfile] = useState<PlanetProfileView | null>(null);
  const [toast, setToast] = useState('');
  useEffect(() => {
    if (!id) return;
    getApi()
      .planetProfile('mars', id)
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [id, refreshKey]);
  const works = (profile?.works ?? []).map(videoOf);
  const flyingNow = (profile?.flying ?? []).map(videoOf);
  const isMe = who === 'me' || id === myId;
  void onShoot;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <StudioView
        theme={theme}
        title={name}
        isMe={isMe}
        works={[...flyingNow, ...works]}
        flyingCount={flyingNow.length}
        locker={[]}
        onPlay={(videos, i) => onPlay(videos, i, name, isMe ? undefined : { userId: id!, name })}
        onTheme={onTheme}
        onLocker={() => undefined}
        onRelease={() => undefined}
        say={(t) => {
          setToast(t);
          setTimeout(() => setToast(''), 1800);
        }}
        followed={profile?.followedByMe}
        onFollow={
          isMe || !id
            ? undefined
            : (on) =>
                getApi()
                  .followSaturnUser(id, on)
                  .catch(() => undefined)
        }
        onPublished={isMe ? onPosted : undefined}
        layout={LIVE_STUDIO}
        pic={profile?.author.pic}
        emoji={neoForm(profile?.author.neoForm)?.emoji ?? '🛸'}
      />
      {toast && (
        <div className="absolute inset-x-0 bottom-6 z-[70] flex justify-center px-4">
          <span className="rounded-full bg-black/80 px-4 py-2 text-center text-sm">{toast}</span>
        </div>
      )}
    </div>
  );
}
