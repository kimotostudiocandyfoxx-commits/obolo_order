/**
 * The member's {bati} (M-R215 / M-R217 / M-R218): three at most, one in the chat at a time. Kept as a list on the user
 * (users.batis_json); the legacy columns (batiFood, batiName, batiImageUrl, onboardingJson 'bati.faces' / 'bati.stand')
 * stay the live copy of the one in the chat (users.bati_id), so the painting, the faces, the restyle and the chat work
 * as before. A swap writes the live copy back into its record and loads the other one.
 *
 * Shared by all of them: the name list, the made works and the conversation memory (buddy_messages and the memory
 * summary are per member, not per {bati}).
 */
import {
  BATI_PERSONALITIES,
  batiDefaultCall,
  batiPersonalityFromSeed,
  batiSelf,
  isBatiPersonality,
  normalizeBatiPersonality,
  isBatiRare,
  type BatiCard,
  type BatiEggKind,
  type BatiPersonality,
  type BatiRole,
  type BatiSeedKind,
  type BatiMemory,
  type BatiCustomStyle,
  type BatiSummary,
  type BatiView,
} from '@obolo/shared';
import type { users } from '../db/schema';

type User = typeof users.$inferSelect;

export interface BatiRecord {
  id: string;
  name: string | null;
  egg: BatiEggKind;
  /** the seed as answered (the first: the favourite food — only the birth's seed, not kept as a personality) */
  seed: string;
  seedKind: BatiSeedKind;
  personality: BatiPersonality;
  /** the birth's 一人称 / 呼び方 (a template, {neo} = the name) / 口ぐせ / introduction (M-R217) */
  self: string;
  call: string;
  catchphrase: string;
  /** M-R225: the card's 性格 (one word; never in the speech) */
  trait?: string;
  intro: string;
  /** the member's own 一人称 / 呼び方 (the only things that change) */
  selfCustom?: string | null;
  callCustom?: string | null;
  /** the look now, and the picture it was born with (passed with every painting so it does not drift) */
  imageUrl: string | null;
  bornImageUrl?: string | null;
  faces?: Record<string, string>;
  /**
   * M-R223: the looks decided so far, oldest first, each with its expressions once drawn (〔前に戻す〕 and Bluena's first
   * shelf put one back without painting again). Kept inside batis_json (no migration).
   */
  looks?: BatiLook[];
  /** a rare personality's fixed story lines, rewritten at birth (line as written → its line) */
  lines?: Record<string, string>;
  createdAt: string;
  /** M-R230: 「ねがいの子」 (the third, from a wish), and a style made for it when none of the seventeen fitted */
  wish?: boolean;
  custom?: BatiCustomStyle;
  /** M-R222: 「覚えてること」 — what the member asked it to remember (five at most), and its role */
  memories?: BatiMemory[];
  role?: BatiRole;
  /**
   * LATER (M-R217 「遊びに行かせる」, docs/placeholders.md P-BATI-VISIT): sent to a dachi's chat for one day. Only the
   * data hook: the memory stays with the owner and nothing of the dachi's talk is brought back.
   */
  visit?: { dachiId: string; until: string } | null;
}

export interface BatiLook {
  url: string;
  faces?: Record<string, string>;
  at: string;
}

/** M-R223: the looks with the one worn now noted (its faces as they are now); a new one goes at the end */
export function keepLook(looks: BatiLook[] | undefined, url: string | null | undefined, faces?: Record<string, string>, max = 12): BatiLook[] {
  const list = [...(looks ?? [])];
  if (!url) return list;
  const at = list.findIndex((l) => l.url === url);
  const f = faces && Object.keys(faces).length ? { faces } : {};
  if (at >= 0) list[at] = { ...list[at], ...f };
  else list.push({ url, ...f, at: new Date().toISOString() });
  return list.slice(-max);
}

/** the looks of a {bati} as urls, oldest first: the birth's first when it is not kept yet, the one worn now last if missing */
export function lookUrls(r: BatiRecord): string[] {
  const urls = (r.looks ?? []).map((l) => l.url);
  if (r.bornImageUrl && !urls.includes(r.bornImageUrl)) urls.unshift(r.bornImageUrl);
  if (r.imageUrl && !urls.includes(r.imageUrl)) urls.push(r.imageUrl);
  return urls;
}

function faces(j: Record<string, string> | null): Record<string, string> | undefined {
  try {
    return j?.['bati.faces'] ? (JSON.parse(j['bati.faces']) as Record<string, string>) : undefined;
  } catch {
    return undefined;
  }
}

/** the egg chosen on day 2, for a {bati} born before the list existed (the old 地球と月 egg is the moon egg now) */
function legacyEgg(u: User): BatiEggKind {
  const j = (u.onboardingJson ?? {}) as Record<string, string>;
  if (j['d2.f_egg'] === 'moon' || j['d2.f_egg'] === 'sun') return j['d2.f_egg'];
  return /太陽/.test(j['d2.egg'] ?? '太陽') ? 'sun' : 'moon';
}

/** a record from the legacy columns (a {bati} born before M-R215: its personality is a stable draw, never changing) */
function legacyRecord(u: User): BatiRecord {
  const egg = legacyEgg(u);
  const personality = batiPersonalityFromSeed(`${u.id}:${u.batiFood ?? ''}`);
  const d = BATI_PERSONALITIES[personality];
  return {
    id: u.batiId ?? 'b1',
    name: u.batiName,
    egg,
    seed: u.batiFood ?? '',
    seedKind: 'food',
    personality,
    self: d.self[egg],
    call: batiDefaultCall(personality),
    catchphrase: d.catchphrase,
    intro: `${u.batiFood ?? ''}の香りの光から生まれた。`,
    imageUrl: u.batiImageUrl,
    bornImageUrl: u.batiImageUrl,
    createdAt: u.createdAt.toISOString(),
  };
}

/** the live copy (the legacy columns) written over the active record */
function live(u: User, r: BatiRecord): BatiRecord {
  return { ...r, name: u.batiName, seed: u.batiFood ?? r.seed, imageUrl: u.batiImageUrl, faces: faces(u.onboardingJson as Record<string, string> | null) };
}

/** every {bati}, the active one as it is now (an account from before the list: its one {bati}) */
export function batiList(u: User): BatiRecord[] {
  // M-R225: a style retired since is read as the nearest current one (敬語の子 → ていねいな子 …)
  const list = (u.batisJson ?? []).filter((r) => r && typeof r.id === 'string').map((r) => (isBatiPersonality(r.personality) ? r : { ...r, personality: normalizeBatiPersonality(r.personality) }));
  if (!u.batiFood) return list.filter((r) => r.id !== u.batiId);
  const at = list.findIndex((r) => r.id === u.batiId);
  if (at < 0) return [...list, live(u, legacyRecord(u))];
  return list.map((r, k) => (k === at ? live(u, r) : r));
}

export function activeBati(u: User): BatiRecord | null {
  if (!u.batiFood) return null;
  return batiList(u).find((r) => r.id === (u.batiId ?? 'b1')) ?? null;
}

export function batiCard(r: BatiRecord): BatiCard {
  return {
    name: r.name,
    bornAt: r.createdAt,
    egg: r.egg,
    seed: r.seed,
    personality: r.personality,
    label: r.custom?.label ?? BATI_PERSONALITIES[r.personality].label,
    catchphrase: r.catchphrase,
    ...(r.trait ? { trait: r.trait } : {}),
    intro: r.intro,
    rare: !r.custom && isBatiRare(r.personality),
    ...(r.wish ? { wish: true } : {}),
    imageUrl: r.imageUrl,
  };
}

/** the active {bati}'s extra fields for Me.bati */
export function batiViewExtra(r: BatiRecord): Partial<BatiView> {
  return {
    memories: r.memories ?? [],
    ...(r.custom ? { custom: r.custom } : {}),
    role: r.role ?? 'any',
    id: r.id,
    egg: r.egg,
    personality: r.personality,
    self: batiSelf(r.personality, r.egg, r.selfCustom, r.self),
    selfCustom: r.selfCustom ?? null,
    callCustom: r.callCustom ?? null,
    call: r.call,
    card: batiCard(r),
    ...(r.lines && Object.keys(r.lines).length ? { lines: r.lines } : {}),
    looks: lookUrls(r),
    seedKind: r.seedKind,
  };
}

export function batiSummaries(u: User): BatiSummary[] {
  const active = u.batiFood ? (u.batiId ?? 'b1') : null;
  return batiList(u).map((r) => ({
    id: r.id,
    name: r.name,
    egg: r.egg,
    personality: r.personality,
    imageUrl: r.imageUrl,
    ...(r.faces ? { faces: r.faces } : {}),
    active: r.id === active,
    self: batiSelf(r.personality, r.egg, r.selfCustom, r.self),
    call: r.call,
    selfCustom: r.selfCustom ?? null,
    callCustom: r.callCustom ?? null,
    card: batiCard(r),
    role: r.role ?? 'any',
    createdAt: r.createdAt,
  }));
}

/** the legacy columns for a record put into the chat */
export function columnsOf(u: User, r: BatiRecord) {
  const j = { ...((u.onboardingJson ?? {}) as Record<string, string>) };
  delete j['bati.stand'];
  if (r.faces && Object.keys(r.faces).length) j['bati.faces'] = JSON.stringify(r.faces);
  else delete j['bati.faces'];
  return { batiId: r.id, batiFood: r.seed || '…', batiName: r.name, batiImageUrl: r.imageUrl, onboardingJson: j };
}

/** M-R223: the member's own looks so far, oldest first (onboardingJson 'look.history'), each with its round icon */
export function lookHistory(j: Record<string, string> | null | undefined): { url: string; icon?: string }[] {
  try {
    const v = JSON.parse(j?.['look.history'] ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((h): h is { url: string; icon?: string } => !!h && typeof (h as { url?: unknown }).url === 'string') : [];
  } catch {
    return [];
  }
}
