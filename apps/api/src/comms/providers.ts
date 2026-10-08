import type { CallJoin } from '@obolo/shared';
import type { AppConfig } from '../config';

/**
 * Earth phone & mail providers (client decision 2026-10-08): Agora carries the call audio,
 * Firebase delivers mail in real time. Each one switches itself on when its keys are set
 * (see docs/earth-comms.md); until then a demo stand-in keeps the whole flow testable.
 */

/** The call audio: who may join which channel. */
export interface CallProvider {
  kind: 'agora' | 'demo';
  join(channel: string, uid: number): CallJoin;
}

/** A call pass lasts this long (seconds). PLACEHOLDER (P-COMMS-4): calls longer than this need a renewed token. */
const CALL_TOKEN_SECONDS = 60 * 60;

class AgoraCalls implements CallProvider {
  kind = 'agora' as const;
  constructor(
    private readonly appId: string,
    private readonly cert: string,
  ) {}
  join(channel: string, uid: number): CallJoin {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RtcTokenBuilder, RtcRole } = require('agora-token') as typeof import('agora-token');
    const token = RtcTokenBuilder.buildTokenWithUid(this.appId, this.cert, channel, uid, RtcRole.PUBLISHER, CALL_TOKEN_SECONDS, CALL_TOKEN_SECONDS);
    return { provider: 'agora', appId: this.appId, channel, token, uid, expiresAt: new Date(Date.now() + CALL_TOKEN_SECONDS * 1000).toISOString() };
  }
}

class DemoCalls implements CallProvider {
  kind = 'demo' as const;
  join(channel: string): CallJoin {
    return { provider: 'demo', channel };
  }
}

export function makeCallProvider(cfg: AppConfig): CallProvider {
  return cfg.AGORA_APP_ID && cfg.AGORA_APP_CERTIFICATE ? new AgoraCalls(cfg.AGORA_APP_ID, cfg.AGORA_APP_CERTIFICATE) : new DemoCalls();
}

/** A message as Firebase stores it (Firestore: dm/{pairKey}/messages/{id}). */
export type RealtimeMessage = { id: string; senderId: string; recipientId: string; kind: string; text: string; audioUrl: string | null; createdAt: string };

/** Real-time delivery of mail. The API keeps every message itself; this only pushes it out. */
export interface MailRealtime {
  kind: 'firebase' | 'poll';
  projectId: string | null;
  deliver(pairKey: string, msg: RealtimeMessage): Promise<void>;
  /** A Firebase sign-in token for this member (their uid = our user id). */
  customToken(userId: string): Promise<string>;
}

class FirebaseMail implements MailRealtime {
  kind = 'firebase' as const;
  projectId: string;
  private app: import('firebase-admin').app.App;
  constructor(opts: { json: string } | { projectId: string; signer?: string }) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require('firebase-admin') as typeof import('firebase-admin');
    const existing = admin.apps.find((a) => a?.name === 'obolo-comms');
    if ('json' in opts) {
      const sa = JSON.parse(opts.json) as { project_id: string };
      this.projectId = sa.project_id;
      this.app = existing ?? admin.initializeApp({ credential: admin.credential.cert(sa as never) }, 'obolo-comms');
    } else {
      // Cloud Run's own service account (no key file); it signs sign-in tokens through IAM
      this.projectId = opts.projectId;
      this.app = existing ?? admin.initializeApp({ projectId: opts.projectId, ...(opts.signer ? { serviceAccountId: opts.signer } : {}) }, 'obolo-comms');
    }
  }
  async deliver(pairKey: string, msg: RealtimeMessage) {
    await this.app.firestore().collection('dm').doc(pairKey).set({ members: pairKey.split('_'), lastAt: msg.createdAt }, { merge: true });
    await this.app.firestore().collection('dm').doc(pairKey).collection('messages').doc(msg.id).set(msg);
  }
  customToken(userId: string) {
    return this.app.auth().createCustomToken(userId);
  }
}

class PollMail implements MailRealtime {
  kind = 'poll' as const;
  projectId = null;
  async deliver() {}
  async customToken(): Promise<string> {
    throw new Error('Firebase is not set up');
  }
}

export function makeMailRealtime(cfg: AppConfig): MailRealtime {
  if (cfg.FIREBASE_SERVICE_ACCOUNT) return new FirebaseMail({ json: cfg.FIREBASE_SERVICE_ACCOUNT });
  if (cfg.FIREBASE_PROJECT_ID) return new FirebaseMail({ projectId: cfg.FIREBASE_PROJECT_ID, signer: cfg.FIREBASE_SIGNER_SA });
  return new PollMail();
}

/** Both members' ids, sorted: the same key from either side. */
export const pairKey = (a: string, b: string) => [a, b].sort().join('_');
