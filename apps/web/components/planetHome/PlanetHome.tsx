'use client';

import { PLANET_HOMES, type HomePlanet, type HomeWork, type PlanetHomeView, type PlanetWorkReportBody } from '@obolo/shared';
import { useState, type ReactNode } from 'react';
import { menuFor } from '@/lib/planetHome/model';
import { usePlanetHome } from '@/lib/planetHome/usePlanetHome';
import { PLACEHOLDER_CSS } from './PlaceholderScenes';
import type { PlanetHomeSkin } from './skin';
import { skinFor } from './skins';

/**
 * 星のホーム (M-R258; Saturn M-R257): one component for every planet. Data and callbacks in (usePlanetHome), the scene
 * drawn by a swappable skin (skin.ts / skins.ts). This file is the frame every planet shares: the planet's name and one
 * line, the 推し list (top right), a work brought forward (maker's name + white = ダチ / pink = 推し), the long-press
 * menu, your works inside your place (newest first, 並べかえ・外す), one far stranger's work up close, and the words
 * while one sings. Never a count anywhere.
 *
 * A story passes `view` (a resident's scripted place, or {neo}'s) and `seeds` (the inviter's and KIMORIN's works
 * arriving); then nothing is loaded or written.
 */
export function PlanetHome({ planet, view, seeds, skin, onBack }: { planet: HomePlanet; view?: PlanetHomeView; seeds?: HomeWork[]; skin?: PlanetHomeSkin; onBack?: () => void }) {
  const cfg = PLANET_HOMES[planet];
  const h = usePlanetHome(planet, { view, seeds });
  const Scene = (skin ?? skinFor(planet)).Scene;
  const [focus, setFocus] = useState<HomeWork | null>(null);
  const [menu, setMenu] = useState<{ w: HomeWork; where: 'around' | 'far' } | null>(null);
  const [reporting, setReporting] = useState<HomeWork | null>(null);
  const [inside, setInside] = useState(false);
  const [far, setFar] = useState<HomeWork | null>(null);
  const [oshiOpen, setOshiOpen] = useState(false);
  const young = !!h.view?.young;
  const singing = h.playingId ? [...(h.stage?.own ?? []), ...(h.stage?.around ?? []), ...(h.stage?.far ?? [])].find((w) => w.id === h.playingId) : undefined;

  const open = (w: HomeWork) => {
    // Saturn: the kororin comes under the needle and sings now; elsewhere it comes forward and plays / opens
    if (cfg.open === 'sing' || cfg.open === 'play-audio') h.playOne(w);
    if (cfg.open !== 'sing') setFocus(w);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#140d26] text-white" data-planet={planet}>
      <style>{PLACEHOLDER_CSS}</style>
      {h.view && h.stage && (
        <Scene
          cfg={cfg}
          view={h.view}
          stage={h.stage}
          playingId={h.playingId}
          spinning={h.spinning}
          onPlace={() => (cfg.placeTap === 'play' ? (h.spinning ? h.stop() : h.play()) : setInside(true))}
          onPlay={() => (h.spinning ? h.stop() : h.play())}
          onArrange={() => setInside(true)}
          onItem={open}
          onHold={(w) => menuFor(w, young, 'around').length && setMenu({ w, where: 'around' })}
          onFar={(w) => {
            setFar(w);
            if (cfg.open === 'sing' || cfg.open === 'play-audio') h.playOne(w);
          }}
        />
      )}
      {h.error && <p className="absolute inset-x-8 top-[45%] rounded-2xl bg-black/50 px-4 py-3 text-center text-sm font-bold">いまは、開けなかった。もう一度ためしてみて</p>}

      {/* the planet's name and its one line: big the first time, small after */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-2 px-4 pt-3">
        {onBack && (
          <button onClick={onBack} className="pointer-events-auto rounded-full bg-black/40 px-3 py-1 text-sm" aria-label="もどる">
            ←
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-black tracking-widest [text-shadow:0_2px_6px_rgba(0,0,0,.6)]">{cfg.name}</h1>
          <p className={`mt-0.5 leading-relaxed text-white/85 [text-shadow:0_1px_3px_rgba(0,0,0,.7)] ${h.stage?.firstTime ? 'text-[13px] font-bold' : 'line-clamp-1 text-[10px]'}`}>{cfg.line}</p>
        </div>
        <button onClick={() => (setOshiOpen(true), h.loadOshi())} className="pointer-events-auto shrink-0 rounded-full bg-[#ff7ab6] px-3 py-1.5 text-xs font-black text-white shadow" aria-label="推し">
          推し
        </button>
      </header>

      {/* while one sings / plays: the maker's name and the words */}
      {singing && (
        <div className="pointer-events-none absolute inset-x-6 top-[24%] z-20 rounded-2xl bg-black/55 px-4 py-2 text-center backdrop-blur" data-testid="singing">
          <p className="text-[11px] font-bold text-white/80">
            <Mark rel={singing.rel} />
            {singing.rel === 'own' ? 'あなた' : singing.author.name}
          </p>
          {(singing.text || singing.title) && <p className="mt-0.5 text-sm font-bold">{singing.text || singing.title}</p>}
        </div>
      )}

      {/* a work brought forward */}
      {focus && (
        <Sheet onClose={() => setFocus(null)}>
          <Work w={focus} cfg={cfg} />
          <p className="mt-2 text-center text-xs font-bold">
            <Mark rel={focus.rel} />
            {focus.rel === 'own' ? 'あなた' : focus.author.name}
          </p>
        </Sheet>
      )}

      {/* long-press: 推す / 外す / 通報 */}
      {menu && (
        <Sheet onClose={() => setMenu(null)}>
          <p className="mb-3 text-center text-xs text-white/70">
            <Mark rel={menu.w.rel} />
            {menu.w.author.name}
          </p>
          <div className="flex flex-col gap-2">
            {menuFor(menu.w, young, menu.where).map((a) => (
              <button
                key={a}
                className="rounded-full bg-white/10 py-2.5 text-sm font-bold"
                onClick={() => {
                  const w = menu.w;
                  setMenu(null);
                  if (a === 'push') void h.push(w.author.id);
                  else if (a === 'takeout') void h.takeOut(w);
                  else if (a === 'hide') void h.hide(w);
                  else setReporting(w);
                }}
              >
                {a === 'push' ? '推す' : a === 'takeout' ? `この${cfg.work}を外す` : a === 'hide' ? '見えなくする' : '通報'}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {reporting && <ReportSheet onClose={() => setReporting(null)} onPick={(r) => void h.report(reporting, r).then(() => setReporting(null))} />}

      {/* one stranger's work from the far scenery, up close */}
      {far && (
        <Sheet onClose={() => setFar(null)}>
          <Work w={far} cfg={cfg} />
          <p className="mt-2 text-center text-xs font-bold">{far.author.name}</p>
          <div className="mt-3 flex justify-center gap-2">
            {menuFor(far, young, 'far').map((a) => (
              <button
                key={a}
                className={`rounded-full px-4 py-2 text-xs font-bold ${a === 'push' ? 'bg-[#ff7ab6]' : 'bg-white/10'}`}
                onClick={() => {
                  const w = far;
                  if (a === 'push') void h.push(w.author.id).then(() => setFar(null));
                  else if (a === 'hide') void h.hide(w).then(() => setFar(null));
                  else setReporting(w);
                }}
              >
                {a === 'push' ? '推す' : a === 'hide' ? '見えなくする' : '通報'}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {/* inside your place: your works, forever, newest first; 並べかえ・外す */}
      {inside && h.stage && (
        <Sheet onClose={() => setInside(false)} tall>
          <h2 className="mb-2 text-center text-sm font-black">
            {h.view?.owner.name}の{cfg.inside}
          </h2>
          {!h.stage.own.length && <p className="py-6 text-center text-xs text-white/70">まだ、なにもない</p>}
          <ul className="flex flex-col gap-1.5">
            {h.stage.own.map((w, i) => (
              <li key={w.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-1.5">
                <button onClick={() => open(w)} className="min-w-0 flex-1 truncate text-left text-xs">
                  <Mark rel="own" />
                  {w.title || w.text || cfg.work}
                </button>
                <button disabled={i === 0} onClick={() => h.moveOwn(w.id, -1)} className="rounded bg-white/10 px-2 py-1 text-xs disabled:opacity-30" aria-label="上へ">
                  ↑
                </button>
                <button disabled={i === h.stage!.own.length - 1} onClick={() => h.moveOwn(w.id, 1)} className="rounded bg-white/10 px-2 py-1 text-xs disabled:opacity-30" aria-label="下へ">
                  ↓
                </button>
                <button onClick={() => void h.removeOwn(w)} className="rounded bg-white/10 px-2 py-1 text-[11px]">
                  外す
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}

      {/* 推し: who you push (dachi are in by themselves) */}
      {oshiOpen && (
        <Sheet onClose={() => setOshiOpen(false)} tall>
          <h2 className="mb-2 text-center text-sm font-black">推し</h2>
          {h.oshi === null && <p className="py-4 text-center text-xs text-white/60">…</p>}
          {h.oshi?.length === 0 && <p className="py-4 text-center text-xs text-white/70">まだ、推している人はいない</p>}
          <ul className="flex flex-col gap-1.5">
            {h.oshi?.map((o) => (
              <li key={o.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-xs font-bold">
                  <Mark rel={o.dachi ? 'dachi' : 'oshi'} />
                  {o.name}
                </span>
                {o.dachi ? (
                  <span className="text-[10px] text-white/60">ダチ</span>
                ) : (
                  <button onClick={() => void h.unpush(o.id)} className="rounded-full bg-white/10 px-3 py-1 text-[11px]">
                    外す
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Sheet>
      )}

      {h.note && <p className="absolute inset-x-8 bottom-24 z-50 rounded-full bg-black/70 px-4 py-2 text-center text-xs font-bold">{h.note}</p>}
    </div>
  );
}

/** white = ダチ, pink = 推し, gold = yours */
function Mark({ rel }: { rel: HomeWork['rel'] }) {
  const c = rel === 'dachi' ? '#ffffff' : rel === 'oshi' ? '#ff7ab6' : rel === 'own' ? '#f2c14e' : 'transparent';
  return <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: c }} aria-label={rel === 'dachi' ? 'ダチ' : rel === 'oshi' ? '推し' : undefined} />;
}

function Work({ w, cfg }: { w: HomeWork; cfg: (typeof PLANET_HOMES)[HomePlanet] }) {
  if (cfg.open === 'view' && (w.url || w.thumbUrl))
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={(w.url || w.thumbUrl)!} alt="" className="mx-auto aspect-square w-full max-w-[300px] rounded-xl object-cover" />;
  if (cfg.open === 'play-video' && w.url) return <video src={w.url} poster={w.thumbUrl ?? undefined} controls autoPlay playsInline className="mx-auto w-full max-w-[300px] rounded-xl" />;
  return (
    <div className="mx-auto flex aspect-square w-40 items-center justify-center rounded-full bg-white/10 p-4 text-center text-sm font-bold">
      {w.title || w.text || cfg.work}
    </div>
  );
}

function Sheet({ children, onClose, tall }: { children: ReactNode; onClose: () => void; tall?: boolean }) {
  return (
    <div className="absolute inset-0 z-40 flex items-end bg-black/40" onClick={onClose}>
      <div className={`w-full overflow-y-auto rounded-t-3xl bg-[#221640] px-4 pb-8 pt-4 ${tall ? 'max-h-[70%]' : ''}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

const REASONS: [PlanetWorkReportBody['reason'], string][] = [
  ['mean', 'いやなことを言っている'],
  ['scary', 'こわい・あぶない'],
  ['other', 'そのほか'],
];
function ReportSheet({ onClose, onPick }: { onClose: () => void; onPick: (r: PlanetWorkReportBody['reason']) => void }) {
  return (
    <Sheet onClose={onClose}>
      <h2 className="mb-3 text-center text-sm font-black">通報</h2>
      <div className="flex flex-col gap-2">
        {REASONS.map(([r, l]) => (
          <button key={r} onClick={() => onPick(r)} className="rounded-full bg-white/10 py-2.5 text-sm font-bold">
            {l}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
