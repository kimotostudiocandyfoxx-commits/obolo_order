import { z } from 'zod';
import { MakeConfirm } from './makeConfirm';
import { DEFAULT_PRICE_RULE, DEFAULT_STORAGE_GB_MONTH_USD, DEFAULT_USD_JPY, fxMonth, GIB, manaFor10, type PriceRule } from './manaPrice';

/**
 * R18 (client 2026-11-25, docs/マナの値段.md 13. / docs/media.md): Bluena's room and 保存の魔法.
 *
 *  - Included: an Obolo Order member 5 GB (STORAGE_MEMBER_GB), everyone else 1 GB (STORAGE_FREE_GB). Everything the
 *    member owns that we store counts: uploads, the works made and every file of theirs (versions, stems, voice
 *    versions, posters …: media_objects), and the text of books and games.
 *  - 保存の魔法 (asked for in words with {bati}): +10 / +30 / +100 GB a month, paid in mana — a full month on the yes,
 *    then at the start of each month. Its price is the price rule (manaFor10) of the tier's monthly Cloudflare R2 cost:
 *    storage at STORAGE_GB_MONTH_USD (R2 $0.015 / GB-month; egress free) plus an allowance of R2 operations.
 *  - Mana short at the renewal: the files stay, 7 days of grace ({bati} says so once), then the tier lapses. Nothing is
 *    ever deleted automatically; over the quota, new uploads and makings stop until the member is under it again.
 *  - 「保存の魔法をやめて」: it ends at the month's end (the next renewal lapses instead of charging).
 *  - {bati} says once at 80% 「ブルーナがいっぱいになってきたよ。」; at 100% making / uploading stop with
 *    「ブルーナがいっぱいだよ。何かを消すか、保存の魔法で広げてね。」 (every style: STORAGE_VARIANTS).
 */

/** the expansion tiers (GB a month) */
export const STORAGE_TIERS = [10, 30, 100] as const;
export type StorageTier = (typeof STORAGE_TIERS)[number];
export const isStorageTier = (n: unknown): n is StorageTier => (STORAGE_TIERS as readonly unknown[]).includes(n);

/**
 * Cloudflare R2 operations (R2's pricing page): Class A (writes, lists) $4.50 and Class B (reads) $0.36 per million.
 * The allowance a tier's price includes per GB a month (a cautious estimate: the files are written once and read
 * through the CDN, which caches them for a year — docs/media.md).
 */
export const R2_CLASS_A_USD_PER_M = 4.5;
export const R2_CLASS_B_USD_PER_M = 0.36;

export interface StorageRule {
  /** included for an active Obolo Order member (STORAGE_MEMBER_GB) */
  memberGb: number;
  /** included for everyone else (STORAGE_FREE_GB) */
  freeGb: number;
  /** storage per GB-month in USD (STORAGE_GB_MONTH_USD: R2 $0.015) */
  gbMonthUsd: number;
  /** Class A operations allowed per GB a month (STORAGE_CLASS_A_PER_GB) */
  classAPerGb: number;
  /** Class B operations allowed per GB a month (STORAGE_CLASS_B_PER_GB) */
  classBPerGb: number;
  /** days of grace when the renewal finds too little mana (STORAGE_GRACE_DAYS) */
  graceDays: number;
}

export const DEFAULT_STORAGE_RULE: StorageRule = { memberGb: 5, freeGb: 1, gbMonthUsd: DEFAULT_STORAGE_GB_MONTH_USD, classAPerGb: 100, classBPerGb: 1000, graceDays: 7 };

/** the monthly R2 cost of one tier (USD): its GB stored for the month + the operations allowance */
export function tierUsd(gb: number, rule: StorageRule = DEFAULT_STORAGE_RULE): number {
  const ops = (Math.max(0, rule.classAPerGb) * R2_CLASS_A_USD_PER_M + Math.max(0, rule.classBPerGb) * R2_CLASS_B_USD_PER_M) / 1e6;
  return gb * (Math.max(0, rule.gbMonthUsd) + ops);
}

/** THE price of a tier a month: manaFor10( its monthly R2 cost in yen ) */
export function tierMana(gb: number, usdJpy: number = DEFAULT_USD_JPY, priceRule: PriceRule = DEFAULT_PRICE_RULE, rule: StorageRule = DEFAULT_STORAGE_RULE): number {
  return Math.max(0.1, manaFor10(tierUsd(gb, rule) * usdJpy, priceRule));
}

export type StorageTierPrice = { gb: StorageTier; mana: number };
export function tierPrices(usdJpy: number = DEFAULT_USD_JPY, priceRule: PriceRule = DEFAULT_PRICE_RULE, rule: StorageRule = DEFAULT_STORAGE_RULE): StorageTierPrice[] {
  return STORAGE_TIERS.map((gb) => ({ gb, mana: tierMana(gb, usdJpy, priceRule, rule) }));
}

/** the room included (bytes) */
export function baseQuotaBytes(member: boolean, rule: StorageRule = DEFAULT_STORAGE_RULE): number {
  return Math.round((member ? rule.memberGb : rule.freeGb) * GIB);
}
/** the room with the expansion in effect (bytes) */
export function quotaBytes(member: boolean, extraGb: number, rule: StorageRule = DEFAULT_STORAGE_RULE): number {
  return baseQuotaBytes(member, rule) + Math.round(Math.max(0, extraGb) * GIB);
}

/** ok · near (80% — {bati} says so once) · full (100%: uploading and making stop) */
export type StorageLevel = 'ok' | 'near' | 'full';
export const STORAGE_NEAR = 0.8;
/** the 80% notice is said again only after the use went below this */
export const STORAGE_NEAR_RESET = 0.75;
export function storageLevel(usedBytes: number, quota: number): StorageLevel {
  if (quota <= 0 || usedBytes >= quota) return 'full';
  return usedBytes >= quota * STORAGE_NEAR ? 'near' : 'ok';
}
/** room for `addBytes` more (0: is there any room left at all) */
export function hasRoom(usedBytes: number, quota: number, addBytes = 0): boolean {
  return addBytes > 0 ? usedBytes + addBytes <= quota : usedBytes < quota;
}

/** a size as the calm bar shows it: 「2.1GB」「5GB」, under 1 GB 「120MB」 */
export function formatBytes(bytes: number): string {
  const b = Math.max(0, bytes);
  if (b < GIB) return `${Math.max(b > 0 ? 1 : 0, Math.round(b / 1024 ** 2))}MB`;
  const gb = Math.round((b / GIB) * 10) / 10;
  return `${Number.isInteger(gb) ? gb.toFixed(0) : gb.toFixed(1)}GB`;
}
/** 「ブルーナ：2.1GB / 5GB」 */
export const storageBarText = (usedBytes: number, quota: number) => `ブルーナ：${formatBytes(usedBytes)} / ${formatBytes(quota)}`;

// ───────────────────────────── the plan (one row a member) ─────────────────────────────

export interface StoragePlanState {
  /** the tier bought (null: none) */
  tierGb: number | null;
  /** the last month (YYYY-MM, Japan) it was paid for */
  paidMonth: string | null;
  /** 「保存の魔法をやめて」: ends at the month's end */
  cancelled: boolean;
  /** the renewal found too little mana: the tier stays until then */
  graceUntil: Date | null;
  /** when it last lapsed (told once) */
  lapsedAt: Date | null;
}
export const NO_PLAN: StoragePlanState = { tierGb: null, paidMonth: null, cancelled: false, graceUntil: null, lapsedAt: null };

/** the GB the plan adds now: paid for this month, or within its grace */
export function planExtraGb(p: StoragePlanState | null | undefined, now: Date = new Date()): number {
  if (!p?.tierGb) return 0;
  if (p.paidMonth && p.paidMonth >= fxMonth(now)) return p.tierGb;
  return p.graceUntil && now < p.graceUntil ? p.tierGb : 0;
}

/** what the month's renewal does: nothing (none / paid), charge the tier, or let it lapse (cancelled) */
export function renewalDue(p: StoragePlanState | null | undefined, now: Date = new Date()): 'none' | 'charge' | 'lapse' {
  if (!p?.tierGb) return 'none';
  if (p.paidMonth && p.paidMonth >= fxMonth(now)) return 'none';
  return p.cancelled ? 'lapse' : 'charge';
}

export type RenewalEvent = 'renewed' | 'grace' | 'lapsed' | 'waiting';
/**
 * The plan after the renewal: paid → this month; not paid → 7 days of grace the first time, still waiting within them,
 * lapsed after them (the tier goes; no file is touched). `lapse` (cancelled): lapsed at once.
 */
export function afterRenewal(p: StoragePlanState, now: Date, paid: boolean | 'lapse', rule: StorageRule = DEFAULT_STORAGE_RULE): { plan: StoragePlanState; event: RenewalEvent } {
  if (paid === 'lapse') return { plan: { ...NO_PLAN, lapsedAt: now }, event: 'lapsed' };
  if (paid) return { plan: { ...p, paidMonth: fxMonth(now), graceUntil: null }, event: 'renewed' };
  if (!p.graceUntil) return { plan: { ...p, graceUntil: new Date(now.getTime() + rule.graceDays * 86400_000) }, event: 'grace' };
  if (now >= p.graceUntil) return { plan: { ...NO_PLAN, lapsedAt: now }, event: 'lapsed' };
  return { plan: p, event: 'waiting' };
}

/** the ledger's idempotency keys: one yes (a purchase) and one month's renewal */
export const storageBuyKey = (userId: string, confirmId: string) => `storage:${userId}:buy:${confirmId}`;
export const storageRenewKey = (userId: string, month: string, gb: number) => `storage:${userId}:renew:${month}:${gb}`;

// ───────────────────────────── the API ─────────────────────────────

/** what {bati} has to say once (GET /storage): 80%, the grace began, the tier lapsed */
export type StorageSay = 'near' | 'grace' | 'lapsed';

/** GET /storage */
export interface StorageView {
  usedBytes: number;
  quotaBytes: number;
  baseGb: number;
  extraGb: number;
  member: boolean;
  level: StorageLevel;
  plan: { gb: number; cancelled: boolean; paidMonth: string | null; graceUntil: string | null } | null;
  tiers: StorageTierPrice[];
  /** a notice not said yet */
  say: StorageSay | null;
}

/** POST /storage/expand — the yes to a tier at the price {bati} said */
export const StorageExpandBody = z.object({ gb: z.number().int().refine(isStorageTier, 'a tier'), confirm: MakeConfirm.omit({ spell: true }) });
export type StorageExpandBody = z.infer<typeof StorageExpandBody>;
export type StorageExpandResult = { status: 'charged' | 'repeat' | 'already'; view: StorageView };

/** POST /storage/told */
export const StorageToldBody = z.object({ what: z.enum(['near', 'grace', 'lapsed']) });

/** the found work kinds that can be thrown away from Bluena (DELETE /storage/works/:kind/:id) */
export const REMOVABLE_WORK_KINDS = ['song', 'saturn_post', 'jupiter_root', 'mars_backstage', 'radio_show', 'book', 'game'] as const;
export type RemovableWorkKind = (typeof REMOVABLE_WORK_KINDS)[number];
export const isRemovableWorkKind = (k: string): k is RemovableWorkKind => (REMOVABLE_WORK_KINDS as readonly string[]).includes(k);
export type RemoveWorkResult = { removed: number; freedBytes: number; view: StorageView };

/**
 * The making-side writes stopped at 100% besides the paid makings (charged through the ledger) and every stored file
 * (MediaService): a book's chapter, a game, a 📎 upload started. Never a DELETE (freeing room is always open).
 */
export const STORAGE_WRITES: RegExp[] = [/^\/moon\/novel\/chapter$/, /^\/moon\/game$/, /^\/media\/files$/];
export function storageWrite(method: string, path: string): boolean {
  if (!/^(POST|PUT|PATCH)$/i.test(method)) return false;
  const p = path.toLowerCase().split('?')[0];
  return STORAGE_WRITES.some((re) => re.test(p));
}

// ───────────────────────────── words ─────────────────────────────

const half = (s: string) => s.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0)).replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

/** 「保存の魔法をやめて」「ブルーナを広げるのやめて」 */
export function isStorageCancel(text: string): boolean {
  const t = half(text).replace(/\s+/g, '');
  return /(保存|ほぞん)の(魔法|まほう).{0,6}(やめ|止め|解約|おわり|終わり|キャンセル|とめ|いらない)/.test(t) || /ブルーナ.{0,4}(広げ|ひろげ).{0,6}(やめ|止め|いらない)/.test(t);
}

/** 「保存の魔法」「ブルーナを広げて」「ブルーナを大きくして」「容量を増やして」 */
export function isStorageAsk(text: string): boolean {
  const t = half(text).replace(/\s+/g, '');
  if (isStorageCancel(t)) return false;
  return /(保存|ほぞん)の(魔法|まほう)/.test(t) || /ブルーナ.{0,3}(広げ|ひろげ|大きく|おおきく|増や|ふや)/.test(t) || /(容量|ようりょう).{0,3}(増や|ふや|広げ|ひろげ|足り|たり)/.test(t);
}

/** the tier said: 「10GB」「30ギガ」「百」「いちばん大きいの」 (null: none said) */
export function storageTierOf(text: string): StorageTier | null {
  const t = half(text).replace(/\s+/g, '').toLowerCase();
  const n = t.match(/(\d{1,4})/);
  if (n && isStorageTier(Number(n[1]))) return Number(n[1]) as StorageTier;
  if (/百|ひゃく/.test(t)) return 100;
  if (/三十|さんじゅう/.test(t)) return 30;
  if (/十|じゅう/.test(t)) return 10;
  if (/(いちばん|一番)?(大きい|おおきい|最大|さいだい)/.test(t)) return 100;
  if (/(まんなか|真ん中|まんなかの|中くらい|ちゅうくらい)/.test(t)) return 30;
  if (/(いちばん|一番)?(小さい|ちいさい|最小)/.test(t)) return 10;
  return null;
}

/**
 * R18 (future policy, not built — docs/media.md): a non-member who has not opened the app for 12 months is told
 * (an e-mail and {bati} on the next visit), and after 3 more months their files move to cold storage (archived, still
 * theirs: brought back on asking). Nothing is deleted without their word.
 */
export const INACTIVE_POLICY = { notifyAfterMonths: 12, archiveAfterMonths: 15 } as const;

