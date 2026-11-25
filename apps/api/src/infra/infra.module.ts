import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { createBuddyLlm, createImageProvider, createLookImageProvider, createLlm, createTaskLlm, LlmProvider } from '@obolo/ai';
import { AppConfig, CONFIG, loadConfig } from '../config';
import { Database } from '../db/db';
import { createEmailSender } from './email';
import { createKv, KvStore } from './kv';
import { BullQueue, CloudTasksQueue, InlineQueue, JobQueue } from './queue';
import { BUDDY_LLM, EMAIL, GAME_LLM, IMAGES, KV, LLM, LOOK_IMAGES, LYRICS_LLM, NOVEL_LLM, QUEUE } from './tokens';

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
    {
      provide: IMAGES,
      inject: [CONFIG],
      useFactory: (c: AppConfig) => createImageProvider({ geminiApiKey: c.GEMINI_API_KEY, imageModel: c.GEMINI_IMAGE_MODEL }),
    },
    {
      // the looks and the Bati (client decision 2026-10-25): Seedream on Runware once its key is set
      provide: LOOK_IMAGES,
      inject: [CONFIG],
      useFactory: (c: AppConfig) => createLookImageProvider({ runwareKey: c.LOOK_RUNWARE_KEY, geminiApiKey: c.GEMINI_API_KEY, imageModel: c.GEMINI_IMAGE_MODEL }),
    },
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
    {
      provide: GAME_LLM,
      inject: [CONFIG],
      useFactory: (c: AppConfig): LlmProvider => {
        const log = new Logger('LLM');
        const llm = createTaskLlm(c.GAME_MODEL, { geminiApiKey: c.GEMINI_API_KEY, anthropicApiKey: c.ANTHROPIC_API_KEY, openaiApiKey: c.OPENAI_API_KEY }, { timeoutMs: c.GAME_MODEL_TIMEOUT_MS, onError: (p, e) => log.warn(`game: ${p} failed, next: ${String(e)}`) });
        log.log(`game chain: ${llm.name}`);
        return llm;
      },
    },
  ],
  exports: [CONFIG, Database, KV, QUEUE, EMAIL, LLM, BUDDY_LLM, NOVEL_LLM, GAME_LLM, LYRICS_LLM, IMAGES, LOOK_IMAGES],
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
