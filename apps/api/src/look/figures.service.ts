import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { BUTTERFLY_STYLE_CELLS, PLANET_FIGURE_BACKGROUND, PLANET_FIGURE_PROMPT_VERSION, PLANET_FIGURE_REFS, planetFigurePrompt, type BackgroundRemover, type GeneratedImage, type ImageProvider, type LlmProvider } from '@obolo/ai';
import { FIGURE_PAINTER, type PlanetFigure } from '@obolo/shared';
import { eq, sql } from 'drizzle-orm';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { Database } from '../db/db';
import { users } from '../db/schema';
import type { JobPayloads, JobQueue } from '../infra/queue';
import { CUTOUT_MODEL, LLM, LOOK_IMAGES, PLANET_CHIBI_IMAGES, QUEUE, SATURN_BALL_IMAGES, SATURN_CHIBI_IMAGES } from '../infra/tokens';
import { cutByModel, cutLadder, inspectCut, ladderRecord, llmCutJudge, recutStored, type CutBackground, type LadderResult, type Painting } from '../media/cutting';
import { chooseKey, KEY_WORDS, KEYS, type KeyName } from '../media/keying';
import { MediaService } from '../media/media.service';
import { costScope } from '../wallet/cost-scope';
import { CUT_VERSION, cutFailKey, cutKey, FIGURE_CONCURRENCY, FIGURE_RUN_TRIES, FIGURE_SIDE, FIGURE_TRIES, figuresOf, figuresToMake, figuresToRecut, figuresToRepaint, srcKey, triesKey, versionKey, wingsToMeasure, encodeWings, WINGS_KEY, type FigureStore } from './figures';
import { measureWings } from './wings';

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
    /** M-R326: the background-removal model (the shape check, the first retry) and the cheap vision model (the last check) */
    @Optional() @Inject(CUTOUT_MODEL) private readonly cutModel?: BackgroundRemover | null,
    @Optional() @Inject(LLM) private readonly llm?: LlmProvider,
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

  /**
   * One figure painted, cut out and checked (M-R325 / M-R326, media/cutting.ts cutLadder): the look first, then the style
   * references (the lab's order). A cut that fails a check is retried by the background-removal model's cut, then the
   * figure is painted again on the key colour away from the look's own colours, and once more — `mayPaint` is asked
   * before each of those paintings (the figure's tries). Not ok: nothing may be shown.
   */
  private async paint(f: PlanetFigure, look: GeneratedImage, key: KeyName, mayPaint: () => Promise<boolean>): Promise<LadderResult> {
    const refs = PLANET_FIGURE_REFS[f] === 'bstyle' ? await bstyle() : PLANET_FIGURE_REFS[f] === 'kstyle' ? [await kstyle()] : [];
    const one = async (onKey: boolean): Promise<Painting> => {
      const img = await this.painter(f).generate(planetFigurePrompt(f, KEY_WORDS[key], key, undefined, onKey), 0, [look, ...refs]);
      return { ...img, background: onKey || PLANET_FIGURE_BACKGROUND[f] === 'key' ? key : 'plain' };
    };
    return cutLadder({
      first: await one(false),
      out: FIGURE_SIDE,
      kind: f,
      opt: { bigHoles: f === 'neptune' },
      model: this.cutModel,
      judge: llmCutJudge(this.llm),
      repaint: async () => ((await mayPaint()) ? one(true) : null),
      onTry: (t) => this.log.warn(`figure ${f}: cut-out ${t.step} failed its checks (${t.failed.join(', ') || t.reason}${t.failed.length && t.reason ? `: ${t.reason}` : ''})`),
    });
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
          const count = async () => {
            const k = Number(tries[triesKey(f)] ?? 0);
            if (k >= FIGURE_TRIES) return false;
            tries = { ...tries, [triesKey(f)]: String(k + 1) };
            await this.patch(p.userId, of, { [triesKey(f)]: String(k + 1) });
            return true;
          };
          try {
            const cut = await this.paint(f, src, key, count);
            if (!cut.ok) {
              // M-R326: three failed retries — nothing is shown (the figure of before stays, or the app's stand-in);
              // recorded for the operators (GET /admin/planets-readiness counts them)
              const record = ladderRecord(cut.tries);
              this.log.error(`figure ${f} of ${p.userId}: the cut-out failed every retry and is not shown (${record})`);
              await this.patch(p.userId, of, { [cutFailKey(f)]: record });
              return;
            }
            const png = cut.png;
            const m = await this.media.storeImage(p.userId, 'avatar', 'image/png', png, p.origin);
            // M-R325: the painting is kept too, so a later cut-out can cut it again without painting
            const kept = await this.media.storeImage(p.userId, 'avatar', cut.source.mime, cut.source.data, p.origin).catch(() => null);
            // 03 §1: the butterfly's wing cut, measured on the cut-out picture (kept with it; 'none': the default cut)
            const wings: Record<string, string> = f === 'jupiter' ? { [WINGS_KEY]: encodeWings(await measureWings(png).catch(() => null)) } : {};
            await this.patch(p.userId, of, { [f]: m.url, [cutKey(f)]: `${CUT_VERSION}:${cut.step}`, ...(kept ? { [srcKey(f)]: kept.url } : {}), ...versionOf(f), ...wings });
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

  /**
   * 03 §1 backfill: the wing cut of every kept look's Jupiter figure painted before the cut was measured (no painting,
   * no provider: the stored picture is read and measured). Returns how many were measured and how many fell back.
   */
  async measureMissingWings(userId: string): Promise<{ measured: number; fallback: number }> {
    const u = await this.row(userId);
    let measured = 0;
    let fallback = 0;
    for (const look of wingsToMeasure(u?.planetFigures)) {
      const url = u?.planetFigures?.[look]?.jupiter;
      if (!url) continue;
      const png = await this.media.bytesByUrl(userId, url).catch(() => null);
      // the picture could not be read this time: left for the next run
      if (!png) continue;
      const w = await measureWings(png).catch(() => null);
      if (w) measured++;
      else fallback++;
      await this.patch(userId, look, { [WINGS_KEY]: encodeWings(w) });
    }
    return { measured, fallback };
  }

  /**
   * M-R328 backfill (the operators' one-off, absorbed: 'figures'): the figures of the look worn now that were painted
   * with an older prompt (Mars: the light under the saucer) are painted again with the prompt of now, through the
   * cut-out's checks and retries (at most three paintings). One that passes replaces the figure; one whose cut fails
   * every retry leaves the figure of before and is marked ('f#v' <n>x) so it is not painted again.
   */
  async repaintOld(userId: string, origin: string): Promise<{ repainted: number; failed: number; painted: number }> {
    const out = { repainted: 0, failed: 0, painted: 0 };
    const u = await this.row(userId);
    const of = u?.avatarUrl;
    const todo = figuresToRepaint(u?.planetFigures, of, PLANET_FIGURE_PROMPT_VERSION);
    if (!u || !of || !todo.length) return out;
    const src = await this.lookPicture(userId, of);
    if (!src) return out;
    const key = await chooseKey(src.data);
    for (const f of todo) {
      const v = PLANET_FIGURE_PROMPT_VERSION[f]!;
      const before = u.planetFigures?.[of] ?? {};
      const cut = await this.paint(f, src, key, async () => true).catch((e) => {
        this.log.warn(`figure ${f} of ${userId}: the repaint failed (${String(e)})`);
        return null;
      });
      // the painter was down: left for the next run
      if (!cut) continue;
      out.painted += cut.painted;
      if (!cut.ok) {
        out.failed++;
        this.log.error(`figure ${f} of ${userId}: the repaint's cut-out failed every retry (${ladderRecord(cut.tries)}); the figure of before stays`);
        await this.patch(userId, of, { [versionKey(f)]: `${v}x`, [cutFailKey(f)]: ladderRecord(cut.tries) });
        continue;
      }
      const m = await this.media.storeImage(userId, 'avatar', 'image/png', cut.png, origin);
      const kept = await this.media.storeImage(userId, 'avatar', cut.source.mime, cut.source.data, origin).catch(() => null);
      await this.patch(userId, of, { [f]: m.url, [cutKey(f)]: `${CUT_VERSION}:${cut.step}`, [versionKey(f)]: String(v), ...(kept ? { [srcKey(f)]: kept.url } : {}) });
      for (const old of [before[f], before[srcKey(f)]]) if (old) await this.media.removeByUrl(userId, old).catch(() => undefined);
      out.repainted++;
    }
    return out;
  }

  /**
   * M-R325 / M-R326 backfill: the figures of every kept look that were cut before the checked cut — cut again WITHOUT
   * painting, and checked like a new one. With the painting kept ('f#src', from M-R325 on) the whole new cut runs on
   * it (colour, then the model). Of older figures only the cut PNG exists: its inner holes are removed (recutStored);
   * whites the old cut ate cannot be restored. Either way the result is checked: one that passes replaces the figure
   * ('f#cut' r…), one that fails leaves the figure of before as it is and marks it ('f#cut' x…: to be painted again).
   */
  async recut(userId: string, origin: string): Promise<{ checked: number; changed: number; holes: number; failed: number; eaten: number }> {
    const u = await this.row(userId);
    const out = { checked: 0, changed: 0, holes: 0, failed: 0, eaten: 0 };
    const judge = llmCutJudge(this.llm);
    for (const t of figuresToRecut(u?.planetFigures)) {
      const f = t.figure;
      const opt = { bigHoles: f === 'neptune' };
      const stored = await this.media.bytesByUrl(userId, t.url).catch(() => null);
      // the picture could not be read this time: left for the next run
      if (!stored) continue;
      out.checked++;
      let png: Buffer | null = null;
      let mark = '';
      const src = t.src ? await this.media.bytesByUrl(userId, t.src).catch(() => null) : null;
      if (src) {
        // the painting is kept: cut again from it (its background is found from its border: a key colour is saturated)
        const background = await backgroundOf(src);
        const r = await cutLadder({ first: { data: src, mime: mimeOf(src), background }, out: FIGURE_SIDE, kind: f, opt, model: this.cutModel, judge });
        if (r.ok) {
          png = r.png;
          mark = `r${CUT_VERSION}:${r.step}`;
        } else mark = `x${CUT_VERSION}:${ladderRecord(r.tries)}`;
      } else {
        // only the cut PNG: the holes of a white background go; a key-coloured one is only checked (each key tried)
        const backgrounds: CutBackground[] = PLANET_FIGURE_BACKGROUND[f] === 'white' ? ['plain'] : (Object.keys(KEYS) as KeyName[]);
        const failed = new Set<string>();
        for (const background of backgrounds) {
          const r = await recutStored(png ?? stored, background, opt);
          if (r.png) {
            png = r.png;
            out.holes += r.holesRemoved;
          }
          if (r.eaten) out.eaten++;
          // the shape check: the model cuts the picture as it was painted (the cut part is the background again)
          const flat = this.cutModel
            ? await sharp(Buffer.from(r.result.work.before), { raw: { width: r.result.work.W, height: r.result.work.H, channels: 4 } }).removeAlpha().png().toBuffer()
            : null;
          const other = flat && this.cutModel ? await cutByModel(flat, 'image/png', this.cutModel, FIGURE_SIDE, background, opt).catch(() => null) : undefined;
          // the stored picture is already framed: the kind's own range is of the painting, not of this
          const i = await inspectCut(r.result, { background, kind: 'figure', other, judge, soft: opt.bigHoles });
          for (const c of i.failed) failed.add(c);
          // one model call and one look are enough: the other keys only look for their own colour left inside
          if (backgrounds.length > 1 && !i.failed.length) continue;
        }
        mark = failed.size ? `x${CUT_VERSION}:${[...failed].join('+')}` : `r${CUT_VERSION}`;
        if (failed.size) png = null;
      }
      if (mark.startsWith('x')) {
        out.failed++;
        this.log.warn(`figure ${f} of ${userId}: the re-cut fails its checks (${mark}); the figure of before stays`);
      }
      const patch: Record<string, string> = { [cutKey(f)]: mark };
      if (png) {
        const m = await this.media.storeImage(userId, 'avatar', 'image/png', png, origin);
        patch[f] = m.url;
        if (f === 'jupiter') patch[WINGS_KEY] = encodeWings(await measureWings(png).catch(() => null));
        out.changed++;
        await this.patch(userId, t.look, patch);
        const now = await this.row(userId);
        if (f === 'saturnChibi' && now?.avatarUrl === t.look) await this.setChibi(userId, m.url);
        else await this.media.removeByUrl(userId, t.url).catch(() => undefined);
      } else await this.patch(userId, t.look, patch);
    }
    return out;
  }
}

/** the prompt version kept beside a figure just painted (M-R328) */
const versionOf = (f: PlanetFigure): Record<string, string> => (PLANET_FIGURE_PROMPT_VERSION[f] ? { [versionKey(f)]: String(PLANET_FIGURE_PROMPT_VERSION[f]) } : {});
const mimeOf = (data: Buffer) => (data[0] === 0x89 ? 'image/png' : data[0] === 0xff ? 'image/jpeg' : 'image/webp');
/** what a kept painting was painted on, from its border: one of the key colours when the border is that saturated colour, else plain */
async function backgroundOf(painting: Buffer): Promise<CutBackground> {
  const { data, info } = await sharp(painting).removeAlpha().resize(64, 64, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const sum = [0, 0, 0];
  let n = 0;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      if (x > 1 && y > 1 && x < info.width - 2 && y < info.height - 2) continue;
      for (let c = 0; c < 3; c++) sum[c] += data[(y * info.width + x) * 3 + c];
      n++;
    }
  const [r, g, b] = sum.map((v) => v / n);
  for (const k of Object.keys(KEYS) as KeyName[]) {
    const K = KEYS[k];
    if (Math.max(Math.abs(r - K[0]), Math.abs(g - K[1]), Math.abs(b - K[2])) < 90) return k;
  }
  return 'plain';
}
