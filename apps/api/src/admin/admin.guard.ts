import { timingSafeEqual } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import type { AppConfig } from '../config';

/** Operator endpoints answer only with the ADMIN_TOKEN (x-admin-token); otherwise they do not exist. */
export function assertAdmin(cfg: AppConfig, token: string | undefined) {
  const expected = cfg.ADMIN_TOKEN;
  const ok = !!expected && !!token && token.length === expected.length && timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  if (!ok) throw new NotFoundException();
}
