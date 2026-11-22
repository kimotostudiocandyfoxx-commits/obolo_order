import { DemoApi, guestBuddyChat, guestBuddyPicture } from './demo';
import { isDemoMode } from '@/lib/onboarding/demoMode';
import { tokenStore } from './token';
import { HttpApi } from './http';
import type { Api } from './types';

export * from './types';
export { tokenStore } from './token';

let instance: Api | null = null;

/** NEXT_PUBLIC_API_URL set → real API on Cloud Run; empty → in-browser demo mode. */
export function getApi(): Api {
  if (!instance) {
    const base = (process.env.NEXT_PUBLIC_API_URL ?? '').trim().replace(/\/$/, '');
    instance = base ? reviewStandIns(new HttpApi(base)) : new DemoApi();
  }
  return instance;
}

/**
 * The review page's story with nobody signed in (DemoDay, not real=1): {bati}'s free chat answers with the demo's stand-ins
 * instead of a 401 (「うまく調べられなかった」) — no AI, no account. Signed in, or anywhere else, the real calls.
 */
function reviewStandIns(api: Api): Api {
  const guest = () => isDemoMode() && !tokenStore.get();
  const chat = api.buddyChat.bind(api);
  const picture = api.buddyPicture.bind(api);
  api.buddyChat = (text, locale) => (guest() ? guestBuddyChat(text, locale) : chat(text, locale));
  api.buddyPicture = (question, answer) => (guest() ? guestBuddyPicture(question) : picture(question, answer));
  return api;
}
