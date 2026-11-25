import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ai from '@obolo/ai';
import { describe, expect, it } from 'vitest';
import { IncantService } from './incant.service';

function incant(cfg: Record<string, unknown>, member: boolean) {
  const kv = new Map<string, string>();
  const s = new IncantService({ MUSIC_RUNWARE_KEY: 'k', PREMIUM_SPELL: 'on', ...cfg } as never, {} as never, { get: async (k: string) => kv.get(k) ?? null, set: async (k: string, v: string) => void kv.set(k, v) } as never);
  Object.assign(s, { member: async () => member, price: async () => 30 });
  return s;
}

describe('R17: the secret spell — only a member who says the passphrase', () => {
  it('a member saying 「上級魔法で…」 gets a grant, the price and the request; the grant is good for the yes', async () => {
    const s = incant({}, true);
    const r = await s.incant('u1', '上級魔法で、夏の曲を唱えて');
    expect(r).toMatchObject({ premium: true, price: 30, request: '夏の曲を唱えて' });
    if (!r.premium) throw new Error('no');
    expect(await s.check('u1', r.grant)).toBe(true);
    expect(await s.check('u2', r.grant)).toBe(false);
  });
  it('a non-member saying it, other words, or the spell turned off: just { premium: false } (no sign of it)', async () => {
    expect(await incant({}, false).incant('u1', '上級魔法で、夏の曲を唱えて')).toEqual({ premium: false });
    expect(await incant({}, true).incant('u1', '夏の曲を唱えて')).toEqual({ premium: false });
    expect(await incant({ PREMIUM_SPELL: 'off' }, true).incant('u1', '上級魔法で')).toEqual({ premium: false });
    expect(await incant({ MUSIC_RUNWARE_KEY: undefined }, true).incant('u1', '上級魔法で')).toEqual({ premium: false });
  });
  it('the passphrase is a setting (PREMIUM_SPELL_WORDS)', async () => {
    const s = incant({ PREMIUM_SPELL_WORDS: 'ひみつの呪文|とっておき' }, true);
    expect((await s.incant('u1', '上級魔法で')).premium).toBe(false);
    expect((await s.incant('u1', 'とっておきで海の歌')).premium).toBe(true);
  });
  it('a grant stops working when the spell is turned off', async () => {
    const on = incant({}, true);
    const r = await on.incant('u1', '上級魔法で');
    if (!r.premium) throw new Error('no');
    const off = incant({ PREMIUM_SPELL: 'off' }, true);
    expect(await off.check('u1', r.grant)).toBe(false);
  });
});

describe('R17: nobody is told of the secret spell', () => {
  it("bati's prompts (JA / EN) never name or hint at it", () => {
    // every prompt text the package exports (BATI_CHARACTER, the make / sort rules …), both languages
    const texts = JSON.stringify(Object.values(ai).filter((v) => typeof v === 'string' || (v && typeof v === 'object')));
    expect(texts).toContain('いつものスペルで作るね');
    expect(texts).not.toMatch(/上級魔法|MiniMax|premium spell|secret spell|とっておきのスペル/i);
  });
  it('the web never names it in what it shows (only the server knows the passphrase)', () => {
    const web = join(__dirname, '../../../web');
    for (const f of ['components/atelier/AtelierChat.tsx', 'components/atelier/FloatingSpell.tsx', 'lib/api/http.ts']) {
      expect(readFileSync(join(web, f), 'utf8'), f).not.toMatch(/上級魔法で|PREMIUM_SPELL_WORDS/);
    }
  });
});
