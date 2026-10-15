import { z } from 'zod';

/**
 * Uranus: your atelier (client decision 2026-10-15). A room of your own where you put up what you made —
 * stickers, records (songs), MV screens, kororins, your NEO portrait, your Bati — among decorations, on the
 * wallpaper and floor you like. Opens on the second journey (from ORDER). The OBOLO商店 in the middle of
 * Uranus (buying, and selling your own goods by application) is the third journey.
 *
 * A placed piece keeps a copy of what it shows (picture / words / title), so the room still shows it even
 * when the original is gone. Positions are fractions of the room (0..1, the piece's centre).
 */
export const ATELIER_MAX_ITEMS = 40;

export const ATELIER_KINDS = ['deco', 'sticker', 'song', 'mv', 'kororin', 'look', 'bati'] as const;
export type AtelierKind = (typeof ATELIER_KINDS)[number];

/** our own files only: a path on this site or an https URL */
const Src = z
  .string()
  .max(600)
  .refine((u) => u.startsWith('/') || u.startsWith('https://'), 'url');

export const AtelierItem = z.object({
  id: z.string().min(1).max(40),
  kind: z.enum(ATELIER_KINDS),
  /** deco: the decoration's id; others: the original's id when there is one */
  ref: z.string().max(80).default(''),
  url: Src.nullable().default(null),
  poster: Src.nullable().default(null),
  text: z.string().max(80).default(''),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  /** width as a fraction of the room's width */
  size: z.number().min(0.06).max(0.9),
  rot: z.number().min(-180).max(180).default(0),
  flip: z.boolean().default(false),
});
export type AtelierItem = z.infer<typeof AtelierItem>;

export const AtelierLayout = z.object({
  wall: z.string().max(30).default('cream'),
  floor: z.string().max(30).default('wood'),
  /** back to front */
  items: z.array(AtelierItem).max(ATELIER_MAX_ITEMS).default([]),
});
export type AtelierLayout = z.infer<typeof AtelierLayout>;

export const EMPTY_ATELIER: AtelierLayout = { wall: 'cream', floor: 'wood', items: [] };
