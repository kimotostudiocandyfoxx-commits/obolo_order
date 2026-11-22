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
import type { AtelierLayout, BuddySource, PuniLook, TalkBeat, TalkFace, TalkMotion, WorkMaterial, WorkOrigin, WorkVersion } from '@obolo/shared';
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
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
    /** the round ぷにぷに character (part ids, see @obolo/shared PuniLook) */
    lookJson: jsonb('look_json').$type<PuniLook>(),
    /** the painted ぷにぷに picture (AI, transparent PNG on Bunny) */
    puniPicUrl: text('puni_pic_url'),
    /** Jupiter: painted butterfly (PNG on Bunny) */
    butterflyUrl: text('butterfly_url'),
    /** Jupiter: the four branch names on the tree (null = the defaults) */
    jupiterBranches: jsonb('jupiter_branches').$type<string[]>(),
    birthdate: date('birthdate'),
    country: text('country').notNull().default('JP'),
    locale: text('locale').notNull().default('ja'),
    /** none | demo | active | past_due | canceled … (Stripe subscription status once paid). */
    subscriptionStatus: text('subscription_status').notNull().default('demo'),
    /** Suspended by the team (a report review): cannot log in or use the app. */
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    /** Day 9: when the visitor paid for the Eclipse (became ORDER). Null = not paid yet. */
    orderedAt: timestamp('ordered_at', { withTimezone: true }),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    /** Fish Audio voice models made from the member's recordings (client decision 2026-10-07):
     *  their own voice (Saturn, singing) and the voice they gave Bati (a changed voice). */
    voiceSelfId: text('voice_self_id'),
    voiceBatiId: text('voice_bati_id'),
    /** the kororin voice: the funny voice blown in on Saturn (story M-R41) */
    voiceKororinId: text('voice_kororin_id'),
    voiceKororinUrl: text('voice_kororin_url'),
    /** the recordings themselves (2026-10-09): the voice reference Seed-VC sings songs in */
    voiceSelfUrl: text('voice_self_url'),
    voiceBatiUrl: text('voice_bati_url'),
    /** M-R246: {bati}'s voice from the egg recording — none | making | ready | failed (null = none) */
    voiceBatiState: text('voice_bati_state'),
    /** M-R247: the start-of-app agreement (terms, privacy, what photos and voice are used for): its version and when */
    consentVersion: text('consent_version'),
    consentAt: timestamp('consent_at', { withTimezone: true }),
    /** M-R248: 13〜15 — a guardian agreed to the photo and voice being used (confirmed once at the start), with its version */
    guardianConsentVersion: text('guardian_consent_version'),
    guardianConsentAt: timestamp('guardian_consent_at', { withTimezone: true }),
    voiceId: text('voice_id'),
    virtualAccountNo: text('virtual_account_no'),
    kycStatus: text('kyc_status').notNull().default('none'),
    storageUsageBytes: bigint('storage_usage_bytes', { mode: 'number' }).notNull().default(0),
    /** Invite-only (client decision 2026-10-04): who invited this user. */
    invitedByUserId: uuid('invited_by_user_id'),
    invitedByName: text('invited_by_name'),
    /** The words on the invitation that brought them (kept for the story when it is reopened). */
    invitedByMessage: text('invited_by_message'),
    /** 8-day journey (see @obolo/shared journey.ts): 1–8 = day to play, 9 = the Eclipse day (payment), 10 = ORDER member.
     *  Accounts created before the journey existed default to 10. */
    journeyDay: integer('journey_day').notNull().default(9),
    /** When the current day was finished; the next day unlocks 24 h later (or by skipping). */
    journeyCompletedAt: timestamp('journey_completed_at', { withTimezone: true }),
    /** When {name} became dachi with {inviter} on Saturn (D04-S005c, M-R212): the ダチ threads are shown from then (set even with no inviter). */
    dachiAt: timestamp('dachi_at', { withTimezone: true }),
    /** OBOLO NEO form chosen on Day 3 (see @obolo/shared neo.ts). */
    neoForm: text('neo_form'),
    /** Generated OBOLO NEO look chosen on Day 3 (client decision 2026-10-05). */
    avatarUrl: text('avatar_url'),
    /** Bati egg (Day 3) → hatched and named (Day 4). */
    batiFood: text('bati_food'),
    batiImageUrl: text('bati_image_url'),
    batiName: text('bati_name'),
    /**
     * M-R215 / M-R217: every {bati} of the member (three at most; see look/batis.ts BatiRecord). The legacy columns above
     * stay the one in the chat (the active {bati}), so older code keeps working; `batiId` names it.
     */
    batisJson: jsonb('batis_json').$type<import('../look/batis').BatiRecord[]>(),
    batiId: text('bati_id'),
    /** M-R218: the small egg the first shell became hatches from this time (88 days); null = no egg (three born) */
    batiEggAt: timestamp('bati_egg_at', { withTimezone: true }),
    /** M-R236: the member's own names for the four marks ♠♦♥♣ (none = no name) */
    markNamesJson: jsonb('mark_names_json').$type<import('@obolo/shared').MarkNames>(),
    onboardingJson: jsonb('onboarding_json').$type<Record<string, string>>().notNull().default({}),
    /** Uranus: your atelier (AtelierLayout); null = not decorated yet */
    atelierJson: jsonb('atelier_json').$type<AtelierLayout>(),
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
    /**
     * Tamper evidence (client decision 2026-11-21, docs/工房とブルーナ_設計.md §15): each user's rows form a chain —
     * seq 1, 2, 3 … and hash = SHA-256(this row's content + the previous row's hash). Rows written before the chain
     * existed get their seq from the migration and their hash when first sealed (src/wallet/mana-chain.ts).
     */
    seq: integer('seq'),
    prevHash: text('prev_hash'),
    hash: text('hash'),
  },
  (t) => [
    uniqueIndex('mana_ledger_idem_uq').on(t.idempotencyKey),
    index('mana_ledger_user_idx').on(t.userId, t.createdAt),
    uniqueIndex('mana_ledger_user_seq_uq').on(t.userId, t.seq),
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
    /** M-R208: the pages a looked-up answer is based on, or the picture {bati} drew (media URL) */
    extraJson: jsonb('extra_json').$type<{ sources?: BuddySource[]; image?: { url: string; mediaId: string }; remembered?: { text: string; result: 'kept' | 'refused' | 'full' | 'already' }; face?: TalkFace; motion?: TalkMotion; faces?: TalkBeat[]; marked?: string }>(),
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
    /** quote repost: this post introduces another one (with its own words and voice) */
    repostOfId: uuid('repost_of_id'),
    replyCount: integer('reply_count').notNull().default(0),
    repostCount: integer('repost_count').notNull().default(0),
    /** the ひろば it was dropped in (none: shown to followers only) */
    plazaId: uuid('plaza_id'),
    /** a photo posted with the voice (the character holds it) */
    photoUrl: text('photo_url'),
    /** 1 = flown to the author's own room only (自分の部屋): never on the planet or shown to others */
    room: integer('room').notNull().default(0),
    aiGenerated: integer('ai_generated').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index('saturn_posts_created_idx').on(t.createdAt, t.id),
    index('saturn_posts_plaza_idx').on(t.plazaId, t.createdAt),
    index('saturn_posts_user_idx').on(t.userId, t.createdAt),
    index('saturn_posts_reply_idx').on(t.replyToId, t.createdAt),
  ],
);

/**
 * Mercury (songs) and Mars (square movies) posts — 88 hours on the timelines, then on the
 * owner's island / studio (client decision 2026-10-07: they work like Saturn / Jupiter).
 */
export const planetPosts = pgTable(
  'planet_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planet: text('planet').notNull(), // mercury | mars
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').notNull(), // song | video
    sourceId: uuid('source_id'),
    title: text('title').notNull().default(''),
    text: text('text').notNull().default(''),
    url: text('url').notNull(),
    posterUrl: text('poster_url'),
    seconds: real('seconds'),
    starCount: integer('star_count').notNull().default(0),
    replyCount: integer('reply_count').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('planet_posts_planet_idx').on(t.planet, t.createdAt), index('planet_posts_user_idx').on(t.userId, t.planet, t.createdAt)],
);

export const planetReplies = pgTable(
  'planet_replies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => planetPosts.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    text: text('text').notNull(),
    ...timestamps,
  },
  (t) => [index('planet_replies_post_idx').on(t.postId, t.createdAt)],
);

/** Mars 裏スタジオ: every video a member keeps (Jupiter is photos only — client decision 2026-10-07). Private. */
export const marsBackstage = pgTable(
  'mars_backstage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    mediaId: uuid('media_id').references(() => mediaObjects.id),
    url: text('url').notNull(),
    posterUrl: text('poster_url'),
    seconds: real('seconds'),
    title: text('title').notNull().default(''),
    ...timestamps,
  },
  (t) => [index('mars_backstage_user_idx').on(t.userId, t.createdAt)],
);

/** Jupiter 根っこ: a member's private folder of photos / videos (docs/jupiter.md). */
export const jupiterRoots = pgTable(
  'jupiter_roots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    mediaId: uuid('media_id').references(() => mediaObjects.id),
    kind: text('kind').notNull(), // photo | video
    url: text('url').notNull(),
    posterUrl: text('poster_url'),
    ...timestamps,
  },
  (t) => [index('jupiter_roots_user_idx').on(t.userId, t.createdAt)],
);

/** Jupiter posts: a butterfly for 88 hours, then a leaf on the owner's tree. */
export const jupiterPosts = pgTable(
  'jupiter_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    rootId: uuid('root_id').references(() => jupiterRoots.id),
    kind: text('kind').notNull(),
    url: text('url').notNull(),
    posterUrl: text('poster_url'),
    text: text('text').notNull().default(''),
    filter: text('filter').notNull().default('none'),
    branch: integer('branch').notNull().default(0),
    starCount: integer('star_count').notNull().default(0),
    replyCount: integer('reply_count').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('jupiter_posts_created_idx').on(t.createdAt), index('jupiter_posts_user_idx').on(t.userId, t.createdAt)],
);

/** Replies to Jupiter posts (words). */
export const jupiterReplies = pgTable(
  'jupiter_replies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => jupiterPosts.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    text: text('text').notNull(),
    ...timestamps,
  },
  (t) => [index('jupiter_replies_post_idx').on(t.postId, t.createdAt)],
);

/** ひろば: Saturn's みんな map is made of these (client decision 2026-10-07). */
export const saturnPlazas = pgTable(
  'saturn_plazas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    icon: text('icon').notNull().default('⭐'),
    createdBy: uuid('created_by').references(() => users.id),
    memberCount: integer('member_count').notNull().default(0),
    /** 'open' = on the みんな map; 'me' = only its maker (L2-SATURN-S004) — names need not be unique then */
    access: text('access').notNull().default('open'),
    ...timestamps,
  },
  (t) => [uniqueIndex('saturn_plazas_name_idx').on(t.name).where(sql`${t.access} = 'open'`), index('saturn_plazas_members_idx').on(t.memberCount)],
);

export const saturnPlazaMembers = pgTable(
  'saturn_plaza_members',
  {
    plazaId: uuid('plaza_id')
      .notNull()
      .references(() => saturnPlazas.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('saturn_plaza_members_pair_idx').on(t.plazaId, t.userId), index('saturn_plaza_members_user_idx').on(t.userId)],
);

/** Saturn follows (spec §2.3 "standard SNS graph"). */
export const follows = pgTable(
  'follows',
  {
    followerId: uuid('follower_id')
      .notNull()
      .references(() => users.id),
    followeeId: uuid('followee_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('follows_pair_idx').on(t.followerId, t.followeeId), index('follows_followee_idx').on(t.followeeId)],
);

/**
 * ダチに届ける (story draft 21): one row per recipient — the sender's dachi (mutual follows) at the moment
 * of sending. Shown in the recipient's 〔推し〕 for 88 hours (DELIVERY_HOURS), then it is home again.
 */
export const deliveries = pgTable(
  'deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fromUserId: uuid('from_user_id')
      .notNull()
      .references(() => users.id),
    toUserId: uuid('to_user_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').notNull(), // kororin | jacket | song | mv | stage | book
    title: text('title').notNull().default(''),
    text: text('text').notNull().default(''),
    url: text('url'),
    posterUrl: text('poster_url'),
    refId: uuid('ref_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('deliveries_to_idx').on(t.toUserId, t.createdAt), index('deliveries_from_idx').on(t.fromUserId, t.createdAt)],
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
    /** The inviter's own words on the invitation (story M-R61, {inviter_message}); null = none. */
    message: text('message'),
    /** The inviter's short voice note (M-R212, a 'voice' media object): it arrives in the {inviter} thread on Saturn. */
    voiceMediaId: uuid('voice_media_id'),
    voiceUrl: text('voice_url'),
    voiceSeconds: real('voice_seconds'),
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
    /** the maker lets radio / DJ shows in this app play it (on by default, 2026-11-21) */
    allowRadio: boolean('allow_radio').notNull().default(true),
    ...timestamps,
  },
  (t) => [index('songs_user_idx').on(t.userId, t.createdAt)],
);

/**
 * Bluena 〔ブルーナにしまう〕 (client decision 2026-11-21): someone else's published work kept in your
 * Bluena — a link, not a copy (when the maker removes it, it shows "今は聴けません"). Nobody sees who
 * kept what (no counts).
 */
export const bluenaSaves = pgTable(
  'bluena_saves',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    /** a planet post (mercury: song) */
    postId: uuid('post_id')
      .notNull()
      .references(() => planetPosts.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] }), index('bluena_saves_user_idx').on(t.userId, t.createdAt)],
);

/** Venus radio: a recorded show (or the recording a live show left). private = Bluena's Venus folder. */
export const radioShows = pgTable(
  'radio_shows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    mediaId: uuid('media_id').references(() => mediaObjects.id),
    title: text('title').notNull(),
    audioUrl: text('audio_url').notNull(),
    thumbUrl: text('thumb_url'),
    loop: text('loop').notNull().default('drift'),
    seconds: real('seconds').notNull(),
    /** the songs that went on air: [{ at, songId, title, by, byId }] */
    cuesJson: jsonb('cues_json').$type<Record<string, unknown>[]>().notNull(),
    /** recorded | live */
    source: text('source').notNull().default('recorded'),
    liveId: uuid('live_id'),
    /** private | public */
    status: text('status').notNull().default('private'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    /** taken down by the team after a report */
    removedAt: timestamp('removed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('radio_shows_user_idx').on(t.userId, t.createdAt), index('radio_shows_public_idx').on(t.status, t.publishedAt)],
);

/** Venus radio: a live (voice-only) show. ORDER members only at first. */
export const radioLives = pgTable(
  'radio_lives',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    thumbUrl: text('thumb_url'),
    loop: text('loop').notNull().default('drift'),
    /** live | ended | stopped (by the team) */
    status: text('status').notNull().default('live'),
    nowJson: jsonb('now_json').$type<Record<string, unknown> | null>(),
    /** test | realtime */
    transport: text('transport').notNull().default('test'),
    /** the host's last word (a live show nobody hosts any more ends by itself) */
    beatAt: timestamp('beat_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    stoppedReason: text('stopped_reason'),
  },
  (t) => [index('radio_lives_status_idx').on(t.status, t.startedAt), index('radio_lives_user_idx').on(t.userId, t.startedAt)],
);

/** Venus radio: listeners' short comments and song requests during a live show. */
export const radioMessages = pgTable(
  'radio_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    liveId: uuid('live_id')
      .notNull()
      .references(() => radioLives.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    /** comment | request */
    kind: text('kind').notNull(),
    text: text('text').notNull().default(''),
    postId: uuid('post_id').references(() => planetPosts.id),
    /** the host (or the team) hid it */
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('radio_messages_live_idx').on(t.liveId, t.createdAt)],
);

/**
 * Earth: mail between ダチ (members only — client decision 2026-10-08). The API is the source of
 * truth (membership, ダチ and moderation checks); Firebase only delivers them in real time.
 */
export const dmMessages = pgTable(
  'dm_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => users.id),
    /** text | voice (a recorded message) */
    kind: text('kind').notNull().default('text'),
    text: text('text').notNull().default(''),
    audioUrl: text('audio_url'),
    readAt: timestamp('read_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('dm_messages_pair_idx').on(t.senderId, t.recipientId, t.createdAt), index('dm_messages_inbox_idx').on(t.recipientId, t.readAt)],
);

/** Earth: phone calls between ダチ. The API rings / answers / ends; the audio goes through Agora. */
export const callSessions = pgTable(
  'call_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    callerId: uuid('caller_id')
      .notNull()
      .references(() => users.id),
    calleeId: uuid('callee_id')
      .notNull()
      .references(() => users.id),
    /** the Agora channel name */
    channel: text('channel').notNull(),
    /** ringing | active | declined | missed | ended */
    status: text('status').notNull().default('ringing'),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('call_sessions_callee_idx').on(t.calleeId, t.status, t.createdAt), index('call_sessions_caller_idx').on(t.callerId, t.createdAt)],
);

/** Earth: blocks (client: a safe SNS for kids). A block ends the follows both ways and stops mail / calls. */
export const userBlocks = pgTable(
  'user_blocks',
  {
    blockerId: uuid('blocker_id')
      .notNull()
      .references(() => users.id),
    blockedId: uuid('blocked_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('user_blocks_pair_idx').on(t.blockerId, t.blockedId), index('user_blocks_blocked_idx').on(t.blockedId)],
);

/** Reports from members (mail, calls, people), kept for the team to review. PLACEHOLDER (P-COMMS-5): no review screen yet. */
export const userReports = pgTable(
  'user_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id),
    targetUserId: uuid('target_user_id')
      .notNull()
      .references(() => users.id),
    /** mail | call | person | radio-show | radio-live | radio-message | saturn-post | jupiter-post | planet-post (M-R213) */
    kind: text('kind').notNull(),
    /** the reported show / live / message (radio) */
    targetId: uuid('target_id'),
    /** mean | scary | other (radio: also song = a song that should not be on air) */
    reason: text('reason').notNull(),
    note: text('note').notNull().default(''),
    /** open | reviewed */
    status: text('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('user_reports_status_idx').on(t.status, t.createdAt)],
);

/**
 * M-R213: a planet work someone chose 〔見えなくする〕 on (a stranger's work on a planet's wide place). Per viewer and
 * kept; the work stays for everyone else. kind: saturn_post | jupiter_post | planet_post | radio_show.
 */
export const workHides = pgTable(
  'work_hides',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').notNull(),
    targetId: uuid('target_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('work_hides_pair_idx').on(t.userId, t.kind, t.targetId)],
);

/** Web Push: each device a member turned notifications on for (incoming calls, mail). */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('push_subscriptions_endpoint_idx').on(t.endpoint), index('push_subscriptions_user_idx').on(t.userId)],
);

/** Server-made settings that must survive restarts (e.g. the Web Push VAPID key pair). */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Mars MV projects: a Mercury song + the materials sent in the chat → the MV (and its lyrics version). */
export const mvProjects = pgTable(
  'mv_projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    songId: uuid('song_id')
      .notNull()
      .references(() => songs.id),
    /** collecting | rendering | done | failed */
    status: text('status').notNull().default('collecting'),
    materialsJson: jsonb('materials_json').$type<Record<string, unknown>[]>().notNull().default([]),
    /** Bati's edit plan (kept so the lyrics version reuses it) */
    planJson: jsonb('plan_json').$type<Record<string, unknown>>(),
    videoUrl: text('video_url'),
    lyricsVideoUrl: text('lyrics_video_url'),
    posterUrl: text('poster_url'),
    seconds: real('seconds'),
    note: text('note'),
    backstageId: uuid('backstage_id'),
    error: text('error'),
    ...timestamps,
  },
  (t) => [index('mv_projects_user_idx').on(t.userId, t.createdAt)],
);

/**
 * Long work done in the background (client decision 2026-10-09: 受付 → 順番に処理 → できたら通知):
 * a song sung by the music studio, a story MV, the lyrics on an MV. The app polls the row (and gets a
 * push when it is done); the work itself runs through the job queue (Cloud Tasks in production).
 */
export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').notNull(), // song | mv-story | mv-lyrics
    status: text('status').notNull().default('queued'), // queued | running | done | failed
    /** where the work is (shown to the member while they wait) */
    stage: text('stage'),
    inputJson: jsonb('input_json').$type<Record<string, unknown>>().notNull(),
    resultJson: jsonb('result_json').$type<Record<string, unknown>>(),
    errorCode: text('error_code'),
    error: text('error'),
    attempts: integer('attempts').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    /** M-R253 §4: when it should be done (estimated at the start of each try, moved on when it runs late) */
    etaAt: timestamp('eta_at', { withTimezone: true }),
    /** the estimate first given (ms) */
    etaMs: integer('eta_ms'),
    /** the time was moved on at least once ({bati} said 「ごめん、あと1分だけ」) */
    late: integer('late').notNull().default(0),
    /** the last failed try's code, kept while it is tried again */
    lastErrorCode: text('last_error_code'),
    ...timestamps,
  },
  (t) => [index('jobs_user_idx').on(t.userId, t.createdAt), index('jobs_kind_done_idx').on(t.kind, t.finishedAt)],
);

/**
 * Story lines voiced with the member's names in them (client decision 2026-10-16): one file per line and
 * per wording — `hash` covers the words with the names filled in and the voice, so a changed name or a
 * changed line gets a new file and the old one is simply not asked for any more.
 */
export const lineVoices = pgTable(
  'line_voices',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    hash: text('hash').notNull(),
    url: text('url').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.hash] })],
);

/**
 * ダチの声のメッセージ (M-R212): voice messages (≤ 60 s) and Bluena work cards between dachi, plus the story
 * characters' lines. A row between two people has both ids; a character's line has no sender (`character` says who,
 * `peerId` puts it in a dachi's thread — MIKIE⭐︎DRILL's welcome in {inviter}'s — else in the character's own thread);
 * a reply to a character has no recipient. `lineId` = which prepared line (unique per person: each arrives once).
 */
export const dachiMessages = pgTable(
  'dachi_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    senderId: uuid('sender_id').references(() => users.id),
    recipientId: uuid('recipient_id').references(() => users.id),
    /** kimorin | mikie: the character who spoke it (no sender), or the one replied to (no recipient) */
    character: text('character'),
    /** a character's line shown in this dachi's thread (MIKIE⭐︎DRILL in place of {inviter}'s voice) */
    peerId: uuid('peer_id').references(() => users.id),
    lineId: text('line_id'),
    /** voice | work */
    kind: text('kind').notNull().default('voice'),
    audioUrl: text('audio_url'),
    audioMediaId: uuid('audio_media_id'),
    seconds: real('seconds'),
    workJson: jsonb('work_json'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('dachi_messages_recipient_idx').on(t.recipientId, t.createdAt),
    index('dachi_messages_sender_idx').on(t.senderId, t.createdAt),
    uniqueIndex('dachi_messages_line_uq').on(t.recipientId, t.lineId).where(sql`${t.lineId} IS NOT NULL`),
  ],
);

/**
 * M-R236 / M-R237: ★ (0–3) and one mark (♠♦♥♣) a member put on their own works and on lines of their talks. Only the
 * member sees them. `kind` says which store `target_id` is in (@obolo/shared MARKED_KINDS); `local` = an item kept on
 * the member's device (its id is the device's own). A row with no ★ and no mark is deleted.
 */
export const itemMarks = pgTable(
  'item_marks',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').notNull(),
    targetId: text('target_id').notNull(),
    stars: integer('stars').notNull().default(0),
    mark: text('mark'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind, t.targetId] })],
);

/**
 * M-R253 §1 / §3 / §5: one work made in the Moon atelier — its tries (versions, each kept where its kind is kept:
 * the planets' stores), the face (the try looked at last), the works used as its material, and the talk it was made in.
 * Bluena lists the face only.
 */
export const moonWorks = pgTable(
  'moon_works',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').notNull(),
    versionsJson: jsonb('versions_json').$type<WorkVersion[]>().notNull(),
    active: integer('active').notNull().default(0),
    originJson: jsonb('origin_json').$type<WorkOrigin>(),
    materialsJson: jsonb('materials_json').$type<WorkMaterial[]>().notNull().default([]),
    ...timestamps,
  },
  (t) => [index('moon_works_user_idx').on(t.userId, t.createdAt)],
);

/** M-R253 §5: a flown work that came home and was told about ({bati}'s report is said once) */
export const workHomecomings = pgTable(
  'work_homecomings',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    /** `${kind}:${id}` of the flown post */
    key: text('key').notNull(),
    toldAt: timestamp('told_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);
