'use client';

import type { PlanetPostView, RadioCue, RadioHome, RadioLiveState, RadioLiveView, RadioReportBody, RadioShowView } from '@obolo/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Glyph } from '@/components/bluena/glyphs';
import { useToast } from '@/components/Toast';
import { getApi } from '@/lib/api';
import { Booth } from './Booth';
import { ShowArt } from './ShowArt';

/**
 * Venus — the radio planet (client decision 2026-11-21, docs/工房とブルーナ_設計.md §9–10).
 * The home: shows ON AIR now, then the recorded shows. The booth is the one place on a planet
 * where something is made (radio is made and shown at the same moment).
 * No numbers: no listener counts, no play counts.
 */
export function RadioWorld({ practice }: { practice?: () => void }) {
  const [home, setHome] = useState<RadioHome | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<{ kind: 'show'; show: RadioShowView } | { kind: 'live'; live: RadioLiveView } | null>(null);
  const [booth, setBooth] = useState(false);

  const load = useCallback(() => {
    getApi()
      .radioHome()
      .then((h) => {
        setHome(h);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load]);

  if (booth)
    return (
      <Booth
        onClose={() => {
          setBooth(false);
          load();
        }}
        practice={practice}
      />
    );

  return (
    <div className="mx-auto max-w-xl px-4 pb-[calc(120px+env(safe-area-inset-bottom))] pt-4">
      <div className="flex items-center gap-2 text-amber-100">
        <Glyph id="radio" className="h-6 w-6" />
        <h1 className="text-lg font-black tracking-wide">金星ラジオ</h1>
      </div>

      {error && !home && <p className="mt-8 text-center text-sm text-white/60">電波がとどかない…。少しあとで、もう一度。</p>}
      {!home && !error && <p className="mt-8 text-center text-sm text-white/50">チューニング中…</p>}

      {home && (
        <>
          {home.live.length > 0 && (
            <section className="mt-5">
              <h2 className="mb-2 flex items-center gap-2 text-xs font-bold text-red-300">
                <span className="radio-onair inline-block h-2 w-2 rounded-full bg-red-500" />
                いま放送中
              </h2>
              <div className="flex snap-x gap-3 overflow-x-auto pb-2">
                {home.live.map((l) => (
                  <button key={l.id} onClick={() => setOpen({ kind: 'live', live: l })} className="w-40 shrink-0 snap-start text-left">
                    <ShowArt url={l.thumbUrl} loop={l.loop} onAir />
                    <p className="mt-1.5 line-clamp-2 text-sm font-bold leading-snug">{l.title}</p>
                    <p className="text-xs text-white/55">{l.host.displayName || l.host.handle}</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="mt-5">
            <h2 className="mb-2 text-xs font-bold text-white/60">番組</h2>
            {home.shows.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center text-sm text-white/60">まだ、番組が流れていない。最初の声になろう。</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {home.shows.map((s) => (
                  <button key={s.id} onClick={() => setOpen({ kind: 'show', show: s })} className="text-left">
                    <ShowArt url={s.thumbUrl} loop={s.loop} playing={false} />
                    <p className="mt-1.5 line-clamp-2 text-sm font-bold leading-snug">{s.title}</p>
                    <p className="text-xs text-white/55">
                      {s.host.displayName || s.host.handle}・{minutes(s.seconds)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[color:var(--color-space-950)] via-[color:var(--color-space-950)]/90 to-transparent px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-8">
        <div className="pointer-events-auto mx-auto flex max-w-xl gap-2">
          <button onClick={() => setBooth(true)} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-300 to-fuchsia-400 py-3 text-base font-black text-slate-950 shadow-lg">
            <Glyph id="radio" label={false} className="h-5 w-5" />
            放送ブースへ
          </button>
        </div>
      </div>

      {open?.kind === 'show' && <ShowPlayer show={open.show} onClose={() => setOpen(null)} />}
      {open?.kind === 'live' && <LivePlayer live={open.live} onClose={() => setOpen(null)} />}
    </div>
  );
}

export function minutes(sec: number) {
  const m = Math.max(1, Math.round(sec / 60));
  return `${m}分`;
}

function clock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** the song on air at this moment of a recorded show */
function cueAt(cues: RadioCue[], t: number): RadioCue | null {
  let c: RadioCue | null = null;
  for (const x of cues) if (x.at <= t) c = x;
  return c;
}

function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[92svh] w-full max-w-xl overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[color:var(--color-space-900)] px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex justify-between">
          <button onClick={onClose} className="btn btn-ghost h-9 w-9 !p-0 text-lg" aria-label="とじる">
            ←
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** ⋯ → 〔通報する〕 (and 〔ブロック〕 for the host) — the same safety as the rest of the app */
export function SafetyMenu({ target, id, hostId, onBlocked }: { target: RadioReportBody['target']; id: string; hostId?: string; onBlocked?: () => void }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const toast = useToast();
  const report = async (reason: RadioReportBody['reason']) => {
    try {
      await getApi().reportRadio({ target, id, reason });
      setSent(true);
    } catch {
      toast.show('送れなかった…もう一度');
    }
  };
  const block = async () => {
    if (!hostId) return;
    try {
      await getApi().blockPerson(hostId, true);
      toast.show('ブロックした');
      onBlocked?.();
    } catch {
      toast.show('ブロックは、サーバーにつながってから');
    }
  };
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="btn btn-ghost h-9 w-9 !p-0" aria-label="その他">
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-10 w-56 rounded-2xl border border-white/10 bg-slate-900 p-3 text-sm shadow-2xl">
          {sent ? (
            <p className="text-white/80">とどいた。運営が確かめるね。</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-white/50">通報する</p>
              {(
                [
                  ['mean', 'いやなことを言っている'],
                  ['scary', 'こわい・あぶない'],
                  ['song', '流してはいけない曲'],
                  ['other', 'そのほか'],
                ] as const
              ).map(([r, l]) => (
                <button key={r} onClick={() => void report(r)} className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-white/10">
                  {l}
                </button>
              ))}
              {hostId && (
                <button onClick={() => void block()} className="mt-2 block w-full rounded-lg border-t border-white/10 px-2 pt-2 text-left text-red-300">
                  この人をブロック
                </button>
              )}
            </>
          )}
        </div>
      )}
      {toast.node}
    </div>
  );
}

function ShowPlayer({ show, onClose }: { show: RadioShowView; onClose: () => void }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(show.seconds);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const a = new Audio();
    audio.current = a;
    if (show.audioUrl.startsWith('idb:')) {
      void import('@/lib/api/idb').then(({ getBlob }) =>
        getBlob(show.audioUrl.slice(4)).then((b) => {
          if (b) a.src = URL.createObjectURL(b);
          else setFailed(true);
        }),
      );
    } else a.src = show.audioUrl;
    const time = () => setT(a.currentTime);
    a.addEventListener('timeupdate', time);
    a.addEventListener('loadedmetadata', () => Number.isFinite(a.duration) && setDur(a.duration));
    a.addEventListener('ended', () => setPlaying(false));
    a.addEventListener('error', () => setFailed(true));
    return () => {
      a.pause();
      a.removeEventListener('timeupdate', time);
      audio.current = null;
    };
  }, [show.audioUrl]);
  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      void a
        .play()
        .then(() => setPlaying(true))
        .catch(() => setFailed(true));
    }
  };
  const cue = cueAt(show.cues, t);
  return (
    <Sheet onClose={onClose}>
      <ShowArt url={show.thumbUrl} loop={show.loop} playing={playing} className="mx-auto w-full max-w-sm" />
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-black leading-snug">{show.title}</p>
          <p className="text-sm text-white/60">{show.host.displayName || show.host.handle}</p>
        </div>
        {!show.mine && <SafetyMenu target="show" id={show.id} hostId={show.host.id.startsWith('seed-') ? undefined : show.host.id} onBlocked={onClose} />}
      </div>
      <div className="mt-4">
        <input
          type="range"
          min={0}
          max={Math.max(1, dur)}
          step={0.5}
          value={t}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (audio.current) audio.current.currentTime = v;
            setT(v);
          }}
          className="w-full accent-amber-300"
          aria-label="再生の位置"
        />
        <div className="flex justify-between font-sans text-xs text-white/50">
          <span>{clock(t)}</span>
          <span>{clock(dur)}</span>
        </div>
      </div>
      <div className="mt-2 flex justify-center">
        <button onClick={toggle} className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-300 text-2xl text-slate-950 shadow-lg" aria-label={playing ? '止める' : '聴く'}>
          {playing ? '❚❚' : '▶'}
        </button>
      </div>
      {failed && <p className="mt-2 text-center text-xs text-red-300">この番組は、今は聴けません</p>}
      <NowPlaying cue={cue} />
    </Sheet>
  );
}

/** the song on air: its title and its maker (they can be visited on Mercury) */
function NowPlaying({ cue }: { cue: Pick<RadioCue, 'title' | 'by' | 'byId'> | null }) {
  if (!cue) return <p className="mt-4 text-center text-xs text-white/40">いまは、声だけ</p>;
  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <Glyph id="song" className="h-6 w-6 shrink-0 text-sky-200" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{cue.title}</p>
        <p className="truncate text-xs text-white/55">{cue.by}</p>
      </div>
      {cue.byId && (
        // PLACEHOLDER (P-RADIO-4): straight to the maker's island once Mercury opens an island by link
        <a href="/mercury" className="shrink-0 rounded-full bg-sky-300/15 px-3 py-1 text-xs text-sky-100">
          水星へ
        </a>
      )}
    </div>
  );
}

function LivePlayer({ live, onClose }: { live: RadioLiveView; onClose: () => void }) {
  const [state, setState] = useState<RadioLiveState | null>(null);
  const [text, setText] = useState('');
  const [asking, setAsking] = useState<PlanetPostView[] | null>(null);
  const toast = useToast();
  const openRequests = async () => {
    try {
      const sky = await getApi().planetSky('mercury', 'all');
      setAsking(sky.flatMap((f) => f.posts).filter((p) => p.kind === 'song'));
    } catch {
      setAsking([]);
    }
  };
  const request = async (p: PlanetPostView) => {
    try {
      await getApi().radioMessage(live.id, { kind: 'request', postId: p.id, text: '' });
      setAsking(null);
      toast.show('リクエストした');
      load();
    } catch {
      toast.show('この曲は、リクエストできない');
    }
  };
  const load = useCallback(() => {
    getApi()
      .radioLive(live.id)
      .then(setState)
      .catch(() => undefined);
  }, [live.id]);
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);
  const s = state ?? { ...live, messages: [] };
  const send = async () => {
    const v = text.trim();
    if (!v) return;
    try {
      await getApi().radioMessage(live.id, { kind: 'comment', text: v });
      setText('');
      load();
    } catch (e) {
      toast.show((e as { code?: string }).code === 'MODERATION' ? 'その言葉は送れない' : '送れなかった…');
    }
  };
  return (
    <Sheet onClose={onClose}>
      <ShowArt url={s.thumbUrl} loop={s.loop} onAir={s.status === 'live'} className="mx-auto w-full max-w-sm" />
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-black leading-snug">{s.title}</p>
          <p className="text-sm text-white/60">{s.host.displayName || s.host.handle}</p>
        </div>
        {!s.mine && <SafetyMenu target="live" id={s.id} hostId={s.host.id.startsWith('seed-') ? undefined : s.host.id} onBlocked={onClose} />}
      </div>
      {s.status !== 'live' && <p className="mt-3 rounded-xl bg-white/5 p-3 text-center text-sm text-white/70">{s.status === 'stopped' ? 'この放送は、止められた' : 'この放送は、おわった'}</p>}
      {s.status === 'live' && s.transport === 'test' && (
        <p className="mt-3 rounded-xl border border-amber-200/20 bg-amber-200/5 p-3 text-xs leading-relaxed text-amber-100/80">
          試験放送：いまは、画面と流れだけ。声がとどくのは、配信のしくみがそろってから。
        </p>
      )}
      <NowPlaying cue={s.now} />
      {s.status === 'live' && (
        <div className="mt-4">
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {s.messages.map((m) => (
              <div key={m.id} className="flex items-start gap-2 text-sm">
                <span className="shrink-0 font-bold text-white/70">{m.from.displayName || m.from.handle}</span>
                <span className="text-white/90">
                  {m.kind === 'request' && m.song ? `♪ ${m.song.title} ` : ''}
                  {m.text}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 60))}
              onKeyDown={(e) => e.key === 'Enter' && void send()}
              placeholder="ひとこと（60字まで）"
              className="min-w-0 flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm outline-none"
            />
            <button onClick={() => void send()} className="rounded-full bg-amber-300 px-4 text-sm font-bold text-slate-950">
              送る
            </button>
          </div>
          <button onClick={() => void openRequests()} className="mt-2 flex items-center gap-1.5 rounded-full border border-sky-200/30 px-3 py-1.5 text-xs text-sky-100">
            <Glyph id="song" label={false} className="h-4 w-4" />
            水星の曲をリクエスト
          </button>
          {asking && (
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-2">
              {asking.length === 0 && <p className="p-2 text-xs text-white/50">水星に、まだ曲が流れていない</p>}
              {asking.map((p) => (
                <button key={p.id} onClick={() => void request(p)} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-white/10">
                  <span className="truncate font-bold">{p.title}</span>
                  <span className="truncate text-xs text-white/50">{p.author.displayName || p.author.handle}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {toast.node}
    </Sheet>
  );
}
