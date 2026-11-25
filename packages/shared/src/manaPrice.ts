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
 * so these are only the seed of the estimates). USD.
 */
export const RUNWARE_PRICES: Record<string, number> = {
  'runware:400@4': 0.0012, // FLUX.2 [klein] 4B, ≈ ¥0.19 a picture (Model scout s02)
  'runware:400@2': 0.003, // FLUX.2 [klein] 9B
  'alibaba:qwen-image@2.1-turbo': 0.01,
  'bytedance:seedream@5.0-pro': 0.045, // ≈ ¥2–7 a picture at 1024 (p90 ≈ ¥7)
  'ace-step-1.5-xl-sft:60s': 0.009, // ACE-Step 1.5 XL SFT, 60 s of song at 50 steps (scales with the length)
  'minimax:music@2.6': 0.15, // MiniMax Music 2.6, one clip
};

/** the pricing knobs that are not provider list prices (all set from the API's env) */
export interface CostRates {
  usdJpy: number;
  /** our Cloud Run GPU (L4) per second in yen (GPU_SECOND_JPY) */
  gpuSecondJpy: number;
  /** our Cloud Run CPU (the API / renders) per second in yen (CPU_SECOND_JPY) */
  cpuSecondJpy: number;
}
export const DEFAULT_COST_RATES: CostRates = { usdJpy: DEFAULT_USD_JPY, gpuSecondJpy: 0.05, cpuSecondJpy: 0.01 };

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

/** what one Fish TTS reading cost in USD (UTF-8 bytes of the text) */
export function fishCostUsd(text: string): number {
  return (new TextEncoder().encode(text).length * FISH_USD_PER_MBYTE) / 1e6;
}

// ───────────────────────────── the makings and their quoted mana ─────────────────────────────

/**
 * The makings that spend mana with the member's yes (the confirm card shows the mana). songPremium = the premium spell
 * on MiniMax Music 2.6 (its price is ready; the flow comes with the Runware song engine).
 */
export const MAKE_KINDS = ['look', 'kororinDesign', 'jacketArt', 'song', 'songPremium', 'mv', 'story', 'game', 'gameTweak', 'mvPictures', 'mvRedraw'] as const;
export type MakeKind = (typeof MAKE_KINDS)[number];
export const isMakeKind = (k: string): k is MakeKind => (MAKE_KINDS as readonly string[]).includes(k);

/** an estimated cost of one making: provider money in USD plus our own GPU / CPU seconds (a high percentile, p90) */
export interface CostEstimate {
  usd: number;
  gpuSeconds?: number;
  cpuSeconds?: number;
  /** where the number comes from (docs/マナの値段.md) */
  note: string;
}

/**
 * The seed of the cost table (p90 of one making, from the provider prices above). The daily check replaces a kind's
 * estimate with the p90 of its recorded actual costs once there are enough of them (CostService).
 */
export const MAKE_COST_ESTIMATE: Record<MakeKind, CostEstimate> = {
  look: { usd: 4 * RUNWARE_PRICES['bytedance:seedream@5.0-pro'] + 0.002, note: 'Seedream 5.0 Pro ×4 枚（1枚 p90 約7円）＋文章 Gemini' },
  kororinDesign: { usd: 4 * RUNWARE_PRICES['bytedance:seedream@5.0-pro'], cpuSeconds: 10, note: 'Seedream 5.0 Pro ×4 枚＋切り抜き CPU' },
  jacketArt: { usd: 0.039 + 0.002, note: 'Gemini 2.5 Flash Image ×1 枚（約 $0.039）＋文章' },
  song: { usd: 0.004, gpuSeconds: 240, cpuSeconds: 20, note: '自社 GPU（ACE-Step＋分離＋声）p90 240秒＋曲の設計・歌詞 Gemini' },
  songPremium: { usd: RUNWARE_PRICES['minimax:music@2.6'] + 0.004, cpuSeconds: 20, note: 'MiniMax Music 2.6 ×1 曲（$0.15）＋設計・歌詞' },
  mv: { usd: 12 * RUNWARE_PRICES['runware:400@4'] + 0.006, cpuSeconds: 240, note: 'FLUX.2 klein 4B ×12 場面＋演出 Gemini＋描画 CPU p90 240秒' },
  story: { usd: 0.01, note: 'お話 Gemini Flash（数千トークン）' },
  game: { usd: 0.35, note: 'Gemini 2.5 Pro（入力 約1.5万・出力＋思考 約3万トークン）' },
  gameTweak: { usd: 0.3, note: 'Gemini 2.5 Pro（今のコード＋直し、出力＋思考 約3万トークン）' },
  mvPictures: { usd: 0.002, cpuSeconds: 180, note: '動き選び Gemini＋描画 CPU p90 180秒' },
  mvRedraw: { usd: 4 * RUNWARE_PRICES['runware:400@4'] + 0.002, cpuSeconds: 180, note: 'FLUX.2 klein 4B ×最大4 場面＋描画 CPU' },
};

/** the yen an estimate comes to at these rates */
export function estimateJpy(e: CostEstimate, rates: CostRates = DEFAULT_COST_RATES): number {
  return e.usd * rates.usdJpy + (e.gpuSeconds ?? 0) * rates.gpuSecondJpy + (e.cpuSeconds ?? 0) * rates.cpuSecondJpy;
}

/** a making's quoted mana: manaFor(its estimated cost), at least 1 */
export function quoteMana(costJpy: number, rule: PriceRule = DEFAULT_PRICE_RULE): number {
  return Math.max(1, manaFor(costJpy, rule));
}

export type ManaPrices = Record<MakeKind, number>;

/** every making's mana at these rates (`costJpy` overrides a kind's estimate in yen — the refined, recorded p90) */
export function manaPrices(rates: CostRates = DEFAULT_COST_RATES, rule: PriceRule = DEFAULT_PRICE_RULE, costJpy: Partial<Record<MakeKind, number>> = {}): ManaPrices {
  const out = {} as ManaPrices;
  for (const k of MAKE_KINDS) out[k] = quoteMana(costJpy[k] ?? estimateJpy(MAKE_COST_ESTIMATE[k], rates), rule);
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
 * and taken a whole mana at a time; they are never blocked at 0 mana.
 */
export const USAGE_FEATURES = ['chat', 'search', 'draw', 'voice', 'spell', 'lyrics', 'compass', 'songEdit', 'videoEdit', 'novel', 'unfurl', 'listen', 'memory', 'look', 'story', 'other'] as const;
export type UsageFeature = (typeof USAGE_FEATURES)[number];

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
