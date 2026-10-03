import { DemoApi } from './demo';
import { HttpApi } from './http';
import type { Api } from './types';

export * from './types';
export { tokenStore } from './token';

let instance: Api | null = null;

/** NEXT_PUBLIC_API_URL set → real API on Cloud Run; empty → in-browser demo mode. */
export function getApi(): Api {
  if (!instance) {
    const base = (process.env.NEXT_PUBLIC_API_URL ?? '').trim().replace(/\/$/, '');
    instance = base ? new HttpApi(base) : new DemoApi();
  }
  return instance;
}
