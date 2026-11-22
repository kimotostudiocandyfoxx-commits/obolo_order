'use client';

import type { RadioCue, RadioDeckSong, RadioLiveState, RadioLoop, RadioMessageView, RadioShowView } from '@obolo/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Glyph } from '@/components/bluena/glyphs';
import { useToast } from '@/components/Toast';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { BoothMixer } from '@/lib/venus/booth';
import { LOOP_CHOICES, ShowArt } from './ShowArt';
import { LineIcon } from '@/components/LineIcon';

type Mode = 'idle' | 'recording' | 'live' | 'saving';

/**
 * The Venus broadcast booth (docs/工房とブルーナ_設計.md §10).
 *  1. 〔ブルーナを差す〕 — Bluena is the DJ's USB stick: your songs and songs you kept, only those born
 *     here with "radio / DJ OK" on. Files from the device are for 〔DJの練習〕 only (just you).
 *  2. two decks + crossfader, the mic, 〔話すと曲を小さく〕
 *  3. the picture and its loop
 *  4. 〔収録〕 → Bluena's Venus folder → 〔公開する〕 / 〔生配信〕 (ORDER members) → its recording is
 *     kept in Bluena when it ends
 */
export function Booth({ onClose, practice }: { onClose: () => void; practice?: () => void }) {
  const { me } = useAuth();
  const toast = useToast();
  const mixer = useRef<BoothMixer | null>(null);
  const [, setTick] = useState(0);
  const [songs, setSongs] = useState<RadioDeckSong[] | null>(null);
  const [inserted, setInserted] = useState(false);
  const [loaded, setLoaded] = useState<[RadioDeckSong | null, RadioDeckSong | null]>([null, null]);
  const [busy, setBusy] = useState<[boolean, boolean]>([false, false]);
  const [title, setTitle] = useState('');
  const [thumb, setThumb] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [loop, setLoop] = useState<RadioLoop>('drift');
  const [mode, setMode] = useState<Mode>('idle');
  const [liveId, setLiveId] = useState<string | null>(null);
  const [live, setLive] = useState<RadioLiveState | null>(null);
  const [mine, setMine] = useState<RadioShowView[]>([]);
  const [made, setMade] = useState<RadioShowView | null>(null);
  const cues = useRef<RadioCue[]>([]);
  const onAir = useRef<0 | 1 | null>(null);

  const m = () => {
    if (!mixer.current) mixer.current = new BoothMixer();
    return mixer.current;
  };

  useEffect(() => {
    getApi()
      .myRadioShows()
      .then(setMine)
      .catch(() => undefined);
    getApi()
      .jupiterRoots()
      .then((r) => setThumbs(r.filter((x) => x.kind === 'photo').map((x) => x.url).slice(0, 12)))
      .catch(() => undefined);
    return () => {
      mixer.current?.close();
      mixer.current = null;
    };
  }, []);

  const songOf = (d: 0 | 1 | null) => (d === null ? null : loaded[d]);

  // the meter, the clock, and "what is on air now" (a cue for the recording / the listeners' screen)
  useEffect(() => {
    const t = setInterval(() => {
      setTick((n) => n + 1);
      const mx = mixer.current;
      if (!mx || (mode !== 'recording' && mode !== 'live')) return;
      const d = mx.audibleDeck();
      if (d === onAir.current) return;
      onAir.current = d;
      const s = songOf(d);
      if (s) cues.current.push({ at: Math.round(mx.elapsed() * 10) / 10, songId: s.id, title: s.title, by: s.by, byId: s.byId });
      if (mode === 'live' && liveId) void getApi().setRadioNow(liveId, s ? { songId: s.id, title: s.title, by: s.by, byId: s.byId } : null).catch(() => undefined);
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, liveId, loaded]);

  // live: the beat (keeps the show alive) and the listeners' comments / requests
  useEffect(() => {
    if (mode !== 'live' || !liveId) return;
    const poll = () =>
      getApi()
        .radioLive(liveId)
        .then((st) => {
          setLive(st);
          if (st.status === 'stopped') {
            toast.show('運営が、この放送を止めた');
            void finish();
          }
        })
        .catch(() => undefined);
    poll();
    const p = setInterval(poll, 4000);
    const beat = setInterval(() => {
      const s = songOf(mixer.current?.audibleDeck() ?? null);
      void getApi().setRadioNow(liveId, s ? { songId: s.id, title: s.title, by: s.by, byId: s.byId } : null).catch(() => undefined);
    }, 30_000);
    return () => {
      clearInterval(p);
      clearInterval(beat);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, liveId]);

  const insert = async () => {
    m();
    setInserted(true);
    try {
      setSongs(await getApi().radioDeck());
    } catch {
      setSongs([]);
    }
  };

  const load = async (d: 0 | 1, s: RadioDeckSong) => {
    setBusy((b) => (d === 0 ? [true, b[1]] : [b[0], true]));
    try {
      await m().decks[d].load(s.url, s.bpm);
      setLoaded((l) => (d === 0 ? [s, l[1]] : [l[0], s]));
      // the newly loaded deck comes in when the fader is on its side
      if (!loaded[d === 0 ? 1 : 0]) m().setFader(d === 0 ? 0 : 1);
    } catch {
      toast.show('この曲は、読みこめなかった');
    } finally {
      setBusy((b) => (d === 0 ? [false, b[1]] : [b[0], false]));
    }
  };

  const toggleDeck = (d: 0 | 1) => {
    const deck = m().decks[d];
    if (!deck.buffer) return;
    if (deck.playing) deck.stop();
    else deck.play();
    setTick((n) => n + 1);
  };

  const allow = async (s: RadioDeckSong) => {
    try {
      await getApi().setSongRadio(s.id, true);
      setSongs((list) => list?.map((x) => (x.id === s.id ? { ...x, allowRadio: true } : x)) ?? null);
    } catch {
      toast.show('変えられなかった');
    }
  };

  const toggleMic = async () => {
    const mx = m();
    if (mx.micOn) mx.closeMic();
    else
      try {
        await mx.openMic();
      } catch {
        toast.show('マイクが使えない…。設定でマイクを許してね');
      }
    setTick((n) => n + 1);
  };

  const start = async (kind: 'recording' | 'live') => {
    const mx = m();
    if (!title.trim()) {
      toast.show('番組の名前をつけよう');
      return;
    }
    if (!mx.micOn)
      try {
        await mx.openMic();
      } catch {
        toast.show('マイクが使えない…');
        return;
      }
    if (kind === 'live') {
      try {
        const l = await getApi().startRadioLive({ title: title.trim(), thumbUrl: thumbOut(thumb), loop });
        setLiveId(l.id);
      } catch (e) {
        const code = (e as { code?: string }).code;
        toast.show(code === 'ORDER_REQUIRED' ? '生配信は、Obolo Order になってから' : code === 'TOO_YOUNG' ? '生配信は、もう少し大きくなってから' : '放送をはじめられなかった');
        return;
      }
    }
    cues.current = [];
    onAir.current = null;
    mx.startRecording();
    setMode(kind);
  };

  const finish = async () => {
    const mx = mixer.current;
    if (!mx?.recording) return;
    const wasLive = liveId;
    setMode('saving');
    try {
      const { blob, seconds } = await mx.stopRecording();
      if (wasLive) await getApi().endRadioLive(wasLive).catch(() => undefined);
      if (seconds < 1) throw new Error('short');
      const up = await getApi().uploadShow(blob);
      const show = await getApi().createRadioShow({
        mediaId: up.id,
        title: title.trim() || '名前のない番組',
        thumbUrl: thumbOut(thumb),
        loop,
        seconds: Math.round(seconds),
        cues: cues.current,
        ...(wasLive ? { liveId: wasLive } : {}),
      });
      setMine((l) => [show, ...l]);
      setMade(show);
    } catch {
      toast.show('しまえなかった…。もう一度、収録してね');
    } finally {
      setMode('idle');
      setLiveId(null);
      setLive(null);
    }
  };

  const publish = async (s: RadioShowView, on: boolean) => {
    try {
      const u = await getApi().publishRadioShow(s.id, on);
      setMine((l) => l.map((x) => (x.id === u.id ? u : x)));
      if (made?.id === u.id) setMade(null);
      toast.show(on ? 'ブルーナから、金星へ投影した' : '金星から、ブルーナにもどした');
    } catch {
      toast.show('できなかった…');
    }
  };

  const remove = async (s: RadioShowView) => {
    if (!confirm(`「${s.title}」を消す？`)) return;
    await getApi()
      .removeRadioShow(s.id)
      .then(() => setMine((l) => l.filter((x) => x.id !== s.id)))
      .catch(() => toast.show('消せなかった'));
  };

  const hide = async (msg: RadioMessageView) => {
    if (!liveId) return;
    await getApi().hideRadioMessage(liveId, msg.id).catch(() => undefined);
    setLive((st) => (st ? { ...st, messages: st.messages.filter((x) => x.id !== msg.id) } : st));
  };

  const mx = mixer.current;
  const onAirNow = mode === 'recording' || mode === 'live';
  const order = !!me?.orderedAt;
  const thumbChoices = [null, ...(me?.puniPic ? [me.puniPic] : []), ...thumbs];

  return (
    <div className="mx-auto max-w-xl px-4 pb-[calc(140px+env(safe-area-inset-bottom))] pt-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            if (onAirNow && !confirm('放送中です。やめて、ブースを出る？')) return;
            onClose();
          }}
          className="btn btn-ghost h-9 w-9 !p-0 text-lg"
          aria-label="戻る"
        >
          ←
        </button>
        <Glyph id="radio" className="h-5 w-5 text-amber-100" />
        <h1 className="text-base font-black">放送ブース</h1>
        {onAirNow && <span className="radio-onair ml-auto rounded-md bg-red-600 px-2 py-0.5 font-sans text-xs font-black tracking-widest">{mode === 'live' ? 'ON AIR' : 'REC'}</span>}
      </div>

      {/* the show: name, picture, loop */}
      <section className="mt-4 flex gap-3">
        <ShowArt url={thumb} loop={loop} className="w-28 shrink-0 self-start" onAir={mode === 'live'} />
        <div className="min-w-0 flex-1">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 40))}
            disabled={onAirNow}
            placeholder="番組の名前"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-bold outline-none"
          />
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {thumbChoices.map((u, i) => (
              <button key={i} onClick={() => setThumb(u)} aria-label={u ? '絵をえらぶ' : '絵なし'} className={`h-10 w-10 shrink-0 overflow-hidden rounded-lg border ${thumb === u ? 'border-amber-300' : 'border-white/15'}`}>
                {u ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-fuchsia-900 to-amber-900">
                    <Glyph id="radio" label={false} className="h-5 w-5 text-amber-100/70" />
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {LOOP_CHOICES.map((c) => (
              <button key={c.id} onClick={() => setLoop(c.id)} className={`rounded-full px-2.5 py-0.5 text-xs ${loop === c.id ? 'bg-amber-300 text-slate-950' : 'bg-white/10 text-white/70'}`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Bluena = the DJ's USB stick */}
      <section className="mt-5">
        {!inserted ? (
          <button onClick={() => void insert()} className="flex w-full items-center gap-4 rounded-2xl border border-sky-200/30 bg-gradient-to-r from-sky-900/40 to-indigo-900/40 p-4 text-left">
            <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-sky-200/40 bg-sky-300/10">
              <span className="h-8 w-5 rounded-sm border-2 border-sky-200/80" />
            </span>
            <span>
              <span className="block text-base font-black">ブルーナを差す</span>
              <span className="block text-xs text-white/60">ブルーナの曲が、デッキに入る</span>
            </span>
          </button>
        ) : (
          <div className="rounded-2xl border border-sky-200/20 bg-white/[0.03] p-3">
            <div className="flex items-center gap-2 text-xs text-sky-100/80">
              <span className="bluena-in inline-block h-5 w-3 rounded-sm border-2 border-sky-200/80" />
              ブルーナの曲
            </div>
            {songs === null && <p className="py-4 text-center text-xs text-white/50">読みこみ中…</p>}
            {songs?.length === 0 && <p className="py-4 text-center text-xs text-white/50">ブルーナに、まだ曲がない。月で作るか、水星で〔ブルーナにしまう〕。</p>}
            <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
              {songs?.map((s) => {
                const blocked = s.from === 'mine' && s.allowRadio === false;
                return (
                  <div key={s.id} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${blocked ? 'opacity-60' : ''}`}>
                    <Glyph id={s.from === 'saved' ? 'kept' : 'song'} className="h-4 w-4 shrink-0 text-sky-200" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{s.title}</p>
                      <p className="truncate text-[11px] text-white/50">{s.by}</p>
                    </div>
                    {blocked ? (
                      <button onClick={() => void allow(s)} className="shrink-0 rounded-full border border-white/20 px-2.5 py-1 text-[11px] text-white/80">
                        ラジオOKにする
                      </button>
                    ) : (
                      ([0, 1] as const).map((d) => (
                        <button
                          key={d}
                          disabled={busy[d]}
                          onClick={() => void load(d, s)}
                          className={`h-8 w-8 shrink-0 rounded-full font-sans text-xs font-black ${loaded[d]?.id === s.id ? 'bg-amber-300 text-slate-950' : d === 0 ? 'bg-sky-400/20 text-sky-100' : 'bg-orange-400/20 text-orange-100'}`}
                          aria-label={`${d === 0 ? 'A' : 'B'}のデッキに入れる`}
                        >
                          {d === 0 ? 'A' : 'B'}
                        </button>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* the decks */}
      {inserted && (
        <section className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="grid grid-cols-2 gap-3">
            {([0, 1] as const).map((d) => {
              const deck = mx?.decks[d];
              const s = loaded[d];
              return (
                <div key={d} className={`rounded-xl p-2 ${d === 0 ? 'bg-sky-400/10' : 'bg-orange-400/10'}`}>
                  <p className="font-sans text-[10px] font-black tracking-widest text-white/50">DECK {d === 0 ? 'A' : 'B'}</p>
                  <p className="mt-0.5 h-10 overflow-hidden text-xs font-bold leading-tight">{busy[d] ? '読みこみ中…' : (s?.title ?? '—')}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      onClick={() => toggleDeck(d)}
                      disabled={!deck?.buffer}
                      className={`flex h-11 w-11 items-center justify-center rounded-full text-lg disabled:opacity-30 ${deck?.playing ? 'bg-emerald-400 text-slate-950' : 'bg-white/15'}`}
                      aria-label={deck?.playing ? '止める' : '流す'}
                    >
                      {deck?.playing ? '❚❚' : '▶'}
                    </button>
                    <span className="font-sans text-[11px] text-white/50">{deck?.bpm ? `${Math.round(deck.bpm * deck.rate)} BPM` : ''}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="font-sans text-xs font-black text-sky-200">A</span>
            <input type="range" min={0} max={1} step={0.01} value={mx?.fader ?? 0} onChange={(e) => (m().setFader(Number(e.target.value)), setTick((n) => n + 1))} className="flex-1 accent-amber-300" aria-label="クロスフェーダー" />
            <span className="font-sans text-xs font-black text-orange-200">B</span>
            <button
              onClick={() => {
                const leftLead = (mx?.fader ?? 0) >= 0.5 ? 0 : 1;
                if (!m().sync(leftLead === 0 ? 1 : 0)) toast.show('2つの曲を入れてから');
              }}
              className="rounded-full bg-white/10 px-3 py-1 font-sans text-xs font-black"
            >
              SYNC
            </button>
          </div>
        </section>
      )}

      {/* the mic */}
      <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-3">
          <button onClick={() => void toggleMic()} className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl ${mx?.micOn ? 'bg-red-500' : 'bg-white/15'}`} aria-label={mx?.micOn ? 'マイクを切る' : 'マイクを入れる'}>
            <LineIcon id="mic" className="h-6 w-6" />
          </button>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-300 transition-[width] duration-75" style={{ width: `${Math.round((mx?.micLevel ?? 0) * 100)}%` }} />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-white/60">
          <label className="block">
            声
            <input type="range" min={0} max={1.5} step={0.01} defaultValue={1} onChange={(e) => m().setVoiceLevel(Number(e.target.value))} className="mt-1 w-full accent-amber-300" />
          </label>
          <label className="block">
            曲
            <input type="range" min={0} max={1} step={0.01} defaultValue={0.9} onChange={(e) => m().setMusicLevel(Number(e.target.value))} className="mt-1 w-full accent-amber-300" />
          </label>
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-white/70">
          <input type="checkbox" defaultChecked onChange={(e) => (m().autoDuck = e.target.checked)} className="accent-amber-300" />
          話すと、曲を小さく
          {mx?.speaking && mx.autoDuck && <span className="text-amber-200">（いま小さく）</span>}
        </label>
      </section>

      {/* live: the listeners' words */}
      {mode === 'live' && (
        <section className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/5 p-3">
          {live?.transport !== 'realtime' && <p className="mb-2 text-[11px] text-amber-100/70">試験放送：声が聴く人にとどくのは、配信のしくみがそろってから。画面と流れは本番と同じ。</p>}
          <div className="max-h-44 space-y-1.5 overflow-y-auto">
            {(live?.messages ?? []).length === 0 && <p className="text-xs text-white/40">ことばが来たら、ここに出る</p>}
            {live?.messages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-2 text-sm">
                <span className="shrink-0 font-bold text-white/70">{msg.from.displayName || msg.from.handle}</span>
                <span className="min-w-0 flex-1 text-white/90">
                  {msg.kind === 'request' && msg.song ? <span className="text-sky-200">♪ リクエスト：{msg.song.title}（{msg.song.by}） </span> : null}
                  {msg.text}
                </span>
                {!msg.mine && (
                  <button onClick={() => void hide(msg)} className="shrink-0 rounded-full bg-white/10 px-2 text-[11px] text-white/60">
                    かくす
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Bluena's Venus folder */}
      {mine.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-2 text-xs font-bold text-white/60">
            <Glyph id="radio" className="h-4 w-4" />
            ブルーナの金星フォルダ
          </h2>
          <div className="space-y-2">
            {mine.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
                <ShowArt url={s.thumbUrl} loop={s.loop} playing={false} className="w-12 shrink-0 !rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{s.title}</p>
                  <p className="text-[11px] text-white/50">{s.status === 'public' ? '金星で流れている' : 'ブルーナの中（自分だけ）'}</p>
                </div>
                <button onClick={() => void publish(s, s.status !== 'public')} className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${s.status === 'public' ? 'bg-white/10 text-white/70' : 'bg-amber-300 text-slate-950'}`}>
                  {s.status === 'public' ? 'もどす' : '公開する'}
                </button>
                <button onClick={() => void remove(s)} className="shrink-0 text-xs text-white/40" aria-label="消す">
                  ✕
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {practice && (
        <button onClick={practice} className="mt-6 w-full rounded-2xl border border-white/10 px-4 py-3 text-left text-sm text-white/70">
          DJの練習（自分だけ）
          <span className="block text-[11px] text-white/45">端末の曲も使える。練習の音は、番組には入らない</span>
        </button>
      )}

      {/* 〔収録〕 / 〔生配信〕 */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[color:var(--color-space-950)] via-[color:var(--color-space-950)]/95 to-transparent px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-8">
        <div className="pointer-events-auto mx-auto max-w-xl">
          {onAirNow || mode === 'saving' ? (
            <button onClick={() => void finish()} disabled={mode === 'saving'} className="flex w-full items-center justify-center gap-3 rounded-full bg-red-600 py-3 text-base font-black disabled:opacity-60">
              {mode === 'saving' ? 'ブルーナにしまっています…' : <>■ おわる <span className="font-sans text-sm font-bold">{clock(mx?.elapsed() ?? 0)}</span></>}
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => void start('recording')} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white/90 py-3 text-base font-black text-slate-950">
                <span className="h-3 w-3 rounded-full bg-red-600" />
                収録
              </button>
              <button
                onClick={() => (order ? void start('live') : toast.show('生配信は、Obolo Order になってから'))}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-base font-black ${order ? 'bg-gradient-to-r from-red-500 to-fuchsia-500' : 'bg-white/10 text-white/50'}`}
              >
                <Glyph id="radio" label={false} className="h-5 w-5" />
                生配信
              </button>
            </div>
          )}
        </div>
      </div>

      {made && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-6" onClick={() => setMade(null)}>
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[color:var(--color-space-900)] p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <ShowArt url={made.thumbUrl} loop={made.loop} className="mx-auto w-40" />
            <p className="mt-4 text-base font-black">ブルーナの金星フォルダに、しまった</p>
            <p className="mt-1 text-xs text-white/60">公開すると、ブルーナから金星へ投影される</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setMade(null)} className="flex-1 rounded-full bg-white/10 py-2.5 text-sm">
                あとで
              </button>
              <button onClick={() => void publish(made, true)} className="flex-1 rounded-full bg-amber-300 py-2.5 text-sm font-black text-slate-950">
                公開する
              </button>
            </div>
          </div>
        </div>
      )}
      {toast.node}
    </div>
  );
}

function clock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** the picture as the show keeps it: a full address (one under /public gets the site's origin) */
function thumbOut(u: string | null) {
  if (!u || !/^https?:|^\//.test(u)) return null;
  return u.startsWith('/') && typeof window !== 'undefined' ? `${window.location.origin}${u}` : u;
}
