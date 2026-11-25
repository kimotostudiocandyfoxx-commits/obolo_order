import { figureFor, PLANET_HOMES, type HomePlanet, type HomeRel, type HomeWork, type PlanetFigures, type PlanetHomeView } from '@obolo/shared';

/** one ダチ・推し on the home: their riding figure on this planet and the works they flew here (newest first) */
export interface HomePerson {
  id: string;
  name: string;
  rel: HomeRel;
  /** their figure on this planet (figureFor: Saturn the kororin ball, Jupiter the butterfly, Mercury the ship …) */
  figure: string | null;
  /** no figure painted yet: the planet's sprite with their face on it */
  sprite: string;
  face: string | null;
  works: HomeWork[];
}

/** a maker's riding figure on `planet`, as the feed carries it (author.figure / author.ball = figureFor on the server) */
export function figureOfAuthor(a: HomeWork['author'], planet: HomePlanet): string | null {
  return planet === 'saturn' ? (a.ball ?? a.figure ?? null) : (a.figure ?? null);
}

/** your own riding figure (GET /me planetFigures, figureFor) */
export function ownFigure(figures: PlanetFigures | null | undefined, planet: HomePlanet): string | null {
  const f = figureFor(figures, planet);
  return (planet === 'saturn' ? (f.ball ?? f.url) : f.url) ?? null;
}

/** the people of a home: everyone with a work around you (dachi and 推し), the newest arrival first; one figure each */
export function peopleOf(view: PlanetHomeView | null | undefined): HomePerson[] {
  if (!view) return [];
  const planet = view.planet;
  const by = new Map<string, HomePerson>();
  const works = [...view.around].sort((a, b) => b.flownAt.localeCompare(a.flownAt));
  for (const w of works) {
    let p = by.get(w.author.id);
    if (!p) {
      p = { id: w.author.id, name: w.author.name, rel: w.rel, figure: figureOfAuthor(w.author, planet), sprite: PLANET_HOMES[planet].art.sprite, face: w.author.pic ?? null, works: [] };
      by.set(w.author.id, p);
    }
    p.works.push(w);
  }
  return [...by.values()];
}
