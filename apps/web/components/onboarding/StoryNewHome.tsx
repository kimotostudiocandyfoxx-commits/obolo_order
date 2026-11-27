'use client';

import { demoGame, spellFrom, type GameView, type HomePlanet, type HomeWork, type Me } from '@obolo/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PlanetTemplateHome, type HomeEvent, type TemplateMe } from '@/components/planetTemplate/PlanetTemplateHome';
import { planetHooks } from '@/components/planetTemplate/planetHooks';
import type { Work as AtelierWork } from '@/components/atelier/work';
import { getApi } from '@/lib/api';
import { ownFigure } from '@/lib/planetTemplate/people';
import { SAMPLE_OWN_FIGURE } from '@/lib/planetTemplate/sample';
import { samplePast } from '@/lib/planetTemplate/saturn';
import { sampleSky, songOf } from '@/lib/planetTemplate/sky';
import { storyHome, type StoryCastInput, type StoryPlace, type StoryPlanet } from '@/lib/planetTemplate/storyCast';
import { viewsOf } from '@/lib/story/views';

const KIND: Record<StoryPlanet, AtelierWork['kind']> = { saturn: 'voice', jupiter: 'art', mercury: 'song', mars: 'video', venus: 'radio' };

/** {neo}'s own work of this morning (made in the day's atelier step) for their place: its words, title and picture */
export function storyOwnWork(planet: StoryPlanet, works: readonly AtelierWork[], kororinWords?: string): StoryCastInput['own'] {
  const w = [...works].reverse().find((x) => x.kind === KIND[planet] && x.status === 'ready');
  const image = w?.image ?? w?.poster ?? null;
  return { text: planet === 'saturn' ? (kororinWords ?? w?.text) : undefined, title: w?.title, image: image && /^(https?:|\/|data:|blob:)/.test(image) ? image : null };
}

const sampleGame = async (w: HomeWork): Promise<GameView> => {
  const tags = spellFrom('game', w.title ?? '');
  const g = demoGame(tags);
  const at = new Date().toISOString();
  return { id: w.id, title: w.title || g.title, howTo: g.howTo, tags, version: 0, code: g.code, home: 'neptune', createdAt: at, updatedAt: at };
};

/**
 * Story days 3–7 on the NEW planet homes (story session M-R330; shown only when the planet's switch is on): the
 * planet's common home full screen with the people the script names (lib/planetTemplate/storyCast) — nothing is loaded
 * from the feed and nothing is written; the sky is the sample's (two fingers pinch up to it, a place is landed on, ♡).
 *  - `until: 'next'`: touch what came around (tap opens, drag throws, ▶ at the top right); 〔次へ〕 goes on.
 *  - `until: 'door'`: the script's 「扉をタップする」 — 〔次へ〕 appears once {neo}'s own place was opened.
 * {neo} is the visitor: their own figure on the planet when they have one (GET /me), else the sample's.
 */
export function StoryNewHome({
  planet,
  place,
  until,
  neo,
  inviter,
  sent,
  own,
  onDone,
}: {
  planet: StoryPlanet;
  place: StoryPlace;
  until: 'next' | 'door';
  neo: string;
  inviter?: string;
  sent: boolean;
  own?: StoryCastInput['own'];
  onDone: () => void;
}) {
  const view = useMemo(() => storyHome(planet, place, { neo, inviter, sent, own }), [planet, place, neo, inviter, sent, own?.text, own?.title, own?.image]); // eslint-disable-line react-hooks/exhaustive-deps
  const [who, setWho] = useState<Me | null>(null);
  useEffect(() => {
    let live = true;
    getApi()
      .me()
      .then((m) => live && setWho(m))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  const p = planet as HomePlanet;
  const me = useMemo<TemplateMe>(() => {
    // the resident's place: no figure of {neo}'s there (the place's own picture stands); {neo}'s place: their figure
    const mine = place === 'neo';
    return {
      name: view.owner.name,
      figure: mine ? (ownFigure(who?.planetFigures, p) ?? SAMPLE_OWN_FIGURE(p)) : SAMPLE_OWN_FIGURE(p),
      back: who?.lookBack ?? viewsOf('talk-user')?.back ?? '/planets/back.webp',
      dance: who?.chibiPic ?? '/planets/sample/dance-user.webp',
      chibi: who?.chibiPic ?? '/planets/sample/chibi-user.webp',
    };
  }, [view.owner.name, who, p, place]);
  const hooks = useMemo(() => planetHooks(p, { load: (w) => songOf(null, w), sky: sampleSky(p), me, past: async (x) => (x.works.length ? x.works : samplePast(x)), game: sampleGame }), [p, me]);

  const [door, setDoor] = useState(false);
  const done = useRef(false);
  const go = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };
  const onEvent = (e: HomeEvent, id?: string) => {
    if (e === 'profile' && id === view.owner.id) setDoor(true);
  };
  const ready = until === 'next' || door;
  return (
    <div className="absolute inset-0 z-[40] overflow-hidden bg-[#04050d]" data-testid={`story-new-home-${planet}-${place}`} data-planet-home="new">
      <PlanetTemplateHome key={`${planet}-${place}`} planet={p} view={view} me={me} hooks={hooks} onEvent={onEvent} />
      {ready ? (
        <button onClick={go} data-testid="story-home-next" className="pb-safe absolute bottom-4 left-1/2 z-[200] -translate-x-1/2 rounded-full bg-white/90 px-6 py-2 text-sm font-black text-[#2a1630] shadow">
          次へ
        </button>
      ) : (
        <div className="pb-safe pointer-events-none absolute bottom-4 left-1/2 z-[200] -translate-x-1/2 whitespace-nowrap rounded-full bg-black/55 px-4 py-1.5 text-xs font-bold text-white" data-testid="story-home-hint">
          {view.owner.name}の場所をタップ
        </div>
      )}
    </div>
  );
}
