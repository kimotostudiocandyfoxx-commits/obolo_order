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
  app.use('/media/voice', express.raw({ type: 'audio/*', limit: VOICE_MAX_BYTES }));
  // the NEO look can start from a reference image (sent once, never stored)
  app.use('/me/look', express.json({ limit: '3mb' }));
  // Stripe signs the exact bytes it sends
  app.use('/billing/webhook', express.raw({ type: '*/*', limit: '1mb' }));
  app.useBodyParser('json', { limit: '64kb' });
  app.enableCors({
    origin: parseOrigins(cfg.CORS_ORIGINS),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
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
