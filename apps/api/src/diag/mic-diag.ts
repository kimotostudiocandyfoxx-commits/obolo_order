import { MIC_DIAG_KEEP, type MicDiagBody, type MicDiagEntry, type MicDiagView } from '@obolo/shared';
import type { KvStore } from '../infra/kv';

/**
 * Mic failures from the web app, kept small for the operator (docs/mic.md): the last MIC_DIAG_KEEP reports and a count
 * per day and "os/browser fault", both in the key-value store for two weeks. No member id, no address, no user agent.
 * The list is read-change-written without a lock: two reports at the same instant may lose one of the two in the list
 * (the day's count is not touched by that — it is one small JSON too, with the same small risk). Good enough to see
 * which phone and browser fail, and how often.
 */
const TTL = 14 * 86400;
const RECENT = 'diag:mic:recent';
const dayKey = (day: string) => `diag:mic:day:${day}`;

/** the day in Japan (the members' day) */
export function tokyoDay(at: Date): string {
  return new Date(at.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export const countKey = (r: Pick<MicDiagBody, 'os' | 'browser' | 'fault' | 'inApp'>) => `${r.os}/${r.browser}${r.inApp ? '(in-app)' : ''} ${r.fault}`;

function parse<T>(raw: string | null, empty: T): T {
  if (!raw) return empty;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return empty;
  }
}

export async function recordMicDiag(kv: KvStore, body: MicDiagBody, now = new Date()): Promise<MicDiagEntry> {
  const entry: MicDiagEntry = { ...body, at: now.toISOString() };
  const list = parse<MicDiagEntry[]>(await kv.get(RECENT), []);
  list.unshift(entry);
  await kv.set(RECENT, JSON.stringify(list.slice(0, MIC_DIAG_KEEP)), TTL);
  const day = tokyoDay(now);
  const counts = parse<Record<string, number>>(await kv.get(dayKey(day)), {});
  const k = countKey(body);
  counts[k] = (counts[k] ?? 0) + 1;
  await kv.set(dayKey(day), JSON.stringify(counts), TTL);
  return entry;
}

export async function readMicDiag(kv: KvStore, now = new Date(), days = 7): Promise<MicDiagView> {
  const recent = parse<MicDiagEntry[]>(await kv.get(RECENT), []);
  const out: MicDiagView['days'] = [];
  for (let d = 0; d < days; d++) {
    const day = tokyoDay(new Date(now.getTime() - d * 86400 * 1000));
    const counts = parse<Record<string, number>>(await kv.get(dayKey(day)), {});
    if (Object.keys(counts).length) out.push({ day, counts });
  }
  return { recent, days: out };
}
