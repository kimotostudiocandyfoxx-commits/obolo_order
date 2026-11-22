import { BATI_ORDINARY_IDS, BATI_VARIANTS } from '@obolo/shared';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AFTER_DAYS } from '../onboarding/after';
import { batiLine, batiLineVaried } from '../onboarding/batiLine';
import { sayText, type StoryVars } from '../onboarding/script';
import { STORIES } from '../onboarding/stories';
import { SYS002 } from '../onboarding/sys002';

/** every {bati} say-line: the imported script (public/story) and the lines the app plays */
function batiLines(): string[] {
  const out = new Set<string>();
  const rec = (x: unknown) => {
    if (Array.isArray(x)) x.forEach(rec);
    else if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      if (o.who === 'バティ' && typeof o.text === 'string') out.add(o.text);
      Object.values(o).forEach(rec);
    }
  };
  const idx = JSON.parse(readFileSync('public/story/index.json', 'utf8')) as { parts: string[] };
  for (const p of idx.parts) rec(JSON.parse(readFileSync(`public/story/${p}.json`, 'utf8')));
  rec(Object.values(STORIES).map((s) => s.steps));
  rec(AFTER_DAYS);
  rec(SYS002);
  return [...out];
}
const holes = (t: string) => [...new Set([...t.matchAll(/\{[a-z_]+\}/g)].map((m) => m[0]).filter((p) => p !== '{self}'))].sort();

describe("{bati}'s lines in each ordinary personality (M-R216)", () => {
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
    expect(batiLine('いくよ、{name}！', { personality: 'keigo' })).toBe('参ります、{name}さま！');
    expect(batiLine('いくよ、{name}！', { personality: 'keigo', call: 'たっくん' })).toBe('参ります、たっくん！');
    expect(batiLine('うん！　さっきみたいに、ボクが魔法を唱えるよ！', { personality: 'baby', egg: 'moon' })).toContain('あたち');
    expect(batiLine('うん！　さっきみたいに、ボクが魔法を唱えるよ！', { personality: 'genki' })).toBe('うん！　さっきみたいに、ボクが魔法を唱えるよ！');
    expect(batiLineVaried('……やぁ！', { personality: 'genki' })).toBe(false);
    expect(batiLineVaried('……やぁ！', { personality: 'king' })).toBe(true);
    // a rare one: the birth's rewrite, else the line as written
    expect(batiLine('……やぁ！', { personality: 'ninja', lines: { '……やぁ！': '……参上ニン。' } })).toBe('……参上ニン。');
    expect(batiLine('工房に行こう！', { personality: 'ninja', lines: {} })).toBe('工房に行こう！');
  });

  it('only {bati} lines change; the others and the script stay word for word', () => {
    const v: StoryVars = { name: 'たろう', inviter: 'X', neo: 'ネオ', batiSpeech: { personality: 'kansai' } };
    expect(sayText('バティ', '工房は、逃げないよ！', v)).toBe('工房は、逃げへんで！');
    expect(sayText('OBOLON', '、、、殻は、、、また、たまごになる。', v)).toBe('、、、殻は、、、また、たまごになる。');
    expect(sayText('バティ', 'おはよ、{neo}！　きょうも、元気！', { ...v, batiSpeech: undefined })).toBe('おはよ、ネオ！　きょうも、元気！');
  });
});
