import { AsyncLocalStorage } from 'node:async_hooks';
import type { MakeKind, UsageFeature } from '@obolo/shared';

/**
 * Who a provider call is for, and what it is part of (client 2026-11-25, docs/マナの値段.md). Set once per request
 * (main.ts: the feature from the path; AuthGuard: the member) and per background job (the queue / JobsService); a
 * charge (LedgerService.charge) marks the scope as that paid making. The cost recorder reads it for every
 * reported cost: a paid making's costs are compared with its mana; every other cost is a small cost of a free feature.
 */
export interface CostCtx {
  userId?: string;
  /** what a free feature's cost is filed under (the usage row's ref_type) */
  feature: UsageFeature;
  /** the paid making this work belongs to */
  kind?: MakeKind;
  /** one making's id (the yes's ledger key, or the job id): its costs are added up per making for the p90 */
  job?: string;
  /** a ledger charge paid for it: its costs are not taken again as small costs */
  paid?: boolean;
}

const als = new AsyncLocalStorage<CostCtx>();

export const costScope = {
  /** run `fn` with its own scope (a nested run replaces the outer one) */
  run<T>(ctx: CostCtx, fn: () => T): T {
    return als.run({ ...ctx }, fn);
  },
  get(): CostCtx | undefined {
    return als.getStore();
  },
  /** add to the current scope (no scope: nothing) */
  tag(p: Partial<CostCtx>): void {
    const s = als.getStore();
    if (s) Object.assign(s, p);
  },
};

/** what a request path's free costs are filed under */
export function featureOfPath(path: string): UsageFeature {
  const p = path.toLowerCase().split('?')[0];
  const rules: [RegExp, UsageFeature][] = [
    [/^\/(buddy|moon)\/compass/, 'compass'],
    [/^\/moon\/spell/, 'spell'],
    [/^\/moon\/lyrics/, 'lyrics'],
    // story 2026-11-25: a picture's title is booked as a song's name is (it comes with the lyrics)
    [/^\/moon\/art-title/, 'lyrics'],
    [/^\/moon\/novel/, 'novel'],
    [/^\/buddy\/picture/, 'draw'],
    [/^\/buddy\/story/, 'story'],
    [/^\/buddy\//, 'chat'],
    [/^\/voice\/(transcribe|dictate)/, 'listen'],
    [/^\/voice\//, 'voice'],
    [/^\/compose\//, 'songEdit'],
    [/^\/mars\//, 'videoEdit'],
    [/^\/links\/unfurl/, 'unfurl'],
    // R18: the ダチ talk (moderation, KIMORIN⭐︎'s answers): never charged — an unrecovered marketing cost
    [/^\/dachi\//, 'dachi'],
    [/^\/me\/(look|puni|butterfly|sticker|bati)/, 'look'],
  ];
  return rules.find(([re]) => re.test(p))?.[1] ?? 'other';
}

/** what a queued job's free costs are filed under */
export function featureOfJob(name: string): UsageFeature {
  if (name === 'buddy.summarize') return 'memory';
  if (name === 'voice.line' || name === 'voice.bati') return 'voice';
  // client 2026-11-25: a song title read in its maker's voice — a paid song's job tags it as that making
  // (SongTitleVoiceService.make); the rest (a free song, another post title, the backfill) is absorbed
  if (name === 'song.title') return 'titleVoice';
  // client 2026-11-25: the planet figures nobody can pay for any more (the admin backfill of looks confirmed before the
  // first look was charged) are absorbed (ABSORBED_FEATURES); the first look and every profile look change tag their job
  // as that profileLook making (PlanetFiguresService.make); so do the talk's pictures (LookService.talkLook)
  if (name === 'look.figures' || name === 'look.chibi') return 'figures';
  if (name.startsWith('bati.') || name === 'talk.look') return 'look';
  return 'other';
}

/** a queue handler run in its own scope (the member from the payload, the feature from the job's name) */
export function scopedHandler<P>(name: string, handler: (payload: P) => Promise<void>): (payload: P) => Promise<void> {
  return (payload: P) => {
    const userId = (payload as { userId?: unknown } | null)?.userId;
    return costScope.run({ feature: featureOfJob(name), ...(typeof userId === 'string' ? { userId } : {}) }, () => handler(payload));
  };
}
