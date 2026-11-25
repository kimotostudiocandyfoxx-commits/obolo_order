import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { LlmProvider, moderateText } from '@obolo/ai';
import {
  artTags,
  effectiveVisibility,
  genericTags,
  PLANET_WORK_DEFAULT_VISIBILITY,
  readTags,
  songTags,
  type HomePlanet,
  type PlanetWorkKind,
  type WorkCheckState,
  type WorkTags,
  type WorkVisibility,
  type WorkVisibilityView,
} from '@obolo/shared';
import { and, desc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { bluenaSaves, jupiterPosts, jupiterRoots, planetPosts, planetWorkMeta, radioShows, saturnPosts, songs, userBlocks } from '../db/schema';
import { LLM } from '../infra/tokens';

type Meta = typeof planetWorkMeta.$inferSelect;

/** what is known of one planet work to tag it: its maker, its planet, its tags, the words the check reads */
export interface WorkFacts {
  userId: string;
  planet: HomePlanet;
  tags: WorkTags;
  /** the title / words that go through the automatic check before the work may go public */
  words: string;
}

/**
 * 2-2 in SQL: the work in `kind` / `idCol` is public in effect — its maker chose public (or never chose and the default
 * is public) and the automatic check passed. A work with no row at all is never public.
 */
export const isPublicWork = (kind: PlanetWorkKind, idCol: SQL): SQL =>
  sql`EXISTS (SELECT 1 FROM planet_work_meta pm WHERE pm.kind = ${kind} AND pm.work_id = ${idCol} AND COALESCE(pm.visibility, ${PLANET_WORK_DEFAULT_VISIBILITY}) = 'public' AND pm.check_state = 'ok')`;

export const metaView = (kind: PlanetWorkKind, id: string, m: Pick<Meta, 'visibility' | 'checkState' | 'checkReason'> | null | undefined): WorkVisibilityView => {
  const chosen = (m?.visibility as WorkVisibility | null) ?? null;
  const check = (m?.checkState as WorkCheckState | undefined) ?? 'unchecked';
  return { kind, id, chosen, visibility: effectiveVisibility(chosen, check), check, reason: m?.checkReason ?? null };
};

/**
 * 惑星の作り直し 2-1〜2-3, 2-5 (docs/planets.md):
 *  - tag(): every planet work gets its hidden tags the moment it is made (the store's create calls it), from the
 *    spell / settings (a song's designJson, a painted root's spell; other kinds: the generic shape), and goes through
 *    the automatic check once (the words check of the makings, @obolo/ai moderateText). A work that fails stays dachi.
 *  - setVisibility(): the maker's dachi / public (owner only); public needs the check passed
 *  - save(): ☆ = kept in Bluena (bluena_saves, any planet work kind)
 *  - backfill(): the works made before this existed (admin)
 */
@Injectable()
export class PlanetWorksService {
  private readonly log = new Logger('PlanetWorks');
  constructor(
    private readonly db: Database,
    @Inject(LLM) private readonly llm: LlmProvider,
  ) {}

  /**
   * 2-3 the automatic check before public: the words (title, text, the tags themselves). PLACEHOLDER (P-MOD-1): no
   * picture check exists in the app yet — pictures painted in the app come from spells that went through the same words
   * check; an uploaded photo is not looked at (see docs/planets.md).
   */
  async check(words: string): Promise<{ state: WorkCheckState; reason: string | null }> {
    const w = words.trim();
    if (!w) return { state: 'ok', reason: null };
    const r = await moderateText(w, this.llm);
    return r.flagged ? { state: 'held', reason: r.categories.join(',') || 'other' } : { state: 'ok', reason: null };
  }

  /** 2-1: the tags (and the check) of a work just made; never fails the making (logged and left to the backfill) */
  async tag(kind: PlanetWorkKind, workId: string, facts: WorkFacts): Promise<void> {
    try {
      const c = await this.check([facts.words, facts.tags.main ?? '', ...facts.tags.moods].join(' '));
      const now = new Date();
      await this.db.write
        .insert(planetWorkMeta)
        .values({ kind, workId, userId: facts.userId, planet: facts.planet, main: facts.tags.main, moodsJson: facts.tags.moods, bpm: facts.tags.bpm ?? null, checkState: c.state, checkReason: c.reason, checkedAt: now })
        .onConflictDoUpdate({ target: [planetWorkMeta.kind, planetWorkMeta.workId], set: { main: facts.tags.main, moodsJson: facts.tags.moods, bpm: facts.tags.bpm ?? null, checkState: c.state, checkReason: c.reason, checkedAt: now, updatedAt: now } });
    } catch (e) {
      this.log.warn(`tags of ${kind} ${workId} not kept: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** the facts of a stored work, read from its store (null = gone) */
  protected async facts(kind: PlanetWorkKind, id: string): Promise<WorkFacts | null> {
    if (kind === 'planet_post') {
      const [r] = await this.db.read
        .select({ userId: planetPosts.userId, planet: planetPosts.planet, kind: planetPosts.kind, title: planetPosts.title, text: planetPosts.text, design: songs.designJson })
        .from(planetPosts)
        .leftJoin(songs, eq(songs.id, planetPosts.sourceId))
        .where(and(eq(planetPosts.id, id), isNull(planetPosts.deletedAt)));
      if (!r) return null;
      const tags = r.kind === 'song' ? songTags(r.design) : genericTags(null);
      return { userId: r.userId, planet: r.planet === 'mars' ? 'mars' : 'mercury', tags, words: `${r.title} ${r.text}` };
    }
    if (kind === 'jupiter_post') {
      const [r] = await this.db.read
        .select({ userId: jupiterPosts.userId, text: jupiterPosts.text, spell: jupiterRoots.spellJson })
        .from(jupiterPosts)
        .leftJoin(jupiterRoots, eq(jupiterRoots.id, jupiterPosts.rootId))
        .where(and(eq(jupiterPosts.id, id), isNull(jupiterPosts.deletedAt)));
      return r ? { userId: r.userId, planet: 'jupiter', tags: artTags(r.spell), words: r.text } : null;
    }
    if (kind === 'saturn_post') {
      const [r] = await this.db.read.select({ userId: saturnPosts.userId, text: saturnPosts.text }).from(saturnPosts).where(and(eq(saturnPosts.id, id), isNull(saturnPosts.deletedAt)));
      return r ? { userId: r.userId, planet: 'saturn', tags: genericTags(null), words: r.text } : null;
    }
    const [r] = await this.db.read.select({ userId: radioShows.userId, title: radioShows.title }).from(radioShows).where(and(eq(radioShows.id, id), isNull(radioShows.deletedAt)));
    return r ? { userId: r.userId, planet: 'venus', tags: genericTags(null), words: r.title } : null;
  }

  async meta(kind: PlanetWorkKind, id: string): Promise<Meta | null> {
    const [m] = await this.db.read.select().from(planetWorkMeta).where(and(eq(planetWorkMeta.kind, kind), eq(planetWorkMeta.workId, id)));
    return m ?? null;
  }

  /** the tags of works (for a feed); missing ones are absent */
  async tagsOf(kind: PlanetWorkKind, ids: string[]): Promise<Map<string, { tags: WorkTags; view: WorkVisibilityView }>> {
    const out = new Map<string, { tags: WorkTags; view: WorkVisibilityView }>();
    if (!ids.length) return out;
    const rows = ((await this.db.read
      .select()
      .from(planetWorkMeta)
      .where(and(eq(planetWorkMeta.kind, kind), inArray(planetWorkMeta.workId, ids)))) ?? []) as Meta[];
    for (const m of rows) out.set(m.workId, { tags: readTags(m.main, m.moodsJson, m.bpm), view: metaView(kind, m.workId, m) });
    return out;
  }

  /** 2-2: the maker's own visibility of a work (with what is in effect) */
  async visibility(userId: string, kind: PlanetWorkKind, id: string): Promise<WorkVisibilityView> {
    const f = await this.facts(kind, id);
    if (!f || f.userId !== userId) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Work not found');
    return metaView(kind, id, await this.meta(kind, id));
  }

  /**
   * 2-2: the maker sets dachi / public (owner only). Going public runs the check when it has not passed yet; a work that
   * fails keeps its choice but stays dachi in effect, with the reason.
   */
  async setVisibility(userId: string, kind: PlanetWorkKind, id: string, visibility: WorkVisibility): Promise<WorkVisibilityView> {
    const f = await this.facts(kind, id);
    if (!f || f.userId !== userId) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Work not found');
    let m = await this.meta(kind, id);
    if (!m || (visibility === 'public' && m.checkState === 'unchecked')) {
      await this.tag(kind, id, f);
      m = await this.meta(kind, id);
    }
    const now = new Date();
    await this.db.write
      .insert(planetWorkMeta)
      .values({ kind, workId: id, userId, planet: f.planet, main: f.tags.main, moodsJson: f.tags.moods, bpm: f.tags.bpm ?? null, visibility })
      .onConflictDoUpdate({ target: [planetWorkMeta.kind, planetWorkMeta.workId], set: { visibility, updatedAt: now } });
    return metaView(kind, id, { visibility, checkState: m?.checkState ?? 'unchecked', checkReason: m?.checkReason ?? null });
  }

  // --- 2-5 ☆ Bluena ------------------------------------------------------------------------------------------------

  /** ☆ (M-R309): someone else's work into your Bluena (a link); not your own, not a blocked person's, not a gone one */
  async save(userId: string, kind: PlanetWorkKind, id: string, on: boolean): Promise<{ saved: boolean }> {
    if (!on) {
      await this.db.write.delete(bluenaSaves).where(and(eq(bluenaSaves.userId, userId), eq(bluenaSaves.kind, kind), eq(bluenaSaves.postId, id)));
      return { saved: false };
    }
    const f = await this.facts(kind, id);
    if (!f || f.userId === userId || (await this.blockedWith(userId, f.userId))) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
    await this.db.write.insert(bluenaSaves).values({ userId, kind, postId: id }).onConflictDoNothing();
    return { saved: true };
  }

  /** your ☆ works (newest first): kind + id, the planet UIs open them from their stores */
  async saved(userId: string): Promise<{ kind: PlanetWorkKind; id: string; savedAt: string }[]> {
    const rows = await this.db.read
      .select({ kind: bluenaSaves.kind, id: bluenaSaves.postId, at: bluenaSaves.createdAt })
      .from(bluenaSaves)
      .where(eq(bluenaSaves.userId, userId))
      .orderBy(desc(bluenaSaves.createdAt))
      .limit(500);
    return rows.map((r) => ({ kind: r.kind as PlanetWorkKind, id: r.id, savedAt: r.at.toISOString() }));
  }

  private async blockedWith(a: string, b: string): Promise<boolean> {
    const r = await this.db.read
      .select({ x: userBlocks.blockerId })
      .from(userBlocks)
      .where(sql`(${userBlocks.blockerId} = ${a} AND ${userBlocks.blockedId} = ${b}) OR (${userBlocks.blockerId} = ${b} AND ${userBlocks.blockedId} = ${a})`)
      .limit(1);
    return r.length > 0;
  }

  // --- backfill -----------------------------------------------------------------------------------------------------

  /**
   * 2-1 for the works made before tags existed: `limit` of each store at a time (oldest first) get their tags (a
   * song's from its designJson, an art's from its root's spell when known) and the check. Their visibility stays the
   * default (null).
   */
  async backfill(limit = 200): Promise<Record<PlanetWorkKind, number>> {
    const missing = (kind: PlanetWorkKind, id: SQL) => sql`NOT EXISTS (SELECT 1 FROM planet_work_meta pm WHERE pm.kind = ${kind} AND pm.work_id = ${id})`;
    const pick = async (kind: PlanetWorkKind, t: typeof planetPosts | typeof jupiterPosts | typeof saturnPosts | typeof radioShows, extra?: SQL) =>
      (
        await this.db.read
          .select({ id: t.id })
          .from(t as typeof planetPosts)
          .where(and(isNull(t.deletedAt), missing(kind, sql`${t.id}`), extra))
          .orderBy(t.createdAt)
          .limit(limit)
      ).map((r) => r.id);
    const done = { saturn_post: 0, jupiter_post: 0, planet_post: 0, radio_show: 0 } as Record<PlanetWorkKind, number>;
    const lists: [PlanetWorkKind, string[]][] = [
      ['planet_post', await pick('planet_post', planetPosts)],
      ['jupiter_post', await pick('jupiter_post', jupiterPosts)],
      ['saturn_post', await pick('saturn_post', saturnPosts, isNull(saturnPosts.replyToId))],
      ['radio_show', await pick('radio_show', radioShows)],
    ];
    for (const [kind, ids] of lists)
      for (const id of ids) {
        const f = await this.facts(kind, id);
        if (!f) continue;
        await this.tag(kind, id, f);
        done[kind]++;
      }
    return done;
  }
}
