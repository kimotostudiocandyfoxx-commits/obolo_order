import { claudeCostUsd, fishCostUsd, geminiCostUsd, RUNWARE_PRICES, type ClaudeUsage, type GeminiUsage } from '@obolo/shared';

/**
 * Client 2026-11-25 (docs/マナの値段.md): every provider call reports what it cost, here. The API installs the sink
 * (apps/api/src/wallet/cost.service.ts): it knows who the call was for and which making / feature it belongs to (an
 * AsyncLocalStorage scope set per request and per job), records the cost and, for the free features, adds it to the
 * member's small costs. Without a sink (tests, scripts) a report does nothing.
 */
export interface CostEvent {
  provider: 'gemini' | 'claude' | 'runware' | 'fish' | 'novita' | 'openai' | 'gpu' | 'cpu';
  model: string;
  /** provider money in USD */
  usd?: number;
  /** our own machine seconds (priced in yen by the sink: GPU_SECOND_JPY / CPU_SECOND_JPY) */
  seconds?: number;
  /** the units the price came from (tokens, bytes, pictures, seconds) */
  units?: Record<string, number>;
  /** the provider said the cost (Runware `cost`, token counts) — false: our price table's guess */
  exact: boolean;
}

export type CostSink = (e: CostEvent) => void;
let sink: CostSink | null = null;

/** the API's recorder (one per process); null turns reporting off */
export function setCostSink(s: CostSink | null): void {
  sink = s;
}

/** report one call's cost (never throws: metering must not break the work) */
export function reportCost(e: CostEvent): void {
  if (!sink) return;
  try {
    if ((e.usd ?? 0) <= 0 && (e.seconds ?? 0) <= 0) return;
    sink(e);
  } catch {
    // ignored: a recorder failure is logged by the recorder itself
  }
}

/** a Gemini call: its usageMetadata × the model's token price (GEMINI_PRICES) */
export function meterGemini(model: string, usage: GeminiUsage | null | undefined, searches = 0): void {
  if (!usage && !searches) return;
  reportCost({
    provider: 'gemini',
    model,
    usd: geminiCostUsd(model, usage, searches),
    units: { in: usage?.promptTokenCount ?? 0, out: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0), cached: usage?.cachedContentTokenCount ?? 0, searches },
    exact: !!usage,
  });
}

/** a raw Gemini REST response, metered from its usageMetadata, handed back as it is */
export function meteredGemini<T>(model: string, json: T): T {
  meterGemini(model, (json as { usageMetadata?: GeminiUsage } | null)?.usageMetadata);
  return json;
}

/** a Claude call: its usage × the model's token price (CLAUDE_PRICES) */
export function meterClaude(model: string, usage: ClaudeUsage | null | undefined): void {
  if (!usage) return;
  reportCost({ provider: 'claude', model, usd: claudeCostUsd(model, usage), units: { in: usage.input_tokens ?? 0, out: usage.output_tokens ?? 0, searches: usage.server_tool_use?.web_search_requests ?? 0 }, exact: true });
}

/**
 * Runware results (asked with includeCost: true): the `cost` each one carries, in USD. A result without it is priced from
 * RUNWARE_PRICES (not exact). `model` names the task's model.
 */
export function meterRunware(model: string, results: readonly ({ cost?: number | null } | null | undefined)[]): void {
  let usd = 0;
  let exact = true;
  let n = 0;
  for (const r of results) {
    if (!r) continue;
    n++;
    if (typeof r.cost === 'number' && r.cost >= 0) usd += r.cost;
    else {
      exact = false;
      usd += RUNWARE_PRICES[model] ?? 0.01;
    }
  }
  if (n) reportCost({ provider: 'runware', model, usd, units: { results: n }, exact });
}

/** a Fish TTS reading (UTF-8 bytes × FISH_USD_PER_MBYTE) */
export function meterFish(model: string, text: string): void {
  reportCost({ provider: 'fish', model, usd: fishCostUsd(text), units: { bytes: new TextEncoder().encode(text).length }, exact: true });
}

/** our own GPU / CPU time on a piece of work (seconds of wall time) */
export function meterSeconds(provider: 'gpu' | 'cpu', model: string, seconds: number): void {
  if (seconds > 0) reportCost({ provider, model, seconds, units: { seconds: Math.round(seconds * 10) / 10 }, exact: false });
}

/** time an async piece of work on our GPU / CPU and report it (also when it fails: the machine ran) */
export async function timed<T>(provider: 'gpu' | 'cpu', model: string, work: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try {
    return await work();
  } finally {
    meterSeconds(provider, model, (Date.now() - t0) / 1000);
  }
}
