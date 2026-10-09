import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { MV_MAX_MATERIALS, MV_MAX_SECONDS, type AddMvMaterialBody, type MvMaterial, type MvProjectView, type SongMix, type SongPhrase } from '@obolo/shared';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { phraseStarts } from '../compose/mix';
import { AppConfig, CONFIG } from '../config';
import { Database } from '../db/db';
import { marsBackstage, mvProjects, songs, users } from '../db/schema';
import { probe, run } from '../media/transcode';
import { MediaService } from '../media/media.service';
import { idToken } from '../compose/music.client';
import { KeyArtist } from './keyart';
import { planMv, type MvPlan } from './plan';
import { burnLyrics, renderMv } from './render';
import { describeHero, planStory, storyToPlan, type StoryPlan } from './storyboard';
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
    const all = s.phrasesJson as unknown as SongPhrase[];
    if (!all.some((p) => p.text?.trim())) return [];
    const bpm = Number((s.designJson as { bpm?: number }).bpm) || 100;
    const mix = s.mixJson as unknown as SongMix;
    const tempo = mix.tempo || 1;
    // every line's start (gaps are per line, so before leaving out the ones without words)
    const starts = phraseStarts(all, bpm, { delayBeats: mix.delayBeats ?? 0, gaps: mix.gaps ?? [] }).map((t) => t / tempo);
    const spb = 60 / bpm;
    return all
      .map((p, i) => ({ p, t: starts[i], next: i + 1 < all.length ? starts[i + 1] : Infinity }))
      .filter(({ p }) => p.text?.trim())
      .map(({ p, t, next }) => ({ t, end: Math.min(next - 0.05, t + (Math.max(p.seconds, p.beats * spb) + 0.4) / tempo), text: p.text.trim(), chorus: p.section === 'chorus' }));
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
   * Story MV (client decision 2026-10-08): no materials — Bati reads the song and the profile picture
   * (the hero), writes a storyboard and every scene is painted as an anime picture (Novita), then
   * edited on the beat. `mood` = what the creator said they want (may be empty: Bati decides).
   */
  async story(userId: string, id: string, origin: string, mood: string): Promise<MvProjectView> {
    const p = await this.row(userId, id);
    if (p.status === 'rendering' && p.updatedAt > new Date(Date.now() - 10 * 60_000)) throw apiError(HttpStatus.CONFLICT, 'BUSY', 'Already making it');
    await this.db.write.update(mvProjects).set({ status: 'rendering', error: null, updatedAt: new Date() }).where(eq(mvProjects.id, id));
    const s = await this.song(userId, p.songId);
    const dir = await mkdtemp(join(tmpdir(), 'obolo-mvs-'));
    try {
      const t0 = Date.now();
      const seconds = Math.min(MV_MAX_SECONDS, s.seconds);
      const audioBytes = await this.media.bytesByUrl(userId, s.mixUrl);
      if (!audioBytes) throw new Error('song audio unavailable');
      const audio = join(dir, 'song.m4a');
      await writeFile(audio, audioBytes);
      // the hero: the painted ぷにぷに picture, else the NEO look
      const [u] = await this.db.read.select({ pic: users.puniPicUrl, avatar: users.avatarUrl }).from(users).where(eq(users.id, userId));
      const picUrl = u?.pic ?? u?.avatar ?? null;
      const picture = picUrl ? await this.pictureBytes(userId, picUrl) : null;
      const hero = await describeHero(picture, this.cfg.GEMINI_API_KEY, this.cfg.MV_PLAN_MODEL);
      const design = s.designJson as { bpm?: number; instrumentalPrompt?: string };
      const bpm = Number(design.bpm) || 100;
      const story: StoryPlan = await planStory(
        {
          title: s.title,
          seconds,
          bpm,
          mood: mood.trim().slice(0, 200),
          music: String(design.instrumentalPrompt ?? '').slice(0, 300),
          lyrics: this.lyricLines(s).map((l) => ({ t: l.t, text: l.text, chorus: l.chorus })),
          hero,
          maxScenes: this.keyArtist.sceneBudget(this.cfg.MV_SCENES, this.cfg.MV_QWEN_SCENES),
        },
        this.cfg.GEMINI_API_KEY,
        this.cfg.MV_PLAN_MODEL,
      );
      // paint every scene (a few at a time); one seed per MV keeps the look together
      const seed = Math.floor(Math.random() * 2 ** 31);
      const pics: (string | null)[] = new Array(story.scenes.length).fill(null);
      let next = 0;
      const worker = async () => {
        while (next < story.scenes.length) {
          const k = next++;
          const img = await this.keyArtist.paint(story.scenes[k].tags, seed + k);
          if (img) {
            pics[k] = join(dir, `scene-${k}.jpg`);
            await sharp(img).jpeg({ quality: 92 }).toFile(pics[k]!);
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(this.cfg.MV_PAINT_PARALLEL, story.scenes.length) }, worker));
      const painted = pics.filter(Boolean).length;
      this.log.log(`MV ${id}: storyboard ${story.scenes.length} scenes, painted ${painted} in ${Math.round((Date.now() - t0) / 1000)}s`);
      // a scene that could not be painted shows its neighbour (or, with nothing painted, a plain card)
      const fallback = pics.find(Boolean) ?? (await this.plainCard(dir, s.title));
      const materials = pics.map((f, k) => ({ kind: 'photo' as const, file: f ?? pics.slice(0, k).reverse().find(Boolean) ?? fallback }));
      const plan = storyToPlan(story);
      const out = await renderMv({ dir, materials, plan, audio, seconds, bpm, keyArtist: this.keyArtist, painted: true });
      const v = await this.media.storeGenerated(userId, 'video', 'video/mp4', await readFile(out.video), origin);
      const poster = await this.media.storeGenerated(userId, 'poster', 'image/webp', await readFile(out.poster), origin);
      const info = await probe(out.video);
      const [b] = await this.db.write
        .insert(marsBackstage)
        .values({ userId, mediaId: v.id, url: v.url, posterUrl: poster.url, seconds: info.seconds, title: `${s.title}（MV）`.slice(0, 40) })
        .returning();
      const [up] = await this.db.write
        .update(mvProjects)
        .set({
          status: 'done',
          planJson: { ...plan, mode: 'story', hero, style: story.style, scenes: story.scenes, painted } as never,
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
      this.log.log(`MV ${id}: done in ${Math.round((Date.now() - t0) / 1000)}s`);
      return this.view(up);
    } catch (e) {
      this.log.warn(`story MV failed: ${String(e).slice(0, 300)}`);
      await this.db.write
        .update(mvProjects)
        .set({ status: 'failed', error: String(e).slice(0, 300), updatedAt: new Date() })
        .where(eq(mvProjects.id, id));
      throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MV_FAILED', 'Could not make the MV');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
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
