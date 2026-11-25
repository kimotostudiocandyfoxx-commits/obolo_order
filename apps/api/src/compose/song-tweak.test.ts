import 'reflect-metadata';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lyricBlockKeys, lyricsFallback, lyricsSecondVerse, spellFrom, tweakPlan, type SongPhrase, type SongTweakResult } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { SongTweakService, type TweakDesign } from './song-tweak.service';
import { renderTweak, tweakGraph } from './tweak';

/** a 2番 song at 120 bpm: 4-beat lines back to back in each block */
function songRow() {
  const lyrics = lyricsSecondVerse(lyricsFallback(spellFrom('song', '夏の海の明るい曲')));
  const keys = lyricBlockKeys(lyrics);
  const phrases: SongPhrase[] = [];
  let beat = 8;
  lyrics.blocks.forEach((b, i) => {
    if (!b.lines.length) return void (i > 0 && (beat += 8));
    for (const text of b.lines) {
      phrases.push({ index: phrases.length, section: 'verse', text, slot: 'self', url: 'v', seconds: 1.8, startBeat: beat, beats: 4, block: keys[i] });
      beat += 4;
    }
    beat += 2;
  });
  const design: TweakDesign = { engine: 'acestep', bpm: 120, vocalsUrl: 'https://cdn/v.m4a', lyrics };
  return { id: 's1', userId: 'u1', mixUrl: 'https://cdn/orig.m4a', instrumentalUrl: 'https://cdn/i.m4a', seconds: (beat + 8) * 0.5, phrasesJson: phrases, designJson: design };
}

function svc(llm: { chat: () => Promise<string> } = { chat: async () => '{"ops":[]}' }) {
  const row = songRow() as Record<string, unknown>;
  const renders: { plan: ReturnType<typeof tweakPlan>; total: number }[] = [];
  let n = 0;
  const s = new SongTweakService({ name: 'test', ...llm } as never, {} as never, {} as never);
  Object.assign(s, {
    load: async (u: string, id: string) => {
      if (u !== 'u1' || id !== 's1') throw Object.assign(new Error('nf'), { getStatus: () => 404 });
      return row;
    },
    save: async (_u: string, _id: string, v: { mixUrl: string; seconds: number; phrases: SongPhrase[]; design: TweakDesign }) => Object.assign(row, { mixUrl: v.mixUrl, seconds: v.seconds, phrasesJson: v.phrases, designJson: v.design }),
    render: async (_u: string, o: { plan: ReturnType<typeof tweakPlan>; total: number }) => (renders.push(o), { data: Buffer.from('x'), seconds: o.total }),
    store: async () => `https://cdn/v${++n}.m4a`,
  });
  return { s, row, renders };
}
const t = (s: SongTweakService, body: Parameters<SongTweakService['tweak']>[2]) => s.tweak('u1', 's1', body, 'http://x');

describe('R13: POST /compose/songs/:id/tweak — free changes, versions and undo', () => {
  it('「テンポ速くして2番カット」: one new version from the original, the lyrics without 2番, no mana anywhere', async () => {
    const { s, row, renders } = svc();
    const before = row.seconds as number;
    const r = await t(s, { said: 'テンポ速くして2番カット' });
    expect(r).toMatchObject({ status: 'done', what: 'テンポを速く・2番をカット', versions: 2 });
    expect(renders[0].plan).toMatchObject({ tempo: 1.1, cuts: [{ cycle: 2 }] });
    expect(r.song!.seconds).toBeLessThan(before / 1.1);
    expect(r.song!.phrases.some((p) => p.block === 'verse#2')).toBe(false);
    expect(r.lyrics!.blocks.filter((b) => b.section === 'verse')).toHaveLength(1);
    expect(row.mixUrl).toBe('https://cdn/v1.m4a');
    expect((row.designJson as TweakDesign).original?.mixUrl).toBe('https://cdn/orig.m4a');
  });
  it('the ops add up from the original; 元に戻して goes one back, then to the original, then says it is the first', async () => {
    const { s, row, renders } = svc();
    await t(s, { said: 'テンポ速くして' });
    const r2 = await t(s, { said: 'キーを上げて' });
    expect(r2.ops).toEqual([{ op: 'tempo', factor: 1.1 }, { op: 'key', semitones: 2 }]);
    expect(renders[1].plan).toMatchObject({ tempo: 1.1, semitones: 2 });
    const u1 = await t(s, { said: '元に戻して' });
    expect(u1).toMatchObject({ status: 'undone', versions: 2, ops: [{ op: 'tempo', factor: 1.1 }] });
    expect(row.mixUrl).toBe('https://cdn/v1.m4a');
    const u2 = await t(s, { undo: true });
    expect(u2).toMatchObject({ status: 'undone', versions: 1, ops: [] });
    expect(row.mixUrl).toBe('https://cdn/orig.m4a');
    expect(((row.phrasesJson as SongPhrase[]).some((p) => p.block === 'verse#2'))).toBe(true);
    expect(await t(s, { undo: true })).toMatchObject({ status: 'first', versions: 1 });
  });
  it('what needs the studio is paid (the spell + mana), nothing rendered; a part not there is missing', async () => {
    const { s, renders } = svc();
    for (const said of ['歌詞を変えて', '3番を足して', '声を変えて', 'ロックにして']) expect((await t(s, { said })).status, said).toBe('paid');
    expect((await t(s, { said: '3番をカット' })).status).toBe('missing');
    expect(renders).toHaveLength(0);
  });
  it('words the rules do not know go to the model (its valid ops only); nothing understood is none', async () => {
    const { s } = svc({ chat: async () => '{"ops":[{"op":"room","amount":0.6}]}' });
    expect(await t(s, { said: 'お風呂で歌ってるみたいに' })).toMatchObject({ status: 'done', what: '響きをつけて' });
    const { s: s2 } = svc({ chat: async () => Promise.reject(new Error('down')) });
    expect((await t(s2, { said: 'ありがとう' })).status).toBe('none');
    const { s: s3 } = svc({ chat: async () => '{"ops":[],"paid":"melody"}' });
    expect((await t(s3, { said: 'もっとエモく' })).status).toBe('paid');
  });
  it('only the member’s own song', async () => {
    const { s } = svc();
    await expect(s.tweak('u2', 's1', { said: 'テンポ速く' }, 'x')).rejects.toBeTruthy();
  });
});

const ffmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
describe.skipIf(!ffmpeg)('R13: the ffmpeg render (two stems → the changed song)', () => {
  it('cuts with a crossfade, changes tempo and key, and lands on the planned length', async () => {
    const d = mkdtempSync(join(tmpdir(), 'tw-'));
    const tone = (f: number, file: string) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `sine=f=${f}:d=20`, '-ac', '2', '-c:a', 'aac', join(d, file)]);
    tone(220, 'i.m4a');
    tone(440, 'v.m4a');
    const plan = tweakPlan([{ op: 'tempo', factor: 1.25 }, { op: 'key', semitones: 2 }, { op: 'cut', part: { cycle: 2 } }, { op: 'room', amount: 0.5 }]);
    const segments = [{ start: 0, end: 8 }, { start: 12, end: 20 }];
    const total = (16 - 0.12) / 1.25;
    const out = await renderTweak({ instrumental: readFileSync(join(d, 'i.m4a')), vocals: readFileSync(join(d, 'v.m4a')), segments, plan, seconds: 20, total });
    expect(out.seconds).toBeGreaterThan(total - 0.5);
    expect(out.seconds).toBeLessThan(total + 0.5);
    const kar = tweakGraph({ segments: [{ start: 0, end: 20 }], plan: tweakPlan([{ op: 'only', stem: 'instrumental' }, { op: 'length', seconds: 12 }]), seconds: 20, total: 12, rubberband: false });
    expect(kar).not.toContain('[1:a]');
    expect(kar).toContain('afade=t=out:st=8.00:d=4.00');
    expect(tweakGraph({ segments, plan: tweakPlan([{ op: 'key', semitones: 2 }]), seconds: 20, total: 15.88, rubberband: false })).toMatch(/asetrate=\d+,aresample=44100,atempo=0\.89/);
  }, 60_000);
});
void (null as unknown as SongTweakResult);
