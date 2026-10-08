import { z } from 'zod';

/**
 * Mars MV (client decision 2026-10-08): Bati turns one of your Mercury songs into a music video.
 * You pick the song, send videos / photos in the chat, Bati plans the edit (Gemini Flash-Lite),
 * gives the materials an anime look (ONNX Runtime), cuts them to the song and sends the MV back;
 * then asks whether to add the lyrics.
 */
export const MV_MAX_SECONDS = 180;
export const MV_MAX_MATERIALS = 8;

export type MvMaterial = { mediaId: string; kind: 'photo' | 'video'; url: string; posterUrl: string | null; seconds: number | null };

export type MvProjectView = {
  id: string;
  songId: string;
  songTitle: string;
  status: 'collecting' | 'rendering' | 'done' | 'failed';
  materials: MvMaterial[];
  /** the MV, and the same MV with the lyrics on it */
  videoUrl: string | null;
  lyricsVideoUrl: string | null;
  posterUrl: string | null;
  /** the song has lyric lines to put on */
  hasLyrics: boolean;
  /** Bati's word about the edit */
  note: string | null;
  /** the MV kept in your 裏スタジオ (to publish it) */
  backstageId: string | null;
  seconds: number | null;
};

export const CreateMvBody = z.object({ songId: z.string().uuid() });
export type CreateMvBody = z.infer<typeof CreateMvBody>;

export const AddMvMaterialBody = z.object({ mediaId: z.string().uuid(), kind: z.enum(['photo', 'video']) });
export type AddMvMaterialBody = z.infer<typeof AddMvMaterialBody>;
