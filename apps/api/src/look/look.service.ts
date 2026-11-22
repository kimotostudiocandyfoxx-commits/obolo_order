import { HttpStatus, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { decideBatiPersona, decideBatiWish, moderateLookWish, rewriteBatiLines, withAgeBand, withTouch, batiPrompt, batiRestylePrompt, batiSeedRule, butterflyPrompt, stickerArtPrompt, type GeneratedImage, type ImageProvider, type LlmProvider, moderateText, neoFromPhotoPrompt, neoFromReferencePrompt, neoLookPrompt, neoMorePrompt, neoOmakasePrompt, neoWordsPrompt, kororinPicPrompt, refineLookPrompt } from '@obolo/ai';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { cutoutWhite } from '../media/cutout';
import { ageBand, BATI_SEED_QUESTION, BATI_WISH_REFUSE, batiEggState, BATI_RESTYLE_TOUCHES, LOOK_HISTORY_MAX, BATI_MAX, BATI_SCRIPT_LINES, batiSeedKind, type BatiEggKind, type BatiNewHatchBody, type BatiSpeechBody, BATI_FACES, BATI_MAGIC_PER_DAY, BATI_RESTYLE_PER_DAY, type BatiRestyleResult, type BatiFace, JOURNEY_DONE, type MakeKind, type StickerArtBody, type BatiEggBody, type Me, type NeoLookBody, type NeoLookResult, type PuniPicBody, type PuniPicResult, type RefineLookBody } from '@obolo/shared';
import { eq } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { LedgerService } from '../wallet/ledger.service';
import { buddyProfiles, users } from '../db/schema';
import type { KvStore } from '../infra/kv';
import type { JobQueue } from '../infra/queue';
import { BUDDY_LLM, IMAGES, KV, LLM, LOOK_IMAGES, QUEUE } from '../infra/tokens';
import { activeBati, batiList, columnsOf, keepLook, lookHistory, type BatiRecord } from './batis';
import { MediaService } from '../media/media.service';
import { day9At, toMe } from '../users/users.service';

/**
 * Generations per OBOLO NEO. The story (2026-10-14) lets the visitor redraw "何度でも", so the screen
 * shows no count; PLACEHOLDER (P-OB-18): a hidden ceiling keeps one apprentice's cost bounded
 * (4 images per round, ~¥6 each) — at the ceiling the preset forms are offered.
 */
export const NEO_LOOK_TRIES = 8;
/**
 * The refines (M-R223, D03-S004: 「何度でも。2日目はマナを使わない」): four pictures with the request each time, as often
 * as they like — PLACEHOLDER (P-OB-18): a hidden ceiling keeps the cost bounded.
 */
export const NEO_LOOK_REFINES = 30;
const CANDIDATES = 4;
/** {bati}'s look (M-R223, D03-S008): four cards per round — four touches without a wish, four takes on a wish */
const RESTYLE_CANDIDATES = 4;
const TRY_TTL = 60 * 60 * 24 * 60;
/** the painting's seed kind: a wish (M-R230, the third) is painted like a word */
const paintKind = (k: BatiRecord['seedKind'] | undefined) => (k === 'wish' ? 'word' : (k ?? 'food'));
/** M-R215: why a dress-up wish is refused, in {bati}'s room's words */
const LOOK_REFUSALS: Record<string, string> = {
  real_person: '本当にいる人に、そっくりには、できないんだ',
  other_work: 'ほかの作品のキャラクターに、そっくりには、できないんだ',
  sexual: 'その姿には、できないんだ',
  violent: 'こわい姿や、危ない物は、できないんだ',
};
/** PLACEHOLDER (P-PUNI-4): picture-character tries per member per day (2 candidates each, ~¥6 per image). */
export const PUNI_PIC_TRIES = 3;
/** PLACEHOLDER (P-JUP-20): Bati's sticker pictures per member per day. */
export const STICKER_ART_TRIES = 8;
const PUNI_PIC_CANDIDATES = 4; // Saturn kororin design (story D04-S005b): four to pick from
/** The client's reference characters, shown to the model as the style to follow. */
const kororinStyle = () => (kororinSheet ??= readFile(resolve(__dirname, '../../assets/kororin-style.jpg')).then((data) => ({ data, mime: 'image/jpeg' })));
let butterflySheet: Promise<GeneratedImage> | null = null;
let kororinSheet: Promise<GeneratedImage> | null = null;
/** The client's パタパタ butterflies (cut from the Jupiter mock), the style to follow. */
/** The Bati's prepared body types (client decision 2026-10-25): eight per egg, on flat grey (assets/bati/<egg>-<n>.jpg). */
const BATI_DIR = resolve(__dirname, '../../assets/bati');
const BATI_GREY: [number, number, number] = [128, 128, 128];
const STANDEE_PROMPT =
  'Draw the character of the attached portrait as a full-body standing figure: the same person, face, hair, animal ears, oversized hood and ' +
  'cloak, colours, the round gold-rimmed sunglasses hiding the eyes, and the same semi-real painted style. Standing, facing the viewer, a relaxed ' +
  'friendly pose, the whole figure inside the frame with margin around it, on a perfectly flat plain mid-grey background (#808080) with no floor, ' +
  'no shadow and no other objects. A human body with human legs and shoes or boots: the animal is only in the ears. The hood and cloak reach only to ' +
  'the knees, the head about one sixth of the height, the feet fully visible with empty space below them. Safe for children. No text, no letters.';
// the small chibi NEO (M-R155/M-R161): the Jupiter butterfly, the Uranus owl, the Mercury captain, the Mars pilot, the game hero
const CHIBI_PROMPT =
  'Draw the character of the attached portrait as a small cute chibi figure: a big head and a small round body (about 2.5 heads tall), the same ' +
  'face, hair, animal ears, oversized hood and cloak, colours and the round gold-rimmed sunglasses, simplified and cute, soft painted style. ' +
  'Full body, standing, facing the viewer, both hands a little forward as if holding something, the whole figure inside the frame with margin ' +
  'around it, on a perfectly flat plain mid-grey background (#808080) with no floor, no shadow and no other objects. Safe for children. No text, no letters.';
const FACE_WORDS: Record<BatiFace, string> = {
  smile: 'a big happy smile, eyes curved with joy',
  sparkle: 'wide open eyes with big star-shaped highlights, cheeks glowing, excited and curious, leaning forward a little',
  surprise: 'a surprised face, eyes wide and round, mouth a small open "o"',
  think: 'eyes gently closed, thinking hard, a tiny paw or hand near its chin',
  sad: 'a slightly sad, droopy face, eyebrows tilted, mouth a small frown',
  // test 1, E: "half closed" read as grumpy, with teeth, like an old cat
  yawn: 'a cute sleepy yawn: both eyes fully closed as soft curved lines, a small round open mouth with no teeth, a tiny tear at the corner of one eye, one paw near the mouth, cosy and sweet',
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
  const t0 = Date.now();
  // a picture that failed is painted again at once, without waiting for the others, while a second try still fits in
  // the visitor's wait (the live web still waits 120 s; a picture takes 60-115 s now) — story chat 2026-10-29
  const one = (i: number): Promise<T> => paint(i).catch((e: unknown) => (Date.now() - t0 < 45_000 ? paint(i) : Promise.reject(e)));
  return Promise.allSettled(Array.from({ length: n }, (_, i) => one(i)));
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
    @Inject(QUEUE) private readonly queue: JobQueue,
    /** the Bati chat model (Haiku 5.5): decides a newborn {bati}'s personality (M-R217) */
    @Optional() @Inject(BUDDY_LLM) private readonly buddyLlm?: LlmProvider,
  ) {
    this.queue.register('bati.lines', ({ userId, batiId }) => this.writeLines(userId, batiId));
    this.queue.register('bati.paint', ({ userId, origin }) => this.paintBati(userId, origin).then(() => undefined));
    this.queue.register('bati.repaint', ({ userId, origin }) => this.repaintBati(userId, origin));
    this.queue.register('bati.faces', ({ userId, origin }) => this.batiFaces(userId, origin).then(() => undefined));
  }

  /** mana for a making (M-R132); admins (unlimited) make for free. Returns the refund for a failed making. */
  private async fee(userId: string, kind: MakeKind, unlimited: boolean) {
    return unlimited ? { refund: async () => undefined } : this.ledger.charge(this.db, userId, kind);
  }

  /** the look's mana — none on day 2 (M-R223, D03-S004 「2日目はマナを使わない」) */
  private async lookFee(userId: string, journeyDay: number, unlimited: boolean) {
    return journeyDay <= 2 ? { refund: async () => undefined } : this.fee(userId, 'look', unlimited);
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
    // M-R223: no mana on day 2 (the look is made on the Moon then)
    const fee = await this.lookFee(userId, u.journeyDay, unlimited);
    const tries = await this.kv.incr(key, TRY_TTL);

    // the look for their age band (M-R172; the birth year itself never reaches the painter), in the touch of each of the
    // four (M-R173: two Japanese anime semi-real, two character anime)
    const band = ageBand(Number((u.onboardingJson as Record<string, string> | null)?.birthYear) || null);
    const made = await settleWithRetry(CANDIDATES, (i) => this.looks.generate(withAgeBand(withTouch(prompt(i), i), band), i, refs));
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
    if (body.magic) return this.magic(userId, body, origin, unlimited);
    const u = await this.user(userId);
    await this.clean(body.instruction);
    const limited = u.journeyDay < JOURNEY_DONE && !unlimited;
    if (limited && (await this.refinesLeft(userId, true)) <= 0) throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'LOOK_REFINES', 'もう描き直せません');
    const src = body.mediaId ? await this.media.imageData(userId, body.mediaId, 'avatar') : await this.current(userId, u.avatarUrl);
    if (!src) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Image not found');
    const fee = await this.lookFee(userId, u.journeyDay, unlimited);
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

  /** the day in Japan, for the per-day counters */
  private day() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());
  }

  /**
   * Bati's magic in Bati's room (P-BATI-ROOM): the look worn now (or a candidate of it) changed by the wish, as often as
   * BATI_MAGIC_PER_DAY rounds a day, so the visitor can keep going until they like it. Free during the first journey;
   * after it each round takes the look's mana. `refinesLeft` = the rounds left today.
   */
  private async magic(userId: string, body: RefineLookBody, origin: string, unlimited: boolean): Promise<NeoLookResult> {
    const u = await this.user(userId);
    await this.clean(body.instruction);
    const key = `look:magic:${userId}:${this.day()}`;
    const used = Number((await this.kv.get(key)) ?? 0);
    if (!unlimited && used >= BATI_MAGIC_PER_DAY) throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'LOOK_REFINES', '今日はもう描き直せません');
    const src = body.mediaId ? await this.media.imageData(userId, body.mediaId, 'avatar') : await this.current(userId, u.avatarUrl);
    if (!src) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Image not found');
    const fee = u.journeyDay < JOURNEY_DONE ? { refund: async () => undefined } : await this.fee(userId, 'look', unlimited);
    const n = await this.kv.incr(key, 60 * 60 * 26);
    const made = await settleWithRetry(CANDIDATES, (i) => this.looks.generate(refineLookPrompt(body.instruction, i), i, [src]));
    const candidates = [];
    for (const r of made) {
      if (r.status === 'fulfilled') {
        const m = await this.media.storeImage(userId, 'avatar', r.value.mime, r.value.data, origin);
        candidates.push({ id: m.id, url: m.url });
      } else this.log.warn(`look magic failed: ${String(r.reason)}`);
    }
    if (!candidates.length) await fee.refund();
    const left = unlimited ? 99 : Math.max(0, BATI_MAGIC_PER_DAY - n);
    return { candidates, triesLeft: left, refinesLeft: left };
  }

  /**
   * Bati's room (P-BATI-ROOM): the Bati dressed up / changed a little by the wish — its picture put back on its grey
   * (like the faces), edited three ways and cut out like the hatched one. BATI_RESTYLE_PER_DAY rounds a day; free
   * during the first journey, the look's mana after it.
   */
  async restyle(userId: string, wishOrBody: string | { wish?: string; from?: string }, origin: string, unlimited = false): Promise<BatiRestyleResult> {
    const { wish = '', from } = typeof wishOrBody === 'string' ? { wish: wishOrBody } : wishOrBody;
    const u = await this.user(userId);
    if (!u.batiImageUrl) throw apiError(HttpStatus.CONFLICT, 'NO_BATI', 'Not hatched yet');
    // M-R215: any touch or dress-up, but no real person's or another work's lookalike, nothing sexual or violent
    if (wish.trim()) {
      const m = await moderateLookWish(wish, this.llm);
      if (m.flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MODERATION', LOOK_REFUSALS[m.categories[0]] ?? 'その姿には、できません');
    }
    const key = `bati:restyle:${userId}:${this.day()}`;
    const used = Number((await this.kv.get(key)) ?? 0);
    if (!unlimited && used >= BATI_RESTYLE_PER_DAY) throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'RESTYLE_TRIES', '今日はもう着替えられません');
    // M-R223: the primary reference is the look decided and worn now — or the card tapped just before (`from`), so a
    // wish goes on from what is on the screen
    const tapped = from ? await this.media.getOwned(userId, from, 'bati') : null;
    const png = await this.media.bytesByUrl(userId, tapped?.url ?? u.batiImageUrl);
    if (!png) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Bati picture not found');
    const ref = { data: await sharp(png).flatten({ background: { r: 128, g: 128, b: 128 } }).jpeg({ quality: 92 }).toBuffer(), mime: 'image/jpeg' };
    // the picture it was born with goes along, so the creature does not drift over many dress-ups (M-R215)
    const born = await this.bornRef(userId, u);
    const refs = born ? [ref, born] : [ref];
    const fee = u.journeyDay < JOURNEY_DONE ? { refund: async () => undefined } : await this.fee(userId, 'look', unlimited);
    const n = await this.kv.incr(key, 60 * 60 * 26);
    // M-R223: the seed it was born from (food / sound / word) stays somewhere small in every look
    const r0 = activeBati(u);
    const seed = { seed: r0?.seed || u.batiFood || '', kind: paintKind(r0?.seedKind) };
    const made = await settleWithRetry(RESTYLE_CANDIDATES, (i) => this.looks.generate(batiRestylePrompt(wish, i, !!born, seed), i, refs));
    const candidates = [];
    for (const r of made) {
      if (r.status !== 'fulfilled') {
        this.log.warn(`bati restyle failed: ${String(r.reason)}`);
        continue;
      }
      const cut = await cutoutWhite(r.value.data, 768, BATI_GREY).catch(() => null);
      const m = cut ? await this.media.storeImage(userId, 'bati', 'image/png', cut, origin) : await this.media.storeImage(userId, 'bati', r.value.mime, r.value.data, origin);
      candidates.push({ id: m.id, url: m.url });
    }
    if (!candidates.length) await fee.refund();
    // the touch of each card (no wish): only when all four came, so the labels match the pictures
    const touches = !wish.trim() && candidates.length === RESTYLE_CANDIDATES ? BATI_RESTYLE_TOUCHES.map((t) => t.label) : undefined;
    return { candidates, left: unlimited ? 99 : Math.max(0, BATI_RESTYLE_PER_DAY - n), ...(touches ? { touches } : {}) };
  }

  /** a restyle candidate becomes the Bati picture; its expressions are drawn again in the background (the old ones go) */
  async chooseRestyle(userId: string, id: string, origin: string): Promise<Me> {
    const m = await this.media.getOwned(userId, id, 'bati');
    if (!m) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Image not found');
    const cur = await this.user(userId);
    if (!cur.batiImageUrl) throw apiError(HttpStatus.CONFLICT, 'NO_BATI', 'Not hatched yet');
    if (cur.batiImageUrl === m.url) return toMe(cur);
    return this.wearBati(userId, cur, m.url, origin, true);
  }

  /**
   * M-R223: a {bati} look is worn — a new one decided (added at the end of its looks) or one kept before put back. The
   * look worn until now is noted with its expressions, so putting it back needs no painting; a look without them has
   * them drawn again in the background.
   */
  private async wearBati(userId: string, cur: typeof users.$inferSelect, url: string, origin: string, isNew: boolean): Promise<Me> {
    const r = activeBati(cur);
    const j = { ...((cur.onboardingJson ?? {}) as Record<string, string>) };
    let nowFaces: Record<string, string> | undefined;
    try {
      nowFaces = j['bati.faces'] ? (JSON.parse(j['bati.faces']) as Record<string, string>) : undefined;
    } catch {
      nowFaces = undefined;
    }
    let looks = keepLook(r?.looks, cur.batiImageUrl, nowFaces, LOOK_HISTORY_MAX);
    if (isNew) looks = keepLook(looks, url, undefined, LOOK_HISTORY_MAX);
    const next = looks.find((l) => l.url === url);
    delete j['bati.stand'];
    if (next?.faces && Object.keys(next.faces).length) j['bati.faces'] = JSON.stringify(next.faces);
    else delete j['bati.faces'];
    const list = r ? batiList(cur).map((x) => (x.id === r.id ? { ...x, imageUrl: url, looks, faces: next?.faces } : x)) : cur.batisJson;
    const [nu] = await this.db.write.update(users).set({ batiImageUrl: url, onboardingJson: j, batisJson: list, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    if (!j['bati.faces']) await this.queue.enqueue('bati.faces', { userId, origin }, { dedupeKey: `bati-faces-${userId}-${url}` }).catch(() => undefined);
    return toMe(nu);
  }

  /** M-R223 〔前に戻す〕: the {bati} look decided before the one worn now */
  async restyleBack(userId: string, origin: string): Promise<Me> {
    const cur = await this.user(userId);
    const r = activeBati(cur);
    if (!r || !cur.batiImageUrl) throw apiError(HttpStatus.CONFLICT, 'NO_BATI', 'Not hatched yet');
    const urls = [...new Set([...(r.bornImageUrl ? [r.bornImageUrl] : []), ...(r.looks ?? []).map((l) => l.url)])];
    const at = urls.indexOf(cur.batiImageUrl);
    const prev = at > 0 ? urls[at - 1] : at < 0 ? urls[urls.length - 1] : null;
    if (!prev || prev === cur.batiImageUrl) throw apiError(HttpStatus.CONFLICT, 'NO_PREVIOUS', 'もう前の姿はない');
    return this.wearBati(userId, cur, prev, origin, false);
  }

  /** M-R223: Bluena's first shelf — a {bati} look kept before is worn again (only its own looks) */
  async restoreBati(userId: string, url: string, origin: string): Promise<Me> {
    const cur = await this.user(userId);
    const r = activeBati(cur);
    if (!r || !cur.batiImageUrl) throw apiError(HttpStatus.CONFLICT, 'NO_BATI', 'Not hatched yet');
    if (url === cur.batiImageUrl) return toMe(cur);
    const known = url === r.bornImageUrl || (r.looks ?? []).some((l) => l.url === url);
    if (!known) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not one of its looks');
    if (url === r.bornImageUrl && !(r.looks ?? []).some((l) => l.url === url)) {
      // the birth's look was never noted: it goes in first, so 〔前に戻す〕 keeps its order
      r.looks = [{ url, at: r.createdAt }, ...(r.looks ?? [])];
      await this.saveRecord(userId, r.id, { looks: r.looks });
      return this.wearBati(userId, await this.user(userId), url, origin, false);
    }
    return this.wearBati(userId, cur, url, origin, false);
  }

  /**
   * The NEO look standing, without a background (M-R149): the chosen portrait painted again as a full figure on
   * grey, then cut out — shown big when the look is chosen and while they speak. Once per look (a new look draws a
   * new one); part of the look, no mana.
   */
  async standee(userId: string, origin: string, kind: 'standee' | 'chibi' = 'standee'): Promise<Me> {
    const u = await this.user(userId);
    if (!u.avatarUrl) throw apiError(HttpStatus.CONFLICT, 'NO_LOOK', 'No look yet');
    const j = (u.onboardingJson ?? {}) as Record<string, string>;
    if (j[`look.${kind}`] && j[`look.${kind}.of`] === u.avatarUrl) return toMe(u);
    const src = await this.current(userId, u.avatarUrl);
    if (!src) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Look not found');
    const img = await this.looks.generate(kind === 'chibi' ? CHIBI_PROMPT : STANDEE_PROMPT, 0, [src]);
    const cut = await cutoutWhite(img.data, 1024, BATI_GREY).catch(() => null);
    const m = cut ? await this.media.storeImage(userId, 'avatar', 'image/png', cut, origin) : await this.media.storeImage(userId, 'avatar', img.mime, img.data, origin);
    const cur = ((await this.user(userId)).onboardingJson ?? {}) as Record<string, string>;
    const [nu] = await this.db.write
      .update(users)
      .set({ onboardingJson: { ...cur, [`look.${kind}`]: m.url, [`look.${kind}.of`]: u.avatarUrl }, updatedAt: new Date() })
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

  async choose(userId: string, mediaId: string, origin?: string): Promise<Me> {
    const m = await this.media.getOwned(userId, mediaId, 'avatar');
    if (!m) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Image not found');
    return this.wearLook(userId, m.url, origin, true);
  }

  /**
   * M-R223: the member's own look worn — a new one (added to the looks, onboardingJson 'look.history') or one worn
   * before (Bluena's first shelf). Each look keeps its round icon, so putting one back paints nothing.
   */
  private async wearLook(userId: string, url: string, origin: string | undefined, isNew: boolean): Promise<Me> {
    const before = await this.user(userId);
    const j0 = (before.onboardingJson ?? {}) as Record<string, string>;
    let hist = lookHistory(j0);
    if (before.avatarUrl && !hist.some((h) => h.url === before.avatarUrl)) hist.push({ url: before.avatarUrl, ...(j0['look.icon'] ? { icon: j0['look.icon'] } : {}) });
    hist = hist.map((h) => (h.url === before.avatarUrl && j0['look.icon'] && !h.icon ? { ...h, icon: j0['look.icon'] } : h));
    if (isNew && !hist.some((h) => h.url === url)) hist.push({ url });
    hist = hist.slice(-LOOK_HISTORY_MAX);
    const kept = hist.find((h) => h.url === url);
    const icon = kept?.icon ?? (origin ? await this.roundIcon(userId, url, origin).catch(() => null) : null);
    if (icon) hist = hist.map((h) => (h.url === url ? { ...h, icon } : h));
    const j = { ...((await this.user(userId)).onboardingJson ?? {}) } as Record<string, string>;
    j['look.history'] = JSON.stringify(hist);
    if (icon) j['look.icon'] = icon;
    else delete j['look.icon'];
    const [nu] = await this.db.write.update(users).set({ avatarUrl: url, onboardingJson: j, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    return toMe(nu);
  }

  /** M-R223: a look of one's own worn before is worn again (Bluena's first shelf) */
  async restoreLook(userId: string, url: string, origin?: string): Promise<Me> {
    const u = await this.user(userId);
    if (u.avatarUrl === url) return toMe(u);
    if (!lookHistory((u.onboardingJson ?? {}) as Record<string, string>).some((h) => h.url === url)) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not one of your looks');
    return this.wearLook(userId, url, origin, false);
  }

  /**
   * The round icon (generation test 1, C-3: the "icon" was the square picture itself): the looks are chest-up and
   * centred with the face in the middle, so a square from the top of the hood down past the chin, cut round at 512.
   */
  private async roundIcon(userId: string, url: string, origin: string): Promise<string | null> {
    const data = await this.media.bytesByUrl(userId, url);
    if (!data) return null;
    const { width = 0, height = 0 } = await sharp(data).metadata();
    if (!width || !height) return null;
    const side = Math.round(Math.min(width, height) * 0.86);
    const left = Math.round((width - side) / 2);
    const top = Math.round(Math.max(0, height * 0.02));
    const circle = Buffer.from(`<svg width="512" height="512"><circle cx="256" cy="256" r="256" fill="#fff"/></svg>`);
    const png = await sharp(data)
      .extract({ left, top: Math.min(top, height - side), width: side, height: side })
      .resize(512, 512)
      .composite([{ input: circle, blend: 'dest-in' }])
      .png()
      .toBuffer();
    return (await this.media.storeImage(userId, 'avatar', 'image/png', png, origin)).url;
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
    // Saturn's kororin is a takoyaki (M-R153) painted by Seedream like the looks; Jupiter's butterfly keeps its sheet
    const refs = [kind === 'butterfly' ? await butterflyStyle() : await kororinStyle(), ...(reference ? [reference] : [])];
    // the kororin design costs mana (3, M-R132)
    const fee = kind === 'puni' ? await this.fee(userId, 'kororinDesign', unlimited) : { refund: async () => undefined };
    const prompt = kind === 'butterfly' ? butterflyPrompt : kororinPicPrompt;
    const painter = kind === 'butterfly' ? this.images : this.looks;
    const made = await settleWithRetry(kind === 'butterfly' ? 2 : PUNI_PIC_CANDIDATES, (i) => painter.generate(prompt(body.description, !!reference, i), i, refs));
    const candidates = [];
    for (const r of made) {
      if (r.status !== 'fulfilled') {
        this.log.warn(`puni pic generation failed: ${String(r.reason)}`);
        continue;
      }
      try {
        const png = await cutoutWhite(r.value.data, 512, undefined, kind === 'puni');
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
    await this.clean(`${body.text} ${body.style ?? ''}`);
    const key = `${this.puniKey(userId)}:sticker`;
    const used = Number((await this.kv.get(key)) ?? 0);
    if (!unlimited && used >= STICKER_ART_TRIES) throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'STICKER_TRIES', '今日はもう描けません');
    await this.kv.incr(key, 60 * 60 * 26);
    // {bati}'s jacket picture costs mana (3); photos and words-only jackets never come here
    const fee = await this.fee(userId, 'jacketArt', unlimited);
    try {
      const img = await this.images.generate(stickerArtPrompt(body.text, body.style), 0, []);
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

  /**
   * Day 2 (D03-S005): the favourite food is said — the first {bati}'s seed. Its personality, 一人称 / 呼び方 / 口ぐせ and
   * the card's introduction are decided now from the seed (M-R217, one call to the Bati chat model); an unfit seed is
   * refused (SEED_REASK: OBOLON asks again). The picture is painted meanwhile. Saying it again (a replayed day 2) makes
   * the first {bati} again.
   */
  async egg(userId: string, body: BatiEggBody, origin?: string): Promise<Me> {
    await this.clean(body.food);
    const egg: BatiEggKind = body.egg === 'sun' ? 'sun' : body.egg ? 'moon' : 'sun';
    const cur = await this.user(userId);
    // the first {bati} (again): the list starts over unless more were born since (then only the one in the chat is made again)
    const list = batiList(cur);
    const keep = list.length > 1 ? list.filter((r) => r.id !== cur.batiId) : [];
    // M-R227: never the same style as the member's other {bati}
    // M-R230: a first {bati} (none other yet) comes from the bright group only
    const persona = await decideBatiPersona(this.buddyLlm ?? this.llm, body.food, egg, 'food', { exclude: keep.map((r) => r.personality), first: keep.length === 0 });
    if (!persona) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'SEED_REASK', '、、、食べられるものを、言ってみろ。');
    const rec = this.record(body.food, 'food', egg, persona);
    const [u] = await this.db.write
      .update(users)
      .set({
        batisJson: [...keep, rec],
        batiId: rec.id,
        batiFood: body.food,
        batiImageUrl: null,
        batiName: null,
        // M-R218: the broken shell becomes a small egg; M-R231: it hatches on the app's day 9 (users.bati_egg_at keeps when
        // day 9 opens; set when the first journey ends)
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    // which egg: its body types (kept beside the account until the hatching)
    await this.kv.set(`bati:egg:${userId}`, egg, TRY_TTL);
    if (persona.rare) await this.queue.enqueue('bati.lines', { userId, batiId: rec.id }, { dedupeKey: `bati-lines-${rec.id}` }).catch(() => undefined);
    // painted from now on, while the story goes to the hatching (generation test 1, D': ~120 s at the hatching itself)
    if (origin) {
      await this.kv.set(`bati:painting:${userId}`, String(Date.now()), 600);
      await this.queue.enqueue('bati.paint', { userId, origin }, { dedupeKey: `bati-paint-${userId}-${Date.now()}` }).catch(() => undefined);
    }
    return toMe(u);
  }

  private record(seed: string, seedKind: BatiRecord['seedKind'], egg: BatiEggKind, p: NonNullable<Awaited<ReturnType<typeof decideBatiPersona>>>): BatiRecord {
    return {
      id: randomUUID(),
      name: null,
      egg,
      seed,
      seedKind,
      personality: p.personality,
      self: p.self,
      call: p.call,
      catchphrase: p.catchphrase,
      trait: p.trait,
      intro: p.intro,
      imageUrl: null,
      bornImageUrl: null,
      createdAt: new Date().toISOString(),
      // M-R230: 「ねがいの子」 — its role from the wish (no role question), a made style when none of the seventeen fitted
      ...(seedKind === 'wish' ? { wish: true, role: p.role ?? 'any' } : {}),
      ...(p.custom ? { custom: p.custom } : {}),
    };
  }

  /** a rare {bati}'s fixed story lines, rewritten once at birth (M-R217): one call; failing lines are said as written */
  private async writeLines(userId: string, batiId: string) {
    const u = await this.user(userId);
    const r = batiList(u).find((x) => x.id === batiId);
    if (!r || r.lines) return;
    const lines = await rewriteBatiLines(this.buddyLlm ?? this.llm, { ...r, trait: r.trait ?? '', rare: true, custom: r.custom ?? null }, BATI_SCRIPT_LINES);
    await this.saveRecord(userId, batiId, { lines });
  }

  /** one record changed (the list is read again first: a painting may have landed meanwhile) */
  private async saveRecord(userId: string, id: string, patch: Partial<BatiRecord>) {
    const cur = await this.user(userId);
    const list = (cur.batisJson ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r));
    const [nu] = await this.db.write.update(users).set({ batisJson: list, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    return nu;
  }

  /** the picture the active {bati} was born with, on grey (null = the same as now, or none) */
  private async bornRef(userId: string, u: typeof users.$inferSelect): Promise<GeneratedImage | null> {
    const born = activeBati(u)?.bornImageUrl;
    if (!born || born === u.batiImageUrl) return null;
    const png = await this.media.bytesByUrl(userId, born).catch(() => null);
    if (!png) return null;
    return { data: await sharp(png).flatten({ background: { r: 128, g: 128, b: 128 } }).jpeg({ quality: 92 }).toBuffer(), mime: 'image/jpeg' };
  }

  /**
   * M-R218: the grown egg hatches in the Moon temple — refused before it is ready and once three are born. The seed is
   * the second's favourite sound / the third's word (asked by OBOLON); the personality is decided from it like the food.
   * The new {bati} comes into the chat (the one before keeps everything); the picture is painted (then POST /me/bati/hatch
   * waits for it, and POST /me/bati/name names it).
   */
  async hatchNew(userId: string, body: BatiNewHatchBody, origin?: string): Promise<Me> {
    const u = await this.user(userId);
    const list = batiList(u);
    if (!list.length) throw apiError(HttpStatus.CONFLICT, 'NO_BATI', 'Not hatched yet');
    if (list.length >= BATI_MAX) throw apiError(HttpStatus.CONFLICT, 'BATI_FULL', '相方は、3体まで');
    // M-R231: the 2nd on the app's day 9, the 3rd on day 16
    if (!batiEggState({ born: list.length, journeyDay: u.journeyDay, day9At: day9At(u) })?.ready)
      throw apiError(HttpStatus.CONFLICT, 'EGG_NOT_READY', 'たまごは、まだ育っている');
    const kind = batiSeedKind(list.length);
    const exclude = list.map((r) => r.personality);
    let persona: Awaited<ReturnType<typeof decideBatiPersona>>;
    if (kind === 'wish') {
      // M-R230 §9: 「ねがいの子」 — a lover / sexual role, a real person, another work's character or a role that hurts
      // people is refused (the server's screen, the moderation, then the model's judgement): the first {bati} asks again
      const flagged = (await moderateText(body.seed, this.llm)).flagged;
      persona = flagged ? null : await decideBatiWish(this.buddyLlm ?? this.llm, body.seed, body.egg, { exclude });
      if (!persona) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'WISH_REFUSED', BATI_WISH_REFUSE);
    } else {
      await this.clean(body.seed);
      persona = await decideBatiPersona(this.buddyLlm ?? this.llm, body.seed, body.egg, kind, { exclude });
      if (!persona) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'SEED_REASK', BATI_SEED_QUESTION[kind]);
    }
    const rec = this.record(body.seed, kind, body.egg, persona);
    const j = { ...((u.onboardingJson ?? {}) as Record<string, string>) };
    delete j['bati.faces'];
    delete j['bati.stand'];
    const [nu] = await this.db.write
      .update(users)
      .set({
        batisJson: [...list, rec],
        batiId: rec.id,
        batiFood: body.seed,
        batiImageUrl: null,
        batiName: null,
        onboardingJson: j,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    await this.kv.set(`bati:egg:${userId}`, body.egg, TRY_TTL);
    // a rare or a made style: its story lines rewritten once at birth
    if (persona.rare || persona.custom) await this.queue.enqueue('bati.lines', { userId, batiId: rec.id }, { dedupeKey: `bati-lines-${rec.id}` }).catch(() => undefined);
    if (origin) {
      await this.kv.set(`bati:painting:${userId}`, String(Date.now()), 600);
      await this.queue.enqueue('bati.paint', { userId, origin }, { dedupeKey: `bati-paint-${userId}-${Date.now()}` }).catch(() => undefined);
    }
    return toMe(nu);
  }

  /** M-R215: another of the member's {bati} comes into the chat (by mood); the one before keeps its look and name */
  async switchBati(userId: string, id: string): Promise<Me> {
    const u = await this.user(userId);
    const list = batiList(u);
    const to = list.find((r) => r.id === id);
    if (!to) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'No such bati');
    if (u.batiId === id || (!u.batiId && to.id === 'b1')) return toMe(u);
    if (!to.imageUrl || !to.name) throw apiError(HttpStatus.CONFLICT, 'NOT_BORN', 'Not hatched yet');
    const [nu] = await this.db.write
      .update(users)
      .set({ batisJson: list, ...columnsOf(u, to), updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return toMe(nu);
  }

  /** M-R215: how {bati} calls the member and its 一人称 — the only things that change (null / '' = the birth's) */
  async batiSpeech(userId: string, body: BatiSpeechBody): Promise<Me> {
    const u = await this.user(userId);
    const list = batiList(u);
    const id = body.id ?? u.batiId ?? list[0]?.id;
    const r = list.find((x) => x.id === id);
    if (!r) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'No such bati');
    for (const t of [body.call, body.self]) if (t) await this.clean(t);
    const next = {
      ...r,
      ...(body.call !== undefined ? { callCustom: body.call?.trim() || null } : {}),
      ...(body.self !== undefined ? { selfCustom: body.self?.trim() || null } : {}),
    };
    const [nu] = await this.db.write
      .update(users)
      .set({ batisJson: list.map((x) => (x.id === r.id ? next : x)), updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return toMe(nu);
  }

  /**
   * Day 4: the egg hatches. The picture was started when the food was said (egg); this waits for it (it lands in the
   * database, so any server sees it). Nothing coming within 100 s (the painting server slept, or it failed): painted
   * here. The client plays the hatching meanwhile.
   */
  async hatch(userId: string, origin: string): Promise<Me> {
    const u = await this.user(userId);
    if (!u.batiFood) throw apiError(HttpStatus.CONFLICT, 'NO_EGG', 'No egg yet');
    if (u.batiImageUrl) return toMe(u);
    // waits while the job is still marked as painting (it clears the mark when it ends), at most 240 s: a hatching
    // that gave up at 100 s painted a second Bati while the first was still in line (generation test 2)
    const started = Number((await this.kv.get(`bati:painting:${userId}`)) ?? 0);
    while (started && Date.now() - started < 240_000) {
      await new Promise((r) => setTimeout(r, 2000));
      const now = await this.user(userId);
      if (now.batiImageUrl) return toMe(now);
      if (!(await this.kv.get(`bati:painting:${userId}`))) break;
    }
    return toMe(await this.paintBati(userId, origin));
  }

  /**
   * The Bati picture: painted once more when the painter fails, and when that fails too the egg's body itself (cut
   * out), so a visitor never gets an emoji Bati at the high point of the day (generation test 1, D').
   */
  private async paintBati(userId: string, origin: string) {
    const u = await this.user(userId);
    if (!u.batiFood || u.batiImageUrl) return u;
    const body = await this.batiBody(activeBati(u)?.egg ?? (await this.kv.get(`bati:egg:${userId}`)) ?? 'sun');
    let url: string | null = null;
    for (let k = 0; k < 2 && !url; k++) {
      try {
        const img = await this.looks.generate(batiPrompt(u.batiFood, !!body, paintKind(activeBati(u)?.seedKind)), k, body ? [body] : []);
        // painted on the body's flat grey: cut out, so the Bati stands on the stage like the others
        const png = body ? await cutoutWhite(img.data, 768, BATI_GREY).catch(() => null) : null;
        url = (png ? await this.media.storeImage(userId, 'bati', 'image/png', png, origin) : await this.media.storeImage(userId, 'bati', img.mime, img.data, origin)).url;
      } catch (e) {
        this.log.warn(`bati generation failed (${k + 1}): ${String(e)}`);
      }
    }
    let stand = false;
    if (!url && body) {
      const png = await cutoutWhite(body.data, 768, BATI_GREY).catch(() => null);
      if (png) url = (await this.media.storeImage(userId, 'bati', 'image/png', png, origin)).url;
      stand = !!url;
    }
    await this.kv.del(`bati:painting:${userId}`);
    if (!url) return u;
    // the food changed meanwhile (a new egg): this picture is not theirs any more
    const cur = await this.user(userId);
    if (cur.batiFood !== u.batiFood || cur.batiImageUrl) return cur;
    const j = { ...((cur.onboardingJson ?? {}) as Record<string, string>) };
    if (stand) j['bati.stand'] = '1';
    else delete j['bati.stand'];
    // the picture it is born with is kept on its record (the reference for every later painting, M-R215)
    const list = (cur.batisJson ?? []).map((r) => (r.id === cur.batiId && !stand ? { ...r, imageUrl: url, bornImageUrl: r.bornImageUrl ?? url } : r));
    const [nu] = await this.db.write.update(users).set({ batiImageUrl: url, onboardingJson: j, batisJson: list, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    // the plain body is only a stand-in: painted again in the background
    if (stand) await this.queue.enqueue('bati.repaint', { userId, origin }, { dedupeKey: `bati-repaint-${userId}` }).catch(() => undefined);
    return nu;
  }

  /** the stand-in body replaced by the real picture (a few tries, a minute apart); the faces are made again from it */
  private async repaintBati(userId: string, origin: string) {
    for (let k = 0; k < 3; k++) {
      await new Promise((r) => setTimeout(r, 60_000));
      const u = await this.user(userId);
      if (!u.batiFood || !(u.onboardingJson as Record<string, string> | null)?.['bati.stand']) return;
      const body = await this.batiBody(activeBati(u)?.egg ?? (await this.kv.get(`bati:egg:${userId}`)) ?? 'sun');
      try {
        const img = await this.looks.generate(batiPrompt(u.batiFood, !!body, paintKind(activeBati(u)?.seedKind)), 7 + k, body ? [body] : []);
        const png = body ? await cutoutWhite(img.data, 768, BATI_GREY).catch(() => null) : null;
        const url = (png ? await this.media.storeImage(userId, 'bati', 'image/png', png, origin) : await this.media.storeImage(userId, 'bati', img.mime, img.data, origin)).url;
        const cur = await this.user(userId);
        if (cur.batiFood !== u.batiFood) return;
        const j = { ...((cur.onboardingJson ?? {}) as Record<string, string>) };
        delete j['bati.stand'];
        delete j['bati.faces'];
        const list = (cur.batisJson ?? []).map((r) => (r.id === cur.batiId ? { ...r, imageUrl: url, bornImageUrl: r.bornImageUrl ?? url } : r));
        await this.db.write.update(users).set({ batiImageUrl: url, onboardingJson: j, batisJson: list, updatedAt: new Date() }).where(eq(users.id, userId));
        return;
      } catch (e) {
        this.log.warn(`bati repaint failed (${k + 1}): ${String(e)}`);
      }
    }
  }

  /** One of the egg's eight body types, at random (none on disk → null, the free drawing). */
  private async batiBody(egg: string): Promise<GeneratedImage | null> {
    const files = (await readdir(BATI_DIR).catch(() => [] as string[])).filter((f) => f.startsWith(`${egg === 'sun' ? 'sun' : 'moon'}-`));
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
    // M-R223: the seed's small mark (food / sound / word) stays on every face too
    const r0 = activeBati(u);
    const keep = batiSeedRule({ seed: r0?.seed || u.batiFood || '', kind: paintKind(r0?.seedKind) });
    const made = await settleWithRetry(todo.length, (i) => this.looks.generate(`${BATI_FACE_PROMPT(todo[i])} Keep the small mark of what it was born from exactly where it is. ${keep}`, i, [ref]));
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
