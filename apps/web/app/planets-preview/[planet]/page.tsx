'use client';

import { figureFor, isHomePlanet, type HomePlanet, type Me, type PlanetHomeView } from '@obolo/shared';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { PlanetTemplateHome, type TemplateMe } from '@/components/planetTemplate/PlanetTemplateHome';
import { planetHooks } from '@/components/planetTemplate/planetHooks';
import { getApi } from '@/lib/api';
import { ownFigure } from '@/lib/planetTemplate/people';
import { SAMPLE_OWN_FIGURE, templateSample } from '@/lib/planetTemplate/sample';
import { samplePast } from '@/lib/planetTemplate/saturn';
import { apiSky, sampleSky, songOf } from '@/lib/planetTemplate/sky';
import { viewsOf } from '@/lib/story/views';

/** the sample's you, dancing out of your house on Mercury's ▶ (the prototype's picture) */
const SAMPLE_DANCE = '/planets/sample/dance-user.webp';

/** Saturn: the chibi out of your kororin (figureFor's chibi, else your chibi picture; the sample: the prototype's) */
const chibiOf = (me: Me | null, sample: boolean) => figureFor(me?.planetFigures, 'saturn').url ?? me?.chibiPic ?? (sample ? '/planets/sample/chibi-user.webp' : null);

/** your back in the view from your place: your look's own (GET /me lookBack), else the talk's stand-in */
const backOf = (me: Me | null) => me?.lookBack ?? viewsOf('talk-user')?.back ?? '/planets/back.webp';

/**
 * /planets-preview/<planet> — the new common planet home (handoff 01 3章) with real data, for the story session to
 * compare with the prototype. Not linked from the app; the live planet screens stay as they are until each planet is
 * switched over. The feed is GET /planet-home/<planet> and you are GET /me; with nobody signed in, no API (the in-browser
 * demo) or no ダチ works yet, it shows the sample cast (?sample=1 forces it).
 */
function Preview() {
  const params = useParams<{ planet: string }>();
  const q = useSearchParams();
  const router = useRouter();
  const planet: HomePlanet = isHomePlanet(params.planet ?? '') ? (params.planet as HomePlanet) : 'jupiter';
  const forced = q.get('sample') === '1';
  const [data, setData] = useState<{ view: PlanetHomeView; me: TemplateMe; sample: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    const sample = (me: Me | null) => ({
      view: templateSample(planet),
      me: { name: me?.displayName || 'ミナト★', figure: ownFigure(me?.planetFigures, planet) ?? SAMPLE_OWN_FIGURE(planet), back: backOf(me), dance: me?.chibiPic ?? SAMPLE_DANCE, chibi: chibiOf(me, true) },
      sample: true,
    });
    (async () => {
      const api = getApi();
      const me = await api.me().catch(() => null);
      if (forced) return sample(me);
      const view = await api.planetHome(planet).catch(() => null);
      if (!view || !view.live || !view.around.length) return sample(me);
      return { view, me: { name: me?.displayName || view.owner.name, figure: ownFigure(me?.planetFigures, planet), back: backOf(me), dance: me?.chibiPic ?? null, chibi: chibiOf(me, false) }, sample: false };
    })().then((d) => live && setData(d));
    return () => {
      live = false;
    };
  }, [planet, forced]);

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
        ? async (p) => samplePast(p)
        : async (p) => {
            const v = await api.planetPerson(planet, p.id).catch(() => null);
            return v?.works.length ? v.works : p.works;
          },
    });
  }, [data, planet]);

  return (
    <main className="relative h-svh w-full overflow-hidden bg-[#04050d]" data-sample={data?.sample ? '1' : '0'}>
      {data && (
        <PlanetTemplateHome
          key={planet}
          planet={planet}
          view={data.view}
          me={data.me}
          hooks={hooks}
          onSwitchPlanet={(p) => router.replace(`/planets-preview/${p}${forced ? '?sample=1' : ''}`)}
        />
      )}
    </main>
  );
}

export default function PlanetsPreviewPage() {
  return (
    <Suspense fallback={<main className="h-svh bg-[#04050d]" />}>
      <Preview />
    </Suspense>
  );
}
