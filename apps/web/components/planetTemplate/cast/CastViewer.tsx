'use client';

import type { HomePlanet, HomeWork } from '@obolo/shared';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { narrate, stopNarration } from '@/lib/planetTemplate/castAudio';
import { castAsset, castMv, castOfWork, castTapVoice, type CastWorks } from '@/lib/planetTemplate/castWorks';
import { soundScope } from '@/lib/planetTemplate/sfx';
import { CUP_MS } from '@/lib/planetTemplate/sound';
import c from './Cast.module.css';
import { PictureBook } from './PictureBook';
import { TapGame } from './TapGame';

/**
 * The line a cast member says as their work opens (Jupiter: the art's title; Uranus: the goods; Neptune: the game's
 * name — handoff planets-08 §3). The tap itself starts it (lib/planetTemplate/castAudio tapVoice, inside the gesture);
 * here it is only made sure of — in ▶, where nothing was tapped, this is what starts it — and stopped when the work
 * closes. A work that is not the cast's: nothing.
 */
export function useCastVoice(planet: HomePlanet, work: Pick<HomeWork, 'id'>): void {
  const id = work.id;
  useEffect(() => {
    const m = castOfWork({ id });
    const url = m ? castTapVoice(m.cast, planet) : null;
    if (!url) return;
    narrate(url);
    return () => stopNarration();
  }, [planet, id]);
}

export interface CastViewerProps {
  planet: 'mars' | 'uranus' | 'pluto' | 'neptune';
  cast: CastWorks;
  /** the viewer's own box (the five's .vw classes and place) */
  className: string;
  /** Mars: the five's square screen */
  screenClass?: string;
  style: CSSProperties;
  /** in ▶: nothing is pressed; Mars plays the song once to its end, then `onDone` */
  playing?: boolean;
  onDone?: () => void;
  /** Pluto: the book has closed and flown away — the work closes */
  onFinish?: () => void;
  /** the title under the work (the five's own, in the work's font) */
  title: ReactNode;
}

/**
 * How the cast's works open on Mars, Uranus, Pluto and Neptune (handoff planets-08 §3 / §6, the prototype's sapViewer):
 *  - Mars: the Sushimon's short film (2.67 s, made seamless at its loop point: scripts/planet-home/mvloop.py) loops (no sound of its own) under their song; the others'
 *    Jupiter art moves slowly under their song. The song plays until the work is closed (▶: once, to its end).
 *  - Uranus: the goods item's own picture; its maker says its name and a line as it opens; a mug clinks.
 *  - Pluto: the picture book. - Neptune: the tap game, its maker saying its name.
 * (Venus needs nothing of its own: the show's picture and sound are a radio show's.)
 */
export function CastViewer({ planet, cast, className, screenClass, style, playing = false, onDone, onFinish, title }: CastViewerProps) {
  const done = useRef(onDone);
  done.current = onDone;
  const [away, setAway] = useState(false);
  // Uranus: a mug's own sound just after the shop's bell (the prototype's 420 ms)
  useEffect(() => {
    if (planet !== 'uranus' || !cast.goods.includes('マグカップ')) return;
    const sc = soundScope();
    sc.sfx('cup', CUP_MS);
    return () => sc.stop();
  }, [planet, cast]);
  // the book reads itself (title, then page after page): PictureBook owns its voice, so none is asked for here
  useCastVoice(planet, { id: planet === 'pluto' ? '' : `cast-${cast.key}-${planet}` });

  if (planet === 'mars') {
    const mv = castMv(cast);
    const art = castAsset(cast.key, 'art.webp');
    return (
      <div className={className} style={style} data-testid="five-viewer" data-kind="mv" data-cast={cast.key}>
        <div className={screenClass} data-testid="mv-screen">
          {mv ? <video src={mv} poster={art} muted loop playsInline autoPlay data-testid="cast-mv" /> : <i className={c.kb} style={{ backgroundImage: `url(${art})` }} data-testid="cast-mv-still" />}
        </div>
        <audio src={castAsset(cast.key, 'song.mp3')} autoPlay loop={!playing} onEnded={() => done.current?.()} onError={() => done.current?.()} />
        {title}
      </div>
    );
  }
  if (planet === 'uranus')
    return (
      <div className={`${className} ${c.photoWrap}`} style={style} data-testid="five-viewer" data-kind="goods" data-cast={cast.key}>
        <div className={c.photo} data-testid="cast-goods">
          <img src={castAsset(cast.key, 'goods.webp')} alt={cast.goods} draggable={false} />
        </div>
        {title}
      </div>
    );
  if (planet === 'pluto')
    return (
      <div className={`${className} ${c.bookWrap} ${playing ? '' : c.live} ${away ? c.away : ''}`} style={style} data-testid="five-viewer" data-kind="book" data-cast={cast.key}>
        {/* ▶: read to the last page, then the fly-away, then the play view's next work */}
        <PictureBook cast={cast} touch={!playing} onFinish={playing ? () => done.current?.() : onFinish} away={setAway} />
      </div>
    );
  return (
    <div className={`${className} ${c.gameWrap} ${playing ? '' : c.live}`} style={style} data-testid="five-viewer" data-kind="game" data-cast={cast.key}>
      <TapGame cast={cast} touch={!playing} />
      {title}
    </div>
  );
}
