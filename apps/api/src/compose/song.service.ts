import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  applyMixEdit,
  type ChatTurn,
  type LlmProvider,
  moderateText,
  parseSingDirection,
  parseSongEdit,
  phraseText,
  singDirectionSystem,
  songEditSystem,
} from '@obolo/ai';
import type { SingBody, SingDirection, SongEditBody, SongEditCommand, SongEditResult, SongMix, SongPhrase, SongView, VoiceSlot } from '@obolo/shared';
import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { AppConfig, CONFIG } from '../config';
import { Database } from '../db/db';
import { songs, users } from '../db/schema';
import { LLM } from '../infra/tokens';
import { MediaService } from '../media/media.service';
import { VoiceService } from '../voice/voice.service';
import { guideWav, preparePhrase, renderSong } from './mix';
import { generateInstrumental } from './music.client';

/** What is stored in songs.design_json. */
interface StoredDesign {
  genre: string;
  mood: string;
  bpm: number;
  keyRoot: number;
  scale: 'major' | 'minor';
  progression: number[];
  seconds: number;
  instrumentalPrompt: string;
  /** the design melody split per line (for the optional Fish guide, P-VOICE-5) */
  lineMelody: { midi: number | null; beats: number }[][];
}

type SongRow = typeof songs.$inferSelect;

const DEFAULT_MIX: Omit<SongMix, 'gaps'> = { tempo: 1, vocalDb: 0, bgmDb: 0, delayBeats: 0 };
const why = (e: unknown) => String(e instanceof Error ? e.message : e).replace(/\s+/g, ' ').slice(0, 160);

/** Run async jobs a few at a time (Fish calls for the lines of one song). */
async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

/**
 * Mercury songs with vocals (client spec 2026-10-07): sing each lyric line in the member's voice
 * (one Fish call per line), mix over the instrumental, and keep every part so chat edits re-use
 * what they can. Only a lyric / voice change calls Fish again (for those lines), only a genre
 * change calls the GPU again; tempo, volume and timing are re-mixes.
 */
@Injectable()
export class SongService {
  private readonly log = new Logger('Song');
  constructor(
    @Inject(LLM) private readonly llm: LlmProvider,
    @Inject(CONFIG) private readonly cfg: AppConfig,
    private readonly db: Database,
    private readonly media: MediaService,
    private readonly voice: VoiceService,
  ) {}

  // --- create -----------------------------------------------------------------------------------

  async create(userId: string, body: SingBody, origin: string): Promise<SongView> {
    const lyrics = body.sections.flatMap((s) => s.lines.map((l) => l.text)).join('\n');
    if ((await moderateText(lyrics)).flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'CONTENT_FLAGGED', 'This cannot be sung');
    await this.voice.voiceId(userId, body.slot); // registered? (fails fast before any paid call)
    const instrumental = await this.media.audioByUrl(userId, body.instrumentalUrl);
    if (!instrumental) throw apiError(HttpStatus.NOT_FOUND, 'INSTRUMENTAL_NOT_FOUND', 'Make the instrumental first');

    const song = { title: body.title, genre: body.genre, mood: body.mood, bpm: body.bpm, keyRoot: body.keyRoot, scale: body.scale, sections: body.sections };
    let raw = '';
    try {
      raw = await this.llm.chat({ system: singDirectionSystem(song), history: [{ role: 'user', text: '歌い方を決めて' }], json: true, temperature: 0.6, maxOutputTokens: 400 });
    } catch (e) {
      this.log.warn(`sing direction failed, using the default: ${String(e)}`);
    }
    const direction = parseSingDirection(raw, song);

    // the lines with where they sit in the design, and the design melody split per line
    let beat = 0;
    let note = 0;
    const lineMelody: StoredDesign['lineMelody'] = [];
    const lines = body.sections.flatMap((s) =>
      s.lines.map((l) => {
        const startBeat = beat;
        beat += l.beats;
        const notes: StoredDesign['lineMelody'][number] = [];
        let b = 0;
        while (note < body.melody.length && b < l.beats - 1e-6) {
          notes.push(body.melody[note]);
          b += body.melody[note++].beats;
        }
        lineMelody.push(notes);
        return { section: s.name, text: l.text, startBeat, beats: l.beats };
      }),
    );
    const design: StoredDesign = {
      genre: body.genre,
      mood: body.mood,
      bpm: body.bpm,
      keyRoot: body.keyRoot,
      scale: body.scale,
      progression: body.progression,
      seconds: body.seconds,
      instrumentalPrompt: body.instrumentalPrompt,
      lineMelody,
    };
    const phrases = await pool(lines, 4, (l, i) =>
      this.singLine(userId, origin, design, direction, { index: i, section: l.section, text: l.text, slot: body.slot, startBeat: l.startBeat, beats: l.beats }),
    );
    const mix: SongMix = { ...DEFAULT_MIX, gaps: phrases.map(() => 0) };
    const out = await this.render(userId, origin, instrumental, design.bpm, phrases, mix);
    const [row] = await this.db.write
      .insert(songs)
      .values({
        userId,
        title: body.title,
        designJson: design as unknown as Record<string, unknown>,
        instrumentalUrl: body.instrumentalUrl,
        phrasesJson: phrases as unknown as Record<string, unknown>[],
        mixJson: mix as unknown as Record<string, unknown>,
        directionJson: direction as unknown as Record<string, unknown>,
        mixUrl: out.url,
        seconds: out.seconds,
      })
      .returning();
    this.log.log(`song ${row.id} ${userId} "${body.title}" ${phrases.length} lines ${out.seconds}s ${JSON.stringify(direction)}`);
    return this.view(row);
  }

  /** One lyric line → Fish (its own call) → trimmed MP3 on Bunny. */
  private async singLine(
    userId: string,
    origin: string,
    design: StoredDesign,
    direction: SingDirection,
    p: Omit<SongPhrase, 'url' | 'seconds'>,
  ): Promise<SongPhrase> {
    const ref = await this.voice.voiceId(userId, p.slot);
    const melody = design.lineMelody[p.index] ?? [];
    const references = this.cfg.FISH_SING_GUIDE && melody.some((n) => n.midi !== null) ? [{ audio: guideWav(melody, design.bpm), text: p.text }] : undefined;
    const mp3 = await this.voice.sing(ref, {
      text: phraseText(design, direction, p.section, p.text),
      prosody: { speed: direction.speed, volume: direction.volume },
      references,
    });
    let prepared: { data: Buffer; seconds: number };
    try {
      prepared = await preparePhrase(mp3);
    } catch (e) {
      this.log.warn(`phrase prepare failed: ${String(e)}`);
      throw apiError(HttpStatus.BAD_GATEWAY, 'MIX_FAILED', `A sung line could not be read: ${why(e)}`);
    }
    const m = await this.media.storeAudio(userId, 'audio/mpeg', prepared.data, origin);
    return { ...p, url: m.url, seconds: prepared.seconds };
  }

  private async render(userId: string, origin: string, instrumental: Buffer, bpm: number, phrases: SongPhrase[], mix: SongMix) {
    const parts = await Promise.all(
      phrases.map(async (p) => {
        const data = await this.media.audioByUrl(userId, p.url);
        if (!data) throw apiError(HttpStatus.NOT_FOUND, 'PHRASE_NOT_FOUND', `Sung line ${p.index} is missing`);
        return { data, seconds: p.seconds, startBeat: p.startBeat, beats: p.beats };
      }),
    );
    let out: { data: Buffer; seconds: number };
    try {
      out = await renderSong({ instrumental, phrases: parts, bpm, mix });
    } catch (e) {
      this.log.warn(`render failed: ${String(e)}`);
      throw apiError(HttpStatus.BAD_GATEWAY, 'MIX_FAILED', `The song could not be mixed: ${why(e)}`);
    }
    const m = await this.media.storeAudio(userId, 'audio/mp4', out.data, origin);
    return { url: m.url, seconds: out.seconds };
  }

  // --- edit -------------------------------------------------------------------------------------

  private async owned(userId: string, id: string): Promise<SongRow> {
    const [row] = await this.db.write.select().from(songs).where(and(eq(songs.id, id), eq(songs.userId, userId), isNull(songs.deletedAt)));
    if (!row) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Song not found');
    return row;
  }

  async get(userId: string, id: string): Promise<SongView> {
    return this.view(await this.owned(userId, id));
  }

  /**
   * A chat message about the song → Gemini picks one action (or `command` is a retry of one
   * already picked) → only the needed part is regenerated → re-mix.
   */
  async edit(userId: string, id: string, body: SongEditBody, origin: string): Promise<SongEditResult> {
    const row = await this.owned(userId, id);
    const design = row.designJson as unknown as StoredDesign;
    let phrases = row.phrasesJson as unknown as SongPhrase[];
    let mix = row.mixJson as unknown as SongMix;
    const partner = { name: body.partner, isBati: body.isBati };

    let reply = '';
    let command: SongEditCommand | undefined = body.command;
    if (!command) {
      if ((await moderateText(body.message!)).flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'CONTENT_FLAGGED', 'This cannot be used');
      const [u] = await this.db.write.select({ bati: users.voiceBatiId }).from(users).where(eq(users.id, userId));
      const ctx = { title: row.title, genre: design.genre, bpm: design.bpm, keyRoot: design.keyRoot, scale: design.scale, instrumentalPrompt: design.instrumentalPrompt, phrases, mix, hasBatiVoice: !!u?.bati };
      const history: ChatTurn[] = [...body.history.map((t) => ({ role: t.role === 'partner' ? ('assistant' as const) : ('user' as const), text: t.text })), { role: 'user', text: body.message! }];
      let raw: string;
      try {
        raw = await this.llm.chat({ system: songEditSystem(partner, ctx), history, json: true, temperature: 0.4, maxOutputTokens: 600 });
      } catch (e) {
        this.log.warn(`edit decision failed: ${String(e)}`);
        throw apiError(HttpStatus.BAD_GATEWAY, 'MAKE_FAILED', `The partner could not answer: ${why(e)}`);
      }
      const parsed = parseSongEdit(raw, ctx, partner);
      reply = parsed.reply;
      if (!parsed.command) return { reply, action: 'CHAT', song: this.view(row) };
      command = parsed.command;
    }

    let instrumentalUrl = row.instrumentalUrl;
    switch (command.action) {
      case 'VOLUME_TEMPO_EDIT':
      case 'TIMING_EDIT':
        mix = applyMixEdit(mix, command, phrases.length);
        break;
      case 'LYRICS_EDIT': {
        const text = command.edits.map((e) => e.text).join('\n');
        if ((await moderateText(text, this.llm)).flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'CONTENT_FLAGGED', 'This cannot be sung');
        const changes = new Map(command.edits.filter((e) => e.index < phrases.length).map((e) => [e.index, e.text]));
        phrases = await this.resing(userId, origin, design, row, phrases, changes, (p) => ({ ...p, text: changes.get(p.index)! }));
        break;
      }
      case 'VOICE_REPLACE': {
        const slot: VoiceSlot = command.slot;
        await this.voice.voiceId(userId, slot);
        const targets = new Map(command.indexes.filter((i) => i < phrases.length).map((i) => [i, slot]));
        phrases = await this.resing(userId, origin, design, row, phrases, targets, (p) => ({ ...p, slot }));
        break;
      }
      case 'GENRE_EDIT': {
        if (!this.cfg.MUSIC_URL) throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'MUSIC_OFF', 'The music studio is not connected yet');
        const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        // key and tempo stay: the stored vocal lines are re-used as they are
        const prompt = `${command.prompt.replace(/\s*,?\s*no vocals\s*/gi, '')}, ${design.bpm} bpm, ${names[design.keyRoot]} ${design.scale}, no vocals`.slice(0, 500);
        try {
          const made = await generateInstrumental(this.cfg.MUSIC_URL, {
            title: row.title,
            prompt,
            seconds: design.seconds,
            bpm: design.bpm,
            keyRoot: design.keyRoot,
            scale: design.scale,
            progression: design.progression,
            melody: design.lineMelody.flat().slice(0, 600),
          });
          instrumentalUrl = (await this.media.storeAudio(userId, 'audio/mp4', made.data, origin)).url;
          design.instrumentalPrompt = prompt;
        } catch (e) {
          if (e instanceof HttpException && (e.getResponse() as { error?: { code?: string } })?.error?.code === 'MUSIC_WARMING') {
            return {
              reply: reply || (partner.isBati ? '音楽スタジオを起こしてるところ…準備できたら自動で作り直すね！' : 'スタジオを起こしてるケン…準備できたら自動で作り直すぞ！'),
              action: command.action,
              song: this.view(row),
              pending: 'MUSIC_WARMING',
              command,
            };
          }
          throw e;
        }
        break;
      }
    }

    const instrumental = await this.media.audioByUrl(userId, instrumentalUrl);
    if (!instrumental) throw apiError(HttpStatus.NOT_FOUND, 'INSTRUMENTAL_NOT_FOUND', 'The instrumental is missing');
    const out = await this.render(userId, origin, instrumental, design.bpm, phrases, mix);
    const [nr] = await this.db.write
      .update(songs)
      .set({
        designJson: design as unknown as Record<string, unknown>,
        instrumentalUrl,
        phrasesJson: phrases as unknown as Record<string, unknown>[],
        mixJson: mix as unknown as Record<string, unknown>,
        mixUrl: out.url,
        seconds: out.seconds,
        updatedAt: new Date(),
      })
      .where(eq(songs.id, row.id))
      .returning();
    // the previous mix and the vocal lines / instrumental no longer used are deleted (storage) —
    // unless that version was saved: it is on the member's island and still plays from there
    if (!row.savedAt) {
      const keep = new Set([...phrases.map((p) => p.url), instrumentalUrl]);
      const old = [row.mixUrl, ...(row.phrasesJson as unknown as SongPhrase[]).map((p) => p.url), row.instrumentalUrl].filter((u) => !keep.has(u));
      for (const u of old) void this.media.removeByUrl(userId, u).catch(() => undefined);
    }
    this.log.log(`song ${row.id} edit ${JSON.stringify(command)}`);
    return { reply: reply || (partner.isBati ? 'できたよ！聴いてみて。' : 'できたケン！聴いてみろ。'), action: command.action, song: this.view(nr) };
  }

  /** Sing some lines again (lyrics or voice changed); the others are kept as they are. */
  private async resing(
    userId: string,
    origin: string,
    design: StoredDesign,
    row: SongRow,
    phrases: SongPhrase[],
    targets: Map<number, unknown>,
    change: (p: SongPhrase) => SongPhrase,
  ): Promise<SongPhrase[]> {
    const direction = row.directionJson as unknown as SingDirection;
    const redo = phrases.filter((p) => targets.has(p.index));
    const fresh = await pool(redo, 4, (p) => {
      const c = change(p);
      return this.singLine(userId, origin, design, direction, { index: c.index, section: c.section, text: c.text, slot: c.slot, startBeat: c.startBeat, beats: c.beats });
    });
    const byIndex = new Map(fresh.map((p) => [p.index, p]));
    return phrases.map((p) => byIndex.get(p.index) ?? p);
  }

  // --- save -------------------------------------------------------------------------------------

  /** 保存する: the member keeps this version (it is buried in their island on the client). */
  /** Your saved songs (島の土 on Mercury), newest first; `posted` = already sent out as a ship. */
  async saved(userId: string): Promise<(SongView & { posted: boolean })[]> {
    const rows = await this.db.read
      .select({ s: songs, posted: sql<boolean>`EXISTS (SELECT 1 FROM planet_posts pp WHERE pp.source_id = "songs"."id" AND pp.planet = 'mercury' AND pp.deleted_at IS NULL)` })
      .from(songs)
      .where(and(eq(songs.userId, userId), isNull(songs.deletedAt), isNotNull(songs.savedAt)))
      .orderBy(desc(songs.savedAt))
      .limit(100);
    return rows.map(({ s, posted }) => ({ ...this.view(s), posted: !!posted }));
  }

  async save(userId: string, id: string): Promise<SongView> {
    await this.owned(userId, id);
    const [row] = await this.db.write.update(songs).set({ savedAt: new Date(), updatedAt: new Date() }).where(eq(songs.id, id)).returning();
    return this.view(row);
  }

  private view(row: SongRow): SongView {
    const d = row.designJson as unknown as StoredDesign;
    return {
      id: row.id,
      title: row.title,
      url: row.mixUrl,
      instrumentalUrl: row.instrumentalUrl,
      instrumentalPrompt: d.instrumentalPrompt,
      bpm: d.bpm,
      phrases: row.phrasesJson as unknown as SongPhrase[],
      mix: row.mixJson as unknown as SongMix,
      direction: row.directionJson as unknown as SingDirection,
      seconds: row.seconds,
      savedAt: row.savedAt ? row.savedAt.toISOString() : null,
    };
  }
}
