import { z } from 'zod';
import { LOCALES, SATURN_MAX_CHARS } from './config';

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

export const CreateSaturnPostBody = z.object({
  text: z.string().trim().min(1).max(SATURN_MAX_CHARS),
  /** id returned by POST /media/voice */
  voiceMediaId: z.string().uuid(),
  voiceDurationSec: z.number().min(0).max(600).optional(),
});
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

export const OnboardingProgressBody = z.object({
  stage: z.enum(['day1_done']),
  /** Answers given in the story (e.g. "want to go to space?"). */
  answers: z.record(z.string().max(40), z.string().max(100)).optional(),
});
export type OnboardingProgressBody = z.infer<typeof OnboardingProgressBody>;
