import { Body, Controller, Headers, HttpCode, Ip, Post } from '@nestjs/common';
import { LOCALES, Locale, RequestCodeBody, VerifyCodeBody } from '@obolo/shared';
import { Inject } from '@nestjs/common';
import { rateLimit } from '../common/rate-limit';
import { parseBody } from '../common/validate';
import type { KvStore } from '../infra/kv';
import { KV } from '../infra/tokens';
import { AuthService } from './auth.service';

const pickLocale = (h?: string): Locale => {
  const l = (h ?? '').slice(0, 2).toLowerCase();
  return (LOCALES as readonly string[]).includes(l) ? (l as Locale) : 'ja';
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(KV) private readonly kv: KvStore,
  ) {}

  @Post('request-code')
  @HttpCode(200)
  async requestCode(@Body() body: unknown, @Ip() ip: string, @Headers('accept-language') lang?: string) {
    const { email } = parseBody(RequestCodeBody, body);
    await rateLimit(this.kv, `code-ip:${ip}`, 20, 3600);
    await rateLimit(this.kv, `code-email:${email}`, 5, 900);
    return this.auth.requestCode(email, pickLocale(lang));
  }

  @Post('verify')
  @HttpCode(200)
  async verify(@Body() body: unknown, @Ip() ip: string, @Headers('accept-language') lang?: string) {
    const { email, code } = parseBody(VerifyCodeBody, body);
    await rateLimit(this.kv, `verify-ip:${ip}`, 60, 3600);
    return this.auth.verify(email, code, pickLocale(lang));
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Headers('authorization') authz?: string) {
    const token = authz?.startsWith('Bearer ') ? authz.slice(7).trim() : '';
    if (token) await this.auth.logout(token);
  }
}
