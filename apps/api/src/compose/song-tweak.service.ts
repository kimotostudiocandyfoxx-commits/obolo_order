import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { parseSongTweak, songTweakSystem, type LlmProvider } from '@obolo/ai';
import {
  blockSpans,
  parseTweak,
  resolveLength,
  SONG_TWEAK_VERSIONS,
  SongTweakOp,
  tweakLyrics,
  tweakPhrases,
  tweakPlan,
  tweakSegments,
  tweakWhat,
  type Segment,
  type SongLyrics,
  type SongPhrase,
  type SongTweakBody,
  type SongTweakResult,
  type TweakPlan,
} from '@obolo/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { songs } from '../db/schema';
import { LLM } from '../infra/tokens';
import { MediaService } from '../media/media.service';
import { renderTweak } from './tweak';

type SongRow = typeof songs.$inferSelect;
/** one version after the original: the ops from the original, and what they made */
export type TweakVersion = { ops: SongTweakOp[]; mixUrl: string; seconds: number; phrases: SongPhrase[]; at: string };
/** what songs.design_json keeps for the free changes (next to the song's design) */
export type TweakDesign = {
  engine?: 'acestep';
  bpm: number;
  vocalsUrl?: string;
  lyrics?: SongLyrics;
  /** the song as the studio made it (every version is made from its stems) */
  original?: { mixUrl: string; seconds: number; phrases: SongPhrase[] };
  tweaks?: TweakVersion[];
};

/**
 * R13 (client 2026-11-25): POST /compose/songs/:id/tweak — a finished song changed for free (no mana), on our side: the
 * words → ops (rules, then the model), each change a new version rendered from the original stems with every op so far
 * (tweak.ts), 「元に戻して」 one back. What needs the studio is answered `paid` (the client goes through the spell + yes).
 * The DB and the audio are their own methods (the tests stand in for them).
 */
@Injectable()
export class SongTweakService {
  private readonly log = new Logger('SongTweak');
  constructor(
    @Inject(LLM) private readonly llm: LlmProvider,
    private readonly db: Database,
    private readonly media: MediaService,
  ) {}

  async tweak(userId: string, id: string, body: SongTweakBody, origin: string): Promise<SongTweakResult> {
    const row = await this.load(userId, id);
    const d = row.designJson as unknown as TweakDesign;
    const history = [...(d.tweaks ?? [])];
    const original = d.original ?? { mixUrl: row.mixUrl ?? '', seconds: row.seconds ?? 0, phrases: row.phrasesJson as unknown as SongPhrase[] };
    const nowOps = history.length ? history[history.length - 1].ops : [];
    const base = { ops: nowOps, versions: history.length + 1 };
    let ops: SongTweakOp[] = [];
    let undo = !!body.undo;
    if (body.ops) ops = body.ops;
    else if (body.said) {
      const p = parseTweak(body.said);
      if (p.undo) undo = true;
      else if (p.paid) return { status: 'paid', paid: p.paid, ...base };
      else if (p.ops.length) ops = p.ops;
      else {
        const m = await this.byModel(body.said);
        if (m.paid) return { status: 'paid', paid: m.paid, ...base };
        ops = m.ops;
      }
    }
    if (undo) {
      if (!history.length) return { status: 'first', ...base };
      history.pop();
      const back = history[history.length - 1];
      const now = back ?? { ops: [], mixUrl: original.mixUrl, seconds: original.seconds, phrases: original.phrases };
      await this.save(userId, id, { mixUrl: now.mixUrl, seconds: now.seconds, phrases: now.phrases, design: { ...d, original, tweaks: history } });
      return { status: 'undone', song: { url: now.mixUrl, seconds: now.seconds, phrases: now.phrases }, ...(d.lyrics ? { lyrics: tweakLyrics(d.lyrics, null, tweakPlan(now.ops)) } : {}), ops: now.ops, versions: history.length + 1 };
    }
    ops = resolveLength(ops, row.seconds ?? original.seconds).flatMap((o) => {
      const r = SongTweakOp.safeParse(o);
      return r.success ? [r.data] : [];
    });
    if (!ops.length) return { status: 'none', ...base };
    if (d.engine !== 'acestep' || !d.vocalsUrl || !row.instrumentalUrl) return { status: 'paid', paid: 'melody', ...base };
    const all = [...nowOps, ...ops];
    const plan = tweakPlan(all);
    const spans = blockSpans(original.phrases, d.bpm, original.seconds);
    const { segments, missing } = tweakSegments(spans, original.seconds, plan);
    if (missing && ops.every((o) => o.op === 'cut' || o.op === 'repeat')) return { status: 'missing', ...base };
    const moved = tweakPhrases(original.phrases, d.bpm, segments, plan, original.seconds);
    const out = await this.render(userId, { instrumentalUrl: row.instrumentalUrl, vocalsUrl: d.vocalsUrl, segments, plan, seconds: original.seconds, total: moved.seconds });
    const mixUrl = await this.store(userId, out.data, origin);
    history.push({ ops: all, mixUrl, seconds: out.seconds, phrases: moved.phrases, at: new Date().toISOString() });
    // the oldest versions after the original go first
    while (history.length > SONG_TWEAK_VERSIONS) history.shift();
    await this.save(userId, id, { mixUrl, seconds: out.seconds, phrases: moved.phrases, design: { ...d, original, tweaks: history } });
    this.log.log(`song ${id} ${userId}: ${tweakWhat(ops)} → ${out.seconds}s (v${history.length + 1})`);
    return { status: 'done', what: tweakWhat(ops), song: { url: mixUrl, seconds: out.seconds, phrases: moved.phrases }, ...(d.lyrics ? { lyrics: tweakLyrics(d.lyrics, null, plan) } : {}), ops: all, versions: history.length + 1 };
  }

  /** the model's ops for words the rules did not understand (failing: none) */
  private async byModel(said: string): Promise<{ ops: SongTweakOp[]; paid?: ReturnType<typeof parseSongTweak>['paid'] }> {
    try {
      const raw = await Promise.race([
        this.llm.chat({ system: songTweakSystem(), history: [{ role: 'user', text: said }], json: true, temperature: 0.1, maxOutputTokens: 300 }),
        new Promise<never>((_, no) => setTimeout(() => no(new Error('slow')), 8000)),
      ]);
      return parseSongTweak(raw);
    } catch (e) {
      this.log.warn(`tweak by rules only: ${String(e)}`);
      return { ops: [] };
    }
  }

  // --- the table and the audio (only the member's own song) ----------------------------------------------------------

  protected async load(userId: string, id: string): Promise<SongRow> {
    const [row] = await this.db.write
      .select()
      .from(songs)
      .where(and(eq(songs.id, id), eq(songs.userId, userId), isNull(songs.deletedAt)));
    if (!row) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Song not found');
    return row;
  }
  protected async save(userId: string, id: string, v: { mixUrl: string; seconds: number; phrases: SongPhrase[]; design: TweakDesign }): Promise<void> {
    await this.db.write
      .update(songs)
      .set({ mixUrl: v.mixUrl, seconds: v.seconds, phrasesJson: v.phrases as unknown as Record<string, unknown>[], designJson: v.design as unknown as Record<string, unknown>, updatedAt: new Date() })
      .where(and(eq(songs.id, id), eq(songs.userId, userId)));
  }
  protected async render(userId: string, o: { instrumentalUrl: string; vocalsUrl: string; segments: Segment[]; plan: TweakPlan; seconds: number; total: number }): Promise<{ data: Buffer; seconds: number }> {
    const [inst, voc] = await Promise.all([this.media.audioByUrl(userId, o.instrumentalUrl), this.media.audioByUrl(userId, o.vocalsUrl)]);
    if (!inst || !voc) throw apiError(HttpStatus.NOT_FOUND, 'INSTRUMENTAL_NOT_FOUND', 'A part of the song is missing');
    try {
      return await renderTweak({ instrumental: inst, vocals: voc, segments: o.segments, plan: o.plan, seconds: o.seconds, total: o.total });
    } catch (e) {
      this.log.warn(`tweak render failed: ${String(e)}`);
      throw apiError(HttpStatus.BAD_GATEWAY, 'MIX_FAILED', 'The song could not be changed');
    }
  }
  protected async store(userId: string, data: Buffer, origin: string): Promise<string> {
    return (await this.media.storeAudio(userId, 'audio/mp4', data, origin)).url;
  }
}
