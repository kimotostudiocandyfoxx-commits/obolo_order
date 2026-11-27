import { HttpStatus, Inject, Injectable, Logger, Optional } from '@nestjs/common';
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
  tweakNeedsSplit,
  type Segment,
  type SongLyrics,
  type SongPhrase,
  type SongTweakBody,
  type SongTweakResult,
  type SongVoiceUseView,
  type SongVoiceVersion,
  type TweakPlan,
  voiceAskOf,
} from '@obolo/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { followSong } from '../planets/song-follow';
import { songs } from '../db/schema';
import { LLM } from '../infra/tokens';
import { MediaService } from '../media/media.service';
import { renderTweak } from './tweak';
import { JobsService } from '../jobs/jobs.service';

type SongRow = typeof songs.$inferSelect;
/** one version after the original: the ops from the original, and what they made (R18: in which voice) */
export type TweakVersion = { ops: SongTweakOp[]; mixUrl: string; seconds: number; phrases: SongPhrase[]; at: string; sung?: SongVoiceVersion };
/** what songs.design_json keeps for the free changes (next to the song's design) */
export type TweakDesign = {
  /** R17 'runware': one mix until our GPU split it (vocalsUrl then) */
  engine?: 'acestep' | 'runware';
  /** R17 runware: the song as Runware made it */
  sourceUrl?: string;
  /** R17: the vocal is in the member's own voice (Seed-VC on our GPU); voiceTried: it was asked once (no recording: no) */
  voiced?: boolean;
  voiceTried?: boolean;
  /** the studio's own vocal (the one a voice is converted from) */
  guideUrl?: string;
  /**
   * R18 (君の声にする魔法): the member's-voice version — its vocal stem (converted from the studio's) and its mix of the
   * original. The original voice stays (vocalsUrl / original); `sung` is the version in use (a free switch).
   */
  own?: { vocalsUrl: string; mixUrl: string; seconds: number; at: string; /** delivered at `tempo` (after the conversion) */ first?: { mixUrl: string; seconds: number; phrases: SongPhrase[] } };
  sung?: SongVoiceVersion;
  bpm: number;
  vocalsUrl?: string;
  lyrics?: SongLyrics;
  /** the song as the studio made it (every version is made from its stems) */
  original?: { mixUrl: string; seconds: number; phrases: SongPhrase[] };
  /**
   * R17: the tempo the song is delivered at over `original` (SONG_DEFAULT_TEMPO, 1.2; absent = 1) — folded into every
   * version's chain, so a change is always made from the take as sung (never a stretch of a stretch)
   */
  tempo?: number;
  /** R17: the song as first delivered (at `tempo`): what 「元に戻して」 goes back to before any change */
  first?: { mixUrl: string; seconds: number; phrases: SongPhrase[] };
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
    @Optional() private readonly jobs?: JobsService,
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
      else if (voiceAskOf(body.said)) {
        // R18: the member's own voice is 君の声にする魔法 (its price and a yes: POST …/voice/quote), 「元の声で」 a free
        // switch, another person's voice never — the client asks those, the tweak only says so
        return { status: 'voice', voice: voiceAskOf(body.said)!, ...base };
      } else if (p.paid) return { status: 'paid', paid: p.paid, ...base };
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
      const first = this.untouched(d, original);
      let now = back ?? { ops: [], ...first };
      // R18: a version made in the other voice is made again in the voice in use (the same changes)
      if (back && (back.sung ?? 'original') !== (d.sung ?? 'original')) {
        const again = await this.renderOps(userId, row, d, original, back.ops, origin);
        now = { ...back, ...again, sung: d.sung };
        history[history.length - 1] = now as TweakVersion;
      }
      await this.save(userId, id, { mixUrl: now.mixUrl, seconds: now.seconds, phrases: now.phrases, design: { ...d, original, tweaks: history } });
      return { status: 'undone', song: { url: now.mixUrl, seconds: now.seconds, phrases: now.phrases }, ...(d.lyrics ? { lyrics: tweakLyrics(d.lyrics, null, tweakPlan(now.ops)) } : {}), ops: now.ops, versions: history.length + 1 };
    }
    ops = resolveLength(ops, row.seconds ?? original.seconds).flatMap((o) => {
      const r = SongTweakOp.safeParse(o);
      return r.success ? [r.data] : [];
    });
    if (!ops.length) return { status: 'none', ...base };
    const all = [...nowOps, ...ops];
    // R17: from the take as sung, at the song's own tempo × the tempo ops (「元の速さで」: 1)
    const plan = tweakPlan(all, d.tempo ?? 1);
    // R17: a song from Runware is one mix — tempo, key, length and fades are made from it; the voice / the music apart or
    // a part cut / again need our GPU's split first (once: a job; {bati} says 「ちょっと待ってね」, then the same words again)
    const runware = d.engine === 'runware';
    if (runware && !d.vocalsUrl && tweakNeedsSplit(plan)) {
      const jobId = await this.startSplit(userId, id, origin);
      if (!jobId) return { status: 'paid', paid: 'melody', ...base };
      return { status: 'wait', jobId, ...base };
    }
    if ((d.engine !== 'acestep' && !runware) || (!runware && !d.vocalsUrl) || !row.instrumentalUrl) return { status: 'paid', paid: 'melody', ...base };
    const spans = blockSpans(original.phrases, d.bpm, original.seconds);
    const { segments, missing } = tweakSegments(spans, original.seconds, plan);
    if (missing && ops.every((o) => o.op === 'cut' || o.op === 'repeat')) return { status: 'missing', ...base };
    const moved = tweakPhrases(original.phrases, d.bpm, segments, plan, original.seconds);
    // R18: rendered from the vocal of the version in use (the member's voice or the studio's): the same changes on both
    const vocalsUrl = this.vocalsOf(d);
    const out = vocalsUrl
      ? await this.render(userId, { instrumentalUrl: row.instrumentalUrl, vocalsUrl, segments, plan, seconds: original.seconds, total: moved.seconds })
      : // the mix alone (no stems yet): it stands in as the music, the voice part of the plan is not used
        await this.render(userId, { instrumentalUrl: d.sourceUrl ?? original.mixUrl, vocalsUrl: d.sourceUrl ?? original.mixUrl, segments, plan: { ...plan, stem: 'instrumental' }, seconds: original.seconds, total: moved.seconds });
    const mixUrl = await this.store(userId, out.data, origin);
    history.push({ ops: all, mixUrl, seconds: out.seconds, phrases: moved.phrases, at: new Date().toISOString(), ...(d.sung ? { sung: d.sung } : {}) });
    // the oldest versions after the original go first
    while (history.length > SONG_TWEAK_VERSIONS) history.shift();
    await this.save(userId, id, { mixUrl, seconds: out.seconds, phrases: moved.phrases, design: { ...d, original, tweaks: history } });
    this.log.log(`song ${id} ${userId}: ${tweakWhat(ops)} → ${out.seconds}s (v${history.length + 1})`);
    return { status: 'done', what: tweakWhat(ops), song: { url: mixUrl, seconds: out.seconds, phrases: moved.phrases }, ...(d.lyrics ? { lyrics: tweakLyrics(d.lyrics, null, plan) } : {}), ops: all, versions: history.length + 1 };
  }

  /**
   * R18: POST /compose/songs/:id/voice/use — the original voice or 君の声 (free: a version switch, not a new making). The
   * changes made so far are made again from the stems of that voice (tempo after the conversion), so both stay alike.
   */
  async useVoice(userId: string, id: string, use: SongVoiceVersion, origin: string): Promise<SongVoiceUseView> {
    const row = await this.load(userId, id);
    const d = row.designJson as unknown as TweakDesign;
    const versions: SongVoiceVersion[] = d.own ? ['original', 'own'] : ['original'];
    const want: SongVoiceVersion = use === 'own' && d.own ? 'own' : 'original';
    const original = d.original ?? { mixUrl: row.mixUrl ?? '', seconds: row.seconds ?? 0, phrases: row.phrasesJson as unknown as SongPhrase[] };
    const history = [...(d.tweaks ?? [])];
    const last = history[history.length - 1];
    const now = d.sung ?? 'original';
    if (want === now && (!last || (last.sung ?? 'original') === want)) return { using: want, song: { url: row.mixUrl ?? original.mixUrl, seconds: row.seconds ?? original.seconds }, versions };
    const next: TweakDesign = { ...d, sung: want, original };
    let song: { mixUrl: string; seconds: number; phrases: SongPhrase[] };
    if (!last) song = this.untouched(next, original);
    else {
      song = await this.renderOps(userId, row, next, original, last.ops, origin);
      history[history.length - 1] = { ...last, ...song, sung: want };
    }
    await this.save(userId, id, { mixUrl: song.mixUrl, seconds: song.seconds, phrases: song.phrases, design: { ...next, tweaks: history } });
    this.log.log(`song ${id} ${userId}: now in the ${want === 'own' ? "member's" : 'original'} voice`);
    return { using: want, song: { url: song.mixUrl, seconds: song.seconds }, versions };
  }

  /** the vocal stem of the version in use */
  private vocalsOf(d: TweakDesign): string | undefined {
    return d.sung === 'own' && d.own ? d.own.vocalsUrl : d.vocalsUrl;
  }
  /** the song with no changes, as delivered (at the song's tempo, R17) in the voice in use */
  private untouched(d: TweakDesign, original: { mixUrl: string; seconds: number; phrases: SongPhrase[] }): { mixUrl: string; seconds: number; phrases: SongPhrase[] } {
    const first = d.first ?? original;
    if (d.sung !== 'own' || !d.own) return { mixUrl: first.mixUrl, seconds: first.seconds, phrases: first.phrases };
    return d.own.first ?? { mixUrl: d.own.mixUrl, seconds: d.own.seconds || original.seconds, phrases: original.phrases };
  }

  /** the changes `ops` made from the original's stems in the voice in use (a new mix stored) */
  private async renderOps(userId: string, row: SongRow, d: TweakDesign, original: { seconds: number; phrases: SongPhrase[] }, ops: SongTweakOp[], origin: string): Promise<{ mixUrl: string; seconds: number; phrases: SongPhrase[] }> {
    const vocalsUrl = this.vocalsOf(d);
    if (!vocalsUrl || !row.instrumentalUrl) throw apiError(HttpStatus.CONFLICT, 'NOT_SPLIT', 'The song has no parts to change yet');
    // R17: the song's own tempo folded in (the conversion was of the take as sung: the tempo comes after it)
    const plan = tweakPlan(ops, d.tempo ?? 1);
    const spans = blockSpans(original.phrases, d.bpm, original.seconds);
    const { segments } = tweakSegments(spans, original.seconds, plan);
    const moved = tweakPhrases(original.phrases, d.bpm, segments, plan, original.seconds);
    const out = await this.render(userId, { instrumentalUrl: row.instrumentalUrl, vocalsUrl, segments, plan, seconds: original.seconds, total: moved.seconds });
    return { mixUrl: await this.store(userId, out.data, origin), seconds: out.seconds, phrases: moved.phrases };
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

  /** R17: the song's split on our GPU (a job; the one already running is reused); null when there is no GPU / no jobs */
  protected async startSplit(userId: string, id: string, origin: string): Promise<string | null> {
    if (!this.jobs) return null;
    const running = (await this.jobs.active(userId)).find((j) => j.kind === 'song-split');
    if (running) return running.id;
    return (await this.jobs.create(userId, 'song-split', { songId: id, origin })).id;
  }

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
    await followSong(this.db, { id, userId, mixUrl: v.mixUrl, seconds: v.seconds });
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
