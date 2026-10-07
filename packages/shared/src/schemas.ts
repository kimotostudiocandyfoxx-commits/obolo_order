import { z } from 'zod';
import { LOCALES, PLAZA_ICONS, PLAZA_NAME_MAX, SATURN_MAX_CHARS } from './config';
import { NEO_FORM_IDS } from './neo';
import { VOICE_STYLE_IDS } from './neoVoice';
import { PuniLook } from './puni';

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
  /** the round ぷにぷに character (null = back to the plain ball) */
  look: PuniLook.nullable().optional(),
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
    /** with voiceStyle: read it in the member's own registered voice (Fish Audio) instead of the NEO voice */
    ownVoice: z.boolean().optional(),
    /** with voiceStyle: read by Bati (the member's registered Bati voice) — the "バティに読んでもらう" button */
    readBy: z.enum(['self', 'bati']).optional(),
    voiceDurationSec: z.number().min(0).max(600).optional(),
    /** a voice reply to this post */
    replyToId: z.string().uuid().optional(),
    /** a quote repost of this post */
    repostOfId: z.string().uuid().optional(),
    /** dropped in this ひろば (Saturn's みんな map) */
    plazaId: z.string().uuid().optional(),
    /** a photo posted with it (id from POST /media/photo): the character holds it */
    photoMediaId: z.string().uuid().optional(),
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

/**
 * Saturn picture character (client decision 2026-10-07): describe your character (and optionally
 * attach a picture to take inspiration from) → the AI paints round ぷにぷに candidates.
 */
export const PuniPicBody = z.object({
  description: z.string().trim().min(2).max(200),
  /** a picture to take colours / motifs from (only handed to the model, never stored) */
  reference: z.object({ mime: z.string().regex(/^image\//).max(60), data: z.string().min(100).max(6_000_000) }).optional(),
  /** use the member's OBOLO NEO look as the reference */
  useNeoLook: z.boolean().optional(),
  /** Jupiter butterfly: use the member's Saturn character as the reference */
  useSaturnPic: z.boolean().optional(),
});
export type PuniPicBody = z.infer<typeof PuniPicBody>;

export const ChoosePuniPicBody = z.object({ mediaId: z.string().uuid().nullable() });
export type ChoosePuniPicBody = z.infer<typeof ChoosePuniPicBody>;

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

/** Mercury 作曲: the conversation so far (the partner's and the visitor's lines). */
const ComposeTurn = z.object({ role: z.enum(['user', 'partner']), text: z.string().trim().min(1).max(400) });
export const ComposeChatBody = z.object({
  /** Bati's name once it exists; KIMORIN otherwise */
  partner: z.string().trim().min(1).max(20),
  isBati: z.boolean(),
  history: z.array(ComposeTurn).min(1).max(30),
});
export type ComposeChatBody = z.infer<typeof ComposeChatBody>;

export const ComposeDesignBody = ComposeChatBody.extend({
  genre: z.enum(['pop', 'rock', 'hiphop', 'ballad', 'edm', 'auto']),
});
export type ComposeDesignBody = z.infer<typeof ComposeDesignBody>;

/** Mercury 伴奏: the parts of the song design the instrumental generator needs. */
export const InstrumentalBody = z.object({
  title: z.string().trim().min(1).max(40),
  prompt: z.string().trim().min(1).max(500),
  seconds: z.number().min(4).max(120),
  bpm: z.number().int().min(40).max(220),
  keyRoot: z.number().int().min(0).max(11),
  scale: z.enum(['major', 'minor']),
  progression: z.array(z.number().int().min(0).max(6)).min(1).max(16),
  melody: z.array(z.object({ midi: z.number().int().min(0).max(127).nullable(), beats: z.number().positive().max(16) })).max(600),
});
export type InstrumentalBody = z.infer<typeof InstrumentalBody>;

/** Voice registration: one recording of the fixed script (base64, ≤ ~4 MB before encoding). */
export const RegisterVoiceBody = z.object({
  slot: z.enum(['self', 'bati']),
  audio: z.object({ mime: z.string().regex(/^audio\//).max(60), data: z.string().min(100).max(6_000_000) }),
});
export type RegisterVoiceBody = z.infer<typeof RegisterVoiceBody>;

/** Speak a text in one of the member's registered voices (Saturn read-aloud, Bati's lines). */
export const SpeakBody = z.object({
  slot: z.enum(['self', 'bati']),
  text: z.string().trim().min(1).max(300),
  /** one of VOICE_STYLES (元気に, ささやき風 …) — read with that style's Fish tag */
  style: z.enum(VOICE_STYLE_IDS).optional(),
});
export type SpeakBody = z.infer<typeof SpeakBody>;

/** Turn one of the member's own voice recordings (POST /media/voice) into text. */
export const TranscribeBody = z.object({ mediaId: z.string().uuid() });
export type TranscribeBody = z.infer<typeof TranscribeBody>;

/**
 * Mercury 歌入れ: sing the song in a registered voice (Fish Audio, [singing] mode) and mix it with
 * the instrumental already made for it. `instrumentalUrl` must be one of the member's own files.
 */
export const SingBody = z.object({
  title: z.string().trim().min(1).max(40),
  genre: z.string().trim().max(20),
  mood: z.string().trim().max(30),
  bpm: z.number().int().min(40).max(220),
  keyRoot: z.number().int().min(0).max(11),
  scale: z.enum(['major', 'minor']),
  sections: z
    .array(
      z.object({
        name: z.enum(['verse', 'chorus', 'bridge']),
        lines: z.array(z.object({ text: z.string().trim().min(1).max(40), beats: z.number().positive().max(64) })).min(1).max(8),
      }),
    )
    .min(1)
    .max(6),
  melody: z.array(z.object({ midi: z.number().int().min(0).max(127).nullable(), beats: z.number().positive().max(16) })).max(600),
  /** kept with the song so the instrumental can be made again on a genre edit */
  instrumentalPrompt: z.string().trim().min(1).max(500),
  progression: z.array(z.number().int().min(0).max(6)).min(1).max(16),
  seconds: z.number().min(4).max(120),
  instrumentalUrl: z.string().url().max(500),
  slot: z.enum(['self', 'bati']).default('self'),
});
export type SingBody = z.infer<typeof SingBody>;

/** A decided song edit (what the LLM chose from the chat message; see SongEditResult). */
export const SongEditCommand = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('VOLUME_TEMPO_EDIT'),
    tempo: z.number().min(0.8).max(1.25).optional(),
    vocalDb: z.number().min(-12).max(12).optional(),
    bgmDb: z.number().min(-12).max(12).optional(),
  }),
  z.object({
    action: z.literal('LYRICS_EDIT'),
    edits: z.array(z.object({ index: z.number().int().min(0).max(47), text: z.string().trim().min(1).max(40) })).min(1).max(8),
  }),
  z.object({
    action: z.literal('VOICE_REPLACE'),
    indexes: z.array(z.number().int().min(0).max(47)).min(1).max(48),
    slot: z.enum(['self', 'bati']),
  }),
  z.object({
    action: z.literal('TIMING_EDIT'),
    delayBeats: z.number().min(-16).max(16).optional(),
    gapAfter: z.number().int().min(0).max(47).optional(),
    gapSeconds: z.number().min(0).max(8).optional(),
  }),
  z.object({ action: z.literal('GENRE_EDIT'), prompt: z.string().trim().min(3).max(400) }),
]);
export type SongEditCommand = z.infer<typeof SongEditCommand>;

/** A chat message about a finished song ("サビを大きく", "ロックにして" …), or a command to retry. */
export const SongEditBody = z
  .object({
    message: z.string().trim().min(1).max(300).optional(),
    /** the last few chat lines, so "もっと" / "さっきの" make sense */
    history: z.array(z.object({ role: z.enum(['user', 'partner']), text: z.string().trim().min(1).max(400) })).max(10).default([]),
    partner: z.string().trim().min(1).max(20),
    isBati: z.boolean(),
    command: SongEditCommand.optional(),
  })
  .refine((b) => !!b.message || !!b.command, { message: 'message or command is required' });
export type SongEditBody = z.infer<typeof SongEditBody>;

/** ひろば (Saturn's みんな map, client decision 2026-10-07): a named place people gather in. */
export const CreatePlazaBody = z.object({
  name: z.string().trim().min(1).max(PLAZA_NAME_MAX),
  icon: z.enum(PLAZA_ICONS),
});
export type CreatePlazaBody = z.infer<typeof CreatePlazaBody>;

// --- Jupiter ----------------------------------------------------------------------------------------

/** Put an uploaded photo / video (POST /media/photo, /media/video?max=8) into your 根っこ. */
export const JupiterRootBody = z.object({ mediaId: z.string().uuid(), kind: z.enum(['photo', 'video']), posterUrl: z.string().url().max(500).optional() });
export type JupiterRootBody = z.infer<typeof JupiterRootBody>;

export const JUPITER_FILTERS = ['none', 'warm', 'sepia', 'mono', 'soft'] as const;

/** A round post made from one of your roots. */
export const CreateJupiterPostBody = z.object({
  rootId: z.string().uuid(),
  text: z.string().trim().max(30).default(''),
  filter: z.enum(JUPITER_FILTERS).default('none'),
  branch: z.number().int().min(0).max(3),
});
export type CreateJupiterPostBody = z.infer<typeof CreateJupiterPostBody>;

/** Rename one of the four branches on your tree. */
export const JupiterBranchBody = z.object({ index: z.number().int().min(0).max(3), name: z.string().trim().min(1).max(8) });
export type JupiterBranchBody = z.infer<typeof JupiterBranchBody>;
