import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Worker } from 'bullmq';
import { AppModule } from './app.module';
import { loadConfig } from './config';
import { createRedis } from './infra/kv';
import { JobQueue, QUEUE_NAME } from './infra/queue';
import { QUEUE } from './infra/tokens';

/**
 * Queue worker (QUEUE_DRIVER=bullmq). Deploy as a separate Cloud Run service with
 * min-instances ≥ 1 and CPU always allocated, or as a GPU worker pool later (spec §4.2).
 */
async function main() {
  const cfg = loadConfig();
  if (!cfg.REDIS_URL) throw new Error('worker requires REDIS_URL');
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  const queue = app.get<JobQueue>(QUEUE);
  const log = new Logger('Worker');
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const handler = queue.getHandler(job.name);
      if (!handler) throw new Error(`no handler for ${job.name}`);
      await handler(job.data);
    },
    { connection: createRedis(cfg.REDIS_URL), concurrency: 4 },
  );
  worker.on('failed', (job, err) => log.error(`${job?.name} ${job?.id} failed: ${err.message}`));
  log.log('worker started');
  const stop = async () => {
    await worker.close();
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
