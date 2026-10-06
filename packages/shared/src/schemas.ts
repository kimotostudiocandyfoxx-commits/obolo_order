import { z } from 'zod';
import { LOCALES, SATURN_MAX_CHARS } from './config';
import { NEO_FORM_IDS } from './neo';
import { VOICE_STYLE_IDS } from './neoVoice';

export const RequestCodeBody = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});
export type RequestCodeBody = z.infer<typeof RequestCodeBody>;

export const VerifyCodeBody = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  code: z.string().trim().regex(/^\d{6}$/),
});
export type VerifyCodeBody = z.infer<typeof VerifyCodeBody>;

export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

export const UpdateProfileBody = z.object({
  displayName: z.string().trim().min(1).max(40).optional(),
  handle: z.string().trim().toLowerCase().regex(HANDLE_RE).optional(),
  bio: z.string().trim().max(160).optional(),
  country: z.string().trim().length(2).toUpperCase().optional(),
  locale: z.enum(LOCALES).optional(),
  /** OBOLO NEO form chosen on Day 3. */
  neoForm: z.enum(NEO_FORM_IDS).optional(),
});
export type UpdateProfileBody = z.infer<typeof UpdateProfileBody>;

export const BuddyPersona = z.object({
  /** 0 = calm, 100 = very cheerful */
  cheer: z.number().int().min(0).max(100),
  /** 0 = casual (タメ口), 100 = polite (敬語) */
  polite: z.number().int().min(0).max(100),
  /** 0 = serious, 100 = playful */
  humor: z.number().int().min(0).max(100),
});
export type BuddyPersona = z.infer<typeof BuddyPersona>;

export const UpdateBuddyProfileBody = z.object({
  buddyName: z.string().trim().min(1).max(20).optional(),
  persona: BuddyPersona.optional(),
});
export type UpdateBuddyProfileBody = z.infer<typeof UpdateBuddyProfileBody>;

export const BuddyChatBody = z.object({
  text: z.string().trim().min(1).max(2000),
  locale: z.enum(LOCALES).optional(),
});
export type BuddyChatBody = z.infer<typeof BuddyChatBody>;

export const CreateSaturnPostBody = z
  .object({
    text: z.string().trim().min(1).max(SATURN_MAX_CHARS),
    /** id returned by POST /media/voice (recorded voice) */
    voiceMediaId: z.string().uuid().optional(),
    /** NEO voice: read the text aloud in this style instead of a recording */
    voiceStyle: z.enum(VOICE_STYLE_IDS).optional(),
    voiceDurationSec: z.number().min(0).max(600).optional(),
  })
  .refine((b) => !!b.voiceMediaId !== !!b.voiceStyle, { message: 'either voiceMediaId or voiceStyle is required' });
export type CreateSaturnPostBody = z.infer<typeof CreateSaturnPostBody>;

export const INVITE_CODE_RE = /^[A-Za-z0-9_-]{6,64}$/;

/** Name told to OBOLON during the Day-1 story; becomes the display name. */
export const AcceptInviteBody = z.object({
  displayName: z.string().trim().min(1).max(20),
});
export type AcceptInviteBody = z.infer<typeof AcceptInviteBody>;

export const CreateInviteBody = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});
export type CreateInviteBody = z.infer<typeof CreateInviteBody>;

export const AdminCreateInviteBody = CreateInviteBody.extend({
  inviterName: z.string().trim().min(1).max(40),
});
export type AdminCreateInviteBody = z.infer<typeof AdminCreateInviteBody>;

export const CompleteJourneyDayBody = z.object({
  day: z.number().int().min(1).max(9),
  /** Answers given in the story (e.g. "want to go to space?"). */
  answers: z.record(z.string().max(40), z.string().max(100)).optional(),
});
export type CompleteJourneyDayBody = z.infer<typeof CompleteJourneyDayBody>;

export const AdvanceJourneyBody = z.object({
  /** true = "明日まで待てへん" (skip the 24 h wait). */
  skip: z.boolean().default(false),
});
export type AdvanceJourneyBody = z.infer<typeof AdvanceJourneyBody>;

/** Day 3: the three questions for generating the OBOLO NEO look (client decision 2026-10-05). */
export const NeoLookBody = z.union([
  z.object({
    animal: z.string().trim().min(1).max(30),
    color: z.string().trim().min(1).max(30),
    mood: z.string().trim().min(1).max(40),
  }),
  /** From a reference image (client decision 2026-10-05). The image is only read, never stored. */
  z.object({
    reference: z.object({
      mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
      /** base64, already downscaled by the client (≤ ~1.5 MB) */
      data: z.string().min(100).max(2_000_000),
    }),
    /** KIMORIN's question 1: the part of the image they love */
    liked: z.string().trim().min(1).max(60),
    /** KIMORIN's question 2: their own twist */
    twist: z.string().trim().min(1).max(60),
  }),
]);
export type NeoLookBody = z.infer<typeof NeoLookBody>;

export const ChooseLookBody = z.object({ mediaId: z.string().uuid() });
export type ChooseLookBody = z.infer<typeof ChooseLookBody>;

/** Day 3: the favourite food the Bati egg is made from. */
export const BatiEggBody = z.object({ food: z.string().trim().min(1).max(40) });
export type BatiEggBody = z.infer<typeof BatiEggBody>;

/** Day 4: the newborn Bati's name. */
export const BatiNameBody = z.object({ name: z.string().trim().min(1).max(20) });
export type BatiNameBody = z.infer<typeof BatiNameBody>;

/** Operator testing (/lab, admin token): move the logged-in account to a journey day. */
export const JumpJourneyBody = z.object({ day: z.number().int().min(1).max(10) });
export type JumpJourneyBody = z.infer<typeof JumpJourneyBody>;

/** Day 9: the embedded Stripe Checkout finished — the server checks the session and records the order. */
export const ConfirmOrderBody = z.object({ sessionId: z.string().min(8).max(255) });
export type ConfirmOrderBody = z.infer<typeof ConfirmOrderBody>;

/** Day 3: refine the chosen look with one instruction (3 times). */
export const RefineLookBody = z.object({ mediaId: z.string().uuid(), instruction: z.string().trim().min(1).max(60) });
export type RefineLookBody = z.infer<typeof RefineLookBody>;
