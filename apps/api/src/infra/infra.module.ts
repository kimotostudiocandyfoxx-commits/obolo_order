import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { createImageProvider, createLlm, LlmProvider } from '@obolo/ai';
import { AppConfig, CONFIG, loadConfig } from '../config';
import { Database } from '../db/db';
import { createEmailSender } from './email';
import { createKv, KvStore } from './kv';
import { BullQueue, InlineQueue, JobQueue } from './queue';
import { EMAIL, IMAGES, KV, LLM, QUEUE } from './tokens';

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
  ],
  exports: [CONFIG, Database, KV, QUEUE, EMAIL, LLM, IMAGES],
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
