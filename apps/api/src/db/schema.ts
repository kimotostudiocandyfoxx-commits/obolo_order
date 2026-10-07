/**
 * PostgreSQL schema (spec §5). Only the tables needed for the 10/10 demo planets
 * (Earth / Moon / Saturn) plus platform-wide Stars are created now; the remaining planet
 * tables are added in their build phase. Every planet table is keyed by user_id so each
 * planet's data can be scaled, partitioned or deleted independently.
 *
 * Rules (spec §5): money = integers only; ledger rows are append-only with idempotency keys;
 * planet tables carry created_at / updated_at / deleted_at (soft delete).
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    handle: text('handle').notNull(),
    displayName: text('display_name').notNull(),
    bio: text('bio').notNull().default(''),
    birthdate: date('birthdate'),
    country: text('country').notNull().default('JP'),
    locale: text('locale').notNull().default('ja'),
    /** none | demo | active | past_due | canceled … (Stripe subscription status once paid). */
    subscriptionStatus: text('subscription_status').notNull().default('demo'),
    /** Day 9: when the visitor paid for the Eclipse (became ORDER). Null = not paid yet. */
    orderedAt: timestamp('ordered_at', { withTimezone: true }),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    /** Fish Audio voice models made from the member's recordings (client decision 2026-10-07):
     *  their own voice (Saturn, singing) and the voice they gave Bati (a changed voice). */
    voiceSelfId: text('voice_self_id'),
    voiceBatiId: text('voice_bati_id'),
    voiceId: text('voice_id'),
    virtualAccountNo: text('virtual_account_no'),
    kycStatus: text('kyc_status').notNull().default('none'),
    storageUsageBytes: bigint('storage_usage_bytes', { mode: 'number' }).notNull().default(0),
    /** Invite-only (client decision 2026-10-04): who invited this user. */
    invitedByUserId: uuid('invited_by_user_id'),
    invitedByName: text('invited_by_name'),
    /** 8-day journey (see @obolo/shared journey.ts): 1–8 = day to play, 9 = the Eclipse day (payment), 10 = ORDER member.
     *  Accounts created before the journey existed default to 10. */
    journeyDay: integer('journey_day').notNull().default(10),
    /** When the current day was finished; the next day unlocks 24 h later (or by skipping). */
    journeyCompletedAt: timestamp('journey_completed_at', { withTimezone: true }),
    /** OBOLO NEO form chosen on Day 3 (see @obolo/shared neo.ts). */
    neoForm: text('neo_form'),
    /** Generated OBOLO NEO look chosen on Day 3 (client decision 2026-10-05). */
    avatarUrl: text('avatar_url'),
    /** Bati egg (Day 3) → hatched and named (Day 4). */
    batiFood: text('bati_food'),
    batiImageUrl: text('bati_image_url'),
    batiName: text('bati_name'),
    onboardingJson: jsonb('onboarding_json').$type<Record<string, string>>().notNull().default({}),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [uniqueIndex('users_email_uq').on(t.email), uniqueIndex('users_handle_uq').on(t.handle)],
);

export const wallets = pgTable(
  'wallets',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id),
    manaBalance: integer('mana_balance').notNull().default(0),
    earningsBalanceJpy: bigint('earnings_balance_jpy', { mode: 'number' }).notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('wallets_mana_nonneg', sql`${t.manaBalance} >= 0`),
    check('wallets_earnings_nonneg', sql`${t.earningsBalanceJpy} >= 0`),
  ],
);

/** Ledger A — MANA (non-redeemable). Append-only. */
export const manaLedger = pgTable(
  'mana_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    delta: integer('delta').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    reason: text('reason').notNull(),
    refType: text('ref_type'),
    refId: text('ref_id'),
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('mana_ledger_idem_uq').on(t.idempotencyKey),
    index('mana_ledger_user_idx').on(t.userId, t.createdAt),
  ],
);

/** Ledger B — EARNINGS (JPY). Append-only. */
export const earningsLedger = pgTable(
  'earnings_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    deltaJpy: bigint('delta_jpy', { mode: 'number' }).notNull(),
    balanceAfter: bigint('balance_after', { mode: 'number' }).notNull(),
    source: text('source').notNull(),
    refId: text('ref_id'),
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('earnings_ledger_idem_uq').on(t.idempotencyKey),
    index('earnings_ledger_user_idx').on(t.userId, t.createdAt),
  ],
);

export const buddyProfiles = pgTable('buddy_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id),
  buddyName: text('buddy_name').notNull(),
  personaJson: jsonb('persona_json').$type<{ cheer: number; polite: number; humor: number }>().notNull(),
  memorySummary: text('memory_summary'),
  messagesSinceSummary: integer('messages_since_summary').notNull().default(0),
  ...timestamps,
});

export const buddyMessages = pgTable(
  'buddy_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: text('role').notNull(), // user | buddy
    text: text('text').notNull(),
    audioUrl: text('audio_url'),
    provider: text('provider'),
    ...timestamps,
  },
  (t) => [index('buddy_messages_user_idx').on(t.userId, t.createdAt)],
);

/**
 * Every uploaded file. storage = 'bunny' in all real environments (spec decision: all media
 * on Bunny CDN). 'db' is a dev/preview-only fallback when Bunny credentials are absent (P-MEDIA-1).
 */
export const mediaObjects = pgTable(
  'media_objects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').notNull(),
    mime: text('mime').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    storage: text('storage').notNull(),
    key: text('key').notNull(),
    url: text('url').notNull(),
    data: bytea('data'),
    synthetic: integer('synthetic').notNull().default(0), // spec §6.3: synthetic audio flag
    ...timestamps,
  },
  (t) => [index('media_objects_user_idx').on(t.userId)],
);

export const saturnPosts = pgTable(
  'saturn_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    text: text('text').notNull(),
    voiceMediaId: uuid('voice_media_id').references(() => mediaObjects.id),
    voiceAudioUrl: text('voice_audio_url').notNull(),
    voiceSource: text('voice_source').notNull().default('recorded'), // recorded | cloned | default
    voiceDurationSec: real('voice_duration_sec'),
    starCount: integer('star_count').notNull().default(0),
    replyToId: uuid('reply_to_id'),
    aiGenerated: integer('ai_generated').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('saturn_posts_created_idx').on(t.createdAt, t.id), index('saturn_posts_user_idx').on(t.userId, t.createdAt)],
);

/** Stars are platform-wide (spec v1.6). On Mercury they carry tiers 1–3; elsewhere tier = 1. */
export const starEvents = pgTable(
  'star_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    tier: integer('tier').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('star_events_uq').on(t.userId, t.targetType, t.targetId),
    check('star_events_tier', sql`${t.tier} BETWEEN 1 AND 3`),
  ],
);

/**
 * Invitations (the app is fully invite-only — client decision 2026-10-04).
 * A link /invite/<code> is sent to `email`; opening it starts the Day-1 story and the account
 * is created when the visitor tells OBOLON their name.
 */
export const invites = pgTable(
  'invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    inviterUserId: uuid('inviter_user_id').references(() => users.id),
    /** Snapshot shown in the story ("（招待者名）から招待されたのか…"). */
    inviterName: text('inviter_name').notNull(),
    email: text('email').notNull(),
    status: text('status').notNull().default('pending'), // pending | accepted | revoked
    acceptedUserId: uuid('accepted_user_id').references(() => users.id),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('invites_code_uq').on(t.code), index('invites_inviter_idx').on(t.inviterUserId, t.createdAt)],
);

/**
 * Mercury songs that were sung (client spec 2026-10-07, chat edits). Everything needed to re-mix
 * without calling an AI again is kept: the instrumental, one vocal file per lyric line (phrase),
 * the mix settings. Edits regenerate only what changed (a phrase, or the instrumental).
 */
export const songs = pgTable(
  'songs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    /** bpm, key, genre, mood, instrumental prompt, lyric lines with their beats, melody */
    designJson: jsonb('design_json').$type<Record<string, unknown>>().notNull(),
    instrumentalUrl: text('instrumental_url').notNull(),
    /** one entry per lyric line: text, voice slot, vocal file url, its length */
    phrasesJson: jsonb('phrases_json').$type<Record<string, unknown>[]>().notNull(),
    /** tempo, vocal / instrumental gain, delay, gaps between phrases */
    mixJson: jsonb('mix_json').$type<Record<string, unknown>>().notNull(),
    directionJson: jsonb('direction_json').$type<Record<string, unknown>>().notNull(),
    mixUrl: text('mix_url').notNull(),
    seconds: real('seconds').notNull(),
    savedAt: timestamp('saved_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('songs_user_idx').on(t.userId, t.createdAt)],
);
