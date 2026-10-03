import { Logger } from '@nestjs/common';
import type { AppConfig } from '../config';

/** PLACEHOLDER (P-AUTH-2): email provider not chosen. "resend" is a provisional adapter. */
export interface EmailSender {
  send(to: string, subject: string, text: string): Promise<void>;
}

export class ConsoleEmailSender implements EmailSender {
  private readonly log = new Logger('Email');
  async send(to: string, subject: string) {
    // Never log the body (contains the login code) outside dev.
    this.log.log(`[console email] to=${to.replace(/(.{2}).*@/, '$1***@')} subject="${subject}"`);
  }
}

export class ResendEmailSender implements EmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}
  async send(to: string, subject: string, text: string) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: this.from, to, subject, text }),
    });
    if (!res.ok) throw new Error(`email send failed: ${res.status}`);
  }
}

export function createEmailSender(cfg: AppConfig): EmailSender {
  if (cfg.EMAIL_DRIVER === 'resend' && cfg.RESEND_API_KEY) return new ResendEmailSender(cfg.RESEND_API_KEY, cfg.EMAIL_FROM);
  return new ConsoleEmailSender();
}
