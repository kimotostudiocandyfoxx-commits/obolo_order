import { describe, expect, it } from 'vitest';
import { BATI_VARIANTS } from './batiVariants';
import { DEFAULT_COST_RATES, estimateJpy, GIB, MAKE_COST, MAKE_COST_ESTIMATE, MIB, manaFor10, quoteMana, storageJpyOf, storedUsd } from './manaPrice';
import {
  afterRenewal,
  baseQuotaBytes,
  formatBytes,
  hasRoom,
  isStorageAsk,
  isStorageCancel,
  NO_PLAN,
  planExtraGb,
  quotaBytes,
  renewalDue,
  storageBarText,
  storageLevel,
  storageTierOf,
  storageWrite,
  tierMana,
  tierPrices,
  tierUsd,
  type StoragePlanState,
} from './storage';
import { STORAGE_LINE_TEXTS, STORAGE_LINES } from './storageVariants';

const at = (iso: string) => new Date(iso);

describe('R18: Bluena\'s room', () => {
  it('members 5 GB, everyone else 1 GB, plus the tier in effect', () => {
    expect(baseQuotaBytes(true)).toBe(5 * GIB);
    expect(baseQuotaBytes(false)).toBe(1 * GIB);
    expect(quotaBytes(true, 10)).toBe(15 * GIB);
    expect(quotaBytes(false, 30)).toBe(31 * GIB);
    expect(quotaBytes(false, 0, { memberGb: 5, freeGb: 2, gbMonthUsd: 0.015, classAPerGb: 0, classBPerGb: 0, graceDays: 7 })).toBe(2 * GIB);
  });

  it('80% is near, 100% is full; a file must fit', () => {
    const q = 5 * GIB;
    expect(storageLevel(3.9 * GIB, q)).toBe('ok');
    expect(storageLevel(4 * GIB, q)).toBe('near');
    expect(storageLevel(5 * GIB, q)).toBe('full');
    expect(hasRoom(4.99 * GIB, q)).toBe(true);
    expect(hasRoom(5 * GIB, q)).toBe(false);
    expect(hasRoom(4.99 * GIB, q, 0.02 * GIB)).toBe(false);
  });

  it('the calm bar: 「ブルーナ：2.1GB / 5GB」', () => {
    expect(storageBarText(2.1 * GIB, 5 * GIB)).toBe('ブルーナ：2.1GB / 5GB');
    expect(formatBytes(120 * MIB)).toBe('120MB');
    expect(formatBytes(0)).toBe('0MB');
    expect(formatBytes(15 * GIB)).toBe('15GB');
  });
});

describe('R18: 保存の魔法 prices (R2 $0.015 / GB-month + operations, 160 JPY/USD, manaFor10)', () => {
  it('each tier is manaFor10 of its monthly R2 cost', () => {
    for (const gb of [10, 30, 100]) expect(tierMana(gb)).toBe(manaFor10(tierUsd(gb) * 160));
    // storage $0.15 + 100 Class A × $4.50/M + 1,000 Class B × $0.36/M per GB
    expect(tierUsd(10)).toBeCloseTo(0.1581, 6);
    expect(tierPrices().map((t) => [t.gb, t.mana])).toEqual([
      [10, 28.4],
      [30, 85.1],
      [100, 283.4],
    ]);
    // the storage alone would be 26.9 / 80.7 / 268.9
    const storageOnly = { memberGb: 5, freeGb: 1, gbMonthUsd: 0.015, classAPerGb: 0, classBPerGb: 0, graceDays: 7 };
    expect(tierPrices(160, undefined, storageOnly).map((t) => t.mana)).toEqual([26.9, 80.7, 268.9]);
  });
  it('follow the month\'s FX and the configured price', () => {
    expect(tierMana(10, 150)).toBeLessThan(tierMana(10, 160));
    expect(tierMana(10, 160, undefined, { memberGb: 5, freeGb: 1, gbMonthUsd: 0.03, classAPerGb: 100, classBPerGb: 1000, graceDays: 7 })).toBeGreaterThan(tierMana(10));
  });
});

describe('R18: the plan — purchase, renewal, grace, lapse, cancel', () => {
  const paid: StoragePlanState = { ...NO_PLAN, tierGb: 10, paidMonth: '2026-11' };
  it('adds its GB while paid for the month', () => {
    expect(planExtraGb(paid, at('2026-11-20T00:00:00Z'))).toBe(10);
    expect(planExtraGb(paid, at('2026-12-01T03:00:00Z'))).toBe(0);
    expect(planExtraGb(NO_PLAN)).toBe(0);
    expect(renewalDue(paid, at('2026-11-20T00:00:00Z'))).toBe('none');
    // the month is Japan's: 2026-11-30 15:00 UTC is already December
    expect(renewalDue(paid, at('2026-11-30T15:00:00Z'))).toBe('charge');
  });
  it('paid at the renewal → the new month', () => {
    const now = at('2026-12-01T01:00:00Z');
    const r = afterRenewal(paid, now, true);
    expect(r.event).toBe('renewed');
    expect(r.plan.paidMonth).toBe('2026-12');
    expect(planExtraGb(r.plan, now)).toBe(10);
  });
  it('mana short → 7 days of grace (the room stays), then it lapses — no file is touched', () => {
    const now = at('2026-12-01T01:00:00Z');
    const g = afterRenewal(paid, now, false);
    expect(g.event).toBe('grace');
    expect(g.plan.graceUntil?.toISOString()).toBe('2026-12-08T01:00:00.000Z');
    expect(planExtraGb(g.plan, at('2026-12-05T00:00:00Z'))).toBe(10);
    expect(afterRenewal(g.plan, at('2026-12-05T00:00:00Z'), false).event).toBe('waiting');
    // mana bought within the grace: renewed
    expect(afterRenewal(g.plan, at('2026-12-05T00:00:00Z'), true).plan).toMatchObject({ paidMonth: '2026-12', graceUntil: null, tierGb: 10 });
    const l = afterRenewal(g.plan, at('2026-12-08T02:00:00Z'), false);
    expect(l.event).toBe('lapsed');
    expect(l.plan.tierGb).toBeNull();
    expect(planExtraGb(l.plan, at('2026-12-09T00:00:00Z'))).toBe(0);
  });
  it('「やめて」: the month stays, the next renewal lapses (no charge)', () => {
    const c = { ...paid, cancelled: true };
    expect(planExtraGb(c, at('2026-11-25T00:00:00Z'))).toBe(10);
    expect(renewalDue(c, at('2026-12-01T01:00:00Z'))).toBe('lapse');
    expect(afterRenewal(c, at('2026-12-01T01:00:00Z'), 'lapse').plan.tierGb).toBeNull();
  });
});

describe('R18: words', () => {
  it('asks, cancels and sizes', () => {
    expect(isStorageAsk('保存の魔法')).toBe(true);
    expect(isStorageAsk('ブルーナを広げて')).toBe(true);
    expect(isStorageAsk('容量を増やしたい')).toBe(true);
    expect(isStorageAsk('曲を作って')).toBe(false);
    expect(isStorageCancel('保存の魔法をやめて')).toBe(true);
    expect(isStorageAsk('保存の魔法をやめて')).toBe(false);
    expect(storageTierOf('30GBで')).toBe(30);
    expect(storageTierOf('１００ギガ')).toBe(100);
    expect(storageTierOf('十ギガ')).toBe(10);
    expect(storageTierOf('いちばん大きいの')).toBe(100);
    expect(storageTierOf('うーん')).toBeNull();
    expect(storageTierOf('50GB')).toBeNull();
  });
  it('the writes stopped at 100% (never a DELETE)', () => {
    expect(storageWrite('POST', '/moon/novel/chapter')).toBe(true);
    expect(storageWrite('POST', '/media/files')).toBe(true);
    expect(storageWrite('DELETE', '/media/files')).toBe(false);
    expect(storageWrite('POST', '/media/files/x/parts/1')).toBe(false);
  });
  it('the lines in every style, the same placeholders and sentences; ていねい writes デス／マス', () => {
    expect(STORAGE_LINES.near).toBe('ブルーナがいっぱいになってきたよ。');
    expect(STORAGE_LINES.full).toBe('ブルーナがいっぱいだよ。何かを消すか、保存の魔法で広げてね。');
    const holes = (x: string) => [...x.matchAll(/\{[a-z0-9]+\}/g)].map((m) => m[0]).sort();
    const sentences = (x: string) => (x.match(/[^！？。!?]+[！？。!?]*/g) ?? [x]).length;
    for (const line of STORAGE_LINE_TEXTS) {
      const v = BATI_VARIANTS[line];
      expect(v, line).toBeDefined();
      for (const [k, s] of Object.entries(v)) {
        expect(holes(s), `${k}: ${line}`).toEqual(holes(line));
        expect(sentences(s), `${k}: ${s}`).toBe(sentences(line));
        if (k === 'teinei') expect(s).not.toMatch(/(です|ます)(?![\p{sc=Han}])/u);
      }
    }
  });
});

describe('R18: a making\'s price includes 12 months of storing what it made', () => {
  it('bytes × months × the GB-month price', () => {
    expect(storedUsd(GIB, 12, 0.015)).toBeCloseTo(0.18, 9);
    expect(storedUsd(0)).toBe(0);
    // a 60 s song: mp3 + original + stems ≈ 6 MB for 12 months
    expect(storageJpyOf(MAKE_COST_ESTIMATE.song)).toBeCloseTo((6 / 1024) * 12 * 0.015 * 160, 9);
    // a video ≈ 13 MB
    expect(storageJpyOf(MAKE_COST_ESTIMATE.mv)).toBeGreaterThan(storageJpyOf(MAKE_COST_ESTIMATE.song));
  });
  it('is in the quoted mana (and follows STORAGE_GB_MONTH_USD / STORAGE_PRICE_MONTHS)', () => {
    const e = MAKE_COST_ESTIMATE.mv;
    expect(MAKE_COST.mv).toBe(quoteMana(estimateJpy(e)));
    expect(estimateJpy(e)).toBeCloseTo(estimateJpy({ ...e, storedBytes: 0 }) + storageJpyOf(e), 9);
    expect(estimateJpy(e, { ...DEFAULT_COST_RATES, storageMonths: 0 })).toBeCloseTo(estimateJpy({ ...e, storedBytes: 0 }), 9);
    expect(estimateJpy(e, { ...DEFAULT_COST_RATES, storageGbMonthUsd: 0.03 })).toBeGreaterThan(estimateJpy(e));
    expect(MAKE_COST.mv).toBeGreaterThan(quoteMana(estimateJpy({ ...e, storedBytes: 0 })));
  });
});
