import { CanActivate, createParamDecorator, ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { apiError } from '../common/errors';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';

export interface AuthedRequest extends Request {
  userId: string;
}

export const sessionKey = (token: string) => `sess:${token}`;
/** Set while the team has suspended an account (a report review): every request is refused. */
export const suspendedKey = (userId: string) => `susp:${userId}`;

/** Bearer-token sessions stored in Redis (stateless API; works from PWA and future native shells). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(KV) private readonly kv: KvStore) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Login required');
    const userId = await this.kv.get(sessionKey(token));
    if (!userId) throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Session expired');
    if (await this.kv.get(suspendedKey(userId))) throw apiError(HttpStatus.FORBIDDEN, 'ACCOUNT_SUSPENDED', 'This account is suspended');
    req.userId = userId;
    return true;
  }
}

export const UserId = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().userId;
});
