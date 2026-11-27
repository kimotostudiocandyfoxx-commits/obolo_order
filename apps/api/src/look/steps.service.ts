import { HttpStatus, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { lookPick4Prompt, lookStepPrompt, moderateLookWish, type GeneratedImage, type ImageProvider, type LlmProvider } from '@obolo/ai';
import {
  afterLookStep,
  canLookStep,
  EMPTY_LOOK_STEPS,
  LOOK_PICK4_HEADS,
  lookStepView,
  type LookPick4Body,
  type LookPick4Result,
  type LookStepBody,
  type LookStepResult,
  type LookStepsInfo,
  type LookStepState,
  type LookStepWho,
  type Me,
} from '@obolo/shared';
import { eq } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { users } from '../db/schema';
import { LLM, LOOK_IMAGES, LOOK_STEP_IMAGES } from '../infra/tokens';
import { chooseKey, KEY_WORDS, onKey, type KeyName } from '../media/keying';
import { MediaService } from '../media/media.service';
import { activeMember } from '../users/tester';
import { toMe } from '../users/users.service';
import { canUseMedia } from '../voice/media-consent';
import { LedgerService } from '../wallet/ledger.service';
import { livePrices } from '../wallet/price-book';
import { lookConfirmedOf, lookLocked, lookLockedOf } from './lock';
import { LookService } from './look.service';

type Row = typeof users.$inferSelect;

/** the screen's words when a picture could not be made or cut cleanly (nothing taken, nothing counted) */
export const LOOK_AGAIN = 'うまく描けなかった……もういちど';
class CutFailed extends Error {}

/** where a round is kept on the account (onboardingJson): the steps used, decided or not, the picture it has now */
export const stepsKey = (who: LookStepWho) => `steps.${who}`;

export function stepsOf(u: Pick<Row, 'onboardingJson'>, who: LookStepWho): LookStepState {
  const raw = ((u.onboardingJson ?? {}) as Record<string, string>)[stepsKey(who)];
  if (!raw) return { ...EMPTY_LOOK_STEPS };
  try {
    const s = JSON.parse(raw) as Partial<LookStepState>;
    return { used: Number(s.used) || 0, fixed: !!s.fixed, url: typeof s.url === 'string' ? s.url : null };
  } catch {
    return { ...EMPTY_LOOK_STEPS };
  }
}


/**
 * Client 2026-11-27 (story M-R334; the rules are shared lookSteps.ts): a look changed step by step — {bati}'s 進化
 * (D03-S005b) and the member's own 変身 (D03-S004), and the same round for an Obolo Order member's later change.
 *  - every picture made here ({bati}'s steps, the four first pictures, one's own steps) is painted on a flat key colour and
 *    cut out by the shared checked cut-out (media/cutting.ts cutLadder — five checks, the retry ladder — through
 *    LookService.cut); the birth picture is cut the same way (LookService.paintBorn).
 *  - `step`: one edit of the picture it has now (LOOK_STEP_MODEL) by what was said and / or a reference picture; one
 *    step's mana (MakeKind 'lookStep') is taken from the gem before it is painted and given back when nothing came;
 *    LOOK_STEP_MAX steps a round.
 *  - `pick4` / `base`: the four first pictures of one's own look (four touches, 2 / 3 / 5 / 7 heads; 'lookPick4') and the
 *    one chosen as the round's base.
 *  - `fix`: the round is decided — the picture is worn (its expressions and the rest are painted from it then, not at
 *    every step); one's own look is confirmed with it (the profile look's mana, 'profileLook': the first one through
 *    LookService.confirmFirstLook, a member's later one as a normal charge).
 *  - `open`: an Obolo Order member starts a new round from the look worn now (a resident's stays as it is: LOOK_LOCKED).
 * While a round is open the pictures of its steps are only kept on the round (the screen shows them); nothing else of the
 * account changes until it is decided.
 */
@Injectable()
export class LookStepsService {
  private readonly log = new Logger('LookSteps');
  constructor(
    private readonly db: Database,
    private readonly media: MediaService,
    @Inject(LOOK_STEP_IMAGES) private readonly painter: ImageProvider,
    @Inject(LLM) private readonly llm: LlmProvider,
    private readonly ledger: LedgerService,
    private readonly look: LookService,
    /** the four first pictures are painted by the look's painter (LOOK_MODEL); the step painter without it */
    @Optional() @Inject(LOOK_IMAGES) private readonly lookPainter?: ImageProvider,
  ) {}

  private async user(userId: string): Promise<Row> {
    const [u] = await this.db.write.select().from(users).where(eq(users.id, userId));
    if (!u) throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'User not found');
    return u;
  }

  private async save(userId: string, who: LookStepWho, s: LookStepState): Promise<Row> {
    const cur = await this.user(userId);
    const j = { ...((cur.onboardingJson ?? {}) as Record<string, string>), [stepsKey(who)]: JSON.stringify({ used: s.used, fixed: s.fixed, url: s.url ?? null }) };
    const [nu] = await this.db.write.update(users).set({ onboardingJson: j, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    return nu;
  }

  private worn(u: Row, who: LookStepWho): string | null {
    return who === 'bati' ? u.batiImageUrl : u.avatarUrl;
  }

  /** one's own round is closed for a resident once the look is confirmed (until they join the Order) */
  private selfOpen(u: Row, s: LookStepState, unlimited: boolean) {
    if (unlimited) return;
    if (lookLockedOf(u)) throw lookLocked(u);
    // confirmed and decided (a member who did not open a new round): 〔open〕 first
    if (lookConfirmedOf(u) && s.fixed) throw apiError(HttpStatus.CONFLICT, 'LOOK_STEPS_DONE', 'この姿は、もう決まっています');
  }

  async info(userId: string): Promise<LookStepsInfo> {
    const u = await this.user(userId);
    const p = await livePrices();
    return {
      bati: lookStepView(stepsOf(u, 'bati'), u.batiImageUrl),
      self: lookStepView(stepsOf(u, 'self'), u.avatarUrl),
      prices: { step: p.lookStep, pick4: p.lookPick4, fix: p.profileLook, birth: p.batiBirth },
    };
  }

  async step(userId: string, body: LookStepBody, origin: string, unlimited = false): Promise<LookStepResult> {
    const u = await this.user(userId);
    const who = body.who;
    const s = stepsOf(u, who);
    const wish = body.wish.trim();
    if (!wish && !body.image) throw apiError(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Say how to change it, or send a picture');
    if (who === 'self') this.selfOpen(u, s, unlimited);
    if (!canLookStep(s)) throw apiError(HttpStatus.CONFLICT, 'LOOK_STEPS_DONE', '、、、今日の魔法は、ここまでだ。');
    const from = s.url ?? this.worn(u, who);
    if (!from) throw apiError(HttpStatus.CONFLICT, who === 'bati' ? 'NO_BATI' : 'NO_LOOK', 'Nothing to change yet');
    // a reference picture is only handed to the painter, never stored; not for an account whose pictures may not be used (M-R250)
    if (body.image && !canUseMedia(u)) throw apiError(HttpStatus.FORBIDDEN, 'PHOTO_NOT_ALLOWED', 'A picture cannot be used for this account');
    if (wish) {
      const m = await moderateLookWish(wish, this.llm);
      if (m.flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MODERATION', 'その姿には、できません');
    }
    const src = await this.media.bytesByUrl(userId, from);
    if (!src) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Picture not found');
    const ref: GeneratedImage[] = body.image ? [{ data: Buffer.from(body.image.data, 'base64'), mime: body.image.mime }] : [];

    // the step's mana first (402 NO_MANA stops it before anything is painted); given back when nothing came
    const price = unlimited ? 0 : (await livePrices()).lookStep;
    const fee = unlimited ? { refund: async () => undefined } : await this.ledger.charge(this.db, userId, 'lookStep');
    let url: string;
    try {
      // every picture of a round stands cut out ({bati}'s and one's own): painted on the key colour farthest from its own
      // colours, then cut by the checked cut-out (media/cutting.ts cutLadder, through LookService.cut: the checks and the
      // retry ladder of the planet figures)
      const key = await chooseKey(src);
      const on = await onKey(src, key);
      const img = await this.painter.generate(lookStepPrompt(who, wish, ref.length > 0, KEY_WORDS[key]), s.used, [on, ...ref]);
      const cut = await this.look.cutOrNothing(img, 768, key, `look step (${who}) of ${userId}`);
      // client 2026-11-27: no try cut it cleanly — a badly cut picture is never shown: the step's mana goes back, the step
      // does not count, and the screen asks to try again (logged at error level by cutOrNothing, with every step's checks)
      if (!cut.png) throw new CutFailed(cut.record);
      url = (await this.media.storeImage(userId, who === 'bati' ? 'bati' : 'avatar', 'image/png', cut.png, origin)).url;
    } catch (e) {
      await fee.refund();
      if (e instanceof CutFailed) throw apiError(HttpStatus.BAD_GATEWAY, 'LOOK_CUT_FAILED', LOOK_AGAIN);
      this.log.warn(`look step failed (${who}): ${String(e)}`);
      throw apiError(HttpStatus.BAD_GATEWAY, 'LOOK_STEP_FAILED', LOOK_AGAIN);
    }
    // the round as it is now (another tap may have moved it meanwhile: counted from the account, not from the start)
    const now = stepsOf(await this.user(userId), who);
    let next: LookStepState;
    try {
      next = afterLookStep(now, url);
    } catch {
      await fee.refund();
      throw apiError(HttpStatus.CONFLICT, 'LOOK_STEPS_DONE', '、、、今日の魔法は、ここまでだ。');
    }
    const nu = await this.save(userId, who, next);
    return { who, steps: lookStepView(next, this.worn(nu, who)), mana: price };
  }

  /** D03-S004: the four first pictures of one's own look — from the photo, or (no photo may be used) from the wish */
  async pick4(userId: string, body: LookPick4Body, origin: string, unlimited = false): Promise<LookPick4Result> {
    const u = await this.user(userId);
    this.selfOpen(u, { ...EMPTY_LOOK_STEPS }, unlimited);
    if (body.photo && !canUseMedia(u)) throw apiError(HttpStatus.FORBIDDEN, 'PHOTO_NOT_ALLOWED', 'A photo cannot be used for this account');
    const wish = (body.wish ?? '').trim();
    if (!body.photo && !wish) throw apiError(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'A photo or a wish is needed');
    if (wish) {
      const m = await moderateLookWish(wish, this.llm);
      if (m.flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MODERATION', 'その姿には、できません');
    }
    // the photo is only handed to the painter, never stored (M-R148)
    const refs: GeneratedImage[] = body.photo ? [{ data: Buffer.from(body.photo.data, 'base64'), mime: body.photo.mime }] : [];
    const price = unlimited ? 0 : (await livePrices()).lookPick4;
    const fee = unlimited ? { refund: async () => undefined } : await this.ledger.charge(this.db, userId, 'lookPick4');
    const painter = this.lookPainter ?? this.painter;
    // painted on a flat key colour — the one farthest from the photo's own colours — and each cut out by the checked
    // cut-out (media/cutting.ts cutLadder, through LookService.cut)
    const key: KeyName = refs[0] ? await chooseKey(refs[0].data).catch(() => 'green' as KeyName) : 'green';
    const made = await Promise.allSettled(LOOK_PICK4_HEADS.map((_, i) => painter.generate(lookPick4Prompt(i, { photo: !!body.photo, wish, key: KEY_WORDS[key] }), i, refs)));
    const candidates: { id: string; url: string }[] = [];
    for (const r of made) {
      if (r.status !== 'fulfilled') {
        this.log.warn(`look pick4 failed: ${String(r.reason)}`);
        continue;
      }
      // a picture no try cut cleanly is left out (never shown badly cut); none at all: the mana goes back
      const cut = await this.look.cutOrNothing(r.value, 768, key, `look pick4 of ${userId}`);
      if (!cut.png) continue;
      const m = await this.media.storeImage(userId, 'avatar', 'image/png', cut.png, origin);
      candidates.push({ id: m.id, url: m.url });
    }
    if (!candidates.length) {
      await fee.refund();
      return { candidates, mana: 0 };
    }
    // a new four starts the round over
    await this.save(userId, 'self', { ...EMPTY_LOOK_STEPS });
    return { candidates, mana: price };
  }

  /** one of the four becomes the base of one's own round */
  async base(userId: string, mediaId: string): Promise<LookStepResult> {
    const u = await this.user(userId);
    const s = stepsOf(u, 'self');
    this.selfOpen(u, s, false);
    const m = await this.media.getOwned(userId, mediaId, 'avatar');
    if (!m) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Image not found');
    const next: LookStepState = { used: 0, fixed: false, url: m.url };
    await this.save(userId, 'self', next);
    return { who: 'self', steps: lookStepView(next, u.avatarUrl), mana: 0 };
  }

  /** 〔{bati}の姿はこれだ〕 / 〔この姿にする〕: the round is decided and its picture worn */
  async fix(userId: string, who: LookStepWho, origin: string, unlimited = false): Promise<LookStepResult & { me: Me }> {
    const u = await this.user(userId);
    const s = stepsOf(u, who);
    if (s.fixed) return { who, steps: lookStepView(s, this.worn(u, who)), mana: 0, me: toMe(u) };
    let mana = 0;
    if (who === 'bati') {
      if (!u.batiImageUrl) throw apiError(HttpStatus.CONFLICT, 'NO_BATI', 'Not hatched yet');
      if (s.url && s.url !== u.batiImageUrl) await this.look.wearBati(userId, u, s.url, origin, true);
    } else {
      this.selfOpen(u, s, unlimited);
      const url = s.url ?? u.avatarUrl;
      if (!url) throw apiError(HttpStatus.CONFLICT, 'NO_LOOK', 'No look yet');
      const first = !lookConfirmedOf(u);
      // a member's later change: the profile look's mana before it is worn (402 NO_MANA stops it; nothing changed yet)
      if (!first && !unlimited && url !== u.avatarUrl) {
        mana = (await livePrices()).profileLook;
        await this.ledger.charge(this.db, userId, 'profileLook');
      }
      if (url !== u.avatarUrl) await this.look.wearLook(userId, url, origin, true);
      // the first look: confirmed here, at the bowl of water (its mana: one charge per member, never twice)
      if (first) {
        const r = await this.look.confirmFirstLook(userId, origin, true);
        mana = r.mana;
      }
    }
    const next: LookStepState = { used: s.used, fixed: true, url: null };
    const nu = await this.save(userId, who, next);
    return { who, steps: lookStepView(next, this.worn(nu, who)), mana, me: toMe(nu) };
  }

  /** an Obolo Order member starts a new round from the look worn now (their own look, or the {bati} in the chat) */
  async open(userId: string, who: LookStepWho): Promise<LookStepResult> {
    const u = await this.user(userId);
    if (!activeMember(u)) throw lookLocked(u);
    const next: LookStepState = { ...EMPTY_LOOK_STEPS };
    const nu = await this.save(userId, who, next);
    return { who, steps: lookStepView(next, this.worn(nu, who)), mana: 0 };
  }
}
