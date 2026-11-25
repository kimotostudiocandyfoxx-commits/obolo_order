import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { createBuddyLlm, createPictureProvider, createLlm, createTaskLlm, LlmProvider } from '@obolo/ai';
import { AppConfig, artModelOf, CONFIG, gameFullOf, loadConfig, makeSetupOf } from '../config';
import { Database } from '../db/db';
import { createEmailSender } from './email';
import { createKv, KvStore } from './kv';
import { BullQueue, CloudTasksQueue, InlineQueue, JobQueue } from './queue';
import { BATI_IMAGES, BUDDY_LLM, EMAIL, GAME_CHEAP_LLM, GAME_LLM, GAME_TRIAL_LLM, IMAGES, KORORIN_IMAGES, KV, LLM, LOOK_IMAGES, LYRICS_LLM, NOVEL_LLM, PLANET_CHIBI_IMAGES, QUEUE, SATURN_BALL_IMAGES, SATURN_CHIBI_IMAGES, SPELL_LLM } from './tokens';

/** R17: one picture use's painter, logged with its model */
function picture(use: string, model: string, c: AppConfig) {
  const p = createPictureProvider(model, { runwareKey: c.LOOK_RUNWARE_KEY, geminiApiKey: c.GEMINI_API_KEY });
  new Logger('Images').log(`${use}: ${p.name} (${model})`);
  return p;
}

/** R17: one game tier's chain */
function gameChain(what: string, spec: string, c: AppConfig): LlmProvider {
  const log = new Logger('LLM');
  const llm = createTaskLlm(spec, { geminiApiKey: c.GEMINI_API_KEY, anthropicApiKey: c.ANTHROPIC_API_KEY, openaiApiKey: c.OPENAI_API_KEY }, { timeoutMs: c.GAME_MODEL_TIMEOUT_MS, onError: (p, e) => log.warn(`${what}: ${p} failed, next: ${String(e)}`) });
  log.log(`${what} chain: ${llm.name}`);
  return llm;
}

@Global()
@Module({
  providers: [
    { provide: CONFIG, useFactory: loadConfig },
    { provide: Database, inject: [CONFIG], useFactory: (c: AppConfig) => new Database(c) },
    { provide: KV, inject: [CONFIG], useFactory: (c: AppConfig) => createKv(c.REDIS_URL) },
    {
      provide: QUEUE,
      inject: [CONFIG],
      useFactory: (c: AppConfig): JobQueue => {
        if (c.QUEUE_DRIVER === 'bullmq') {
          if (!c.REDIS_URL) throw new Error('QUEUE_DRIVER=bullmq requires REDIS_URL');
          return new BullQueue(c.REDIS_URL);
        }
        if (c.QUEUE_DRIVER === 'cloudtasks') {
          if (!c.CLOUD_TASKS_QUEUE || !c.JOBS_TARGET_URL || !c.JOBS_INVOKER_SA) throw new Error('QUEUE_DRIVER=cloudtasks requires CLOUD_TASKS_QUEUE, JOBS_TARGET_URL and JOBS_INVOKER_SA');
          // the task waits as long as a request may run on Cloud Run (deploy --timeout=900)
          return new CloudTasksQueue({ queue: c.CLOUD_TASKS_QUEUE, target: c.JOBS_TARGET_URL, invoker: c.JOBS_INVOKER_SA, deadlineSeconds: 900 });
        }
        return new InlineQueue();
      },
    },
    { provide: EMAIL, inject: [CONFIG], useFactory: createEmailSender },
    // R17 (client 2026-11-25: cheaper pictures): each picture use on its own model (a Runware AIR id or a Gemini image
    // model), the defaults R16's until the client picks from the comparison (runware-art-test.yml)
    { provide: IMAGES, inject: [CONFIG], useFactory: (c: AppConfig) => picture('art', artModelOf(c), c) },
    { provide: LOOK_IMAGES, inject: [CONFIG], useFactory: (c: AppConfig) => picture('look', makeSetupOf(c).lookModel, c) },
    { provide: BATI_IMAGES, inject: [CONFIG], useFactory: (c: AppConfig) => picture('bati', makeSetupOf(c).batiModel, c) },
    { provide: KORORIN_IMAGES, inject: [CONFIG], useFactory: (c: AppConfig) => picture('kororin', makeSetupOf(c).kororinModel, c) },
    { provide: SATURN_CHIBI_IMAGES, inject: [CONFIG], useFactory: (c: AppConfig) => picture('saturn chibi', makeSetupOf(c).saturnChibiModel, c) },
    { provide: SATURN_BALL_IMAGES, inject: [CONFIG], useFactory: (c: AppConfig) => picture('saturn ball', makeSetupOf(c).saturnBallModel, c) },
    { provide: PLANET_CHIBI_IMAGES, inject: [CONFIG], useFactory: (c: AppConfig) => picture('planet chibi', makeSetupOf(c).planetChibiModel, c) },
    {
      provide: LLM,
      inject: [CONFIG],
      useFactory: (c: AppConfig): LlmProvider => {
        const log = new Logger('LLM');
        const llm = createLlm({
          geminiApiKey: c.GEMINI_API_KEY,
          geminiModel: c.GEMINI_MODEL,
          openaiApiKey: c.OPENAI_API_KEY,
          openaiModel: c.OPENAI_MODEL,
          onError: (p, e) => log.warn(`${p} failed, falling back: ${String(e)}`),
        });
        log.log(`provider chain: ${llm.name}`);
        return llm;
      },
    },
    {
      provide: BUDDY_LLM,
      inject: [CONFIG],
      useFactory: (c: AppConfig): LlmProvider => {
        const log = new Logger('LLM');
        const llm = createBuddyLlm({
          anthropicApiKey: c.ANTHROPIC_API_KEY,
          anthropicModel: c.ANTHROPIC_MODEL,
          geminiApiKey: c.GEMINI_API_KEY,
          geminiModel: c.GEMINI_MODEL,
          openaiApiKey: c.OPENAI_API_KEY,
          openaiModel: c.OPENAI_MODEL,
          onError: (p, e) => log.warn(`Bati: ${p} failed, falling back: ${String(e)}`),
        });
        log.log(`Bati chain: ${llm.name}`);
        return llm;
      },
    },
    // client 2026-11-25: a book's chapters and a game's code, each on its own model chain (NOVEL_MODEL / GAME_MODEL)
    {
      provide: NOVEL_LLM,
      inject: [CONFIG],
      useFactory: (c: AppConfig): LlmProvider => {
        const log = new Logger('LLM');
        const llm = createTaskLlm(c.NOVEL_MODEL, { geminiApiKey: c.GEMINI_API_KEY, anthropicApiKey: c.ANTHROPIC_API_KEY, openaiApiKey: c.OPENAI_API_KEY }, { timeoutMs: c.NOVEL_MODEL_TIMEOUT_MS, onError: (p, e) => log.warn(`novel: ${p} failed, next: ${String(e)}`) });
        log.log(`novel chain: ${llm.name}`);
        return llm;
      },
    },
    // R13: a song's lyrics with metatags (LYRICS_MODEL)
    {
      provide: LYRICS_LLM,
      inject: [CONFIG],
      useFactory: (c: AppConfig): LlmProvider => {
        const log = new Logger('LLM');
        const llm = createTaskLlm(c.LYRICS_MODEL, { geminiApiKey: c.GEMINI_API_KEY, anthropicApiKey: c.ANTHROPIC_API_KEY, openaiApiKey: c.OPENAI_API_KEY }, { timeoutMs: c.LYRICS_MODEL_TIMEOUT_MS, onError: (p, e) => log.warn(`lyrics: ${p} failed, next: ${String(e)}`) });
        log.log(`lyrics chain: ${llm.name}`);
        return llm;
      },
    },
    // R14: every spell is built by the model first (SPELL_MODEL)
    {
      provide: SPELL_LLM,
      inject: [CONFIG],
      useFactory: (c: AppConfig): LlmProvider => {
        const log = new Logger('LLM');
        const llm = createTaskLlm(c.SPELL_MODEL, { geminiApiKey: c.GEMINI_API_KEY, anthropicApiKey: c.ANTHROPIC_API_KEY, openaiApiKey: c.OPENAI_API_KEY }, { timeoutMs: c.SPELL_MODEL_TIMEOUT_MS, onError: (p, e) => log.warn(`spell: ${p} failed, next: ${String(e)}`) });
        log.log(`spell chain: ${llm.name}`);
        return llm;
      },
    },
    // R17: the game tiers (GAME_MODEL_FULL / _CHEAP / _TRIAL)
    { provide: GAME_LLM, inject: [CONFIG], useFactory: (c: AppConfig) => gameChain('game (full)', gameFullOf(c), c) },
    { provide: GAME_CHEAP_LLM, inject: [CONFIG], useFactory: (c: AppConfig) => gameChain('game (cheap)', makeSetupOf(c).gameCheapModel, c) },
    { provide: GAME_TRIAL_LLM, inject: [CONFIG], useFactory: (c: AppConfig) => gameChain('game (trial)', makeSetupOf(c).gameTrialModel, c) },
  ],
  exports: [CONFIG, Database, KV, QUEUE, EMAIL, LLM, BUDDY_LLM, NOVEL_LLM, GAME_LLM, GAME_CHEAP_LLM, GAME_TRIAL_LLM, LYRICS_LLM, SPELL_LLM, IMAGES, LOOK_IMAGES, BATI_IMAGES, KORORIN_IMAGES, SATURN_CHIBI_IMAGES, SATURN_BALL_IMAGES, PLANET_CHIBI_IMAGES],
})
export class InfraModule implements OnApplicationShutdown {
  constructor(
    private readonly db: Database,
    @Inject(KV) private readonly kv: KvStore,
    @Inject(QUEUE) private readonly queue: JobQueue,
  ) {}
  async onApplicationShutdown() {
    await Promise.allSettled([this.queue.close(), this.kv.close(), this.db.close()]);
  }
}
