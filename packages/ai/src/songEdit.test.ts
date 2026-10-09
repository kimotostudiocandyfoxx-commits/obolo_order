import { describe, expect, it } from 'vitest';
import { applyMixEdit, parseSongEdit, songEditSystem, type SongEditContext } from './songEdit';
import { phraseText } from './sing';

const ctx: SongEditContext = {
  title: 'あさのうた',
  genre: 'pop',
  bpm: 120,
  keyRoot: 0,
  scale: 'major',
  instrumentalPrompt: 'bright pop, no vocals',
  phrases: [0, 1, 2, 3].map((i) => ({ index: i, section: i < 2 ? ('verse' as const) : ('chorus' as const), text: `うた${i}`, slot: 'self' as const })),
  mix: { tempo: 1, vocalDb: 0, bgmDb: 0, delayBeats: 0, gaps: [0, 0, 0, 0] },
  hasBatiVoice: true,
};
const bati = { name: 'ポチ', isBati: true };

describe('song edit', () => {
  it('2番 / 大サビ: new sections after the song, tags stripped, bad parts dropped', () => {
    const p = parseSongEdit(
      '{"reply":"2番を作るね！","action":"SONG_EXTEND","kind":"second","sections":[{"name":"verse","lines":["[sing] ゆうやけのみち","かげがのびて"]},{"name":"outro","lines":["x"]},{"name":"chorus","lines":[{"text":"きみとなら"}]}]}',
      ctx,
      bati,
    );
    expect(p.action).toBe('SONG_EXTEND');
    expect(p.command).toEqual({ action: 'SONG_EXTEND', kind: 'second', sections: [{ name: 'verse', lines: ['ゆうやけのみち', 'かげがのびて'] }, { name: 'chorus', lines: ['きみとなら'] }] });
    expect(parseSongEdit('{"reply":"x","action":"SONG_EXTEND","kind":"forever","sections":[{"name":"verse","lines":["a"]}]}', ctx, bati).action).toBe('CHAT');
  });

  it('lists the lines with their numbers', () => {
    const s = songEditSystem(bati, ctx);
    expect(s.startsWith('SONG_EDIT')).toBe(true);
    expect(s).toContain('2: [サビ・自分の声] うた2');
  });

  it('volume / tempo: clamps and is applied relative to the mix', () => {
    const p = parseSongEdit('{"reply":"了解！","action":"VOLUME_TEMPO_EDIT","vocal_speed":1.5,"vocal_volume_db":2,"bgm_volume_db":-1.5}', ctx, bati);
    expect(p.command).toEqual({ action: 'VOLUME_TEMPO_EDIT', tempo: 1.25, vocalDb: 2, bgmDb: -1.5 });
    const m = applyMixEdit({ ...ctx.mix, tempo: 1.1 }, p.command!, 4);
    expect(m.tempo).toBe(1.25);
    expect(m.vocalDb).toBe(2);
    expect(m.bgmDb).toBe(-1.5);
  });

  it('lyrics: the spec single form, tags stripped, bad lines dropped', () => {
    const p = parseSongEdit('{"reply":"変えるね","action":"LYRICS_EDIT","target_phrase_index":2,"new_lyrics":"[singing] さようなら [breath] 忘れないよ"}', ctx, bati);
    expect(p.command).toEqual({ action: 'LYRICS_EDIT', edits: [{ index: 2, text: 'さようなら  忘れないよ' }] });
    expect(parseSongEdit('{"reply":"x","action":"LYRICS_EDIT","edits":[{"index":9,"text":"a"}]}', ctx, bati).action).toBe('CHAT');
  });

  it('voice B means Bati, refused when not registered', () => {
    expect(parseSongEdit('{"reply":"ok","action":"VOICE_REPLACE","target_phrase_index":2,"use_voice_id":"user_voice_B"}', ctx, bati).command).toEqual({ action: 'VOICE_REPLACE', indexes: [2], slot: 'bati' });
    const no = parseSongEdit('{"reply":"ok","action":"VOICE_REPLACE","indexes":[2],"voice":"bati"}', { ...ctx, hasBatiVoice: false }, bati);
    expect(no.action).toBe('CHAT');
    expect(no.reply).toContain('登録');
  });

  it('timing: delay and a gap after a line', () => {
    const p = parseSongEdit('{"reply":"ok","action":"TIMING_EDIT","delay_beats":4,"insert_silence_after_phrase":1,"silence_seconds":2}', ctx, bati);
    const m = applyMixEdit(ctx.mix, p.command!, 4);
    expect(m.delayBeats).toBe(4);
    expect(m.gaps).toEqual([0, 2, 0, 0]);
    expect(applyMixEdit(m, { action: 'TIMING_EDIT', delayBeats: -8 }, 4).delayBeats).toBe(0);
  });

  it('genre and chat', () => {
    expect(parseSongEdit('{"reply":"ok","action":"GENRE_EDIT","new_ace_step_prompt":"hard rock, no vocals"}', ctx, bati).command).toEqual({ action: 'GENRE_EDIT', prompt: 'hard rock, no vocals' });
    expect(parseSongEdit('{"reply":"BPMは変えられないよ","action":"CHAT"}', ctx, bati)).toEqual({ reply: 'BPMは変えられないよ', action: 'CHAT' });
    expect(parseSongEdit('not json', ctx, bati).action).toBe('CHAT');
  });

  it('one line sung on its own carries key, style and section tags', () => {
    const t = phraseText({ keyRoot: 7, scale: 'major', bpm: 100 }, { style: ['warm'], sections: [{ name: 'chorus', tags: ['pitch_up'] }], speed: 1, volume: 0, breathEvery: 2 }, 'chorus', 'ラララ[x]');
    expect(t).toBe('[singing][key: G major][tempo: 100 BPM][warm][pitch_up] ラララx');
  });
});
