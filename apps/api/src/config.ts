import { z } from 'zod';
import { DEFAULT_MAKE_SETUP, type MakeSetup } from '@obolo/shared';

/**
 * All runtime configuration comes from environment variables (spec §8: secrets never committed).
 * See apps/api/.env.example. Values marked PLACEHOLDER are listed in docs/placeholders.md.
 */
const bool = (def: boolean) =>
  z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => (v === undefined ? def : v === 'true' || v === '1'));

/** Optional secret: empty or "PLACEHOLDER…" means "not configured yet" (lets deploys succeed before keys exist). */
const secret = () =>
  z
    .string()
    .optional()
    .transform((v) => (!v || v.trim() === '' || v.startsWith('PLACEHOLDER') ? undefined : v.trim()));

const Env = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(8080),

  /** Primary (read-write) Postgres. On Cloud Run + Cloud SQL use the unix socket form:
   *  postgres://USER:PASS@/DB?host=/cloudsql/PROJECT:asia-northeast1:INSTANCE */
  DATABASE_URL: z.string().default('postgres://postgres:postgres@localhost:5432/obolo'),
  /** Optional read replica. Falls back to DATABASE_URL (read/write split ready, spec decision). */
  DATABASE_READ_URL: secret(),
  DB_POOL_MAX: z.coerce.number().default(5),
  MIGRATE_ON_START: bool(false),

  /** Upstash: rediss://default:TOKEN@HOST:6379 . Empty = in-memory store (single-instance dev only). */
  REDIS_URL: secret(),
  /** "inline" runs jobs in-process after the response; "bullmq" pushes to Redis for apps/api worker. */
  QUEUE_DRIVER: z.enum(['inline', 'bullmq', 'cloudtasks']).default('inline'),
  /** cloudtasks: projects/P/locations/L/queues/Q, the API's own URL (tasks call it back), the service account the calls are signed as */
  CLOUD_TASKS_QUEUE: secret(),
  JOBS_TARGET_URL: secret(),
  JOBS_INVOKER_SA: secret(),

  /** Comma-separated exact origins and/or regexes wrapped in slashes, e.g.
   *  https://obolo.app,/^https:\/\/obolo-order-.*\.vercel\.app$/ */
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  SESSION_TTL_DAYS: z.coerce.number().default(30),
  /** Invite-only: token for POST /admin/invites (issuing the first invitations). Unset = admin API disabled. */
  ADMIN_TOKEN: secret(),
  /**
   * The tester entrance (docs/本番の状態.md): login emails (comma-separated, any case) whose account gets Me.tester and
   * POST /me/tester/* (open everything, jump days, skip the wait, start over). Set from the GitHub Actions variable
   * TESTER_EMAILS in deploy-api.yml — never written in the repository. Empty = nobody.
   */
  TESTER_EMAILS: z.string().default(''),
  /** the same by account id (users.id, comma-separated) */
  TESTER_ACCOUNT_IDS: z.string().default(''),
  /** PLACEHOLDER (P-INV-2): invitation validity. */
  INVITE_TTL_DAYS: z.coerce.number().default(14),
  /** Web origin used in invitation emails, e.g. https://obolo-order-web.vercel.app */
  WEB_ORIGIN: secret(),
  /** the story lines with members' names in them (default: WEB_ORIGIN/story/voices/name-lines.json) */
  NAME_LINES_URL: z.string().optional(),
  /** PLACEHOLDER (P-AUTH-2): until an email provider is wired, return the login code in the API
   *  response so the demo works. MUST be false in production. */
  AUTH_DEMO_SHOW_CODE: bool(false),
  /** PLACEHOLDER (P-AUTH-2): "console" logs codes; "resend" sends real email. */
  EMAIL_DRIVER: z.enum(['console', 'resend']).default('console'),
  RESEND_API_KEY: secret(),
  EMAIL_FROM: z.string().default('Obolo Order <no-reply@example.com>'),

  GEMINI_API_KEY: secret(),
  /** the looks and the Bati painted by Seedream on Runware (client decision 2026-10-25; secret obolo-seedream-api-key) */
  LOOK_RUNWARE_KEY: secret(),
  GEMINI_MODEL: z.string().optional(),
  /** PLACEHOLDER (P-AI-3): image model for the NEO look / Bati. Now only the old name of ART_MODEL (a Gemini image model). */
  GEMINI_IMAGE_MODEL: z.string().optional(),
  /**
   * R17 (client 2026-11-25: cheaper pictures; the art is Japanese-anime-like): the model of each picture use — a Runware
   * AIR id (runware:400@4 = FLUX.2 [klein] 4B, bfl:flux@3-image-klein, alibaba:qwen-image@2.1-turbo, a civitai:… SDXL
   * anime checkpoint …) or a Gemini image model (gemini-2.5-flash-image). Defaults: R16's models, until the client picks
   * from the comparison (.github/workflows/runware-art-test.yml). Set them as GitHub Variables of the same name.
   */
  ART_MODEL: z.string().optional(),
  LOOK_MODEL: z.string().default('runware:400@4'),
  BATI_MODEL: z.string().default('bytedance:seedream@5.0-flash'),
  KORORIN_MODEL: z.string().default('runware:400@4'),
  /** client 2026-11-25 (art/lab/runware-planet-avatar): the member's planet figures — the Saturn chibi on FLUX.2 klein 4B, the Saturn ball and the seven planets' chibis on Qwen-Image 2.1 Turbo */
  SATURN_CHIBI_MODEL: z.string().default('runware:400@4'),
  SATURN_BALL_MODEL: z.string().default('alibaba:qwen-image@2.1-turbo'),
  /** M-R325: the background-removal model the cut-out falls back on when the colour cut failed its check twice (a Runware AIR id; empty: none) */
  CUTOUT_MODEL: z.string().default('runware:109@1'),
  PLANET_CHIBI_MODEL: z.string().default('alibaba:qwen-image@2.1-turbo'),
  /** the look rounds of the first journey (free): four to pick from (M-R173, four touches) */
  LOOK_CANDIDATES: z.coerce.number().int().min(1).max(4).default(4),
  /** R17: a paid look / dress-up round (after the journey, the atelier's row of pictures): two to pick from, not four */
  PAID_LOOK_CANDIDATES: z.coerce.number().int().min(1).max(4).default(2),
  /** the Saturn kororin design shows four to pick from (story D04-S005b; DECISIONS 2026-10-27) */
  KORORIN_CANDIDATES: z.coerce.number().int().min(1).max(4).default(4),
  OPENAI_API_KEY: secret(),
  OPENAI_MODEL: z.string().optional(),
  /** Bati's conversation on Claude Haiku 5.5 (client decision 2026-11-21; secret obolo-anthropic-api-key).
   *  Without it Bati talks on the Gemini chain as before. */
  ANTHROPIC_API_KEY: secret(),
  /** a fixed model id (never an alias); default claude-haiku-5-5 */
  ANTHROPIC_MODEL: z.string().optional(),
  /**
   * client 2026-11-25: the models a book's chapters and a game's code are written with — a chain of provider:model
   * (packages/ai task.ts; gemini / claude / openai), the next tried on a timeout or quota. Claude later = change these.
   */
  NOVEL_MODEL: z.string().default('gemini:gemini-2.5-flash?think=0,gemini:gemini-flash-latest?think=0'),
  /** the old name of GAME_MODEL_FULL (kept: a set GitHub Variable still works) */
  GAME_MODEL: z.string().optional(),
  /**
   * R17 (client 2026-11-25: games cheaper): the chain of each game tier — the first game's template values (TRIAL), a
   * member's own request and every tweak (CHEAP), a request that needs it / a tweak the cheap chain failed twice (FULL).
   * `?think=N` caps a Gemini step's thinking tokens (0 = none).
   */
  GAME_MODEL_TRIAL: z.string().default('gemini:gemini-2.5-flash-lite?think=0,gemini:gemini-2.5-flash?think=0'),
  GAME_MODEL_CHEAP: z.string().default('gemini:gemini-2.5-flash?think=4096,gemini:gemini-flash-latest?think=4096'),
  GAME_MODEL_FULL: z.string().optional(),
  /** a step of GAME_MODEL that takes longer than this gives way to the next (ms) */
  GAME_MODEL_TIMEOUT_MS: z.coerce.number().min(10_000).max(600_000).default(150_000),
  NOVEL_MODEL_TIMEOUT_MS: z.coerce.number().min(5_000).max(300_000).default(60_000),
  /** R13: the model a song's lyrics with metatags are written with (a chain like NOVEL_MODEL; Claude later = change this) */
  LYRICS_MODEL: z.string().default('gemini:gemini-2.5-flash?think=0,gemini:gemini-flash-latest?think=0'),
  LYRICS_MODEL_TIMEOUT_MS: z.coerce.number().min(5_000).max(120_000).default(30_000),
  /**
   * R14 (client 2026-11-25: 「サイケデリックトランスの曲」 came back as a pop spell): the model that builds every スペル first
   * (POST /moon/spell; a chain like LYRICS_MODEL — Claude = e.g. claude:claude-haiku-4-5,gemini:gemini-2.5-flash); the
   * rules only fill what it left empty, or stand alone when it fails
   */
  SPELL_MODEL: z.string().default('gemini:gemini-2.5-flash?think=0,gemini:gemini-flash-latest?think=0'),
  SPELL_MODEL_TIMEOUT_MS: z.coerce.number().min(2_000).max(60_000).default(9_000),
  /**
   * R14 (client 2026-11-25, iPad: 「バティの話すスピードが少し遅い」): how fast {bati} speaks in the Moon chat (Fish
   * prosody.speed; the Gemini fallback's pitch-keeping tempo) — 1 = the voice as made; each {bati}'s own speed on top
   */
  BATI_VOICE_SPEED: z.coerce.number().min(0.5).max(2).default(1.2),

  /** Stripe (the Eclipse day 7, ¥88/month). Without the secret key the payment runs in demo mode
   *  (no charge) — once it is set, POST /me/order is refused and only a paid Checkout counts. */
  STRIPE_SECRET_KEY: secret(),
  STRIPE_PUBLISHABLE_KEY: secret(),
  /** Signing secret of the webhook endpoint (POST /billing/webhook). Optional for the demo. */
  STRIPE_WEBHOOK_SECRET: secret(),
  /** Optional Price id (price_…). Unset = an inline ¥ORDER_PRICE_JPY monthly price. */
  STRIPE_PRICE_ID: secret(),

  /**
   * Earth mail & phone (client decision 2026-10-08: opened to each member after the ¥88 ORDER).
   * PLACEHOLDER (P-COMMS-1): members only; false lets anyone logged in try it (demo / tests).
   */
  COMMS_MEMBERS_ONLY: bool(true),
  /** Agora (phone). Without both, calls ring and connect in demo mode (no audio). */
  AGORA_APP_ID: secret(),
  AGORA_APP_CERTIFICATE: secret(),
  /**
   * Firebase (real-time mail). Recommended: Firebase added to this same GCP project — set
   * FIREBASE_PROJECT_ID and the API signs in as its own service account (FIREBASE_SIGNER_SA, no
   * key file). Or FIREBASE_SERVICE_ACCOUNT = a service account JSON. Neither = mail by polling.
   */
  FIREBASE_PROJECT_ID: secret(),
  FIREBASE_SIGNER_SA: secret(),
  FIREBASE_SERVICE_ACCOUNT: secret(),
  /** The Firebase web app's apiKey and appId (public values; the web app gets them from GET /comms/status). */
  FIREBASE_WEB_API_KEY: secret(),
  FIREBASE_WEB_APP_ID: secret(),

  /** Web Push (incoming calls, mail). Unset = the server makes its own VAPID key pair once and keeps it in the DB. */
  VAPID_PUBLIC_KEY: secret(),
  VAPID_PRIVATE_KEY: secret(),
  VAPID_SUBJECT: z.string().default('mailto:no-reply@example.com'),

  /** Mars MV: Bati's direction sheet (Gemini) and the last-choice anime model for the キメ絵 (ONNX, PLACEHOLDER P-MV-2). */
  MV_PLAN_MODEL: z.string().default('gemini-flash-lite-latest'),
  ANIME_ONNX_URL: secret(),
  /** キメ絵 (keyart.ts): how many materials per MV are redrawn as anime illustrations */
  MV_KEY_CUTS: z.coerce.number().default(2),
  /** Story MV: at most this many painted scenes per MV, and how many are painted at once */
  MV_SCENES: z.coerce.number().min(4).max(60).default(30),
  /** scenes per MV when Novita Qwen-Image paints them (about 3 yen a picture) */
  MV_QWEN_SCENES: z.coerce.number().min(4).max(60).default(12),
  /** paint MV scenes with Animagine XL on our own GPU (gpu/music POST /paint) */
  MV_GPU_PAINT: bool(false),
  /** how strongly hero scenes follow the hero's own picture (IP-Adapter on our GPU; 0 = tags only) */
  MV_HERO_REF: z.coerce.number().min(0).max(1).default(0.6),
  MV_PAINT_PARALLEL: z.coerce.number().min(1).max(16).default(6),
  MV_KEYART_MODEL: z.string().default('gemini-2.5-flash-image'),
  /** キメ絵 by Novita AI (client decision 2026-10-08): the key, the anime checkpoint, how far from the photo (0–1), the size */
  NOVITA_API_KEY: secret(),
  NOVITA_MODEL: secret(),
  NOVITA_STRENGTH: z.coerce.number().min(0.1).max(0.9).default(0.5),
  NOVITA_SIDE: z.coerce.number().default(768),
  RUNWARE_API_KEY: secret(),
  RUNWARE_MODEL: secret(),
  /**
   * How story MVs are painted (client decision 2026-10-11, docs/mv-plans.md). Unset = as before.
   *  A: Seedream 5.0 Pro on Runware, four scenes per picture (~7 yen for four) — while there are few members
   *  B: our own GPU kept running (MUSIC_MIN_INSTANCES=1) with open models — once there are many
   */
  /** Story MV stills move in 2.5D (depth picture on the API's CPU + Gemini's camera moves); the depth model's ONNX (default Depth Anything V2 Small) */
  // R13: on by default — the 2.5D camera is the spell's default (パララックス); depth on the CPU, no cost per video
  MV_PARALLAX: bool(true),
  MV_DEPTH_ONNX_URL: secret(),
  MV_PLAN: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['A', 'B']).optional()),
  /** plan A: the Runware key (secret obolo-seedream-api-key) and how many scenes an MV gets (4 per picture) */
  MV_RUNWARE_KEY: secret(),
  MV_SHEET_SCENES: z.coerce.number().min(4).max(32).default(12),
  /** plan A's picture model (styled.ts PAINTERS). klein-4b = FLUX.2 [klein] 4B, Apache-2.0 — the same model plan B can run on our GPU */
  MV_PAINTER: z.enum(['klein-4b', 'klein-9b', 'qwen-turbo', 'seedream']).default('klein-4b'),

  /** Fish Audio API (voices: registration, read-aloud, singing). Unset = voice features off. */
  FISH_API_KEY: secret(),
  /** PLACEHOLDER (P-VOICE-1): Fish Audio model name (client: s2.1-pro). */
  FISH_MODEL: z.string().default('s2.1-pro'),
  /**
   * PLACEHOLDER (P-VOICE-5): also send the design's melody (a plain tone) to Fish as an audio prompt
   * when singing. Off until tried by ear: Fish documents reference audio as a voice sample, so it may
   * change the timbre instead of guiding the melody.
   */
  FISH_SING_GUIDE: bool(false),
  /**
   * PLACEHOLDER (P-SAT-8): a shared Fish voice model id used as Bati's voice for members who have
   * not registered one yet (the chat's answers, Saturn's read-aloud). Unset = Bati's chat answers use the Gemini
   * voice for the egg and posts use the device's reading voice. Made from design/voices/default-bati-source.* (+2
   * semitones) by .github/workflows/make-default-bati-voice.yml; set as the GitHub variable FISH_DEFAULT_VOICE_ID.
   */
  FISH_DEFAULT_VOICE_ID: secret(),

  /** Cloud Run GPU service that makes Mercury instrumentals (gpu/music). Unset = not available yet. */
  MUSIC_URL: secret(),
  /**
   * R17 (client 2026-11-25): where songs are sung — 'runware' (ACE-Step 1.5 XL SFT on Runware, default) or 'gpu' (our own
   * ACE-Step on Cloud Run, the old path; also the fallback when Runware fails or has no key). Our GPU still splits a song
   * (stems, line times) and sings it in the member's voice, lazily (song-split jobs).
   */
  MUSIC_PROVIDER: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['runware', 'gpu']).default('runware')),
  /**
   * R17 (client 2026-11-25): the tempo every song is delivered at over how it was sung (the app's signature: 1.2× faster,
   * the pitch kept; the engine sings 1.2× longer so the length asked is what is delivered). 1 turns it off.
   */
  SONG_DEFAULT_TEMPO: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().min(1).max(1.5).default(1.2)),
  /** R17: the Runware key for songs (the secret obolo-seedream-api-key, like the looks and the MVs) */
  MUSIC_RUNWARE_KEY: secret(),
  /** R17: the secret spell ('off' turns it off for everyone) and its passphrases (comma-separated; default 「上級魔法で」) */
  PREMIUM_SPELL: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['on', 'off']).default('on')),
  PREMIUM_SPELL_WORDS: secret(),

  /**
   * Client 2026-11-25 (docs/マナの値段.md): mana = ceil((cost + Stripe's fee share) × (1 + MANA_MARGIN)), 1 yen = 1 mana.
   * STRIPE_FEE_RATE is Stripe's share of the yen that bought the mana; a fixed fee per charge (STRIPE_FEE_FIXED_JPY) is
   * spread over a typical charge (STRIPE_FEE_BASE_JPY, the ¥88 month).
   */
  STRIPE_FEE_RATE: z.coerce.number().min(0).max(0.3).default(0.036),
  STRIPE_FEE_FIXED_JPY: z.coerce.number().min(0).max(100).default(0),
  STRIPE_FEE_BASE_JPY: z.coerce.number().min(1).default(88),
  MANA_MARGIN: z.coerce.number().min(0).max(1).default(0.08),
  /** the USD→JPY rate when no month is set in fx_rates (GitHub variable FX_USD_JPY; conservative = a weak yen) */
  FX_USD_JPY: z.coerce.number().min(50).max(500).default(160),
  /** month rates from the GitHub variable FX_RATES, e.g. "2026-12=158;2027-01=160" (the fx_rates table wins for a month) */
  FX_RATES: z.string().default(''),
  /** our Cloud Run GPU (L4 + its CPU / memory) and CPU (the API, renders) per second, in yen */
  GPU_SECOND_JPY: z.coerce.number().min(0).default(0.05),
  CPU_SECOND_JPY: z.coerce.number().min(0).default(0.01),
  /**
   * R18 (docs/マナの値段.md 13.): Bluena's room — included for a member / everyone else (GB), the storage price (Cloudflare
   * R2, USD per GB-month; egress free), the R2 operations a ふくろの魔法 tier's price allows per GB a month, the grace when the
   * renewal finds too little mana, and the months of storage a making's price includes
   */
  STORAGE_MEMBER_GB: z.coerce.number().min(0).default(5),
  STORAGE_FREE_GB: z.coerce.number().min(0).default(1),
  STORAGE_GB_MONTH_USD: z.coerce.number().min(0).default(0.015),
  STORAGE_CLASS_A_PER_GB: z.coerce.number().min(0).default(0),
  STORAGE_CLASS_B_PER_GB: z.coerce.number().min(0).default(0),
  STORAGE_GRACE_DAYS: z.coerce.number().min(0).default(7),
  STORAGE_PRICE_MONTHS: z.coerce.number().min(0).default(12),
  /** a making's price follows its recorded costs (p90) once this many makings were recorded in the last 30 days */
  COST_REFINE_MIN_SAMPLES: z.coerce.number().min(3).default(20),
  /**
   * R17: recorded costs before this moment (ISO date) are not used to refine the prices — set it when a model is switched
   * (ART_MODEL …), so the old model's costs do not hold the price up (or down) for 30 days
   */
  COST_REFINE_SINCE: z.string().optional(),
  /** cost recording on (false: provider calls are not recorded and no small costs are taken) */
  COST_RECORDING: bool(true),

  BUDDY_FREE_DAILY: z.coerce.number().default(30),
  /** R18: a member's {bati} replies a day (never stopped at 0 mana); past it {bati} is tired until tomorrow */
  BATI_DAILY_CAP_MEMBER: z.coerce.number().min(1).default(300),
  /** R18: a non-member's ダチ messages a day (ダチ is free even at 0 mana; a soft cap against abuse) */
  DACHI_DAILY_CAP_FREE: z.coerce.number().min(1).default(200),
  /** client 2026-11-27 (the trial): ダチ voice messages one member may have made ready a day (about ¥0.03 each) */
  VOICE_MIX_DAILY_CAP: z.coerce.number().min(1).default(100),
  /** M-R208: web searches {bati} may make for one member a day (each ~1–5 yen), and for everyone together (cost ceiling) */
  BUDDY_SEARCH_DAILY: z.coerce.number().default(30),
  BUDDY_SEARCH_GLOBAL_DAILY: z.coerce.number().default(5000),
  /** M-R208: pictures {bati} draws in the chat for one member a day (~4–6 yen each) */
  BUDDY_DRAW_DAILY: z.coerce.number().default(10),
  /** Spec §2.2 overage (1 MANA/msg). Demo: billing off → blocked after the quota. */
  BUDDY_OVERAGE_ENABLED: bool(false),
  /** The first mana gem credited on sign-up (story M-R132; 88 by the client 2026-11-25 — the first journey fits in it; STARTER_GEM_MANA). */
  STARTER_GEM_MANA: z.coerce.number().default(88),

  /** Bunny Storage (PLACEHOLDER P-MEDIA-1). If any is missing, media is stored in Postgres (dev only). */
  BUNNY_STORAGE_ZONE: secret(),
  BUNNY_STORAGE_KEY: secret(),
  BUNNY_STORAGE_ENDPOINT: z.string().default('sg.storage.bunnycdn.com'),
  BUNNY_CDN_HOST: secret(),
  /**
   * Cloudflare R2 (client decision 2026-11-25; docs/media.md). With all five set, new files go to R2 and their URLs are
   * on R2_PUBLIC_BASE (https://media.obolo.life); otherwise the API stays on Bunny. The keys come from Secret Manager
   * (obolo-r2-access-key-id / obolo-r2-secret-access-key), written there by deploy-api.yml from the GitHub secrets.
   */
  R2_ACCOUNT_ID: secret(),
  R2_BUCKET: secret(),
  R2_ACCESS_KEY_ID: secret(),
  R2_SECRET_ACCESS_KEY: secret(),
  R2_PUBLIC_BASE: secret(),
  /** an S3 endpoint other than https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com (a local S3 in dev) */
  R2_ENDPOINT: secret(),
  /** copy the Bunny files to R2 in the background (small batches; also POST /admin/media/r2/move) */
  R2_MIGRATE: bool(false),
  /** files per batch, and seconds between batches */
  R2_MIGRATE_BATCH: z.coerce.number().int().min(1).max(500).default(25),
  R2_MIGRATE_EVERY_SEC: z.coerce.number().int().min(5).default(30),
  /** Public base URL of this API for dev-fallback media URLs. Unset = derived from the request host. */
  PUBLIC_API_URL: secret(),
});

export type AppConfig = z.infer<typeof Env>;

let cached: AppConfig | undefined;
export function loadConfig(): AppConfig {
  cached ??= Env.parse(process.env);
  return cached;
}

export const CONFIG = Symbol('CONFIG');

/** R17: the art model (ART_MODEL; GEMINI_IMAGE_MODEL is its old name; default Gemini 2.5 Flash Image as in R16) */
export const artModelOf = (c: Pick<AppConfig, 'ART_MODEL' | 'GEMINI_IMAGE_MODEL'>) => c.ART_MODEL || c.GEMINI_IMAGE_MODEL || DEFAULT_MAKE_SETUP.artModel;
/** R17: the full game chain (GAME_MODEL_FULL; GAME_MODEL is its old name) */
export const gameFullOf = (c: Pick<AppConfig, 'GAME_MODEL_FULL' | 'GAME_MODEL'>) => c.GAME_MODEL_FULL || c.GAME_MODEL || 'gemini:gemini-2.5-pro,gemini:gemini-2.5-flash';

/** R17: what the pictures and the games are made with — the seed of the price table follows it (makeCostEstimates) */
export function makeSetupOf(c: AppConfig): MakeSetup {
  return {
    artModel: artModelOf(c),
    lookModel: c.LOOK_MODEL || DEFAULT_MAKE_SETUP.lookModel,
    batiModel: c.BATI_MODEL || DEFAULT_MAKE_SETUP.batiModel,
    kororinModel: c.KORORIN_MODEL || DEFAULT_MAKE_SETUP.kororinModel,
    saturnChibiModel: c.SATURN_CHIBI_MODEL || DEFAULT_MAKE_SETUP.saturnChibiModel,
    saturnBallModel: c.SATURN_BALL_MODEL || DEFAULT_MAKE_SETUP.saturnBallModel,
    planetChibiModel: c.PLANET_CHIBI_MODEL || DEFAULT_MAKE_SETUP.planetChibiModel,
    paidLookCandidates: c.PAID_LOOK_CANDIDATES || DEFAULT_MAKE_SETUP.paidLookCandidates,
    kororinCandidates: c.KORORIN_CANDIDATES || DEFAULT_MAKE_SETUP.kororinCandidates,
    gameTrialModel: c.GAME_MODEL_TRIAL || DEFAULT_MAKE_SETUP.gameTrialModel,
    gameCheapModel: c.GAME_MODEL_CHEAP || DEFAULT_MAKE_SETUP.gameCheapModel,
    gameFullModel: gameFullOf(c),
  };
}
