import { BATI_ORDINARY_IDS, BATI_PERSONALITIES, BATI_VARIANTS } from '@obolo/shared';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { batiLine, batiLineVaried } from '../onboarding/batiLine';
import { sayText, type StoryVars } from '../onboarding/script';

/** every {bati} say-line of the imported script (public/story); the app's lines are checked against it by story-sync */
function batiLines(): string[] {
  const out = new Set<string>();
  const rec = (x: unknown) => {
    if (Array.isArray(x)) x.forEach(rec);
    else if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      if (o.k === 'say' && o.who === 'バティ' && typeof o.text === 'string') out.add(o.text);
      Object.values(o).forEach(rec);
    }
  };
  const idx = JSON.parse(readFileSync('public/story/index.json', 'utf8')) as { parts: string[] };
  for (const p of idx.parts) rec(JSON.parse(readFileSync(`public/story/${p}.json`, 'utf8')));
  return [...out];
}
const holes = (t: string) => [...new Set([...t.matchAll(/\{[a-z_]+\}/g)].map((m) => m[0]).filter((p) => p !== '{self}'))].sort();

describe("{bati}'s lines in each style with written lines (M-R225 / M-R227)", () => {
  const lines = batiLines();
  it('every {bati} line of the script has all seven variants, with the same placeholders', () => {
    expect(lines.length).toBeGreaterThan(60);
    const others = BATI_ORDINARY_IDS.filter((p) => p !== 'genki');
    for (const line of lines) {
      const v = BATI_VARIANTS[line];
      expect(v, `no variants for 「${line}」`).toBeDefined();
      for (const p of others) {
        expect(v[p], `${p} of 「${line}」`).toBeTruthy();
        expect(holes(v[p]), `${p} of 「${line}」`).toEqual(holes(line));
      }
    }
  });

  it('renders a line in the manner, with the 一人称 and a custom 呼び方; 元気な子 is the script as written', () => {
    expect(batiLine('いくよ、{name}！', { personality: 'teinei' })).toBe('いきマス、{name}さん！');
    expect(batiLine('いくよ、{name}！', { personality: 'teinei', call: 'たっくん' })).toBe('いきマス、たっくん！');
    expect(batiLine('いくよ、{name}！', { personality: 'gal' })).toBe('いくよ、{name}っち！');
    // a retired style is said as the nearest current one
    expect(batiLine('いくよ、{name}！', { personality: 'keigo' as never })).toBe('いきマス、{name}さん！');
    expect(batiLine('なんでも聞いて！　ボク、調べてみる！', { personality: 'amae', egg: 'moon' })).toContain('あたし');
    expect(batiLine('なんでも聞いて！　ボク、調べてみる！', { personality: 'genki' })).toBe('なんでも聞いて！　ボク、調べてみる！');
    expect(batiLineVaried('……やぁ！', { personality: 'genki' })).toBe(false);
    expect(batiLineVaried('……やぁ！', { personality: 'teinei' })).toBe(true);
    // a rare one: the birth's rewrite, else the line as written
    expect(batiLine('……やぁ！', { personality: 'bushi', lines: { '……やぁ！': '……参上でござる。' } })).toBe('……参上でござる。');
    expect(batiLine('工房に行こう！', { personality: 'bushi', lines: {} })).toBe('工房に行こう！');
  });

  it('M-R225: the style shows in at most about half the sentences (sentence by sentence, the 一人称 / 呼び方 aside)', () => {
    const split = (t: string) => t.match(/[^！？。!?]+[！？。!?]*/g) ?? [t];
    for (const p of BATI_ORDINARY_IDS.filter((x) => x !== 'genki')) {
      const h = BATI_PERSONALITIES[p].honorific;
      let changed = 0;
      let total = 0;
      for (const [base, v] of Object.entries(BATI_VARIANTS)) {
        const said = (h ? v[p].replaceAll(`{neo}${h}`, '{neo}').replaceAll(`{name}${h}`, '{name}') : v[p]).replaceAll('{self}', 'ボク');
        const a = split(base);
        const b = split(said);
        expect(b.length, `${p}: 「${v[p]}」 keeps the sentences`).toBe(a.length);
        total += a.length;
        changed += a.filter((s, k) => s.trim() !== b[k].trim()).length;
      }
      expect(changed / total, p).toBeLessThanOrEqual(0.5);
    }
  });

  it('no retired style is left; ていねいな子 writes デス／マス in katakana; ordinary kanji-kana', () => {
    for (const v of Object.values(BATI_VARIANTS)) {
      expect(Object.keys(v).sort()).toEqual(BATI_ORDINARY_IDS.filter((x) => x !== 'genki').sort());
      expect(v.teinei).not.toMatch(/(です|ます)(?![\p{sc=Han}])/u);
    }
  });

  it('only {bati} lines change; the others and the script stay word for word', () => {
    const v: StoryVars = { name: 'たろう', inviter: 'X', neo: 'ネオ', batiSpeech: { personality: 'kansai' } };
    expect(sayText('バティ', '工房は、逃げないよ！', v)).toBe('工房は、逃げへんで！');
    expect(sayText('バティ', '……やぁ！', { ...v, batiSpeech: { personality: 'teinei' } })).toBe('……こんにちは！');
    expect(sayText('OBOLON', '、、、殻は、、、また、たまごになる。', v)).toBe('、、、殻は、、、また、たまごになる。');
    expect(sayText('バティ', 'おはよ、{neo}！　きょうも、元気！', { ...v, batiSpeech: undefined })).toBe('おはよ、ネオ！　きょうも、元気！');
  });
});
