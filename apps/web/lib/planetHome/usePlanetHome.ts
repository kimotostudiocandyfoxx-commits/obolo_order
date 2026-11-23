'use client';

import { PLANET_HOMES, type HomeOshi, type HomePlanet, type HomeWork, type PlanetHomeView, type PlanetWorkReportBody } from '@obolo/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getApi } from '@/lib/api';
import { stopAudio, subscribeAudio, toggleAudio } from '@/lib/audio';
import { moveOwn, queueFrom, recordOrder, stageOf, type Stage, type StageItem } from './model';

/**
 * 星のホーム (M-R258): the state and the actions behind one planet home — load, the visit mark, singing / playing in
 * turn, 推す / 外す / 通報 / 見えなくする, your own works' order. A story passes `view` (its scripted resident place or
 * {neo}'s place) and `seeds` (the inviter's and KIMORIN's works arriving); then nothing is loaded or written.
 */
export interface PlanetHomeState {
  planet: HomePlanet;
  view: PlanetHomeView | null;
  stage: Stage | null;
  error: boolean;
  /** the one playing now (Saturn: the kororin under the needle) */
  playingId: string | null;
  /** Saturn: the record is turning */
  spinning: boolean;
  oshi: HomeOshi[] | null;
  note: string | null;
  play: (startId?: string) => void;
  stop: () => void;
  playOne: (w: HomeWork) => void;
  push: (userId: string) => Promise<void>;
  unpush: (userId: string) => Promise<void>;
  takeOut: (w: HomeWork) => Promise<void>;
  report: (w: HomeWork, reason: PlanetWorkReportBody['reason']) => Promise<void>;
  hide: (w: HomeWork) => Promise<void>;
  removeOwn: (w: HomeWork) => Promise<void>;
  moveOwn: (id: string, by: -1 | 1) => void;
  loadOshi: () => void;
}

export function usePlanetHome(planet: HomePlanet, opts: { view?: PlanetHomeView; seeds?: HomeWork[] } = {}): PlanetHomeState {
  const scripted = !!opts.view;
  const [loaded, setLoaded] = useState<PlanetHomeView | null>(null);
  const [error, setError] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [ownOrder, setOwnOrder] = useState<string[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [oshi, setOshi] = useState<HomeOshi[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const queue = useRef<StageItem[]>([]);
  const current = useRef<StageItem | null>(null);

  // load, then mark the visit (the view keeps the visit before, so what came after it sparkles this time)
  useEffect(() => {
    if (scripted) return;
    let on = true;
    getApi()
      .planetHome(planet)
      .then((v) => {
        if (!on) return;
        setLoaded(v);
        void getApi().planetHomeVisit(planet).catch(() => undefined);
      })
      .catch(() => on && setError(true));
    return () => {
      on = false;
    };
  }, [planet, scripted]);

  // a dachi's / 推し's work whose 88 hours run out while the screen is open leaves
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const view = opts.view ?? loaded;
  const viewOrdered = useMemo(() => {
    if (!view || !ownOrder) return view;
    const pos = new Map(ownOrder.map((id, i) => [id, i]));
    return { ...view, own: [...view.own].sort((a, b) => (pos.get(a.id) ?? -1) - (pos.get(b.id) ?? -1)) };
  }, [view, ownOrder]);
  const stage = useMemo(() => (viewOrdered ? stageOf(viewOrdered, { now, seeds: opts.seeds, hidden }) : null), [viewOrdered, now, opts.seeds, hidden]);

  const flash = (t: string) => {
    setNote(t);
    setTimeout(() => setNote((n) => (n === t ? null : n)), 2600);
  };

  const sing = useCallback((w: StageItem) => {
    if (!w.url) return;
    current.current = w;
    setPlayingId(w.id);
    void toggleAudio(w.url).catch(() => setPlayingId(null));
  }, []);

  // one ends → the next one on the record comes under the needle
  useEffect(
    () =>
      subscribeAudio((st) => {
        if (st.playing) return;
        const ended = st.progress >= 0.97;
        const next = ended ? queue.current.shift() : undefined;
        if (next) return sing(next);
        if (ended || !current.current || st.url === current.current.url) {
          setPlayingId(null);
          setSpinning(false);
          queue.current = [];
        }
      }),
    [sing],
  );
  useEffect(() => () => stopAudio(), []);

  const play = useCallback(
    (startId?: string) => {
      if (!stage) return;
      const q = queueFrom(recordOrder(stage), startId);
      if (!q.length) return;
      setSpinning(true);
      queue.current = q.slice(1);
      sing(q[0]);
    },
    [stage, sing],
  );
  const stop = useCallback(() => {
    queue.current = [];
    setSpinning(false);
    stopAudio();
  }, []);
  // tapping one: it sings now (Saturn: comes under the needle; the record carries on if it was turning)
  const playOne = useCallback(
    (w: HomeWork) => {
      if (!stage) return;
      const all = [...stage.own, ...stage.around, ...stage.far];
      const it = all.find((x) => x.id === w.id);
      if (!it) return;
      if (spinning && PLANET_HOMES[planet].placeTap === 'play') return play(w.id);
      queue.current = [];
      sing(it);
    },
    [stage, spinning, planet, play, sing],
  );

  const loadOshi = useCallback(() => {
    if (scripted) return setOshi([]);
    getApi()
      .oshiList()
      .then(setOshi)
      .catch(() => setOshi([]));
  }, [scripted]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    if (scripted) return flash(ok);
    try {
      await fn();
      flash(ok);
    } catch {
      flash('いまは、できなかった');
    }
  };

  return {
    planet,
    view,
    stage,
    error,
    playingId,
    spinning,
    oshi,
    note,
    play,
    stop,
    playOne,
    loadOshi,
    push: (userId) => act(async () => setOshi(await getApi().setOshi(userId, true)), '推した。次から、ここにも来るよ'),
    unpush: (userId) => act(async () => setOshi(await getApi().setOshi(userId, false)), '推しから外した'),
    // 外す (a dachi's / 推し's work, from your place): for you only, kept — the same as 〔見えなくする〕 on the server
    takeOut: (w) =>
      act(async () => {
        await getApi().hidePlanetWork(w.kind, w.id, true);
        setHidden((s) => new Set(s).add(w.id));
      }, '外した'),
    hide: (w) =>
      act(async () => {
        await getApi().hidePlanetWork(w.kind, w.id, true);
        setHidden((s) => new Set(s).add(w.id));
      }, '見えなくした。あなたにだけ、もう出てこない'),
    report: (w, reason) => act(() => getApi().reportPlanetWork(w.kind, w.id, { reason }), 'とどいた。運営が確かめるね'),
    // your own: back into Bluena only
    removeOwn: (w) =>
      act(async () => {
        await getApi().planetHomeTakeOut(planet, w.id);
        setHidden((s) => new Set(s).add(w.id));
      }, 'Bluenaに戻した'),
    moveOwn: (id, by) => {
      if (!view) return;
      const ids = moveOwn(ownOrder ?? (stage?.own ?? view.own).map((w) => w.id), id, by);
      setOwnOrder(ids);
      if (!scripted) void getApi().planetHomeOrder(planet, ids).catch(() => undefined);
    },
  };
}
