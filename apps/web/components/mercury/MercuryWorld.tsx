'use client';

import { neoForm, type PlanetFlyer, type PlanetPostView, type PlanetProfileView } from '@obolo/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError, getApi } from '@/lib/api';
import { Artwork } from '@/components/Artwork';
import { useAuth } from '@/lib/auth';
import { fmt, P, SAILORS, type Sailor, type Song } from '@/lib/mercury/sea';
import { ART_BASE, ArtStage, pickShip, Vessel } from '@/components/art/Stage';
import { ComposeChat } from './ComposeChat';
import { ShipPlayer, type Flyer } from './ShipPlayer';
import { atSea, hoursSince, useMercury } from '@/lib/mercury/state';
import { spriteUrl } from '@/lib/onboarding/media';
import { synth } from '@/lib/synth';

/**
 * Mercury — the planet of music (client design 2026-10-05 v2, docs/mercury.md).
 *  海 (timeline): friends' released songs sail as ships for 88 hours. Tap a ship → their songs of
 *     the last 88 hours play; swipe for the next one; three-tier stars.
 *  島 (profile): every user has an island. Released songs decorate it as records once back from
 *     sea; demos are buried in the soil (own island only) and set sail when released.
 *  作曲: talk to KIMORIN (Bati once the visitor has one) and they make a demo (placeholder chat).
 * Square stage with the controls underneath (docs/devices.md).
 * `live` (the /mercury page, client decision 2026-10-07): the sea, the islands and setting sail go
 * through the server like Saturn / Jupiter — real ships take the slots of the sample ones; the
 * samples keep the みんな sea lively. Without it (the Day 6 tutorial) everything stays on this device.
 */
export interface MercuryEvents {
  onShip?: () => void;
  onSwipe?: () => void;
  onStar?: () => void;
  onIsland?: () => void;
  onSoil?: () => void;
  onRelease?: () => void;
}

type Who = 'me' | Sailor | { userId: string; name: string };
type View = { v: 'sea' } | { v: 'compose' } | { v: 'island'; who: Who } | { v: 'play'; flyers: SeaFlyer[]; start: number; song: number; back: View };
/** A ship in the player: whose it is (for「島へ」) and what it says on the sea. */
type SeaFlyer = Flyer & { owner: Who; title: string; sub?: string };

/** A posted song as the sea / island show it (a record with an emoji until songs get covers). */
const RECORD_EMOJI = ['🎵', '🎶', '🎤', '🎸', '🎹', '🥁', '🎧', '🎺'];
const COVERS = ['moon', 'sakura', 'ocean', 'city', 'forest', 'candy', 'space', 'fire', 'rain', 'dawn'];
const hash = (t: string) => [...t].reduce((n, c) => n + c.charCodeAt(0), 0);
const songOf = (p: PlanetPostView): Song => ({
  id: p.id,
  title: p.title || '無題',
  artist: p.author.displayName || p.author.handle,
  emoji: RECORD_EMOJI[hash(p.id) % RECORD_EMOJI.length],
  // a painted cover (Art workshop) until songs get their own
  cover: `${ART_BASE}/cover-${COVERS[hash(p.id) % COVERS.length]}.jpg`,
  hue: hash(p.author.id) % 360,
  seconds: Math.max(1, Math.round(p.seconds ?? 180)),
  preset: P(96, 60, 'major', [0, 4, 5, 3], 'triangle'),
  audioUrl: p.url,
  hoursAgo: Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 3600_000),
  postId: p.id,
  repliers: p.repliers,
});

export function MercuryWorld({ events, overlay, live = false }: { events?: MercuryEvents; overlay?: ReactNode; live?: boolean }) {
  const { me } = useAuth();
  const mine = useMercury();
  const [view, setView] = useState<View>({ v: 'sea' });
  const [tab, setTab] = useState<'all' | 'follow' | 'friend'>(live ? 'all' : 'friend');
  // server data (live)
  const [sky, setSky] = useState<PlanetFlyer[]>([]);
  const [skyKey, setSkyKey] = useState(0);
  useEffect(() => {
    if (!live || !me) return;
    let on = true;
    getApi()
      .planetSky('mercury', tab === 'all' ? 'all' : tab === 'follow' ? 'following' : 'friends')
      .then((r) => on && setSky(r))
      .catch(() => on && setSky([]));
    return () => {
      on = false;
    };
  }, [live, me, tab, skyKey]);
  const realOthers = sky.filter((f) => f.author.id !== me?.id).slice(0, SAILORS.length);
  const myLive = sky.find((f) => f.author.id === me?.id)?.posts.map(songOf) ?? [];
  const [toast, setToast] = useState<string | null>(null);
  const ev = useRef(events);
  ev.current = events;
  useEffect(() => () => synth.stop(), []);

  const myHandle = me?.displayName || 'neo';
  const neo = neoForm(me?.neoForm);
  const mySailing = live ? myLive.map((song) => ({ song, at: Date.now() - (song.hoursAgo ?? 0) * 3600_000 })) : mine.released.filter((r) => atSea(r.at));
  const myRecords = mine.released.filter((r) => !atSea(r.at)).map((r) => r.song);
  // live: real ships take the first slots; samples fill the rest of the みんな sea only
  const visible = (s: Sailor) => {
    const i = SAILORS.indexOf(s);
    if (live) return i >= realOthers.length && tab === 'all';
    return tab === 'all' || (tab === 'follow' ? s.follow : s.friend);
  };
  const sailingCount = SAILORS.filter(visible).length + realOthers.length + (mySailing.length ? 1 : 0);

  // the ships on the sea, in the player's order: you first, then real ships, then samples (みんな)
  const fleet: SeaFlyer[] = [
    ...(mySailing.length
      ? [
          {
            key: 'me',
            name: myHandle,
            isMe: true,
            owner: 'me' as Who,
            songs: mySailing.map((r) => r.song),
            title: mySailing[0].song.title,
            sub: hoursSince(mySailing[0].at) ? `${hoursSince(mySailing[0].at)}時間前` : 'たった今',
            img: me?.puniPic ?? me?.avatarUrl,
            emoji: neo?.emoji ?? '🦊',
          },
        ]
      : []),
    ...realOthers.map((f) => {
      const songs = f.posts.map(songOf);
      const name = f.author.displayName || f.author.handle;
      return { key: f.author.id, name, owner: { userId: f.author.id, name } as Who, songs, title: songs[0]?.title ?? '', img: f.author.pic, emoji: neoForm(f.author.neoForm)?.emoji ?? '⛵' };
    }),
    ...SAILORS.filter(visible).map((s) => ({ key: s.id, name: s.handle, owner: s as Who, songs: s.sailing, title: s.sailing[0]?.title ?? '', img: spriteUrl(s.avatar), emoji: '⛵' })),
  ].filter((f) => f.songs.length > 0);
  const riders = fleet.slice(0, SEA_SLOTS.length);

  const say = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 1800);
  };
  const go = (next: View) => {
    if (next.v !== 'play') synth.stop();
    setView(next);
    if (next.v === 'island' && next.who === 'me') ev.current?.onIsland?.();
  };
  const back = view.v === 'play' ? view.back : view;
  /** from the sea: every ship, starting at this one */
  const playFleet = (key: string) => go({ v: 'play', flyers: fleet, start: Math.max(0, fleet.findIndex((f) => f.key === key)), song: 0, back });
  /** from an island: that person's songs */
  const play = (who: Who, songs: Song[], start = 0, img?: string | null) => {
    const name = who === 'me' ? myHandle : 'userId' in who ? who.name : who.handle;
    const pic = who === 'me' ? (me?.puniPic ?? me?.avatarUrl) : 'userId' in who ? img : spriteUrl(who.avatar);
    const key = who === 'me' ? 'me' : 'userId' in who ? who.userId : who.id;
    go({ v: 'play', flyers: [{ key, name, isMe: who === 'me', owner: who, songs, title: songs[0]?.title ?? '', img: pic, emoji: who === 'me' ? (neo?.emoji ?? '🦊') : '⛵' }], start: 0, song: start, back });
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0d2236] text-white">
      {view.v === 'sea' && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="px-4 pt-[calc(10px+env(safe-area-inset-top))]">
            <Tabs tab={tab} setTab={setTab} />
            <p className="mx-auto mt-2 w-fit rounded-full border border-amber-300/50 bg-black/30 px-4 py-1 text-sm text-amber-100">👥 今 {sailingCount}人が航海中</p>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-2">
            <ArtStage name="mercury-sea" reserve={230} focus={62}>
                {riders.map((r, i) => {
                  const at = SEA_SLOTS[i];
                  return (
                    <button
                      key={r.key}
                      onClick={() => {
                        playFleet(r.key);
                        ev.current?.onShip?.();
                      }}
                      className="absolute flex flex-col items-center"
                      style={{ left: `${at.x}%`, top: `${at.y}%`, width: `${at.w * Math.min(1, pickShip(r.key).ratio * 1.15)}%`, transform: 'translate(-50%, -100%)', zIndex: Math.round(at.y) }}
                      aria-label={`@${r.name}の船`}
                    >
                      <span className="flex w-full flex-col items-center" style={{ animation: `sail ${4 + (i % 3)}s ease-in-out ${i * 0.5}s infinite` }}>
                        <span className="mb-[3%] max-w-[140%] truncate rounded-xl border border-amber-300/70 bg-[#0d1838]/85 px-2 py-1 text-left text-[clamp(8px,1.4vw,13px)] leading-tight shadow-lg backdrop-blur-sm">
                          {r.isMe ? '新曲を出航！' : `@${r.name}`}「{r.title}」
                          {r.sub && <span className="block text-white/60">{r.sub}</span>}
                        </span>
                        <Vessel ride={pickShip(r.key)} img={r.img} emoji={r.emoji} />
                      </span>
                    </button>
                  );
                })}
            </ArtStage>
          </div>
        </div>
      )}

      {view.v === 'island' && live && (view.who === 'me' || 'userId' in (view.who as object)) && (
        <LiveIsland
          who={view.who as 'me' | { userId: string; name: string }}
          myId={me?.id}
          myName={myHandle}
          refreshKey={skyKey}
          onPlay={(songs, i, pic) => play(view.who as Who, songs, i, pic)}
          onSoil={() => ev.current?.onSoil?.()}
          onReleased={() => {
            setSkyKey(Date.now());
            say('🚢 出航！ 88時間、みんなの海を渡ります');
            ev.current?.onRelease?.();
          }}
          say={say}
        />
      )}
      {view.v === 'island' && !(live && (view.who === 'me' || 'userId' in (view.who as object))) && (
        <IslandView
          title={view.who === 'me' ? myHandle : (view.who as Sailor).handle}
          isMe={view.who === 'me'}
          records={view.who === 'me' ? myRecords : (view.who as Sailor).records}
          sailing={view.who === 'me' ? mySailing.map((r) => r.song) : (view.who as Sailor).sailing}
          pic={view.who === 'me' ? (me?.puniPic ?? me?.avatarUrl) : spriteUrl((view.who as Sailor).avatar)}
          emoji={view.who === 'me' ? (neo?.emoji ?? '🦊') : '⛵'}
          soil={view.who === 'me' ? mine.soil : []}
          onPlay={(songs, i) => play(view.who as Who, songs, i)}
          onSoil={() => ev.current?.onSoil?.()}
          onRelease={(id) => {
            mine.release(id);
            say('🚢 出航！ 88時間、みんなの海を渡ります');
            ev.current?.onRelease?.();
          }}
          say={say}
        />
      )}

      {view.v === 'compose' && <ComposeChat onBury={(song) => (live ? setSkyKey(Date.now()) : mine.bury(song))} onOpenIsland={() => go({ v: 'island', who: 'me' })} />}

      {view.v === 'play' && (
        <ShipPlayer
          key={`${view.flyers.map((f) => f.key).join()}-${view.start}-${view.song}`}
          flyers={view.flyers}
          start={view.start}
          startSong={view.song}
          stars={mine.stars}
          onStar={(id, tier) => {
            mine.star(id, tier);
            // a real post: the star reaches its maker too (no counts are shown anywhere)
            if (live && /^[0-9a-f-]{36}$/.test(id))
              getApi()
                .starPlanetPost('mercury', id, tier > 0)
                .catch(() => undefined);
            ev.current?.onStar?.();
          }}
          onOwner={(f) => go({ v: 'island', who: (f as SeaFlyer).owner })}
          onSwipe={() => ev.current?.onSwipe?.()}
        />
      )}

      {/* controls: 海図 / 作曲 / 島 */}
      <nav className="relative z-20 mx-auto mb-[calc(10px+env(safe-area-inset-bottom))] flex w-[min(94%,560px)] items-center justify-around rounded-[2rem] border border-white/10 bg-[#0a1430]/80 px-6 py-2.5 backdrop-blur">
        <button onClick={() => go({ v: 'sea' })} className={`flex flex-col items-center text-xs ${view.v === 'sea' ? 'text-amber-200' : 'text-white/60'}`}>
          <span className="text-2xl">🗺️</span>海図
        </button>
        <button onClick={() => go({ v: 'compose' })} className={`-mt-8 flex flex-col items-center text-xs ${view.v === 'compose' ? 'text-amber-200' : ''}`}>
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 via-fuchsia-500 to-violet-500 text-2xl shadow-[0_0_24px_rgba(220,90,255,0.6)]">♫+</span>
          作曲
        </button>
        <button onClick={() => go({ v: 'island', who: 'me' })} className={`flex flex-col items-center text-xs ${view.v === 'island' ? 'text-amber-200' : 'text-white/60'}`}>
          <span className="text-2xl">🏝️</span>myアイランド
        </button>
      </nav>

      {toast && (
        <div className="absolute inset-x-0 bottom-28 z-[70] flex justify-center px-4">
          <span className="rounded-full bg-black/75 px-4 py-2 text-center text-sm">{toast}</span>
        </div>
      )}
      {overlay}
    </div>
  );
}

function Tabs({ tab, setTab }: { tab: 'all' | 'follow' | 'friend'; setTab: (t: 'all' | 'follow' | 'friend') => void }) {
  return (
    <div className="mx-auto flex w-full max-w-md rounded-full border border-white/15 bg-black/30 p-1">
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
  );
}

/** Where ships sail on the painted sea (4:3), front row first: bottom-centre of the ship, width — all in %. */
const SEA_SLOTS = [
  { x: 50, y: 97, w: 21 },
  { x: 18, y: 93, w: 20 },
  { x: 82, y: 94, w: 20 },
  { x: 33, y: 77, w: 16 },
  { x: 67, y: 78, w: 16 },
  { x: 14, y: 63, w: 13 },
  { x: 50, y: 61, w: 13 },
  { x: 86, y: 64, w: 13 },
];

/** A record (round art) for a song. */
function Record({ song, spinning, className = '' }: { song: Song; spinning?: boolean; className?: string }) {
  return (
    <div className={`relative aspect-square overflow-hidden rounded-full border-[5px] border-black/80 shadow-[0_16px_40px_rgba(0,0,0,0.55)] ${className}`}>
      <div className={`absolute inset-0 ${spinning ? 'animate-[spin-slow_14s_linear_infinite]' : ''}`}>
        {song.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={song.cover.startsWith('/') ? song.cover : spriteUrl(song.cover)} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <Artwork hue={song.hue ?? 220} emoji={song.emoji ?? '🎵'} className="h-full w-full" />
        )}
        <span className="absolute left-1/2 top-1/2 h-[7%] w-[7%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-300/80 bg-black" />
      </div>
    </div>
  );
}

/**
 * The island painting (Art workshop, gouache picture book): shown 4:3 from the top of the square
 * painting; the owner's character stands behind the DJ booth (centre, in % of that stage).
 */
const ISLAND = { src: `${ART_BASE}/mercury-island.jpg`, focusY: 20 };
const islandRider = { x: 52.5, y: 60, size: 13 };

/** The island's wooden pier (a curved boardwalk with lanterns), drawn under the records. */
function Pier() {
  return (
    <svg viewBox="0 0 1000 300" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-[78%] w-full" aria-hidden>
      <defs>
        <pattern id="planks" width="34" height="300" patternUnits="userSpaceOnUse">
          <rect width="34" height="300" fill="#7a4d26" />
          <rect x="31" width="3" height="300" fill="#4a2c14" />
          <rect x="6" y="40" width="14" height="2" fill="#8f5e31" opacity="0.6" />
        </pattern>
        <linearGradient id="pier-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd9a0" stopOpacity="0.25" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </linearGradient>
        <radialGradient id="lamp">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset="0.35" stopColor="#ffc865" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ff9a2e" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* posts in the water */}
      {[60, 200, 350, 500, 650, 800, 940].map((x) => (
        <rect key={x} x={x - 8} y={x === 500 ? 250 : 215 + Math.abs(500 - x) / 20} width="16" height="70" fill="#2b1a0c" />
      ))}
      <path d="M0 110 Q500 30 1000 110 L1000 210 Q500 140 0 210 Z" fill="url(#planks)" />
      <path d="M0 110 Q500 30 1000 110 L1000 210 Q500 140 0 210 Z" fill="url(#pier-shade)" />
      <path d="M0 110 Q500 30 1000 110" fill="none" stroke="#a8743d" strokeWidth="7" />
      <path d="M0 210 Q500 140 1000 210" fill="none" stroke="#3a2210" strokeWidth="9" />
      {/* lanterns on the front edge */}
      {[90, 270, 450, 630, 810, 960].map((x) => {
        const y = 210 - 70 * (1 - Math.pow((x - 500) / 500, 2));
        return (
          <g key={x}>
            <circle cx={x} cy={y - 18} r="34" fill="url(#lamp)" />
            <rect x={x - 6} y={y - 28} width="12" height="18" rx="3" fill="#ffe7a8" />
            <rect x={x - 3} y={y - 10} width="6" height="14" fill="#2b1a0c" />
          </g>
        );
      })}
    </svg>
  );
}

function IslandView({
  title,
  isMe,
  pic,
  emoji,
  records,
  sailing,
  soil,
  action,
  onPlay,
  onSoil,
  onRelease,
  say,
}: {
  title: string;
  isMe: boolean;
  pic?: string | null;
  emoji: string;
  records: Song[];
  sailing: Song[];
  soil: Song[];
  /** top-right button (follow) */
  action?: ReactNode;
  onPlay: (songs: Song[], i: number) => void;
  onSoil: () => void;
  onRelease: (id: string) => void;
  say: (t: string) => void;
}) {
  const [dig, setDig] = useState(false);
  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-[#123a52] via-[#0d2a44] to-[#081a2e] pb-6">
      <div className="relative mx-auto max-w-3xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ISLAND.src} alt="" className="aspect-[4/3] w-full select-none object-cover" style={{ objectPosition: `50% ${ISLAND.focusY}%` }} draggable={false} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[16%] bg-gradient-to-b from-transparent to-[#123a52]" />
        {/* the owner is the island's DJ */}
        <span
          className="absolute flex aspect-square -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-[3px] border-white/85 bg-[#1b1f3a] shadow-[0_0_28px_rgba(255,170,90,0.75)]"
          style={{ left: `${islandRider.x}%`, top: `${islandRider.y}%`, width: `${islandRider.size}%`, animation: 'ufo 3s ease-in-out infinite' }}
        >
          {pic ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pic} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <span className="text-[clamp(28px,7vw,64px)] leading-none">{emoji}</span>
          )}
        </span>
        <div className="absolute inset-x-3 top-[calc(8px+env(safe-area-inset-top))] flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate rounded-full border-2 border-fuchsia-300/60 bg-[#0a1430]/85 px-4 py-1.5 text-[clamp(14px,3vw,22px)] font-black tracking-wider shadow-[0_0_16px_rgba(240,120,255,0.4)]">
              {isMe ? 'myアイランド' : `${title.toUpperCase()} ISLAND`}
            </p>
          </div>
          {action ?? (
            <button onClick={() => say('島を飾るのは準備中です')} className="shrink-0 rounded-full border border-amber-300/60 bg-[#0a1430]/85 px-4 py-1.5 text-sm text-amber-100">
              🏝 島を飾る
            </button>
          )}
        </div>
      </div>

      {/* the pier: the records of this island (no play counts, no resident counts — client rule) */}
      <div className="relative mx-auto -mt-[10%] max-w-3xl">
        <Pier />
        {records.length ? (
          <div className="relative flex snap-x snap-mandatory gap-4 overflow-x-auto px-[8%] pb-10 pt-2 [scrollbar-width:none]">
            {records.map((r, i) => (
              <button key={r.id} onClick={() => onPlay(records, i)} className="w-[min(30%,150px)] shrink-0 snap-center text-center">
                <Record song={r} />
                <span className="mx-auto -mt-1 block h-2 w-[70%] rounded-full bg-cyan-300/80 shadow-[0_0_14px_4px_rgba(80,220,255,0.6)]" />
                <span className="mt-2 block truncate rounded-md bg-black/45 px-1 py-0.5 text-[clamp(11px,2.2vw,14px)] font-bold">{r.title}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="relative px-6 pb-12 pt-10 text-center text-sm text-white/75">{isMe ? '出航した曲は、88時間の航海を終えると、この桟橋に飾られます。' : 'まだレコードはありません'}</p>
        )}
        {records.length > 3 && <p className="relative -mt-8 pb-3 text-center text-[11px] text-white/65">⟵ 左右にスワイプして曲をチェック ⟶</p>}
      </div>

      <div className="mx-auto mt-2 flex max-w-2xl flex-wrap justify-center gap-2 px-4">
        {sailing.length > 0 && (
          <button onClick={() => onPlay(sailing, 0)} className="rounded-full border border-cyan-200/40 bg-[#0a1430]/80 px-4 py-2 text-xs text-cyan-100">
            🚢 いま航海中の曲を聴く
          </button>
        )}
        {isMe && (
          // the soil: demos are buried here
          <button
            onClick={() => {
              setDig(true);
              onSoil();
            }}
            className="rounded-full border border-amber-200/60 bg-[#3a2410]/90 px-4 py-2 text-xs"
          >
            ⛏ 土の中の曲
          </button>
        )}
      </div>

      {dig && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/60" onClick={() => setDig(false)}>
          <div className="w-full max-w-lg rounded-t-3xl border-t border-amber-200/30 bg-gradient-to-b from-[#3b2614] to-[#1d1209] p-5 pb-[calc(24px+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <p className="text-center text-sm font-bold">⛏ 土の中のデモ曲</p>
            <p className="mt-1 text-center text-[11px] text-white/55">まだ発表していない曲は、島の土に埋まっています。出航させると、88時間みんなの海を渡ります。</p>
            <div className="mt-4 space-y-3">
              {soil.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-2xl bg-black/25 p-2">
                  <button onClick={() => onPlay([d], 0)} className="w-14 shrink-0" aria-label={`${d.title}を聴く`}>
                    <Record song={d} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{d.title}</p>
                    <p className="text-[11px] text-white/50">デモ ・ {fmt(d.seconds)}</p>
                  </div>
                  <button
                    onClick={() => {
                      onRelease(d.id);
                      setDig(false);
                    }}
                    className="rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-3 py-1.5 text-xs font-bold"
                  >
                    🚢 出航させる
                  </button>
                </div>
              ))}
              {!soil.length && <p className="text-center text-xs text-white/50">土の中は空っぽです（作曲すると、ここにデモが埋まります）</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** A real island (live): records = songs back from 88 hours at sea; the soil = your saved songs. */
function LiveIsland({
  who,
  myId,
  myName,
  refreshKey,
  onPlay,
  onSoil,
  onReleased,
  say,
}: {
  who: 'me' | { userId: string; name: string };
  myId?: string;
  myName: string;
  refreshKey: number;
  onPlay: (songs: Song[], i: number, pic?: string | null) => void;
  onSoil: () => void;
  onReleased: () => void;
  say: (t: string) => void;
}) {
  const id = who === 'me' ? myId : who.userId;
  const name = who === 'me' ? myName : who.name;
  const [profile, setProfile] = useState<PlanetProfileView | null>(null);
  const [soil, setSoil] = useState<Song[]>([]);
  const [following, setFollowing] = useState(false);
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (!id) return;
    getApi()
      .planetProfile('mercury', id)
      .then((p) => {
        setProfile(p);
        setFollowing(p.followedByMe);
      })
      .catch(() => setProfile(null));
    if (who === 'me')
      getApi()
        .savedSongs()
        .then((list) =>
          setSoil(
            list
              .filter((x) => !x.posted)
              .map((x) => ({ id: x.id, title: x.title, artist: myName, emoji: '🎵', hue: 30, seconds: Math.round(x.seconds), preset: P(96, 60, 'major', [0, 4, 5, 3], 'triangle'), audioUrl: x.url })),
          ),
        )
        .catch(() => setSoil([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, refreshKey, key]);
  const isMe = who === 'me' || id === myId;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <IslandView
        title={name}
        isMe={isMe}
        records={(profile?.works ?? []).map(songOf)}
        sailing={(profile?.flying ?? []).map(songOf)}
        pic={profile?.author.pic}
        emoji={neoForm(profile?.author.neoForm)?.emoji ?? '⛵'}
        action={
          !isMe && id ? (
            <button
              onClick={() => {
                const on = !following;
                setFollowing(on);
                getApi()
                  .followSaturnUser(id, on)
                  .catch(() => undefined);
              }}
              className={`shrink-0 rounded-full border-2 px-4 py-1.5 text-sm font-bold ${following ? 'border-white/30 bg-[#0a1430]/85' : 'border-amber-300/80 bg-[#0a1430]/85 text-amber-200'}`}
            >
              {following ? 'フォロー中' : '＋ フォロー'}
            </button>
          ) : undefined
        }
        soil={soil}
        onPlay={(songs, i) => onPlay(songs, i, profile?.author.pic)}
        onSoil={onSoil}
        onRelease={(songId) => {
          getApi()
            .createPlanetPost('mercury', { sourceId: songId, text: '' })
            .then(() => {
              setKey(Date.now());
              onReleased();
            })
            .catch((e) => say(e instanceof ApiError && e.code === 'MODERATION' ? 'その曲名は使えないよ' : '出航できなかった…もう一度'));
        }}
        say={say}
      />
    </div>
  );
}
