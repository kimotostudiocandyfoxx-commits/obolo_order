import type { BatiEggKind, BatiRole, Me, MembersDay, LineVoicesBody, LineVoicesView, MvProjectView, StoryResult, TimelinePlanet } from '@obolo/shared';
import type { Api, BuddyChatOpts, Paid } from './types';
import { ApiError } from './types';
import { tokenStore } from './token';

/** ?planet=…&star=1&mark=…&q=… (only what is set) */
function findQs(f: Record<string, string | boolean | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== '' && v !== false) p.set(k, v === true ? '1' : String(v));
  const q = p.toString();
  return q ? `?${q}` : '';
}

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
      // the gem ran dry on a making: one notice for the whole app (components/NoManaNotice.tsx)
      if (json?.error?.code === 'NO_MANA' && typeof window !== 'undefined') window.dispatchEvent(new Event('obolo:nomana'));
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
  async manaPrices() {
    return (await this.req<{ prices: Awaited<ReturnType<Api['manaPrices']>> }>('GET', '/mana/prices')).prices;
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
  buddyChat(text: string, locale: 'ja' | 'en', opts?: BuddyChatOpts) {
    return this.req<Awaited<ReturnType<Api['buddyChat']>>>('POST', '/buddy/chat', { text, locale, ...(opts?.history ? { history: opts.history } : {}), ...(opts?.canMake ? { canMake: true } : {}) });
  }
  /** POST /buddy/chat/stream (Server-Sent Events): `text` pieces, then `done` (the saved reply) or `error` */
  async buddyChatStream(text: string, locale: 'ja' | 'en', onText: (piece: string) => void) {
    const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'text/event-stream' };
    const token = tokenStore.get();
    if (token) headers.authorization = `Bearer ${token}`;
    let res: Response;
    try {
      res = await fetch(`${this.base}/buddy/chat/stream`, { method: 'POST', headers, body: JSON.stringify({ text, locale }) });
    } catch {
      throw new ApiError(0, 'NETWORK', 'Network error');
    }
    if (!res.ok || !res.body) {
      const json = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } | null;
      if (res.status === 401) tokenStore.clear();
      throw new ApiError(res.status, json?.error?.code ?? 'ERROR', json?.error?.message ?? res.statusText);
    }
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let cut: number;
      while ((cut = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, cut);
        buf = buf.slice(cut + 2);
        const event = /^event: (.+)$/m.exec(block)?.[1];
        const data = /^data: (.*)$/m.exec(block)?.[1];
        if (!event || data === undefined) continue;
        const json = JSON.parse(data) as { text?: string; code?: string };
        if (event === 'text' && json.text) onText(json.text);
        else if (event === 'done') return json as unknown as Awaited<ReturnType<Api['buddyChat']>>;
        else if (event === 'error') {
          if (json.code === 'NO_MANA') window.dispatchEvent(new Event('obolo:nomana'));
          throw new ApiError(json.code === 'BUDDY_QUOTA' || json.code === 'BATI_TIRED' ? 429 : json.code === 'BATI_NO_MANA' ? 402 : 503, json.code ?? 'BUDDY_UNAVAILABLE', 'Buddy error');
        }
      }
    }
    throw new ApiError(503, 'BUDDY_UNAVAILABLE', 'The answer was cut off');
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
  getJob(id: string) {
    return this.req<Awaited<ReturnType<Api['getJob']>>>('GET', `/jobs/${id}`);
  }
  activeJobs() {
    return this.req<Awaited<ReturnType<Api['activeJobs']>>>('GET', '/jobs');
  }
  moonSpell(body: Parameters<Api['moonSpell']>[0]) {
    return this.req<Awaited<ReturnType<Api['moonSpell']>>>('POST', '/moon/spell', body);
  }
  incant(body: Parameters<Api['incant']>[0]) {
    return this.req<Awaited<ReturnType<Api['incant']>>>('POST', '/moon/incant', body);
  }
  moonLyrics(body: Parameters<Api['moonLyrics']>[0]) {
    return this.req<Awaited<ReturnType<Api['moonLyrics']>>>('POST', '/moon/lyrics', body);
  }
  songTweak(id: string, body: Parameters<Api['songTweak']>[1]) {
    return this.req<Awaited<ReturnType<Api['songTweak']>>>('POST', `/compose/songs/${id}/tweak`, body);
  }
  songVoiceQuote(id: string) {
    return this.req<Awaited<ReturnType<Api['songVoiceQuote']>>>('POST', `/compose/songs/${id}/voice/quote`, {});
  }
  songVoice(id: string, body: Parameters<Api['songVoice']>[1]) {
    return this.req<Awaited<ReturnType<Api['songVoice']>>>('POST', `/compose/songs/${id}/voice`, body);
  }
  songVoiceUse(id: string, use: Parameters<Api['songVoiceUse']>[1]) {
    return this.req<Awaited<ReturnType<Api['songVoiceUse']>>>('POST', `/compose/songs/${id}/voice/use`, { use });
  }
  compassSpell(body: Parameters<Api['compassSpell']>[0]) {
    return this.req<Awaited<ReturnType<Api['compassSpell']>>>('POST', '/moon/compass', body);
  }
  spellBook() {
    return this.req<Awaited<ReturnType<Api['spellBook']>>>('GET', '/moon/spellbook');
  }
  saveSpell(body: Parameters<Api['saveSpell']>[0]) {
    return this.req<Awaited<ReturnType<Api['saveSpell']>>>('POST', '/moon/spellbook', body);
  }
  renameSpell(id: string, name: string) {
    return this.req<Awaited<ReturnType<Api['renameSpell']>>>('PATCH', `/moon/spellbook/${encodeURIComponent(id)}`, { name });
  }
  usedSpell(id: string) {
    return this.req<Awaited<ReturnType<Api['usedSpell']>>>('POST', `/moon/spellbook/${encodeURIComponent(id)}/used`, {});
  }
  dropSpell(id: string) {
    return this.req<Awaited<ReturnType<Api['dropSpell']>>>('DELETE', `/moon/spellbook/${encodeURIComponent(id)}`);
  }
  novelChapter(body: Parameters<Api['novelChapter']>[0]) {
    return this.req<Awaited<ReturnType<Api['novelChapter']>>>('POST', '/moon/novel/chapter', body);
  }
  books() {
    return this.req<Awaited<ReturnType<Api['books']>>>('GET', '/moon/books');
  }
  book(id: string) {
    return this.req<Awaited<ReturnType<Api['book']>>>('GET', `/moon/books/${id}`);
  }
  gameBuild(body: Parameters<Api['gameBuild']>[0]) {
    return this.req<Awaited<ReturnType<Api['gameBuild']>>>('POST', '/moon/game', body);
  }
  games() {
    return this.req<Awaited<ReturnType<Api['games']>>>('GET', '/moon/games');
  }
  game(id: string) {
    return this.req<Awaited<ReturnType<Api['game']>>>('GET', `/moon/games/${id}`);
  }
  gameBroken(id: string, body: Parameters<Api['gameBroken']>[1]) {
    return this.req<Awaited<ReturnType<Api['gameBroken']>>>('POST', `/moon/games/${id}/broken`, body);
  }
  demoJob({ pay: _pay, ...body }: Parameters<Api['demoJob']>[0]) {
    return this.req<Awaited<ReturnType<Api['demoJob']>>>('POST', '/jobs/demo', body);
  }
  moonWorks(ids?: string[]) {
    return this.req<Awaited<ReturnType<Api['moonWorks']>>>('GET', `/moon/works${ids?.length ? `?ids=${encodeURIComponent(ids.join(','))}` : ''}`);
  }
  createMoonWork(body: Parameters<Api['createMoonWork']>[0]) {
    return this.req<Awaited<ReturnType<Api['createMoonWork']>>>('POST', '/moon/works', body);
  }
  addMoonVersion(id: string, body: Parameters<Api['addMoonVersion']>[1]) {
    return this.req<Awaited<ReturnType<Api['addMoonVersion']>>>('POST', `/moon/works/${encodeURIComponent(id)}/versions`, body);
  }
  setMoonFace(id: string, index: number) {
    return this.req<Awaited<ReturnType<Api['setMoonFace']>>>('PUT', `/moon/works/${encodeURIComponent(id)}/face`, { index });
  }
  dropMoonVersion(id: string, index: number) {
    return this.req<Awaited<ReturnType<Api['dropMoonVersion']>>>('DELETE', `/moon/works/${encodeURIComponent(id)}/versions/${index}`);
  }
  homecomings() {
    return this.req<Awaited<ReturnType<Api['homecomings']>>>('GET', '/moon/homecomings');
  }
  homecomingsTold(keys: string[]) {
    return this.req<void>('POST', '/moon/homecomings/told', { keys });
  }
  composeFullSong(body: Parameters<Api['composeFullSong']>[0]) {
    return this.req<Awaited<ReturnType<Api['composeFullSong']>>>('POST', '/compose/song', body);
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

  lineVoices(body: LineVoicesBody) {
    return this.req<LineVoicesView>('POST', '/voice/lines', body);
  }
  batiSays(text: string) {
    return this.req<{ url: string | null }>('POST', '/voice/bati-says', { text });
  }
  batiVoice(body: Parameters<Api['batiVoice']>[0]) {
    return this.req<Me>('POST', '/voice/bati', body);
  }
  removeBatiVoice() {
    return this.req<Me>('DELETE', '/voice/bati');
  }
  removeLook() {
    return this.req<Me>('DELETE', '/me/look');
  }
  consent(version: string, guardian = false, opts: { media?: boolean; birthYear?: number | null } = {}) {
    return this.req<Me>('POST', '/me/consent', { version, guardian, ...opts });
  }
  voiceStatus() {
    return this.req<{ fish: boolean }>('GET', '/voice/status');
  }
  speak(body: Parameters<Api['speak']>[0]) {
    return this.req<Awaited<ReturnType<Api['speak']>>>('POST', '/voice/speak', body);
  }
  uploadPhoto(blob: Blob) {
    return this.req<Awaited<ReturnType<Api['uploadPhoto']>>>('POST', '/media/photo', undefined, blob);
  }
  startClip(body: Parameters<Api['startClip']>[0]) {
    return this.req<Awaited<ReturnType<Api['startClip']>>>('POST', '/media/files', body);
  }
  /** one piece by XHR (fetch has no upload progress); the token as for every call */
  putClipPart(id: string, n: number, piece: Blob, onProgress?: (sent: number) => void) {
    return new Promise<void>((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('POST', `${this.base}/media/files/${encodeURIComponent(id)}/parts/${n}`);
      const token = tokenStore.get();
      if (token) x.setRequestHeader('authorization', `Bearer ${token}`);
      x.setRequestHeader('content-type', 'application/octet-stream');
      x.upload.onprogress = (e) => onProgress?.(e.loaded);
      x.onload = () => {
        if (x.status >= 200 && x.status < 300) return resolve();
        let j: { error?: { code: string; message: string } } | null;
        try {
          j = JSON.parse(x.responseText) as { error?: { code: string; message: string } } | null;
        } catch {
          j = null;
        }
        if (x.status === 401) tokenStore.clear();
        reject(new ApiError(x.status, j?.error?.code ?? 'ERROR', j?.error?.message ?? x.statusText));
      };
      x.onerror = () => reject(new ApiError(0, 'NETWORK', 'Network error'));
      x.send(piece);
    });
  }
  finishClip(id: string) {
    return this.req<Awaited<ReturnType<Api['finishClip']>>>('POST', `/media/files/${encodeURIComponent(id)}/done`, {});
  }
  clips() {
    return this.req<Awaited<ReturnType<Api['clips']>>>('GET', '/media/files');
  }
  async clipBlob(id: string) {
    const headers: Record<string, string> = {};
    const token = tokenStore.get();
    if (token) headers.authorization = `Bearer ${token}`;
    let res: Response;
    try {
      res = await fetch(`${this.base}/media/files/${encodeURIComponent(id)}`, { headers });
    } catch {
      throw new ApiError(0, 'NETWORK', 'Network error');
    }
    if (!res.ok) throw new ApiError(res.status, res.status === 404 ? 'FILE_NOT_FOUND' : 'ERROR', res.statusText);
    return res.blob();
  }
  async dropClip(id: string) {
    await this.req<unknown>('DELETE', `/media/files/${encodeURIComponent(id)}`);
  }
  unfurl(url: string) {
    return this.req<Awaited<ReturnType<Api['unfurl']>>>('POST', '/links/unfurl', { url });
  }
  lookClip(id: string) {
    return this.req<Awaited<ReturnType<Api['lookClip']>>>('POST', `/media/files/${encodeURIComponent(id)}/look`, {});
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
  publishSaturnPost(id: string) {
    return this.req<Awaited<ReturnType<Api['publishSaturnPost']>>>('POST', `/saturn/posts/${id}/publish`);
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
  completeLap2(chapter: number, answers?: Record<string, string>) {
    return this.req<Awaited<ReturnType<Api['completeLap2']>>>('POST', '/me/lap2/complete', { chapter, answers });
  }

  saveSysStory(answers: Record<string, string>) {
    return this.req<Awaited<ReturnType<Api['saveSysStory']>>>('POST', '/me/story/sys', { answers });
  }

  completeJourneyDay(day: number, answers?: Record<string, string>) {
    // only the words answered: picture addresses (the look, the Bati) are kept elsewhere and are longer than an
    // answer may be (story chat 2026-10-29: day 2 ended in a 400 and started over)
    const short = answers && Object.fromEntries(Object.entries(answers).filter(([k, v]) => k.length <= 40 && typeof v === 'string' && v.length <= 100 && !/^(https?:|data:|blob:)/.test(v)));
    return this.req<Awaited<ReturnType<Api['completeJourneyDay']>>>('POST', '/me/journey/complete', { day, answers: short });
  }
  jumpJourney(day: number | MembersDay) {
    return this.req<Awaited<ReturnType<Api['jumpJourney']>>>('POST', '/me/journey/jump', { day });
  }
  testerUnlockAll() {
    return this.req<Me>('POST', '/me/tester/unlock-all');
  }
  testerMana() {
    return this.req<Me>('POST', '/me/tester/mana');
  }
  testerJump(day: number | MembersDay) {
    return this.req<Me>('POST', '/me/tester/jump', { day });
  }
  testerNext() {
    return this.req<Me>('POST', '/me/tester/next');
  }
  testerReset() {
    return this.req<Me>('POST', '/me/tester/reset');
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
  billingPortal() {
    return this.req<Awaited<ReturnType<Api['billingPortal']>>>('POST', '/billing/portal');
  }
  gemCheckout(gemId: string) {
    return this.req<Awaited<ReturnType<Api['gemCheckout']>>>('POST', `/billing/gems/${encodeURIComponent(gemId)}/checkout`);
  }
  confirmGem(sessionId: string) {
    return this.req<Awaited<ReturnType<Api['confirmGem']>>>('POST', '/billing/gems/confirm', { sessionId });
  }
  lookCandidates(body: Parameters<Api['lookCandidates']>[0]) {
    return this.req<Awaited<ReturnType<Api['lookCandidates']>>>('POST', '/me/look/candidates', body);
  }
  refineLook(mediaId: string | null, instruction: string, magic?: boolean, paid?: Paid) {
    return this.req<Awaited<ReturnType<Api['refineLook']>>>('POST', '/me/look/refine', { ...(mediaId ? { mediaId } : {}), instruction, ...(magic ? { magic } : {}), ...(paid?.confirm ? { via: 'atelier', confirm: paid.confirm, ...(paid.spell ? { spell: paid.spell } : {}) } : {}) });
  }
  puniPicCandidates(body: Parameters<Api['puniPicCandidates']>[0]) {
    return this.req<Awaited<ReturnType<Api['puniPicCandidates']>>>('POST', '/me/puni/pic/candidates', body);
  }
  stickerArt(text: string, style?: string, paid?: Paid) {
    return this.req<{ id: string; url: string }>('POST', '/me/sticker/art', { text, ...(style ? { style } : {}), ...(paid?.confirm ? { from: 'atelier', confirm: paid.confirm, ...(paid.spell ? { spell: paid.spell } : {}) } : {}) });
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
  atelier() {
    return this.req<Awaited<ReturnType<Api['atelier']>>>('GET', '/me/atelier');
  }
  saveAtelier(layout: Parameters<Api['saveAtelier']>[0]) {
    return this.req<Awaited<ReturnType<Api['saveAtelier']>>>('PUT', '/me/atelier', layout);
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
  mvStory(id: string, mood: string, from?: 'atelier', paid?: Paid) {
    return this.req<Awaited<ReturnType<Api['mvStory']>>>('POST', `/mars/mv/${id}/story`, { mood, from, ...(paid?.confirm ? { confirm: paid.confirm, ...(paid.spell ? { spell: paid.spell } : {}) } : {}) });
  }
  mvPictures(id: string, body: Parameters<Api['mvPictures']>[1]) {
    return this.req<Awaited<ReturnType<Api['mvPictures']>>>('POST', `/mars/mv/${id}/pictures`, body);
  }
  mvEdit(id: string, body: Parameters<Api['mvEdit']>[1]) {
    return this.req<Awaited<ReturnType<Api['mvEdit']>>>('POST', `/mars/mv/${id}/edit`, body);
  }
  mvRedraw(id: string, body: Parameters<Api['mvRedraw']>[1]) {
    return this.req<Awaited<ReturnType<Api['mvRedraw']>>>('POST', `/mars/mv/${id}/redraw`, body);
  }
  mvLyrics(id: string) {
    return this.req<Awaited<ReturnType<Api['mvLyrics']>>>('POST', `/mars/mv/${id}/lyrics`);
  }
  dachi() {
    return this.req<Awaited<ReturnType<Api['dachi']>>>('GET', '/dachi');
  }
  dachiThreads() {
    return this.req<Awaited<ReturnType<Api['dachiThreads']>>>('GET', '/dachi/threads');
  }
  dachiMessages(thread: string, page: { before?: string; limit?: number } = {}) {
    const q = new URLSearchParams();
    if (page.before) q.set('before', page.before);
    if (page.limit) q.set('limit', String(page.limit));
    const qs = q.toString();
    return this.req<Awaited<ReturnType<Api['dachiMessages']>>>('GET', `/dachi/threads/${encodeURIComponent(thread)}/messages${qs ? `?${qs}` : ''}`);
  }
  dachiHistory(cursor?: string | null) {
    return this.req<Awaited<ReturnType<Api['dachiHistory']>>>('GET', `/dachi/history${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
  }
  sendDachiMessage(thread: string, body: Parameters<Api['sendDachiMessage']>[1]) {
    return this.req<Awaited<ReturnType<Api['sendDachiMessage']>>>('POST', `/dachi/threads/${encodeURIComponent(thread)}/messages`, body);
  }
  async readDachiThread(thread: string) {
    await this.req('POST', `/dachi/threads/${encodeURIComponent(thread)}/read`, {});
  }
  befriendInviter() {
    return this.req<Awaited<ReturnType<Api['befriendInviter']>>>('POST', '/dachi/inviter', {});
  }
  createDachiLink() {
    return this.req<Awaited<ReturnType<Api['createDachiLink']>>>('POST', '/dachi/link', {});
  }
  peekDachiLink(token: string) {
    return this.req<Awaited<ReturnType<Api['peekDachiLink']>>>('GET', `/dachi/link/${encodeURIComponent(token)}`);
  }
  openDachiLink(token: string) {
    return this.req<Awaited<ReturnType<Api['openDachiLink']>>>('POST', `/dachi/link/${encodeURIComponent(token)}/open`, {});
  }
  dachiLinkAsks() {
    return this.req<Awaited<ReturnType<Api['dachiLinkAsks']>>>('GET', '/dachi/link/asks');
  }
  confirmDachiLink(token: string) {
    return this.req<Awaited<ReturnType<Api['confirmDachiLink']>>>('POST', `/dachi/link/${encodeURIComponent(token)}/confirm`, {});
  }
  async endDachiLink(token: string) {
    await this.req<unknown>('DELETE', `/dachi/link/${encodeURIComponent(token)}`);
  }
  deliver(body: Parameters<Api['deliver']>[0]) {
    return this.req<Awaited<ReturnType<Api['deliver']>>>('POST', '/dachi/deliver', body);
  }
  oshi(kind?: Parameters<Api['oshi']>[0]) {
    return this.req<Awaited<ReturnType<Api['oshi']>>>('GET', `/dachi/oshi${kind ? `?kind=${kind}` : ''}`);
  }
  choosePuniPic(mediaId: string | null) {
    return this.req<Awaited<ReturnType<Api['choosePuniPic']>>>('POST', '/me/puni/pic', { mediaId });
  }
  chooseLook(mediaId: string) {
    return this.req<Awaited<ReturnType<Api['chooseLook']>>>('POST', '/me/look', { mediaId });
  }
  batiEgg(food: string, egg?: BatiEggKind) {
    return this.req<Awaited<ReturnType<Api['batiEgg']>>>('POST', '/me/bati/egg', { food, egg });
  }
  batiNew(egg: BatiEggKind, seed: string) {
    return this.req<Me>('POST', '/me/bati/new', { egg, seed });
  }
  batiSwitch(id: string) {
    return this.req<Me>('POST', '/me/bati/switch', { id });
  }
  batiSpeech(body: { id?: string; call?: string | null; self?: string | null }) {
    return this.req<Me>('POST', '/me/bati/speech', body);
  }
  batiMemory(text: string, id?: string) {
    return this.req<Me>('POST', '/me/bati/memory', { text, id });
  }
  batiForget(memory?: string, id?: string) {
    return this.req<Me>('POST', '/me/bati/memory/forget', { memory, id });
  }
  batiRole(role: BatiRole, id?: string) {
    return this.req<Me>('POST', '/me/bati/role', { role, id });
  }
  batiHatch() {
    return this.req<Awaited<ReturnType<Api['batiHatch']>>>('POST', '/me/bati/hatch');
  }
  lookStandee() {
    return this.req<Awaited<ReturnType<Api['lookStandee']>>>('POST', '/me/look/standee');
  }
  compass(body: Parameters<Api['compass']>[0]) {
    return this.req<Awaited<ReturnType<Api['compass']>>>('POST', '/buddy/compass', body);
  }
  storyCards(said: string) {
    return this.req<{ cards: string[] }>('POST', '/buddy/story', { step: 'cards', said });
  }
  writeStory(cards: string[]) {
    return this.req<StoryResult>('POST', '/buddy/story', { step: 'write', cards });
  }
  lookChibi() {
    return this.req<Awaited<ReturnType<Api['lookChibi']>>>('POST', '/me/look/chibi');
  }
  batiFaces() {
    return this.req<Awaited<ReturnType<Api['batiFaces']>>>('POST', '/me/bati/faces');
  }
  batiRestyle(wish?: string, from?: string, paid?: Paid) {
    return this.req<Awaited<ReturnType<Api['batiRestyle']>>>('POST', '/me/bati/restyle', { ...(wish?.trim() ? { wish } : {}), ...(from ? { from } : {}), ...(paid?.confirm ? { via: 'atelier', confirm: paid.confirm, ...(paid.spell ? { spell: paid.spell } : {}) } : {}) });
  }
  batiLookBack() {
    return this.req<Me>('POST', '/me/bati/restyle/back', {});
  }
  batiLookRestore(url: string) {
    return this.req<Me>('POST', '/me/bati/look/restore', { url });
  }
  lookRestore(url: string) {
    return this.req<Me>('POST', '/me/look/restore', { url });
  }
  chooseBatiRestyle(id: string) {
    return this.req<Awaited<ReturnType<Api['chooseBatiRestyle']>>>('POST', '/me/bati/restyle/choose', { id });
  }
  buddyPicture(question: string, answer?: string) {
    return this.req<Awaited<ReturnType<Api['buddyPicture']>>>('POST', '/buddy/picture', { question, answer });
  }
  batiName(name: string) {
    return this.req<Awaited<ReturnType<Api['batiName']>>>('POST', '/me/bati/name', { name });
  }
  myInvites() {
    return this.req<Awaited<ReturnType<Api['myInvites']>>>('GET', '/invites');
  }
  createInvite(email: string, message?: string, voice?: { mediaId: string; seconds: number }) {
    return this.req<Awaited<ReturnType<Api['createInvite']>>>('POST', '/invites', {
      email,
      ...(message?.trim() ? { message: message.trim() } : {}),
      ...(voice ? { voiceMediaId: voice.mediaId, voiceSeconds: voice.seconds } : {}),
    });
  }

  // Venus — radio
  radioHome() {
    return this.req<Awaited<ReturnType<Api['radioHome']>>>('GET', '/venus');
  }
  radioDeck() {
    return this.req<Awaited<ReturnType<Api['radioDeck']>>>('GET', '/venus/deck');
  }
  setSongRadio(songId: string, allow: boolean) {
    return this.req<{ allowRadio: boolean }>('PUT', `/venus/songs/${songId}/radio`, { allow });
  }
  uploadShow(blob: Blob) {
    return this.req<{ id: string; url: string }>('POST', '/media/show', undefined, blob);
  }
  createRadioShow(body: Parameters<Api['createRadioShow']>[0]) {
    return this.req<Awaited<ReturnType<Api['createRadioShow']>>>('POST', '/venus/shows', body);
  }
  radioHostShows(hostId: string) {
    return this.req<Awaited<ReturnType<Api['radioHostShows']>>>('GET', `/venus/hosts/${hostId}/shows`);
  }

  myRadioShows() {
    return this.req<Awaited<ReturnType<Api['myRadioShows']>>>('GET', '/venus/shows/mine');
  }
  publishRadioShow(id: string, on: boolean) {
    return this.req<Awaited<ReturnType<Api['publishRadioShow']>>>('POST', `/venus/shows/${id}/publish`, { on });
  }
  removeRadioShow(id: string) {
    return this.req<void>('DELETE', `/venus/shows/${id}`);
  }
  radioShow(id: string) {
    return this.req<Awaited<ReturnType<Api['radioShow']>>>('GET', `/venus/shows/${id}`);
  }
  startRadioLive(body: Parameters<Api['startRadioLive']>[0]) {
    return this.req<Awaited<ReturnType<Api['startRadioLive']>>>('POST', '/venus/lives', body);
  }
  radioLive(id: string) {
    return this.req<Awaited<ReturnType<Api['radioLive']>>>('GET', `/venus/lives/${id}`);
  }
  setRadioNow(id: string, now: Parameters<Api['setRadioNow']>[1]) {
    return this.req<Awaited<ReturnType<Api['setRadioNow']>>>('POST', `/venus/lives/${id}/now`, { now });
  }
  endRadioLive(id: string) {
    return this.req<Awaited<ReturnType<Api['endRadioLive']>>>('POST', `/venus/lives/${id}/end`);
  }
  radioMessage(id: string, body: Parameters<Api['radioMessage']>[1]) {
    return this.req<Awaited<ReturnType<Api['radioMessage']>>>('POST', `/venus/lives/${id}/messages`, body);
  }
  hideRadioMessage(liveId: string, messageId: string) {
    return this.req<void>('POST', `/venus/lives/${liveId}/messages/${messageId}/hide`);
  }
  itemMarks() {
    return this.req<Awaited<ReturnType<Api['itemMarks']>>>('GET', '/finds/marks');
  }
  setItemMark(body: Parameters<Api['setItemMark']>[0]) {
    return this.req<Awaited<ReturnType<Api['setItemMark']>>>('POST', '/finds/marks', body);
  }
  setMarkNames(body: Parameters<Api['setMarkNames']>[0]) {
    return this.req<Awaited<ReturnType<Api['setMarkNames']>>>('PUT', '/finds/mark-names', body);
  }
  findWorks(f: Parameters<Api['findWorks']>[0]) {
    return this.req<Awaited<ReturnType<Api['findWorks']>>>('GET', `/finds/works${findQs(f)}`);
  }
  storage() {
    return this.req<Awaited<ReturnType<Api['storage']>>>('GET', '/storage');
  }
  expandStorage(gb: number, confirm: { id: string; price: number }) {
    return this.req<Awaited<ReturnType<Api['expandStorage']>>>('POST', '/storage/expand', { gb, confirm });
  }
  cancelStorage() {
    return this.req<Awaited<ReturnType<Api['cancelStorage']>>>('POST', '/storage/cancel', {});
  }
  async storageTold(what: Parameters<Api['storageTold']>[0]) {
    await this.req('POST', '/storage/told', { what });
  }
  removeWork(kind: string, id: string) {
    return this.req<Awaited<ReturnType<Api['removeWork']>>>('DELETE', `/storage/works/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`);
  }
  findTalkDays(f: Parameters<Api['findTalkDays']>[0]) {
    return this.req<Awaited<ReturnType<Api['findTalkDays']>>>('GET', `/finds/talks${findQs(f)}`);
  }
  planetSong(id: string) {
    return this.req<Awaited<ReturnType<Api['planetSong']>>>('GET', `/planet-works/planet_post/${encodeURIComponent(id)}/song`);
  }
  continentSky(planet: Parameters<Api['continentSky']>[0]) {
    return this.req<Awaited<ReturnType<Api['continentSky']>>>('GET', `/planet-continents/${planet}`);
  }
  continentFavourite(planet: Parameters<Api['continentFavourite']>[0], key: string, on: boolean, slot?: number) {
    return this.req<Awaited<ReturnType<Api['continentFavourite']>>>('PUT', `/planet-continents/${planet}/${encodeURIComponent(key)}/favourite`, slot == null ? { on } : { on, slot });
  }
  continentSearch(planet: Parameters<Api['continentSearch']>[0], q: string, tag?: string | null) {
    const qs = new URLSearchParams({ q, ...(tag ? { tag } : {}) });
    return this.req<Awaited<ReturnType<Api['continentSearch']>>>('GET', `/planet-continents/${planet}/search?${qs}`);
  }
  continentTravel(planet: Parameters<Api['continentTravel']>[0], n?: number) {
    return this.req<Awaited<ReturnType<Api['continentTravel']>>>('GET', `/planet-continents/${planet}/travel${n ? `?n=${n}` : ''}`);
  }
  continentLand(planet: Parameters<Api['continentLand']>[0], key: string) {
    return this.req<Awaited<ReturnType<Api['continentLand']>>>('GET', `/planet-continents/${planet}/${encodeURIComponent(key)}`);
  }
  continentVisit(planet: Parameters<Api['continentVisit']>[0], key: string) {
    return this.req<{ ok: true }>('POST', `/planet-continents/${planet}/${encodeURIComponent(key)}/visit`);
  }
  savePlanetWork(kind: Parameters<Api['savePlanetWork']>[0], id: string, on: boolean) {
    return this.req<{ saved: boolean }>('PUT', `/planet-works/${kind}/${id}/save`, { on });
  }
  hidePlanetWork(kind: Parameters<Api['hidePlanetWork']>[0], id: string, on: boolean) {
    return this.req<{ hidden: boolean }>('POST', `/planet-works/${kind}/${id}/hide`, { on });
  }
  reportPlanetWork(kind: Parameters<Api['reportPlanetWork']>[0], id: string, body: Parameters<Api['reportPlanetWork']>[2]) {
    return this.req<void>('POST', `/planet-works/${kind}/${id}/report`, body);
  }
  planetHome(planet: Parameters<Api['planetHome']>[0]) {
    return this.req<Awaited<ReturnType<Api['planetHome']>>>('GET', `/planet-home/${planet}`);
  }
  planetHomeVisit(planet: Parameters<Api['planetHomeVisit']>[0]) {
    return this.req<{ lastVisitAt: string | null }>('POST', `/planet-home/${planet}/visit`);
  }
  planetHomeOrder(planet: Parameters<Api['planetHomeOrder']>[0], ids: string[]) {
    return this.req<{ ids: string[] }>('PUT', `/planet-home/${planet}/order`, { ids });
  }
  planetHomeTakeOut(planet: Parameters<Api['planetHomeTakeOut']>[0], id: string) {
    return this.req<void>('DELETE', `/planet-home/${planet}/own/${id}`);
  }
  changeables() {
    return this.req<Record<string, string>>('GET', '/changeables');
  }
  setChangeable(id: string, value: string) {
    return this.req<Awaited<ReturnType<Api['setChangeable']>>>('PUT', `/changeables/${encodeURIComponent(id)}`, { value });
  }
  planetHomeColour(planet: Parameters<Api['planetHomeColour']>[0], colour: string) {
    return this.req<{ colour: string }>('PUT', `/planet-home/${planet}/colour`, { colour });
  }
  oshiList() {
    return this.req<Awaited<ReturnType<Api['oshiList']>>>('GET', '/oshi');
  }
  setOshi(userId: string, on: boolean) {
    return this.req<Awaited<ReturnType<Api['setOshi']>>>(on ? 'POST' : 'DELETE', `/oshi/${userId}`);
  }
  reportRadio(body: Parameters<Api['reportRadio']>[0]) {
    return this.req<void>('POST', '/venus/report', body);
  }
  bluenaKept() {
    return this.req<Awaited<ReturnType<Api['bluenaKept']>>>('GET', '/bluena/kept');
  }
  keepInBluena(postId: string, on: boolean) {
    return this.req<{ kept: boolean }>('POST', `/bluena/keep/${postId}`, { on });
  }
}
