'use client';

import { demoGame, figureFor, spellFrom, type GameView, type HomePlanet, type HomeWork, type Me, type PlanetHomeView } from '@obolo/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { PlanetTemplateHome, type TemplateMe } from '@/components/planetTemplate/PlanetTemplateHome';
import { planetHooks } from '@/components/planetTemplate/planetHooks';
import { getApi } from '@/lib/api';
import { isCastPerson, rosterDayOfMember, withCast } from '@/lib/planetTemplate/castWorks';
import { ownFigure } from '@/lib/planetTemplate/people';
import { emptyHome, liveHomeShows, SAMPLE_OWN_FIGURE, templateSample } from '@/lib/planetTemplate/sample';
import { samplePast } from '@/lib/planetTemplate/saturn';
import { apiSky, sampleSky, songOf } from '@/lib/planetTemplate/sky';
import { viewsOf } from '@/lib/story/views';

/** the sample's you, dancing out of your house on Mercury's ▶ (the prototype's picture) */
const SAMPLE_DANCE = '/planets/sample/dance-user.webp';

/** Saturn: the chibi out of your kororin (figureFor's chibi, else your chibi picture; the sample: the prototype's) */
const chibiOf = (me: Me | null, sample: boolean) => figureFor(me?.planetFigures, 'saturn').url ?? me?.chibiPic ?? (sample ? '/planets/sample/chibi-user.webp' : null);

/** 05 Neptune's sample: PRESS START plays the Moon's demo game made from the work's title (nothing is fetched) */
const sampleGame = async (w: HomeWork): Promise<GameView> => {
  const tags = spellFrom('game', w.title ?? '');
  const g = demoGame(tags);
  const at = new Date().toISOString();
  return { id: w.id, title: w.title || g.title, howTo: g.howTo, tags, version: 0, code: g.code, home: 'neptune', createdAt: at, updatedAt: at };
};

/** your back in the view from your place: your look's own (GET /me lookBack), else the talk's stand-in */
const backOf = (me: Me | null) => me?.lookBack ?? viewsOf('talk-user')?.back ?? '/planets/back.webp';

/**
 * The new common planet home (handoff 01 3章) with real data: the feed is GET /planet-home/<planet> and you are GET /me;
 * with nobody signed in, no API (the in-browser demo) or no works yet, it shows the sample cast (`forced`: always).
 * Shown at /planets-preview/<planet>, and — M-R326, behind the switch in lib/planetHomes.ts, off by default — on the live
 * planet routes in place of the planet's screen of before. `hrefOf`: where the planet switcher goes.
 * `emptyAsSample` (story 2026-11-27): what a member with nothing flown and nobody around sees — the preview keeps the
 * sample cast (true, the default); a live planet route shows their own place with no visitors (false).
 */
export function LivePlanetHome({
  planet,
  forced = false,
  emptyAsSample = true,
  sampleDay,
  hrefOf,
  className = 'relative h-svh w-full overflow-hidden bg-[#04050d]',
}: {
  planet: HomePlanet;
  forced?: boolean;
  emptyAsSample?: boolean;
  /** M-R341: the sample cast as it is on this day of the first journey (3–10); none: all of the cast */
  sampleDay?: number;
  hrefOf: (p: HomePlanet) => string;
  className?: string;
}) {
  const router = useRouter();
  const [data, setData] = useState<{ view: PlanetHomeView; me: TemplateMe; sample: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    const sample = (me: Me | null) => ({
      view: templateSample(planet, Date.now(), sampleDay ? { day: sampleDay } : {}),
      me: { name: me?.displayName || 'ミナト★', figure: ownFigure(me?.planetFigures, planet) ?? SAMPLE_OWN_FIGURE(planet), back: backOf(me), dance: me?.chibiPic ?? SAMPLE_DANCE, chibi: chibiOf(me, true) },
      sample: true,
    });
    (async () => {
      const api = getApi();
      const me = await api.me().catch(() => null);
      if (forced) return sample(me);
      const view = await api.planetHome(planet).catch(() => null);
      // story 2026-11-25: your own flown works alone are real too (a member's first goods / books / games)
      const real = liveHomeShows(view, emptyAsSample);
      if (real === 'sample') return sample(me);
      // a live route with nothing to show yet (or the feed could not be read): the member's own place, nobody around
      // M-R341 / M-R344: the cast come to the member's real home too — KIMORIN⭐︎ (ダチ) and the oshi of the journey day
      // they have reached (after the journey: all eighteen), each with their one real work of this planet, after the
      // member's real ダチ・推し. Nobody signed in: nobody comes.
      const cast = (v: PlanetHomeView) => (me ? withCast(v, { day: rosterDayOfMember(me), ordered: !!me.orderedAt }) : v);
      if (real === 'empty' || !view) {
        const empty = emptyHome(planet, me?.id ?? 'me', me?.displayName ?? '');
        return { view: cast(view?.live ? view : empty), me: { name: me?.displayName || empty.owner.name, figure: ownFigure(me?.planetFigures, planet), back: backOf(me), dance: me?.chibiPic ?? null, chibi: chibiOf(me, false) }, sample: false };
      }
      return { view: cast(view), me: { name: me?.displayName || view.owner.name, figure: ownFigure(me?.planetFigures, planet), back: backOf(me), dance: me?.chibiPic ?? null, chibi: chibiOf(me, false) }, sample: false };
    })().then((d) => live && setData(d));
    return () => {
      live = false;
    };
  }, [planet, forced, sampleDay]);

  // the planet's own hooks (02 Mercury: its opener, the beach, the sky); the sample's songs and sky stay in the browser
  const hooks = useMemo(() => {
    if (!data) return undefined;
    const api = getApi();
    return planetHooks(planet, {
      load: data.sample ? (w) => songOf(null, w) : (w) => songOf(api, w),
      sky: data.sample ? sampleSky(planet) : apiSky(api, planet),
      me: data.me,
      // 04 §3: a person's past kororins (GET /planet-home/<planet>/person/:id; the sample: 18 of yours, 10–13 of a dachi)
      past: data.sample
        ? async (p) => (isCastPerson(p.id) ? p.works : samplePast(p))
        : async (p) => {
            // the cast are not members: their one kororin is what the home has
            if (isCastPerson(p.id)) return p.works;
            const v = await api.planetPerson(planet, p.id).catch(() => null);
            return v?.works.length ? v.works : p.works;
          },
      // 05 Neptune: PRESS START plays the flown game (GET /moon/games/:id: its maker, or whoever its home reaches)
      game: data.sample ? sampleGame : (w) => api.game(w.id).catch(() => null),
    });
  }, [data, planet]);

  return (
    <main className={className} data-planet-home="new" data-sample={data?.sample ? '1' : '0'}>
      {data && (
        <PlanetTemplateHome
          key={planet}
          planet={planet}
          view={data.view}
          me={data.me}
          hooks={hooks}
          onSwitchPlanet={(p) => router.replace(hrefOf(p))}
        />
      )}
    </main>
  );
}
