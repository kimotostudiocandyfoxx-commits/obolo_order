'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Artwork } from '@/components/Artwork';
import { PlanetShell } from '@/components/PlanetShell';
import { useToast } from '@/components/Toast';
import { useI18n } from '@/lib/i18n/client';
import { compact, TRACKS, tr, type SampleTrack } from '@/lib/samples';
import { synth } from '@/lib/synth';
import { useLocalState } from '@/lib/useLocalState';

/**
 * Mercury (spec §2.5, v1.6): TikTok-style DISCOVERY FEED — one square track card at a time,
 * swipe for the next, music keeps flowing. Stars are 3-tiered and auto-file the track into the
 * listener's "Star 1/2/3" playlists; re-rating moves it between playlists.
 * VISUAL DEMO: sample tracks, generated audio, ratings stored on this device (P-DEMO-1).
 */
type Tier = 1 | 2 | 3;
type Ratings = Record<string, Tier>;

export function MercuryView() {
  const { m } = useI18n();
  const [tab, setTab] = useState<'discover' | 'playlists'>('discover');
  const [ratings, setRatings] = useLocalState<Ratings>('obolo.mercury.stars', {});
  const [extraLoops, setExtraLoops] = useLocalState<Record<string, number>>('obolo.mercury.loops', {});
  const [jumpTo, setJumpTo] = useState<string | null>(null);
  const toast = useToast();

  const rate = useCallback(
    (id: string, tier: Tier) => {
      const removing = ratings[id] === tier;
      setRatings((cur) => {
        const next = { ...cur };
        if (removing) delete next[id];
        else next[id] = tier;
        return next;
      });
      toast.show(removing ? m.mercury.unrated : `★${tier} ${m.mercury.rated.replace('{playlist}', `Star ${tier}`)}`);
    },
    [ratings, setRatings, toast, m],
  );

  useEffect(() => () => synth.stop(), []);

  return (
    <PlanetShell id="mercury" bare>
      <div className="mx-auto flex h-12 max-w-xl items-center gap-1 px-3">
        {(['discover', 'playlists'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold transition ${tab === k ? 'bg-white text-slate-900' : 'text-white/60'}`}
          >
            {k === 'discover' ? `🔭 ${m.mercury.discover}` : `★ ${m.mercury.playlists}`}
          </button>
        ))}
        <button className="ml-auto whitespace-nowrap rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white/70" onClick={() => toast.show(m.mercury.createSoon)}>
          ＋ {m.mercury.create}
        </button>
      </div>
      {tab === 'discover' ? (
        <DiscoverFeed
          ratings={ratings}
          onRate={rate}
          extraLoops={extraLoops}
          onLoop={(id) => setExtraLoops((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }))}
          jumpTo={jumpTo}
          onJumped={() => setJumpTo(null)}
        />
      ) : (
        <Playlists
          ratings={ratings}
          onRate={rate}
          onOpen={(id) => {
            setJumpTo(id);
            setTab('discover');
          }}
        />
      )}
      {toast.node}
    </PlanetShell>
  );
}

function DiscoverFeed({
  ratings,
  onRate,
  extraLoops,
  onLoop,
  jumpTo,
  onJumped,
}: {
  ratings: Ratings;
  onRate: (id: string, t: Tier) => void;
  extraLoops: Record<string, number>;
  onLoop: (id: string) => void;
  jumpTo: string | null;
  onJumped: () => void;
}) {
  const { m } = useI18n();
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const onLoopRef = useRef(onLoop);
  onLoopRef.current = onLoop;

  // Which card is on screen?
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll('[data-index]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!jumpTo || !scroller.current) return;
    const i = TRACKS.findIndex((t) => t.id === jumpTo);
    scroller.current.querySelector<HTMLElement>(`[data-index="${i}"]`)?.scrollIntoView();
    onJumped();
  }, [jumpTo, onJumped]);

  // Auto-play the visible track — "music keeps flowing".
  useEffect(() => {
    if (!started || paused) return;
    const t = TRACKS[active];
    onLoopRef.current(t.id); // a play counts as one Loop
    synth.play(t, () => onLoopRef.current(t.id));
    return () => synth.stop();
  }, [active, started, paused]);

  return (
    <div className="relative">
      <div
        ref={scroller}
        className="no-scrollbar h-[calc(100svh-56px-48px-32px-env(safe-area-inset-top))] snap-y snap-mandatory overflow-y-scroll overscroll-contain"
      >
        {TRACKS.map((t, i) => (
          <TrackSlide
            key={t.id}
            track={t}
            index={i}
            active={i === active}
            playing={started && !paused && i === active}
            tier={ratings[t.id]}
            loops={t.loops + (extraLoops[t.id] ?? 0)}
            onRate={(tier) => onRate(t.id, tier)}
            onTogglePlay={() => setPaused((p) => !p)}
          />
        ))}
      </div>
      {!started && (
        <button
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/55 backdrop-blur-sm"
          onClick={() => {
            synth.unlock();
            setStarted(true);
          }}
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-3xl text-slate-900 shadow-2xl">▶</span>
          <span className="font-bold">{m.mercury.tapToStart}</span>
          <span className="text-xs text-white/60">{m.mercury.starHelp}</span>
        </button>
      )}
    </div>
  );
}

function TrackSlide({
  track,
  index,
  active,
  playing,
  tier,
  loops,
  onRate,
  onTogglePlay,
}: {
  track: SampleTrack;
  index: number;
  active: boolean;
  playing: boolean;
  tier?: Tier;
  loops: number;
  onRate: (t: Tier) => void;
  onTogglePlay: () => void;
}) {
  const { m, locale } = useI18n();
  const totalStars = track.stars[0] + track.stars[1] + track.stars[2] + (tier ? 1 : 0);
  return (
    <section data-index={index} className="flex h-full snap-start snap-always flex-col items-center justify-center px-6">
      <button
        onClick={onTogglePlay}
        className="relative overflow-hidden rounded-3xl shadow-2xl shadow-black/50"
        style={{ width: 'min(100vw - 48px, 100svh - 360px, 440px)' }}
      >
        <Artwork hue={track.hue} emoji={track.emoji} animated={playing}>
          <div className="absolute left-3 top-3 flex gap-1.5">
            {track.label && <span className="chip bg-black/60 text-white">● {m.mercury.labelBadge}</span>}
            {track.ai && <span className="chip bg-white/80 text-slate-900">{m.mercury.aiBadge}</span>}
          </div>
          <div className="absolute bottom-3 right-3 flex h-6 items-end gap-[3px]">
            {[0, 1, 2, 3].map((b) => (
              <span
                key={b}
                className="w-1 rounded-full bg-white/90"
                style={{
                  height: playing ? undefined : '25%',
                  animation: playing ? `eq 0.${6 + b}s ease-in-out ${b * 0.1}s infinite alternate` : undefined,
                }}
              />
            ))}
          </div>
          {active && !playing && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-5xl text-white/90">▶</span>
          )}
        </Artwork>
      </button>

      <div className="mt-5 w-full max-w-[440px]">
        <h2 className="truncate text-xl font-black">{tr(track.title, locale)}</h2>
        <p className="truncate text-sm text-white/60">
          {track.artist} · {tr(track.tags, locale)} · {track.bpm} BPM
        </p>
        <p className="mt-1 text-xs text-white/45">
          🔁 {compact(loops, locale)} {m.common.loops} · ★ {compact(totalStars, locale)} {m.common.stars}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {([1, 2, 3] as const).map((t) => {
            const on = tier === t;
            return (
              <button
                key={t}
                onClick={() => onRate(t)}
                aria-pressed={on}
                className={`flex flex-col items-center rounded-2xl border py-2 transition active:scale-95 ${
                  on ? 'border-amber-200 bg-amber-200 text-amber-950' : 'border-white/10 bg-white/5 text-white/80'
                }`}
              >
                <span className="text-lg leading-none tracking-tighter">{'★'.repeat(t)}</span>
                <span className="mt-1 text-[11px] font-bold">{m.mercury[`star${t}` as const]}</span>
              </button>
            );
          })}
        </div>
        {index === 0 && <p className="mt-4 animate-bounce text-center text-xs text-white/50">↑ {m.mercury.swipeHint}</p>}
      </div>
    </section>
  );
}

function Playlists({ ratings, onRate, onOpen }: { ratings: Ratings; onRate: (id: string, t: Tier) => void; onOpen: (id: string) => void }) {
  const { m, locale } = useI18n();
  return (
    <main className="mx-auto max-w-xl space-y-5 px-4 pb-24 pt-2">
      <p className="text-xs text-white/50">{m.mercury.starHelp}</p>
      {([3, 2, 1] as const).map((tier) => {
        const list = TRACKS.filter((t) => ratings[t.id] === tier);
        return (
          <section key={tier} className="card overflow-hidden">
            <header className="flex items-center gap-3 bg-gradient-to-r from-amber-200/20 to-transparent px-4 py-3">
              <span className="text-lg text-amber-200">{'★'.repeat(tier)}</span>
              <span className="font-black">Star {tier}</span>
              <span className="ml-auto text-xs text-white/50">{list.length}</span>
            </header>
            {list.length === 0 ? (
              <p className="px-4 py-4 text-sm text-white/40">{m.mercury.emptyPlaylist}</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {list.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                    <button className="w-12 shrink-0 overflow-hidden rounded-lg" onClick={() => onOpen(t.id)}>
                      <Artwork hue={t.hue} emoji={t.emoji} />
                    </button>
                    <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(t.id)}>
                      <div className="truncate text-sm font-bold">{tr(t.title, locale)}</div>
                      <div className="truncate text-xs text-white/50">{t.artist}</div>
                    </button>
                    <div className="flex gap-1">
                      {([1, 2, 3] as const).map((x) => (
                        <button
                          key={x}
                          onClick={() => onRate(t.id, x)}
                          className={`rounded-full px-2 py-1 text-[10px] font-bold ${x === tier ? 'bg-amber-200 text-amber-950' : 'bg-white/10 text-white/60'}`}
                        >
                          ★{x}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </main>
  );
}
