import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { batiPrompt, butterflyPrompt, stickerArtPrompt, type GeneratedImage, type ImageProvider, type LlmProvider, moderateText, neoFromPhotoPrompt, neoFromReferencePrompt, neoLookPrompt, neoMorePrompt, neoOmakasePrompt, neoWordsPrompt, puniPicPrompt, refineLookPrompt } from '@obolo/ai';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { cutoutWhite } from '../media/cutout';
import { BATI_FACES, type BatiFace, JOURNEY_DONE, type MakeKind, type StickerArtBody, type BatiEggBody, type Me, type NeoLookBody, type NeoLookResult, type PuniPicBody, type PuniPicResult, type RefineLookBody } from '@obolo/shared';
import { eq } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { LedgerService } from '../wallet/ledger.service';
import { buddyProfiles, users } from '../db/schema';
import type { KvStore } from '../infra/kv';
import { IMAGES, KV, LLM, LOOK_IMAGES } from '../infra/tokens';
import { MediaService } from '../media/media.service';
import { toMe } from '../users/users.service';

/**
 * Generations per OBOLO NEO. The story (2026-10-14) lets the visitor redraw "何度でも", so the screen
 * shows no count; PLACEHOLDER (P-OB-18): a hidden ceiling keeps one apprentice's cost bounded
 * (4 images per round, ~¥6 each) — at the ceiling the preset forms are offered.
 */
export const NEO_LOOK_TRIES = 8;
/** One refine (client decision 2026-10-25): four pictures with the request; the hidden ceiling stays generous. */
export const NEO_LOOK_REFINES = 4;
const CANDIDATES = 4;
const TRY_TTL = 60 * 60 * 24 * 60;
/** PLACEHOLDER (P-PUNI-4): picture-character tries per member per day (2 candidates each, ~¥6 per image). */
export const PUNI_PIC_TRIES = 3;
/** PLACEHOLDER (P-JUP-20): Bati's sticker pictures per member per day. */
export const STICKER_ART_TRIES = 8;
const PUNI_PIC_CANDIDATES = 4; // Saturn kororin design (story D04-S005b): four to pick from
let styleSheet: Promise<GeneratedImage> | null = null;
/** The client's reference characters, shown to the model as the style to follow. */
const puniStyle = () => (styleSheet ??= readFile(resolve(__dirname, '../../assets/puni-style.jpg')).then((data) => ({ data, mime: 'image/jpeg' })));
let butterflySheet: Promise<GeneratedImage> | null = null;
/** The client's パタパタ butterflies (cut from the Jupiter mock), the style to follow. */
/** The Bati's prepared body types (client decision 2026-10-25): eight per egg, on flat grey (assets/bati/<egg>-<n>.jpg). */
const BATI_DIR = resolve(__dirname, '../../assets/bati');
const BATI_GREY: [number, number, number] = [128, 128, 128];
const STANDEE_PROMPT =
  'Draw the character of the attached portrait as a full-body standing figure: the same person, face, hair, animal ears, oversized hood and ' +
  'cloak, colours, the round gold-rimmed sunglasses hiding the eyes, and the same semi-real painted style. Standing, facing the viewer, a relaxed ' +
  'friendly pose, the whole figure inside the frame with margin around it, on a perfectly flat plain mid-grey background (#808080) with no floor, ' +
  'no shadow and no other objects. Safe for children. No text, no letters.';
const FACE_WORDS: Record<BatiFace, string> = {
  smile: 'a big happy smile, eyes curved with joy',
  sparkle: 'wide open eyes full of sparkles and stars, excited and curious, leaning forward a little',
  surprise: 'a surprised face, eyes wide and round, mouth a small open "o"',
  think: 'eyes gently closed, thinking hard, a tiny paw or hand near its chin',
  sad: 'a slightly sad, droopy face, eyebrows tilted, mouth a small frown',
  yawn: 'a big sleepy yawn, eyes half closed and drowsy',
};
const BATI_FACE_PROMPT = (f: BatiFace) =>
  `Edit the first picture: keep the same creature exactly — the same body, colours, materials, size, framing, light and the flat plain mid-grey background (#808080) — and change only its expression to ${FACE_WORDS[f]}. A small natural change of pose that fits the expression is fine. Cute, kids-friendly. No text, no letters.`;
const butterflyStyle = () => (butterflySheet ??= readFile(resolve(__dirname, '../../assets/butterfly-style.jpg')).then((data) => ({ data, mime: 'image/jpeg' })));

/**
 * Day 2 on the Moon: generate the visitor's OBOLO NEO look (questions / own words or a picture /
 * おまかせ / more like one of the candidates) and let them choose one. Then the Bati is born from their
 * favourite food (image generated) and named, the same day. If image generation fails the client falls back to the preset forms /
 * an emoji Bati, so the journey never stops.
 */
/**
 * n pictures painted side by side; the ones that failed are painted once more (the painter drops one now and then:
 * the smoke test of 2026-10-28 got 2 of 4 looks once), so a visitor nearly always sees the whole set.
 */
async function settleWithRetry<T>(n: number, paint: (i: number) => Promise<T>): Promise<PromiseSettledResult<T>[]> {
  const first = await Promise.allSettled(Array.from({ length: n }, (_, i) => paint(i)));
  return Promise.all(first.map((r, i) => (r.status === 'fulfilled' ? r : Promise.allSettled([paint(i)]).then(([again]) => again))));
}

@Injectable()
export class LookService {
  private readonly log = new Logger('Look');
  constructor(
    private readonly db: Database,
    private readonly media: MediaService,
    @Inject(IMAGES) private readonly images: ImageProvider,
    /** the looks and the Bati: Seedream (client decision 2026-10-25) */
    @Inject(LOOK_IMAGES) private readonly looks: ImageProvider,
    @Inject(LLM) private readonly llm: LlmProvider,
    @Inject(KV) private readonly kv: KvStore,
    private readonly ledger: LedgerService,
  ) {}

  /** mana for a making (M-R132); admins (unlimited) make for free. Returns the refund for a failed making. */
  private async fee(userId: string, kind: MakeKind, unlimited: boolean) {
    return unlimited ? { refund: async () => undefined } : this.ledger.charge(this.db, userId, kind);
  }

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
    const words =
      'reference' in body ? `${body.liked ?? ''} ${body.twist ?? ''}` : 'words' in body ? body.words : 'animal' in body ? `${body.animal} ${body.color} ${body.mood} ${body.hobby ?? ''}` : '';
    if (words.trim()) await this.clean(words);
    // the reference image is only handed to the model, never stored (copyright, client decision 2026-10-05)
    const refs: GeneratedImage[] = [];
    if ('reference' in body) refs.push({ data: Buffer.from(body.reference.data, 'base64'), mime: body.reference.mime });
    // the favourite photo of themselves (M-R148): handed to the painter only, never stored
    if ('animal' in body && body.photo) refs.push({ data: Buffer.from(body.photo.data, 'base64'), mime: body.photo.mime });
    if ('like' in body) {
      const src = await this.media.imageData(userId, body.like, 'avatar');
      if (!src) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Image not found');
      refs.push(src);
    }
    const key = `look:tries:${userId}`;
    const round = Number((await this.kv.get(key)) ?? 0);
    const prompt = (i: number) =>
      'reference' in body
        ? neoFromReferencePrompt(body, i)
        : 'words' in body
          ? neoWordsPrompt(body.words, i, round)
          : 'like' in body
            ? neoMorePrompt(i)
            : 'omakase' in body
              ? neoOmakasePrompt(i, round)
              : body.photo
                ? neoFromPhotoPrompt(body, i)
                : neoLookPrompt(body, i, round);
    const limited = u.journeyDay < JOURNEY_DONE && !unlimited;
    const used = Number((await this.kv.get(key)) ?? 0);
    if (limited && used >= NEO_LOOK_TRIES) throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'LOOK_TRIES', 'もう作り直せません');
    const fee = await this.fee(userId, 'look', unlimited);
    const tries = await this.kv.incr(key, TRY_TTL);

    const made = await settleWithRetry(CANDIDATES, (i) => this.looks.generate(prompt(i), i, refs));
    if (!made.some((r) => r.status === 'fulfilled')) await fee.refund();
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

  /** The one refine: the chosen candidate + what to change → four versions to decide from. */
  async refine(userId: string, body: RefineLookBody, origin: string, unlimited = false): Promise<NeoLookResult> {
    const u = await this.user(userId);
    await this.clean(body.instruction);
    const limited = u.journeyDay < JOURNEY_DONE && !unlimited;
    if (limited && (await this.refinesLeft(userId, true)) <= 0) throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'LOOK_REFINES', 'もう描き直せません');
    const src = body.mediaId ? await this.media.imageData(userId, body.mediaId, 'avatar') : await this.current(userId, u.avatarUrl);
    if (!src) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Image not found');
    const fee = await this.fee(userId, 'look', unlimited);
    await this.kv.incr(`look:refine:${userId}`, TRY_TTL);
    const made = await settleWithRetry(CANDIDATES, (i) => this.looks.generate(refineLookPrompt(body.instruction, i), i, [src]));
    if (!made.some((r) => r.status === 'fulfilled')) await fee.refund();
    const candidates = [];
    for (const r of made) {
      if (r.status === 'fulfilled') {
        const m = await this.media.storeImage(userId, 'avatar', r.value.mime, r.value.data, origin);
        candidates.push({ id: m.id, url: m.url });
      } else this.log.warn(`look refine failed: ${String(r.reason)}`);
    }
    const tries = Number((await this.kv.get(`look:tries:${userId}`)) ?? 0);
    return { candidates, triesLeft: limited ? Math.max(0, NEO_LOOK_TRIES - tries) : 99, refinesLeft: await this.refinesLeft(userId, limited) };
  }

  /**
   * The NEO look standing, without a background (M-R149): the chosen portrait painted again as a full figure on
   * grey, then cut out — shown big when the look is chosen and while they speak. Once per look (a new look draws a
   * new one); part of the look, no mana.
   */
  async standee(userId: string, origin: string): Promise<Me> {
    const u = await this.user(userId);
    if (!u.avatarUrl) throw apiError(HttpStatus.CONFLICT, 'NO_LOOK', 'No look yet');
    const j = (u.onboardingJson ?? {}) as Record<string, string>;
    if (j['look.standee'] && j['look.standee.of'] === u.avatarUrl) return toMe(u);
    const src = await this.current(userId, u.avatarUrl);
    if (!src) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Look not found');
    const img = await this.looks.generate(STANDEE_PROMPT, 0, [src]);
    const cut = await cutoutWhite(img.data, 1024, BATI_GREY).catch(() => null);
    const m = cut ? await this.media.storeImage(userId, 'avatar', 'image/png', cut, origin) : await this.media.storeImage(userId, 'avatar', img.mime, img.data, origin);
    const cur = ((await this.user(userId)).onboardingJson ?? {}) as Record<string, string>;
    const [nu] = await this.db.write
      .update(users)
      .set({ onboardingJson: { ...cur, 'look.standee': m.url, 'look.standee.of': u.avatarUrl }, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return toMe(nu);
  }

  /** the look worn now, as a picture to change */
  private async current(userId: string, url: string | null): Promise<{ data: Buffer; mime: string } | null> {
    const data = url ? await this.media.bytesByUrl(userId, url) : null;
    if (!data) return null;
    const mime = data[0] === 0x89 ? 'image/png' : data[0] === 0xff ? 'image/jpeg' : 'image/webp';
    return { data, mime };
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
  async puniPicCandidates(userId: string, body: PuniPicBody, origin: string, unlimited = false, kind: 'puni' | 'butterfly' = 'puni'): Promise<PuniPicResult> {
    const u = await this.user(userId);
    await this.clean(body.description);
    const key = kind === 'butterfly' ? `${this.puniKey(userId)}:bf` : this.puniKey(userId);
    const used = Number((await this.kv.get(key)) ?? 0);
    if (!unlimited && used >= PUNI_PIC_TRIES) throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'PUNI_PIC_TRIES', '今日はもう作れません');
    const tries = await this.kv.incr(key, 60 * 60 * 26);
    // the inspiration picture is only handed to the model, never stored
    let reference: GeneratedImage | null = body.reference ? { data: Buffer.from(body.reference.data, 'base64'), mime: body.reference.mime } : null;
    const from = !reference && body.useSaturnPic && u.puniPicUrl ? u.puniPicUrl : !reference && body.useNeoLook ? u.avatarUrl : null;
    if (from) {
      const res = await fetch(from, { signal: AbortSignal.timeout(20_000) }).catch(() => null);
      if (res?.ok) reference = { data: Buffer.from(await res.arrayBuffer()), mime: res.headers.get('content-type') ?? 'image/png' };
    }
    const refs = [kind === 'butterfly' ? await butterflyStyle() : await puniStyle(), ...(reference ? [reference] : [])];
    // the kororin design costs mana (3, M-R132)
    const fee = kind === 'puni' ? await this.fee(userId, 'kororinDesign', unlimited) : { refund: async () => undefined };
    const prompt = kind === 'butterfly' ? butterflyPrompt : puniPicPrompt;
    const made = await settleWithRetry(kind === 'butterfly' ? 2 : PUNI_PIC_CANDIDATES, (i) => this.images.generate(prompt(body.description, !!reference, i), i, refs));
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
    if (!candidates.length) await fee.refund();
    return { candidates, left: unlimited ? 99 : Math.max(0, PUNI_PIC_TRIES - tries) };
  }

  /**
   * Jupiter (first journey): Bati draws a sticker's picture from its words. PLACEHOLDER (P-JUP-20): a few a
   * day per member (~¥6 each); the mana gem's glow is not wired to it yet.
   */
  async stickerArt(userId: string, body: StickerArtBody, origin: string, unlimited = false): Promise<{ id: string; url: string }> {
    await this.clean(body.text);
    const key = `${this.puniKey(userId)}:sticker`;
    const used = Number((await this.kv.get(key)) ?? 0);
    if (!unlimited && used >= STICKER_ART_TRIES) throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'STICKER_TRIES', '今日はもう描けません');
    await this.kv.incr(key, 60 * 60 * 26);
    // {bati}'s jacket picture costs mana (3); photos and words-only jackets never come here
    const fee = await this.fee(userId, 'jacketArt', unlimited);
    try {
      const img = await this.images.generate(stickerArtPrompt(body.text), 0, []);
      const m = await this.media.storeImage(userId, 'avatar', img.mime, img.data, origin);
      return { id: m.id, url: m.url };
    } catch (e) {
      await fee.refund();
      throw e;
    }
  }

  /** Pick one of your painted candidates as your Jupiter butterfly (null = back to the default). */
  async chooseButterfly(userId: string, mediaId: string | null): Promise<Me> {
    let url: string | null = null;
    if (mediaId) {
      const m = await this.media.getOwned(userId, mediaId, 'avatar');
      if (!m) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Image not found');
      url = m.url;
    }
    const [u] = await this.db.write.update(users).set({ butterflyUrl: url, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    return toMe(u);
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
    // which egg: its body types (kept beside the account until the hatching)
    await this.kv.set(`bati:egg:${userId}`, body.egg ?? 'sun', TRY_TTL);
    return toMe(u);
  }

  /** Day 4: the egg hatches — the Bati image is generated now (the client plays the hatching meanwhile). */
  async hatch(userId: string, origin: string): Promise<Me> {
    const u = await this.user(userId);
    if (!u.batiFood) throw apiError(HttpStatus.CONFLICT, 'NO_EGG', 'No egg yet');
    if (u.batiImageUrl) return toMe(u);
    try {
      const body = await this.batiBody((await this.kv.get(`bati:egg:${userId}`)) ?? 'sun');
      const img = await this.looks.generate(batiPrompt(u.batiFood, !!body), 0, body ? [body] : []);
      // painted on the body's flat grey: cut out, so the Bati stands on the stage like the others
      const png = body ? await cutoutWhite(img.data, 768, BATI_GREY).catch(() => null) : null;
      const m = png ? await this.media.storeImage(userId, 'bati', 'image/png', png, origin) : await this.media.storeImage(userId, 'bati', img.mime, img.data, origin);
      const [nu] = await this.db.write.update(users).set({ batiImageUrl: m.url, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
      return toMe(nu);
    } catch (e) {
      this.log.warn(`bati generation failed: ${String(e)}`);
      return toMe(u);
    }
  }

  /** One of the egg's eight body types, at random (none on disk → null, the free drawing). */
  private async batiBody(egg: string): Promise<GeneratedImage | null> {
    const files = (await readdir(BATI_DIR).catch(() => [] as string[])).filter((f) => f.startsWith(`${egg === 'earth' ? 'moon' : 'sun'}-`));
    if (!files.length) return null;
    const f = files[Math.floor(Math.random() * files.length)];
    return { data: await readFile(resolve(BATI_DIR, f)), mime: 'image/jpeg' };
  }

  /**
   * Bati's expressions (M-R139): the hatched picture, put back on its grey, edited into each face — the same
   * creature, only the face and a little of the pose change; cut out like the hatched one. Once per Bati, no mana
   * (part of the hatching). Faces that fail are left out (the plain picture stands in).
   */
  async batiFaces(userId: string, origin: string): Promise<Me> {
    const u = await this.user(userId);
    if (!u.batiImageUrl) throw apiError(HttpStatus.CONFLICT, 'NO_BATI', 'Not hatched yet');
    const have = (() => {
      try {
        return JSON.parse((u.onboardingJson as Record<string, string>)?.['bati.faces'] ?? '{}') as Record<string, string>;
      } catch {
        return {} as Record<string, string>;
      }
    })();
    const todo = BATI_FACES.filter((f) => !have[f]);
    if (!todo.length) return toMe(u);
    const png = await this.media.bytesByUrl(userId, u.batiImageUrl);
    if (!png) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Bati picture not found');
    const ref = { data: await sharp(png).flatten({ background: { r: 128, g: 128, b: 128 } }).jpeg({ quality: 92 }).toBuffer(), mime: 'image/jpeg' };
    const made = await settleWithRetry(todo.length, (i) => this.looks.generate(BATI_FACE_PROMPT(todo[i]), i, [ref]));
    const faces = { ...have };
    for (const [i, r] of made.entries()) {
      if (r.status !== 'fulfilled') {
        this.log.warn(`bati face ${todo[i]} failed: ${String(r.reason)}`);
        continue;
      }
      const cut = await cutoutWhite(r.value.data, 768, BATI_GREY).catch(() => null);
      const m = cut ? await this.media.storeImage(userId, 'bati', 'image/png', cut, origin) : await this.media.storeImage(userId, 'bati', r.value.mime, r.value.data, origin);
      faces[todo[i]] = m.url;
    }
    const cur = (await this.user(userId)).onboardingJson as Record<string, string>;
    const [nu] = await this.db.write
      .update(users)
      .set({ onboardingJson: { ...cur, 'bati.faces': JSON.stringify(faces) }, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return toMe(nu);
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
