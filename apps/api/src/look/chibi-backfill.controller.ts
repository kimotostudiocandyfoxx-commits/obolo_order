import { Controller, Get, Headers, HttpCode, Inject, Ip, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PLANET_FIGURES } from '@obolo/shared';
import { and, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { assertAdmin } from '../admin/admin.guard';
import { rateLimit } from '../common/rate-limit';
import { AppConfig, CONFIG } from '../config';
import { Database } from '../db/db';
import { users } from '../db/schema';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { FIGURE_TRIES, PlanetFiguresService, triesKey } from './figures.service';
import { cutKey, versionKey, WINGS_KEY } from './figures';
import { PLANET_FIGURE_PROMPT_VERSION } from '@obolo/ai';
import { costScope } from '../wallet/cost-scope';
import { LookService } from './look.service';

/** a figure of the look worn now that is not made and still has tries left */
const missing = (f: (typeof PLANET_FIGURES)[number]) => {
  const e = sql`(${users.planetFigures} -> ${users.avatarUrl})`;
  return sql`((${e} ->> ${f}) IS NULL AND COALESCE((${e} ->> ${triesKey(f)})::int, 0) < ${FIGURE_TRIES})`;
};

/** the own look was confirmed (lock.ts lookConfirmedOf): past day 2, day 2 finished, or confirmed */
const confirmed = sql`(${users.journeyDay} > 2 OR (${users.journeyDay} = 2 AND ${users.journeyCompletedAt} IS NOT NULL) OR (${users.onboardingJson} ->> 'look.confirmed') IS NOT NULL)`;

/**
 * M-R262 backfill, client 2026-11-25 (admin token only): members whose look has planet figures still to make (made
 * before the figures existed, or one that failed) get them made in the background — `limit` at a time (default 50,
 * at most 500), oldest first; a figure already made or out of its tries (FIGURE_TRIES)
 * is never painted again. Absorbed (no mana): only for looks nobody can pay for any more — confirmed before the first
 * look's price was taken (client 2026-11-25), or a figure that failed. A first look not confirmed yet (day 2) is left
 * alone: its figures are painted when it is confirmed, as its profileLook making.
 *   curl -X POST -H "x-admin-token: …" "https://<api>/admin/chibi-backfill?limit=50"
 *   (the same at /admin/figures-backfill)
 */
@Controller('admin')
export class ChibiBackfillController {
  constructor(
    private readonly db: Database,
    private readonly look: LookService,
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(KV) private readonly kv: KvStore,
    private readonly figures: PlanetFiguresService,
  ) {}

  @Post(['chibi-backfill', 'figures-backfill'])
  @HttpCode(200)
  async backfill(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string, @Req() req: Request, @Query('limit') limit?: string) {
    await rateLimit(this.kv, `admin:${ip}`, 120, 600);
    assertAdmin(this.cfg, token);
    const n = Math.max(1, Math.min(500, Number(limit) || 50));
    const rows = await this.db.read
      .select({ id: users.id, look: users.avatarUrl })
      .from(users)
      .where(and(isNotNull(users.avatarUrl), isNull(users.deletedAt), confirmed, or(...PLANET_FIGURES.map(missing))))
      .orderBy(users.createdAt)
      .limit(n);
    const origin = `${req.protocol}://${req.get('host')}`;
    for (const r of rows) if (r.look) await this.look.enqueueFigures(r.id, origin, r.look, false, true);
    return { queued: rows.length, tries: FIGURE_TRIES };
  }

  /**
   * 03 §1 backfill (admin token only): the wing cut of Jupiter figures painted before it was measured — read from the
   * stored picture and measured here (CPU only, nothing painted, no provider), `limit` members at a time (default 50,
   * at most 500), oldest first. One that cannot be measured is kept as 'none' (the default cut) and not tried again.
   *   curl -X POST -H "x-admin-token: …" "https://<api>/admin/wings-backfill?limit=50"
   */
  @Post('wings-backfill')
  @HttpCode(200)
  async wings(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string, @Query('limit') limit?: string) {
    await rateLimit(this.kv, `admin:${ip}`, 120, 600);
    assertAdmin(this.cfg, token);
    const n = Math.max(1, Math.min(500, Number(limit) || 50));
    // any kept look with a Jupiter figure and no cut yet
    const rows = await this.db.read
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          isNotNull(users.planetFigures),
          sql`EXISTS (SELECT 1 FROM jsonb_each(${users.planetFigures}) e WHERE (e.value ->> 'jupiter') IS NOT NULL AND (e.value ->> ${WINGS_KEY}) IS NULL)`,
        ),
      )
      .orderBy(users.createdAt)
      .limit(n);
    let measured = 0;
    let fallback = 0;
    for (const r of rows) {
      const got = await this.figures.measureMissingWings(r.id).catch(() => ({ measured: 0, fallback: 0 }));
      measured += got.measured;
      fallback += got.fallback;
    }
    return { members: rows.length, measured, fallback };
  }

  /**
   * M-R325 / M-R326 backfill (admin token only): the figures cut before the checked cut are cut again WITHOUT painting
   * and checked — `limit` members at a time (default 20, at most 200), oldest first. With the painting kept (figures
   * made from M-R325 on) the whole new cut runs on it; of older figures only the cut PNG is left: their inner gaps go,
   * whites the old cut ate cannot be restored (counted in `eaten` / `failed`; those keep the picture of before, marked
   * for a new painting). No painter is called; the background-removal model and the vision check are (absorbed:
   * 'figures'), when configured. Run again until `members` is 0.
   *   curl -X POST -H "x-admin-token: …" "https://<api>/admin/figures-recut?limit=20"
   */
  @Post('figures-recut')
  @HttpCode(200)
  async recut(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string, @Req() req: Request, @Query('limit') limit?: string) {
    await rateLimit(this.kv, `admin:${ip}`, 120, 600);
    assertAdmin(this.cfg, token);
    const n = Math.max(1, Math.min(200, Number(limit) || 20));
    const rows = await this.db.read
      .select({ id: users.id })
      .from(users)
      .where(and(isNull(users.deletedAt), isNotNull(users.planetFigures), toRecut))
      .orderBy(users.createdAt)
      .limit(n);
    const origin = `${req.protocol}://${req.get('host')}`;
    const total = { members: rows.length, checked: 0, changed: 0, holes: 0, failed: 0, eaten: 0 };
    for (const r of rows) {
      const got = await this.figures.recut(r.id, origin).catch(() => null);
      if (!got) continue;
      for (const k of ['checked', 'changed', 'holes', 'failed', 'eaten'] as const) total[k] += got[k];
    }
    return total;
  }

  /**
   * M-R328 backfill (admin token only): the Mars figures painted with the old prompt (a light beam under the saucer)
   * are painted again with the prompt of now — the look worn now only, through the cut-out's checks and retries,
   * `limit` members at a time (default 10, at most 100), oldest first. The operators' one-off: absorbed ('figures',
   * no mana). Idempotent ('mars#v' is kept beside the figure). Run again until `members` is 0.
   *   curl -X POST -H "x-admin-token: …" "https://<api>/admin/figures-repaint?limit=10"
   */
  @Post('figures-repaint')
  @HttpCode(200)
  async repaint(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string, @Req() req: Request, @Query('limit') limit?: string) {
    await rateLimit(this.kv, `admin:${ip}`, 120, 600);
    assertAdmin(this.cfg, token);
    const n = Math.max(1, Math.min(100, Number(limit) || 10));
    const rows = await this.db.read
      .select({ id: users.id })
      .from(users)
      .where(and(isNotNull(users.avatarUrl), isNull(users.deletedAt), oldPrompt(sql`(${users.planetFigures} -> ${users.avatarUrl})`)))
      .orderBy(users.createdAt)
      .limit(n);
    const origin = `${req.protocol}://${req.get('host')}`;
    const total = { members: rows.length, repainted: 0, failed: 0, painted: 0 };
    for (const r of rows) {
      // the operators' repaint: booked like the absorbed figures of before
      const got = await costScope.run({ feature: 'figures', userId: r.id }, () => this.figures.repaintOld(r.id, origin)).catch(() => null);
      if (!got) continue;
      for (const k of ['repainted', 'failed', 'painted'] as const) total[k] += got[k];
    }
    return total;
  }

  /**
   * M-R326, before the live planet screens become the new homes (docs/planets.md "新しい家への切り替え"): what of the
   * existing data is not ready yet — read only, admin token only. Every count should reach 0 (or be understood) by
   * running the backfills in the order docs/planets.md gives (.github/workflows/planets-backfill.yml).
   *   curl -H "x-admin-token: …" "https://<api>/admin/planets-readiness"
   */
  @Get('planets-readiness')
  async readiness(@Headers('x-admin-token') token: string | undefined, @Ip() ip: string) {
    await rateLimit(this.kv, `admin:${ip}`, 120, 600);
    assertAdmin(this.cfg, token);
    const one = async (q: ReturnType<typeof sql>) => Number(((await this.db.read.execute(q)) as unknown as { rows: { n: string | number }[] }).rows[0]?.n ?? 0);
    const untagged = (kind: string, table: string, extra = '') =>
      one(sql`SELECT count(*) AS n FROM ${sql.raw(table)} t WHERE t.deleted_at IS NULL ${sql.raw(extra)} AND NOT EXISTS (SELECT 1 FROM planet_work_meta pm WHERE pm.kind = ${kind} AND pm.work_id = t.id)`);
    const anyFigure = (cond: (f: string) => string) => sql.raw(PLANET_FIGURES.map((f) => `(${cond(f)})`).join(' OR '));
    const looks = sql`jsonb_each(u.planet_figures) e`;
    const worksWithoutTags = {
      saturn_post: await untagged('saturn_post', 'saturn_posts', 'AND t.reply_to_id IS NULL'),
      jupiter_post: await untagged('jupiter_post', 'jupiter_posts'),
      planet_post: await untagged('planet_post', 'planet_posts'),
      radio_show: await untagged('radio_show', 'radio_shows'),
      goods: await untagged('goods', 'goods'),
      book: await untagged('book', 'books'),
      game: await untagged('game', 'games'),
    };
    const members = await one(sql`SELECT count(*) AS n FROM users u WHERE u.deleted_at IS NULL AND u.avatar_url IS NOT NULL`);
    const figures = {
      /** members with a look whose figures are not all made (of the look worn now) */
      membersMissing: await one(
        sql`SELECT count(*) AS n FROM users u WHERE u.deleted_at IS NULL AND u.avatar_url IS NOT NULL AND (${anyFigure((f) => `(u.planet_figures -> u.avatar_url ->> '${f}') IS NULL`)})`,
      ),
      /** … of which none at all */
      membersWithNone: await one(sql`SELECT count(*) AS n FROM users u WHERE u.deleted_at IS NULL AND u.avatar_url IS NOT NULL AND (u.planet_figures -> u.avatar_url) IS NULL`),
      /** members with a figure cut before the checked cut (POST /admin/figures-recut) */
      membersToRecut: await one(sql`SELECT count(*) AS n FROM users u WHERE u.deleted_at IS NULL AND u.planet_figures IS NOT NULL AND ${toRecutOf(sql`u.planet_figures`)}`),
      /** figures of before that fail the checks after the re-cut: shown as they are, to be painted again */
      figuresToRepaint: await one(
        sql`SELECT count(*) AS n FROM users u, ${looks}, jsonb_each_text(e.value) k WHERE u.deleted_at IS NULL AND u.planet_figures IS NOT NULL AND k.key LIKE '%#cut' AND k.value LIKE 'x%'`,
      ),
      /** paintings whose cut failed every retry and are not shown (M-R326) */
      cutFailures: await one(
        sql`SELECT count(*) AS n FROM users u, ${looks}, jsonb_each_text(e.value) k WHERE u.deleted_at IS NULL AND u.planet_figures IS NOT NULL AND k.key LIKE '%#cutfail' AND (e.value ->> replace(k.key, '#cutfail', '')) IS NULL`,
      ),
      /** M-R328: figures of the look worn now painted with an old prompt (Mars: the light beam; POST /admin/figures-repaint) */
      oldPrompt: await one(sql`SELECT count(*) AS n FROM users u WHERE u.deleted_at IS NULL AND u.avatar_url IS NOT NULL AND ${oldPrompt(sql`(u.planet_figures -> u.avatar_url)`)}`),
      /** … and of the other kept looks (painted again only when that look is worn and the backfill runs) */
      oldPromptOtherLooks: await one(
        sql`SELECT count(*) AS n FROM users u, ${looks} WHERE u.deleted_at IS NULL AND u.planet_figures IS NOT NULL AND e.key IS DISTINCT FROM u.avatar_url AND ${oldPrompt(sql`e.value`)}`,
      ),
      /** Jupiter figures whose wing cut is not measured (POST /admin/wings-backfill) */
      wingsNotMeasured: await one(
        sql`SELECT count(*) AS n FROM users u, ${looks} WHERE u.deleted_at IS NULL AND u.planet_figures IS NOT NULL AND (e.value ->> 'jupiter') IS NOT NULL AND (e.value ->> ${WINGS_KEY}) IS NULL`,
      ),
    };
    const fold = (x: string) => `btrim(regexp_replace(${x}, E'[ \\t\\r\\n]+', ' ', 'g'), ' ')`;
    /** Mercury songs of members with a voice whose title is not read in it (POST /admin/title-voice-backfill) */
    const songsWithoutTitleVoice = await one(
      sql`SELECT count(*) AS n FROM planet_posts p JOIN songs s ON s.id = p.source_id JOIN users u ON u.id = s.user_id
          WHERE p.planet = 'mercury' AND p.kind = 'song' AND p.deleted_at IS NULL AND s.deleted_at IS NULL AND u.deleted_at IS NULL AND u.voice_self_id IS NOT NULL
            AND ${sql.raw(fold('p.title'))} <> '' AND (s.design_json -> 'titleVoice' ->> 'text') IS DISTINCT FROM ${sql.raw(fold('p.title'))}`,
    );
    const left = Object.values(worksWithoutTags).reduce((a, b) => a + b, 0) + figures.membersMissing + figures.membersToRecut + figures.oldPrompt + figures.wingsNotMeasured + songsWithoutTitleVoice;
    return { ready: left === 0, membersWithLook: members, worksWithoutTags, figures, songsWithoutTitleVoice };
  }
}

/** a figure in `entry` (one look's figures) painted with an older prompt than PLANET_FIGURE_PROMPT_VERSION (figures.ts figuresToRepaint, in SQL) */
const oldPrompt = (entry: ReturnType<typeof sql>) =>
  sql.join(
    (Object.entries(PLANET_FIGURE_PROMPT_VERSION) as [string, number][]).map(
      ([f, v]) => sql`((${entry} ->> ${f}) IS NOT NULL AND COALESCE(substring((${entry} ->> ${versionKey(f as never)}) from '^[0-9]+')::int, 1) < ${v})`,
    ),
    sql` OR `,
  );
/** a figure of any kept look that has no 'f#cut' mark */
const toRecutOf = (store: ReturnType<typeof sql>) =>
  sql`EXISTS (SELECT 1 FROM jsonb_each(${store}) e WHERE ${sql.raw(PLANET_FIGURES.map((f) => `((e.value ->> '${f}') IS NOT NULL AND (e.value ->> '${cutKey(f)}') IS NULL)`).join(' OR '))})`;
const toRecut = toRecutOf(sql`${users.planetFigures}`);
