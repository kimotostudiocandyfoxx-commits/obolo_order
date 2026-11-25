import { describe, expect, it } from 'vitest';
import { lyricsFallback, lyricsSecondVerse, lyricBlockKeys } from './lyrics';
import { spellFrom } from './spell';
import { blockSpans, parseTweak, partBlocks, resolveLength, SongTweakBody, tweakLyrics, tweakPhrases, tweakPlan, tweakSegments, tweakWhat, TWEAK_XFADE, type SongTweakOp } from './songTweak';
import type { SongPhrase } from './types';

describe('R13: free changes of a finished song — the words → ops', () => {
  const table: [string, SongTweakOp[]][] = [
    ['テンポ速くして', [{ op: 'tempo', factor: 1.1 }]],
    ['もっとゆっくりにして', [{ op: 'tempo', factor: 0.85 }]],
    ['2番カットして', [{ op: 'cut', part: { cycle: 2 } }]],
    ['テンポ速くして2番カット', [{ op: 'tempo', factor: 1.1 }, { op: 'cut', part: { cycle: 2 } }]],
    ['サビをもう一回', [{ op: 'repeat', part: { section: 'chorus' } }]],
    ['30秒にして', [{ op: 'length', seconds: 30 }]],
    ['1分半にして', [{ op: 'length', seconds: 90 }]],
    ['キーを上げて', [{ op: 'key', semitones: 2 }]],
    ['キーを3つ下げて', [{ op: 'key', semitones: -3 }]],
    ['半音上げて', [{ op: 'key', semitones: 1 }]],
    ['歌だけ大きく', [{ op: 'balance', vocalDb: 4 }]],
    ['カラオケにして', [{ op: 'only', stem: 'instrumental' }]],
    ['アカペラにして', [{ op: 'only', stem: 'vocals' }]],
    ['間奏を消して', [{ op: 'cut', part: { section: 'instrumental' } }]],
    ['イントロいらない', [{ op: 'cut', part: { section: 'intro' } }]],
    ['最後はフェードアウトで', [{ op: 'fade', out: 5 }]],
    ['エコーをかけて', [{ op: 'room', amount: 0.5 }]],
    ['伴奏をもっと小さく', [{ op: 'balance', bgmDb: -6 }]],
  ];
  it.each(table)('%s', (said, ops) => expect(parseTweak(said).ops).toEqual(ops));
  it('undo, and what needs the studio (a spell and mana)', () => {
    expect(parseTweak('元に戻して').undo).toBe(true);
    expect(parseTweak('やっぱり前のがいい').undo).toBe(true);
    expect(parseTweak('歌を戻して')).toEqual({ ops: [{ op: 'only', stem: 'both' }] });
    expect(parseTweak('歌詞を変えて').paid).toBe('lyrics');
    expect(parseTweak('3番を足して').paid).toBe('extend');
    expect(parseTweak('2番を足して').paid).toBe('extend');
    expect(parseTweak('もっと長くして').paid).toBe('extend');
    expect(parseTweak('声を変えて').paid).toBe('voice');
    expect(parseTweak('メロディを変えて').paid).toBe('melody');
    expect(parseTweak('ロックにして').paid).toBe('genre');
    expect(parseTweak('いい感じ！')).toEqual({ ops: [] });
  });
  it('says what it did', () => {
    expect(tweakWhat(parseTweak('テンポ速くして2番カット').ops)).toBe('テンポを速く・2番をカット');
    expect(tweakWhat([{ op: 'key', semitones: -2 }, { op: 'only', stem: 'instrumental' }])).toBe('キーを2つ下げ・カラオケに');
  });
  it('the body is one of said / ops / undo', () => {
    expect(SongTweakBody.safeParse({ said: 'テンポ速く' }).success).toBe(true);
    expect(SongTweakBody.safeParse({ undo: true }).success).toBe(true);
    expect(SongTweakBody.safeParse({ said: 'x', undo: true }).success).toBe(false);
    expect(SongTweakBody.safeParse({ ops: [{ op: 'tempo', factor: 3 }] }).success).toBe(false);
  });
});

/** a 2番 song at 120 bpm (0.5 s a beat): each sung line 4 beats (2 s), each block's lines back to back, gaps between blocks */
function song() {
  const tags = spellFrom('song', '夏の海の明るい曲');
  const lyrics = lyricsSecondVerse(lyricsFallback(tags));
  const keys = lyricBlockKeys(lyrics);
  const phrases: SongPhrase[] = [];
  let beat = 8; // 4 s intro
  lyrics.blocks.forEach((b, i) => {
    if (!b.lines.length) {
      if (i > 0) beat += 8; // an instrumental block: 4 s
      return;
    }
    for (const text of b.lines) {
      phrases.push({ index: phrases.length, section: 'verse', text, slot: 'self', url: 'u', seconds: 1.8, startBeat: beat, beats: 4, block: keys[i], label: keys[i] });
      beat += 4;
    }
    beat += 2;
  });
  return { lyrics, phrases, seconds: (beat + 8) * 0.5 };
}

describe('R13: free changes — where the parts are and the cut timing math', () => {
  it('blocks in time from the line times; 2番 is its verse, pre-chorus and chorus', () => {
    const s = song();
    const spans = blockSpans(s.phrases, 120, s.seconds);
    expect(spans.map((x) => x.key)).toEqual(['verse#1', 'pre-chorus#1', 'chorus#1', 'verse#2', 'pre-chorus#2', 'chorus#2', 'bridge#1', 'final-chorus#1']);
    expect(spans[3].cycle).toBe(2);
    expect(spans[0].cycle).toBe(1);
    const two = partBlocks(spans, { cycle: 2 });
    expect(two.map((x) => x.key)).toEqual(['verse#2', 'pre-chorus#2', 'chorus#2']);
    // a block runs to just before the next one
    expect(spans[2].end).toBeCloseTo(spans[3].start + 0.35 - 0.35, 5);
  });
  it('cutting 2番: one stretch out, crossfaded; the lines after it move up by exactly that much', () => {
    const s = song();
    const spans = blockSpans(s.phrases, 120, s.seconds);
    const plan = tweakPlan([{ op: 'cut', part: { cycle: 2 } }]);
    const { segments, missing } = tweakSegments(spans, s.seconds, plan);
    expect(missing).toBe(false);
    expect(segments).toHaveLength(2);
    const v2 = spans.find((x) => x.key === 'verse#2')!;
    const c2 = spans.find((x) => x.key === 'chorus#2')!;
    expect(segments[0]).toEqual({ start: 0, end: v2.start });
    expect(segments[1].start).toBeCloseTo(c2.end, 5);
    const cut = c2.end - v2.start;
    const r = tweakPhrases(s.phrases, 120, segments, plan, s.seconds);
    expect(r.phrases.some((p) => p.block === 'verse#2' || p.block === 'chorus#2')).toBe(false);
    const bridgeBefore = s.phrases.find((p) => p.block === 'bridge#1')!.startBeat * 0.5;
    const bridgeAfter = r.phrases.find((p) => p.block === 'bridge#1')!.startBeat * 0.5;
    expect(bridgeAfter).toBeCloseTo(bridgeBefore - cut - TWEAK_XFADE, 2);
    expect(r.seconds).toBeCloseTo(Math.round((s.seconds - cut - TWEAK_XFADE) * 10) / 10, 1);
    // the lines are numbered again
    expect(r.phrases.map((p) => p.index)).toEqual(r.phrases.map((_, i) => i));
  });
  it('tempo scales every time; a length caps the end; a repeat puts the chorus again before the end', () => {
    const s = song();
    const spans = blockSpans(s.phrases, 120, s.seconds);
    const fast = tweakPlan([{ op: 'tempo', factor: 1.25 }]);
    const f = tweakPhrases(s.phrases, 120, tweakSegments(spans, s.seconds, fast).segments, fast, s.seconds);
    expect(f.phrases[3].startBeat).toBeCloseTo(s.phrases[3].startBeat / 1.25, 2);
    expect(f.seconds).toBeCloseTo(s.seconds / 1.25, 1);
    const short = tweakPlan([{ op: 'length', seconds: 30 }]);
    expect(tweakPhrases(s.phrases, 120, tweakSegments(spans, s.seconds, short).segments, short, s.seconds).seconds).toBe(30);
    const rep = tweakPlan([{ op: 'repeat', part: { section: 'chorus' } }]);
    const seg = tweakSegments(spans, s.seconds, rep).segments;
    expect(seg).toHaveLength(3);
    const lastChorus = spans.filter((x) => x.section === 'chorus').pop()!;
    expect(seg[1]).toEqual({ start: lastChorus.start, end: lastChorus.end });
    const r = tweakPhrases(s.phrases, 120, seg, rep, s.seconds);
    expect(r.phrases.filter((p) => p.block === 'chorus#2')).toHaveLength(8);
  });
  it('a part not in the song is missing; the ops add up (tempo × tempo, key + key, a cut undoes a repeat)', () => {
    const s = song();
    const spans = blockSpans(s.phrases, 120, s.seconds);
    expect(tweakSegments(spans, s.seconds, tweakPlan([{ op: 'cut', part: { cycle: 3 } }])).missing).toBe(true);
    const p = tweakPlan([{ op: 'tempo', factor: 1.1 }, { op: 'tempo', factor: 1.1 }, { op: 'key', semitones: 2 }, { op: 'key', semitones: 2 }, { op: 'repeat', part: { section: 'chorus' } }, { op: 'cut', part: { section: 'chorus' } }]);
    expect(p.tempo).toBeCloseTo(1.21, 5);
    expect(p.semitones).toBe(4);
    expect(p.repeats).toEqual([]);
    expect(resolveLength([{ op: 'length', seconds: -1 }], 100)).toEqual([{ op: 'length', seconds: 75 }]);
  });
  it('the lyric sheet after the change: cut parts gone, a repeated chorus again before the outro', () => {
    const s = song();
    const cut = tweakLyrics(s.lyrics, null, tweakPlan([{ op: 'cut', part: { cycle: 2 } }]));
    expect(cut.blocks.map((b) => b.section)).toEqual(['intro', 'verse', 'pre-chorus', 'chorus', 'bridge', 'final-chorus', 'outro']);
    const rep = tweakLyrics(s.lyrics, null, tweakPlan([{ op: 'repeat', part: { section: 'chorus' } }]));
    expect(rep.blocks.slice(-2).map((b) => b.section)).toEqual(['chorus', 'outro']);
  });
});
