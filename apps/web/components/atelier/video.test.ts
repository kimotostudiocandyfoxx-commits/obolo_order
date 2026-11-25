import { MAKE_COST, spellFrom, VIDEO_LINES, videoParams, type SpellView } from '@obolo/shared';
import { describe, expect, it, vi } from 'vitest';
import { craftAnswer, craftDoneLines } from './craft';
import { detect } from './intent';
import { DEMO_SONGS, demoEdited, demoRedrawn, demoReel, fixVideoSpell, videoBegin, videoChange, videoPrice, videoQuestionVars } from './video';
import type { Work } from './work';

vi.mock('@/lib/api', () => ({ getApi: () => ({ mode: 'demo', savedSongs: async () => [] }) }));

const view = (said: string): SpellView => ({ tags: spellFrom('video', said), added: [], removed: [] });

describe('R13: 映像 in the Moon chat (pictures that move)', () => {
  it('「夏の海のポップにMVつけて」 is a video ask; its song is picked by name, so only how the pictures move is asked', async () => {
    expect(detect('夏の海のポップにMVつけて', false)).toMatchObject({ kind: 'make', what: 'video' });
    const a = await videoBegin('夏の海のポップにMVつけて', false);
    expect(a?.left.map((q) => q.group)).toEqual(['camera']);
    const v = fixVideoSpell(view('MV'), '');
    expect(v.tags.find((t) => t.group === 'source')).toMatchObject({ ja: '夏の海のポップ', en: `song ${DEMO_SONGS[0].id}` });
    expect(videoParams(v.tags).songId).toBe(DEMO_SONGS[0].id);
  });
  it('a bare ask: what it is for, which song (named in the question), how it moves — in that order', async () => {
    const a = (await videoBegin('', true))!;
    expect(a.left.map((q) => q.group)).toEqual(['purpose', 'source', 'camera']);
    expect(videoQuestionVars().songs).toBe('「夏の海のポップ」や「星のバラード」や「ネオンの帰り道」');
    // the song answer picks the song
    const b = craftAnswer(craftAnswer(a, '曲のMVで'), '星のバラードにして');
    expect(b.left.map((q) => q.group)).toEqual(['camera']);
    expect(fixVideoSpell(view('MV'), '').tags.find((t) => t.group === 'source')?.ja).toBe('星のバラード');
    // a change that names another song moves the talisman
    expect(fixVideoSpell(view('MV'), '曲はネオンの帰り道にして').tags.filter((t) => t.group === 'source').map((t) => t.ja)).toEqual(['ネオンの帰り道']);
  });
  it('the price: painted scenes 8, your own pictures moved 2, a scene painted again 2', () => {
    expect(videoPrice(spellFrom('video', '夏の海'))).toBe(MAKE_COST.mv);
    expect(videoPrice(spellFrom('video', '自分の絵をつないで'))).toBe(MAKE_COST.mvPictures);
    expect(videoPrice(spellFrom('video', '夏の海'), [2])).toBe(MAKE_COST.mvRedraw);
  });
  it('after it is made: 「カメラをもっとゆっくり」 is a free change of the same pictures; a redraw names its scene', () => {
    const reel = demoReel(fixVideoSpell(view('MV'), '').tags);
    expect(reel.scenes).toHaveLength(8);
    expect(reel.params).toMatchObject({ camera: 'parallax', transition: 'fade', captions: true });
    const card: Work = { id: 'w', kind: 'video', prompt: 'MV', status: 'ready', reel };
    const r = videoChange(card, 'カメラをもっとゆっくり');
    expect(r).toMatchObject({ kind: 'free', params: { pace: 'slow' } });
    if (r?.kind !== 'free') return;
    const after = demoEdited(reel, r);
    expect(after.scenes).toBe(reel.scenes);
    expect(after.params.pace).toBe('slow');
    expect(videoChange(card, '3番目の場面を水彩で描き直して')).toEqual({ kind: 'redraw', scenes: [2] });
    expect(demoRedrawn(reel, [2]).scenes[2].url).not.toBe(reel.scenes[2].url);
    expect(videoChange({ ...card, reel: undefined }, 'カメラをもっとゆっくり')).toBeNull();
  });
  it('what Bati says once it is made, and once it is changed', () => {
    const w: Work = { id: 'w', kind: 'video', prompt: '', status: 'ready' };
    expect(craftDoneLines(w)).toEqual([{ text: VIDEO_LINES.done }]);
    expect(craftDoneLines({ ...w, versions: [{ prompt: '', at: '' }, { prompt: '', at: '' }] })).toEqual([{ text: VIDEO_LINES.edited }]);
  });
});
