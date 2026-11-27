/**
 * Client decision 2026-11-25 (docs/マナの値段.md): every mana number comes from one rule.
 *
 *   1 yen = 1 mana.
 *   mana = ceil( (cost + payment fee share) × 1.08 )
 *        = ceil( cost / (1 − feeRate) × (1 + margin) )
 *
 * `cost` is what the providers (Runware, Gemini, Claude, Fish, our GPU / CPU) charge us for the work, in yen. The mana a
 * member spends was bought with yen that Stripe took its fee from (the ¥88 month, the 88 / 888 / 8,888 gems), so one
 * mana only brings us (1 − feeRate) yen: to get the cost back we must take cost / (1 − feeRate), and the operator's 8%
 * goes on top of that. The rule is the same for paid makings (quoted before the yes) and for the small costs of the
 * free features (added up per member and taken a whole mana at a time).
 */

import { BATI_BIRTH_MODEL, LOOK_PICK4_HEADS, LOOK_STEP_MODEL } from './lookSteps';

/** Stripe's fee and the operator's margin. All rates are fractions (0.036 = 3.6%). */
export interface PriceRule {
  /** Stripe's fee on the yen that bought the mana (STRIPE_FEE_RATE; Japan domestic cards 3.6%) */
  feeRate: number;
  /** a fixed fee per charge in yen (STRIPE_FEE_FIXED_JPY; 0 for Japanese cards) … */
  feeFixedJpy: number;
  /** … spread over a typical charge of this many yen (STRIPE_FEE_BASE_JPY; the ¥88 month) */
  feeBaseJpy: number;
  /** the operator's margin on top of cost + fee (MANA_MARGIN; client: 8%) */
  margin: number;
}

export const DEFAULT_PRICE_RULE: PriceRule = { feeRate: 0.036, feeFixedJpy: 0, feeBaseJpy: 88, margin: 0.08 };

/** the share of each yen paid that Stripe keeps (the rate plus the fixed fee spread over a typical charge), at most 50% */
export function effectiveFeeRate(rule: PriceRule = DEFAULT_PRICE_RULE): number {
  const fixed = rule.feeBaseJpy > 0 ? Math.max(0, rule.feeFixedJpy) / rule.feeBaseJpy : 0;
  return Math.min(0.5, Math.max(0, rule.feeRate) + fixed);
}

/** float noise below this is not a whole mana (0.1 + 0.2 style errors must not round 3.0000000001 up to 4) */
const EPS = 1e-9;

/** mana for a cost before rounding: cost / (1 − fee) × (1 + margin) */
export function manaExact(costJpy: number, rule: PriceRule = DEFAULT_PRICE_RULE): number {
  if (!(costJpy > 0)) return 0;
  return (costJpy / (1 - effectiveFeeRate(rule))) * (1 + Math.max(0, rule.margin));
}

/**
 * THE price rule (one function for everything): the whole mana that covers `costJpy` yen of provider cost, Stripe's fee
 * on the yen that bought it, and the operator's margin. ceil( cost / (1 − fee) × 1.08 ). 0 for no cost.
 */
export function manaFor(costJpy: number, rule: PriceRule = DEFAULT_PRICE_RULE): number {
  const exact = manaExact(costJpy, rule);
  return exact > 0 ? Math.ceil(exact - EPS) : 0;
}

/** the provider cost (yen) that `mana` mana pays for under the rule — the inverse of manaExact */
export function costCoveredBy(mana: number, rule: PriceRule = DEFAULT_PRICE_RULE): number {
  return (mana * (1 - effectiveFeeRate(rule))) / (1 + Math.max(0, rule.margin));
}

// ───────────────────────────── FX (USD → JPY, reviewed monthly) ─────────────────────────────

/** the rate used when no month has one yet (a conservative yen: 160 JPY per USD) — FX_USD_JPY overrides it */
export const DEFAULT_USD_JPY = 160;

/** the month key (YYYY-MM) of a moment in Japan time */
export function fxMonth(at: Date = new Date()): string {
  return new Date(at.getTime() + 9 * 3600_000).toISOString().slice(0, 7);
}

export interface FxPick {
  usdJpy: number;
  /** the month the rate was set for (null: the fallback) */
  month: string | null;
  /** the month asked for had no rate: the last known one (or the fallback) was used — log a warning */
  stale: boolean;
}

/**
 * The USD→JPY rate for `month` from the rates set per month (YYYY-MM → rate). The month's own rate; else the last month
 * before it that has one; else the latest set at all; else `fallback` (FX_USD_JPY / DEFAULT_USD_JPY). Missing = stale.
 */
export function fxFor(rates: Readonly<Record<string, number>>, month: string, fallback = DEFAULT_USD_JPY): FxPick {
  const ok = Object.entries(rates).filter(([m, r]) => /^\d{4}-\d{2}$/.test(m) && Number.isFinite(r) && r > 0);
  const own = ok.find(([m]) => m === month);
  if (own) return { usdJpy: own[1], month, stale: false };
  const before = ok.filter(([m]) => m < month).sort(([a], [b]) => (a < b ? 1 : -1))[0];
  const any = before ?? ok.sort(([a], [b]) => (a < b ? 1 : -1))[0];
  if (any) return { usdJpy: any[1], month: any[0], stale: true };
  return { usdJpy: fallback > 0 ? fallback : DEFAULT_USD_JPY, month: null, stale: true };
}

// ───────────────────────────── provider prices (what each call costs us) ─────────────────────────────

/** USD per 1M tokens (input, output). Text-out prices include thinking tokens (billed as output). */
export interface TokenPrice {
  inUsd: number;
  outUsd: number;
  /** cached input (Gemini implicit cache / Claude cache read); default = 25% of input */
  cachedUsd?: number;
}

/**
 * Gemini list prices (Google AI Studio paid tier, ≤200k prompt), USD per 1M tokens. Matched by the longest prefix of the
 * model name; unknown models use the most expensive Flash-class row so they are never under-priced.
 */
export const GEMINI_PRICES: Record<string, TokenPrice> = {
  'gemini-2.5-pro': { inUsd: 1.25, outUsd: 10 },
  'gemini-pro-latest': { inUsd: 1.25, outUsd: 10 },
  'gemini-3-pro': { inUsd: 2, outUsd: 12 },
  'gemini-2.5-flash-lite': { inUsd: 0.1, outUsd: 0.4 },
  'gemini-flash-lite-latest': { inUsd: 0.1, outUsd: 0.4 },
  'gemini-2.5-flash-image': { inUsd: 0.3, outUsd: 30 }, // a picture is 1,290 output tokens ≈ $0.039
  'gemini-2.5-flash-preview-tts': { inUsd: 0.5, outUsd: 10 },
  'gemini-2.5-flash-tts': { inUsd: 0.5, outUsd: 10 },
  'gemini-2.5-pro-preview-tts': { inUsd: 1, outUsd: 20 },
  'gemini-2.5-flash': { inUsd: 0.3, outUsd: 2.5 },
  'gemini-flash-latest': { inUsd: 0.3, outUsd: 2.5 },
  'gemini-2.0-flash': { inUsd: 0.1, outUsd: 0.4 },
};
const GEMINI_UNKNOWN: TokenPrice = { inUsd: 0.5, outUsd: 3 };
/** Google Search grounding, per request that searched (after the free daily allowance — counted in full here) */
export const GEMINI_SEARCH_USD = 0.035;

/** Claude list prices (USD per 1M tokens). */
export const CLAUDE_PRICES: Record<string, TokenPrice> = {
  'claude-haiku-5-5': { inUsd: 0.1, outUsd: 0.5, cachedUsd: 0.01 },
  'claude-haiku-4-5': { inUsd: 1, outUsd: 5, cachedUsd: 0.1 },
  'claude-sonnet-5-5': { inUsd: 2, outUsd: 10, cachedUsd: 0.1 },
  'claude-opus-5-5': { inUsd: 4, outUsd: 20, cachedUsd: 0.2 },
};
const CLAUDE_UNKNOWN: TokenPrice = { inUsd: 4, outUsd: 20, cachedUsd: 0.2 };
/** Claude's web search tool, per search */
export const CLAUDE_SEARCH_USD = 0.01;

/** Fish Audio TTS: USD per 1M UTF-8 bytes of text (Japanese ≈ 3 bytes a character) */
export const FISH_USD_PER_MBYTE = 15;

/**
 * Runware per-picture / per-task prices for when a response carries no `cost` (we always ask with includeCost: true,
 * so these are only the seed of the estimates). USD, one 1024×1024 picture (Runware's model pages, 2026-11-25).
 */
export const RUNWARE_PRICES: Record<string, number> = {
  'runware:400@4': 0.0012, // FLUX.2 [klein] 4B, ≈ ¥0.19 a picture (Model scout s02)
  'runware:400@2': 0.003, // FLUX.2 [klein] 9B
  'bfl:flux@3-image-klein': 0.0024, // FLUX 3 Image Klein (16 steps)
  'runware:z-image@turbo': 0.0023, // Z-Image Turbo (words only, no reference pictures)
  'alibaba:qwen-image@2.1-turbo': 0.01413, // Qwen-Image 2.1 Turbo with the member's look as reference (art/lab/runware-planet-avatar/costs.json: 27 pictures, $0.01413 each)
  'bytedance:seedream@5.0-flash': 0.0193,
  'prunaai:2@1': 0.0088, // P-Image Edit
  'google:nano-banana@2-lite': 0.0336,
  'bytedance:seedream@5.0-pro': 0.045, // ≈ ¥2–7 a picture at 1024 (p90 ≈ ¥7)
  'runware:ace-step@v1.5-xl-sft': 0.009, // ACE-Step 1.5 XL SFT, ≈ 60 s of song at 50 steps, scales with the length (Music lab: $0.009)
  'runware:109@1': 0.0006, // RemBG 1.4 background removal (M-R325: the cut-out's last resort; Runware's "from" price, not measured yet — the real cost is metered from each response)
  'minimax:music@2.6': 0.15, // MiniMax Music 2.6, one clip (Music lab: $0.15)
};

/**
 * R17 (client 2026-11-25): a normal song is quoted as Runware ACE-Step 1.5 XL SFT for the seconds it is sung — a song is
 * 60 s delivered (SONG_QUOTE_SECONDS) and sung 1.2× longer (SONG_QUOTE_TEMPO: delivered 1.2× faster, the pitch kept);
 * its price scales with the length (RUNWARE_PRICES is for ≈ 60 s)
 */
export const SONG_QUOTE_SECONDS = 60;
export const SONG_QUOTE_TEMPO = 1.2;
/** ACE-Step 1.5 XL SFT on Runware for `seconds` of song (USD) */
export const aceStepUsd = (seconds: number) => (RUNWARE_PRICES['runware:ace-step@v1.5-xl-sft'] * Math.max(30, seconds)) / 60;
/** our CPU for the song: the request and storing it, plus the 1.2× time-stretch (rubberband on ~60 s of audio, p90) */
export const SONG_QUOTE_CPU_SECONDS = 20 + 15;
/** painted from reference pictures, some models cost a little more (Runware's measured runs, 1024) */
export const RUNWARE_REF_PRICES: Record<string, number> = {
  'runware:400@4': 0.0019,
  'runware:400@2': 0.0035,
  'bfl:flux@3-image-klein': 0.004,
  'bytedance:seedream@5.0-pro': 0.048,
};
/** a community SDXL checkpoint (Animagine / Illustrious, civitai:…) with Runware's IP-Adapter: ≈ ¥0.3–0.5 a picture */
export const SDXL_PICTURE_USD = 0.003;
/** Gemini's own picture model: one picture is 1,290 output tokens */
export const GEMINI_PICTURE_USD: Record<string, number> = { 'gemini-2.5-flash-image': 0.039 };
/** a picture model with no price here: priced high, never under */
const PICTURE_UNKNOWN_USD = 0.05;

/** one picture on a model (a Runware AIR id, or a Gemini image model), painted with or without reference pictures */
export function pictureUsd(model: string, withRefs = false): number {
  const m = model.trim();
  if (/^gemini/i.test(m)) return byPrefix(GEMINI_PICTURE_USD, m, PICTURE_UNKNOWN_USD);
  if (withRefs && RUNWARE_REF_PRICES[m] != null) return RUNWARE_REF_PRICES[m];
  if (RUNWARE_PRICES[m] != null) return RUNWARE_PRICES[m];
  if (/^civitai:/i.test(m)) return SDXL_PICTURE_USD;
  return PICTURE_UNKNOWN_USD;
}

/** the pricing knobs that are not provider list prices (all set from the API's env) */
export interface CostRates {
  usdJpy: number;
  /** our Cloud Run GPU (L4) per second in yen (GPU_SECOND_JPY) */
  gpuSecondJpy: number;
  /** our Cloud Run CPU (the API / renders) per second in yen (CPU_SECOND_JPY) */
  cpuSecondJpy: number;
  /** R18: storage per GB-month in USD (STORAGE_GB_MONTH_USD; Cloudflare R2 $0.015) — the default when not given */
  storageGbMonthUsd?: number;
  /** R18: the months of storage a making's price includes (STORAGE_PRICE_MONTHS; 12) — the default when not given */
  storageMonths?: number;
}
export const DEFAULT_COST_RATES: CostRates = { usdJpy: DEFAULT_USD_JPY, gpuSecondJpy: 0.05, cpuSecondJpy: 0.01 };

// ───────────────────────────── R18: storage (Cloudflare R2) ─────────────────────────────

/** one GB as the quota counts it (GiB) */
export const GIB = 1024 ** 3;
/** one MB (MiB) */
export const MIB = 1024 ** 2;
/** Cloudflare R2 Standard storage per GB-month (R2's pricing page; egress free) — STORAGE_GB_MONTH_USD overrides it */
export const DEFAULT_STORAGE_GB_MONTH_USD = 0.015;
/** R18: a making's price includes this many months of storing what it made (STORAGE_PRICE_MONTHS) */
export const DEFAULT_STORAGE_PRICE_MONTHS = 12;

/** what storing `bytes` for `months` months costs (USD) at `gbMonthUsd` per GB-month */
export function storedUsd(bytes: number, months: number = DEFAULT_STORAGE_PRICE_MONTHS, gbMonthUsd: number = DEFAULT_STORAGE_GB_MONTH_USD): number {
  if (!(bytes > 0) || !(months > 0)) return 0;
  return (bytes / GIB) * months * Math.max(0, gbMonthUsd);
}

/**
 * R18 (client 2026-11-25): the bytes one making leaves in the member's Bluena (p90): pictures as stored (PNG cut-outs ≈
 * 1.5 MB), a song's delivered mix + the original + the stems a change splits (≈ 1 MB a minute each), a video's MP4
 * (720p ≈ 1.5 Mbps × 60 s ≈ 11 MB) + its poster and scenes; text (a book's chapter, a game's code) is small.
 */
export const PICTURE_STORED_BYTES = 1.5 * MIB;
export const SONG_STORED_BYTES = 6 * MIB;

/**
 * client 2026-11-25 (Mercury: the title read in the maker's voice): when a song is made by a member with a registered voice
 * (their own Fish voice model), only its title is read in that voice and kept (SongTitleVoiceService). Part of the song's
 * making (like everything painted for a profile look): the p90 title of 24 characters (≈ 72 UTF-8 bytes) on Fish
 * ($15 / 1M bytes: $0.00108 ≈ ¥0.17) + its MP3 kept 12 months (≈ 3 s at 128 kbit/s ≈ 48 KB: ≈ ¥0.0001). Quoted for every
 * song (a p90: the high side), taken only when the voice exists.
 */
export const TITLE_VOICE_CHARS = 24;
export const TITLE_VOICE_STORED_BYTES = 48 * 1024;
export const VIDEO_STORED_BYTES = 11.5 * MIB;

const byPrefix = <T>(table: Record<string, T>, model: string, unknown: T): T => {
  const m = model.replace(/^models\//, '').toLowerCase();
  const key = Object.keys(table)
    .filter((k) => m.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return key ? table[key] : unknown;
};

/** Gemini's usageMetadata (camelCase, as the SDK and the REST API return it) */
export interface GeminiUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  cachedContentTokenCount?: number;
  toolUsePromptTokenCount?: number;
}

/** what one Gemini call cost in USD: (prompt − cached) × in + cached × cachedIn + (candidates + thoughts) × out */
export function geminiCostUsd(model: string, u: GeminiUsage | null | undefined, searches = 0): number {
  const p = byPrefix(GEMINI_PRICES, model, GEMINI_UNKNOWN);
  const cached = u?.cachedContentTokenCount ?? 0;
  const prompt = (u?.promptTokenCount ?? 0) + (u?.toolUsePromptTokenCount ?? 0);
  const out = (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0);
  const cachedPrice = p.cachedUsd ?? p.inUsd * 0.25;
  return (Math.max(0, prompt - cached) * p.inUsd + cached * cachedPrice + out * p.outUsd) / 1e6 + searches * GEMINI_SEARCH_USD;
}

/** Claude's usage block */
export interface ClaudeUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
}

/** what one Claude call cost in USD (cache writes at 1.25× input) */
export function claudeCostUsd(model: string, u: ClaudeUsage | null | undefined): number {
  const p = byPrefix(CLAUDE_PRICES, model, CLAUDE_UNKNOWN);
  const read = u?.cache_read_input_tokens ?? 0;
  const write = u?.cache_creation_input_tokens ?? 0;
  const tokens = (u?.input_tokens ?? 0) * p.inUsd + write * p.inUsd * 1.25 + read * (p.cachedUsd ?? p.inUsd * 0.1) + (u?.output_tokens ?? 0) * p.outUsd;
  return tokens / 1e6 + (u?.server_tool_use?.web_search_requests ?? 0) * CLAUDE_SEARCH_USD;
}

/**
 * an estimate of one text call (USD): `tokens.out` includes the thinking. `model` is a model id or a task chain's
 * first step (`gemini:gemini-2.5-flash?think=0` — the provider prefix and the options are dropped).
 */
export function textUsd(model: string, tokens: { in: number; out: number }): number {
  const m = model.split(',')[0].trim().replace(/^(gemini|claude|anthropic|openai):/i, '').replace(/\?.*$/, '');
  if (/^claude/i.test(m)) return claudeCostUsd(m, { input_tokens: tokens.in, output_tokens: tokens.out });
  return geminiCostUsd(m, { promptTokenCount: tokens.in, candidatesTokenCount: tokens.out });
}

/** what one Fish TTS reading cost in USD (UTF-8 bytes of the text) */
export function fishCostUsd(text: string): number {
  return (new TextEncoder().encode(text).length * FISH_USD_PER_MBYTE) / 1e6;
}
/** the song title read in the maker's voice (p90: TITLE_VOICE_CHARS Japanese characters on Fish) */
export const titleVoiceUsd = () => fishCostUsd('あ'.repeat(TITLE_VOICE_CHARS));

// ───────────────────────────── the makings and their quoted mana ─────────────────────────────

/**
 * The makings that spend mana with the member's yes (the confirm card shows the mana). songPremium = the premium spell
 * on MiniMax Music 2.6 (its price is ready; the flow comes with the Runware song engine).
 * R17 (client 2026-11-25, cheaper games): gameTrial = the first game, one of the prepared templates filled in by a
 * Flash-class model; game / gameTweak = the member's own request on the cheap chain (GAME_MODEL_CHEAP); gamePro /
 * gameTweakPro = the full chain (GAME_MODEL_FULL) — a request that needs it, or a tweak the cheap chain could not make.
 * Client 2026-11-25: profileLook = the member's own profile look, everything painted for it (its candidates, the talk's
 * pictures, the back view and the figures on every home planet: profileLookParts) — taken when the first look is
 * confirmed at the end of day 2 (LookService.confirmFirstLook) and for every change after it; 'look' is {bati}'s dress-up.
 * Client 2026-11-27 (story M-R334; shared lookSteps.ts): lookStep = one evolve / transform step ({mana_step}: one edit of
 * the current picture on LOOK_STEP_MODEL), lookPick4 = the four first pictures of one's own look ({mana_pick4}),
 * batiBirth = the one picture a {bati} is born with (BATI_BIRTH_MODEL). profileLook is the script's {mana_fix}.
 */
export const MAKE_KINDS = ['look', 'kororinDesign', 'jacketArt', 'song', 'songPremium', 'songVoice', 'mv', 'story', 'game', 'gameTweak', 'mvPictures', 'mvRedraw', 'gameTrial', 'gamePro', 'gameTweakPro', 'profileLook', 'lookStep', 'lookPick4', 'batiBirth'] as const;
export type MakeKind = (typeof MAKE_KINDS)[number];
export const isMakeKind = (k: string): k is MakeKind => (MAKE_KINDS as readonly string[]).includes(k);
/** the game makings (each keeps its version on the game; each is refunded the same way) */
export const GAME_MAKE_KINDS = ['gameTrial', 'game', 'gamePro', 'gameTweak', 'gameTweakPro'] as const;
export type GameMakeKind = (typeof GAME_MAKE_KINDS)[number];
export const isGameMakeKind = (k: string): k is GameMakeKind => (GAME_MAKE_KINDS as readonly string[]).includes(k);

/** an estimated cost of one making: provider money in USD plus our own GPU / CPU seconds (a high percentile, p90) */
export interface CostEstimate {
  usd: number;
  gpuSeconds?: number;
  cpuSeconds?: number;
  /** where the number comes from (docs/マナの値段.md) */
  note: string;
  /** R18: the bytes it stores for the member (its price includes STORAGE_PRICE_MONTHS of storing them) */
  storedBytes?: number;
}

/**
 * R18 (client 2026-11-25, 君の声にする魔法): our GPU's seconds for one song sung again in the member's own voice — the
 * seed p90 of each part until recorded ones replace it (songVoice.ts): the GPU waking up, the split (HTDemucs + Whisper,
 * only when the song was never split) and the conversion (Seed-VC).
 */
export const SONG_VOICE_GPU_SEED = { cold: 40, split: 45, convert: 75 } as const;
/** the API's own seconds around it (the stems fetched, stored, the mix) */
export const SONG_VOICE_CPU_SECONDS = 10;

/**
 * R17 (client 2026-11-25: cheaper wherever the quality allows — the art is Japanese-anime-like): which model paints each
 * picture use, how many pictures a paid round paints, and which models write a game — the API's config (ART_MODEL,
 * LOOK_MODEL, BATI_MODEL, KORORIN_MODEL: a Runware AIR id or a Gemini image model; PAID_LOOK_CANDIDATES,
 * KORORIN_CANDIDATES; GAME_MODEL_TRIAL / _CHEAP / _FULL). The picture defaults are R16's models until the client picks
 * from the picture comparison (.github/workflows/runware-art-test.yml).
 */
export interface MakeSetup {
  /** an art piece (jacketArt) and {bati}'s chat picture */
  artModel: string;
  /** the member's look (the moon look, its magic) */
  lookModel: string;
  /** {bati}'s dress-up (charged as 'look') */
  batiModel: string;
  /** client 2026-11-25: the member's Saturn 2-heads chibi of each look (SATURN_CHIBI_MODEL; FLUX.2 klein 4B) */
  saturnChibiModel: string;
  /** the member's Saturn kororin ball in their own pattern (SATURN_BALL_MODEL; Qwen-Image 2.1 Turbo) */
  saturnBallModel: string;
  /** the other seven home planets' chibis of the member (PLANET_CHIBI_MODEL; Qwen-Image 2.1 Turbo) */
  planetChibiModel: string;
  /** the Saturn kororin design */
  kororinModel: string;
  /** pictures in a paid look / dress-up round (the atelier card shows them as a row to pick from) */
  paidLookCandidates: number;
  /** pictures in a kororin design (Saturn shows four to pick from, story D04-S005b) */
  kororinCandidates: number;
  gameTrialModel: string;
  gameCheapModel: string;
  gameFullModel: string;
}

export const DEFAULT_MAKE_SETUP: MakeSetup = {
  // R17 (client 2026-11-25, art/lab/runware-art): FLUX.2 klein for art / looks / kororin, Seedream 5.0 Flash for {bati}
  artModel: 'runware:400@2',
  lookModel: 'runware:400@4',
  batiModel: 'bytedance:seedream@5.0-flash',
  // client 2026-11-25 (art/lab/runware-planet-avatar): the planet figures
  saturnChibiModel: 'runware:400@4',
  saturnBallModel: 'alibaba:qwen-image@2.1-turbo',
  planetChibiModel: 'alibaba:qwen-image@2.1-turbo',
  kororinModel: 'runware:400@4',
  paidLookCandidates: 2,
  kororinCandidates: 4,
  gameTrialModel: 'gemini:gemini-2.5-flash-lite',
  gameCheapModel: 'gemini:gemini-2.5-flash',
  gameFullModel: 'gemini:gemini-2.5-pro',
};

/**
 * The token sizes (p90) of each game making; `out` includes the thinking. The trial is a small JSON of template values;
 * a build / tweak may need the repair round (its answer sent back once).
 */
export const GAME_TOKENS = {
  trial: { in: 3_000, out: 1_500 },
  cheap: { in: 12_000, out: 16_000 },
  cheapTweak: { in: 16_000, out: 14_000 },
  full: { in: 15_000, out: 30_000 },
  fullTweak: { in: 18_000, out: 24_000 },
} as const;
/** the moderation of the words around a making (Flash-Lite, a few hundred tokens) */
const WORDS_USD = 0.0005;
const short = (model: string) => model.split(',')[0].trim().replace(/^(gemini|claude|anthropic|openai):/i, '').replace(/\?.*$/, '');

/**
 * The seed of the cost table (p90 of one making, from the provider prices above) for a setup. The daily check replaces
 * a kind's estimate with the p90 of its recorded actual costs once there are enough of them (CostService).
 */
export function makeCostEstimates(s: MakeSetup = DEFAULT_MAKE_SETUP): Record<MakeKind, CostEstimate> {
  const n = (x: number) => Math.max(1, Math.round(x));
  const pics = (model: string, count: number, refs: boolean) => n(count) * pictureUsd(model, refs);
  const lookUsd = Math.max(pics(s.lookModel, s.paidLookCandidates, true), pics(s.batiModel, s.paidLookCandidates, true));
  return {
    look: { usd: lookUsd + WORDS_USD, note: `着せ替え ${s.batiModel} ×${n(s.paidLookCandidates)} 枚（参照画像つき）＋言葉の確認＋保存12か月`, storedBytes: n(s.paidLookCandidates) * PICTURE_STORED_BYTES },
    // client 2026-11-25 (decision 1): the profile look — EVERYTHING painted for one look: its candidates, the talk's
    // pictures (the standee, the small chibi, the expressions, the blink / mouth parts), the back view, the figures on
    // every home planet, the words check and 12 months of storing all of them (profileLookParts)
    profileLook: {
      usd: profileLookParts(s).reduce((a, p) => a + p.count * p.usd, 0) + WORDS_USD,
      note: profileLookParts(s)
        .map((p) => `${p.label} ${p.model} ×${p.count}`)
        .join('＋')
        .concat('（どれも姿を参照）＋言葉の確認＋保存12か月'),
      storedBytes: (n(s.paidLookCandidates) + LOOK_SET_STORED.pictures + PLANET_FIGURE_COUNT) * PICTURE_STORED_BYTES + LOOK_SET_STORED.patches * LOOK_PART_STORED_BYTES + PLANET_FIGURE_COUNT * FIGURE_SOURCE_STORED_BYTES,
    },
    kororinDesign: { usd: pics(s.kororinModel, s.kororinCandidates, true) + WORDS_USD, cpuSeconds: 10, note: `${s.kororinModel} ×${n(s.kororinCandidates)} 枚（見本の絵つき）＋切り抜き CPU＋保存12か月`, storedBytes: n(s.kororinCandidates) * PICTURE_STORED_BYTES },
    jacketArt: { usd: pics(s.artModel, 1, false) + WORDS_USD, note: `${s.artModel} ×1 枚＋言葉の確認＋保存12か月`, storedBytes: PICTURE_STORED_BYTES },
    // R17: sung on Runware (aceStepUsd for the seconds it is sung: 60 s delivered, 1.2× longer sung) + the 1.2× stretch
    // CPU + the song's design (Flash-Lite). The lyrics are written before the yes (their own small cost, 'lyrics'); our GPU
    // splits only for a change that needs it — that change's own small cost (songEdit), not the song's
    // client 2026-11-25: + the title read in the maker's own voice (Fish, TITLE_VOICE_CHARS; only when they have one)
    song: { usd: aceStepUsd(SONG_QUOTE_SECONDS * SONG_QUOTE_TEMPO) + textUsd('gemini-flash-lite-latest', { in: 3_000, out: 1_500 }) + WORDS_USD + titleVoiceUsd(), cpuSeconds: SONG_QUOTE_CPU_SECONDS, note: 'Runware ACE-Step 1.5 XL SFT（60秒の曲を1.2倍の72秒ぶん歌う、長さに比例）＋1.2倍速の処理 CPU＋曲の設計 Gemini Flash-Lite＋曲名の読み上げ（自分の声 Fish）＋保存12か月（mp3・元の曲・分けた音 約6MB）', storedBytes: SONG_STORED_BYTES + TITLE_VOICE_STORED_BYTES },
    songPremium: { usd: RUNWARE_PRICES['minimax:music@2.6'] + 0.004 + titleVoiceUsd(), cpuSeconds: SONG_QUOTE_CPU_SECONDS, note: 'MiniMax Music 2.6 ×1 曲（$0.15）＋1.2倍速の処理 CPU＋設計・歌詞＋曲名の読み上げ（自分の声 Fish）＋保存12か月', storedBytes: SONG_STORED_BYTES + TITLE_VOICE_STORED_BYTES },
    songVoice: { usd: 0, gpuSeconds: SONG_VOICE_GPU_SEED.cold + SONG_VOICE_GPU_SEED.split + SONG_VOICE_GPU_SEED.convert, cpuSeconds: SONG_VOICE_CPU_SECONDS, note: '君の声にする魔法：自社 GPU（起動＋分離＋Seed-VC）p90 160秒。分離ずみの曲は変換だけ（songVoiceQuote）＋保存12か月（君の声の歌と曲 約4MB）', storedBytes: 4 * MIB },
    mv: { usd: 12 * RUNWARE_PRICES['runware:400@4'] + 0.006, cpuSeconds: 240, note: 'FLUX.2 klein 4B ×12 場面＋演出 Gemini＋描画 CPU p90 240秒＋保存12か月（MP4・場面の絵 約13MB）', storedBytes: VIDEO_STORED_BYTES + 12 * 0.125 * MIB },
    story: { usd: textUsd('gemini-flash-lite-latest', { in: 2_500, out: 1_700 }) + WORDS_USD, note: 'お話 Gemini Flash-Lite（入力 約2,500・出力 約1,700トークン）＋言葉の確認', storedBytes: 16 * 1024 },
    gameTrial: { usd: textUsd(s.gameTrialModel, GAME_TOKENS.trial) + WORDS_USD, note: `型のゲーム ${short(s.gameTrialModel)}（型の値だけ：入力 約3千・出力 約1,500トークン）`, storedBytes: 64 * 1024 },
    game: { usd: textUsd(s.gameCheapModel, GAME_TOKENS.cheap) + WORDS_USD, note: `ゲーム ${short(s.gameCheapModel)}（入力 約1.2万・出力＋思考 約1.6万トークン）`, storedBytes: 128 * 1024 },
    gamePro: { usd: textUsd(s.gameFullModel, GAME_TOKENS.full) + WORDS_USD, note: `大きなゲーム ${short(s.gameFullModel)}（入力 約1.5万・出力＋思考 約3万トークン）`, storedBytes: 256 * 1024 },
    gameTweak: { usd: textUsd(s.gameCheapModel, GAME_TOKENS.cheapTweak) + WORDS_USD, note: `ゲームの直し ${short(s.gameCheapModel)}（今のコード＋直し）`, storedBytes: 128 * 1024 },
    gameTweakPro: { usd: textUsd(s.gameFullModel, GAME_TOKENS.fullTweak) + WORDS_USD, note: `ゲームの直し・強い魔法 ${short(s.gameFullModel)}（ふつうの直しが2回とも通らなかった時）`, storedBytes: 256 * 1024 },
    mvPictures: { usd: 0.002, cpuSeconds: 180, note: '動き選び Gemini＋描画 CPU p90 180秒＋保存12か月（MP4 約11MB）', storedBytes: VIDEO_STORED_BYTES },
    // client 2026-11-27: one evolve / transform step — one edit of the current picture on FLUX.2 klein 4B, the check of
    // what was said, and the checked cut-out every picture goes through (the background-removal model + one look by the
    // vision model: CUT_CHECK_USD) → 0.6 mana (client 2026-11-27: the checks are in the price, nothing absorbed)
    lookStep: { usd: pictureUsd(LOOK_STEP_MODEL, true) + WORDS_USD + CUT_CHECK_USD, note: `進化・変身の1回 ${LOOK_STEP_MODEL} ×1 枚（今の姿を参照）＋言葉の確認＋切り抜きの確かめ＋保存12か月`, storedBytes: PICTURE_STORED_BYTES },
    // the four first pictures of one's own look (four touches, 2 / 3 / 5 / 7 heads), each from the photo, each cut out
    lookPick4: {
      usd: LOOK_PICK4_HEADS.length * (pictureUsd(s.lookModel, true) + CUT_CHECK_USD) + WORDS_USD,
      note: `自分の姿の4枚 ${s.lookModel} ×${LOOK_PICK4_HEADS.length} 枚（写真を参照）＋言葉の確認＋切り抜きの確かめ ×${LOOK_PICK4_HEADS.length}＋保存12か月`,
      storedBytes: LOOK_PICK4_HEADS.length * PICTURE_STORED_BYTES,
    },
    // the one picture a {bati} is born with (the food itself as a character). Client 2026-11-27: 3.6 mana as approved —
    // its cut-out check (CUT_CHECK_USD) is not in it (with it: 3.7)
    batiBirth: { usd: pictureUsd(BATI_BIRTH_MODEL, false), note: `バティの誕生の絵 ${BATI_BIRTH_MODEL} ×1 枚＋保存12か月`, storedBytes: PICTURE_STORED_BYTES },
    mvRedraw: { usd: 4 * RUNWARE_PRICES['runware:400@4'] + 0.002, cpuSeconds: 180, note: 'FLUX.2 klein 4B ×最大4 場面＋描画 CPU＋保存12か月（新しい MP4・場面）', storedBytes: VIDEO_STORED_BYTES + 4 * 0.125 * MIB },
  };
}

/**
 * Client 2026-11-25 (decision 1): what the talk job paints for one look of one's own (LookService.talkLook, apps/api
 * look/talk.ts; LOOK_MODEL = FLUX.2 klein 4B, each with the look as reference): the standee (the look standing, the talk's
 * normal face), the small chibi NEO (POST /me/look/chibi, made with the talk now), the expressions SELF_TALK_FACES but
 * 'normal' (smile, surprised, shy: 'thinking' and 'sad' are {bati}'s only, 'normal' is the standee itself), and an
 * eyes-closed and an open-mouth edit of each TALK_PART_FACES face (normal, smile). No コロリン mini any more (M-R241).
 * A picture that fails is painted again once (settleWithRetry) and a cut-out too near its key colour is re-keyed by one
 * more edit (cutoutChecked): neither is counted, like the figures' second try.
 */
export const LOOK_TALK_PICTURES = { standee: 1, chibi: 1, faces: 3, parts: 4 } as const;
/** client 2026-11-25: the member's back view (後ろ姿; LookService.backView, LOOK_MODEL with the standee as reference) */
export const LOOK_BACK_PICTURES = 1;
/**
 * what one look keeps in Bluena besides its candidates and figures: the standee, the chibi, the three expressions, the
 * back view and the round icon (cut by CPU from the look) as pictures; the four blink / mouth parts as small patches
 */
export const LOOK_SET_STORED = { pictures: 7, patches: 4 } as const;
/** one blink / mouth patch (a small cut-out PNG around the eyes or the mouth) */
export const LOOK_PART_STORED_BYTES = 0.125 * MIB;

/**
 * M-R326: the cut-out's always-on checks, per cut picture — Runware's background removal (CUTOUT_MODEL; RemBG 1.4) and
 * one look by the cheap vision model (Gemini Flash-Lite: one 768×384 sheet ≈ 520 tokens, the question ≈ 180, the answer ≈ 20).
 */
export const CUTOUT_CHECK_MODEL = 'runware:109@1';
export const CUTOUT_VISION_MODEL = 'gemini-flash-lite-latest';
export const CUTOUT_VISION_TOKENS = { in: 700, out: 20 } as const;
export const CUTOUT_VISION_USD = (CUTOUT_VISION_TOKENS.in * GEMINI_PRICES[CUTOUT_VISION_MODEL].inUsd + CUTOUT_VISION_TOKENS.out * GEMINI_PRICES[CUTOUT_VISION_MODEL].outUsd) / 1e6;
/** the always-on checks of one cut-out picture (the model's cut + the vision model's look), USD */
export const CUT_CHECK_USD = RUNWARE_PRICES[CUTOUT_CHECK_MODEL] + CUTOUT_VISION_USD;
/** the cut-out pictures of one profile look: the standee, the small chibi, three expressions, four blink / mouth parts, the back view and the nine figures */
export const LOOK_CUT_PICTURES = LOOK_TALK_PICTURES.standee + LOOK_TALK_PICTURES.chibi + LOOK_TALK_PICTURES.faces + LOOK_TALK_PICTURES.parts + LOOK_BACK_PICTURES + 9;
/** M-R325: the painting each figure was cut from is kept beside it (a JPEG, about a quarter of a megabyte), so a later cut-out needs no painting */
export const FIGURE_SOURCE_STORED_BYTES = 0.25 * MIB;

/** one line of the profile look's price: what is painted, on which model, how many, at what each (USD) */
export interface ProfileLookPart {
  label: string;
  model: string;
  count: number;
  usd: number;
}
/** client 2026-11-25 (decision 1): the pictures of one profile look, line by line (makeCostEstimates' profileLook) */
export function profileLookParts(s: MakeSetup = DEFAULT_MAKE_SETUP): ProfileLookPart[] {
  const t = LOOK_TALK_PICTURES;
  const look = (label: string, count: number): ProfileLookPart => ({ label, model: s.lookModel, count, usd: pictureUsd(s.lookModel, true) });
  return [
    look('姿の候補', Math.max(1, Math.round(s.paidLookCandidates))),
    look('立ち姿', t.standee),
    look('小さなちびNEO', t.chibi),
    look('話す時の表情（笑顔・おどろき・てれ）', t.faces),
    look('まばたき・口の部品', t.parts),
    look('後ろ姿', LOOK_BACK_PICTURES),
    { label: '土星のちびキャラ', model: s.saturnChibiModel, count: 1, usd: pictureUsd(s.saturnChibiModel, true) },
    { label: '土星のボール', model: s.saturnBallModel, count: 1, usd: pictureUsd(s.saturnBallModel, true) },
    { label: '7つの星のちびキャラ', model: s.planetChibiModel, count: PLANET_FIGURE_COUNT - 2, usd: pictureUsd(s.planetChibiModel, true) },
    // M-R326: every cut-out picture is checked — always: the background-removal model cuts it too (the shapes are
    // compared) and the cheap vision model looks at it on dark and on light. The retries (the model's cut used, a
    // repaint on the key colour, one more) are not counted, like the figures' second try: they are in the daily p90.
    { label: '切り抜きの確かめ（背景を取るモデルと形を比べる）', model: CUTOUT_CHECK_MODEL, count: LOOK_CUT_PICTURES, usd: RUNWARE_PRICES[CUTOUT_CHECK_MODEL] },
    { label: '切り抜きの確かめ（暗い・明るい背景で見る）', model: CUTOUT_VISION_MODEL, count: LOOK_CUT_PICTURES, usd: CUTOUT_VISION_USD },
  ];
}
/** the pictures of a profile look, without the checks' lines (what is painted) */
export const profileLookPictures = (s: MakeSetup = DEFAULT_MAKE_SETUP): number =>
  profileLookParts(s)
    .filter((p) => p.model !== CUTOUT_CHECK_MODEL && p.model !== CUTOUT_VISION_MODEL)
    .reduce((a, p) => a + p.count, 0);

/** client 2026-11-25: the figures of one look — the Saturn chibi, the Saturn ball and the seven other planets' chibis */
export const PLANET_FIGURE_COUNT = 9;
/** what the figures of one look cost (USD), each painted with the look as reference */
export function planetFiguresUsd(s: Pick<MakeSetup, 'saturnChibiModel' | 'saturnBallModel' | 'planetChibiModel'> = DEFAULT_MAKE_SETUP): number {
  return pictureUsd(s.saturnChibiModel, true) + pictureUsd(s.saturnBallModel, true) + (PLANET_FIGURE_COUNT - 2) * pictureUsd(s.planetChibiModel, true);
}

/** the seed table at the default setup */
export const MAKE_COST_ESTIMATE: Record<MakeKind, CostEstimate> = makeCostEstimates();

/** the yen an estimate comes to at these rates */
export function estimateJpy(e: CostEstimate, rates: CostRates = DEFAULT_COST_RATES): number {
  const stored = storedUsd(e.storedBytes ?? 0, rates.storageMonths ?? DEFAULT_STORAGE_PRICE_MONTHS, rates.storageGbMonthUsd ?? DEFAULT_STORAGE_GB_MONTH_USD);
  return (e.usd + stored) * rates.usdJpy + (e.gpuSeconds ?? 0) * rates.gpuSecondJpy + (e.cpuSeconds ?? 0) * rates.cpuSecondJpy;
}

/** R18: the yen of an estimate that is storage (bytes × months × the GB-month price) */
export function storageJpyOf(e: CostEstimate, rates: CostRates = DEFAULT_COST_RATES): number {
  return storedUsd(e.storedBytes ?? 0, rates.storageMonths ?? DEFAULT_STORAGE_PRICE_MONTHS, rates.storageGbMonthUsd ?? DEFAULT_STORAGE_GB_MONTH_USD) * rates.usdJpy;
}

/**
 * Client 2026-11-25 (R17): a cheap making shows its real price below 1 mana (「使うマナ 0.3」), never rounded up to 1.
 * The rule to the tenth: ceil( cost / (1 − fee) × 1.08 × 10 ) / 10, 0 for no cost.
 */
export function manaFor10(costJpy: number, rule: PriceRule = DEFAULT_PRICE_RULE): number {
  const exact = manaExact(costJpy, rule);
  return exact > 0 ? Math.ceil(exact * 10 - EPS * 10) / 10 : 0;
}

/** a making's quoted mana: manaFor10(its estimated cost) — a tenth of a mana at least */
export function quoteMana(costJpy: number, rule: PriceRule = DEFAULT_PRICE_RULE): number {
  return Math.max(0.1, manaFor10(costJpy, rule));
}

/** a price in tenths of a mana (the ledger's exact unit for a quoted price: 0.3 → 3, 12.5 → 125) */
export const manaTenths = (mana: number): number => Math.round(mana * 10);
/** a price as it is taken: the whole mana now (a ledger row) and the tenths left over (waiting with the small costs) */
export function splitMana(mana: number): { whole: number; tenths: number } {
  const t = Math.max(0, manaTenths(mana));
  return { whole: Math.floor(t / 10), tenths: t % 10 };
}
/** a mana number as it is shown: 「3」「0.3」「12.5」 */
export function formatMana(mana: number): string {
  const t = manaTenths(mana);
  return t % 10 === 0 ? String(t / 10) : (t / 10).toFixed(1);
}
/**
 * R17: the monthly line a 'usage' row is shown in (its ref_type): the tenths of paid makings by what was made
 * (「つかったマナ（絵）」), the small costs of the free features as before (「つかったマナ（おしゃべり・声など）」)
 */
export const USAGE_LINES = ['usage', 'usage:art', 'usage:song', 'usage:video', 'usage:game', 'usage:story'] as const;
export type UsageLine = (typeof USAGE_LINES)[number];
export function usageLineOf(refType: string | null | undefined): UsageLine {
  switch (refType) {
    case 'look':
    case 'lookStep':
    case 'lookPick4':
    case 'batiBirth':
    case 'profileLook':
    case 'kororinDesign':
    case 'jacketArt':
      return 'usage:art';
    case 'song':
    case 'songPremium':
    case 'songVoice':
      return 'usage:song';
    case 'mv':
    case 'mvPictures':
    case 'mvRedraw':
      return 'usage:video';
    case 'game':
    case 'gameTrial':
    case 'gamePro':
    case 'gameTweak':
    case 'gameTweakPro':
      return 'usage:game';
    case 'story':
      return 'usage:story';
    default:
      return 'usage';
  }
}

/** a quoted price has at most one decimal */
export const isTenthMana = (n: number): boolean => Number.isFinite(n) && Math.abs(n * 10 - Math.round(n * 10)) < 1e-6;

export type ManaPrices = Record<MakeKind, number>;

/**
 * every making's mana at these rates (`costJpy` overrides a kind's estimate in yen — the refined, recorded p90; `table`
 * is the seed table of the API's setup, makeCostEstimates)
 */
export function manaPrices(
  rates: CostRates = DEFAULT_COST_RATES,
  rule: PriceRule = DEFAULT_PRICE_RULE,
  costJpy: Partial<Record<MakeKind, number>> = {},
  table: Record<MakeKind, CostEstimate> = MAKE_COST_ESTIMATE,
): ManaPrices {
  const out = {} as ManaPrices;
  for (const k of MAKE_KINDS) out[k] = quoteMana(costJpy[k] ?? estimateJpy(table[k], rates), rule);
  return out;
}

/**
 * The mana of each making at the default rates (160 JPY/USD, Stripe 3.6%, 8%) — only a FALLBACK: the API serves the
 * live prices (GET /mana/prices, CostService) and charges exactly those; the browser shows these until they arrive.
 */
export const MAKE_COST: Readonly<ManaPrices> = Object.freeze(manaPrices());

// ───────────────────────────── the small costs of the free features ─────────────────────────────

/**
 * What the free features are recorded as (gen_costs.kind / the usage row's ref_type). Their cost is added up per member
 * and taken a whole mana at a time (R18: a non-member past the first journey is stopped at 0 mana — access.ts). 'dachi'
 * (the ダチ talk) is never taken: an unrecovered marketing cost. 'figures' (client 2026-11-25: the planet figures of a
 * look no one paid for — only where nobody can pay any more: the admin backfill for looks decided before the first look
 * was charged, and a look worn again whose figures were never made) is never taken either: absorbed like 'dachi'
 * (ABSORBED_FEATURES). The first look's figures are part of its profileLook price now (client 2026-11-25: nothing absorbed).
 * 'titleVoice' (client 2026-11-25, Mercury): a song title read in its maker's voice outside a paid song's making — a song
 * made without mana, a post that flies under another title, the admin backfill — is absorbed too (a paid song's is in its
 * price: TITLE_VOICE_CHARS).
 */
export const USAGE_FEATURES = ['chat', 'search', 'draw', 'voice', 'spell', 'lyrics', 'compass', 'songEdit', 'videoEdit', 'novel', 'unfurl', 'listen', 'memory', 'look', 'story', 'dachi', 'figures', 'titleVoice', 'cutRetry', 'other'] as const;
export type UsageFeature = (typeof USAGE_FEATURES)[number];
/**
 * the free costs the operator absorbs (recorded, never taken from the member). 'cutRetry' (client 2026-11-27): what a
 * cut-out's retries cost outside a paid making — the repaints after a failed check and the checks of those
 * (LookService.ladder); the member pays a picture once, never its retries
 */
export const ABSORBED_FEATURES: readonly string[] = ['dachi', 'figures', 'titleVoice', 'cutRetry'];

export interface AccrualStep {
  /** mana to take now (a ledger row of this many, reason 'usage') */
  take: number;
  /** mana that could not be taken (the balance was too small): absorbed by the operator, logged */
  absorbedMana: number;
  /** the yen of cost those absorbed mana stood for */
  absorbedJpy: number;
  /** the yen still waiting (less than one mana's worth) */
  pendingJpy: number;
}

/**
 * One small cost added to a member's waiting yen. When the waiting yen reach a whole mana under the price rule
 * (floor(manaExact) ≥ 1) that many mana are taken — at most the balance (never negative). What the balance cannot
 * cover is absorbed (and logged as unrecovered), never carried over: a member at 0 mana keeps the free features.
 */
export function accrueUsage(pendingJpy: number, addJpy: number, balance: number, rule: PriceRule = DEFAULT_PRICE_RULE): AccrualStep {
  const waiting = Math.max(0, pendingJpy) + Math.max(0, addJpy);
  const whole = Math.floor(manaExact(waiting, rule) + EPS);
  if (whole < 1) return { take: 0, absorbedMana: 0, absorbedJpy: 0, pendingJpy: waiting };
  const take = Math.min(whole, Math.max(0, Math.floor(balance)));
  const absorbedMana = whole - take;
  const left = Math.max(0, waiting - costCoveredBy(whole, rule));
  return { take, absorbedMana, absorbedJpy: costCoveredBy(absorbedMana, rule), pendingJpy: left < 1e-12 ? 0 : left };
}

// ───────────────────────────── the daily margin check ─────────────────────────────

export interface MarginRow {
  kind: string;
  /** makings (or usage rows) in the window */
  count: number;
  /** mana taken (charges minus refunds; for usage: usage rows) */
  chargedMana: number;
  /** recorded provider cost (yen) */
  costJpy: number;
  /** cost + Stripe's fee on the mana's yen: what the mana must at least bring in */
  costWithFeeJpy: number;
  /** the yen the mana brings in after Stripe's fee */
  netJpy: number;
  /** netJpy / costJpy − 1 (null without cost) */
  margin: number | null;
  /** margin below the rule's 8% */
  low: boolean;
  /** the price the recorded costs call for (p90 of one making), when the kind is a making */
  suggestedMana: number | null;
  currentMana: number | null;
}

/** one kind's line of the margin report */
export function marginRow(o: { kind: string; count: number; chargedMana: number; costJpy: number; perJobCostsJpy?: number[]; currentMana?: number | null }, rule: PriceRule = DEFAULT_PRICE_RULE): MarginRow {
  const fee = effectiveFeeRate(rule);
  const netJpy = o.chargedMana * (1 - fee);
  const costWithFeeJpy = o.costJpy / (1 - fee);
  const margin = o.costJpy > 0 ? netJpy / o.costJpy - 1 : null;
  const p90 = o.perJobCostsJpy?.length ? percentile(o.perJobCostsJpy, 0.9) : null;
  return {
    kind: o.kind,
    count: o.count,
    chargedMana: o.chargedMana,
    costJpy: round2(o.costJpy),
    costWithFeeJpy: round2(costWithFeeJpy),
    netJpy: round2(netJpy),
    margin: margin == null ? null : Math.round(margin * 10_000) / 10_000,
    low: margin != null && margin < rule.margin - 1e-6,
    suggestedMana: p90 == null ? null : quoteMana(p90, rule),
    currentMana: o.currentMana ?? null,
  };
}

/** the p-th percentile (nearest rank) of some numbers */
export function percentile(xs: readonly number[], p: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
