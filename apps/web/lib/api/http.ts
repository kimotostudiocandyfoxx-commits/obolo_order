import type { MvProjectView, TimelinePlanet } from '@obolo/shared';
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
    // operator testing: the admin token lifts the NEO look try limits
    if (path.startsWith('/me/look') || path === '/me/journey/jump') {
      const admin = typeof window !== 'undefined' ? localStorage.getItem('obolo.lookAdmin') : null;
      if (admin) headers['x-admin-token'] = admin;
    }
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
      // suspended by the team (a report review): the app shows a notice over everything
      if (json?.error?.code === 'ACCOUNT_SUSPENDED' && typeof window !== 'undefined') window.dispatchEvent(new Event('obolo:suspended'));
      throw new ApiError(res.status, json?.error?.code ?? 'ERROR', json?.error?.message ?? res.statusText);
    }
    return json as T;
  }

  requestCode(email: string) {
    return this.req<Awaited<ReturnType<Api['requestCode']>>>('POST', '/auth/request-code', { email });
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
    return this.req<Awaited<ReturnType<Api['buddyMessages']>>>('GET', `/buddy/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
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
  composeChat(body: Parameters<Api['composeChat']>[0]) {
    return this.req<Awaited<ReturnType<Api['composeChat']>>>('POST', '/compose/chat', body);
  }
  composeDesign(body: Parameters<Api['composeDesign']>[0]) {
    return this.req<Awaited<ReturnType<Api['composeDesign']>>>('POST', '/compose/design', body);
  }
  composeInstrumental(body: Parameters<Api['composeInstrumental']>[0]) {
    return this.req<Awaited<ReturnType<Api['composeInstrumental']>>>('POST', '/compose/instrumental', body);
  }
  composeMusicStatus() {
    return this.req<Record<string, unknown>>('GET', '/compose/music-status');
  }
  registerVoice(body: Parameters<Api['registerVoice']>[0]) {
    return this.req<Awaited<ReturnType<Api['registerVoice']>>>('POST', '/voice/register', body);
  }
  composeSing(body: Parameters<Api['composeSing']>[0]) {
    return this.req<Awaited<ReturnType<Api['composeSing']>>>('POST', '/compose/sing', body);
  }
  composeSongEdit(id: string, body: Parameters<Api['composeSongEdit']>[1]) {
    return this.req<Awaited<ReturnType<Api['composeSongEdit']>>>('POST', `/compose/songs/${encodeURIComponent(id)}/edit`, body);
  }
  composeSongSave(id: string) {
    return this.req<Awaited<ReturnType<Api['composeSongSave']>>>('POST', `/compose/songs/${encodeURIComponent(id)}/save`);
  }
  transcribe(mediaId: string) {
    return this.req<{ text: string }>('POST', '/voice/transcribe', { mediaId });
  }
  speak(body: Parameters<Api['speak']>[0]) {
    return this.req<Awaited<ReturnType<Api['speak']>>>('POST', '/voice/speak', body);
  }
  uploadPhoto(blob: Blob) {
    return this.req<Awaited<ReturnType<Api['uploadPhoto']>>>('POST', '/media/photo', undefined, blob);
  }
  uploadVideo(blob: Blob, maxSeconds: number) {
    return this.req<Awaited<ReturnType<Api['uploadVideo']>>>('POST', `/media/video?max=${Math.round(maxSeconds)}`, undefined, blob);
  }
  saturnReplies(postId: string) {
    return this.req<Awaited<ReturnType<Api['saturnReplies']>>>('GET', `/saturn/posts/${postId}/replies`);
  }
  saturnProfile(userId: string) {
    return this.req<Awaited<ReturnType<Api['saturnProfile']>>>('GET', `/saturn/users/${userId}`);
  }
  saturnUserPosts(userId: string, cursor?: string) {
    return this.req<Awaited<ReturnType<Api['saturnUserPosts']>>>('GET', `/saturn/users/${userId}/posts${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
  }
  followSaturnUser(userId: string, on: boolean) {
    return this.req<Awaited<ReturnType<Api['followSaturnUser']>>>(on ? 'POST' : 'DELETE', `/saturn/users/${userId}/follow`);
  }
  saturnFeed(cursor?: string, fresh?: boolean, tab?: 'all' | 'following' | 'friends', limit?: number, plaza?: string) {
    const q = new URLSearchParams();
    if (plaza) q.set('plaza', plaza);
    if (cursor) q.set('cursor', cursor);
    if (fresh) q.set('fresh', '1');
    if (tab && tab !== 'all') q.set('tab', tab);
    if (limit) q.set('limit', String(limit));
    const qs = q.toString();
    return this.req<Awaited<ReturnType<Api['saturnFeed']>>>('GET', `/saturn/posts${qs ? `?${qs}` : ''}`);
  }
  plazas(q?: string) {
    return this.req<Awaited<ReturnType<Api['plazas']>>>('GET', `/saturn/plazas${q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  }
  plaza(id: string) {
    return this.req<Awaited<ReturnType<Api['plaza']>>>('GET', `/saturn/plazas/${id}`);
  }
  createPlaza(body: Parameters<Api['createPlaza']>[0]) {
    return this.req<Awaited<ReturnType<Api['createPlaza']>>>('POST', '/saturn/plazas', body);
  }
  joinPlaza(id: string, on: boolean) {
    return this.req<Awaited<ReturnType<Api['joinPlaza']>>>(on ? 'POST' : 'DELETE', `/saturn/plazas/${id}/join`);
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
  completeJourneyDay(day: number, answers?: Record<string, string>) {
    return this.req<Awaited<ReturnType<Api['completeJourneyDay']>>>('POST', '/me/journey/complete', { day, answers });
  }
  jumpJourney(day: number) {
    return this.req<Awaited<ReturnType<Api['jumpJourney']>>>('POST', '/me/journey/jump', { day });
  }
  advanceJourney(skip: boolean) {
    return this.req<Awaited<ReturnType<Api['advanceJourney']>>>('POST', '/me/journey/advance', { skip });
  }
  orderCheckout() {
    return this.req<Awaited<ReturnType<Api['orderCheckout']>>>('POST', '/me/order/checkout');
  }
  confirmOrder(sessionId: string) {
    return this.req<Awaited<ReturnType<Api['confirmOrder']>>>('POST', '/me/order/confirm', { sessionId });
  }
  becomeOrder() {
    return this.req<Awaited<ReturnType<Api['becomeOrder']>>>('POST', '/me/order');
  }
  lookCandidates(body: Parameters<Api['lookCandidates']>[0]) {
    return this.req<Awaited<ReturnType<Api['lookCandidates']>>>('POST', '/me/look/candidates', body);
  }
  refineLook(mediaId: string, instruction: string) {
    return this.req<Awaited<ReturnType<Api['refineLook']>>>('POST', '/me/look/refine', { mediaId, instruction });
  }
  puniPicCandidates(body: Parameters<Api['puniPicCandidates']>[0]) {
    return this.req<Awaited<ReturnType<Api['puniPicCandidates']>>>('POST', '/me/puni/pic/candidates', body);
  }
  butterflyCandidates(body: Parameters<Api['butterflyCandidates']>[0]) {
    return this.req<Awaited<ReturnType<Api['butterflyCandidates']>>>('POST', '/me/butterfly/candidates', body);
  }
  chooseButterfly(mediaId: string | null) {
    return this.req<Awaited<ReturnType<Api['chooseButterfly']>>>('POST', '/me/butterfly', { mediaId });
  }
  jupiterSky(tab: 'all' | 'following' | 'friends') {
    return this.req<Awaited<ReturnType<Api['jupiterSky']>>>('GET', `/jupiter/sky${tab === 'all' ? '' : `?tab=${tab}`}`);
  }
  jupiterRoots() {
    return this.req<Awaited<ReturnType<Api['jupiterRoots']>>>('GET', '/jupiter/roots');
  }
  addJupiterRoot(body: Parameters<Api['addJupiterRoot']>[0]) {
    return this.req<Awaited<ReturnType<Api['addJupiterRoot']>>>('POST', '/jupiter/roots', body);
  }
  async removeJupiterRoot(id: string) {
    await this.req<void>('DELETE', `/jupiter/roots/${id}`);
  }
  createJupiterPost(body: Parameters<Api['createJupiterPost']>[0]) {
    return this.req<Awaited<ReturnType<Api['createJupiterPost']>>>('POST', '/jupiter/posts', body);
  }
  starJupiterPost(id: string, on: boolean) {
    return this.req<Awaited<ReturnType<Api['starJupiterPost']>>>(on ? 'POST' : 'DELETE', `/jupiter/posts/${id}/star`);
  }
  jupiterReplies(postId: string) {
    return this.req<Awaited<ReturnType<Api['jupiterReplies']>>>('GET', `/jupiter/posts/${postId}/replies`);
  }
  replyJupiter(postId: string, text: string) {
    return this.req<Awaited<ReturnType<Api['replyJupiter']>>>('POST', `/jupiter/posts/${postId}/replies`, { text });
  }
  jupiterTree(userId: string) {
    return this.req<Awaited<ReturnType<Api['jupiterTree']>>>('GET', `/jupiter/trees/${userId}`);
  }
  renameJupiterBranch(index: number, name: string) {
    return this.req<Awaited<ReturnType<Api['renameJupiterBranch']>>>('PUT', '/jupiter/branches', { index, name });
  }
  searchJupiter(q: string) {
    return this.req<Awaited<ReturnType<Api['searchJupiter']>>>('GET', `/jupiter/users?q=${encodeURIComponent(q.trim())}`);
  }
  savedSongs() {
    return this.req<Awaited<ReturnType<Api['savedSongs']>>>('GET', '/compose/songs');
  }
  planetSky(planet: TimelinePlanet, tab: 'all' | 'following' | 'friends') {
    return this.req<Awaited<ReturnType<Api['planetSky']>>>('GET', `/planets/${planet}/sky${tab === 'all' ? '' : `?tab=${tab}`}`);
  }
  planetProfile(planet: TimelinePlanet, userId: string) {
    return this.req<Awaited<ReturnType<Api['planetProfile']>>>('GET', `/planets/${planet}/profiles/${userId}`);
  }
  createPlanetPost(planet: TimelinePlanet, body: Parameters<Api['createPlanetPost']>[1]) {
    return this.req<Awaited<ReturnType<Api['createPlanetPost']>>>('POST', `/planets/${planet}/posts`, body);
  }
  starPlanetPost(planet: TimelinePlanet, id: string, on: boolean) {
    return this.req<Awaited<ReturnType<Api['starPlanetPost']>>>(on ? 'POST' : 'DELETE', `/planets/${planet}/posts/${id}/star`);
  }
  planetReplies(planet: TimelinePlanet, id: string) {
    return this.req<Awaited<ReturnType<Api['planetReplies']>>>('GET', `/planets/${planet}/posts/${id}/replies`);
  }
  replyPlanet(planet: TimelinePlanet, id: string, text: string) {
    return this.req<Awaited<ReturnType<Api['replyPlanet']>>>('POST', `/planets/${planet}/posts/${id}/replies`, { text });
  }
  commsStatus() {
    return this.req<Awaited<ReturnType<Api['commsStatus']>>>('GET', '/comms/status');
  }
  commsContacts() {
    return this.req<Awaited<ReturnType<Api['commsContacts']>>>('GET', '/comms/contacts');
  }
  findPerson(handle: string) {
    return this.req<Awaited<ReturnType<Api['findPerson']>>>('GET', `/comms/find?handle=${encodeURIComponent(handle)}`);
  }
  followPerson(id: string, on: boolean) {
    return this.req<Awaited<ReturnType<Api['followPerson']>>>('POST', `/comms/follow/${id}`, { on });
  }
  blockPerson(id: string, on: boolean) {
    return this.req<Awaited<ReturnType<Api['blockPerson']>>>('POST', `/comms/block/${id}`, { on });
  }
  blockedPeople() {
    return this.req<Awaited<ReturnType<Api['blockedPeople']>>>('GET', '/comms/blocked');
  }
  async reportPerson(body: Parameters<Api['reportPerson']>[0]) {
    await this.req('POST', '/comms/report', body);
  }
  dmMessages(peerId: string, after?: string) {
    return this.req<Awaited<ReturnType<Api['dmMessages']>>>('GET', `/comms/messages/${peerId}${after ? `?after=${encodeURIComponent(after)}` : ''}`);
  }
  sendDm(peerId: string, body: { text: string; audioUrl?: string }) {
    return this.req<Awaited<ReturnType<Api['sendDm']>>>('POST', `/comms/messages/${peerId}`, body);
  }
  async readDm(peerId: string) {
    await this.req('POST', `/comms/messages/${peerId}/read`);
  }
  async subscribePush(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    await this.req('POST', '/push/subscribe', sub);
  }
  async unsubscribePush(endpoint: string) {
    await this.req('POST', '/push/unsubscribe', { endpoint });
  }
  firebaseToken() {
    return this.req<Awaited<ReturnType<Api['firebaseToken']>>>('POST', '/comms/firebase-token');
  }
  startCall(to: string) {
    return this.req<Awaited<ReturnType<Api['startCall']>>>('POST', '/comms/calls', { to });
  }
  incomingCalls() {
    return this.req<Awaited<ReturnType<Api['incomingCalls']>>>('GET', '/comms/calls/incoming');
  }
  getCall(id: string) {
    return this.req<Awaited<ReturnType<Api['getCall']>>>('GET', `/comms/calls/${id}`);
  }
  answerCall(id: string) {
    return this.req<Awaited<ReturnType<Api['answerCall']>>>('POST', `/comms/calls/${id}/answer`);
  }
  declineCall(id: string) {
    return this.req<Awaited<ReturnType<Api['declineCall']>>>('POST', `/comms/calls/${id}/decline`);
  }
  endCall(id: string) {
    return this.req<Awaited<ReturnType<Api['endCall']>>>('POST', `/comms/calls/${id}/end`);
  }
  marsBackstage() {
    return this.req<Awaited<ReturnType<Api['marsBackstage']>>>('GET', '/mars/backstage');
  }
  keepMarsVideo(body: Parameters<Api['keepMarsVideo']>[0]) {
    return this.req<Awaited<ReturnType<Api['keepMarsVideo']>>>('POST', '/mars/backstage', body);
  }
  async removeMarsVideo(id: string) {
    await this.req<void>('DELETE', `/mars/backstage/${id}`);
  }
  mvCreate(songId: string) {
    return this.req<MvProjectView>('POST', '/mars/mv', { songId });
  }
  mvGet(id: string) {
    return this.req<MvProjectView>('GET', `/mars/mv/${id}`);
  }
  mvAddMaterial(id: string, body: Parameters<Api['mvAddMaterial']>[1]) {
    return this.req<MvProjectView>('POST', `/mars/mv/${id}/materials`, body);
  }
  mvRemoveMaterial(id: string, mediaId: string) {
    return this.req<MvProjectView>('DELETE', `/mars/mv/${id}/materials/${mediaId}`);
  }
  mvRender(id: string) {
    return this.req<MvProjectView>('POST', `/mars/mv/${id}/render`);
  }
  mvStory(id: string, mood: string) {
    return this.req<MvProjectView>('POST', `/mars/mv/${id}/story`, { mood });
  }
  mvLyrics(id: string) {
    return this.req<MvProjectView>('POST', `/mars/mv/${id}/lyrics`);
  }
  choosePuniPic(mediaId: string | null) {
    return this.req<Awaited<ReturnType<Api['choosePuniPic']>>>('POST', '/me/puni/pic', { mediaId });
  }
  chooseLook(mediaId: string) {
    return this.req<Awaited<ReturnType<Api['chooseLook']>>>('POST', '/me/look', { mediaId });
  }
  batiEgg(food: string) {
    return this.req<Awaited<ReturnType<Api['batiEgg']>>>('POST', '/me/bati/egg', { food });
  }
  batiHatch() {
    return this.req<Awaited<ReturnType<Api['batiHatch']>>>('POST', '/me/bati/hatch');
  }
  batiName(name: string) {
    return this.req<Awaited<ReturnType<Api['batiName']>>>('POST', '/me/bati/name', { name });
  }
  myInvites() {
    return this.req<Awaited<ReturnType<Api['myInvites']>>>('GET', '/invites');
  }
  createInvite(email: string) {
    return this.req<Awaited<ReturnType<Api['createInvite']>>>('POST', '/invites', { email });
  }
}
