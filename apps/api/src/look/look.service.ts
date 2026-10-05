import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { batiPrompt, type ImageProvider, type LlmProvider, moderateText, neoLookPrompt } from '@obolo/ai';
import { JOURNEY_DONE, type BatiEggBody, type Me, type NeoLookBody, type NeoLookResult } from '@obolo/shared';
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
const CANDIDATES = 4;
const TRY_TTL = 60 * 60 * 24 * 60;

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

  async candidates(userId: string, body: NeoLookBody, origin: string): Promise<NeoLookResult> {
    const u = await this.user(userId);
    await this.clean(`${body.animal} ${body.color} ${body.mood}`);
    const key = `look:tries:${userId}`;
    const limited = u.journeyDay < JOURNEY_DONE;
    const used = Number((await this.kv.get(key)) ?? 0);
    if (limited && used >= NEO_LOOK_TRIES) throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'LOOK_TRIES', 'もう作り直せません');
    const tries = await this.kv.incr(key, TRY_TTL);

    const made = await Promise.allSettled(
      Array.from({ length: CANDIDATES }, (_, i) => this.images.generate(neoLookPrompt(body, i), i)),
    );
    const candidates = [];
    for (const r of made) {
      if (r.status === 'fulfilled') {
        const m = await this.media.storeImage(userId, 'avatar', r.value.mime, r.value.data, origin);
        candidates.push({ id: m.id, url: m.url });
      } else this.log.warn(`look generation failed: ${String(r.reason)}`);
    }
    return { candidates, triesLeft: limited ? Math.max(0, NEO_LOOK_TRIES - tries) : 99 };
  }

  async choose(userId: string, mediaId: string): Promise<Me> {
    const m = await this.media.getOwned(userId, mediaId, 'avatar');
    if (!m) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Image not found');
    const [u] = await this.db.write.update(users).set({ avatarUrl: m.url, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
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
