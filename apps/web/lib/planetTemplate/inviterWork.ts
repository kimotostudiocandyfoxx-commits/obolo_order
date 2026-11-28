import type { DachiView, HomePlanet, HomeWork, PlanetPersonView } from '@obolo/shared';

/**
 * Inside the story, {neo}'s own place shows the inviter's REAL work of that planet (story session 2026-11-28) — the
 * inviter is a real member and a ダチ from day 3 (D04-S005c). Their newest work flown to this planet is read with what
 * the app already has: the ダチ list (their id, by the name on the invitation) and GET /planet-home/<planet>/person/<id>
 * (a ダチ's works, newest first, without the 88 hours). Nothing found — nobody invited, not a ダチ yet, two ダチ of that
 * name, no work on this planet, the request failing — is null: the story then leaves the inviter's spot empty.
 */
export interface InviterApi {
  dachi(): Promise<DachiView[]>;
  planetPerson(planet: HomePlanet, id: string): Promise<PlanetPersonView>;
}

export const invitedBy = (name: string | null | undefined): string | null => {
  const n = (name ?? '').trim();
  return n && n !== '…' && n !== 'MIKIE⭐︎DRILL' ? n : null;
};

export async function inviterWorkOn(api: InviterApi, planet: HomePlanet, inviter: string | null | undefined): Promise<HomeWork | null> {
  const name = invitedBy(inviter);
  if (!name) return null;
  try {
    const same = (await api.dachi()).filter((d) => d.displayName === name);
    if (same.length !== 1) return null;
    const v = await api.planetPerson(planet, same[0].id);
    const w = v.works.find((x) => !x.demo);
    return w ? { ...w, rel: 'dachi' } : null;
  } catch {
    return null;
  }
}
