import { describe, expect, it } from 'vitest';
import { BATI_VARIANTS } from './batiVariants';
import { MAKE_COST } from './manaPrice';
import { CRAFT_QUESTIONS } from './craft';
import { spellEdit, spellFrom, spellOfAnswers, spellPrompt, type SpellTag } from './spell';
import { pickSong, sceneRefs, sceneTimes, songTag, VIDEO_DEFAULTS, VIDEO_LINE_TEXTS, VIDEO_QUESTIONS, videoCost, videoEdit, videoParams, videoWindow, withSong, type VideoCut } from './video';

const SONGS = [
  { id: '11111111-1111-4111-8111-111111111111', title: '夏の海のポップ' },
  { id: '22222222-2222-4222-8222-222222222222', title: '星のバラード' },
  { id: '33333333-3333-4333-8333-333333333333', title: 'ネオンの帰り道' },
];
const ja = (ts: SpellTag[]) => ts.map((t) => t.ja);

describe('R13: a video spell → the pipeline settings', () => {
  it('Bati fills what was not said: an MV of the chorus, 8 pictures, 2.5D, soft fades, lyrics on', () => {
    const tags = spellFrom('video', '夏の海');
    expect(ja(tags)).toEqual(expect.arrayContaining(['曲のMV', 'アニメ風', 'パララックス', 'ふわっと切りかえ', '8場面', 'サビだけ', '歌詞を出す']));
    expect(videoParams(tags)).toEqual({ ...VIDEO_DEFAULTS, songId: null });
    expect(videoCost(tags)).toEqual({ kind: 'mv', mana: MAKE_COST.mv });
  });

  it('every talisman group maps to its setting', () => {
    const tags = withSong(spellFrom('video', '自分の写真をつないで、横に流れる感じで、ピカッと切りかえて、4場面、まるごと、歌詞なしで、モノクロ'), SONGS[1]);
    const p = videoParams(tags);
    expect(p).toMatchObject({ purpose: 'pictures', songId: SONGS[1].id, scenes: 4, length: 'full', camera: 'pan', transition: 'flash', captions: false, grade: 'mono' });
    // the member's own pictures: nothing painted, the cheap price, no painting touch on the spell
    expect(videoCost(tags)).toEqual({ kind: 'mvPictures', mana: MAKE_COST.mvPictures });
    expect(tags.some((t) => t.group === 'style')).toBe(false);
    expect(MAKE_COST.mvPictures).toBeLessThan(MAKE_COST.mv);
    expect(videoParams(spellFrom('video', 'お話のスライドで、ゆっくりズーム、12場面、1分、パッと切りかえ'))).toMatchObject({ purpose: 'slideshow', camera: 'zoom', pace: 'slow', scenes: 12, length: 'minute', transition: 'cut' });
    expect(videoParams(spellFrom('video', '空から見たカメラで'))).toMatchObject({ camera: 'fly' });
  });

  it('the painter is only told what the pictures look like (not the song id, the scenes or the camera)', () => {
    const tags = withSong(spellFrom('video', '夏の海、水彩、明るい'), SONGS[0]);
    const prompt = spellPrompt('video', tags);
    expect(prompt).toContain('watercolor');
    expect(prompt).toContain('still pictures that move');
    expect(prompt).not.toMatch(/song 1111|scenes|parallax|fade|lyric|purpose/);
  });

  it('taking the lyrics off turns the captions off; words change the camera', () => {
    const tags = spellFrom('video', '夏の海');
    expect(videoParams(spellEdit('video', tags, '歌詞は外して').tags).captions).toBe(false);
    expect(videoParams(spellEdit('video', tags, '横に流れる感じにして').tags).camera).toBe('pan');
  });
});

describe('R13: the song picked by its name', () => {
  it('「夏の海のポップにMVつけて」 picks that song; a near name too; nothing like it: none', () => {
    expect(pickSong(SONGS, '夏の海のポップにMVつけて')?.id).toBe(SONGS[0].id);
    expect(pickSong(SONGS, '星のバラードで')?.id).toBe(SONGS[1].id);
    expect(pickSong(SONGS, 'ネオンのやつ')?.id).toBe(SONGS[2].id);
    expect(pickSong(SONGS, 'カレーの歌')).toBeNull();
  });
  it('the song talisman shows the name; its id stays behind it', () => {
    const t = songTag(SONGS[0]);
    expect(t).toEqual({ ja: '夏の海のポップ', en: `song ${SONGS[0].id}`, group: 'source' });
    const tags = withSong(withSong(spellFrom('video', '夏'), SONGS[0]), SONGS[2]);
    expect(tags.filter((x) => x.group === 'source')).toEqual([songTag(SONGS[2])]);
  });
});

describe('R13: the window of the song and the scenes’ times', () => {
  const lyrics = [
    { t: 2, chorus: false },
    { t: 40, chorus: true },
  ];
  it('a short one starts a moment before the first chorus line; a long one from the start; the end', () => {
    expect(videoWindow({ length: 'chorus', part: 'auto' }, 120, lyrics)).toEqual({ start: 39, seconds: 30 });
    expect(videoWindow({ length: 'minute', part: 'auto' }, 120, lyrics)).toEqual({ start: 0, seconds: 60 });
    expect(videoWindow({ length: 'full', part: 'auto' }, 240, lyrics)).toEqual({ start: 0, seconds: 180 });
    expect(videoWindow({ length: 'chorus', part: 'end' }, 120, lyrics)).toEqual({ start: 90, seconds: 30 });
    expect(videoWindow({ length: 'chorus', part: 'start' }, 20, lyrics)).toEqual({ start: 0, seconds: 20 });
  });
  it('the scenes fill the window in their order, each at least 1.5 s', () => {
    const cut: VideoCut = { params: VIDEO_DEFAULTS, order: [2, 0, 1], scenes: [{ url: 'a', dur: 4 }, { url: 'b', dur: 4 }, { url: 'c', dur: 0.2 }] };
    const t = sceneTimes(cut, 30);
    expect(t.map((x) => x.k)).toEqual([2, 0, 1]);
    expect(t[0].dur).toBeGreaterThanOrEqual(1.5);
    expect(t.reduce((a, x) => a + x.dur, 0)).toBeCloseTo(30, 5);
  });
});

describe('R13: the words after it is made (free re-render or a small redraw)', () => {
  const cut = { params: VIDEO_DEFAULTS, order: [0, 1, 2, 3, 4, 5, 6, 7] };
  it('「カメラをもっとゆっくり」 is free: only the pace changes', () => {
    expect(videoEdit(cut, 'カメラをもっとゆっくり')).toEqual({ kind: 'free', params: { ...VIDEO_DEFAULTS, pace: 'slow' }, order: cut.order, changes: ['pace'] });
  });
  it('camera, fades, lyrics, order, a cut scene, length, the part of the song, colours: all free', () => {
    const r = (s: string) => videoEdit(cut, s);
    expect(r('横に流れるカメラにして')).toMatchObject({ kind: 'free', params: { camera: 'pan' } });
    expect(r('ピカッと切りかえて')).toMatchObject({ params: { transition: 'flash' } });
    expect(r('歌詞は消して')).toMatchObject({ params: { captions: false }, changes: ['captions'] });
    expect(r('歌詞をもっと大きく')).toMatchObject({ params: { captions: true, captionStyle: 'big' } });
    expect(r('3番目と5番目を入れかえて')).toMatchObject({ order: [0, 1, 4, 3, 2, 5, 6, 7], changes: ['order'] });
    expect(r('2番目の場面を消して')).toMatchObject({ order: [0, 2, 3, 4, 5, 6, 7], changes: ['cut'] });
    expect(r('最後の場面を最初にして')).toMatchObject({ order: [7, 0, 1, 2, 3, 4, 5, 6] });
    expect(r('逆の順番にして')).toMatchObject({ order: [7, 6, 5, 4, 3, 2, 1, 0] });
    expect(r('曲のまるごとにして')).toMatchObject({ params: { length: 'full' } });
    expect(r('はじめからにして')).toMatchObject({ params: { part: 'start' } });
    expect(r('もっと明るくして')).toMatchObject({ params: { grade: 'bright' } });
  });
  it('a new picture is a redraw (which scene, in the order shown); plain talk is no change', () => {
    expect(videoEdit({ params: VIDEO_DEFAULTS, order: [3, 1, 2, 0] }, '3番目の場面を水彩で描き直して')).toEqual({ kind: 'redraw', scenes: [2] });
    expect(videoEdit(cut, '最初の絵を描き直して')).toEqual({ kind: 'redraw', scenes: [0] });
    expect(videoEdit(cut, 'ちがう絵にして')).toEqual({ kind: 'redraw', scenes: [] });
    expect(videoEdit(cut, 'ありがとう')).toBeNull();
    expect(sceneRefs('三つ目と最後の場面', 8)).toEqual([2, 7]);
    expect(sceneRefs('3つ目と最後の場面', 8)).toEqual([2, 7]);
  });
});

describe("R13: {bati}'s video questions and lines", () => {
  it('the questions are the craft flow’s, with the examples inside', () => {
    expect(CRAFT_QUESTIONS.video).toBe(VIDEO_QUESTIONS);
    for (const q of VIDEO_QUESTIONS) expect(q.text).toMatch(/たとえば/);
    // a video is pictures that move: never a generated film
    for (const l of VIDEO_LINE_TEXTS) expect(l).not.toMatch(/動画生成|AIが動画/);
  });
  it('every line has all its styles, with the same placeholders and sentences', () => {
    const holes = (t: string) => [...t.matchAll(/\{[a-z]+\}/g)].map((m) => m[0]).sort();
    const sentences = (t: string) => (t.match(/[^！？。!?]+[！？。!?]*/g) ?? [t]).length;
    for (const line of VIDEO_LINE_TEXTS) {
      const v = BATI_VARIANTS[line];
      expect(v, line).toBeDefined();
      expect(Object.keys(v)).toHaveLength(10);
      for (const [k, s] of Object.entries(v)) {
        expect(holes(s), `${k}: ${line}`).toEqual(holes(line));
        expect(sentences(s), `${k}: ${s}`).toBe(sentences(line));
        if (k === 'teinei') expect(s).not.toMatch(/(です|ます)(?![\p{sc=Han}])/u);
      }
    }
  });
  it('a song answer is kept by the web as the song talisman (the answers alone give the defaults)', () => {
    const tags = spellOfAnswers('video', [{ group: 'purpose', said: 'MV' }, { group: 'camera', said: 'パララックスで' }]);
    expect(videoParams(tags)).toMatchObject({ purpose: 'mv', camera: 'parallax' });
  });
});
