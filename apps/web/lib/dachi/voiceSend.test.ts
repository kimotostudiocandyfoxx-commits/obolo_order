import { CUTE_VOICE_RATE, cuteVoiceMana, SendDachiMessageBody } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { cleanCost, voicePartOf, voiceSendBody, voiceToSend } from './voiceSend';

const ID = 'a1111111-1111-4111-8111-111111111111';

describe('what the draft card sends (client 2026-11-27: 「そのまま」 / 「きれい」)', () => {
  it('「そのまま」: the made-ready recording with its caption and its sound', () => {
    const v = voiceToSend({ version: 'asis', mediaId: ID, seconds: 4.26, ready: true }, ' やったー！ ', 'ureshii', true);
    expect(v).toEqual({ mediaId: ID, seconds: 4.26, caption: 'やったー！', sound: 'ureshii', soft: true });
    expect(voiceSendBody(v!)).toEqual({ mediaId: ID, seconds: 4.3, caption: 'やったー！', sound: 'ureshii', soft: true });
    // a chip pressed by the member is the full sound; `soft` belongs to うれしい only
    expect(voiceToSend({ version: 'asis', mediaId: ID, seconds: 4, ready: true }, '', 'oyasumi', true)).toEqual({ mediaId: ID, seconds: 4, caption: undefined, sound: 'oyasumi', soft: false });
    // a take the server could not make ready: as it is, no caption, no sound
    expect(voiceToSend({ version: 'asis', mediaId: ID, seconds: 4, ready: false }, 'x', 'none', false)).toEqual({ mediaId: ID, seconds: 4 });
  });

  it('「きれい」: the words themselves are sent to be read — never the recording; a 「そのまま」 draft of the same take is dropped', () => {
    const v = voiceToSend({ version: 'clean', mediaId: null, seconds: 0, ready: true }, 'あした、あそぼう', 'ureshii', false);
    expect(v).toEqual({ clean: true, text: 'あした、あそぼう', sound: 'ureshii', soft: false });
    const body = voiceSendBody(v!);
    expect(body).toEqual({ text: 'あした、あそぼう', spoken: true, sound: 'ureshii', soft: false });
    expect(JSON.stringify(body)).not.toContain('mediaId');
    expect(SendDachiMessageBody.safeParse(body).success).toBe(true);
    // the member first had the 「そのまま」 draft, then chose 「きれい」: its file is named to be thrown away
    const after = voiceToSend({ version: 'clean', mediaId: ID, seconds: 4, ready: true }, 'うん', 'none', false);
    expect(voiceSendBody(after!)).toEqual({ text: 'うん', spoken: true, sound: 'none', soft: false, drop: ID });
    expect(SendDachiMessageBody.parse(voiceSendBody(after!))).toMatchObject({ drop: ID, spoken: true });
  });

  it('nothing to send: 「きれい」 with no words to read; 「そのまま」 before its file is there', () => {
    expect(voiceToSend({ version: 'clean', mediaId: ID, seconds: 4, ready: true }, '  ', 'ureshii', false)).toBeNull();
    expect(voiceToSend({ version: 'asis', mediaId: null, seconds: 0, ready: true }, 'うん', 'ureshii', false)).toBeNull();
  });

  it('the small price beside 〔送る〕 is the price of these words (per character), shown before the send', () => {
    const words = 'あ'.repeat(40);
    expect(cleanCost(words, CUTE_VOICE_RATE)).toEqual({ text: `−${cuteVoiceMana(words)}`, label: `マナ ${cuteVoiceMana(words)} をつかうよ` });
    expect(cleanCost('おはよう', CUTE_VOICE_RATE)?.text).toBe('−0.1');
    expect(cleanCost('   ', CUTE_VOICE_RATE)).toBeNull();
  });
});

describe('a voice message in the talk: the sender does not hear their own', () => {
  const base = { kind: 'voice' as const, seconds: 6.3 };
  it('your own voice (the recording, or 「きれい」): no play control — only the mark that it was sent', () => {
    const mine = voicePartOf({ ...base, fromMe: true, audioUrl: null, sentVoice: true });
    expect(mine).toEqual({ voiceSent: { seconds: 6.3 } });
    expect(mine.voice).toBeUndefined();
  });
  it('the other one’s voice plays as ever, with the voice alone for 〔おとをけす〕', () => {
    expect(voicePartOf({ ...base, fromMe: false, audioUrl: 'https://r2/mix.mp3', sound: { mood: 'ureshii', plainUrl: 'https://r2/v.mp3' } })).toEqual({ voice: { url: 'https://r2/mix.mp3', seconds: 6.3, plainUrl: 'https://r2/v.mp3' } });
  });
  it('the default cute voice of a member who is not recorded is not their own voice: it plays as before', () => {
    expect(voicePartOf({ ...base, fromMe: true, audioUrl: 'https://r2/cute.mp3' })).toEqual({ voice: { url: 'https://r2/cute.mp3', seconds: 6.3, plainUrl: undefined } });
  });
  it('words, works and files have no voice part', () => {
    expect(voicePartOf({ kind: 'text', fromMe: true, audioUrl: null, seconds: null })).toEqual({});
  });
});
