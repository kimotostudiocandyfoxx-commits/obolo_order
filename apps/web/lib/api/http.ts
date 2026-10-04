import type { Api } from './types';
import { ApiError } from './types';
import { tokenStore } from './token';

export class HttpApi implements Api {
  readonly mode = 'live' as const;
  constructor(private readonly base: string) {}

  private async req<T>(method: string, path: string, body?: unknown, raw?: Blob): Promise<T> {
    const headers: Record<string, string> = { 'accept-language': document.documentElement.lang || 'ja' };
    const token = tokenStore.get();
    if (token) headers.authorization = `Bearer ${token}`;
    let payload: BodyInit | undefined;
    if (raw) {
      headers['content-type'] = raw.type || 'application/octet-stream';
      payload = raw;
    } else if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, { method, headers, body: payload });
    } catch {
      throw new ApiError(0, 'NETWORK', 'Network error');
    }
    if (res.status === 204) return undefined as T;
    const json = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } | null;
    if (!res.ok) {
      if (res.status === 401) tokenStore.clear();
      throw new ApiError(res.status, json?.error?.code ?? 'ERROR', json?.error?.message ?? res.statusText);
    }
    return json as T;
  }

  requestCode(email: string) {
    return this.req<{ sent: true; devCode?: string }>('POST', '/auth/request-code', { email });
  }
  verify(email: string, code: string) {
    return this.req<Awaited<ReturnType<Api['verify']>>>('POST', '/auth/verify', { email, code });
  }
  async logout() {
    await this.req<void>('POST', '/auth/logout').catch(() => undefined);
    tokenStore.clear();
  }
  me() {
    return this.req<Awaited<ReturnType<Api['me']>>>('GET', '/me');
  }
  updateMe(body: Parameters<Api['updateMe']>[0]) {
    return this.req<Awaited<ReturnType<Api['updateMe']>>>('PATCH', '/me', body);
  }
  wallet() {
    return this.req<Awaited<ReturnType<Api['wallet']>>>('GET', '/wallet');
  }
  buddyProfile() {
    return this.req<Awaited<ReturnType<Api['buddyProfile']>>>('GET', '/buddy/profile');
  }
  updateBuddyProfile(body: Parameters<Api['updateBuddyProfile']>[0]) {
    return this.req<Awaited<ReturnType<Api['updateBuddyProfile']>>>('PATCH', '/buddy/profile', body);
  }
  buddyMessages(cursor?: string) {
    return this.req<Awaited<ReturnType<Api['buddyMessages']>>>(
      'GET',
      `/buddy/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
    );
  }
  buddyQuota() {
    return this.req<Awaited<ReturnType<Api['buddyQuota']>>>('GET', '/buddy/quota');
  }
  buddyChat(text: string, locale: 'ja' | 'en') {
    return this.req<Awaited<ReturnType<Api['buddyChat']>>>('POST', '/buddy/chat', { text, locale });
  }
  buddyForget() {
    return this.req<void>('DELETE', '/buddy/memory');
  }
  uploadVoice(blob: Blob) {
    return this.req<{ id: string; url: string }>('POST', '/media/voice', undefined, blob);
  }
  saturnFeed(cursor?: string, fresh?: boolean) {
    const q = new URLSearchParams();
    if (cursor) q.set('cursor', cursor);
    if (fresh) q.set('fresh', '1');
    const qs = q.toString();
    return this.req<Awaited<ReturnType<Api['saturnFeed']>>>('GET', `/saturn/posts${qs ? `?${qs}` : ''}`);
  }
  createSaturnPost(body: Parameters<Api['createSaturnPost']>[0]) {
    return this.req<Awaited<ReturnType<Api['createSaturnPost']>>>('POST', '/saturn/posts', body);
  }
  deleteSaturnPost(id: string) {
    return this.req<void>('DELETE', `/saturn/posts/${id}`);
  }
  starSaturnPost(id: string, on: boolean) {
    return this.req<{ starCount: number; starredByMe: boolean }>(on ? 'POST' : 'DELETE', `/saturn/posts/${id}/star`);
  }
  getInvite(code: string) {
    return this.req<Awaited<ReturnType<Api['getInvite']>>>('GET', `/invites/${encodeURIComponent(code)}`);
  }
  acceptInvite(code: string, displayName: string) {
    return this.req<Awaited<ReturnType<Api['acceptInvite']>>>('POST', `/invites/${encodeURIComponent(code)}/accept`, { displayName });
  }
  onboardingProgress(stage: 'day1_done', answers?: Record<string, string>) {
    return this.req<Awaited<ReturnType<Api['onboardingProgress']>>>('POST', '/me/onboarding', { stage, answers });
  }
  myInvites() {
    return this.req<Awaited<ReturnType<Api['myInvites']>>>('GET', '/invites');
  }
  createInvite(email: string) {
    return this.req<Awaited<ReturnType<Api['createInvite']>>>('POST', '/invites', { email });
  }
}
