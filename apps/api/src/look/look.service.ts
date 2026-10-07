import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { batiPrompt, type GeneratedImage, type ImageProvider, type LlmProvider, moderateText, neoFromReferencePrompt, neoLookPrompt, puniPicPrompt, refineLookPrompt } from '@obolo/ai';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cutoutWhite } from '../media/cutout';
import { JOURNEY_DONE, type BatiEggBody, type Me, type NeoLookBody, type NeoLookResult, type PuniPicBody, type PuniPicResult, type RefineLookBody } from '@obolo/shared';
import { eq } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { buddyProfiles, users } from '../db/schema';
import type { KvStore } from '../infra/kv';
import { IMAGES, KV, LLM } from '../infra/tokens';
import { MediaService } from '../media/media.service';
import { toMe } from '../users/users.service';

/** Generations per OBOLO NEO (client decision 2026-10-05: 4 candidates, 3 tries). */
export const NEO_LOOK_TRIES = 3;
export const NEO_LOOK_REFINES = 3;
const CANDIDATES = 4;
const TRY_TTL = 60 * 60 * 24 * 60;
/** PLACEHOLDER (P-PUNI-4): picture-character tries per member per day (2 candidates each, ~¥6 per image). */
export const PUNI_PIC_TRIES = 3;
const PUNI_PIC_CANDIDATES = 2;
let styleSheet: Promise<GeneratedImage> | null = null;
/** The client's reference characters, shown to the model as the style to follow. */
const puniStyle = () => (styleSheet ??= readFile(resolve(__dirname, '../../assets/puni-style.jpg')).then((data) => ({ data, mime: 'image/jpeg' })));

/**
 * Day 3: generate the visitor's OBOLO NEO look from three answers and let them choose one.
 * Day 3 → 4: the Bati egg is made from their favourite food; it hatches (image generated) and is
 * named the next morning. If image generation fails the client falls back to the preset forms /
 * an emoji Bati, so the journey never stops.
 */
@Injectable()
export class LookService {
  private readonly log = new Logger('Look');
  constructor(
    private readonly db: Database,
    private readonly media: MediaService,
    @Inject(IMAGES) private readonly images: ImageProvider,
    @Inject(LLM) private readonly llm: LlmProvider,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  private async user(userId: string) {
    const [u] = await this.db.write.select().from(users).where(eq(users.id, userId));
    if (!u) throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'User not found');
    return u;
  }

  private async clean(text: string) {
    const m = await moderateText(text, this.llm);
    if (m.flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MODERATION', 'その言葉は使えません');
  }

  async candidates(userId: string, body: NeoLookBody, origin: string, unlimited = false): Promise<NeoLookResult> {
    const u = await this.user(userId);
    const fromRef = 'reference' in body;
    await this.clean(fromRef ? `${body.liked} ${body.twist}` : `${body.animal} ${body.color} ${body.mood}`);
    // the reference image is only handed to the model, never stored (copyright, client decision 2026-10-05)
    const refs: GeneratedImage[] = fromRef ? [{ data: Buffer.from(body.reference.data, 'base64'), mime: body.reference.mime }] : [];
    const key = `look:tries:${userId}`;
    const limited = u.journeyDay < JOURNEY_DONE && !unlimited;
    const used = Number((await this.kv.get(key)) ?? 0);
    if (limited && used >= NEO_LOOK_TRIES) throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'LOOK_TRIES', 'もう作り直せません');
    const tries = await this.kv.incr(key, TRY_TTL);

    const made = await Promise.allSettled(
      Array.from({ length: CANDIDATES }, (_, i) =>
        this.images.generate(fromRef ? neoFromReferencePrompt(body, i) : neoLookPrompt(body, i), i, refs),
      ),
    );
    const candidates = [];
    for (const r of made) {
      if (r.status === 'fulfilled') {
        const m = await this.media.storeImage(userId, 'avatar', r.value.mime, r.value.data, origin);
        candidates.push({ id: m.id, url: m.url });
      } else this.log.warn(`look generation failed: ${String(r.reason)}`);
    }
    return { candidates, triesLeft: limited ? Math.max(0, NEO_LOOK_TRIES - tries) : 99, refinesLeft: await this.refinesLeft(userId, limited) };
  }

  private async refinesLeft(userId: string, limited: boolean) {
    return limited ? Math.max(0, NEO_LOOK_REFINES - Number((await this.kv.get(`look:refine:${userId}`)) ?? 0)) : 99;
  }

  /** One instruction → one new version of the chosen candidate (3 times per apprentice). */
  async refine(userId: string, body: RefineLookBody, origin: string, unlimited = false): Promise<NeoLookResult> {
    const u = await this.user(userId);
    await this.clean(body.instruction);
    const limited = u.journeyDay < JOURNEY_DONE && !unlimited;
    if (limited && (await this.refinesLeft(userId, true)) <= 0) throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'LOOK_REFINES', 'もう描き直せません');
    const src = await this.media.imageData(userId, body.mediaId, 'avatar');
    if (!src) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Image not found');
    await this.kv.incr(`look:refine:${userId}`, TRY_TTL);
    const candidates = [];
    try {
      const img = await this.images.generate(refineLookPrompt(body.instruction), 0, [src]);
      const m = await this.media.storeImage(userId, 'avatar', img.mime, img.data, origin);
      candidates.push({ id: m.id, url: m.url });
    } catch (e) {
      this.log.warn(`look refine failed: ${String(e)}`);
    }
    const tries = Number((await this.kv.get(`look:tries:${userId}`)) ?? 0);
    return { candidates, triesLeft: limited ? Math.max(0, NEO_LOOK_TRIES - tries) : 99, refinesLeft: await this.refinesLeft(userId, limited) };
  }

  async choose(userId: string, mediaId: string): Promise<Me> {
    const m = await this.media.getOwned(userId, mediaId, 'avatar');
    if (!m) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Image not found');
    const [u] = await this.db.write.update(users).set({ avatarUrl: m.url, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    return toMe(u);
  }

  // --- Saturn picture character -------------------------------------------------------------

  private puniKey(userId: string) {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());
    return `puni:pic:${userId}:${day}`;
  }

  /**
   * Paint round ぷにぷに candidates from a description (+ an optional inspiration picture) in the
   * style of the client's reference characters, cut them out of the white background and store
   * them as transparent PNGs. The member then picks one.
   */
  async puniPicCandidates(userId: string, body: PuniPicBody, origin: string, unlimited = false): Promise<PuniPicResult> {
    const u = await this.user(userId);
    await this.clean(body.description);
    const key = this.puniKey(userId);
    const used = Number((await this.kv.get(key)) ?? 0);
    if (!unlimited && used >= PUNI_PIC_TRIES) throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'PUNI_PIC_TRIES', '今日はもう作れません');
    const tries = await this.kv.incr(key, 60 * 60 * 26);
    // the inspiration picture is only handed to the model, never stored
    let reference: GeneratedImage | null = body.reference ? { data: Buffer.from(body.reference.data, 'base64'), mime: body.reference.mime } : null;
    if (!reference && body.useNeoLook && u.avatarUrl) {
      const res = await fetch(u.avatarUrl, { signal: AbortSignal.timeout(20_000) }).catch(() => null);
      if (res?.ok) reference = { data: Buffer.from(await res.arrayBuffer()), mime: res.headers.get('content-type') ?? 'image/png' };
    }
    const refs = [await puniStyle(), ...(reference ? [reference] : [])];
    const made = await Promise.allSettled(Array.from({ length: PUNI_PIC_CANDIDATES }, (_, i) => this.images.generate(puniPicPrompt(body.description, !!reference, i), i, refs)));
    const candidates = [];
    for (const r of made) {
      if (r.status !== 'fulfilled') {
        this.log.warn(`puni pic generation failed: ${String(r.reason)}`);
        continue;
      }
      try {
        const png = await cutoutWhite(r.value.data);
        const m = await this.media.storeImage(userId, 'avatar', 'image/png', png, origin);
        candidates.push({ id: m.id, url: m.url });
      } catch (e) {
        this.log.warn(`puni pic cutout failed: ${String(e)}`);
      }
    }
    return { candidates, left: unlimited ? 99 : Math.max(0, PUNI_PIC_TRIES - tries) };
  }

  /** Pick one of your candidates as your Saturn character (null = back to the code-drawn look). */
  async choosePuniPic(userId: string, mediaId: string | null): Promise<Me> {
    let url: string | null = null;
    if (mediaId) {
      const m = await this.media.getOwned(userId, mediaId, 'avatar');
      if (!m) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Image not found');
      url = m.url;
    }
    const [u] = await this.db.write.update(users).set({ puniPicUrl: url, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    return toMe(u);
  }

  async egg(userId: string, body: BatiEggBody): Promise<Me> {
    await this.clean(body.food);
    const [u] = await this.db.write
      .update(users)
      .set({ batiFood: body.food, batiImageUrl: null, batiName: null, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return toMe(u);
  }

  /** Day 4: the egg hatches — the Bati image is generated now (the client plays the hatching meanwhile). */
  async hatch(userId: string, origin: string): Promise<Me> {
    const u = await this.user(userId);
    if (!u.batiFood) throw apiError(HttpStatus.CONFLICT, 'NO_EGG', 'No egg yet');
    if (u.batiImageUrl) return toMe(u);
    try {
      const img = await this.images.generate(batiPrompt(u.batiFood));
      const m = await this.media.storeImage(userId, 'bati', img.mime, img.data, origin);
      const [nu] = await this.db.write.update(users).set({ batiImageUrl: m.url, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
      return toMe(nu);
    } catch (e) {
      this.log.warn(`bati generation failed: ${String(e)}`);
      return toMe(u);
    }
  }

  async name(userId: string, name: string): Promise<Me> {
    await this.clean(name);
    const [u] = await this.db.write.update(users).set({ batiName: name, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    await this.db.write
      .insert(buddyProfiles)
      .values({ userId, buddyName: name, personaJson: { cheer: 70, polite: 30, humor: 60 } })
      .onConflictDoUpdate({ target: buddyProfiles.userId, set: { buddyName: name, updatedAt: new Date() } });
    return toMe(u);
  }
}
