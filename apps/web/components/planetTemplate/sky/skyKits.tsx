'use client';

import { PLANET_HOMES, type HomePlanet, type HomeWork, type PlanetSongView } from '@obolo/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { templateConfig } from '@/lib/planetTemplate/config';
import { isFivePlanet } from '@/lib/planetTemplate/five';
import { artTitleOf } from '@/lib/planetTemplate/jupiter';
import { shipStandIn } from '@/lib/planetTemplate/mercury';
import { figureOfAuthor } from '@/lib/planetTemplate/people';
import type { LandWork, SkySource } from '@/lib/planetTemplate/sky';
import { FiveViewer } from '../five/fiveHooks';
import { ScrollArt, Wings } from '../jupiter/jupiterHooks';
import { SongStage } from '../mercury/SongStage';
import type { SkyOpen, TemplateMe } from '../PlanetTemplateHome';
import { SkyExplore } from './SkyExplore';
import x from './Sky.module.css';

/** what the opened work gets in the sky: the work, on the shore (▶) or tapped, rolling up, and the end of a song / MV */
export interface SkyOpenWork {
  w: LandWork;
  shore: boolean;
  closing: boolean;
  onEnd?: () => void;
}

/**
 * 06 §5 per planet: how a stranger rides on a landed continent (and comes to the shore) and how their work opens there —
 * the planet's own opener (Mercury the song's disc, Jupiter the hanging scroll, Saturn the kororin popping, the five
 * their 05 viewers). The maker's figure and name, ☆ ♡ ⋯ are SkyExplore's own (the same on every planet).
 */
export interface SkyKit {
  /** the maker's figure on this planet (figureFor; a stand-in until theirs is painted) */
  figureOf(w: HomeWork): string;
  /** a stranger on the continent: their figure (Jupiter: a butterfly holding a small art) */
  rider(o: { w: HomeWork; i: number }): ReactNode;
  opener(o: SkyOpenWork): ReactNode;
}

const voiceOf = (w: HomeWork) => (w.url && !w.url.startsWith('tts:') ? w.url : null);
/** a stranger's figure on `planet` (figureOfAuthor), or the planet's stand-in (Mercury's coloured ships, the sprite) */
export const strangerFigure = (planet: HomePlanet, w: HomeWork) => figureOfAuthor(w.author, planet) ?? (planet === 'mercury' ? shipStandIn(w.author.id) : PLANET_HOMES[planet].art.sprite);

/** Saturn: the kororin pops — the chibi jumps out, its words in a bubble, its voice (prototype SKYV.saturn.show / 04 §1) */
function KororinOpen({ w, shore }: { w: HomeWork; shore: boolean }) {
  const [popped, setPopped] = useState(false);
  useEffect(() => {
    let voice: HTMLAudioElement | null = null;
    const a = setTimeout(() => setPopped(true), 160);
    const url = voiceOf(w);
    const b = setTimeout(() => {
      if (!url) return;
      try {
        voice = new Audio(url);
        voice.play().catch(() => undefined);
      } catch {
        voice = null;
      }
    }, 260);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
      voice?.pause();
    };
  }, [w]);
  const words = (w.text || w.title || '').trim();
  const chibi = w.author.figure ?? w.author.chibi ?? w.author.ball ?? PLANET_HOMES.saturn.art.sprite;
  return (
    <div className={`${x.skor} ${shore ? x.onShore : ''}`} data-testid="sky-kororin">
      {!popped && !shore && <img className={x.korBall} src={strangerFigure('saturn', w)} alt="" draggable={false} />}
      {popped && (
        <>
          {Array.from({ length: 14 }, (_, k) => {
            const a = (k / 14) * Math.PI * 2;
            const d = 60 + ((k * 37) % 10) * 5;
            return <i key={k} className={x.drop} style={{ ['--dx' as string]: `${Math.cos(a) * d}px`, ['--dy' as string]: `${Math.sin(a) * d}px` }} />;
          })}
          <img className={x.korChibi} src={chibi} alt="" draggable={false} />
          <div className={x.sbub}>{words ? `「${words}」` : '♪'}</div>
        </>
      )}
    </div>
  );
}

export function skyKitOf(planet: HomePlanet, load: (w: HomeWork) => Promise<PlanetSongView | null>): SkyKit {
  const figureOf = (w: HomeWork) => strangerFigure(planet, w);
  if (planet === 'mercury')
    return {
      figureOf,
      rider: ({ w }) => <img src={figureOf(w)} alt="" draggable={false} />,
      opener: ({ w, shore, onEnd }) => <SongStage key={w.id} work={w} load={load} place="land" loop={!shore} startMs={shore ? 0 : 450} titleMs={shore ? 1500 : 2200} onEnd={onEnd} />,
    };
  if (planet === 'jupiter')
    return {
      figureOf,
      rider: ({ w, i }) => (
        <>
          <Wings src={figureOf(w)} i={i} wings={w.author.figure ? (w.author.wings ?? null) : null} fill />
          {(w.thumbUrl || w.url) && <i className={x.eart} style={{ backgroundImage: `url(${w.thumbUrl || w.url})` }} />}
        </>
      ),
      opener: ({ w, closing }) => <ScrollArt key={w.id} art={w.url || w.thumbUrl || null} title={artTitleOf(w)} tags={w.tags} closing={closing} />,
    };
  if (planet === 'saturn')
    return {
      figureOf,
      rider: ({ w }) => <img className={x.kor} src={figureOf(w)} alt="" draggable={false} />,
      opener: ({ w, shore }) => <KororinOpen key={w.id} w={w} shore={shore} />,
    };
  if (isFivePlanet(planet))
    return {
      figureOf,
      rider: ({ w }) => <img src={figureOf(w)} alt="" draggable={false} />,
      // PRESS START is not pressed in the sky (06 §5 opens the work; playing a stranger's game is the home's)
      opener: ({ w, shore, closing, onEnd }) => <FiveViewer key={w.id} planet={planet} work={w} playing={shore} closing={closing} onDone={onEnd} />,
    };
  return { figureOf, rider: ({ w }) => <img src={figureOf(w)} alt="" draggable={false} />, opener: () => null };
}

/**
 * The sky hook for any planet (06): pinch in on the home → SkyExplore with the planet's kit. Only where the planet has a
 * sky (templateConfig(planet).sky: Mercury, Jupiter, Saturn) and a source (the API or the sample).
 */
export function skyHookOf(planet: HomePlanet, o: { sky: SkySource | null; me: TemplateMe; load: (w: HomeWork) => Promise<PlanetSongView | null> }): ((h: SkyOpen) => ReactNode) | undefined {
  if (!o.sky || !templateConfig(planet).sky) return undefined;
  const kit = skyKitOf(planet, o.load);
  const source = o.sky;
  const SkyHook = (h: SkyOpen) => <SkyExplore planet={planet} source={source} kit={kit} me={o.me} onClose={h.close} toast={h.toast} />;
  return SkyHook;
}
