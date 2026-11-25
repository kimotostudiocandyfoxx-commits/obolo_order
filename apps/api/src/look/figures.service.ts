import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { BUTTERFLY_STYLE_CELLS, PLANET_FIGURE_BACKGROUND, PLANET_FIGURE_REFS, planetFigurePrompt, type GeneratedImage, type ImageProvider } from '@obolo/ai';
import { FIGURE_PAINTER, type PlanetFigure } from '@obolo/shared';
import { eq, sql } from 'drizzle-orm';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { Database } from '../db/db';
import { users } from '../db/schema';
import type { JobPayloads, JobQueue } from '../infra/queue';
import { LOOK_IMAGES, PLANET_CHIBI_IMAGES, QUEUE, SATURN_BALL_IMAGES, SATURN_CHIBI_IMAGES } from '../infra/tokens';
import { cutoutWhite } from '../media/cutout';
import { chooseKey, cutoutChecked, KEY_WORDS, type KeyName } from '../media/keying';
import { MediaService } from '../media/media.service';
import { costScope } from '../wallet/cost-scope';
import { FIGURE_CONCURRENCY, FIGURE_RUN_TRIES, FIGURE_SIDE, FIGURE_TRIES, figuresOf, figuresToMake, triesKey, type FigureStore } from './figures';

export { FIGURE_CONCURRENCY, FIGURE_RUN_TRIES, FIGURE_TRIES, figuresOf, figuresToMake, triesKey, type FigureStore };

let butterflyCells: Promise<GeneratedImage[]> | null = null;
let kororinDot: Promise<GeneratedImage> | null = null;
const ASSETS = resolve(__dirname, '../../assets');
/** the lab's style references (scripts/art-lab/planet_avatar_prompts.json style_refs): three cells of the butterfly sheet, the kororin dot ball */
const bstyle = () =>
  (butterflyCells ??= readFile(resolve(ASSETS, 'butterfly-style.jpg')).then((sheet) =>
    Promise.all(BUTTERFLY_STYLE_CELLS.map(async ([left, top, width, height]) => ({ data: await sharp(sheet).extract({ left, top, width, height }).jpeg({ quality: 92 }).toBuffer(), mime: 'image/jpeg' }))),
  ));
const kstyle = () => (kororinDot ??= readFile(resolve(ASSETS, 'kororin-style-dot.jpg')).then((data) => ({ data, mime: 'image/jpeg' })));

/** at most `n` at once, every one settled */
async function pool<T>(items: T[], n: number, run: (x: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(n, queue.length) }, async () => {
      for (let x = queue.shift(); x !== undefined; x = queue.shift()) await run(x);
    }),
  );
}

/**
 * Client decision 2026-11-25: the member's deformed figure on every home planet, painted from their profile look — the
 * Saturn 2-heads 2D anime chibi (SATURN_CHIBI_MODEL, FLUX.2 klein 4B), the Saturn kororin ball in their own pattern
 * (SATURN_BALL_MODEL) and the seven other planets' chibis (PLANET_CHIBI_MODEL; both Qwen-Image 2.1 Turbo). One job per
 * look makes all nine, FIGURE_CONCURRENCY at a time; each figure is painted at most FIGURE_RUN_TRIES times in a job and
 * FIGURE_TRIES times in all, counted before each painting (a job the queue runs again never paints more); what was made
 * is kept, what failed is made by the backfill later (until its tries are spent). Stored through MediaService (they count to the member's storage).
 */
@Injectable()
export class PlanetFiguresService {
  private readonly log = new Logger('Figures');
  constructor(
    private readonly db: Database,
    private readonly media: MediaService,
    @Inject(QUEUE) private readonly queue: JobQueue,
    @Inject(LOOK_IMAGES) private readonly looks: ImageProvider,
    @Optional() @Inject(SATURN_CHIBI_IMAGES) private readonly chibiPainter?: ImageProvider,
    @Optional() @Inject(SATURN_BALL_IMAGES) private readonly ballPainter?: ImageProvider,
    @Optional() @Inject(PLANET_CHIBI_IMAGES) private readonly planetPainter?: ImageProvider,
  ) {
    this.queue.register('look.figures', (p) => this.make(p));
    // M-R262: a Saturn mini figure task still in a queue makes the figures of the look worn now
    this.queue.register('look.chibi', ({ userId, origin }) => this.make({ userId, origin }));
  }

  /** the job of one look's figures (`again`: the backfill, a new key so a finished job of the same look does not swallow it) */
  async enqueue(userId: string, origin: string, look: string, paid?: JobPayloads['look.figures']['paid'], again = false): Promise<void> {
    const key = `figures-${userId}-${look}${again ? `-${Date.now()}` : ''}`;
    await this.queue.enqueue('look.figures', { userId, origin, look, ...(paid ? { paid } : {}) }, { dedupeKey: key }).catch(() => undefined);
  }

  private painter(f: PlanetFigure): ImageProvider {
    const p = FIGURE_PAINTER[f];
    return (p === 'saturnChibi' ? this.chibiPainter : p === 'saturnBall' ? this.ballPainter : this.planetPainter) ?? this.looks;
  }

  private async row(userId: string) {
    const [u] = await this.db.write.select({ avatarUrl: users.avatarUrl, chibiPicUrl: users.chibiPicUrl, planetFigures: users.planetFigures }).from(users).where(eq(users.id, userId));
    return u ?? null;
  }

  /** merge `patch` into the figures of `look` (one UPDATE: two figures finishing together both stay) */
  protected async patch(userId: string, look: string, patch: Record<string, string>): Promise<void> {
    const cur = sql`coalesce(${users.planetFigures}, '{}'::jsonb)`;
    await this.db.write
      .update(users)
      .set({ planetFigures: sql`jsonb_set(${cur}, ARRAY[${look}]::text[], coalesce(${cur} -> ${look}, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb, true)`, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  /** the Saturn chibi of the look worn now is users.chibi_pic_url (the Saturn home reads it for every maker) */
  protected async setChibi(userId: string, url: string): Promise<void> {
    const before = await this.row(userId);
    await this.db.write.update(users).set({ chibiPicUrl: url, updatedAt: new Date() }).where(eq(users.id, userId));
    // the old one (the 3D mini figure of before M-R275) goes, unless it is a figure of a look still kept
    const old = before?.chibiPicUrl;
    const kept = Object.values(before?.planetFigures ?? {}).some((e) => Object.values(e).includes(old ?? ''));
    if (old && old !== url && !kept) await this.media.removeByUrl(userId, old).catch(() => undefined);
  }

  /** the look's bytes and type */
  private async lookPicture(userId: string, url: string): Promise<GeneratedImage | null> {
    const data = await this.media.bytesByUrl(userId, url);
    if (!data) return null;
    return { data, mime: data[0] === 0x89 ? 'image/png' : data[0] === 0xff ? 'image/jpeg' : 'image/webp' };
  }

  /** one figure painted and cut out: the look first, then the style references (the lab's order) */
  private async paint(f: PlanetFigure, look: GeneratedImage, key: KeyName): Promise<Buffer> {
    const refs = PLANET_FIGURE_REFS[f] === 'bstyle' ? await bstyle() : PLANET_FIGURE_REFS[f] === 'kstyle' ? [await kstyle()] : [];
    const img = await this.painter(f).generate(planetFigurePrompt(f, KEY_WORDS[key], key), 0, [look, ...refs]);
    if (PLANET_FIGURE_BACKGROUND[f] === 'white') return cutoutWhite(img.data, FIGURE_SIDE);
    const r = await cutoutChecked(img.data, FIGURE_SIDE, key, async (_to, prompt) => (await this.looks.generate(prompt, 0, [img])).data);
    if (!r) throw new Error('cut-out failed');
    return r.png;
  }

  /**
   * The figures of a look (the one worn now when `look` is not given; nothing when the member wears another look by
   * now). `paid`: the profile look change that paid for them — the job's provider costs are that making's.
   */
  async make(p: JobPayloads['look.figures']): Promise<void> {
    if (p.paid) costScope.tag({ kind: p.paid.kind, job: p.paid.job, paid: true });
    const u = await this.row(p.userId);
    const of = p.look ?? u?.avatarUrl;
    if (!u || !of || u.avatarUrl !== of) return;
    const todo = figuresToMake(u.planetFigures, of);
    if (todo.length) {
      const src = await this.lookPicture(p.userId, of);
      if (!src) return;
      const key = await chooseKey(src.data);
      let tries: Record<string, string> = { ...(u.planetFigures?.[of] ?? {}) };
      await pool(todo, FIGURE_CONCURRENCY, async (f) => {
        for (let here = 0; here < FIGURE_RUN_TRIES; here++) {
          const n = Number(tries[triesKey(f)] ?? 0);
          if (n >= FIGURE_TRIES) return;
          // counted before the painting: a crash or a queue retry never paints more than FIGURE_TRIES
          tries = { ...tries, [triesKey(f)]: String(n + 1) };
          await this.patch(p.userId, of, { [triesKey(f)]: String(n + 1) });
          try {
            const png = await this.paint(f, src, key);
            const m = await this.media.storeImage(p.userId, 'avatar', 'image/png', png, p.origin);
            await this.patch(p.userId, of, { [f]: m.url });
            if (f === 'saturnChibi') {
              const now = await this.row(p.userId);
              if (now?.avatarUrl === of) await this.setChibi(p.userId, m.url);
            }
            return;
          } catch (e) {
            this.log.warn(`figure ${f} failed (${n + 1}/${FIGURE_TRIES}): ${String(e)}`);
          }
        }
      });
    }
    // a look worn again whose Saturn chibi was made before
    const after = await this.row(p.userId);
    const chibi = figuresOf(after?.planetFigures, of).saturnChibi;
    if (after?.avatarUrl === of && chibi && after.chibiPicUrl !== chibi) await this.setChibi(p.userId, chibi);
  }
}
