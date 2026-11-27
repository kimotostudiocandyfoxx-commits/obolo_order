import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { VOICE_MAX_BYTES } from '@obolo/shared';
import express from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/errors';
import { loadConfig } from './config';
import { Database } from './db/db';
import { runMigrations } from './db/migrate';
import { costScope, featureOfPath } from './wallet/cost-scope';

export function parseOrigins(spec: string): (string | RegExp)[] {
  return spec
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith('/') && s.endsWith('/') ? new RegExp(s.slice(1, -1)) : s));
}

async function bootstrap() {
  const cfg = loadConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  app.set('trust proxy', true); // Cloud Run sits behind Google's front end
  app.disable('x-powered-by');
  // client 2026-11-25: every provider cost of a request is filed under its member and feature (wallet/cost-scope.ts)
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => costScope.run({ feature: featureOfPath(req.path) }, next));
  app.use('/media/voice', express.raw({ type: 'audio/*', limit: VOICE_MAX_BYTES }));
  // the mic where the browser cannot hear by itself (iPhone Chrome …): one take, turned into words, not kept
  app.use('/voice/dictate', express.raw({ type: 'audio/*', limit: VOICE_MAX_BYTES }));
  // client 2026-11-27: a ダチ voice message's recording, made ready on the server (clean-up, words, sound)
  app.use('/dachi/voice', (req: express.Request, res: express.Response, next: express.NextFunction) => (req.path === '/' ? express.raw({ type: 'audio/*', limit: VOICE_MAX_BYTES })(req, res, next) : next()));
  // the NEO look can start from a reference image (sent once, never stored)
  app.use('/me/look', express.json({ limit: '3mb' }));
  app.use('/me/puni/pic/candidates', express.json({ limit: '8mb' }));
  app.use('/me/butterfly/candidates', express.json({ limit: '8mb' }));
  // voice registration sends one recording (base64)
  app.use('/voice/register', express.json({ limit: '8mb' }));
  // 〔🧭 スペルコンパス〕: a picture or a 10-second song clip
  app.use('/buddy/compass', express.json({ limit: '8mb' }));
  // R12: a pasted image read by the Moon's compass
  app.use('/moon/compass', express.json({ limit: '8mb' }));
  // Stripe signs the exact bytes it sends
  app.use('/billing/webhook', express.raw({ type: '*/*', limit: '1mb' }));
  app.useBodyParser('json', { limit: '64kb' });
  app.enableCors({
    origin: parseOrigins(cfg.CORS_ORIGINS),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type', 'accept-language', 'x-admin-token'],
    maxAge: 600,
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  if (cfg.MIGRATE_ON_START) {
    await runMigrations(app.get(Database).primaryPool);
    Logger.log('migrations applied', 'Bootstrap');
  }

  await app.listen(cfg.PORT, '0.0.0.0');
  Logger.log(`API listening on :${cfg.PORT}`, 'Bootstrap');
}

if (require.main === module) {
  bootstrap().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
