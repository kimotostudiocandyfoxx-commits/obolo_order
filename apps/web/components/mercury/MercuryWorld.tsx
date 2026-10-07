'use client';

import { neoForm, type PlanetFlyer, type PlanetPostView, type PlanetProfileView } from '@obolo/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError, getApi } from '@/lib/api';
import { Artwork } from '@/components/Artwork';
import { useAuth } from '@/lib/auth';
import { fmt, P, SAILORS, type Sailor, type Song } from '@/lib/mercury/sea';
import { ArtStage, Vessel } from '@/components/art/Stage';
import { ComposeChat } from './ComposeChat';
import { atSea, hoursSince, useMercury } from '@/lib/mercury/state';
import { spriteUrl, stillUrl } from '@/lib/onboarding/media';
import { synth } from '@/lib/synth';
import { stopAudio, toggleAudio } from '@/lib/audio';

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
type View = { v: 'sea' } | { v: 'compose' } | { v: 'island'; who: Who } | { v: 'play'; title: string; songs: Song[]; start: number; back: View; owner?: Who };

/** A posted song as the sea / island show it (a record with an emoji until songs get covers). */
const RECORD_EMOJI = ['🎵', '🎶', '🎤', '🎸', '🎹', '🥁', '🎧', '🎺'];
const hash = (t: string) => [...t].reduce((n, c) => n + c.charCodeAt(0), 0);
const songOf = (p: PlanetPostView): Song => ({
  id: p.id,
  title: p.title || '無題',
  artist: p.author.displayName || p.author.handle,
  emoji: RECORD_EMOJI[hash(p.id) % RECORD_EMOJI.length],
  hue: hash(p.author.id) % 360,
  seconds: Math.max(1, Math.round(p.seconds ?? 180)),
  preset: P(96, 60, 'major', [0, 4, 5, 3], 'triangle'),
  audioUrl: p.url,
  hoursAgo: Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 3600_000),
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

  // live sea (painted by the Art workshop): you first, then the real ships, then samples on みんな
  type Rider = { key: string; name: string; title: string; sub?: string; img?: string | null; emoji: string; mine?: boolean; onTap: () => void };
  const riders: Rider[] = live
    ? [
        ...(mySailing.length
          ? [
              {
                key: 'me',
                name: myHandle,
                title: mySailing[0].song.title,
                sub: hoursSince(mySailing[0].at) ? `${hoursSince(mySailing[0].at)}時間前` : 'たった今',
                img: me?.puniPic ?? me?.avatarUrl,
                emoji: neo?.emoji ?? '🦊',
                mine: true,
                onTap: () => play(`@${myHandle} の船`, mySailing.map((r) => r.song)),
              },
            ]
          : []),
        ...realOthers.map((f) => {
          const songs = f.posts.map(songOf);
          const name = f.author.displayName || f.author.handle;
          return { key: f.author.id, name, title: songs[0]?.title ?? '', img: f.author.pic, emoji: neoForm(f.author.neoForm)?.emoji ?? '⛵', onTap: () => play(`@${name} の船`, songs, 0, { userId: f.author.id, name }) };
        }),
        ...SAILORS.filter(visible).map((s) => ({ key: s.id, name: s.handle, title: s.sailing[0]?.title ?? '', img: spriteUrl(s.avatar), emoji: '⛵', onTap: () => play(`@${s.handle} の船`, s.sailing) })),
      ].slice(0, SEA_SLOTS.length)
    : [];

  const say = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 1800);
  };
  const go = (next: View) => {
    if (next.v !== 'play') synth.stop();
    setView(next);
    if (next.v === 'island' && next.who === 'me') ev.current?.onIsland?.();
  };
  const play = (title: string, songs: Song[], start = 0, owner?: Who) => go({ v: 'play', title, songs, start, back: view.v === 'play' ? view.back : view, owner });

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#06123a] text-white">
      {view.v === 'sea' && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="px-4 pt-[calc(10px+env(safe-area-inset-top))]">
            <Tabs tab={tab} setTab={setTab} />
            <p className="mx-auto mt-2 w-fit rounded-full border border-amber-300/50 bg-black/30 px-4 py-1 text-sm text-amber-100">👥 今 {sailingCount}人が航海中</p>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-2">
            {live ? (
              <ArtStage name="mercury-sea" reserve={230} focus={62}>
                {riders.map((r, i) => {
                  const at = SEA_SLOTS[i];
                  return (
                    <button
                      key={r.key}
                      onClick={() => {
                        r.onTap();
                        ev.current?.onShip?.();
                      }}
                      className="absolute flex flex-col items-center"
                      style={{ left: `${at.x}%`, top: `${at.y}%`, width: `${at.w}%`, transform: 'translate(-50%, -100%)', zIndex: Math.round(at.y) }}
                      aria-label={`@${r.name}の船`}
                    >
                      <span className="flex w-full flex-col items-center" style={{ animation: `sail ${4 + (i % 3)}s ease-in-out ${i * 0.5}s infinite` }}>
                        <span className="mb-[3%] max-w-[140%] truncate rounded-xl border border-amber-300/70 bg-[#0d1838]/85 px-2 py-1 text-left text-[clamp(8px,1.4vw,13px)] leading-tight shadow-lg backdrop-blur-sm">
                          {r.mine ? '新曲を出航！' : `@${r.name}`}「{r.title}」
                          {r.sub && <span className="block text-white/60">{r.sub}</span>}
                        </span>
                        <Vessel kind="ship" img={r.img} emoji={r.emoji} />
                      </span>
                    </button>
                  );
                })}
              </ArtStage>
            ) : (
              <div className="relative w-full max-w-[min(100%,calc((100svh-230px)*1.293))]" style={{ aspectRatio: '1254 / 970' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={stillUrl('mercury-sea')} alt="" className="absolute inset-0 h-full w-full select-none rounded-xl" draggable={false} />
                {SAILORS.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      play(`@${s.handle} の船`, s.sailing);
                      ev.current?.onShip?.();
                    }}
                    className="absolute transition-opacity duration-500"
                    style={{
                      left: `${s.box.left}%`,
                      top: `${s.box.top}%`,
                      width: `${s.box.width}%`,
                      height: `${s.box.height}%`,
                      opacity: visible(s) ? 1 : 0,
                      pointerEvents: visible(s) ? 'auto' : 'none',
                      animation: `sail ${4 + (i % 3)}s ease-in-out ${i * 0.5}s infinite`,
                    }}
                    aria-label={`@${s.handle}の船：${s.bubble}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={spriteUrl(s.ship)} alt="" className="h-full w-full" draggable={false} />
                  </button>
                ))}
                {/* the sea art draws every ship; hidden ones are covered with calm water */}
                {SAILORS.filter((s) => !visible(s)).map((s) => (
                  <div
                    key={`cover-${s.id}`}
                    className="pointer-events-none absolute rounded-[30%] bg-[#0b3a8c]/80 blur-md"
                    style={{ left: `${s.box.left + 2}%`, top: `${s.box.top + 2}%`, width: `${s.box.width - 4}%`, height: `${s.box.height - 4}%` }}
                  />
                ))}
                {/* real ships (live) over the slots of the sample ones */}
                {realOthers.map((f, i) => {
                  const b = SAILORS[i].box;
                  const songs = f.posts.map(songOf);
                  const name = f.author.displayName || f.author.handle;
                  return (
                    <div key={f.author.id}>
                      <div className="pointer-events-none absolute rounded-[30%] bg-[#0b3a8c]/80 blur-md" style={{ left: `${b.left + 2}%`, top: `${b.top + 2}%`, width: `${b.width - 4}%`, height: `${b.height - 4}%` }} />
                      <button
                        onClick={() => {
                          play(`@${name} の船`, songs, 0, { userId: f.author.id, name });
                          ev.current?.onShip?.();
                        }}
                        className="absolute flex flex-col items-center"
                        style={{ left: `${b.left}%`, top: `${b.top}%`, width: `${Math.min(b.width, 24)}%`, animation: `sail ${4 + (i % 3)}s ease-in-out ${i * 0.5}s infinite` }}
                        aria-label={`@${name}の船`}
                      >
                        <span className="mb-1 max-w-full truncate rounded-xl border border-amber-300/70 bg-[#0d1838]/90 px-2 py-1 text-left text-[clamp(8px,1.4vw,13px)] leading-tight">
                          @{name}「{songs[0]?.title}」
                        </span>
                        <OwnShip emoji={neoForm(f.author.neoForm)?.emoji ?? '⛵'} img={f.author.pic} />
                      </button>
                    </div>
                  );
                })}
                {mySailing.length > 0 && (
                  <button
                    onClick={() => {
                      play(`@${myHandle} の船`, mySailing.map((r) => r.song));
                      ev.current?.onShip?.();
                    }}
                    className="absolute flex flex-col items-center"
                    style={{ left: '74%', top: '74%', width: '24%', animation: 'sail 5s ease-in-out infinite' }}
                    aria-label="自分の船"
                  >
                    <span className="mb-1 rounded-xl border border-amber-300/70 bg-[#0d1838]/90 px-2 py-1 text-left text-[clamp(8px,1.4vw,13px)] leading-tight">
                      新曲を出航！「{mySailing[0].song.title}」
                      <br />
                      <span className="text-white/60">{hoursSince(mySailing[0].at) || 'たった今'}{hoursSince(mySailing[0].at) ? '時間前' : ''}</span>
                    </span>
                    <OwnShip emoji={neo?.emoji ?? '🦊'} img={me?.puniPic ?? me?.avatarUrl} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {view.v === 'island' && live && (view.who === 'me' || 'userId' in (view.who as object)) && (
        <LiveIsland
          who={view.who as 'me' | { userId: string; name: string }}
          myId={me?.id}
          myName={myHandle}
          refreshKey={skyKey}
          onPlay={(title, songs, i) => play(title, songs, i)}
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
          chests={view.who === 'me' ? mine.chests : (view.who as Sailor).chests}
          soil={view.who === 'me' ? mine.soil : []}
          onPlay={(songs, i) => play(view.who === 'me' ? '自分の島' : `@${(view.who as Sailor).handle} の島`, songs, i)}
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
        <Player
          key={`${view.title}-${view.start}-${view.songs[0]?.id}`}
          title={view.title}
          songs={view.songs}
          start={view.start}
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
          owner={view.owner && view.owner !== 'me' && typeof view.owner === 'object' && 'userId' in view.owner ? view.owner.name : undefined}
          onOwner={view.owner && typeof view.owner === 'object' && 'userId' in view.owner ? () => go({ v: 'island', who: view.owner! }) : undefined}
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
          <span className="text-2xl">🏝️</span>島
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
  { x: 50, y: 97, w: 27 },
  { x: 17, y: 93, w: 26 },
  { x: 83, y: 94, w: 26 },
  { x: 31, y: 76, w: 22 },
  { x: 69, y: 77, w: 22 },
  { x: 14, y: 61, w: 18 },
  { x: 50, y: 59, w: 18 },
  { x: 86, y: 62, w: 18 },
];

/** The visitor's ship (no art yet): a little boat with their OBOLO NEO on deck. */
function OwnShip({ emoji, img }: { emoji: string; img?: string | null }) {
  return (
    <div className="relative w-full">
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="absolute left-1/2 top-0 aspect-square w-[34%] -translate-x-1/2 rounded-full border-2 border-white/80 object-cover" />
      ) : (
        <span className="absolute left-1/2 top-[8%] -translate-x-1/2 text-[clamp(18px,3.5vw,34px)]">{emoji}</span>
      )}
      <svg viewBox="0 0 120 70" className="w-full drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]" aria-hidden>
        <path d="M60 4 L60 40" stroke="#e9d3a0" strokeWidth="3" />
        <path d="M62 8 L92 34 L62 34 Z" fill="#f4e6c0" opacity="0.9" />
        <path d="M6 40 L114 40 L98 62 Q60 70 22 62 Z" fill="#2b2a44" stroke="#d4a93c" strokeWidth="3" />
        {[30, 50, 70, 90].map((x) => (
          <circle key={x} cx={x} cy="51" r="5" fill="#0c1022" stroke="#7fd4ff" strokeWidth="2" />
        ))}
      </svg>
    </div>
  );
}

/** A record (round art) for a song. */
function Record({ song, spinning, className = '' }: { song: Song; spinning?: boolean; className?: string }) {
  return (
    <div className={`relative aspect-square overflow-hidden rounded-full border-[5px] border-black/80 shadow-[0_16px_40px_rgba(0,0,0,0.55)] ${className}`}>
      <div className={`absolute inset-0 ${spinning ? 'animate-[spin-slow_14s_linear_infinite]' : ''}`}>
        {song.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={spriteUrl(song.cover)} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <Artwork hue={song.hue ?? 220} emoji={song.emoji ?? '🎵'} className="h-full w-full" />
        )}
        <span className="absolute left-1/2 top-1/2 h-[7%] w-[7%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-300/80 bg-black" />
      </div>
    </div>
  );
}

function IslandView({
  title,
  isMe,
  records,
  sailing,
  chests,
  soil,
  onPlay,
  onSoil,
  onRelease,
  say,
}: {
  title: string;
  isMe: boolean;
  records: Song[];
  sailing: Song[];
  chests: [number, number, number];
  soil: Song[];
  onPlay: (songs: Song[], i: number) => void;
  onSoil: () => void;
  onRelease: (id: string) => void;
  say: (t: string) => void;
}) {
  const [dig, setDig] = useState(false);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-6">
      <div className="relative mx-auto max-w-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={stillUrl('mercury-island')} alt="" className="w-full select-none" draggable={false} />
        <div className="absolute inset-x-3 top-[calc(8px+env(safe-area-inset-top))] flex items-center justify-between">
          <span className="rounded-full border border-cyan-200/40 bg-[#0a1430]/85 px-4 py-1.5 text-sm font-black tracking-wider">♫ {title.toUpperCase()} ISLAND</span>
          <button onClick={() => say('島を飾るのは準備中です')} className="rounded-full border border-amber-300/60 bg-[#0a1430]/85 px-4 py-1.5 text-sm text-amber-100">
            🏝 島を飾る
          </button>
        </div>
        {isMe && (
          // the soil: demos are buried here
          <button
            onClick={() => {
              setDig(true);
              onSoil();
            }}
            className="absolute left-1/2 top-[80%] -translate-x-1/2 rounded-full border border-amber-200/60 bg-[#3a2410]/90 px-4 py-1.5 text-sm shadow-lg"
          >
            ⛏ 土の中の曲
          </button>
        )}
      </div>

      <div className="mx-auto max-w-2xl px-4">
        {/* no counts on anyone's island (client rule 2026-10-07) */}
        {sailing.length > 0 && (
          <button onClick={() => onPlay(sailing, 0)} className="mx-auto mt-1 block rounded-full border border-cyan-200/30 bg-[#0a1430]/80 px-4 py-1.5 text-xs text-cyan-200/90">
            🚢 いま航海中の曲を聴く（88時間後に島に戻ってきます）
          </button>
        )}

        <h3 className="mb-2 mt-4 text-xs tracking-widest text-white/60">島に飾られたレコード</h3>
        {records.length ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {records.map((r, i) => (
              <button key={r.id} onClick={() => onPlay(records, i)} className="w-24 shrink-0 text-center">
                <Record song={r} />
                <p className="mt-1 truncate text-[11px] text-white/80">{r.title}</p>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-white/45">{isMe ? '出航した曲は、88時間の航海を終えると、ここに飾られます。' : 'まだレコードはありません'}</p>
        )}

        <div className="mt-5 grid grid-cols-3 gap-3">
          {chests.map((c, i) => (
            <button key={i} onClick={() => say(`★${i + 1}の宝箱：星${i + 1}をつけた曲が入っています`)} className="flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={spriteUrl(`chest-${i + 1}`)} alt="" className="w-full max-w-[150px]" />
              <span className="-mt-2 rounded-xl border border-amber-300/50 bg-[#0a1430]/90 px-3 py-1 text-center text-xs">
                ★{i + 1}の宝箱
                <br />
                <b className="text-base">{c}</b> 枚
              </span>
            </button>
          ))}
        </div>
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

function Player({
  title,
  songs,
  start,
  stars,
  onStar,
  onSwipe,
  owner,
  onOwner,
}: {
  title: string;
  songs: Song[];
  start: number;
  stars: Record<string, number>;
  onStar: (id: string, tier: 0 | 1 | 2 | 3) => void;
  onSwipe: () => void;
  owner?: string;
  onOwner?: () => void;
}) {
  const [i, setI] = useState(start);
  const [t, setT] = useState(0);
  const at = (k: number) => songs[((k % songs.length) + songs.length) % songs.length];
  const song = at(i);
  const drag = useRef<{ x: number; dx: number } | null>(null);
  const [dx, setDx] = useState(0);

  useEffect(() => {
    if (song.audioUrl) {
      synth.stop();
      void toggleAudio(song.audioUrl).catch(() => undefined);
    } else synth.play(song.preset);
    setT(0);
    const id = setInterval(() => setT((v) => (v + 1 >= song.seconds ? 0 : v + 1)), 1000);
    return () => {
      clearInterval(id);
      if (song.audioUrl) stopAudio();
    };
  }, [song]);

  const go = (d: number) => {
    setI((v) => v + d);
    onSwipe();
  };
  const many = songs.length > 1;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="pointer-events-none absolute inset-0 opacity-40 blur-2xl">
        {song.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={spriteUrl(song.cover)} alt="" className="h-full w-full object-cover" />
        ) : (
          <Artwork hue={song.hue ?? 220} emoji="" className="h-full w-full" />
        )}
      </div>
      <div className="relative px-4 pt-[calc(12px+env(safe-area-inset-top))] text-center">
        <p className="text-sm tracking-[0.2em] text-white/75">⚓ {title}</p>
        <p className="text-[11px] text-white/45">88時間以内の曲</p>
        {onOwner && (
          <button onClick={onOwner} className="mx-auto mt-1 block rounded-full border border-white/20 bg-black/30 px-3 py-1 text-xs text-white/85">
            🏝 @{owner} の島へ ›
          </button>
        )}
      </div>

      <div
        className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center overflow-hidden"
        onPointerDown={(e) => (drag.current = { x: e.clientX, dx: 0 })}
        onPointerMove={(e) => {
          if (!drag.current) return;
          drag.current.dx = e.clientX - drag.current.x;
          setDx(drag.current.dx);
        }}
        onPointerUp={() => {
          const d = drag.current?.dx ?? 0;
          drag.current = null;
          setDx(0);
          if (Math.abs(d) > 50) go(d < 0 ? 1 : -1);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDx(0);
        }}
      >
        {many && (
          <button onClick={() => go(-1)} className="absolute left-0 top-1/2 w-[22%] -translate-x-[55%] -translate-y-1/2 opacity-70" aria-label="前の曲">
            <Record song={at(i - 1)} />
          </button>
        )}
        <div className="w-[min(64%,calc(100svh-420px))]" style={{ transform: `translateX(${dx}px) rotate(${dx / 20}deg)` }}>
          <Record song={song} spinning />
        </div>
        {many && (
          <button onClick={() => go(1)} className="absolute right-0 top-1/2 w-[22%] -translate-y-1/2 translate-x-[55%] opacity-70" aria-label="次の曲">
            <Record song={at(i + 1)} />
          </button>
        )}
      </div>

      <div className="relative px-6 pb-3 text-center">
        <p className="text-2xl font-black tracking-wide drop-shadow">{song.title}</p>
        <p className="text-sm font-bold text-cyan-300">{song.artist}</p>
        <div className="mx-auto mt-2 flex max-w-md items-center gap-3 text-xs text-white/70">
          <span className="w-9 text-left">{fmt(t)}</span>
          <div className="relative h-1.5 flex-1 rounded-full bg-white/15">
            <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-amber-400" style={{ width: `${(t / song.seconds) * 100}%` }} />
          </div>
          <span className="w-9 text-right">{fmt(song.seconds)}</span>
        </div>
        <div className="mt-3 flex justify-center gap-4">
          {([1, 2, 3] as const).map((n) => {
            const on = (stars[song.id] ?? 0) >= n;
            return (
              <button
                key={n}
                onClick={() => onStar(song.id, stars[song.id] === n ? ((n - 1) as 0 | 1 | 2) : n)}
                className={`flex h-12 w-12 items-center justify-center rounded-full border text-xl ${on ? 'border-amber-300 text-amber-300 shadow-[0_0_16px_rgba(255,200,80,0.6)]' : 'border-white/40 text-white/70'}`}
                aria-label={`星${n}`}
              >
                {on ? '★' : '☆'}
              </button>
            );
          })}
        </div>
        {many && <p className="mt-1 text-[10px] text-white/40">← スワイプで次の曲 →</p>}
      </div>
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
  onPlay: (title: string, songs: Song[], i: number) => void;
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
        chests={[0, 0, 0]}
        soil={soil}
        onPlay={(songs, i) => onPlay(isMe ? '自分の島' : `@${name} の島`, songs, i)}
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
      {!isMe && id && (
        <button
          onClick={() => {
            const on = !following;
            setFollowing(on);
            getApi()
              .followSaturnUser(id, on)
              .catch(() => undefined);
          }}
          className={`absolute right-3 top-[calc(52px+env(safe-area-inset-top))] rounded-full px-4 py-1.5 text-sm ${following ? 'border border-white/30 bg-[#0a1430]/85' : 'bg-violet-600'}`}
        >
          {following ? 'フォロー中' : 'フォロー'}
        </button>
      )}
    </div>
  );
}
