import { BadRequestException } from '@nestjs/common';
import type { z } from 'zod';

export function parseBody<S extends z.ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
  const r = schema.safeParse(body);
  if (!r.success) {
    throw new BadRequestException({
      error: { code: 'VALIDATION', message: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') },
    });
  }
  return r.data;
}
