import { timed } from '@obolo/ai';
import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { MV_MAX_MATERIALS, MV_MAX_SECONDS, spellPrompt, VIDEO_DEFAULTS, videoParams, videoWindow, type AddMvMaterialBody, type MvEditBody, type MvMaterial, type MvProjectView, type SongMix, type SongPhrase, type SpellTag, type VideoCut, type VideoParams } from '@obolo/shared';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { timedLyrics } from '../compose/lyrics';
import { AppConfig, CONFIG } from '../config';
import { Database } from '../db/db';
import { jupiterRoots, marsBackstage, mvProjects, songs, users } from '../db/schema';
import { followMv } from '../planets/mv-follow';
import { probe, run } from '../media/transcode';
import { MediaService } from '../media/media.service';
import { idToken } from '../compose/music.client';
import { DepthModel } from './depth';
import { KeyArtist } from './keyart';
import { addParallax, type Parallax } from './parallax';
import { cutPlan, FLY_MOVES, usesDepth, windowLyrics } from './cut';
import { paintScenes, PAINTERS, seedreamSheets, StyledPainter } from './styled';
import { planMv, type MvPlan } from './plan';
import { burnLyrics, renderMv } from './render';
import { describeHero, isHuman, planStory, type StoryPlan } from './storyboard';
import { Stylizer } from './stylize';

type Row = typeof mvProjects.$inferSelect;
type SongRow = typeof songs.$inferSelect;

/**
 * Mars MV (client decision 2026-10-08): one of your Mercury songs + the videos / photos you send
 * Bati in the chat → Bati plans the edit (Gemini Flash-Lite), gives it the anime look (ONNX) and
 * renders the MV (ffmpeg); on request the same MV with the lyrics on it. Every MV is kept in your
 * 裏スタジオ, from where it can fly as a UFO (up to the whole song, MV_MAX_SECONDS).
 */
@Injectable()
export class MvService {
  private readonly log = new Logger('MV');
  private readonly keyArtist: KeyArtist;
  /** plan A (MV_PLAN=A): Seedream sheets on Runware */
  private readonly sheets: StyledPainter | null;
  private readonly depth: DepthModel;
  constructor(
    private readonly db: Database,
    private readonly media: MediaService,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {
    const gpu = cfg.MV_GPU_PAINT && cfg.MUSIC_URL ? cfg.MUSIC_URL.replace(/\/$/, '') : undefined;
    this.keyArtist = new KeyArtist({
      paintUrl: gpu,
      paintToken: gpu ? () => idToken(gpu) : undefined,
      novitaKey: cfg.NOVITA_API_KEY,
      novitaModel: cfg.NOVITA_MODEL,
      novitaStrength: cfg.NOVITA_STRENGTH,
      novitaSide: cfg.NOVITA_SIDE,
      runwareKey: cfg.RUNWARE_API_KEY,
      runwareModel: cfg.RUNWARE_MODEL,
      geminiKey: cfg.GEMINI_API_KEY,
      geminiModel: cfg.MV_KEYART_MODEL,
      stylizer: new Stylizer(cfg.ANIME_ONNX_URL),
    });
    this.depth = new DepthModel(cfg.MV_DEPTH_ONNX_URL || undefined);
    this.sheets = cfg.MV_PLAN === 'A' && cfg.MV_RUNWARE_KEY ? new StyledPainter({ key: cfg.MV_RUNWARE_KEY }) : null;
  }

  private async song(userId: string, songId: string): Promise<SongRow> {
    const [s] = await this.db.read
      .select()
      .from(songs)
      .where(and(eq(songs.id, songId), eq(songs.userId, userId), isNull(songs.deletedAt)));
    if (!s) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Song not found');
    return s;
  }

  private async row(userId: string, id: string): Promise<Row> {
    const [p] = await this.db.write
      .select()
      .from(mvProjects)
      .where(and(eq(mvProjects.id, id), eq(mvProjects.userId, userId), isNull(mvProjects.deletedAt)));
    if (!p) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'MV not found');
    return p;
  }

  private lyricLines(s: SongRow) {
    return timedLyrics(s.phrasesJson as unknown as SongPhrase[], s.designJson as { bpm?: number }, s.mixJson as unknown as SongMix);
  }

  private async view(p: Row): Promise<MvProjectView> {
    const s = await this.db.read.select({ title: songs.title, phrases: songs.phrasesJson }).from(songs).where(eq(songs.id, p.songId));
    const phrases = (s[0]?.phrases ?? []) as unknown as SongPhrase[];
    return {
      id: p.id,
      songId: p.songId,
      songTitle: s[0]?.title ?? '',
      status: p.status as MvProjectView['status'],
      materials: p.materialsJson as unknown as MvMaterial[],
      videoUrl: p.videoUrl,
      lyricsVideoUrl: p.lyricsVideoUrl,
      posterUrl: p.posterUrl,
      hasLyrics: phrases.some((x) => x.text?.trim()),
      note: p.note,
      backstageId: p.backstageId,
      seconds: p.seconds,
      cut: ((p.planJson ?? null) as { cut?: MvProjectView['cut'] } | null)?.cut ?? null,
    };
  }

  async create(userId: string, songId: string): Promise<MvProjectView> {
    await this.song(userId, songId);
    const [p] = await this.db.write.insert(mvProjects).values({ userId, songId }).returning();
    return this.view(p);
  }

  async get(userId: string, id: string) {
    return this.view(await this.row(userId, id));
  }

  async latest(userId: string) {
    const rows = await this.db.read
      .select()
      .from(mvProjects)
      .where(and(eq(mvProjects.userId, userId), isNull(mvProjects.deletedAt)))
      .orderBy(desc(mvProjects.createdAt))
      .limit(20);
    return Promise.all(rows.map((r) => this.view(r)));
  }

  /** A video or photo sent in the chat (already uploaded) becomes a material. */
  async addMaterial(userId: string, id: string, body: AddMvMaterialBody & { posterUrl?: string | null; seconds?: number | null }): Promise<MvProjectView> {
    const p = await this.row(userId, id);
    const mats = p.materialsJson as unknown as MvMaterial[];
    if (mats.length >= MV_MAX_MATERIALS) throw apiError(HttpStatus.CONFLICT, 'TOO_MANY', `Up to ${MV_MAX_MATERIALS} materials`);
    const m = await this.media.ownedAny(userId, body.mediaId);
    if (!m || (body.kind === 'photo' ? m.kind !== 'photo' : m.kind !== 'video')) throw apiError(HttpStatus.NOT_FOUND, 'MEDIA_NOT_FOUND', 'Material not found');
    const next: MvMaterial[] = [...mats, { mediaId: m.id, kind: body.kind, url: m.url, posterUrl: body.posterUrl ?? null, seconds: body.seconds ?? null }];
    const [up] = await this.db.write
      .update(mvProjects)
      .set({ materialsJson: next as never, updatedAt: new Date() })
      .where(eq(mvProjects.id, id))
      .returning();
    return this.view(up);
  }

  async removeMaterial(userId: string, id: string, mediaId: string): Promise<MvProjectView> {
    const p = await this.row(userId, id);
    const next = (p.materialsJson as unknown as MvMaterial[]).filter((m) => m.mediaId !== mediaId);
    const [up] = await this.db.write
      .update(mvProjects)
      .set({ materialsJson: next as never, updatedAt: new Date() })
      .where(eq(mvProjects.id, id))
      .returning();
    return this.view(up);
  }

  /** Make the MV (takes a minute or two; the app waits with Bati). */
  async render(userId: string, id: string, origin: string): Promise<MvProjectView> {
    const p = await this.row(userId, id);
    const mats = p.materialsJson as unknown as MvMaterial[];
    if (!mats.length) throw apiError(HttpStatus.BAD_REQUEST, 'NO_MATERIALS', 'Send some videos or photos first');
    if (p.status === 'rendering' && p.updatedAt > new Date(Date.now() - 10 * 60_000)) throw apiError(HttpStatus.CONFLICT, 'BUSY', 'Already making it');
    await this.db.write.update(mvProjects).set({ status: 'rendering', error: null, updatedAt: new Date() }).where(eq(mvProjects.id, id));
    const s = await this.song(userId, p.songId);
    const dir = await mkdtemp(join(tmpdir(), 'obolo-mv-'));
    try {
      const seconds = Math.min(MV_MAX_SECONDS, s.seconds);
      const audioBytes = await this.media.bytesByUrl(userId, s.mixUrl);
      if (!audioBytes) throw new Error('song audio unavailable');
      const audio = join(dir, 'song.m4a');
      await writeFile(audio, audioBytes);
      const files: { kind: 'photo' | 'video'; file: string; seconds: number | null; preview: Buffer | null }[] = [];
      for (const [k, m] of mats.entries()) {
        const bytes = await this.media.bytesByUrl(userId, m.url);
        if (!bytes) continue;
        const file = join(dir, `m${k}${m.kind === 'photo' ? '.img' : '.mp4'}`);
        await writeFile(file, bytes);
        let secs: number | null = null;
        let preview: Buffer | null = null;
        if (m.kind === 'video') {
          secs = (await probe(file)).seconds;
          const frame = join(dir, `m${k}-prev.jpg`);
          await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-ss', String(Math.min(1, secs / 3)), '-i', file, '-frames:v', '1', '-vf', 'scale=384:-2', frame]).catch(() => undefined);
          preview = await readFile(frame).catch(() => null);
        } else {
          preview = await sharp(bytes)
            .rotate()
            .resize(384, 384, { fit: 'inside' })
            .jpeg({ quality: 70 })
            .toBuffer()
            .catch(() => null);
        }
        files.push({ kind: m.kind, file, seconds: secs, preview });
      }
      if (!files.length) throw new Error('materials unavailable');
      const bpm = Number((s.designJson as { bpm?: number }).bpm) || 100;
      const plan: MvPlan = await planMv(
        { title: s.title, seconds, bpm, lyrics: this.lyricLines(s).map((l) => ({ t: l.t, text: l.text, chorus: l.chorus })), materials: files, keyCuts: this.cfg.MV_KEY_CUTS },
        this.cfg.GEMINI_API_KEY,
        this.cfg.MV_PLAN_MODEL,
      );
      const out = await renderMv({ dir, materials: files, plan, audio, seconds, bpm, keyArtist: this.keyArtist });
      this.log.log(`MV ${id}: ${plan.segments.length} cuts, ${out.keyCuts} キメ絵`);
      const v = await this.media.storeGenerated(userId, 'video', 'video/mp4', await readFile(out.video), origin);
      const poster = await this.media.storeGenerated(userId, 'poster', 'image/webp', await readFile(out.poster), origin);
      const info = await probe(out.video);
      // kept in the 裏スタジオ: from there it can fly as a UFO
      const [b] = await this.db.write
        .insert(marsBackstage)
        .values({ userId, mediaId: v.id, url: v.url, posterUrl: poster.url, seconds: info.seconds, title: `${s.title}（MV）`.slice(0, 40) })
        .returning();
      const [up] = await this.db.write
        .update(mvProjects)
        .set({
          status: 'done',
          planJson: plan as never,
          videoUrl: v.url,
          lyricsVideoUrl: null,
          posterUrl: poster.url,
          seconds: info.seconds,
          note: plan.note,
          backstageId: b.id,
          updatedAt: new Date(),
        })
        .where(eq(mvProjects.id, id))
        .returning();
      // story 2026-11-27: made again — the MV flown before shows this film on Mars
      await followMv(this.db, userId, { backstageId: p.backstageId, urls: [p.videoUrl, p.lyricsVideoUrl] }, { backstageId: b.id, url: v.url, posterUrl: poster.url, seconds: info.seconds });
      return this.view(up);
    } catch (e) {
      this.log.warn(`MV failed: ${String(e).slice(0, 300)}`);
      await this.db.write
        .update(mvProjects)
        .set({ status: 'failed', error: String(e).slice(0, 300), updatedAt: new Date() })
        .where(eq(mvProjects.id, id));
      throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MV_FAILED', 'Could not make the MV');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  /**
   * Story MV (client decision 2026-10-08; R13 from its spell): no materials — Bati reads the song and the profile picture
   * (the hero), writes a storyboard and every scene is painted as one picture (FLUX.2 klein on Runware / our GPU), then
   * the pictures move (renderCut). `mood` = what the creator said they want (may be empty: Bati decides); `tags` = the
   * video's spell (what it is for, the scenes, the camera, the length …), none = the older call: the whole song.
   * No video-generation model is used: the pictures are moved and joined by ffmpeg.
   */
  async story(userId: string, id: string, origin: string, mood: string, tags?: SpellTag[]): Promise<MvProjectView> {
    return timed('cpu', 'mv:story', () => this.storyOnCpu(userId, id, origin, mood, tags));
  }

  private async storyOnCpu(userId: string, id: string, origin: string, mood: string, tags?: SpellTag[]): Promise<MvProjectView> {
    const p = await this.begin(userId, id);
    const s = await this.song(userId, p.songId);
    const params = tags ? videoParams(tags) : this.legacyParams();
    const dir = await mkdtemp(join(tmpdir(), 'obolo-mvs-'));
    try {
      const t0 = Date.now();
      // the hero: the painted ぷにぷに picture, else the NEO look
      const picture = await this.heroPicture(userId);
      const hero = await describeHero(picture, this.cfg.GEMINI_API_KEY, this.cfg.MV_PLAN_MODEL);
      const design = s.designJson as { bpm?: number; instrumentalPrompt?: string };
      const bpm = Number(design.bpm) || 100;
      const all = this.lyricLines(s);
      const win = videoWindow(params, s.seconds, all);
      const lyr = windowLyrics(all, win.start, win.seconds);
      const cap = this.sheets ? this.cfg.MV_SHEET_SCENES : this.keyArtist.sceneBudget(this.cfg.MV_SCENES, this.cfg.MV_QWEN_SCENES);
      const story: StoryPlan = await planStory(
        {
          title: s.title,
          seconds: win.seconds,
          bpm,
          mood: [mood.trim(), params.purpose === 'slideshow' ? 'a story told in pictures, like a picture book read aloud' : ''].filter(Boolean).join('; ').slice(0, 260),
          music: String(design.instrumentalPrompt ?? '').slice(0, 300),
          lyrics: lyr.map((l) => ({ t: l.t, text: l.text, chorus: l.chorus })),
          hero,
          maxScenes: cap,
          scenes: tags ? params.scenes : undefined,
        },
        this.cfg.GEMINI_API_KEY,
        this.cfg.MV_PLAN_MODEL,
      );
      const drawn = await this.paint(story.scenes.map((sc) => sc.tags), picture, hero, id);
      const pics: (string | null)[] = await Promise.all(
        drawn.map(async (img, k) => {
          if (!img) return null;
          const f = join(dir, `scene-${k}.jpg`);
          await sharp(img).jpeg({ quality: 92 }).toFile(f);
          return f;
        }),
      );
      const painted = pics.filter(Boolean).length;
      this.log.log(`MV ${id}: storyboard ${story.scenes.length} scenes, painted ${painted} in ${Math.round((Date.now() - t0) / 1000)}s`);
      // a scene that could not be painted shows its neighbour (or, with nothing painted, a plain card)
      const fallback = pics.find(Boolean) ?? (await this.plainCard(dir, s.title));
      const files = pics.map((f, k) => f ?? pics.slice(0, k).reverse().find(Boolean) ?? fallback);
      // every picture is kept with the video: a change of how it moves is made again from them, never painted again
      const urls = await this.keepPictures(userId, files, origin);
      const cut: VideoCut = { params, order: story.scenes.map((_, k) => k), scenes: story.scenes.map((sc, k) => ({ url: urls[k], tags: sc.tags, dur: sc.dur })) };
      const out = await this.renderCut(userId, p, s, cut, origin, dir, { files, note: story.note, extra: { mode: 'story', hero, style: story.style, painted, window: win }, replace: false });
      this.log.log(`MV ${id}: done in ${Math.round((Date.now() - t0) / 1000)}s`);
      return out;
    } catch (e) {
      return this.failed(id, e);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  /** R13: the settings of a video made without a spell (the Mars studio's older call): the whole song, as before */
  private legacyParams(): VideoParams {
    return { ...VIDEO_DEFAULTS, length: 'full', captions: false, camera: this.cfg.MV_PARALLAX ? 'parallax' : 'zoom' };
  }

  /** the video is being made (a second one at the same time is refused) */
  private async begin(userId: string, id: string): Promise<Row> {
    const p = await this.row(userId, id);
    if (p.status === 'rendering' && p.updatedAt > new Date(Date.now() - 10 * 60_000)) throw apiError(HttpStatus.CONFLICT, 'BUSY', 'Already making it');
    await this.db.write.update(mvProjects).set({ status: 'rendering', error: null, updatedAt: new Date() }).where(eq(mvProjects.id, id));
    return p;
  }

  private async failed(id: string, e: unknown): Promise<never> {
    this.log.warn(`MV failed: ${String(e).slice(0, 300)}`);
    await this.db.write
      .update(mvProjects)
      .set({ status: 'failed', error: String(e).slice(0, 300), updatedAt: new Date() })
      .where(eq(mvProjects.id, id));
    if (e instanceof HttpException && e.getStatus() < 500 && e.getStatus() !== HttpStatus.UNPROCESSABLE_ENTITY) throw e;
    throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MV_FAILED', 'Could not make the MV');
  }

  /** the hero's picture (the painted ぷにぷに picture, else the NEO look), or null */
  private async heroPicture(userId: string): Promise<Buffer | null> {
    const [u] = await this.db.read.select({ pic: users.puniPicUrl, avatar: users.avatarUrl }).from(users).where(eq(users.id, userId));
    const picUrl = u?.pic ?? u?.avatar ?? null;
    return picUrl ? this.pictureBytes(userId, picUrl) : null;
  }

  /**
   * One picture per scene (still pictures — never a video model): plan A, one picture per scene on Runware (FLUX.2
   * klein 4B by default; Seedream = four per sheet); plan B / unset: our GPU (else Qwen) via the key artist. One seed
   * per video keeps the look together.
   */
  private async paint(captions: string[], picture: Buffer | null, hero: string, id: string): Promise<(Buffer | null)[]> {
    const seed = Math.floor(Math.random() * 2 ** 31);
    if (this.sheets) this.sheets.lastCostUsd = 0;
    const drawn = this.sheets
      ? this.cfg.MV_PAINTER === 'seedream'
        ? await seedreamSheets(this.sheets, captions.map((caption) => ({ caption })), picture)
        : await paintScenes(this.sheets, captions.map((caption) => ({ caption })), picture, PAINTERS[this.cfg.MV_PAINTER], hero)
      : await this.keyArtist.paintAll(
          captions.map((tags) => ({ tags, hero: true })),
          seed,
          this.cfg.MV_PAINT_PARALLEL,
          { reference: picture, refScale: this.cfg.MV_HERO_REF, heroIsHuman: isHuman(hero) },
        );
    if (this.sheets) this.log.log(`MV ${id}: plan A paint cost ${Math.round(this.sheets.lastCostUsd * 150)} yen`);
    return drawn;
  }

  /** the pictures kept as the member's own images (one each, a picture shown twice kept once) */
  private async keepPictures(userId: string, files: string[], origin: string): Promise<string[]> {
    const seen = new Map<string, string>();
    const out: string[] = [];
    for (const f of files) {
      if (!seen.has(f)) {
        const webp = await sharp(await readFile(f)).resize(1024, 1024, { fit: 'inside' }).webp({ quality: 88 }).toBuffer();
        seen.set(f, (await this.media.storeGenerated(userId, 'image', 'image/webp', webp, origin)).url);
      }
      out.push(seen.get(f)!);
    }
    return out;
  }

  /** the member's own pictures for a video: the project's photos, else the newest pictures in Bluena (Jupiter) */
  async ownPictures(userId: string, id: string, n: number): Promise<string[]> {
    const p = await this.row(userId, id);
    const mats = (p.materialsJson as unknown as MvMaterial[]).filter((m) => m.kind === 'photo').map((m) => m.url);
    if (mats.length) return mats.slice(0, 16);
    const rows = await this.db.read
      .select({ url: jupiterRoots.url })
      .from(jupiterRoots)
      .where(and(eq(jupiterRoots.userId, userId), eq(jupiterRoots.kind, 'photo'), isNull(jupiterRoots.deletedAt)))
      .orderBy(desc(jupiterRoots.createdAt))
      .limit(Math.max(2, Math.min(16, n)));
    return rows.map((r) => r.url).reverse();
  }

  /**
   * R13: a video of the member's own pictures (their art in Bluena, their photos): nothing painted, the pictures only
   * move — CPU only, so it costs little (MAKE_COST.mvPictures).
   */
  async pictures(userId: string, id: string, origin: string, tags: SpellTag[]): Promise<MvProjectView> {
    return timed('cpu', 'mv:pictures', () => this.picturesOnCpu(userId, id, origin, tags));
  }

  private async picturesOnCpu(userId: string, id: string, origin: string, tags: SpellTag[]): Promise<MvProjectView> {
    const params = videoParams(tags);
    const urls = await this.ownPictures(userId, id, params.scenes);
    if (!urls.length) throw apiError(HttpStatus.BAD_REQUEST, 'NO_PICTURES', 'No pictures to move yet');
    const p = await this.begin(userId, id);
    const s = await this.song(userId, p.songId);
    const dir = await mkdtemp(join(tmpdir(), 'obolo-mvp-'));
    try {
      const cut: VideoCut = { params, order: urls.map((_, k) => k), scenes: urls.map((url) => ({ url, dur: 1 })) };
      return await this.renderCut(userId, p, s, cut, origin, dir, { note: 'きみの絵を、そのまま動かしたよ。', extra: { mode: 'pictures' }, replace: false });
    } catch (e) {
      return this.failed(id, e);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private cutOf(p: Row): VideoCut {
    const cut = (p.planJson as { cut?: VideoCut } | null)?.cut;
    if (!cut?.scenes?.length) throw apiError(HttpStatus.BAD_REQUEST, 'NO_CUT', 'This video cannot be changed by words');
    return cut;
  }

  /**
   * R13: a free change after it is made — how the pictures move (camera, pace, fades, lyrics, order, a scene cut out,
   * the length, the part of the song, the colours). Re-rendered on the CPU from the kept pictures: no new picture, no mana.
   */
  async edit(userId: string, id: string, origin: string, body: MvEditBody): Promise<MvProjectView> {
    return timed('cpu', 'mv:edit', () => this.editOnCpu(userId, id, origin, body));
  }

  private async editOnCpu(userId: string, id: string, origin: string, body: MvEditBody): Promise<MvProjectView> {
    const p0 = await this.row(userId, id);
    const cut = this.cutOf(p0);
    const order = [...new Set(body.order.filter((k) => k >= 0 && k < cut.scenes.length))];
    if (!order.length) throw apiError(HttpStatus.BAD_REQUEST, 'NO_SCENES', 'Keep at least one scene');
    // what it is for, its song and its pictures stay (those are a new video)
    const params: VideoParams = { ...body.params, purpose: cut.params.purpose, songId: cut.params.songId, scenes: cut.params.scenes };
    const p = await this.begin(userId, id);
    const s = await this.song(userId, p.songId);
    const dir = await mkdtemp(join(tmpdir(), 'obolo-mve-'));
    try {
      return await this.renderCut(userId, p, s, { ...cut, params, order }, origin, dir, { note: p.note ?? undefined, replace: true });
    } catch (e) {
      return this.failed(id, e);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  /** R13: some scenes painted again from a small spell (MAKE_COST.mvRedraw), then the video re-rendered */
  async redraw(userId: string, id: string, origin: string, body: { scenes: number[]; spell: SpellTag[] }): Promise<MvProjectView> {
    return timed('cpu', 'mv:redraw', () => this.redrawOnCpu(userId, id, origin, body));
  }

  private async redrawOnCpu(userId: string, id: string, origin: string, body: { scenes: number[]; spell: SpellTag[] }): Promise<MvProjectView> {
    const p0 = await this.row(userId, id);
    const cut = this.cutOf(p0);
    const ks = [...new Set(body.scenes.filter((k) => k >= 0 && k < cut.scenes.length))];
    if (!ks.length) throw apiError(HttpStatus.BAD_REQUEST, 'NO_SCENES', 'Which scene?');
    const p = await this.begin(userId, id);
    const s = await this.song(userId, p.songId);
    const dir = await mkdtemp(join(tmpdir(), 'obolo-mvr-'));
    try {
      const picture = await this.heroPicture(userId);
      const hero = ((p.planJson ?? {}) as { hero?: string }).hero ?? (await describeHero(picture, this.cfg.GEMINI_API_KEY, this.cfg.MV_PLAN_MODEL));
      const look = spellPrompt('video', body.spell);
      const drawn = await this.paint(ks.map((k) => [cut.scenes[k].tags || `solo, ${hero}`, look].join(', ').slice(0, 900)), picture, hero, id);
      if (!drawn.some(Boolean)) throw new Error('nothing painted');
      const scenes = [...cut.scenes];
      for (const [j, k] of ks.entries()) {
        const img = drawn[j];
        if (!img) continue;
        const f = join(dir, `redraw-${k}.jpg`);
        await sharp(img).jpeg({ quality: 92 }).toFile(f);
        const [url] = await this.keepPictures(userId, [f], origin);
        scenes[k] = { ...scenes[k], url, parallax: null };
      }
      return await this.renderCut(userId, p, s, { ...cut, scenes }, origin, dir, { note: p.note ?? undefined, replace: true });
    } catch (e) {
      return this.failed(id, e);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  /** a kept picture's bytes (the member's own file, else fetched) */
  private async sceneBytes(userId: string, url: string): Promise<Buffer | null> {
    const own = await this.media.bytesByUrl(userId, url).catch(() => null);
    if (own) return own;
    const r = await fetch(url, { signal: AbortSignal.timeout(60_000) }).catch(() => null);
    return r?.ok ? Buffer.from(await r.arrayBuffer()) : null;
  }

  /**
   * R13: the video from what it is made of — the window of the song, the pictures in their order, each picture's depth and
   * 2.5D move (kept once chosen), the camera, the fades, the lyric lines, the colour grade — rendered at 720p (ffmpeg,
   * render.ts). The first render and every change use this; `replace` = a change of the same video (its 裏スタジオ entry
   * is updated, not added).
   */
  private async renderCut(
    userId: string,
    p: Row,
    s: SongRow,
    cut0: VideoCut,
    origin: string,
    dir: string,
    o: { files?: (string | null)[]; note?: string; extra?: Record<string, unknown>; replace: boolean },
  ): Promise<MvProjectView> {
    const cut: VideoCut = { ...cut0, scenes: cut0.scenes.map((x) => ({ ...x })) };
    const all = this.lyricLines(s);
    const win = videoWindow(cut.params, s.seconds, all);
    const lyr = windowLyrics(all, win.start, win.seconds);
    const bpm = Number((s.designJson as { bpm?: number }).bpm) || 100;
    const audioBytes = await this.media.bytesByUrl(userId, s.mixUrl);
    if (!audioBytes) throw new Error('song audio unavailable');
    const audio = join(dir, 'song.m4a');
    await writeFile(audio, audioBytes);
    // the pictures as files (painted just now, else the kept ones)
    const files: (string | null)[] = await Promise.all(
      cut.scenes.map(async (sc, k) => {
        if (o.files?.[k]) return o.files[k];
        const bytes = await this.sceneBytes(userId, sc.url);
        if (!bytes) return null;
        const f = join(dir, `kept-${k}.jpg`);
        await sharp(bytes).rotate().flatten({ background: '#000000' }).resize(1024, 1024, { fit: 'inside' }).jpeg({ quality: 92 }).toFile(f);
        return f;
      }),
    );
    const usable = cut.order.filter((k) => files[k]);
    if (!usable.length) throw new Error('pictures unavailable');
    const { plan, shown } = cutPlan({ ...cut, order: usable }, { seconds: win.seconds, bpm, lyrics: lyr.map((l) => ({ t: l.t, text: l.text, chorus: l.chorus })), note: o.note });
    // 2.5D: the depth of each picture shown (CPU) and its move (chosen once, then kept); without them: Ken Burns
    let moves: ((Parallax & { focus: number; depth: string }) | null)[] = shown.map(() => null);
    if (usesDepth(cut.params) && this.cfg.MV_PARALLAX) {
      const known = shown.map((k, j) => {
        const pr = cut.scenes[k].parallax;
        const fly = cut.params.camera === 'fly' ? FLY_MOVES[j % FLY_MOVES.length] : null;
        return pr ? { ...(pr as Parallax), ...(fly ? { move: fly } : {}) } : null;
      });
      moves = await addParallax(
        shown.map((k) => files[k]),
        shown.map((k) => cut.scenes[k].tags ?? ''),
        this.depth,
        { key: this.cfg.GEMINI_API_KEY, model: this.cfg.MV_PLAN_MODEL },
        known,
      ).catch((e) => {
        this.log.warn(`MV ${p.id}: parallax skipped: ${String(e).slice(0, 200)}`);
        return shown.map(() => null);
      });
      shown.forEach((k, j) => {
        const mv = moves[j];
        if (!mv) return;
        if (cut.params.camera === 'fly') mv.move = FLY_MOVES[j % FLY_MOVES.length];
        cut.scenes[k].parallax = { move: mv.move, fx: mv.fx, fy: mv.fy, strength: mv.strength };
      });
    }
    const materials = shown.map((k, j) => ({ kind: 'photo' as const, file: files[k]!, depth: moves[j]?.depth ?? null, parallax: moves[j] ?? null }));
    const out = await renderMv({ dir, materials, plan, audio, seconds: win.seconds, bpm, keyArtist: this.keyArtist, painted: true, audioStart: win.start, grade: cut.params.grade });
    // the lyric lines on screen (their effects from the plan: calm verses, big chorus — or as asked)
    const final = cut.params.captions && lyr.length ? await burnLyrics(dir, out.video, lyr.map((l, i) => ({ t: l.t, end: l.end, text: l.text, effect: plan.lyrics[i] ?? 'MINIMAL_CHILL' }))) : out.video;
    const v = await this.media.storeGenerated(userId, 'video', 'video/mp4', await readFile(final), origin);
    const poster = await this.media.storeGenerated(userId, 'poster', 'image/webp', await readFile(out.poster), origin);
    const info = await probe(final);
    const title = `${s.title}（MV）`.slice(0, 40);
    let backstageId = p.backstageId;
    if (o.replace && backstageId) {
      // a change of the same video: its 裏スタジオ entry shows the new one
      await this.db.write.update(marsBackstage).set({ mediaId: v.id, url: v.url, posterUrl: poster.url, seconds: info.seconds, updatedAt: new Date() }).where(and(eq(marsBackstage.id, backstageId), eq(marsBackstage.userId, userId)));
    } else {
      const [b] = await this.db.write.insert(marsBackstage).values({ userId, mediaId: v.id, url: v.url, posterUrl: poster.url, seconds: info.seconds, title }).returning();
      backstageId = b.id;
    }
    const before = (p.planJson ?? {}) as Record<string, unknown>;
    const [up] = await this.db.write
      .update(mvProjects)
      .set({
        status: 'done',
        planJson: { ...before, ...o.extra, segments: plan.segments, lyrics: plan.lyrics, cut } as never,
        videoUrl: v.url,
        lyricsVideoUrl: cut.params.captions && lyr.length ? v.url : null,
        posterUrl: poster.url,
        seconds: info.seconds,
        note: plan.note || p.note,
        backstageId,
        updatedAt: new Date(),
      })
      .where(eq(mvProjects.id, p.id))
      .returning();
    // story 2026-11-27: a repainted scene / a changed cut — the MV flown before shows this film on Mars
    await followMv(this.db, userId, { backstageId: p.backstageId, urls: [p.videoUrl, p.lyricsVideoUrl] }, { backstageId, url: v.url, posterUrl: poster.url, seconds: info.seconds });
    return this.view(up);
  }

  /** The profile picture as PNG (on a white card if it is see-through), or null. */
  private async pictureBytes(userId: string, url: string): Promise<Buffer | null> {
    try {
      const own = await this.media.bytesByUrl(userId, url);
      const raw = own ?? (await fetch(url, { signal: AbortSignal.timeout(30_000) }).then(async (r) => (r.ok ? Buffer.from(await r.arrayBuffer()) : null)));
      if (!raw) return null;
      return await sharp(raw).flatten({ background: '#ffffff' }).resize(512, 512, { fit: 'inside' }).png().toBuffer();
    } catch {
      return null;
    }
  }

  /** A plain title card (only if not a single scene could be painted). */
  private async plainCard(dir: string, title: string) {
    const file = join(dir, 'card.jpg');
    const esc = title.replace(/[<>&"]/g, '');
    await sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1458"/><stop offset="1" stop-color="#e0559a"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/><text x="512" y="540" font-size="72" fill="#fff" text-anchor="middle" font-family="Noto Sans CJK JP, sans-serif">${esc}</text></svg>`,
      ),
    )
      .jpeg()
      .toFile(file);
    return file;
  }

  /** The same MV with the lyric lines on it (the picture is not edited again). */
  async withLyrics(userId: string, id: string, origin: string): Promise<MvProjectView> {
    return timed('cpu', 'mv:lyrics', () => this.withLyricsOnCpu(userId, id, origin));
  }

  private async withLyricsOnCpu(userId: string, id: string, origin: string): Promise<MvProjectView> {
    const p = await this.row(userId, id);
    if (!p.videoUrl) throw apiError(HttpStatus.BAD_REQUEST, 'NO_MV', 'Make the MV first');
    const s = await this.song(userId, p.songId);
    // each line with the text effect Bati chose when making the MV
    const effects = ((p.planJson ?? {}) as Partial<MvPlan>).lyrics ?? [];
    const lines = this.lyricLines(s).map((l, k) => ({ ...l, effect: effects[k] ?? ('MINIMAL_CHILL' as const) }));
    if (!lines.length) throw apiError(HttpStatus.BAD_REQUEST, 'NO_LYRICS', 'This song has no lyrics');
    const dir = await mkdtemp(join(tmpdir(), 'obolo-mvl-'));
    try {
      const bytes = await this.media.bytesByUrl(userId, p.videoUrl);
      if (!bytes) throw new Error('MV unavailable');
      const src = join(dir, 'mv.mp4');
      await writeFile(src, bytes);
      const out = await burnLyrics(dir, src, lines);
      const v = await this.media.storeGenerated(userId, 'video', 'video/mp4', await readFile(out), origin);
      const [b] = await this.db.write
        .insert(marsBackstage)
        .values({ userId, mediaId: v.id, url: v.url, posterUrl: p.posterUrl, seconds: p.seconds, title: `${s.title}（MV・歌詞つき）`.slice(0, 40) })
        .returning();
      const [up] = await this.db.write.update(mvProjects).set({ lyricsVideoUrl: v.url, backstageId: b.id, updatedAt: new Date() }).where(eq(mvProjects.id, id)).returning();
      // story 2026-11-27: the lyrics put on — the MV flown before shows the film with its lyrics on Mars
      await followMv(this.db, userId, { backstageId: p.backstageId, urls: [p.videoUrl, p.lyricsVideoUrl] }, { backstageId: b.id, url: v.url, posterUrl: p.posterUrl, seconds: p.seconds });
      return this.view(up);
    } catch (e) {
      if (e instanceof Error && 'status' in e) throw e;
      this.log.warn(`MV lyrics failed: ${String(e).slice(0, 300)}`);
      throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MV_FAILED', 'Could not put the lyrics on');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
