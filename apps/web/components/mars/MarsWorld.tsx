'use client';

import { neoForm } from '@obolo/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { CREATORS, fmtLen, KIND_COLOR, POD_BOX, STUDIO, THEMES, type Creator, type Theme, type Video } from '@/lib/mars/sky';
import { flying, hoursSince, useMars } from '@/lib/mars/state';
import { spriteUrl, stillUrl } from '@/lib/onboarding/media';
import { synth } from '@/lib/synth';
import { Frame } from './Frame';
import { ShootChat } from './ShootChat';

/**
 * Mars — the planet of video (client design 2026-10-05, docs/mars.md).
 *  星図 (timeline): friends' videos of the last 88 hours arrive as UFOs with their cards. Tap one to
 *     watch. 全部 / フォロー / ダチ, 「今 N人がライブ中」.
 *  スタジオ (profile): every user has a studio; released videos land there after 88 hours. Your own
 *     studio has a locker of unreleased videos; 公開 sends one off as a UFO.
 *  撮影: talk to KIMORIN (Bati once you have one) and they make a video (placeholder chat).
 *  Two looks — 郊外 (canyon) / 街中 (city) — chosen with 「スタジオを飾る」.
 * VISUAL DEMO (P-MARS-2).
 */
export interface MarsEvents {
  onUfo?: () => void;
  onStudio?: () => void;
  onLocker?: () => void;
  onRelease?: () => void;
}

type View = { v: 'sky' } | { v: 'shoot' } | { v: 'studio'; who: 'me' | Creator } | { v: 'play'; videos: Video[]; start: number; owner: string; creator?: Creator; back: View };

export function MarsWorld({ events, overlay }: { events?: MarsEvents; overlay?: ReactNode }) {
  const { me } = useAuth();
  const mine = useMars();
  const [view, setView] = useState<View>({ v: 'sky' });
  const [tab, setTab] = useState<'all' | 'follow' | 'friend'>('friend');
  const [toast, setToast] = useState<string | null>(null);
  const ev = useRef(events);
  ev.current = events;
  useEffect(() => () => synth.stop(), []);

  const theme = mine.theme;
  const myHandle = me?.displayName || 'neo';
  const neo = neoForm(me?.neoForm);
  const myFlying = mine.released.filter((r) => flying(r.at));
  const myWorks = mine.released.filter((r) => !flying(r.at)).map((r) => r.video);
  const visible = (c: Creator) => tab === 'all' || (tab === 'follow' ? c.follow : c.friend);
  const liveCount = CREATORS.filter((c) => visible(c) && c.live).length;

  const say = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 1800);
  };
  const go = (next: View) => {
    if (next.v !== 'play') synth.stop();
    setView(next);
    if (next.v === 'studio' && next.who === 'me') ev.current?.onStudio?.();
  };
  const play = (videos: Video[], owner: string, creator?: Creator, start = 0) =>
    go({ v: 'play', videos, start, owner, creator, back: view.v === 'play' ? view.back : view });

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#140707] text-white">
      {view.v === 'sky' && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 px-3 pt-[calc(10px+env(safe-area-inset-top))]">
            <div className="flex flex-1 rounded-full border border-white/15 bg-black/40 p-1">
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
            <span className="shrink-0 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs">
              <span className="text-red-500">●</span> 今 {liveCount}人がライブ中
            </span>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-2">
            <div className="relative w-full max-w-[min(100%,calc((100svh-210px)*1.2))]" style={{ aspectRatio: '1254 / 1045' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={stillUrl(`mars-sky-${theme}`)} alt="" className="absolute inset-0 h-full w-full select-none rounded-xl" draggable={false} />
              {/* hide the top of the mock's round 撮影 button at the bottom edge of the art */}
              <div className="pointer-events-none absolute bottom-0 left-1/2 h-[9%] w-[18%] -translate-x-1/2 rounded-t-full bg-black/85 blur-md" />
              {CREATORS.map((c, i) => {
                const b = POD_BOX[theme][c.id];
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      play(c.flying, c.handle, c);
                      ev.current?.onUfo?.();
                    }}
                    className="absolute transition-opacity duration-500"
                    style={{
                      left: `${b.left}%`,
                      top: `${b.top}%`,
                      width: `${b.width}%`,
                      height: `${b.height}%`,
                      opacity: visible(c) ? 1 : 0,
                      pointerEvents: visible(c) ? 'auto' : 'none',
                      animation: `ufo ${3 + (i % 3) * 0.7}s ease-in-out ${i * 0.4}s infinite`,
                    }}
                    aria-label={`${c.handle}の映像：${c.flying[0]?.title}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={spriteUrl(`pod-${theme}-${c.id}`)} alt="" className="h-full w-full" draggable={false} />
                  </button>
                );
              })}
              {CREATORS.filter((c) => !visible(c)).map((c) => {
                const b = POD_BOX[theme][c.id];
                return (
                  <div
                    key={`cover-${c.id}`}
                    className={`pointer-events-none absolute rounded-[30%] blur-md ${theme === 'canyon' ? 'bg-[#7a3418]/85' : 'bg-[#2a1018]/85'}`}
                    style={{ left: `${b.left + 2}%`, top: `${b.top + 2}%`, width: `${b.width - 4}%`, height: `${b.height - 4}%` }}
                  />
                );
              })}
              {myFlying.length > 0 && (
                <button
                  onClick={() => {
                    play(myFlying.map((r) => r.video), myHandle);
                    ev.current?.onUfo?.();
                  }}
                  className="absolute flex flex-col items-center"
                  style={{ left: theme === 'canyon' ? '81%' : '2%', top: theme === 'canyon' ? '33%' : '3%', width: '18%', animation: 'ufo 3.4s ease-in-out infinite' }}
                  aria-label="自分のUFO"
                >
                  <span className="mb-1 w-full rounded-lg border border-amber-300/70 bg-black/75 px-1.5 py-1 text-left text-[clamp(7px,1.3vw,12px)] leading-tight">
                    {myFlying[0].video.title}
                    <br />
                    <span className="text-white/60">{hoursSince(myFlying[0].at) ? `${hoursSince(myFlying[0].at)}時間前` : 'たった今'}</span>
                  </span>
                  <OwnUfo emoji={neo?.emoji ?? '🦊'} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {view.v === 'shoot' && <ShootChat onKeep={(v) => mine.keep(v)} onOpenStudio={() => go({ v: 'studio', who: 'me' })} onPreview={(v) => play([v], myHandle)} />}

      {view.v === 'studio' && (
        <StudioView
          theme={theme}
          title={view.who === 'me' ? myHandle : view.who.handle}
          isMe={view.who === 'me'}
          followers={view.who === 'me' ? '0' : view.who.followers}
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
        <Player
          key={`${view.owner}-${view.videos[0]?.id}-${view.start}`}
          videos={view.videos}
          start={view.start}
          owner={view.owner}
          onStudio={view.creator ? () => go({ v: 'studio', who: view.creator! }) : undefined}
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
        <button onClick={() => go({ v: 'studio', who: 'me' })} className={`flex flex-col items-center text-xs ${view.v === 'studio' ? 'text-amber-200' : 'text-white/60'}`}>
          <span className="text-2xl">🎬</span>スタジオ
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

/** The visitor's UFO (no art yet): their OBOLO NEO in a little saucer. */
function OwnUfo({ emoji }: { emoji: string }) {
  return (
    <div className="relative w-full">
      <span className="absolute left-1/2 top-[2%] -translate-x-1/2 text-[clamp(16px,3.2vw,32px)]">{emoji}</span>
      <svg viewBox="0 0 120 64" className="w-full drop-shadow-[0_6px_10px_rgba(0,0,0,0.6)]" aria-hidden>
        <ellipse cx="60" cy="30" rx="28" ry="18" fill="#9fd6ff" opacity="0.35" />
        <ellipse cx="60" cy="40" rx="56" ry="14" fill="#3b3b4a" stroke="#c9a24a" strokeWidth="3" />
        {[24, 44, 64, 84, 100].map((x) => (
          <circle key={x} cx={x} cy="42" r="4" fill="#ff7be5" />
        ))}
        <ellipse cx="60" cy="58" rx="22" ry="4" fill="#9a7bff" opacity="0.6" />
      </svg>
    </div>
  );
}

function Player({ videos, start, owner, onStudio }: { videos: Video[]; start: number; owner: string; onStudio?: () => void }) {
  const [i, setI] = useState(start);
  const [t, setT] = useState(0);
  const video = videos[((i % videos.length) + videos.length) % videos.length];
  const live = video.kind === 'LIVE';

  useEffect(() => {
    synth.play(video.bgm);
    setT(0);
    const id = setInterval(() => setT((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, [video]);
  // the storyboard: each scene gets an equal share of a short loop
  const scene = video.scenes[Math.floor(t / 4) % video.scenes.length];
  const pos = live ? 1 : (t % Math.min(video.seconds, 60)) / Math.min(video.seconds, 60);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-4 pt-[calc(12px+env(safe-area-inset-top))]">
        <p className="min-w-0 flex-1 truncate text-sm text-white/80">🎬 {owner}</p>
        {onStudio && (
          <button onClick={onStudio} className="rounded-full border border-amber-300/50 px-3 py-1 text-xs text-amber-100">
            スタジオを見る
          </button>
        )}
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-3">
        <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-amber-500/30 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          <Frame video={video} playing className="aspect-video w-full" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10">
            <p key={scene} className="animate-[fadeUp_0.6s_ease-out] text-center text-sm font-bold drop-shadow">{scene}</p>
          </div>
          {live && <span className="absolute left-3 top-3 animate-pulse rounded bg-red-600 px-2 py-0.5 text-xs font-bold">● LIVE</span>}
        </div>
      </div>
      <div className="px-6 pb-3">
        <div className="flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${KIND_COLOR[video.kind]}`}>{video.kind}</span>
          <p className="min-w-0 flex-1 truncate text-lg font-black">{video.title}</p>
        </div>
        <p className="text-xs text-white/55">
          {video.author}
          {video.views ? ` ・ ${video.views}` : ''}
        </p>
        <div className="mt-2 flex items-center gap-3 text-xs text-white/70">
          <span className="w-12">{live ? 'LIVE' : fmtLen(t % Math.min(video.seconds, 60))}</span>
          <div className="relative h-1.5 flex-1 rounded-full bg-white/15">
            <div className={`absolute inset-y-0 left-0 rounded-full ${live ? 'bg-red-500' : 'bg-gradient-to-r from-orange-400 to-fuchsia-500'}`} style={{ width: `${pos * 100}%` }} />
          </div>
          <span className="w-12 text-right">{live ? '' : fmtLen(video.seconds)}</span>
        </div>
        {videos.length > 1 && (
          <div className="mt-2 flex justify-between text-xs">
            <button onClick={() => setI(i - 1)} className="rounded-full border border-white/20 px-3 py-1">
              ← 前の映像
            </button>
            <span className="text-white/50">
              {((i % videos.length) + videos.length) % videos.length + 1} / {videos.length}
            </span>
            <button onClick={() => setI(i + 1)} className="rounded-full border border-white/20 px-3 py-1">
              次の映像 →
            </button>
          </div>
        )}
        <p className="mt-1 text-center text-[10px] text-white/35">（仮の再生：サムネイル＋シーンの字幕＋BGM）</p>
      </div>
    </div>
  );
}

function StudioView({
  theme,
  title,
  isMe,
  followers,
  works,
  flyingCount,
  locker,
  onPlay,
  onTheme,
  onLocker,
  onRelease,
  say,
}: {
  theme: Theme;
  title: string;
  isMe: boolean;
  followers: string;
  works: Video[];
  flyingCount: number;
  locker: Video[];
  onPlay: (videos: Video[], i: number) => void;
  onTheme: (t: Theme) => void;
  onLocker: () => void;
  onRelease: (id: string) => void;
  say: (t: string) => void;
}) {
  const st = STUDIO[theme];
  const [decor, setDecor] = useState(false);
  const [open, setOpen] = useState(false);
  const [following, setFollowing] = useState(false);
  const pct = (r: { left: number; top: number; width: number; height: number }) => ({ left: `${r.left}%`, top: `${r.top}%`, width: `${r.width}%`, height: `${r.height}%` });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-4">
      <div className="relative mx-auto w-full max-w-[min(100%,calc((100svh-150px)*1.1))]" style={{ aspectRatio: st.aspect }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={stillUrl(st.art)} alt="" className="absolute inset-0 h-full w-full select-none" draggable={false} />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-[5%] w-[16%] -translate-x-1/2 rounded-t-full bg-black/85 blur-md" />
        {/* our title + stats over the ones drawn on the art */}
        <div className="absolute flex flex-col items-center justify-center rounded-2xl border border-amber-400/60 bg-[#1c0d08]/95 text-center shadow-[0_0_24px_rgba(255,150,60,0.35)]" style={{ ...pct(st.title), containerType: 'inline-size' }}>
          <p className="truncate px-2 text-[clamp(14px,9cqw,44px)] font-black tracking-wide text-amber-50">{title.toUpperCase()} STUDIO</p>
          <p className="text-[clamp(9px,3.4cqw,15px)] text-white/75">
            フォロワー {followers} ・ 作品 {works.length + flyingCount} ・ {flyingCount ? `とんでいる映像 ${flyingCount}` : '総再生 —'}
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
                🔒 ロッカー {locker.length}
              </button>
              <button onClick={() => setDecor(true)} className="flex-1 rounded-full border border-amber-400/70 bg-[#1c0d08]/95 text-[clamp(8px,1.3vw,13px)] whitespace-nowrap text-amber-200">
                🎨 飾る
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setFollowing(!following)} className={`flex-1 rounded-full text-[clamp(8px,1.3vw,13px)] whitespace-nowrap ${following ? 'border border-white/30 bg-[#1c0d08]/95' : 'bg-violet-600'}`}>
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
                    {w.views && <p className="text-[clamp(7px,5.5cqw,12px)] text-white/55">▶ {w.views}</p>}
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
        <Sheet onClose={() => setOpen(false)} title="🔒 ロッカー（未公開の映像）">
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
            {!locker.length && <p className="text-center text-xs text-white/50">ロッカーは空っぽです（撮影すると、ここにしまわれます）</p>}
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
