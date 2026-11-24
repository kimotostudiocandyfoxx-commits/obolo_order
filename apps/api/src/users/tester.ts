import { isActiveMember } from '@obolo/shared';
import { loadConfig } from '../config';

/**
 * The tester entrance (docs/本番の状態.md): who is a tester. The allowlist comes only from the server's environment
 * (TESTER_EMAILS / TESTER_ACCOUNT_IDS, set from GitHub Actions variables), never from the account itself, so nobody can
 * turn it on from the app. Entries are separated by commas, semicolons or spaces; emails compare in any case.
 */
export type TesterConfig = { TESTER_EMAILS?: string; TESTER_ACCOUNT_IDS?: string };

const split = (v: string | undefined) =>
  (v ?? '')
    .split(/[,;\s]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

let memo: { src: string; emails: Set<string>; ids: Set<string> } | undefined;

function lists(cfg: TesterConfig) {
  const src = `${cfg.TESTER_EMAILS ?? ''}|${cfg.TESTER_ACCOUNT_IDS ?? ''}`;
  if (memo?.src !== src) memo = { src, emails: new Set(split(cfg.TESTER_EMAILS)), ids: new Set(split(cfg.TESTER_ACCOUNT_IDS)) };
  return memo;
}

function env(): TesterConfig {
  try {
    return loadConfig();
  } catch {
    return {};
  }
}

export function isTester(u: { id: string; email: string } | null | undefined, cfg: TesterConfig = env()): boolean {
  if (!u) return false;
  const l = lists(cfg);
  if (!l.emails.size && !l.ids.size) return false;
  return l.emails.has(u.email.trim().toLowerCase()) || l.ids.has(u.id.toLowerCase());
}

/**
 * P-BILL-4: an Obolo Order member right now (shared isActiveMember): paid once, and the subscription has not ended
 * (canceled / unpaid …). Testers stay members once joined. Used by every member-only guard in the API.
 */
export function activeMember(u: { id: string; email: string; orderedAt: Date | null; subscriptionStatus: string } | null | undefined, cfg?: TesterConfig): boolean {
  if (!u) return false;
  return isActiveMember({ orderedAt: u.orderedAt, subscriptionStatus: u.subscriptionStatus, tester: isTester(u, cfg) });
}
