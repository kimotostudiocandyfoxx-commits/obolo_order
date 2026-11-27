import { z } from 'zod';

/**
 * A mic failure reported by the web app (client 2026-11-27, phones: 「マイクが反応しないことが多い」), so the operator can
 * see what fails in production: POST /diag/mic. No personal data — the place, the fault, the browser FAMILY (never the
 * user agent), and the browser's error name. No words, no ids, never audio. docs/mic.md.
 */
const word = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .regex(/^[A-Za-z0-9_./;=+-]+$/);

export const MIC_DIAG_PATHS = ['bati', 'atelier', 'dachi', 'dachi-voice', 'story', 'kororin', 'egg', 'compose', 'check', 'other'] as const;
export const MIC_DIAG_OS = ['ios', 'android', 'other'] as const;

export const MicDiagBody = z.object({
  path: z.enum(MIC_DIAG_PATHS),
  /** denied / no-device / busy / unsupported / silent / stt / network / failed / fallback */
  fault: word(24),
  engine: z.enum(['speech', 'record', 'stream']),
  /** the browser's error name or the recogniser's code (NotAllowedError, service-not-allowed …) */
  name: word(40).optional(),
  os: z.enum(MIC_DIAG_OS),
  browser: word(16),
  inApp: z.boolean(),
  standalone: z.boolean(),
  /** the recording's container (audio/mp4 …) */
  mime: word(40).optional(),
});
export type MicDiagBody = z.infer<typeof MicDiagBody>;

/** what the operator reads back (GET /admin/diag/mic) */
export type MicDiagEntry = MicDiagBody & { at: string };
export type MicDiagView = {
  /** the newest first, at most MIC_DIAG_KEEP */
  recent: MicDiagEntry[];
  /** today's and yesterday's counts (Asia/Tokyo days) by "os/browser fault" */
  days: { day: string; counts: Record<string, number> }[];
};
export const MIC_DIAG_KEEP = 200;
