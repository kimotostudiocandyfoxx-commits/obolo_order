import {
  BUDDY_FREE_DAILY_MESSAGES,
  JOURNEY_DONE,
  JOURNEY_PAYMENT,
  JOURNEY_WAIT_MS,
  MONTHLY_GRANT_MANA,
  neoVoiceUrl,
  SATURN_LIFETIME_HOURS,
  JUPITER_DEFAULT_BRANCHES,
  JUPITER_FLY_HOURS,
  type JupiterAuthor,
  type JupiterFlyer,
  type JupiterPostView,
  type JupiterReplyView,
  type JupiterRootView,
  type JupiterTreeView,
  type MarsBackstageVideo,
  type BuddyMessageView,
  type BuddyPersona,
  type InviteView,
  type Locale,
  type Me,
  type OrderCheckout,
  type ComposeChatResult,
  type SongDesign,
  type InstrumentalResult,
  type SongEditResult,
  type SongView,
  type PlazaView,
  type SaturnPostView,
  type SaturnProfileView,
  type PuniPicResult,
} from '@obolo/shared';
import { demoBati, demoFromReference, demoNeoLooks, demoRefine } from '@/lib/look';
import { getBlob, putBlob } from './idb';
import { tokenStore } from './token';
import { ApiError, type Api } from './types';

/** Demo ひろば: name, landmark, people already there (the demo has no other members). */
const DEMO_PLAZAS: [string, string, number][] = [
  ['日本', '🏯', 9870],
  ['K-POP好き', '🎤', 6220],
  ['アメリカ', '🗽', 4105],
  ['アニメ好き', '⛩️', 3900],
  ['北海道', '⛄', 2340],
  ['ゲーム好き', '🎮', 1820],
  ['ラーメン好き', '🍜', 1290],
  ['茨城', '🌸', 812],
];

/**
 * DEMO MODE — used when NEXT_PUBLIC_API_URL is empty (e.g. a Vercel preview before Cloud Run
 * is connected). Mirrors the real API contract with browser storage so every "live" planet can
 * be clicked through. Nothing here is the system of record.
 */

interface DemoWalletEntry {
  id: string;
  delta: number;
  reason: string;
  createdAt: string;
}
interface DemoState {
  users: Record<string, Me>; // by id
  sessions: Record<string, string>; // token -> userId
  wallets: Record<string, { mana: number; entries: DemoWalletEntry[]; lastActivity: string }>;
  buddy: Record<string, { name: string; persona: BuddyPersona; memory: string[]; messages: BuddyMessageView[] }>;
  posts: (Omit<SaturnPostView, 'starredByMe'> & { starredBy: string[]; plazaId?: string | null })[];
  quota: Record<string, number>;
  pendingCodes: Record<string, string>;
  /** Saturn follows: follower id → followee ids */
  follows?: Record<string, string[]>;
  /** Jupiter (パタパタ): roots, posts, branch names — this browser only */
  jroots?: (JupiterRootView & { owner: string })[];
  jposts?: (Omit<JupiterPostView, 'author' | 'starredByMe' | 'replyCount' | 'repliers'> & { owner: string; starredBy: string[] })[];
  jreplies?: { id: string; postId: string; owner: string; text: string; createdAt: string }[];
  jbranches?: Record<string, string[]>;
  /** Mars 裏スタジオ (this browser only) */
  backstage?: (MarsBackstageVideo & { owner: string })[];
  /** ひろば (みんな map) and who joined them */
  plazas?: { id: string; name: string; icon: string; members: string[]; base: number }[];
  invites?: Record<string, { code: string; inviterName: string; email: string; status: 'pending' | 'accepted'; createdAt: string; inviterId: string | null }>;
}

/** Demo invitation that always works: /invite/demo (inviter = KIMORIN). */
export const DEMO_INVITE_CODE = 'demo';

// v2: the 8-day journey. Data from older demo builds is discarded so everyone starts at the entry screen.
const KEY = 'obolo.demo.v2';
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());

function seedPosts(): DemoState['posts'] {
  const mk = (min: number, handle: string, name: string, text: string, stars: number) => ({
    id: uid(),
    author: { id: `seed-${handle}`, handle, displayName: name },
    text,
    voiceUrl: `tts:${text}`,
    voiceSource: 'default' as const,
    voiceDurationSec: null,
    starCount: stars,
    starredBy: [],
    createdAt: new Date(Date.now() - min * 60_000).toISOString(),
  });
  return [
    mk(4, 'dj_kimoto', 'DJ KIMOTO', '今夜は新曲のミックス作業中🎧 土星のみんなに一番に聴いてほしいな', 128),
    mk(37, 'hana_sings', 'はな', '朝の散歩で鳥の声を録ってきた。声で投稿できるの、ほんとに楽しい！', 54),
    mk(180, 'leo_space', 'Leo', 'Hello from Singapore! Saturn feels like a radio station made of friends.', 77),
    mk(1440, 'mika88', 'みか', '88円でこんなに遊べるの、すごくない？🪐', 31),
  ];
}

function load(): DemoState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch {
    /* ignore */
  }
  return { users: {}, sessions: {}, wallets: {}, buddy: {}, posts: seedPosts(), quota: {}, pendingCodes: {} };
}

function cannedReply(text: string, name: string, memory: string[], locale: Locale): string {
  const has = (...ws: string[]) => ws.some((w) => text.toLowerCase().includes(w));
  const remembered = memory.length ? memory[Math.floor(Math.random() * memory.length)] : null;
  if (locale === 'en') {
    if (has('hello', 'hi', 'hey')) return `Hey hey! ${name} here 🌙 What's on your mind today?`;
    if (has('tired', 'sleepy')) return `You worked hard today ✨ Want me to play you something chill on Mercury?`;
    if (has('music', 'song')) return `Music! My favourite topic 🎵 What kind of sound are you into lately?`;
    if (remembered && Math.random() < 0.5) return `By the way, you told me before: "${remembered}". I remembered! 😊`;
    return `Ooh, "${text.slice(0, 30)}"! Tell me more ✨`;
  }
  if (has('こんにちは', 'やっほ', 'おはよ', 'こんばん')) return `やっほー！${name}だよ🌙 今日はどんなことがあった？`;
  if (has('疲れ', 'つかれ', '眠', 'ねむ')) return `今日もおつかれさま✨ 水星でゆったりした曲でも聴く？`;
  if (has('音楽', '曲', 'うた', '歌')) return `音楽の話、大好き！🎵 最近どんな曲にハマってる？`;
  if (remembered && Math.random() < 0.5) return `そういえば前に「${remembered}」って言ってたよね。ちゃんと覚えてるよ😊`;
  return `「${text.slice(0, 24)}」かぁ！もっと聞かせて✨`;
}

export class DemoApi implements Api {
  readonly mode = 'demo' as const;
  private s: DemoState = typeof window === 'undefined' ? ({} as DemoState) : load();

  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.s));
    } catch {
      /* quota */
    }
  }
  private uid(): string {
    const t = tokenStore.get();
    const id = t ? this.s.sessions[t] : undefined;
    if (!id || !this.s.users[id]) throw new ApiError(401, 'UNAUTHENTICATED', 'Login required');
    return id;
  }

  /**
   * Demo entry: a member gets a login code; ANY other email is treated as invited by KIMORIN so the
   * demo can be walked without an operator (PLACEHOLDER P-INV-4 — the real API refuses strangers).
   */
  async requestCode(email: string) {
    await sleep(300);
    const e = email.toLowerCase();
    const member = Object.values(this.s.users).some((u) => u.email === e);
    if (!member && !Object.values(this.invites()).some((i) => i.email === e && i.status === 'pending')) {
      const code = Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => b.toString(16).padStart(2, '0')).join('');
      this.invites()[code] = { code, inviterName: 'KIMORIN', email: e, status: 'pending', createdAt: now(), inviterId: null };
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    this.s.pendingCodes[e] = code;
    this.save();
    return { sent: true as const, kind: member ? ('member' as const) : ('invited' as const), devCode: code };
  }

  async verify(email: string, code: string) {
    await sleep(300);
    const e = email.toLowerCase();
    if (this.s.pendingCodes[e] !== code) throw new ApiError(400, 'CODE_INVALID', 'Wrong code');
    delete this.s.pendingCodes[e];
    const user = Object.values(this.s.users).find((u) => u.email === e);
    if (!user) {
      const inv = Object.values(this.invites()).find((i) => i.email === e && i.status === 'pending');
      this.save();
      if (!inv) throw new ApiError(403, 'NOT_INVITED', 'invite-only');
      return { kind: 'invited' as const, inviteCode: inv.code, inviterName: inv.inviterName };
    }
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');
    this.s.sessions[token] = user.id;
    this.save();
    return { kind: 'member' as const, token, user };
  }

  async logout() {
    const t = tokenStore.get();
    if (t) delete this.s.sessions[t];
    this.save();
    tokenStore.clear();
  }

  async me() {
    return this.s.users[this.uid()];
  }

  async updateMe(body: Parameters<Api['updateMe']>[0]) {
    const id = this.uid();
    if (body.handle && Object.values(this.s.users).some((u) => u.handle === body.handle && u.id !== id)) {
      throw new ApiError(409, 'HANDLE_TAKEN', 'taken');
    }
    const u = { ...this.s.users[id], ...Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined)) };
    this.s.users[id] = u;
    for (const p of this.s.posts) if (p.author.id === id) p.author = { id, handle: u.handle, displayName: u.displayName };
    this.save();
    return u;
  }

  async wallet() {
    const w = this.s.wallets[this.uid()];
    const exp = new Date(w.lastActivity);
    exp.setFullYear(exp.getFullYear() + 1);
    return {
      manaBalance: w.mana,
      earningsBalanceJpy: 0,
      manaExpiresAt: w.mana > 0 ? exp.toISOString() : null,
      recent: w.entries.slice(-20).reverse().map((e) => ({ ...e, ledger: 'mana' as const })),
    };
  }

  private buddyOf(id: string) {
    const locale = this.s.users[id]?.locale ?? 'ja';
    this.s.buddy[id] ??= {
      name: locale === 'en' ? 'Bati' : 'バティ',
      persona: { cheer: 80, polite: 30, humor: 65 },
      memory: [],
      messages: [],
    };
    return this.s.buddy[id];
  }

  async buddyProfile() {
    const b = this.buddyOf(this.uid());
    return { buddyName: b.name, persona: b.persona, hasMemory: b.memory.length > 0 };
  }

  async updateBuddyProfile(body: Parameters<Api['updateBuddyProfile']>[0]) {
    const b = this.buddyOf(this.uid());
    if (body.buddyName) b.name = body.buddyName;
    if (body.persona) b.persona = body.persona;
    this.save();
    return this.buddyProfile();
  }

  async buddyMessages(cursor?: string) {
    const msgs = [...this.buddyOf(this.uid()).messages].reverse();
    const start = cursor ? Number(cursor) : 0;
    const items = msgs.slice(start, start + 30);
    return { items, nextCursor: start + 30 < msgs.length ? String(start + 30) : null };
  }

  async buddyQuota() {
    return { usedToday: this.s.quota[`${this.uid()}:${today()}`] ?? 0, freeDaily: BUDDY_FREE_DAILY_MESSAGES };
  }

  async buddyChat(text: string, locale: Locale) {
    const id = this.uid();
    const qk = `${id}:${today()}`;
    const used = (this.s.quota[qk] ?? 0) + 1;
    if (used > BUDDY_FREE_DAILY_MESSAGES) throw new ApiError(429, 'BUDDY_QUOTA', 'quota');
    this.s.quota[qk] = used;
    const b = this.buddyOf(id);
    await sleep(700 + Math.random() * 600);
    const reply = cannedReply(text, b.name, b.memory, locale);
    const t0 = Date.now();
    const userMessage: BuddyMessageView = { id: uid(), role: 'user', text, createdAt: new Date(t0).toISOString() };
    const buddyMessage: BuddyMessageView = { id: uid(), role: 'buddy', text: reply, createdAt: new Date(t0 + 1).toISOString() };
    b.messages.push(userMessage, buddyMessage);
    // Demo "memory": remember short statements the user makes about themselves.
    if (/好き|嫌い|名前|趣味|i like|i love|my name|hobby/i.test(text)) b.memory = [...b.memory, text.slice(0, 40)].slice(-15);
    this.save();
    return { userMessage, reply: buddyMessage, quota: { usedToday: used, freeDaily: BUDDY_FREE_DAILY_MESSAGES } };
  }

  async buddyForget() {
    const b = this.buddyOf(this.uid());
    b.memory = [];
    b.messages = [];
    this.save();
  }

  async uploadVoice(blob: Blob) {
    this.uid();
    const id = uid();
    await putBlob(id, blob);
    return { id, url: `idb:${id}` };
  }

  // demo: no AI — the Mercury screen keeps its offline song maker
  async composeChat(): Promise<ComposeChatResult> {
    throw new ApiError(501, 'DEMO', 'demo');
  }

  async composeDesign(): Promise<SongDesign> {
    throw new ApiError(501, 'DEMO', 'demo');
  }

  async registerVoice(body: { slot: 'self' | 'bati' }) {
    await sleep(800);
    return this.patchMe((u) => ({ voices: { ...(u.voices ?? { self: false, bati: false }), [body.slot]: true } }));
  }

  // demo: no speech recognition here
  async transcribe(): Promise<{ text: string }> {
    await sleep(500);
    return { text: '' };
  }

  async speak(): Promise<{ url: string }> {
    throw new ApiError(501, 'DEMO', 'デモモードでは読み上げできません');
  }

  async composeSing(): Promise<SongView> {
    throw new ApiError(501, 'DEMO', 'demo');
  }

  async composeSongEdit(): Promise<SongEditResult> {
    throw new ApiError(501, 'DEMO', 'demo');
  }

  async composeSongSave(): Promise<SongView> {
    throw new ApiError(501, 'DEMO', 'demo');
  }

  async composeMusicStatus(): Promise<Record<string, unknown>> {
    return { reachable: false, error: 'demo' };
  }

  async composeInstrumental(): Promise<InstrumentalResult> {
    throw new ApiError(501, 'DEMO', 'demo');
  }

  // demo: kept as-is in this browser (no re-encoding)
  async uploadPhoto(blob: Blob) {
    const { id, url } = await this.uploadVoice(blob);
    return { id, url, width: 0, height: 0 };
  }

  async uploadVideo(blob: Blob, maxSeconds: number) {
    const { id, url } = await this.uploadVoice(blob);
    return { id, url, posterUrl: '', seconds: maxSeconds, width: 0, height: 0 };
  }

  private view(p: DemoState['posts'][number], viewer: string): SaturnPostView {
    const { starredBy, ...rest } = p;
    // the author's current look (they may have re-dressed since posting)
    const look = this.s.users[rest.author.id]?.look ?? rest.author.look ?? null;
    return { ...rest, author: { ...rest.author, look }, starredByMe: starredBy.includes(viewer) };
  }

  private plazaList() {
    this.s.plazas ??= DEMO_PLAZAS.map(([name, icon, base], i) => ({ id: `plaza-${i}`, name, icon, members: [], base }));
    return this.s.plazas;
  }

  private plazaView(p: NonNullable<DemoState['plazas']>[number]): PlazaView {
    // the map can be looked at before signing in (previews)
    let viewer = '';
    try {
      viewer = this.uid();
    } catch {
      /* logged out */
    }
    const live = this.s.posts.filter((x) => x.plazaId === p.id && !x.replyToId && Date.now() - new Date(x.createdAt).getTime() < SATURN_LIFETIME_HOURS * 3600_000);
    const faces: PlazaView['faces'] = [];
    for (const x of live) if (faces.length < 7 && !faces.some((f) => f.id === x.author.id)) faces.push({ id: x.author.id, neoForm: x.author.neoForm, look: this.s.users[x.author.id]?.look ?? x.author.look ?? null });
    return { id: p.id, name: p.name, icon: p.icon, memberCount: p.base + p.members.length, voiceCount: live.length, joined: p.members.includes(viewer), faces };
  }

  async plazas(q?: string) {
    const t = q?.trim().toLowerCase();
    return this.plazaList()
      .filter((p) => !t || p.name.toLowerCase().includes(t))
      .map((p) => this.plazaView(p))
      .sort((a, b) => b.memberCount - a.memberCount);
  }

  async plaza(id: string) {
    const p = this.plazaList().find((x) => x.id === id);
    if (!p) throw new ApiError(404, 'NOT_FOUND', 'Plaza not found');
    return this.plazaView(p);
  }

  async createPlaza(body: Parameters<Api['createPlaza']>[0]) {
    const list = this.plazaList();
    const name = body.name.trim().replace(/\s+/g, ' ');
    let p = list.find((x) => x.name === name);
    if (!p) {
      p = { id: `plaza-${uid()}`, name, icon: body.icon, members: [], base: 0 };
      list.push(p);
    }
    return this.joinPlaza(p.id, true);
  }

  async joinPlaza(id: string, on: boolean) {
    const viewer = this.uid();
    const p = this.plazaList().find((x) => x.id === id);
    if (!p) throw new ApiError(404, 'NOT_FOUND', 'Plaza not found');
    p.members = on ? [...new Set([...p.members, viewer])] : p.members.filter((m) => m !== viewer);
    this.save();
    return this.plazaView(p);
  }

  async saturnFeed(cursor?: string, _fresh?: boolean, tab?: 'all' | 'following' | 'friends', limit = 20, plaza?: string) {
    const viewer = this.uid();
    const f = this.s.follows ?? {};
    const mutual = new Set((f[viewer] ?? []).filter((u) => (f[u] ?? []).includes(viewer)));
    const mine = tab === 'friends' ? mutual : new Set([...(f[viewer] ?? []), viewer]);
    const sorted = [...this.s.posts]
      .filter((p) => !p.replyToId && Date.now() - new Date(p.createdAt).getTime() < SATURN_LIFETIME_HOURS * 3600_000 && (plaza ? p.plazaId === plaza : !tab || tab === 'all' || mine.has(p.author.id)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const start = cursor ? Number(cursor) : 0;
    return {
      items: sorted.slice(start, start + limit).map((p) => this.view(p, viewer)),
      nextCursor: start + limit < sorted.length ? String(start + limit) : null,
    };
  }

  async saturnReplies(postId: string) {
    const viewer = this.uid();
    return this.s.posts
      .filter((p) => p.replyToId === postId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((p) => this.view(p, viewer));
  }

  async saturnProfile(userId: string): Promise<SaturnProfileView> {
    const viewer = this.uid();
    const u = this.s.users[userId];
    const posts = this.s.posts.filter((p) => p.author.id === userId && !p.replyToId);
    const a = u ? { id: u.id, handle: u.handle, displayName: u.displayName, neoForm: u.neoForm } : (posts[0]?.author ?? { id: userId, handle: 'neo', displayName: 'NEO' });
    const f = this.s.follows ?? {};
    return {
      user: { ...a, bio: u?.bio ?? '' },
      postCount: posts.length,
      stars: posts.reduce((n, p) => n + p.starCount, 0),
      following: (f[userId] ?? []).length,
      followedByMe: (f[viewer] ?? []).includes(userId),
      isMe: viewer === userId,
    };
  }

  async saturnUserPosts(userId: string) {
    const viewer = this.uid();
    const items = this.s.posts
      .filter((p) => p.author.id === userId && !p.replyToId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((p) => this.view(p, viewer));
    return { items, nextCursor: null };
  }

  async followSaturnUser(userId: string, on: boolean) {
    const viewer = this.uid();
    this.s.follows ??= {};
    const l = new Set(this.s.follows[viewer] ?? []);
    if (on && userId !== viewer) l.add(userId);
    else l.delete(userId);
    this.s.follows[viewer] = [...l];
    this.save();
    return this.saturnProfile(userId);
  }

  async createSaturnPost(body: Parameters<Api['createSaturnPost']>[0]) {
    const id = this.uid();
    const u = this.s.users[id];
    const target = (pid?: string) => (pid ? this.s.posts.find((x) => x.id === pid) : undefined);
    const replyTo = target(body.replyToId);
    const quoted = target(body.repostOfId);
    if (replyTo) replyTo.replyCount = (replyTo.replyCount ?? 0) + 1;
    if (quoted) quoted.repostCount = (quoted.repostCount ?? 0) + 1;
    if (body.plazaId && !replyTo) await this.joinPlaza(body.plazaId, true);
    // demo: the photo stays in this browser, kept as a data URL so an <img> can show it
    const blob = body.photoMediaId ? await getBlob(body.photoMediaId) : null;
    const photoUrl = blob
      ? await new Promise<string>((ok) => {
          const r = new FileReader();
          r.onload = () => ok(String(r.result));
          r.readAsDataURL(blob);
        })
      : null;
    const p = {
      photoUrl,
      plazaId: replyTo ? null : (body.plazaId ?? null),
      replyToId: replyTo ? (replyTo.replyToId ?? replyTo.id) : null,
      repostOf: quoted ? { id: quoted.id, author: quoted.author, text: quoted.text, voiceUrl: quoted.voiceUrl } : null,
      id: uid(),
      author: { id, handle: u.handle, displayName: u.displayName, neoForm: u.neoForm, look: u.look ?? null },
      text: body.text,
      voiceUrl: body.voiceStyle ? neoVoiceUrl(body.voiceStyle, u.neoForm, body.text) : `idb:${body.voiceMediaId}`,
      voiceSource: body.voiceStyle ? ('default' as const) : ('recorded' as const),
      voiceDurationSec: body.voiceDurationSec ?? null,
      starCount: 0,
      starredBy: [],
      createdAt: now(),
    };
    this.s.posts.push(p);
    this.save();
    return this.view(p, id);
  }

  async deleteSaturnPost(postId: string) {
    const id = this.uid();
    this.s.posts = this.s.posts.filter((p) => !(p.id === postId && p.author.id === id));
    this.save();
  }

  async starSaturnPost(postId: string, on: boolean) {
    const id = this.uid();
    const p = this.s.posts.find((x) => x.id === postId);
    if (!p) throw new ApiError(404, 'NOT_FOUND', 'not found');
    const had = p.starredBy.includes(id);
    if (on && !had) {
      p.starredBy.push(id);
      p.starCount++;
    } else if (!on && had) {
      p.starredBy = p.starredBy.filter((x) => x !== id);
      p.starCount = Math.max(0, p.starCount - 1);
    }
    this.save();
    return { starCount: p.starCount, starredByMe: on };
  }

  // ---------------- Invite-only onboarding (demo) ----------------
  private invites() {
    this.s.invites ??= {};
    return this.s.invites;
  }

  async getInvite(code: string): Promise<InviteView> {
    await sleep(200);
    if (code === DEMO_INVITE_CODE) {
      return { code, inviterName: 'KIMORIN', status: 'pending', expiresAt: new Date(Date.now() + 14 * 86400_000).toISOString() };
    }
    const inv = this.invites()[code];
    if (!inv) throw new ApiError(404, 'INVITE_NOT_FOUND', 'not found');
    return { code, inviterName: inv.inviterName, status: inv.status, expiresAt: new Date(Date.parse(inv.createdAt) + 14 * 86400_000).toISOString() };
  }

  async acceptInvite(code: string, displayName: string) {
    await sleep(300);
    const inv = code === DEMO_INVITE_CODE ? null : this.invites()[code];
    if (code !== DEMO_INVITE_CODE && !inv) throw new ApiError(404, 'INVITE_NOT_FOUND', 'not found');
    if (inv?.status === 'accepted') throw new ApiError(409, 'INVITE_USED', 'used');
    const id = uid();
    const user: Me = {
      id,
      // The demo invite has no real email; a placeholder keeps the data model identical.
      email: inv?.email ?? `demo+${id.slice(0, 8)}@example.com`,
      handle: `order_${id.slice(0, 6)}`,
      displayName,
      bio: '',
      country: 'JP',
      locale: 'ja',
      subscriptionStatus: 'demo',
      journeyDay: 1,
      journeyCompletedAt: null,
      neoForm: null,
      avatarUrl: null,
      bati: null,
      orderedAt: null,
      voices: { self: false, bati: false },
      look: null,
      puniPic: null,
      butterfly: null,
      invitedByName: inv?.inviterName ?? 'KIMORIN',
      createdAt: now(),
    };
    this.s.users[id] = user;
    this.s.wallets[id] = {
      mana: MONTHLY_GRANT_MANA,
      lastActivity: now(),
      entries: [{ id: uid(), delta: MONTHLY_GRANT_MANA, reason: 'demo_grant', createdAt: now() }],
    };
    if (inv) inv.status = 'accepted';
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');
    this.s.sessions[token] = id;
    this.save();
    return { token, user, isNew: true };
  }

  private patchMe(fn: (u: Me) => Partial<Me>): Me {
    const id = this.uid();
    this.s.users[id] = { ...this.s.users[id], ...fn(this.s.users[id]) };
    this.save();
    return this.s.users[id];
  }

  async completeJourneyDay(day: number, answers?: Record<string, string>) {
    void answers;
    return this.patchMe((u) => {
      if (u.journeyDay !== day || u.journeyCompletedAt) return {};
      // day 9 (the Eclipse day) ends only after paying
      if (day === JOURNEY_PAYMENT && !u.orderedAt) throw new ApiError(402, 'ORDER_REQUIRED', 'not paid');
      return { journeyCompletedAt: now() };
    });
  }

  async jumpJourney(day: number) {
    return this.patchMe(() => ({ journeyDay: day, journeyCompletedAt: null, ...(day <= JOURNEY_PAYMENT ? { orderedAt: null } : {}) }));
  }

  async advanceJourney(skip: boolean) {
    return this.patchMe((u) => {
      if (!u.journeyCompletedAt || u.journeyDay >= JOURNEY_DONE) return {};
      if (!skip && Date.now() < Date.parse(u.journeyCompletedAt) + JOURNEY_WAIT_MS) throw new ApiError(409, 'NOT_YET', 'not yet');
      return { journeyDay: u.journeyDay + 1, journeyCompletedAt: null };
    });
  }

  // Demo looks: SVG portraits built in the browser (lib/look.ts); 4 candidates, 3 tries.
  async lookCandidates(body: Parameters<Api['lookCandidates']>[0]) {
    const u = this.s.users[this.uid()];
    const key = `obolo.look.tries.${u.id}`;
    const used = Number(localStorage.getItem(key) ?? 0);
    if (u.journeyDay < JOURNEY_DONE && used >= 3) throw new ApiError(429, 'LOOK_TRIES', 'もう作り直せません');
    localStorage.setItem(key, String(used + 1));
    await new Promise((r) => setTimeout(r, 1800));
    const urls =
      'reference' in body
        ? await Promise.all([0, 1, 2, 3].map((v) => demoFromReference(`data:${body.reference.mime};base64,${body.reference.data}`, body, v + used * 4)))
        : demoNeoLooks(body, used);
    this.lookCache = [...this.lookCache, ...urls.map((url) => ({ id: uid(), url }))];
    return { candidates: this.lookCache.slice(-urls.length), triesLeft: u.journeyDay < JOURNEY_DONE ? 3 - (used + 1) : 99, refinesLeft: this.refinesLeft() };
  }

  private refinesLeft() {
    const u = this.s.users[this.uid()];
    return u.journeyDay < JOURNEY_DONE ? Math.max(0, 3 - Number(localStorage.getItem(`obolo.look.refines.${u.id}`) ?? 0)) : 99;
  }

  async refineLook(mediaId: string, instruction: string) {
    const u = this.s.users[this.uid()];
    if (this.refinesLeft() <= 0) throw new ApiError(429, 'LOOK_REFINES', 'もう描き直せません');
    const src = this.lookCache.find((c) => c.id === mediaId);
    if (!src) throw new ApiError(404, 'NOT_FOUND', 'not found');
    const n = 3 - this.refinesLeft();
    localStorage.setItem(`obolo.look.refines.${u.id}`, String(n + 1));
    await new Promise((r) => setTimeout(r, 1500));
    const c = { id: uid(), url: await demoRefine(src.url, instruction, n) };
    this.lookCache.push(c);
    return { candidates: [c], triesLeft: u.journeyDay < JOURNEY_DONE ? Math.max(0, 3 - Number(localStorage.getItem(`obolo.look.tries.${u.id}`) ?? 0)) : 99, refinesLeft: this.refinesLeft() };
  }
  private lookCache: { id: string; url: string }[] = [];

  async chooseLook(mediaId: string) {
    const c = this.lookCache.find((x) => x.id === mediaId);
    if (!c) throw new ApiError(404, 'NOT_FOUND', 'not found');
    return this.patchMe(() => ({ avatarUrl: c.url }));
  }

  // demo: the test pictures stand in for painted candidates
  async puniPicCandidates(): Promise<PuniPicResult> {
    await sleep(900);
    const all = ['salmon', 'gray', 'green', 'purple', 'gorilla'].sort(() => Math.random() - 0.5).slice(0, 2);
    const candidates = all.map((n) => ({ id: uid(), url: `/puni-test/${n}.png` }));
    this.lookCache.push(...candidates);
    return { candidates, left: 99 };
  }

  async choosePuniPic(mediaId: string | null) {
    const url = mediaId ? this.lookCache.find((x) => x.id === mediaId)?.url : null;
    if (mediaId && !url) throw new ApiError(404, 'NOT_FOUND', 'not found');
    return this.patchMe(() => ({ puniPic: url ?? null }));
  }

  // demo: the butterflies cut from the Jupiter mock stand in for painted candidates
  async butterflyCandidates(): Promise<PuniPicResult> {
    await sleep(900);
    const all = ['kitsune', 'usagi', 'onigiri', 'pen_lady', 'wani_queen', 'samurai806'].sort(() => Math.random() - 0.5).slice(0, 2);
    const candidates = all.map((n) => ({ id: uid(), url: `/onboarding/bfb-${n}.webp` }));
    this.lookCache.push(...candidates);
    return { candidates, left: 99 };
  }

  async chooseButterfly(mediaId: string | null) {
    const url = mediaId ? this.lookCache.find((x) => x.id === mediaId)?.url : null;
    if (mediaId && !url) throw new ApiError(404, 'NOT_FOUND', 'not found');
    return this.patchMe(() => ({ butterfly: url ?? null }));
  }

  // --- Jupiter (demo: only the visitor; the sample residents are drawn by the screen) ---
  private jAuthor(id: string): JupiterAuthor {
    const u = this.s.users[id];
    return { id, handle: u?.handle ?? 'neo', displayName: u?.displayName ?? 'NEO', neoForm: u?.neoForm ?? null, butterfly: u?.butterfly ?? null, pic: u?.puniPic ?? null };
  }

  private jView(p: NonNullable<DemoState['jposts']>[number], viewer: string): JupiterPostView {
    const { owner, starredBy, ...rest } = p;
    const replies = (this.s.jreplies ?? []).filter((r) => r.postId === p.id);
    const repliers = [...new Set(replies.map((r) => r.owner).reverse())].slice(0, 3).map((o) => this.jAuthor(o));
    return { ...rest, author: this.jAuthor(owner), starredByMe: starredBy.includes(viewer), replyCount: replies.length, repliers };
  }

  async jupiterSky(tab: 'all' | 'following' | 'friends') {
    const viewer = this.uid();
    const f = this.s.follows ?? {};
    const since = Date.now() - JUPITER_FLY_HOURS * 3600_000;
    const ok = (o: string) => tab === 'all' || o === viewer || (tab === 'following' ? (f[viewer] ?? []).includes(o) : (f[viewer] ?? []).includes(o) && (f[o] ?? []).includes(viewer));
    const flying = (this.s.jposts ?? []).filter((p) => new Date(p.createdAt).getTime() > since && ok(p.owner)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const by = new Map<string, JupiterFlyer>();
    for (const p of flying) {
      const fl = by.get(p.owner) ?? { author: this.jAuthor(p.owner), posts: [] };
      fl.posts.push(this.jView(p, viewer));
      by.set(p.owner, fl);
    }
    return [...by.values()];
  }

  async jupiterRoots() {
    const viewer = this.uid();
    return (this.s.jroots ?? []).filter((r) => r.owner === viewer).map(({ owner: _o, ...r }) => r);
  }

  async addJupiterRoot(body: Parameters<Api['addJupiterRoot']>[0]) {
    const viewer = this.uid();
    const r = { id: uid(), kind: 'photo' as const, url: `idb:${body.mediaId}`, posterUrl: null, createdAt: now(), owner: viewer };
    this.s.jroots = [r, ...(this.s.jroots ?? [])];
    this.save();
    const { owner: _o, ...view } = r;
    return view;
  }

  async removeJupiterRoot(id: string) {
    const viewer = this.uid();
    this.s.jroots = (this.s.jroots ?? []).filter((r) => !(r.id === id && r.owner === viewer));
    this.save();
  }

  async createJupiterPost(body: Parameters<Api['createJupiterPost']>[0]) {
    const viewer = this.uid();
    const root = (this.s.jroots ?? []).find((r) => r.id === body.rootId && r.owner === viewer);
    if (!root) throw new ApiError(404, 'NOT_FOUND', 'not found');
    const p = { id: uid(), owner: viewer, kind: root.kind, url: root.url, posterUrl: root.posterUrl, text: body.text ?? '', filter: body.filter ?? 'none', branch: body.branch, starCount: 0, starredBy: [], createdAt: now() };
    this.s.jposts = [p, ...(this.s.jposts ?? [])];
    this.save();
    return this.jView(p, viewer);
  }

  async starJupiterPost(id: string, on: boolean) {
    const viewer = this.uid();
    const p = (this.s.jposts ?? []).find((x) => x.id === id);
    if (!p) throw new ApiError(404, 'NOT_FOUND', 'not found');
    const has = p.starredBy.includes(viewer);
    if (on && !has) p.starredBy.push(viewer);
    if (!on && has) p.starredBy = p.starredBy.filter((x) => x !== viewer);
    p.starCount = p.starredBy.length;
    this.save();
    return { starCount: p.starCount, starredByMe: on };
  }

  async jupiterReplies(postId: string): Promise<JupiterReplyView[]> {
    return (this.s.jreplies ?? []).filter((r) => r.postId === postId).map((r) => ({ id: r.id, author: this.jAuthor(r.owner), text: r.text, createdAt: r.createdAt }));
  }

  async replyJupiter(postId: string, text: string) {
    const viewer = this.uid();
    const r = { id: uid(), postId, owner: viewer, text: text.trim().slice(0, 120), createdAt: now() };
    this.s.jreplies = [...(this.s.jreplies ?? []), r];
    this.save();
    return { id: r.id, author: this.jAuthor(viewer), text: r.text, createdAt: r.createdAt };
  }

  async jupiterTree(userId: string): Promise<JupiterTreeView> {
    const viewer = this.uid();
    const since = Date.now() - JUPITER_FLY_HOURS * 3600_000;
    const mine = (this.s.jposts ?? []).filter((p) => p.owner === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const f = this.s.follows ?? {};
    return {
      author: this.jAuthor(userId),
      branches: JUPITER_DEFAULT_BRANCHES.map((d, i) => this.s.jbranches?.[userId]?.[i] || d),
      leaves: mine.filter((p) => new Date(p.createdAt).getTime() <= since).map((p) => this.jView(p, viewer)),
      flying: mine.filter((p) => new Date(p.createdAt).getTime() > since).map((p) => this.jView(p, viewer)),
      fruits: mine.reduce((n, p) => n + p.starCount, 0),
      friends: (f[userId] ?? []).filter((o) => (f[o] ?? []).includes(userId)).length,
      followedByMe: (f[viewer] ?? []).includes(userId),
      isMe: viewer === userId,
    };
  }

  async renameJupiterBranch(index: number, name: string) {
    const viewer = this.uid();
    this.s.jbranches ??= {};
    const next = JUPITER_DEFAULT_BRANCHES.map((d, i) => this.s.jbranches?.[viewer]?.[i] || d);
    next[index] = name.trim().slice(0, 8);
    this.s.jbranches[viewer] = next;
    this.save();
    return { branches: next };
  }

  async searchJupiter(q: string) {
    const t = q.trim().toLowerCase();
    return Object.keys(this.s.users)
      .filter((id) => !t || `${this.s.users[id].displayName} ${this.s.users[id].handle}`.toLowerCase().includes(t))
      .map((id) => this.jAuthor(id));
  }

  async marsBackstage() {
    const viewer = this.uid();
    return (this.s.backstage ?? []).filter((v) => v.owner === viewer).map(({ owner: _o, ...v }) => v);
  }

  async keepMarsVideo(body: Parameters<Api['keepMarsVideo']>[0]) {
    const viewer = this.uid();
    const v = { id: uid(), url: `idb:${body.mediaId}`, posterUrl: null, seconds: body.seconds ?? null, title: body.title ?? '', createdAt: now(), owner: viewer };
    this.s.backstage = [v, ...(this.s.backstage ?? [])];
    this.save();
    const { owner: _o, ...view } = v;
    return view;
  }

  async removeMarsVideo(id: string) {
    const viewer = this.uid();
    this.s.backstage = (this.s.backstage ?? []).filter((v) => !(v.id === id && v.owner === viewer));
    this.save();
  }

  async batiEgg(food: string) {
    return this.patchMe(() => ({ bati: { food, name: null, imageUrl: null } }));
  }

  async batiHatch() {
    await new Promise((r) => setTimeout(r, 2500));
    return this.patchMe((u) => (u.bati ? { bati: { ...u.bati, imageUrl: u.bati.imageUrl ?? demoBati(u.bati.food) } } : {}));
  }

  async batiName(name: string) {
    const me = this.patchMe((u) => (u.bati ? { bati: { ...u.bati, name } } : {}));
    this.buddyOf(me.id).name = name;
    this.save();
    return me;
  }

  async orderCheckout(): Promise<OrderCheckout> {
    return { mode: 'demo' };
  }

  async confirmOrder(): Promise<Me> {
    throw new ApiError(409, 'BILLING_DEMO', 'demo');
  }

  async becomeOrder() {
    await sleep(600);
    return this.patchMe((u) => (u.journeyDay === JOURNEY_PAYMENT && !u.orderedAt ? { orderedAt: now(), subscriptionStatus: 'demo' } : {}));
  }

  async myInvites() {
    const id = this.uid();
    return Object.values(this.invites())
      .filter((i) => i.inviterId === id)
      .map((i) => ({
        code: i.code,
        inviterName: i.inviterName,
        status: i.status,
        email: i.email,
        createdAt: i.createdAt,
        expiresAt: new Date(Date.parse(i.createdAt) + 14 * 86400_000).toISOString(),
      }))
      .reverse();
  }

  async createInvite(email: string) {
    const id = this.uid();
    const code = Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => b.toString(16).padStart(2, '0')).join('');
    const inv = { code, inviterName: this.s.users[id].displayName, email, status: 'pending' as const, createdAt: now(), inviterId: id };
    this.invites()[code] = inv;
    this.save();
    return { ...inv, expiresAt: new Date(Date.now() + 14 * 86400_000).toISOString() };
  }
}
