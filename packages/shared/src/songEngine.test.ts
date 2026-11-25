import { describe, expect, it } from 'vitest';
import { lyricsFallback, type SongLyrics } from './lyrics';
import { spellFrom } from './spell';
import {
  minimaxLyrics,
  normalSongTask,
  premiumRequest,
  premiumSongTask,
  premiumWords,
  repaintSongTask,
  RUNWARE_LYRICS_MAX,
  saidPremiumWords,
  SONG_MODEL_NORMAL,
  SONG_MODEL_PREMIUM,
  phrasesAtTempo,
  SONG_DEFAULT_TEMPO,
  SONG_SECONDS_DEFAULT,
  SONG_SECONDS_MAX,
  songGenSeconds,
  songLyricsSeconds,
  songSeconds,
  spellSeconds,
  tweakNeedsSplit,
} from './songEngine';
import { tweakPlan } from './songTweak';

const lyrics: SongLyrics = {
  title: '夜の光',
  blocks: [
    { section: 'intro', hints: [], lines: [] },
    { section: 'verse', hints: [], lines: ['夜の街に 広がる', '青とピンクの 光'] },
    { section: 'pre-chorus', hints: ['building'], lines: ['胸のおくで なにかが鳴る'] },
    { section: 'chorus', hints: ['harmonies'], lines: ['光の中へ 光の中へ', 'とけていく 夜の向こう'] },
    { section: 'guitar-solo', hints: [], lines: [] },
    { section: 'outro', hints: ['fade'], lines: [] },
  ],
};

describe('R17: a normal song on Runware (ACE-Step 1.5 XL SFT)', () => {
  it('builds the request: the spell English, our metatag sheet, the length, the language, the key', () => {
    const t = normalSongTask({ taskUUID: 'u1', prompt: 'japanese city pop, female vocal', lyrics, seconds: 75, bpm: 118, keyRoot: 9, scale: 'minor' });
    expect(t).toMatchObject({ taskType: 'audioInference', model: SONG_MODEL_NORMAL, positivePrompt: 'japanese city pop, female vocal', duration: 75, outputFormat: 'MP3', includeCost: true, deliveryMethod: 'async' });
    expect(t.settings).toMatchObject({ vocalLanguage: 'ja', bpm: 118, keyScale: 'A minor' });
    expect(t.settings.lyrics).toContain('[Pre-Chorus - building energy]');
    expect(t.settings.lyrics).toContain('[Chorus - harmonies]\n光の中へ 光の中へ');
    expect(t.settings.lyrics).toContain('[Guitar Solo]');
  });
  it('keeps the length in 30–300 s and the lyrics under 3000 characters (cut at a block)', () => {
    expect(normalSongTask({ taskUUID: 'u', prompt: 'p', lyrics, seconds: 12 }).duration).toBe(30);
    expect(normalSongTask({ taskUUID: 'u', prompt: 'p', lyrics, seconds: 900 }).duration).toBe(300);
    const long = Array.from({ length: 200 }, (_, i) => `[Verse ${i}]\n${'あ'.repeat(30)}`).join('\n\n');
    const s = normalSongTask({ taskUUID: 'u', prompt: 'p', lyrics: long, seconds: 90 }).settings.lyrics;
    expect(s.length).toBeLessThanOrEqual(RUNWARE_LYRICS_MAX);
    expect(s.endsWith('あ')).toBe(true);
  });
  it('R17 the length: 60 s by default; longer only when the lyrics do not fit or the member asks', () => {
    expect(SONG_SECONDS_DEFAULT).toBe(60);
    expect(songSeconds({})).toBe(60);
    // {bati}'s one verse fits in a minute (pop, a ballad's slow tempo aside)
    expect(songSeconds({ lyrics, bpm: 118 })).toBe(60);
    expect(songSeconds({ lyrics: lyricsFallback(spellFrom('song', '夏の海の明るい曲')), bpm: 120 })).toBe(60);
    expect(songSeconds({ lyrics: lyricsFallback(spellFrom('song', 'サイケデリックトランスの曲')), bpm: 145 })).toBe(60);
    // a full song (2番, Cメロ, 大サビ) does not fit: longer, as long as it takes to sing
    const full = lyricsFallback(spellFrom('song', '夏の海の明るい曲'), 'フルで');
    const long = songSeconds({ lyrics: full, bpm: 120 });
    expect(long).toBeGreaterThan(100);
    expect(long).toBeLessThanOrEqual(SONG_SECONDS_MAX);
    expect(songLyricsSeconds(full, 120)).toBeGreaterThan(songLyricsSeconds(lyrics, 120) * 1.8);
    // the same lyrics take longer slower
    expect(songLyricsSeconds(full, 80)).toBeGreaterThan(songLyricsSeconds(full, 140));
    // a resung song keeps its length (atLeast)
    expect(songSeconds({ lyrics, bpm: 118, atLeast: 75 })).toBe(75);
  });
  it('R17 the length the member asked for is honoured (a length talisman: exact, or at least for 長め / フル)', () => {
    expect(spellSeconds([{ ja: '1分', en: 'about 60 seconds', group: 'length' }])).toBe(60);
    expect(spellSeconds([{ ja: 'サビだけ', en: 'about 30 seconds: the chorus', group: 'length' }])).toBe(30);
    expect(songSeconds({ tags: [{ ja: '2分', en: 'two minutes', group: 'length' }] })).toBe(120);
    const len = (said: string) => spellFrom('song', said).filter((t) => t.group === 'length');
    expect(songSeconds({ tags: len('夏の曲を2分で作って'), lyrics })).toBe(120);
    expect(songSeconds({ tags: len('30秒の曲にして'), lyrics })).toBe(30);
    expect(songSeconds({ tags: len('1分半くらいの曲'), lyrics })).toBe(90);
    expect(songSeconds({ tags: len('長めの曲を作って'), lyrics })).toBe(120);
    expect(songSeconds({ tags: len('フルで作って'), lyrics })).toBe(180);
    // nothing about length in the words: no talisman, a minute
    expect(len('夏の海の明るい曲')).toEqual([]);
    expect(len('十二分に楽しい曲')).toEqual([]);
    expect(len('フルーツの歌')).toEqual([]);
  });
  it('R17 sung 1.2× longer, delivered 1.2× faster: the generated length and the line times', () => {
    expect(SONG_DEFAULT_TEMPO).toBe(1.2);
    expect(songGenSeconds(60)).toBe(72);
    expect(songGenSeconds(150)).toBe(180);
    expect(songGenSeconds(60, 1)).toBe(60);
    expect(songGenSeconds(280)).toBe(SONG_SECONDS_MAX);
    const p = [{ startBeat: 12, beats: 6, seconds: 3 }];
    expect(phrasesAtTempo(p, 1.2)).toEqual([{ startBeat: 10, beats: 5, seconds: 2.5 }]);
    expect(phrasesAtTempo(p, 1)).toBe(p);
  });
  it('a part again / longer: audio to audio with the song and the seconds to repaint', () => {
    const t = repaintSongTask({ taskUUID: 'u', prompt: 'p', lyrics, audio: 'https://cdn/x.mp3', start: 60, end: 100, seconds: 100 });
    expect(t).toMatchObject({ model: SONG_MODEL_NORMAL, inputs: { audio: 'https://cdn/x.mp3' }, repaintingStart: 60, repaintingEnd: 100, duration: 100 });
  });
});

describe('R17: the secret spell on Runware (MiniMax Music 2.6)', () => {
  it('maps our metatags to MiniMax’s tags (no hints in them; the hint words go to the prompt)', () => {
    const l = minimaxLyrics(lyrics);
    expect(l).toBe('[Intro]\n\n[Verse]\n夜の街に 広がる\n青とピンクの 光\n\n[Pre Chorus]\n胸のおくで なにかが鳴る\n\n[Chorus]\n光の中へ 光の中へ\nとけていく 夜の向こう\n\n[Inst]\n\n[Outro]');
    const t = premiumSongTask({ taskUUID: 'u', prompt: 'city pop', lyrics });
    expect(t).toMatchObject({ model: SONG_MODEL_PREMIUM, includeCost: true, outputFormat: 'MP3' });
    expect(t.duration).toBeUndefined();
    expect(t.positivePrompt).toContain('building energy');
    expect(t.positivePrompt).toContain('vocal harmonies');
  });
  it('the passphrase: 「上級魔法で」 anywhere, light variants, the rest is the request', () => {
    // (the real passphrase lives on the server only; these are its shape)
    const w = premiumWords(undefined, ['上級魔法で', 'じょうきゅうまほうで']);
    expect(w).toEqual(['上級魔法で', 'じょうきゅうまほうで']);
    expect(saidPremiumWords('上級魔法で、夏の曲を唱えて', w)).toBe(true);
    expect(saidPremiumWords('じょうきゅうまほうで おねがい', w)).toBe(true);
    expect(saidPremiumWords('上級 魔法で！', w)).toBe(true);
    expect(saidPremiumWords('夏の曲を作って', w)).toBe(false);
    expect(saidPremiumWords('上級の曲', w)).toBe(false);
    expect(premiumRequest('上級魔法で、夏の曲を唱えて', w)).toBe('夏の曲を作って');
    expect(premiumRequest('上級魔法でお願い', w)).toBe('');
    expect(premiumRequest('上級魔法で作って', w)).toBe('');
    expect(premiumRequest('じょうきゅうまほうで、海のバラード', w)).toBe('海のバラード');
    expect(premiumRequest('海のバラード', w)).toBeNull();
    expect(premiumWords('ひみつの歌, とっておき', w)).toEqual(['ひみつの歌', 'とっておき']);
    expect(premiumWords('', w)).toBe(w);
  });
});

describe('R17: what wakes our GPU', () => {
  it('only the changes that need the stems or the line times', () => {
    expect(tweakNeedsSplit(tweakPlan([{ op: 'tempo', factor: 1.1 }, { op: 'key', semitones: 1 }, { op: 'length', seconds: 60 }, { op: 'fade', out: 4 }]))).toBe(false);
    expect(tweakNeedsSplit(tweakPlan([{ op: 'only', stem: 'instrumental' }]))).toBe(true);
    expect(tweakNeedsSplit(tweakPlan([{ op: 'balance', vocalDb: 3 }]))).toBe(true);
    expect(tweakNeedsSplit(tweakPlan([{ op: 'cut', part: { cycle: 2 } }]))).toBe(true);
    expect(tweakNeedsSplit(tweakPlan([{ op: 'room', amount: 0.5 }]))).toBe(true);
  });
});
