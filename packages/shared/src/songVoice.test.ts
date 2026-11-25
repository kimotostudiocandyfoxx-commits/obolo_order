import { describe, expect, it } from 'vitest';
import { MAKE_COST, MAKE_COST_ESTIMATE, SONG_VOICE_GPU_SEED, estimateJpy, quoteMana } from './manaPrice';
import { parseVoiceInvite, songVoiceGpuSeconds, songVoiceKey, songVoiceQuote, voiceAskOf, voiceInvite, voiceInviteValue, VOICE_INVITE_EVERY, type VoiceInviteState } from './songVoice';

const ok = { hasVoice: true, mediaOk: true };
/** n finished songs in a row: which of them got the invitation (1-based) */
function run(n: number, gate = ok, from: VoiceInviteState = { songs: 0, last: null }) {
  let st = from;
  const said: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = voiceInvite(st, gate);
    if (r.invite) said.push(r.next.songs);
    st = r.next;
  }
  return { said, st };
}

describe('R18: 君の声にする魔法 — the invitation after a song', () => {
  it('the first finished song, then at most once every few songs — never twice in a row', () => {
    const { said } = run(10);
    expect(said[0]).toBe(1);
    expect(said).toEqual([1, 1 + VOICE_INVITE_EVERY, 1 + 2 * VOICE_INVITE_EVERY, 1 + 3 * VOICE_INVITE_EVERY]);
    for (let i = 1; i < said.length; i++) expect(said[i] - said[i - 1]).toBeGreaterThan(1);
  });
  it('never without a registered voice or media consent (under 13 / 13–15 without a guardian: mediaOk false)', () => {
    expect(run(6, { hasVoice: false, mediaOk: true }).said).toEqual([]);
    expect(run(6, { hasVoice: true, mediaOk: false }).said).toEqual([]);
    // registered later: the next finished song is the first invitation
    const before = run(2, { hasVoice: false, mediaOk: true }).st;
    expect(voiceInvite(before, ok)).toMatchObject({ invite: true, next: { songs: 3, last: 3 } });
  });
  it('never for a song already in the member’s voice', () => {
    expect(voiceInvite({ songs: 0, last: null }, { ...ok, voiced: true }).invite).toBe(false);
  });
  it('kept as a short string (me.story)', () => {
    const st = { songs: 7, last: 4 };
    expect(parseVoiceInvite(voiceInviteValue(st))).toEqual(st);
    expect(parseVoiceInvite(undefined)).toEqual({ songs: 0, last: null });
    expect(parseVoiceInvite('3:')).toEqual({ songs: 3, last: null });
  });
});

describe('R18: the words', () => {
  it('the member’s own voice', () => {
    for (const s of ['自分の声にして', '僕の声で歌って', '君の声にする魔法', '君の声にする魔法を唱えて', 'わたしの声で歌って']) expect(voiceAskOf(s), s).toBe('own');
  });
  it('the original back', () => {
    for (const s of ['元の声で', '元の声に戻して', 'もとの声がいい']) expect(voiceAskOf(s), s).toBe('original');
  });
  it('someone else’s / a famous voice: other (declined)', () => {
    for (const s of ['お母さんの声で歌って', '田中さんの声にして', 'アイドルの声で歌って', '有名人の声にして', '友達の声で', '田中君の声にして']) expect(voiceAskOf(s), s).toBe('other');
  });
  it('anything else: not about this', () => {
    for (const s of ['テンポ速くして', '2番カット', 'いい曲だね']) expect(voiceAskOf(s), s).toBeNull();
  });
});

describe('R18: the price — the price rule of the estimated GPU seconds', () => {
  it('cold start + split + conversion; a song already split only pays the conversion', () => {
    expect(songVoiceGpuSeconds({ split: true })).toBe(SONG_VOICE_GPU_SEED.cold + SONG_VOICE_GPU_SEED.split + SONG_VOICE_GPU_SEED.convert);
    expect(songVoiceGpuSeconds({ split: false })).toBe(SONG_VOICE_GPU_SEED.cold + SONG_VOICE_GPU_SEED.convert);
    const full = songVoiceQuote({ split: true }, { usdJpy: 160, gpuSecondJpy: 0.5, cpuSecondJpy: 0.01 });
    const stems = songVoiceQuote({ split: false }, { usdJpy: 160, gpuSecondJpy: 0.5, cpuSecondJpy: 0.01 });
    expect(stems.mana).toBeLessThan(full.mana);
    expect(full.mana).toBe(quoteMana(full.costJpy));
  });
  it('recorded p90 seconds replace the seeds', () => {
    expect(songVoiceGpuSeconds({ split: false }, { cold: 10, convert: 20 })).toBe(30);
    expect(songVoiceGpuSeconds({ split: true }, { split: 0 })).toBe(SONG_VOICE_GPU_SEED.cold + SONG_VOICE_GPU_SEED.split + SONG_VOICE_GPU_SEED.convert);
  });
  it('the full spell is the price list’s songVoice (the seed table)', () => {
    expect(MAKE_COST.songVoice).toBe(quoteMana(estimateJpy(MAKE_COST_ESTIMATE.songVoice)));
    expect(songVoiceQuote({ split: true }).mana).toBe(MAKE_COST.songVoice);
  });
  it('the yes carries which quote it was', () => {
    expect(songVoiceKey('s1', true)).not.toBe(songVoiceKey('s1', false));
  });
});
