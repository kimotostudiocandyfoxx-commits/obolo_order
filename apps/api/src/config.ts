import { z } from 'zod';

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
  QUEUE_DRIVER: z.enum(['inline', 'bullmq']).default('inline'),

  /** Comma-separated exact origins and/or regexes wrapped in slashes, e.g.
   *  https://obolo.app,/^https:\/\/obolo-order-.*\.vercel\.app$/ */
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  SESSION_TTL_DAYS: z.coerce.number().default(30),
  /** Invite-only: token for POST /admin/invites (issuing the first invitations). Unset = admin API disabled. */
  ADMIN_TOKEN: secret(),
  /** PLACEHOLDER (P-INV-2): invitation validity. */
  INVITE_TTL_DAYS: z.coerce.number().default(14),
  /** Web origin used in invitation emails, e.g. https://obolo-order-web.vercel.app */
  WEB_ORIGIN: secret(),
  /** PLACEHOLDER (P-AUTH-2): until an email provider is wired, return the login code in the API
   *  response so the demo works. MUST be false in production. */
  AUTH_DEMO_SHOW_CODE: bool(false),
  /** PLACEHOLDER (P-AUTH-2): "console" logs codes; "resend" sends real email. */
  EMAIL_DRIVER: z.enum(['console', 'resend']).default('console'),
  RESEND_API_KEY: secret(),
  EMAIL_FROM: z.string().default('Obolo Order <no-reply@example.com>'),

  GEMINI_API_KEY: secret(),
  GEMINI_MODEL: z.string().optional(),
  /** PLACEHOLDER (P-AI-3): image model for the NEO look / Bati. */
  GEMINI_IMAGE_MODEL: z.string().optional(),
  OPENAI_API_KEY: secret(),
  OPENAI_MODEL: z.string().optional(),

  /** Stripe (Day 9 Eclipse, ¥88/month). Without the secret key the payment runs in demo mode
   *  (no charge) — once it is set, POST /me/order is refused and only a paid Checkout counts. */
  STRIPE_SECRET_KEY: secret(),
  STRIPE_PUBLISHABLE_KEY: secret(),
  /** Signing secret of the webhook endpoint (POST /billing/webhook). Optional for the demo. */
  STRIPE_WEBHOOK_SECRET: secret(),
  /** Optional Price id (price_…). Unset = an inline ¥ORDER_PRICE_JPY monthly price. */
  STRIPE_PRICE_ID: secret(),

  /** Fish Audio API (voices: registration, read-aloud, singing). Unset = voice features off. */
  FISH_API_KEY: secret(),
  /** PLACEHOLDER (P-VOICE-1): Fish Audio model name (client: s2.1-pro). */
  FISH_MODEL: z.string().default('s2.1-pro'),

  /** Cloud Run GPU service that makes Mercury instrumentals (gpu/music). Unset = not available yet. */
  MUSIC_URL: secret(),

  BUDDY_FREE_DAILY: z.coerce.number().default(30),
  /** Spec §2.2 overage (1 MANA/msg). Demo: billing off → blocked after the quota. */
  BUDDY_OVERAGE_ENABLED: bool(false),
  /** PLACEHOLDER (P-WALLET-1): MANA credited on sign-up while subscriptions are not live. */
  DEMO_SIGNUP_GRANT_MANA: z.coerce.number().default(88),

  /** Bunny Storage (PLACEHOLDER P-MEDIA-1). If any is missing, media is stored in Postgres (dev only). */
  BUNNY_STORAGE_ZONE: secret(),
  BUNNY_STORAGE_KEY: secret(),
  BUNNY_STORAGE_ENDPOINT: z.string().default('sg.storage.bunnycdn.com'),
  BUNNY_CDN_HOST: secret(),
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
