/**
 * Review mode (demo API): the member's {bati} (M-R215 / M-R217 / M-R218) kept on the stored Me — the personality by the
 * rules alone (no model), the card, three at most, swapping, 呼び方 / 一人称, the small egg. `obolo.demo.eggReady` = '1'
 * in localStorage makes the egg ready at once (to try the hatching without waiting 88 days).
 */
import { batiEggState, batiWishByRules, BATI_WISH_REFUSE, BATI_MAX, BATI_PERSONALITIES, batiPersonaByRules, batiSeedKind, batiSelf, isBatiRare, type BatiEggKind, type BatiSummary, type Me } from '@obolo/shared';
import { ApiError } from './types';

const uid = () => Math.random().toString(36).slice(2, 10);

function eggReadyNow() {
  try {
    return localStorage.getItem('obolo.demo.eggReady') === '1';
  } catch {
    return false;
  }
}

/**
 * the egg's state as Me shows it (M-R231: the 2nd on the app's day 9, the 3rd on day 16). Day 9 opens a day after day 8
 * (the review's day jumps count too); the review switch makes it ready at once.
 */
export function demoEggOf(u: Me, born = (u.batis ?? []).length): Me['batiEgg'] {
  const at = Date.parse(u.story?.['eggs.day9'] ?? '');
  const day9At = Number.isFinite(at) ? at : u.journeyDay >= 9 ? Date.parse(u.createdAt) : null;
  const e = batiEggState({ born, journeyDay: u.journeyDay, day9At });
  return e && eggReadyNow() ? { ...e, ready: true, growth: 1 } : e;
}
/** kept for the old callers: the state again */
export const demoEggView = (_e: Me['batiEgg'], u?: Me): Me['batiEgg'] => (u ? demoEggOf(u) : _e ?? null);

/** the active {bati} written back into the list */
function synced(u: Me): BatiSummary[] {
  const list = u.batis ?? [];
  const b = u.bati;
  if (!b?.id) return list;
  return list.map((r) => (r.id === b.id ? { ...r, name: b.name, imageUrl: b.imageUrl, faces: b.faces, card: { ...r.card, name: b.name, imageUrl: b.imageUrl } } : r));
}

function born(seed: string, egg: BatiEggKind, nth: number, exclude: BatiSummary['personality'][] = []): { summary: BatiSummary; view: NonNullable<Me['bati']> } {
  // M-R227: never the same style as the member's other {bati}; M-R230: the first from the bright group, the third from a wish
  const wish = batiSeedKind(nth) === 'wish';
  const w = wish ? batiWishByRules(seed, egg, { exclude }) : null;
  if (wish && !w) throw new ApiError(422, 'WISH_REFUSED', BATI_WISH_REFUSE);
  const p = w ?? { ...batiPersonaByRules(seed, egg, Math.random(), { exclude, first: nth === 0 }), role: undefined, custom: null };
  const id = uid();
  const createdAt = new Date().toISOString();
  const custom = p.custom ?? undefined;
  const card = {
    name: null,
    bornAt: createdAt,
    egg,
    seed,
    personality: p.personality,
    label: custom?.label ?? BATI_PERSONALITIES[p.personality].label,
    catchphrase: p.catchphrase,
    trait: p.trait,
    intro: p.intro,
    rare: !custom && isBatiRare(p.personality),
    ...(wish ? { wish: true } : {}),
    imageUrl: null,
  };
  const role = (p.role ?? undefined) as BatiRole | undefined;
  const summary: BatiSummary = { id, name: null, egg, personality: p.personality, imageUrl: null, active: true, self: p.self, call: p.call, selfCustom: null, callCustom: null, card, createdAt, ...(role ? { role } : {}) };
  return { summary, view: { food: seed, name: null, imageUrl: null, id, egg, personality: p.personality, self: p.self, call: p.call, selfCustom: null, callCustom: null, card, ...(role ? { role } : {}), ...(custom ? { custom } : {}) } };
}

/** day 2: the first {bati} (again) */
export function demoBatiEgg(u: Me, food: string, egg: BatiEggKind): Partial<Me> {
  if (/死ね|殺す|うざい/.test(food)) throw new ApiError(422, 'SEED_REASK', '、、、食べられるものを、言ってみろ。');
  const list = synced(u);
  const keep = list.length > 1 ? list.filter((r) => r.id !== u.bati?.id).map((r) => ({ ...r, active: false })) : [];
  const { summary, view } = born(food, egg, 0, keep.map((r) => r.personality));
  return { bati: view, batis: [...keep, summary], batiEgg: demoEggOf(u, keep.length + 1) };
}

/** the picture / the name landed on the active one: the list and the card follow */
export function demoBatiSync(u: Me): Partial<Me> {
  if (!u.bati?.card) return {};
  return { bati: { ...u.bati, card: { ...u.bati.card, name: u.bati.name, imageUrl: u.bati.imageUrl } }, batis: synced(u) };
}

/** the Moon temple: the grown egg hatches */
export function demoBatiNew(u: Me, egg: BatiEggKind, seed: string): Partial<Me> {
  const list = synced(u);
  if (!list.length) throw new ApiError(409, 'NO_BATI', 'Not hatched yet');
  if (list.length >= BATI_MAX) throw new ApiError(409, 'BATI_FULL', '相方は、3体まで');
  if (!demoEggOf(u, list.length)?.ready) throw new ApiError(409, 'EGG_NOT_READY', 'たまごは、まだ育っている');
  const { summary, view } = born(seed, egg, list.length, list.map((r) => r.personality));
  return {
    bati: view,
    batis: [...list.map((r) => ({ ...r, active: false })), summary],
    batiEgg: demoEggOf(u, list.length + 1),
  };
}

export function demoBatiSwitch(u: Me, id: string): Partial<Me> {
  const list = synced(u);
  const to = list.find((r) => r.id === id);
  if (!to) throw new ApiError(404, 'NOT_FOUND', 'No such bati');
  if (!to.imageUrl || !to.name) throw new ApiError(409, 'NOT_BORN', 'Not hatched yet');
  return {
    batis: list.map((r) => ({ ...r, active: r.id === id })),
    bati: { food: to.card.seed, name: to.name, imageUrl: to.imageUrl, faces: to.faces, id: to.id, egg: to.egg, personality: to.personality, self: to.self, call: to.call, selfCustom: to.selfCustom, callCustom: to.callCustom, card: to.card },
  };
}

export function demoBatiSpeech(u: Me, body: { id?: string; call?: string | null; self?: string | null }): Partial<Me> {
  const id = body.id ?? u.bati?.id;
  const list = synced(u).map((r) => {
    if (r.id !== id) return r;
    const selfCustom = body.self !== undefined ? body.self?.trim() || null : r.selfCustom;
    const callCustom = body.call !== undefined ? body.call?.trim() || null : r.callCustom;
    return { ...r, selfCustom, callCustom, self: batiSelf(r.personality, r.egg, selfCustom, r.self) };
  });
  const r = list.find((x) => x.id === id);
  if (!r) throw new ApiError(404, 'NOT_FOUND', 'No such bati');
  return { batis: list, ...(u.bati?.id === id ? { bati: { ...u.bati!, selfCustom: r.selfCustom, callCustom: r.callCustom, self: r.self } } : {}) };
}

// --- M-R222: what {bati} remembers (review mode: the same cap and refusals as the server, on the stored Me)
import { MEMORY_LINES, MEMORY_PER_BATI, memoryRefusal, tidyMemory, type BatiRole } from '@obolo/shared';

export function demoBatiMemory(u: Me, text: string): Partial<Me> {
  if (!u.bati) throw new ApiError(409, 'NO_BATI', 'Not hatched yet');
  const t = tidyMemory(text);
  if (memoryRefusal(t, { birthYear: u.birthYear ?? null })) throw new ApiError(422, 'MEMORY_REFUSED', MEMORY_LINES.refuse);
  const on = u.bati.memories ?? [];
  if (on.some((p) => p.text === t)) throw new ApiError(409, 'MEMORY_ALREADY', 'それ、もう、覚えてるよ！');
  if (on.length >= MEMORY_PER_BATI) throw new ApiError(409, 'MEMORY_FULL', MEMORY_LINES.full);
  return { bati: { ...u.bati, memories: [...on, { id: uid(), text: t, at: new Date().toISOString() }] } };
}

export function demoBatiForget(u: Me, memory?: string): Partial<Me> {
  if (!u.bati) return {};
  return { bati: { ...u.bati, memories: memory ? (u.bati.memories ?? []).filter((p) => p.id !== memory) : [] } };
}

export function demoBatiRole(u: Me, role: BatiRole): Partial<Me> {
  if (!u.bati) return {};
  return { bati: { ...u.bati, role }, batis: (u.batis ?? []).map((b) => (b.id === u.bati?.id ? { ...b, role } : b)) };
}
