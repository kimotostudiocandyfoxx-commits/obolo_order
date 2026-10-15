import type { SongDesign } from '@obolo/shared';
import { getApi } from '@/lib/api';
import { waitJob } from '@/lib/jobs';
import type { MvMade, SongMade } from './made';

/**
 * What the planet lessons of the first journey need from the server (StoryDay passes the real one,
 * the preview pages a fake one): Bati's sticker pictures and photos (Jupiter), lyrics and the sung song
 * (Mercury), the MV (Mars).
 */
export interface LessonApi {
  stickerArt(text: string): Promise<{ url: string }>;
  uploadPhoto(blob: Blob): Promise<{ url: string }>;
  /** Bati's lyric draft from the sticker's words */
  lyrics(words: string, partner: string): Promise<SongDesign>;
  /** the sung song (a background job: 2–3 minutes); `onStage` reports warming / singing */
  sing(design: SongDesign, onStage?: (stage: string | null) => void): Promise<{ id: string; title: string; url: string }>;
  /** keep the song on your shelf */
  saveSong(id: string): Promise<void>;
  /** Bati's MV for the song from the visitor's taps (a background job: a few minutes); `lyrics` = the lyrics on it too */
  mv(song: SongMade, wish: string, lyrics: boolean): Promise<MvMade>;
}

/** The instrumental for a chosen style (the lyric draft keeps its own melody and words). */
export const STYLE_SOUND: Record<string, { prompt: string; bpm: number }> = {
  pop: { prompt: 'bright modern J-pop, catchy, acoustic and electric guitars, piano, light drums, uplifting', bpm: 112 },
  rock: { prompt: 'energetic J-rock band, distorted guitars, driving drums, punchy bass', bpm: 150 },
  hiphop: { prompt: 'chill boom bap hip hop beat, warm bass, vinyl crackle, laid-back groove', bpm: 92 },
  ballad: { prompt: 'gentle piano ballad, soft strings, warm and emotional, slow', bpm: 72 },
  edm: { prompt: 'upbeat EDM, bright synth leads, four-on-the-floor kick, festival drop', bpm: 128 },
};

export const realLessonApi: LessonApi = {
  stickerArt: (text) => getApi().stickerArt(text),
  uploadPhoto: (blob) => getApi().uploadPhoto(blob),
  lyrics: (words, partner) => getApi().composeDesign({ partner, isBati: true, genre: 'auto', history: [{ role: 'user', text: words }] }),
  async sing(d, onStage) {
    const job = await getApi().composeFullSong({
      title: d.title.slice(0, 40),
      genre: d.genre,
      mood: d.mood.slice(0, 30),
      bpm: d.bpm,
      keyRoot: d.keyRoot,
      scale: d.scale,
      sections: d.sections.map((s) => ({ name: s.name, lines: s.lines.map((l) => ({ text: l.text.slice(0, 40), beats: l.notes.reduce((a, n) => a + n.beats, 0) })) })),
      instrumentalPrompt: d.instrumentalPrompt,
      progression: d.progression,
      seconds: Math.max(10, Math.min(180, d.seconds)),
    });
    const done = await waitJob(job, onStage);
    const song = done.result!.song!;
    return { id: song.id, title: song.title, url: song.url };
  },
  async saveSong(id) {
    await getApi().composeSongSave(id);
  },
  async mv(song, wish, lyrics) {
    const p = await getApi().mvCreate(song.id);
    let made = (await waitJob(await getApi().mvStory(p.id, wish))).result!.mv!;
    if (lyrics) made = (await waitJob(await getApi().mvLyrics(made.id))).result!.mv!;
    return { id: made.id, url: (lyrics && made.lyricsVideoUrl) || made.videoUrl!, poster: made.posterUrl ?? null, title: `${song.title}（MV）` };
  },
};
