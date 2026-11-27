import { HttpStatus, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { decideBatiPersona, decideBatiWish, moderateLookWish, rewriteBatiLines, withAgeBand, withTouch, batiPrompt, batiCharacterPrompt, foodNameOf, keyedBackground, batiRestylePrompt, batiSeedRule, butterflyPrompt, stickerArtPrompt, type GeneratedImage, type ImageProvider, type LlmProvider, moderateText, neoFromPhotoPrompt, neoFromReferencePrompt, neoAnimalPrompt, neoLookPrompt, neoMorePrompt, neoOmakasePrompt, neoWordsPrompt, kororinPicPrompt, refineLookPrompt } from '@obolo/ai';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import type { BackgroundRemover } from '@obolo/ai';
import { cutLadder, cutPicture, ladderRecord, llmCutJudge } from '../media/cutting';
import { chooseKey, cutoutKey, KEY_WORDS, moveToKey, onKey, rankKeys, rekeyPrompt, type KeyName } from '../media/keying';
import { ageBand, BATI_SEED_QUESTION, BATI_WISH_REFUSE, batiEggState, BATI_RESTYLE_TOUCHES, LOOK_HISTORY_MAX, BATI_MAX, BATI_SCRIPT_LINES, batiSeedKind, type BatiEggKind, type BatiNewHatchBody, type BatiSpeechBody, BATI_FACES, BATI_MAGIC_PER_DAY, BATI_RESTYLE_PER_DAY, type BatiRestyleResult, type BatiFace, JOURNEY_DONE, type MakeKind, type MakeConfirm, type SpellTag, spellKey, spellPrompt, type StickerArtBody, type BatiEggBody, type Me, type NeoLookBody, type NeoLookResult, type PuniPicBody, type PuniPicResult, type RefineLookBody, SELF_TALK_FACES, TALK_FACES, type TalkExpression, type TalkFace, type TalkLook } from '@obolo/shared';
import { eq } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { LedgerService } from '../wallet/ledger.service';
import { alreadyStarted } from '../wallet/confirmed';
import { buddyProfiles, users } from '../db/schema';
import type { KvStore } from '../infra/kv';
import type { JobQueue } from '../infra/queue';
import { BATI_BIRTH_IMAGES, BATI_IMAGES, BUDDY_LLM, CUTOUT_MODEL, IMAGES, KORORIN_IMAGES, KV, LLM, LOOK_IMAGES, QUEUE } from '../infra/tokens';
import { CONFIG, type AppConfig } from '../config';
import { activeBati, batiList, columnsOf, keepLook, lookHistory, type BatiRecord } from './batis';
import { MediaService } from '../media/media.service';
import { findPart, storedTalk, talkBlinkPrompt, talkMouthPrompt, TALK_PART_FACES, talkFacePrompt, type TalkWho } from './talk';
import { day9At, toMe } from '../users/users.service';
import { canUseMedia } from '../voice/media-consent';
import { costScope } from '../wallet/cost-scope';
import { PlanetFiguresService } from './figures.service';
import type { FigureStore } from './figures';
import { firstLookKey, LOOK_CONFIRMED_KEY, lookConfirmedOf, lookLocked, lookLockedOf } from './lock';

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
/** The Bati's prepared body types (client decision 2026-10-25): eight per egg, on flat grey (assets/bati/<egg>-<n>.jpg); put on the key colour before an edit. */
/** client 2026-11-27: the style sheet of a newborn {bati} (design/refs/2026-11-27-story/09: food characters, no watermark) */
let batiSheet: Promise<{ data: Buffer; mime: string }> | undefined;
const batiStyle = () => (batiSheet ??= readFile(resolve(__dirname, '../../assets/bati-style-food.jpg')).then((data) => ({ data, mime: 'image/jpeg' })));
const BATI_DIR = resolve(__dirname, '../../assets/bati');
const BATI_GREY: [number, number, number] = [128, 128, 128];
/*
 * Cut-out review (2026-11-23): every picture that is cut out is painted on a flat key colour chosen far from the
 * character's own colours (media/keying.ts chooseKey: green, magenta or blue), not on the mid-grey of before — and re-keyed
 * by an edit when the character still came out too near it (cutoutChecked).
 */
const STANDEE_PROMPT = (key: KeyName) =>
  'Draw the character of the attached portrait as a full-body standing figure: the same person, face, hair, animal ears, oversized hood and ' +
  'cloak, colours, the round gold-rimmed sunglasses hiding the eyes, and the same semi-real painted style. Standing, facing the viewer, a relaxed ' +
  'friendly pose, the whole figure inside the frame with margin around it, on ' +
  keyedBackground(KEY_WORDS[key]) +
  '. A human body with human legs and shoes or boots: the animal is only in the ears. The hood and cloak reach only to ' +
  'the knees, the head about one sixth of the height, the feet fully visible with empty space below them. Safe for children. No text, no letters.';
// the small chibi NEO (M-R155/M-R161): the Jupiter butterfly, the Uranus owl, the Mercury captain, the Mars pilot, the game hero
const CHIBI_PROMPT = (key: KeyName) =>
  'Draw the character of the attached portrait as a small cute chibi figure: a big head and a small round body (about 2.5 heads tall), the same ' +
  'face, hair, animal ears, oversized hood and cloak, colours and the round gold-rimmed sunglasses, simplified and cute, soft painted style. ' +
  'Full body, standing, facing the viewer, both hands a little forward as if holding something, the whole figure inside the frame with margin ' +
  'around it, on ' +
  keyedBackground(KEY_WORDS[key]) +
  '. Safe for children. No text, no letters.';
// client 2026-11-25: the member's back (後ろ姿) — your back in the over-the-shoulder talk and the Moon's ダチ hall
// (SelfBack), painted from the standee on the same key colour and cut out like it
const BACK_PROMPT = (key: KeyName) =>
  'Draw the same character as the attached full-body figure, seen from directly behind: the back of the head and hair, ' +
  'the animal ears, the back of the oversized hood and cloak, the same colours, clothes, shoes and the same painted style. ' +
  'Standing straight, facing away from the viewer, no face visible, the arms relaxed at the sides, the same height and ' +
  'proportions, the whole figure inside the frame with margin around it, on ' +
  keyedBackground(KEY_WORDS[key]) +
  '. Safe for children. No text, no letters.';
// M-R262 / M-R275 (client 2026-11-25): the Saturn mini figure is the 2D anime chibi2 now, one of the planet figures
// (PlanetFiguresService, @obolo/ai saturnChibiPrompt) — the glossy 3D vinyl figure of before is gone
const FACE_WORDS: Record<BatiFace, string> = {
  smile: 'a big happy smile, eyes curved with joy',
  sparkle: 'wide open eyes with big star-shaped highlights, cheeks glowing, excited and curious, leaning forward a little',
  surprise: 'a surprised face, eyes wide and round, mouth a small open "o"',
  think: 'eyes gently closed, thinking hard, a tiny paw or hand near its chin',
  sad: 'a slightly sad, droopy face, eyebrows tilted, mouth a small frown',
  // test 1, E: "half closed" read as grumpy, with teeth, like an old cat
  yawn: 'a cute sleepy yawn: both eyes fully closed as soft curved lines, a small round open mouth with no teeth, a tiny tear at the corner of one eye, one paw near the mouth, cosy and sweet',
};
const BATI_FACE_PROMPT = (f: BatiFace, key: KeyName) =>
  `Edit the first picture: keep the same creature exactly — the same body, colours, materials, size, framing and light, on ${keyedBackground(KEY_WORDS[key])} — and change only its expression to ${FACE_WORDS[f]}. A small natural change of pose that fits the expression is fine. Cute, kids-friendly. No text, no letters.`;
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
    /** R17: {bati}'s pictures (BATI_MODEL) and the kororin's (KORORIN_MODEL); the look's painter without them */
    @Optional() @Inject(BATI_IMAGES) private readonly batiPainter?: ImageProvider,
    @Optional() @Inject(KORORIN_IMAGES) private readonly kororinPainter?: ImageProvider,
    /** R17: how many pictures a round paints (LOOK_CANDIDATES, PAID_LOOK_CANDIDATES, KORORIN_CANDIDATES) */
    @Optional() @Inject(CONFIG) private readonly cfg?: Partial<AppConfig>,
    /** client 2026-11-25: the member's figures on every home planet, made after each look */
    @Optional() private readonly figures?: PlanetFiguresService,
    /** M-R326: the background-removal model of the cut-out's checks and first retry (CUTOUT_MODEL; none: those are skipped) */
    @Optional() @Inject(CUTOUT_MODEL) private readonly cutModel?: BackgroundRemover | null,
    /** client 2026-11-27: the one picture a {bati} is born with (BATI_BIRTH_MODEL, Seedream 5.0 Flash); {bati}'s painter without it */
    @Optional() @Inject(BATI_BIRTH_IMAGES) private readonly birthPainter?: ImageProvider,
  ) {
    this.queue.register('bati.lines', ({ userId, batiId }) => this.writeLines(userId, batiId));
    this.queue.register('bati.paint', ({ userId, origin }) => this.paintBati(userId, origin).then(() => undefined));
    this.queue.register('bati.repaint', ({ userId, origin }) => this.repaintBati(userId, origin));
    this.queue.register('bati.faces', ({ userId, origin }) => this.batiFaces(userId, origin).then(() => undefined));
    this.queue.register('talk.look', ({ userId, origin, who }) => this.talkLook(userId, who, origin));
  }

  /** client 2026-11-27: the painter of a {bati}'s birth picture (BATI_BIRTH_MODEL) */
  private get birth(): ImageProvider {
    return this.birthPainter ?? this.bati;
  }
  /** R17: {bati}'s painter (BATI_MODEL) */
  private get bati(): ImageProvider {
    return this.batiPainter ?? this.looks;
  }
  /**
   * R17 (client 2026-11-25: generate fewer where fewer are enough): a free round of the first journey paints four (four
   * touches to pick from, M-R173); a paid round after it paints PAID_LOOK_CANDIDATES (2 — still a row to pick from).
   */
  lookCount(paid: boolean): number {
    return paid ? (this.cfg?.PAID_LOOK_CANDIDATES ?? 2) : (this.cfg?.LOOK_CANDIDATES ?? CANDIDATES);
  }

  /** mana for a making (M-R132); admins (unlimited) make for free. Returns the refund for a failed making. */
  private async fee(userId: string, kind: MakeKind, unlimited: boolean, paid: { via?: 'atelier'; from?: 'atelier'; confirm?: MakeConfirm; spell?: string | null } = {}) {
    if (unlimited) return { refund: async () => undefined };
    // R11: asked in the Moon atelier — only with the member's yes to the price shown, and once per yes
    const fee = await this.ledger.charge(this.db, userId, kind, undefined, { confirm: paid.confirm, spell: paid.spell ?? null, required: (paid.via ?? paid.from) === 'atelier' });
    if (fee.repeat) throw alreadyStarted();
    return fee;
  }

  /**
   * the look's mana — none on day 2 (M-R223, D03-S004 「2日目はマナを使わない」): the first look is taken whole when it is
   * confirmed at the end of day 2 (confirmFirstLook), its work on day 2 recorded as that making. Client 2026-11-25: a
   * change after it is 'profileLook' (everything painted for a look: profileLookParts)
   */
  private async lookFee(u: typeof users.$inferSelect, unlimited: boolean) {
    if (lookConfirmedOf(u)) return this.fee(u.id, 'profileLook', unlimited);
    this.firstLookScope(u, unlimited);
    return { refund: async () => undefined };
  }

  /**
   * client 2026-11-25 (nothing absorbed): before the first look is confirmed, what is painted for it (its rounds, the talk's
   * pictures, the back view) is recorded as the first look's profileLook making — its mana is taken at the end of day 2
   */
  private firstLookScope(u: typeof users.$inferSelect, unlimited: boolean) {
    if (!unlimited && !lookConfirmedOf(u)) costScope.tag({ kind: 'profileLook', job: firstLookKey(u.id), paid: true });
  }

  /** client 2026-11-25: a resident's own look stays as it is once confirmed, until they join the Order (LOOK_LOCKED) */
  private unlocked(u: typeof users.$inferSelect, unlimited: boolean) {
    if (!unlimited && lookLockedOf(u)) throw lookLocked(u);
  }

  /**
   * the paid making a look's own pictures belong to (the standee, the chibi, the talk's, the back view): the profile look
   * round it was chosen from (kept 30 days per picture), else the first look while it is not confirmed yet
   */
  private async tagLookJob(u: typeof users.$inferSelect, url: string | null) {
    const job = url ? await this.kv.get(`look:paid:${url}`).catch(() => null) : null;
    if (job) costScope.tag({ kind: 'profileLook', job, paid: true });
    else this.firstLookScope(u, false);
  }

  /** how long a paid round's pictures remember the yes that paid for them (the figures of the one chosen are part of it) */
  private static readonly PAID_TTL = 60 * 60 * 24 * 30;
  /**
   * client 2026-11-25: the candidates of a paid profile look round — the figures of the one chosen are made as that
   * making (its costs compared with its mana); a free round's are absorbed
   */
  private async rememberPaid(urls: string[]) {
    const s = costScope.get();
    if (!s?.paid || s.kind !== 'profileLook' || !s.job) return;
    for (const url of urls) await this.kv.set(`look:paid:${url}`, s.job, LookService.PAID_TTL).catch(() => undefined);
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
    // the favourite photo of themselves (M-R148): handed to the painter only, never stored. M-R248: only when the photo may
    // be used (the agreement; never under 13; 13〜15 with the guardian's consent) — else refused, the look is made from words
    if ('animal' in body && body.photo && !canUseMedia(u)) throw apiError(HttpStatus.FORBIDDEN, 'PHOTO_NOT_ALLOWED', 'A photo cannot be used for this account');
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
                : // M-R250: no photo may be used (under 13 / 13〜15 without the guardian's consent): the animal itself in the hood
                  !canUseMedia(u)
                  ? neoAnimalPrompt(body, i)
                  : neoLookPrompt(body, i, round);
    const limited = u.journeyDay < JOURNEY_DONE && !unlimited;
    const used = Number((await this.kv.get(key)) ?? 0);
    if (limited && used >= NEO_LOOK_TRIES) throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'LOOK_TRIES', 'もう作り直せません');
    this.unlocked(u, unlimited);
    // M-R223: no mana on day 2 (the look is made on the Moon then; it is taken whole when confirmed)
    const fee = await this.lookFee(u, unlimited);
    const tries = await this.kv.incr(key, TRY_TTL);

    // the look for their age band (M-R172; the birth year itself never reaches the painter), in the touch of each of the
    // four (M-R173: two Japanese anime semi-real, two character anime)
    const band = ageBand(Number((u.onboardingJson as Record<string, string> | null)?.birthYear) || null);
    const made = await settleWithRetry(this.lookCount(lookConfirmedOf(u) && !unlimited), (i) => this.looks.generate(withAgeBand(withTouch(prompt(i), i), band), i, refs));
    if (!made.some((r) => r.status === 'fulfilled')) await fee.refund();
    const candidates = [];
    for (const r of made) {
      if (r.status === 'fulfilled') {
        const m = await this.media.storeImage(userId, 'avatar', r.value.mime, r.value.data, origin);
        candidates.push({ id: m.id, url: m.url });
      } else this.log.warn(`look generation failed: ${String(r.reason)}`);
    }
    await this.rememberPaid(candidates.map((c) => c.url));
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
    this.unlocked(u, unlimited);
    const fee = await this.lookFee(u, unlimited);
    await this.kv.incr(`look:refine:${userId}`, TRY_TTL);
    const made = await settleWithRetry(this.lookCount(lookConfirmedOf(u) && !unlimited), (i) => this.looks.generate(refineLookPrompt(body.instruction, i), i, [src]));
    if (!made.some((r) => r.status === 'fulfilled')) await fee.refund();
    const candidates = [];
    for (const r of made) {
      if (r.status === 'fulfilled') {
        const m = await this.media.storeImage(userId, 'avatar', r.value.mime, r.value.data, origin);
        candidates.push({ id: m.id, url: m.url });
      } else this.log.warn(`look refine failed: ${String(r.reason)}`);
    }
    await this.rememberPaid(candidates.map((c) => c.url));
    const tries = Number((await this.kv.get(`look:tries:${userId}`)) ?? 0);
    return { candidates, triesLeft: limited ? Math.max(0, NEO_LOOK_TRIES - tries) : 99, refinesLeft: await this.refinesLeft(userId, limited) };
  }

  /** the day in Japan, for the per-day counters */
  private day() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());
  }

  /**
   * Bati's magic in Bati's room (P-BATI-ROOM): the look worn now (or a candidate of it) changed by the wish, as often as
   * BATI_MAGIC_PER_DAY rounds a day, so the visitor can keep going until they like it. Free until the first look is
   * confirmed (the end of day 2: its mana is taken then); after it only an Obolo Order member may change the look, each
   * round at the profile look's mana (client 2026-11-25). `refinesLeft` = the rounds left today.
   */
  private async magic(userId: string, body: RefineLookBody, origin: string, unlimited: boolean): Promise<NeoLookResult> {
    const u = await this.user(userId);
    await this.clean(body.instruction);
    const key = `look:magic:${userId}:${this.day()}`;
    const used = Number((await this.kv.get(key)) ?? 0);
    if (!unlimited && used >= BATI_MAGIC_PER_DAY) throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'LOOK_REFINES', '今日はもう描き直せません');
    const src = body.mediaId ? await this.media.imageData(userId, body.mediaId, 'avatar') : await this.current(userId, u.avatarUrl);
    if (!src) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Image not found');
    this.unlocked(u, unlimited);
    const confirmed = lookConfirmedOf(u);
    const fee = confirmed ? await this.fee(userId, 'profileLook', unlimited, { ...body, spell: body.spell ? spellKey('look', body.spell) : null }) : { refund: async () => undefined };
    if (!confirmed) this.firstLookScope(u, unlimited);
    const n = await this.kv.incr(key, 60 * 60 * 26);
    // R11: made from exactly the spell said yes to
    const asked = body.spell ? spellPrompt('look', body.spell) : body.instruction;
    const made = await settleWithRetry(this.lookCount(confirmed && !unlimited), (i) => this.looks.generate(refineLookPrompt(asked, i), i, [src]));
    const candidates = [];
    for (const r of made) {
      if (r.status === 'fulfilled') {
        const m = await this.media.storeImage(userId, 'avatar', r.value.mime, r.value.data, origin);
        candidates.push({ id: m.id, url: m.url });
      } else this.log.warn(`look magic failed: ${String(r.reason)}`);
    }
    if (!candidates.length) await fee.refund();
    else await this.rememberPaid(candidates.map((c) => c.url));
    const left = unlimited ? 99 : Math.max(0, BATI_MAGIC_PER_DAY - n);
    return { candidates, triesLeft: left, refinesLeft: left };
  }

  /**
   * Bati's room (P-BATI-ROOM): the Bati dressed up / changed a little by the wish — its picture put back on its grey
   * (like the faces), edited three ways and cut out like the hatched one. BATI_RESTYLE_PER_DAY rounds a day; free
   * during the first journey, the look's mana after it.
   */
  async restyle(userId: string, wishOrBody: string | { wish?: string; from?: string; via?: 'atelier'; confirm?: MakeConfirm; spell?: SpellTag[] }, origin: string, unlimited = false): Promise<BatiRestyleResult> {
    const { wish = '', from, via, confirm, spell } = typeof wishOrBody === 'string' ? { wish: wishOrBody, via: undefined, confirm: undefined, spell: undefined } : wishOrBody;
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
    // painted on the key colour farthest from its own colours, the reference put on it too
    const bg = await chooseKey(png);
    const ref = await onKey(png, bg);
    // the picture it was born with goes along, so the creature does not drift over many dress-ups (M-R215)
    const born = await this.bornRef(userId, u, bg);
    const refs = born ? [ref, born] : [ref];
    const fee = u.journeyDay < JOURNEY_DONE ? { refund: async () => undefined } : await this.fee(userId, 'look', unlimited, { via, confirm, spell: spell ? spellKey('bati', spell) : null });
    const n = await this.kv.incr(key, 60 * 60 * 26);
    // M-R223: the seed it was born from (food / sound / word) stays somewhere small in every look
    const r0 = activeBati(u);
    const seed = { seed: r0?.seed || u.batiFood || '', kind: paintKind(r0?.seedKind) };
    const count = u.journeyDay >= JOURNEY_DONE && !unlimited ? this.lookCount(true) : RESTYLE_CANDIDATES;
    const made = await settleWithRetry(count, (i) => this.bati.generate(batiRestylePrompt(spell ? spellPrompt('bati', spell) : wish, i, !!born, seed, KEY_WORDS[bg]), i, refs));
    const candidates = [];
    for (const r of made) {
      if (r.status !== 'fulfilled') {
        this.log.warn(`bati restyle failed: ${String(r.reason)}`);
        continue;
      }
      const cut = await this.cut(r.value, 768, bg);
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
  async wearBati(userId: string, cur: typeof users.$inferSelect, url: string, origin: string, isNew: boolean): Promise<Me> {
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
    // M-R234: the talk's look follows (after the faces when they are drawn again: batiFaces enqueues it)
    else await this.enqueueTalk(userId, 'bati', url, origin);
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
    // client 2026-11-25: part of the look's profileLook making (its price covers the standee and the chibi)
    await this.tagLookJob(u, u.avatarUrl);
    const key = await chooseKey(src.data);
    const img = await this.looks.generate(kind === 'chibi' ? CHIBI_PROMPT(key) : STANDEE_PROMPT(key), 0, [src]);
    const cut = await this.cut(img, 1024, key);
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

  async choose(userId: string, mediaId: string, origin?: string, unlimited = false): Promise<Me> {
    this.unlocked(await this.user(userId), unlimited);
    const m = await this.media.getOwned(userId, mediaId, 'avatar');
    if (!m) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Image not found');
    return this.wearLook(userId, m.url, origin, true);
  }

  /**
   * M-R223: the member's own look worn — a new one (added to the looks, onboardingJson 'look.history') or one worn
   * before (Bluena's first shelf). Each look keeps its round icon, so putting one back paints nothing.
   */
  async wearLook(userId: string, url: string, origin: string | undefined, isNew: boolean): Promise<Me> {
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
    const now = await this.user(userId);
    const j = { ...(now.onboardingJson ?? {}) } as Record<string, string>;
    j['look.history'] = JSON.stringify(hist);
    if (icon) j['look.icon'] = icon;
    else delete j['look.icon'];
    // client 2026-11-25: the planet figures of the looks kept (a look worn again paints nothing); a look that left the
    // history takes its figures with it
    const keep = new Set(hist.map((h) => h.url));
    const store: FigureStore = {};
    const dropped: string[] = [];
    for (const [look, e] of Object.entries((now.planetFigures ?? {}) as FigureStore)) {
      if (keep.has(look)) store[look] = e;
      else dropped.push(...Object.entries(e).filter(([k]) => !k.includes('#')).map(([, v]) => v));
    }
    const chibi = store[url]?.saturnChibi;
    const [nu] = await this.db.write
      .update(users)
      .set({ avatarUrl: url, onboardingJson: j, ...(dropped.length ? { planetFigures: store } : {}), ...(chibi ? { chibiPicUrl: chibi } : {}), updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    for (const d of dropped) await this.media.removeByUrl(userId, d).catch(() => undefined);
    // client 2026-11-25: a look chosen before the first look is confirmed: its pictures are the first look's making
    const confirmed = lookConfirmedOf(nu);
    if (!confirmed && isNew) await this.kv.set(`look:paid:${url}`, firstLookKey(userId), LookService.PAID_TTL).catch(() => undefined);
    // M-R234: the decided look's expressions, blink / mouth parts, chibi and back view, in the background
    if (origin) await this.enqueueTalk(userId, 'me', url, origin);
    // client 2026-11-25 (M-R262): the look's figures on every home planet — a paid profile look change's as that making;
    // the first journey's are painted once, for the look confirmed at the end of day 2 (confirmFirstLook)
    if (origin && confirmed) await this.enqueueFigures(userId, origin, url, isNew);
    return toMe(nu);
  }

  /**
   * M-R247 〔写真を消す〕 (settings): the photo itself was never kept (only handed to the painter); what was made from it
   * goes — every look of one's own (the pictures, the standee, the round icon, the talk's expressions). The member
   * stands as the hooded guest again (the placeholder look) until a new look is made.
   */
  async removeLook(userId: string): Promise<Me> {
    const u = await this.user(userId);
    const j = { ...((u.onboardingJson ?? {}) as Record<string, string>) };
    const urls = new Set<string>([u.avatarUrl, ...lookHistory(j).flatMap((h) => [h.url, h.icon]), j['look.standee'], j['look.icon'], j['look.chibi'], j['look.back']].filter((x): x is string => !!x));
    try {
      const t = j['talk.me'] ? (JSON.parse(j['talk.me']) as { stand?: string; faces?: Record<string, { url?: string; blink?: string; mouth?: string }> }) : null;
      if (t?.stand) urls.add(t.stand);
      for (const f of Object.values(t?.faces ?? {})) for (const x of [f?.url, f?.blink, f?.mouth]) if (x) urls.add(x);
    } catch {
      /* an unreadable talk look: just dropped */
    }
    // (the first look's confirmation stays: it was paid for; a new look after it is a change)
    for (const k of Object.keys(j)) if ((k.startsWith('look.') && !k.startsWith(LOOK_CONFIRMED_KEY)) || k === 'talk.me' || /^d\d+\.look$/.test(k)) delete j[k];
    // client 2026-11-25: the planet figures (and the Saturn mini figure) were made from the look: they go too
    if (u.chibiPicUrl) urls.add(u.chibiPicUrl);
    for (const e of Object.values((u.planetFigures ?? {}) as FigureStore)) for (const [k, v] of Object.entries(e)) if (!k.includes('#') && v) urls.add(v);
    const [nu] = await this.db.write.update(users).set({ avatarUrl: null, onboardingJson: j, chibiPicUrl: null, planetFigures: null, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    for (const url of urls) await this.media.removeByUrl(userId, url).catch(() => undefined);
    return toMe(nu);
  }

  /** M-R223: a look of one's own worn before is worn again (Bluena's first shelf) */
  async restoreLook(userId: string, url: string, origin?: string): Promise<Me> {
    const u = await this.user(userId);
    if (u.avatarUrl === url) return toMe(u);
    this.unlocked(u, false);
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
    const painter = kind === 'butterfly' ? this.images : (this.kororinPainter ?? this.looks);
    const made = await settleWithRetry(kind === 'butterfly' ? 2 : (this.cfg?.KORORIN_CANDIDATES ?? PUNI_PIC_CANDIDATES), (i) => painter.generate(prompt(body.description, !!reference, i), i, refs));
    const candidates = [];
    for (const r of made) {
      if (r.status !== 'fulfilled') {
        this.log.warn(`puni pic generation failed: ${String(r.reason)}`);
        continue;
      }
      try {
        // M-R325 / M-R326: cut and checked; a candidate whose cut fails (also by the model) is not offered
        const cut = await cutLadder({ first: { ...r.value, background: 'plain' }, out: 512, kind: 'figure', opt: { noShadow: kind === 'puni' }, model: this.cutModel, judge: llmCutJudge(this.llm) });
        if (!cut.ok) throw new Error(`the cut-out failed its checks (${ladderRecord(cut.tries)})`);
        const m = await this.media.storeImage(userId, 'avatar', 'image/png', cut.png, origin);
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
    const fee = await this.fee(userId, 'jacketArt', unlimited, { ...body, spell: body.spell ? spellKey('art', body.spell) : null });
    try {
      // R11: made from exactly the spell said yes to
      const img = await this.images.generate(stickerArtPrompt(body.text, body.spell ? spellPrompt('art', body.spell) : body.style), 0, []);
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
    // M-R334: the bubble keeps the sentence as said; what is kept as the favourite food (f_food, the card's 好物, the
    // picture's seed) is the food's name only (「ゼロ時零分カレーだよ。」 → カレー)
    const food = await foodNameOf(this.llm, body.food);
    const egg: BatiEggKind = body.egg === 'sun' ? 'sun' : body.egg ? 'moon' : 'sun';
    const cur = await this.user(userId);
    // the first {bati} (again): the list starts over unless more were born since (then only the one in the chat is made again)
    const list = batiList(cur);
    const keep = list.length > 1 ? list.filter((r) => r.id !== cur.batiId) : [];
    // M-R227: never the same style as the member's other {bati}
    // M-R230: a first {bati} (none other yet) comes from the bright group only
    const persona = await decideBatiPersona(this.buddyLlm ?? this.llm, food, egg, 'food', { exclude: keep.map((r) => r.personality), first: keep.length === 0 });
    if (!persona) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'SEED_REASK', '、、、食べられるものを、言ってみろ。');
    const rec = this.record(food, 'food', egg, persona);
    const [u] = await this.db.write
      .update(users)
      .set({
        batisJson: [...keep, rec],
        batiId: rec.id,
        batiFood: food,
        batiImageUrl: null,
        batiName: null,
        // M-R218: the broken shell becomes a small egg; M-R231: it hatches on the app's day 9 (users.bati_egg_at keeps when
        // day 9 opens; set when the first journey ends)
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    // client 2026-11-27: the birth picture's mana from the gem (one per {bati} born; a balance short of it never stops
    // the story: the rest waits with the tenths)
    try {
      await this.ledger.chargeWhole(this.db, userId, 'batiBirth', `make:batiBirth:${rec.id}`, rec.id);
    } catch (e) {
      this.log.warn(`bati birth charge failed: ${String(e)}`);
    }
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

  /** the picture the active {bati} was born with, on the key colour (null = the same as now, or none) */
  private async bornRef(userId: string, u: typeof users.$inferSelect, key: KeyName): Promise<GeneratedImage | null> {
    const born = activeBati(u)?.bornImageUrl;
    if (!born || born === u.batiImageUrl) return null;
    const png = await this.media.bytesByUrl(userId, born).catch(() => null);
    if (!png) return null;
    return onKey(png, key);
  }

  /**
   * A painting on `key` cut out and checked (M-R325 / M-R326, media/cutting.ts cutLadder): the colour cut, then the
   * background-removal model's cut, then its background painted again on the key farthest from its colours (one edit,
   * the re-key of before) — the first that passes the checks. When none does the colour cut is still handed back, as
   * before the checks (these pictures have no stand-in yet; logged for the operators). Null: nothing to cut.
   */
  async cut(img: GeneratedImage, out: number, key: KeyName): Promise<Buffer | null> {
    const r = await cutLadder({
      first: { ...img, background: key },
      out,
      kind: 'figure',
      model: this.cutModel,
      judge: llmCutJudge(this.llm),
      repaint: async (n) => {
        if (n !== 1) return null;
        const ranked = (await rankKeys(img.data).catch(() => [])).filter((x) => x.key !== key);
        const to = ranked[0]?.key ?? (key === 'magenta' ? 'green' : 'magenta');
        return { ...(await this.looks.generate(rekeyPrompt(to), 0, [img])), background: to };
      },
    }).catch(() => null);
    if (r?.ok) return r.png;
    if (r) this.log.error(`cut-out failed every retry (${ladderRecord(r.tries)}): the colour cut is used`);
    return cutPicture(img.data, out, key)
      .then((c) => c.png)
      .catch(() => null);
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
        url = await this.paintBorn(userId, u, origin, k);
      } catch (e) {
        this.log.warn(`bati generation failed (${k + 1}): ${String(e)}`);
      }
    }
    let stand = false;
    if (!url && body) {
      const png = await cutoutKey(body.grey, 768, BATI_GREY)
        .then((r) => r.png)
        .catch(() => null);
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

  /**
   * client 2026-11-27 (story M-R334): the picture a {bati} is born with — the seed itself as a character, 2D anime
   * (batiCharacterPrompt; BATI_BIRTH_MODEL with the style sheet as reference), on a flat key colour and cut out so it
   * stands on the stage without a frame. Blue: the colour food has least of.
   */
  private async paintBorn(userId: string, u: typeof users.$inferSelect, origin: string, variant: number): Promise<string> {
    const key: KeyName = 'blue';
    const style = await batiStyle().catch(() => null);
    const img = await this.birth.generate(batiCharacterPrompt(u.batiFood ?? '', paintKind(activeBati(u)?.seedKind), KEY_WORDS[key], !!style), variant, style ? [style] : []);
    const png = await this.cut(img, 768, key);
    return (png ? await this.media.storeImage(userId, 'bati', 'image/png', png, origin) : await this.media.storeImage(userId, 'bati', img.mime, img.data, origin)).url;
  }

  /** the stand-in body replaced by the real picture (a few tries, a minute apart); the faces are made again from it */
  private async repaintBati(userId: string, origin: string) {
    for (let k = 0; k < 3; k++) {
      await new Promise((r) => setTimeout(r, 60_000));
      const u = await this.user(userId);
      if (!u.batiFood || !(u.onboardingJson as Record<string, string> | null)?.['bati.stand']) return;
      const body = await this.batiBody(activeBati(u)?.egg ?? (await this.kv.get(`bati:egg:${userId}`)) ?? 'sun');
      try {
        const url = await this.paintBorn(userId, u, origin, 7 + k);
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

  /**
   * One of the egg's eight body types, at random (none on disk → null, the free drawing): cut off its grey and put on the
   * key colour farthest from its colours (`grey`: the painting as it is on disk, the stand-in when painting fails).
   */
  private async batiBody(egg: string): Promise<(GeneratedImage & { key: KeyName; grey: Buffer }) | null> {
    const files = (await readdir(BATI_DIR).catch(() => [] as string[])).filter((f) => f.startsWith(`${egg === 'sun' ? 'sun' : 'moon'}-`));
    if (!files.length) return null;
    const f = files[Math.floor(Math.random() * files.length)];
    const grey = await readFile(resolve(BATI_DIR, f));
    const cut = await moveToKey(grey, BATI_GREY, 'green').catch(() => null);
    if (!cut) return { data: grey, mime: 'image/jpeg', key: 'green', grey };
    const key = await chooseKey(cut.png);
    const on = key === 'green' ? cut : await onKey(cut.png, key);
    return { data: on.data, mime: on.mime, key, grey };
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
    const key = await chooseKey(png);
    const ref = await onKey(png, key);
    // M-R223: the seed's small mark (food / sound / word) stays on every face too
    const r0 = activeBati(u);
    const keep = batiSeedRule({ seed: r0?.seed || u.batiFood || '', kind: paintKind(r0?.seedKind) });
    const made = await settleWithRetry(todo.length, (i) => this.bati.generate(`${BATI_FACE_PROMPT(todo[i], key)} Keep the small mark of what it was born from exactly where it is. ${keep}`, i, [ref]));
    const faces = { ...have };
    for (const [i, r] of made.entries()) {
      if (r.status !== 'fulfilled') {
        this.log.warn(`bati face ${todo[i]} failed: ${String(r.reason)}`);
        continue;
      }
      const cut = await this.cut(r.value, 768, key);
      const m = cut ? await this.media.storeImage(userId, 'bati', 'image/png', cut, origin) : await this.media.storeImage(userId, 'bati', r.value.mime, r.value.data, origin);
      faces[todo[i]] = m.url;
    }
    const cur = (await this.user(userId)).onboardingJson as Record<string, string>;
    const [nu] = await this.db.write
      .update(users)
      .set({ onboardingJson: { ...cur, 'bati.faces': JSON.stringify(faces) }, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    if (nu.batiImageUrl) await this.enqueueTalk(userId, 'bati', nu.batiImageUrl, origin);
    return toMe(nu);
  }

  /**
   * client 2026-11-25: the figures of a look on every home planet (PlanetFiguresService). A new look chosen from a paid
   * profile look round goes as that making; otherwise (the first journey's free looks, a look worn again) absorbed.
   */
  async enqueueFigures(userId: string, origin: string, look: string, isNew = true, again = false) {
    if (!this.figures) return;
    const job = isNew ? await this.kv.get(`look:paid:${look}`).catch(() => null) : null;
    await this.figures.enqueue(userId, origin, look, job ? { kind: 'profileLook', job } : undefined, again);
  }

  private async enqueueTalk(userId: string, who: TalkWho, url: string, origin: string) {
    await this.queue.enqueue('talk.look', { userId, origin, who }, { dedupeKey: `talk-${who}-${userId}-${url}` }).catch(() => undefined);
  }

  /**
   * 隣に並ぶトーク (M-R234/M-R235): for the look decided now — your own (its standee) or {bati}'s — the expressions (the
   * decided look is the reference, so the face does not drift; your own: only the gentle four; {bati}: its drawn faces
   * are reused), an eyes-closed and an open-mouth edit of TALK_PART_FACES cut down to patches by differencing, Kept in onboardingJson `talk.<who>`; dropped if the look changed meanwhile. No mana (part of
   * the look); what fails is left out (the client bobs instead of flapping, the look cut round stands in for the mini).
   */
  async talkLook(userId: string, who: TalkWho, origin: string): Promise<void> {
    let u = await this.user(userId);
    const of = who === 'me' ? u.avatarUrl : u.batiImageUrl;
    if (!of) return;
    // client 2026-11-25: your own look's talk pictures, chibi and back view are part of its profileLook making
    if (who === 'me') await this.tagLookJob(u, of);
    const j0 = (u.onboardingJson ?? {}) as Record<string, string>;
    // client 2026-11-25: the back view of a look whose talk was made before it existed
    if (storedTalk(j0, who, of) && !storedTalk(j0, who, of)?.making) return void (who === 'me' && (await this.backView(userId, origin).catch((e: unknown) => this.log.warn(`back view failed: ${String(e)}`))));
    // your own stands full length (the standee); {bati}'s picture already does
    if (who === 'me' && !(j0['look.standee'] && j0['look.standee.of'] === of)) {
      await this.standee(userId, origin).catch((e: unknown) => this.log.warn(`talk standee failed: ${String(e)}`));
      u = await this.user(userId);
    }
    // client 2026-11-25: the look's small chibi and its back view go with the talk's pictures (one making: profileLook)
    if (who === 'me') {
      await this.standee(userId, origin, 'chibi').catch((e: unknown) => this.log.warn(`talk chibi failed: ${String(e)}`));
      await this.backView(userId, origin).catch((e: unknown) => this.log.warn(`back view failed: ${String(e)}`));
      u = await this.user(userId);
    }
    const j1 = (u.onboardingJson ?? {}) as Record<string, string>;
    const stand = who === 'me' ? (j1['look.standee.of'] === of ? j1['look.standee'] : null) || of : of;
    const png = await this.media.bytesByUrl(userId, stand);
    if (!png) return;
    // painted on the key colour farthest from the look's own colours
    const key = await chooseKey(png);
    const kw = KEY_WORDS[key];
    const ref = await onKey(png, key);
    const kind = who === 'me' ? ('avatar' as const) : ('bati' as const);
    const store = async (img: GeneratedImage) => {
      const cut = await this.cut(img, 1024, key);
      const m = cut ? await this.media.storeImage(userId, kind, 'image/png', cut, origin) : await this.media.storeImage(userId, kind, img.mime, img.data, origin);
      return { url: m.url, png: cut ?? img.data };
    };
    // {bati}'s faces drawn before (M-R139) stand for theirs; only the missing ones are painted
    let old: Record<string, string> = {};
    try {
      old = who === 'bati' && j1['bati.faces'] ? (JSON.parse(j1['bati.faces']) as Record<string, string>) : {};
    } catch {
      old = {};
    }
    const reuse: Partial<Record<TalkFace, string>> = { smile: old.smile, surprised: old.surprise, thinking: old.think, sad: old.sad };
    const wanted = (who === 'me' ? SELF_TALK_FACES : TALK_FACES).filter((f) => f !== 'normal');
    const todo = wanted.filter((f) => !reuse[f]);
    const painted = await settleWithRetry(todo.length, (i) => this.looks.generate(talkFacePrompt(todo[i], kw), 11 + i, [ref]).then(store));
    const pics: Partial<Record<TalkFace, { url: string; png: Buffer | null }>> = { normal: { url: stand, png } };
    for (const f of wanted) if (reuse[f]) pics[f] = { url: reuse[f]!, png: null };
    painted.forEach((r, i) => {
      if (r.status === 'fulfilled') pics[todo[i]] = r.value;
      else this.log.warn(`talk face ${todo[i]} failed: ${String(r.reason)}`);
    });
    const faces: Partial<Record<TalkFace, TalkExpression>> = {};
    for (const [f, p] of Object.entries(pics) as [TalkFace, { url: string; png: Buffer | null }][]) faces[f] = { kind: 'image', url: p.url };
    // M-R235: the parts — the same face with the eyes closed and with the mouth open, cut down to where they changed
    const partFaces = TALK_PART_FACES.filter((f) => pics[f]);
    const parts = await Promise.allSettled(
      partFaces.map(async (f, i) => {
        const base = pics[f]!.png ?? (await this.media.bytesByUrl(userId, pics[f]!.url));
        if (!base) return;
        const r = await onKey(base, key);
        const [blink, mouth] = await Promise.allSettled([this.looks.generate(talkBlinkPrompt(kw), 31 + i, [r]), this.looks.generate(talkMouthPrompt(kw), 41 + i, [r])]);
        const cutOf = async (g: PromiseSettledResult<GeneratedImage>) => (g.status === 'fulfilled' ? ((await this.cut(g.value, 1024, key)) ?? g.value.data) : null);
        const [eb, mb] = await Promise.all([cutOf(blink), cutOf(mouth)]);
        const e = faces[f] as Extract<TalkExpression, { kind: 'image' }>;
        const eyes = eb ? await findPart(base, eb, [0, 0.5]).catch(() => null) : null;
        if (eyes) Object.assign(e, { blink: (await this.media.storeImage(userId, kind, 'image/png', eyes.png, origin)).url, eyesBox: eyes.box });
        const lips = mb ? await findPart(base, mb, [0.05, 0.6]).catch(() => null) : null;
        if (lips) Object.assign(e, { mouth: (await this.media.storeImage(userId, kind, 'image/png', lips.png, origin)).url, mouthBox: lips.box });
      }),
    );
    parts.forEach((r, i) => r.status === 'rejected' && this.log.warn(`talk parts ${partFaces[i]} failed: ${String(r.reason)}`));
    const look: TalkLook = { of, stand, faces };
    const cur = await this.user(userId);
    if ((who === 'me' ? cur.avatarUrl : cur.batiImageUrl) !== of) return;
    await this.db.write
      .update(users)
      .set({ onboardingJson: { ...((cur.onboardingJson ?? {}) as Record<string, string>), [`talk.${who}`]: JSON.stringify(look) }, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  /**
   * client 2026-11-25: the look worn now seen from behind (後ろ姿) — one FLUX.2 klein 4B picture (LOOK_MODEL) from the
   * standee on the key colour farthest from its colours, cut out like the talk's pictures, stored through MediaService.
   * Once per look (kept with the look it was made from); your back in the over-the-shoulder talk and the ダチ hall.
   */
  async backView(userId: string, origin: string): Promise<Me> {
    const u = await this.user(userId);
    if (!u.avatarUrl) return toMe(u);
    const j = (u.onboardingJson ?? {}) as Record<string, string>;
    if (j['look.back'] && j['look.back.of'] === u.avatarUrl) return toMe(u);
    const standee = j['look.standee.of'] === u.avatarUrl ? j['look.standee'] : null;
    const png = await this.media.bytesByUrl(userId, standee ?? u.avatarUrl);
    if (!png) return toMe(u);
    await this.tagLookJob(u, u.avatarUrl);
    const key = await chooseKey(png);
    const img = await this.looks.generate(BACK_PROMPT(key), 21, [await onKey(png, key)]);
    const cut = await this.cut(img, 1024, key);
    const m = cut ? await this.media.storeImage(userId, 'avatar', 'image/png', cut, origin) : await this.media.storeImage(userId, 'avatar', img.mime, img.data, origin);
    const cur = await this.user(userId);
    // the look changed meanwhile: this back is not of the look worn now
    if (cur.avatarUrl !== u.avatarUrl) {
      await this.media.removeByUrl(userId, m.url).catch(() => undefined);
      return toMe(cur);
    }
    const old = (cur.onboardingJson as Record<string, string> | null)?.['look.back'];
    const [nu] = await this.db.write
      .update(users)
      .set({ onboardingJson: { ...((cur.onboardingJson ?? {}) as Record<string, string>), 'look.back': m.url, 'look.back.of': u.avatarUrl }, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    if (old && old !== m.url) await this.media.removeByUrl(userId, old).catch(() => undefined);
    return toMe(nu);
  }

  /**
   * Client 2026-11-25 (nothing absorbed): the first look is confirmed when day 2 is finished (the night on the Moon). Its
   * full profileLook price — everything painted for it: the candidates, the talk's pictures, the back view, the figures
   * on every home planet and their storage — is taken from the member's mana (the 88 of the mana gem, given at sign-up)
   * as one charge (LedgerService.chargeWhole: one per member, never twice). A balance short of it never stops the
   * journey: what it cannot take now waits with the tenths and is taken from the next mana. Then the confirmed look's
   * figures are painted, as that making. From now on a resident's look stays as it is (LOOK_LOCKED) until they join.
   * Returns the member and the mana the look took (0: nothing taken — no own look, already confirmed, not day 2's end).
   */
  async confirmFirstLook(userId: string, origin: string, /** M-R334: decided at the bowl of water (〔この姿にする〕), before the day is finished */ atFix = false): Promise<{ me: Me; mana: number }> {
    const u = await this.user(userId);
    const j = (u.onboardingJson ?? {}) as Record<string, string>;
    if (j[LOOK_CONFIRMED_KEY] || (atFix ? u.journeyDay > 2 : u.journeyDay !== 2 || !u.journeyCompletedAt)) return { me: toMe(u), mana: 0 };
    const look = u.avatarUrl;
    let mana = 0;
    if (look) {
      const r = await this.ledger.chargeWhole(this.db, userId, 'profileLook', firstLookKey(userId), 'first');
      mana = r.price;
      if (r.waiting > 0) this.log.warn(`first look: ${userId} short by ${r.waiting} mana — waiting with the tenths`);
    }
    const cur = await this.user(userId);
    const [nu] = await this.db.write
      .update(users)
      .set({ onboardingJson: { ...((cur.onboardingJson ?? {}) as Record<string, string>), [LOOK_CONFIRMED_KEY]: look ?? '-', [`${LOOK_CONFIRMED_KEY}.mana`]: String(mana) }, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    if (look) {
      await this.kv.set(`look:paid:${look}`, firstLookKey(userId), LookService.PAID_TTL).catch(() => undefined);
      // the talk's pictures and the back view were made when it was chosen (made now if they were not); the figures now
      await this.enqueueTalk(userId, 'me', look, origin);
      await this.enqueueFigures(userId, origin, look, true);
    }
    return { me: toMe(nu), mana };
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
