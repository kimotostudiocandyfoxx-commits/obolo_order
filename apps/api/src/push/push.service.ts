import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import webpush from 'web-push';
import { AppConfig, CONFIG } from '../config';
import { Database } from '../db/db';
import { appSettings, pushSubscriptions } from '../db/schema';

export type PushPayload = { title: string; body: string; url: string; tag?: string };

/**
 * Web Push (client request 2026-10-08): incoming calls and mail reach a member even when the app is
 * closed. Standard browser push (VAPID) — no Firebase needed. The key pair comes from the env, or the
 * server makes one the first time and keeps it in the DB. iPad / iPhone: only the app added to the
 * Home Screen can receive pushes (Apple's rule).
 */
@Injectable()
export class PushService {
  private readonly log = new Logger('Push');
  private keys: Promise<{ publicKey: string; privateKey: string }> | null = null;

  constructor(
    private readonly db: Database,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {}

  private vapid() {
    this.keys ??= (async () => {
      if (this.cfg.VAPID_PUBLIC_KEY && this.cfg.VAPID_PRIVATE_KEY) return { publicKey: this.cfg.VAPID_PUBLIC_KEY, privateKey: this.cfg.VAPID_PRIVATE_KEY };
      const [row] = await this.db.write.select().from(appSettings).where(eq(appSettings.key, 'vapid'));
      if (row) return JSON.parse(row.value) as { publicKey: string; privateKey: string };
      const made = webpush.generateVAPIDKeys();
      await this.db.write.insert(appSettings).values({ key: 'vapid', value: JSON.stringify(made) }).onConflictDoNothing();
      // another instance may have won the race: use whatever is stored
      const [stored] = await this.db.write.select().from(appSettings).where(eq(appSettings.key, 'vapid'));
      return JSON.parse(stored.value) as { publicKey: string; privateKey: string };
    })().catch((e) => {
      this.keys = null;
      throw e;
    });
    return this.keys;
  }

  async publicKey() {
    return (await this.vapid()).publicKey;
  }

  async subscribe(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    await this.db.write
      .insert(pushSubscriptions)
      .values({ userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth })
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
  }

  async unsubscribe(endpoint: string) {
    await this.db.write.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  /** Send to every device of this member. Never throws (a push is a bonus, not the record). */
  async notify(userId: string, payload: PushPayload) {
    try {
      const subs = await this.db.read.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
      if (!subs.length) return;
      const { publicKey, privateKey } = await this.vapid();
      const gone: string[] = [];
      await Promise.all(
        subs.map((s) =>
          webpush
            .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
              vapidDetails: { subject: this.cfg.VAPID_SUBJECT, publicKey, privateKey },
              TTL: 60,
              urgency: 'high',
            })
            .catch((e: { statusCode?: number }) => {
              // the device turned notifications off or the browser dropped it
              if (e.statusCode === 404 || e.statusCode === 410) gone.push(s.id);
              else this.log.warn(`push failed (${e.statusCode ?? '?'})`);
            }),
        ),
      );
      if (gone.length) await this.db.write.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
    } catch (e) {
      this.log.warn(`push: ${String(e)}`);
    }
  }
}
