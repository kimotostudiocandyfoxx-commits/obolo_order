import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { pickVoiceMood, type LlmProvider } from '@obolo/ai';
import { cuteVoiceMana, cuteVoiceRate, speakText, type CuteVoiceInfo, type CuteVoiceMiss, type CuteVoiceRate, type VoiceMood } from '@obolo/shared';
import { eq } from 'drizzle-orm';
import { CONFIG, type AppConfig } from '../config';
import { Database } from '../db/db';
import { users } from '../db/schema';
import { LLM } from '../infra/tokens';
import { MediaService } from '../media/media.service';
import { canUseMedia } from '../voice/media-consent';
import { mp3Seconds } from '../voice/voice-mix';
import { defaultCuteVoiceId, VOICE_MODELS, type VoiceModels } from '../voice/voice-models';
import { costScope } from '../wallet/cost-scope';
import { CostService } from '../wallet/cost.service';
import { LedgerService } from '../wallet/ledger.service';
import { DachiVoiceDraftService } from './voice-draft.service';

/** Fish's MP3 (fish.client.ts asks for 128 kbit/s, constant) */
const TTS_KBPS = 128;

/** the voice made for one message: the file sent (the mix when there is one), the voice alone under it */
export interface CuteVoiceMade {
  mana: number;
  voice: { id: string; url: string };
  /** the quiet sound mixed in (null: the voice alone is sent) */
  mixed: { id: string; url: string; mood: VoiceMood; soft: boolean } | null;
  seconds: number;
}

/**
 * Client 2026-11-27 (shared/cuteVoice.ts): the ダチ words of a member who is NOT recorded, read by the default cute
 * voice (defaultCuteVoiceId — the one constant). Nothing of the member's own voice is here: only the words.
 *
 *  - who: only a member whose voice may not be used (canUseMedia false). A recorded member's words stay words.
 *  - the mana: cuteVoiceMana(these words) at the live rates, taken BEFORE the voice is made (MakeKind 'cuteVoice', a
 *    'generation' row; the tenths wait as for every price below 1) and given back when no voice came.
 *  - no mana / not enough, no voice service, a failure: `miss` — the caller sends the words alone, never an error.
 * The provider's cost (Fish, the mood's model, the mix's CPU) is filed under this paid making, in a scope of its own:
 * the rest of the request (the ダチ talk: absorbed) is not touched.
 */
@Injectable()
export class CuteVoiceService {
  private readonly log = new Logger('CuteVoice');
  constructor(
    private readonly db: Database,
    private readonly media: MediaService,
    private readonly ledger: LedgerService,
    private readonly costs: CostService,
    @Inject(VOICE_MODELS) private readonly models: VoiceModels,
    @Inject(CONFIG) private readonly cfg: Partial<Pick<AppConfig, 'FISH_DEFAULT_VOICE_ID'>>,
    @Optional() private readonly mixer?: DachiVoiceDraftService,
    @Optional() @Inject(LLM) private readonly llm?: LlmProvider,
  ) {}

  // ── stubbed in tests ──

  /** the member's own voice may NOT be used (never under 13 …): their words are read by the cute voice */
  protected async notRecorded(userId: string): Promise<boolean> {
    const [u] = await this.db.write.select().from(users).where(eq(users.id, userId));
    return !!u && !canUseMedia(u);
  }
  protected async rate(): Promise<CuteVoiceRate> {
    return cuteVoiceRate(await this.costs.rates(), this.costs.rule());
  }
  protected charge(userId: string, price: number): Promise<{ refund: () => Promise<void> }> {
    return this.ledger.charge(this.db, userId, 'cuteVoice', undefined, { price });
  }

  /** the voice service is connected and the default voice is set */
  get ready(): boolean {
    return this.models.enabled && !!defaultCuteVoiceId(this.cfg);
  }

  /** GET /dachi/voice/cute: is this member's ダチ talk read by the cute voice, and the live price's two numbers */
  async info(userId: string): Promise<CuteVoiceInfo> {
    const rate = await this.rate();
    return { on: this.ready && (await this.notRecorded(userId)), rate };
  }

  /**
   * These words in the cute voice. null: not for this member (recorded) — plain words, nothing to say about it.
   * `miss`: asked for but not made (no mana, or it could not be made) — plain words with a calm line.
   */
  async speak(userId: string, text: string, origin: string): Promise<CuteVoiceMade | { miss: CuteVoiceMiss } | null> {
    if (!(await this.notRecorded(userId))) return null;
    const ref = defaultCuteVoiceId(this.cfg);
    if (!this.models.enabled || !ref) return { miss: 'failed' };
    const scope = costScope.get();
    const work = async (): Promise<CuteVoiceMade | { miss: CuteVoiceMiss }> => {
      let price: number;
      let fee: { refund: () => Promise<void> };
      try {
        price = cuteVoiceMana(text, await this.rate());
        fee = await this.charge(userId, price);
      } catch (e) {
        const code = (e as { getResponse?: () => { error?: { code?: string } } }).getResponse?.().error?.code;
        if (code !== 'NO_MANA') this.log.warn(`not charged: ${String(e)}`);
        // 0 mana / not enough: the words alone. Anything else that stops the charge (a full Bluena …): the words alone too.
        return { miss: code === 'NO_MANA' ? 'noMana' : 'failed' };
      }
      try {
        const mp3 = await this.models.speak(ref, speakText(text));
        if (!mp3.length) throw new Error('an empty voice');
        const voice = await this.media.storeVoice(userId, 'audio/mpeg', mp3, origin);
        // the quiet sound picked from the words, as for a recorded voice message; it failing leaves the voice alone
        const pick = await pickVoiceMood(this.llm, text);
        const mood = pick.sound === 'none' ? null : pick.sound;
        const mix = mood && this.mixer ? await this.mixer.mixFor(userId, voice.id, { sound: mood, soft: pick.soft }, origin) : null;
        return {
          mana: price,
          voice: { id: voice.id, url: voice.url },
          mixed: mix && mood ? { id: mix.id, url: mix.url, mood, soft: !!pick.soft } : null,
          seconds: mix?.seconds ?? mp3Seconds(mp3.length, TTS_KBPS),
        };
      } catch (e) {
        this.log.warn(`cute voice not made (${text.length} chars): ${String(e)}`);
        await fee.refund().catch((err: unknown) => this.log.error(`refund failed for ${userId}: ${String(err)}`));
        return { miss: 'failed' };
      }
    };
    // a scope of its own: the charge marks it as this paid making, the ダチ talk's own scope stays as it was
    return costScope.run({ ...(scope ?? { feature: 'dachi' as const }), userId }, work);
  }
}
