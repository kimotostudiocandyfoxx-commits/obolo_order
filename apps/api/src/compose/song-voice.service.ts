import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { songVoiceKey, songVoiceQuote, type JobView, type SongVoiceBody, type SongVoiceQuote, type SongVoiceQuoteView } from '@obolo/shared';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { JobsService } from '../jobs/jobs.service';
import { startConfirmed } from '../wallet/confirmed';
import { CostService } from '../wallet/cost.service';
import { LedgerService } from '../wallet/ledger.service';
import { SongService } from './song.service';

/**
 * R18 (client 2026-11-25): 君の声にする魔法 — a finished song sung again in the member's own registered voice, as a paid
 * spell with the member's yes. The quote is the price rule of the spell's GPU seconds (waking up + the split when the
 * song was never split + the conversion; the recorded p90 once there are enough), and the yes is charged exactly that
 * (its spell key says whether the split was in it: a split done meanwhile is a new quote). No registered voice, or the
 * consent rules (canUseMedia), never charge. A failure gives the mana back (JobsService).
 */
@Injectable()
export class SongVoiceService {
  constructor(
    private readonly songs: SongService,
    private readonly jobs: JobsService,
    private readonly ledger: LedgerService,
    private readonly db: Database,
    @Inject(KV) private readonly kv: KvStore,
    private readonly cost: CostService,
  ) {}

  async quote(userId: string, id: string): Promise<SongVoiceQuoteView> {
    const st = await this.songs.voiceState(userId, id);
    if (st.status !== 'ready') return st;
    const q = await this.price(st.split);
    return { status: 'quote', price: q.mana, spell: songVoiceKey(id, st.split), split: st.split };
  }

  /** the yes: charged at the server's own quote (the same as {bati} said), then the job */
  async start(userId: string, id: string, body: SongVoiceBody, origin: string): Promise<JobView> {
    const st = await this.songs.voiceState(userId, id);
    if (st.status !== 'ready') throw apiError(HttpStatus.CONFLICT, 'VOICE_UNAVAILABLE', st.status === 'has' ? 'Already in your voice' : 'The voice spell cannot be cast on this song');
    const q = await this.price(st.split);
    return startConfirmed({
      ledger: this.ledger,
      db: this.db,
      kv: this.kv,
      jobs: this.jobs,
      userId,
      kind: 'songVoice',
      refId: id,
      confirm: body.confirm,
      spell: songVoiceKey(id, st.split),
      price: q.mana,
      required: true,
      create: () => this.jobs.create(userId, 'song-voice', { songId: id, origin, confirm: body.confirm }),
    });
  }

  protected async price(split: boolean): Promise<SongVoiceQuote> {
    return songVoiceQuote({ split }, await this.cost.rates(), this.cost.rule(), await this.cost.voiceSeconds());
  }
}
