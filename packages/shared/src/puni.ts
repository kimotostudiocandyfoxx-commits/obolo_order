import { z } from 'zod';

/**
 * ぷにぷに look (client decision 2026-10-07): a member's round character is drawn in code from
 * these part ids (apps/web/lib/puni/parts.tsx). Stored on the user and shown to everyone
 * (Saturn world, replies, profile). Ids only — no images.
 */
export const PUNI_PARTS = {
  shape: ['round', 'tall', 'chunky'],
  tex: ['none', 'rice', 'fur', 'scales', 'salmon', 'sesame'],
  face: ['normal', 'gorilla', 'croc', 'hippo'],
  eyes: ['sparkle', 'glow'],
  mouth: ['smile', 'roar', 'cat', 'none'],
  hat: ['none', 'bucket', 'crown'],
  glasses: ['none', 'roundDark', 'roundYellow'],
  neck: ['none', 'goldChain', 'queenCollar'],
  wear: ['none', 'nori', 'suit', 'dress', 'shorts'],
  hands: ['none', 'peace', 'robot', 'fan', 'spray'],
  item: ['none', 'banana', 'star'],
  effect: ['sparkle', 'zap', 'puff', 'hearts'],
} as const;

export const PuniLook = z.object({
  shape: z.enum(PUNI_PARTS.shape),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  tex: z.enum(PUNI_PARTS.tex),
  face: z.enum(PUNI_PARTS.face),
  eyes: z.enum(PUNI_PARTS.eyes),
  mouth: z.enum(PUNI_PARTS.mouth),
  hat: z.enum(PUNI_PARTS.hat),
  glasses: z.enum(PUNI_PARTS.glasses),
  neck: z.enum(PUNI_PARTS.neck),
  wear: z.enum(PUNI_PARTS.wear),
  hands: z.enum(PUNI_PARTS.hands),
  item: z.enum(PUNI_PARTS.item),
  effect: z.enum(PUNI_PARTS.effect),
  /** text on the chain's medal */
  medal: z.string().trim().max(5).optional(),
});
export type PuniLook = z.infer<typeof PuniLook>;
