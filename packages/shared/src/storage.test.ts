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
  bagBar,
  bagSizes,
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

  it('the calm bar is a row of bags (1袋 = 1GB), filled from the left as the room is used', () => {
    // a member: 5 bags, 2.1 used → two full, one a tenth full, two empty
    const m = bagBar(2.1 * GIB, 5 * GIB);
    expect(m.bags).toBe(5);
    expect(m.icons).toHaveLength(5);
    expect(m.icons.map((i) => i.size)).toEqual([1, 1, 1, 1, 1]);
    expect(m.icons.map((i) => Math.round(i.fill * 100) / 100)).toEqual([1, 1, 0.1, 0, 0]);
    expect(m.label).toBe('ふくろ 5つのうち、2つぶんくらい');
    // a non-member: 1 bag
    expect(bagBar(0.5 * GIB, GIB).icons).toEqual([{ size: 1, fill: 0.5, big: false }]);
    expect(bagBar(0, GIB).label).toBe('ふくろ 1つ、まだからっぽ');
    expect(bagBar(0.2 * GIB, 5 * GIB).label).toBe('ふくろ 5つのうち、すこしだけ');
    expect(bagBar(5 * GIB, 5 * GIB).label).toBe('ふくろ 5つ、ぜんぶいっぱい');
    expect(bagBar(6 * GIB, 5 * GIB).icons.every((i) => i.fill === 1)).toBe(true);
    // no GB, no numbers of bytes in the label
    for (const used of [0, 0.3, 2.1, 4.9, 5]) expect(bagBar(used * GIB, 5 * GIB).label).not.toMatch(/GB|MB|容量/);
  });

  it('a big room is grouped: big bags of 10, then the rest one by one (never too many icons for a phone)', () => {
    expect(bagSizes(10)).toEqual(Array(10).fill(1));
    expect(bagSizes(15)).toEqual([10, 1, 1, 1, 1, 1]);
    expect(bagSizes(11)).toEqual([10, 1]);
    expect(bagSizes(35)).toEqual([10, 10, 10, 1, 1, 1, 1, 1]);
    expect(bagSizes(105)).toEqual([...Array(10).fill(10), 1, 1, 1, 1, 1]);
    expect(bagSizes(101)).toEqual([...Array(10).fill(10), 1]);
    for (const n of [1, 5, 6, 11, 15, 31, 35, 101, 105, 999]) {
      const s = bagSizes(n);
      expect(s.reduce((a, b) => a + b, 0), String(n)).toBe(n);
      expect(s.length, String(n)).toBeLessThanOrEqual(16);
    }
    // 15 bags (5 + the +10 tier), 12.5 used: the big bag full, then 2 of the 5 full and one half
    const b = bagBar(12.5 * GIB, 15 * GIB);
    expect(b.icons.map((i) => [i.size, i.fill, i.big])).toEqual([
      [10, 1, true],
      [1, 1, false],
      [1, 1, false],
      [1, 0.5, false],
      [1, 0, false],
      [1, 0, false],
    ]);
    expect(b.label).toBe('ふくろ 15このうち、13こぶんくらい');
    // 105 bags, 4 used: the first big bag 40% full
    expect(bagBar(4 * GIB, 105 * GIB).icons[0].fill).toBeCloseTo(0.4, 9);
  });

  it('formatBytes stays for the dev team (never shown in the world)', () => {
    expect(formatBytes(120 * MIB)).toBe('120MB');
    expect(formatBytes(0)).toBe('0MB');
    expect(formatBytes(15 * GIB)).toBe('15GB');
  });
});

describe('R18: ふくろの魔法 prices (R2 $0.015 / GB-month, 160 JPY/USD, manaFor10)', () => {
  it('each tier is manaFor10 of its monthly R2 cost', () => {
    for (const gb of [10, 30, 100]) expect(tierMana(gb)).toBe(manaFor10(tierUsd(gb) * 160));
    // storage only (client 2026-11-25): $0.015 × 10 GB; operations are not priced by default
    expect(tierUsd(10)).toBeCloseTo(0.15, 6);
    expect(tierPrices().map((t) => [t.gb, t.mana])).toEqual([
      [10, 26.9],
      [30, 80.7],
      [100, 268.9],
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
  it('ふくろの魔法 (client 2026-11-25): its words and sizes in 袋; the old words still heard', () => {
    for (const s of ['ふくろの魔法', 'ふくろの魔法を唱えて', '袋の魔法', 'ふくろのまほう', '袋をふやして', '袋を増やして', 'ふくろをふやす', 'ブルーナの袋をふやしたい', '袋が足りない'])
      expect(isStorageAsk(s), s).toBe(true);
    for (const s of ['紙ぶくろの絵を描いて', 'ふくろうの曲を作って', '袋を描いて']) expect(isStorageAsk(s), s).toBe(false);
    expect(isStorageCancel('ふくろの魔法をやめて')).toBe(true);
    expect(isStorageCancel('ふくろの魔法、もういらない')).toBe(true);
    expect(isStorageCancel('袋をふやすのやめて')).toBe(true);
    expect(isStorageCancel('保存の魔法をやめて')).toBe(true);
    expect(isStorageAsk('ふくろの魔法をやめて')).toBe(false);
    expect(isStorageCancel('ふくろの魔法')).toBe(false);
    expect(storageTierOf('10袋')).toBe(10);
    expect(storageTierOf('１０袋で')).toBe(10);
    expect(storageTierOf('じゅう袋')).toBe(10);
    expect(storageTierOf('30袋')).toBe(30);
    expect(storageTierOf('さんじゅう袋')).toBe(30);
    expect(storageTierOf('百袋')).toBe(100);
    expect(storageTierOf('100袋ふやして')).toBe(100);
    expect(storageTierOf('いちばん大きいの')).toBe(100);
    expect(storageTierOf('20袋')).toBeNull();
  });
  it('the writes stopped at 100% (never a DELETE)', () => {
    expect(storageWrite('POST', '/moon/novel/chapter')).toBe(true);
    expect(storageWrite('POST', '/media/files')).toBe(true);
    expect(storageWrite('DELETE', '/media/files')).toBe(false);
    expect(storageWrite('POST', '/media/files/x/parts/1')).toBe(false);
  });
  it('the lines in every style, the same placeholders and sentences; ていねい writes デス／マス', () => {
    expect(STORAGE_LINES.near).toBe('ブルーナの袋がいっぱいになってきたよ。いらないものを消すか、ふくろの魔法で袋をふやせるよ。');
    expect(STORAGE_LINES.full).toBe('ブルーナの袋がいっぱいだよ。いらないものを消すか、ふくろの魔法で袋をふやしてね。');
    expect(STORAGE_LINES.explain).toBe('ブルーナの袋をふやすふくろの魔法は、ひと月10袋が{p10}マナ、30袋が{p30}マナ、100袋が{p100}マナだよ。どれにする？');
    expect(STORAGE_LINES.confirm).toBe('{bags}袋を、ひと月{price}マナだね。唱える？');
    const holes = (x: string) => [...x.matchAll(/\{[a-z0-9]+\}/g)].map((m) => m[0]).sort();
    const split = (x: string) => x.match(/[^！？。!?]+[！？。!?]*/g) ?? [x];
    const sentences = (x: string) => split(x).length;
    for (const line of STORAGE_LINE_TEXTS) {
      const v = BATI_VARIANTS[line];
      expect(v, line).toBeDefined();
      for (const [k, s] of Object.entries(v)) {
        expect(holes(s), `${k}: ${line}`).toEqual(holes(line));
        expect(sentences(s), `${k}: ${s}`).toBe(sentences(line));
        if (k === 'teinei') expect(s).not.toMatch(/(です|ます)(?![\p{sc=Han}])/u);
        // the style shows in at most half of the sentences, rounded up (ていねいな子 may write デス／マス in each)
        const changed = split(s).filter((x, i) => x.trim() !== split(line)[i]?.trim()).length;
        if (k !== 'teinei') expect(changed, `${k}: ${s}`).toBeLessThanOrEqual(Math.ceil(sentences(line) / 2));
      }
    }
  });
  it('client 2026-11-25: no line in the world says GB, 容量 or 保存の魔法 (the room is counted in 袋)', () => {
    for (const line of STORAGE_LINE_TEXTS) for (const s of [line, ...Object.values(BATI_VARIANTS[line])]) expect(s).not.toMatch(/GB|ギガ|容量|保存の魔法|広げ|広さ/);
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
