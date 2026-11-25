'use client';

import { gameDocument, type GameView } from '@obolo/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Client 2026-11-25 (ゲーム): a game made on the Moon, played in a sandbox — an iframe with sandbox="allow-scripts" only
 * (no same origin: no cookies, no storage, no parent page), its page given as srcdoc with a strict CSP (nothing from the
 * network), the fixed harness around the generated logic (gameDocument). It speaks only by postMessage (ready, a
 * heartbeat, an error) and only messages from its own window count. A watchdog: not ready in READY_MS, or an error before
 * it ran a moment → it does not run (`onBroken`: {bati} says so and the mana goes back); an error later or a frozen
 * frame → a small 〔もう一回〕 over it.
 */
const READY_MS = 6000;
const EARLY_MS = 4000;
const FROZEN_MS = 5000;
export const GAME_BROKEN_EVENT = 'obolo:game-broken';
export type GameBrokenDetail = { gameId: string; version: number; reason: string };

export function GameFrame({ game, className = '', onBroken, own = true }: { game: GameView; className?: string; onBroken?: (reason: string) => void; /** the maker's own (a ダチ's game never reports) */ own?: boolean }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [run, setRun] = useState(0);
  const [state, setState] = useState<'loading' | 'ok' | 'stopped' | 'broken'>('loading');
  const doc = useMemo(() => gameDocument({ code: game.code, title: game.title, howTo: game.howTo, tags: game.tags }), [game.code, game.title, game.howTo, game.tags]);
  useEffect(() => {
    setState('loading');
    let readyAt = 0;
    let lastBeat = 0;
    let done = false;
    const fail = (reason: string, early: boolean) => {
      if (done) return;
      done = true;
      if (early) {
        setState('broken');
        onBroken?.(reason);
        if (own) window.dispatchEvent(new CustomEvent<GameBrokenDetail>(GAME_BROKEN_EVENT, { detail: { gameId: game.id, version: game.version, reason } }));
      } else setState('stopped');
    };
    const onMsg = (e: MessageEvent) => {
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      const d = e.data as { obolo?: string; type?: string; message?: string } | null;
      if (!d || d.obolo !== 'game') return;
      if (d.type === 'ready') {
        readyAt = Date.now();
        lastBeat = readyAt;
        setState('ok');
      } else if (d.type === 'beat') lastBeat = Date.now();
      else if (d.type === 'error') fail(String(d.message ?? 'error').slice(0, 200), !readyAt || Date.now() - readyAt < EARLY_MS);
    };
    window.addEventListener('message', onMsg);
    const t0 = performance.now();
    const t = setInterval(() => {
      if (done) return;
      if (!readyAt && performance.now() - t0 > READY_MS) fail('never started', true);
      else if (readyAt && !document.hidden && Date.now() - lastBeat > FROZEN_MS) fail('frozen', false);
    }, 500);
    return () => {
      window.removeEventListener('message', onMsg);
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, run]);
  return (
    <div className={`relative overflow-hidden bg-black ${className}`} data-testid="game-frame" data-state={state}>
      <iframe key={run} ref={ref} title={game.title} srcDoc={doc} sandbox="allow-scripts" referrerPolicy="no-referrer" allow="" className="absolute inset-0 h-full w-full border-0" />
      {(state === 'stopped' || state === 'broken') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-center text-[13px] text-white/90">
          <p>{state === 'broken' ? 'このゲームは、うまく動かなかった' : '止まっちゃった'}</p>
          {state === 'stopped' && (
            <button onClick={() => setRun((n) => n + 1)} className="rounded-full bg-white/90 px-4 py-1.5 text-[12px] font-bold text-slate-900">
              もう一回
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** the game full screen over everything (a tap on ✕ closes) */
export function GameFull({ game, onClose, own = true }: { game: GameView; onClose: () => void; own?: boolean }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col bg-black" role="dialog" aria-label={game.title} data-testid="game-full">
      <div className="pt-safe flex items-center gap-2 px-3 py-2 text-white">
        <b className="min-w-0 flex-1 truncate text-[14px]">{game.title}</b>
        <button onClick={onClose} aria-label="とじる" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg">
          ✕
        </button>
      </div>
      <GameFrame game={game} own={own} className="pb-safe min-h-0 flex-1" />
    </div>,
    document.body,
  );
}

/** a game on its card in the talk / in Bluena: played right there, 〔全画面で遊ぶ〕 */
export function GameFace({ game }: { game: GameView }) {
  const [full, setFull] = useState(false);
  return (
    <div>
      <GameFrame game={game} className="aspect-[3/4] w-full rounded-xl" />
      {game.howTo && <p className="mt-1 text-[12px] text-amber-50/80">{game.howTo}</p>}
      <button onClick={() => setFull(true)} className="mt-1.5 rounded-full bg-amber-200 px-3 py-1.5 text-[12px] font-bold text-slate-950" data-testid="game-full-open">
        ▶ 全画面で遊ぶ
      </button>
      {full && <GameFull game={game} onClose={() => setFull(false)} />}
    </div>
  );
}

/** a game fetched by its id (a ダチ's card, Bluena), then played */
export function GameById({ id, own, load }: { id: string; own: boolean; load: (id: string) => Promise<GameView> }) {
  const [g, setG] = useState<GameView | null | 'none'>(null);
  useEffect(() => {
    let live = true;
    load(id)
      .then((x) => live && setG(x))
      .catch(() => live && setG('none'));
    return () => {
      live = false;
    };
  }, [id, load]);
  if (g === 'none') return <p className="text-[12px] text-white/70">このゲームは、いまは遊べないみたい</p>;
  if (!g) return <p className="text-[12px] text-white/60">…</p>;
  return own ? <GameFace game={g} /> : <GameShared game={g} />;
}

function GameShared({ game }: { game: GameView }) {
  const [full, setFull] = useState(false);
  return (
    <div>
      <GameFrame game={game} own={false} className="aspect-[3/4] w-full rounded-xl" />
      <button onClick={() => setFull(true)} className="mt-1.5 rounded-full bg-amber-200 px-3 py-1.5 text-[12px] font-bold text-slate-950">
        ▶ 全画面で遊ぶ
      </button>
      {full && <GameFull game={game} own={false} onClose={() => setFull(false)} />}
    </div>
  );
}

/** the atelier listens: the maker's game did not run → {bati} says so (the mana back) */
export function useGameBroken(fn: (d: GameBrokenDetail) => void) {
  const f = useRef(fn);
  f.current = fn;
  useEffect(() => {
    const seen = new Set<string>();
    const on = (e: Event) => {
      const d = (e as CustomEvent<GameBrokenDetail>).detail;
      const k = `${d?.gameId}:${d?.version}`;
      if (!d || seen.has(k)) return;
      seen.add(k);
      f.current(d);
    };
    window.addEventListener(GAME_BROKEN_EVENT, on);
    return () => window.removeEventListener(GAME_BROKEN_EVENT, on);
  }, []);
}
