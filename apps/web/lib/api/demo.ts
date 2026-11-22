import {
  KIMORIN_WAIT_LINES,
  MIKIE_WELCOME,
  dachiLine,
  type DachiMessageView,
  type DachiThreadView,
  RADIO_LIVE_STALE_SECONDS,
  type BluenaKeptView,
  type CreateRadioShowBody,
  type RadioDeckSong,
  type RadioHome,
  type RadioLiveState,
  type RadioLiveView,
  type RadioMessageBody,
  type RadioMessageView,
  type RadioNowBody,
  type RadioReportBody,
  type RadioShowView,
  type StartRadioLiveBody,
  isFlying,
  seesOnlyDachi,
  type PlanetWorkKind,
  type PlanetWorkReportBody,
  type DeliveryView,
  EMPTY_ATELIER,
  type AtelierLayout,
  BUDDY_FREE_DAILY_MESSAGES,
  JOURNEY_DONE,
  JOURNEY_PAYMENT,
  JOURNEY_WAIT_MS,
  MAKE_COST,
  BATI_FACES,
  BATI_MAGIC_PER_DAY,
  BATI_RESTYLE_PER_DAY,
  BATI_RESTYLE_TOUCHES,
  LOOK_HISTORY_MAX,
  LAP2,
  lap2Done,
  lap2OpensAt,
  type MakeKind,
  STARTER_GEM_MANA,
  neoVoiceUrl,
  SATURN_LIFETIME_HOURS,
  nextJourneyDay,
  JUPITER_DEFAULT_BRANCHES,
  JUPITER_FLY_HOURS,
  type JupiterAuthor,
  type JupiterFlyer,
  type JupiterPostView,
  type JupiterReplyView,
  type JupiterRootView,
  type JupiterTreeView,
  type MarsBackstageVideo,
  type PlanetAuthor,
  type PlanetFlyer,
  type PlanetPostView,
  type PlanetProfileView,
  type PlanetReplyView,
  type TimelinePlanet,
  type BuddyMessageView,
  type BuddyPersona,
  type InviteView,
  type Locale,
  type Me,
  type OrderCheckout,
  type ComposeChatBody,
  type ComposeChatResult,
  type SongDesign,
  type InstrumentalResult,
  type SongEditResult,
  type SongView,
  type PlazaView,
  type SaturnPostView,
  type SaturnProfileView,
  type PuniPicResult,
  type BatiRestyleResult,
  isChild,
  lookWishCategory,
  type BatiEggKind,
  type BatiRole,
  callRequest,
  memoryRefusal,
  MEMORY_LINES,
  rememberRequest,
} from '@obolo/shared';
import { demoEggOf, demoBatiEgg, demoBatiForget, demoBatiMemory, demoBatiNew, demoBatiRole, demoBatiSpeech, demoBatiSwitch, demoBatiSync } from './demoBati';
import { demoBati, demoFromReference, demoNeoLooks, demoRefine, demoStickerArt } from '@/lib/look';
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
  /** the inviter became a dachi (Saturn D04-S005c) */
  dachiInviter?: boolean;
  /** when D04-S005c happened (the ダチ threads show from then, M-R212) */
  dachiAt?: string;
  /** ダチの声のメッセージ in this browser (`thread` = 'demo-inviter' | 'kimorin' | 'mikie') */
  dachiMsgs?: (DachiMessageView & { thread: string; lineId?: string; read?: boolean })[];
  /** works delivered to the dachi (〔推し〕) */
  deliveries?: DeliveryView[];
  /** Jupiter (パタパタ): roots, posts, branch names — this browser only */
  jroots?: (JupiterRootView & { owner: string })[];
  jposts?: (Omit<JupiterPostView, 'author' | 'starredByMe' | 'replyCount' | 'repliers'> & { owner: string; starredBy: string[] })[];
  jreplies?: { id: string; postId: string; owner: string; text: string; createdAt: string }[];
  jbranches?: Record<string, string[]>;
  /** Mercury / Mars posts (this browser only) */
  pposts?: (Omit<PlanetPostView, 'author' | 'starredByMe' | 'repliers'> & { owner: string; starredBy: string[] })[];
  preplies?: { id: string; postId: string; owner: string; text: string; createdAt: string }[];
  /** Mars 裏スタジオ (this browser only) */
  backstage?: (MarsBackstageVideo & { owner: string })[];
  ateliers?: Record<string, AtelierLayout>;
  /** ひろば (みんな map) and who joined them */
  plazas?: { id: string; name: string; icon: string; members: string[]; base: number; owner?: string }[];
  /** Venus radio (this browser only) */
  radioShows?: (Omit<RadioShowView, 'host' | 'mine'> & { owner: string })[];
  radioLives?: (Omit<RadioLiveView, 'host' | 'mine'> & { owner: string; beat: number })[];
  radioMessages?: (Omit<RadioMessageView, 'from' | 'mine'> & { liveId: string; owner: string; hidden?: boolean })[];
  radioPerm?: Record<string, boolean>;
  /** M-R213: works each member chose 〔見えなくする〕 on (`kind:id`) */
  workHides?: Record<string, string[]>;
  bluenaKeeps?: Record<string, string[]>;
  invites?: Record<string, { code: string; inviterName: string; email: string; status: 'pending' | 'accepted'; createdAt: string; inviterId: string | null; message?: string | null }>;
}

/** Venus radio samples: the gorilla trio's shows on the demo Venus (their own pictures, no new art). */
const RADIO_RESIDENTS: Record<string, { handle: string; name: string; pic: string }> = {
  'seed-bossg': { handle: 'bossg', name: 'ボスG', pic: '/onboarding/bossg-face.webp' },
  'seed-hatg': { handle: 'hatg', name: 'ハットG', pic: '/onboarding/hatg-face.webp' },
  'seed-longg': { handle: 'longg', name: 'ロングG', pic: '/onboarding/longg-face.webp' },
};
const RADIO_SAMPLE_SONGS: RadioDeckSong[] = [
  { id: 'sample-kimorin-1', title: 'KIMORIN⭐︎の水星の歌', url: '/onboarding/kimorin-mercury-1.m4a', bpm: null, seconds: 0, by: 'KIMORIN⭐︎', byId: null, from: 'sample' },
  { id: 'sample-kimorin-2', title: 'KIMORIN⭐︎の推しの歌', url: '/onboarding/kimorin-mercury-2.m4a', bpm: null, seconds: 0, by: 'KIMORIN⭐︎', byId: null, from: 'sample' },
  { id: 'sample-venus', title: '金星のテーマ', url: '/onboarding/bgm-venus.m4a', bpm: null, seconds: 0, by: 'ゴリラ3人組', byId: null, from: 'sample' },
  { id: 'sample-practice', title: '練習用のリズム', url: '/onboarding/bgm-dj-practice.m4a', bpm: null, seconds: 0, by: 'OBOLO', byId: null, from: 'sample' },
];
const RADIO_DEMO_VISITS: { who: string; kind: 'comment' | 'request'; text: string; song?: { postId: string; title: string; by: string } }[] = [
  { who: 'seed-hatg', kind: 'comment', text: 'きこえてるぜ〜！' },
  { who: 'seed-longg', kind: 'request', text: 'つぎ、これかけて', song: { postId: 'sample-kimorin-2', title: 'KIMORIN⭐︎の推しの歌', by: 'KIMORIN⭐︎' } },
  { who: 'seed-bossg', kind: 'comment', text: 'いい声だ。バナナがすすむ' },
];
function seedRadioShows(): NonNullable<DemoState['radioShows']> {
  const at = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
  return [
    { id: crypto.randomUUID(), title: 'ボスGの真夜中バナナ放送', thumbUrl: '/onboarding/bossg.webp', loop: 'drift', audioUrl: '/onboarding/bgm-venus.m4a', seconds: 95, cues: [{ at: 4, songId: 'sample-venus', title: '金星のテーマ', by: 'ゴリラ3人組', byId: null }], status: 'public', source: 'recorded', createdAt: at(5), publishedAt: at(5), owner: 'seed-bossg' },
    { id: crypto.randomUUID(), title: 'ロングGの歯みがきラジオ', thumbUrl: '/onboarding/longg.webp', loop: 'ripple', audioUrl: '/onboarding/bgm-dj-practice.m4a', seconds: 60, cues: [{ at: 0, songId: 'sample-practice', title: '練習用のリズム', by: 'OBOLO', byId: null }], status: 'public', source: 'live', createdAt: at(30), publishedAt: at(30), owner: 'seed-longg' },
    // back in its owner's booth (more than 88 hours since it was published, M-R208)
    { id: crypto.randomUUID(), title: 'ボスGの朝のバナナ体操', thumbUrl: '/onboarding/bossg.webp', loop: 'pulse', audioUrl: '/onboarding/bgm-venus.m4a', seconds: 80, cues: [], status: 'public', source: 'recorded', createdAt: at(120), publishedAt: at(120), owner: 'seed-bossg' },
  ];
}
function seedRadioLives(): NonNullable<DemoState['radioLives']> {
  return [{ id: crypto.randomUUID(), title: 'ハットGのスプレー相談室', thumbUrl: '/onboarding/hatg.webp', loop: 'stars', status: 'live', now: { songId: 'sample-kimorin-1', title: 'KIMORIN⭐︎の水星の歌', by: 'KIMORIN⭐︎', byId: null }, startedAt: new Date(Date.now() - 18 * 60_000).toISOString(), transport: 'test', owner: 'seed-hatg', beat: Date.now() }];
}

/** Demo invitation that always works: /invite/demo (inviter = MIKIE⭐︎DRILL, the very first inviter). */
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
  /**
   * M-R213 (the server's planetWorkScope): may the viewer see this work on a planet — own, a dachi's, or a stranger's
   * when the viewer is 15 or over (a missing birth year counts as under 15); never one they hid.
   */
  private seesWork(kind: PlanetWorkKind, id: string, owner: string): boolean {
    const viewer = this.uid();
    if (owner === viewer) return true;
    if ((this.s.workHides?.[viewer] ?? []).includes(`${kind}:${id}`)) return false;
    const f = this.s.follows ?? {};
    const dachi = ((f[viewer] ?? []).includes(owner) && (f[owner] ?? []).includes(viewer)) || (owner === 'demo-inviter' && !!this.s.dachiInviter);
    return dachi || !seesOnlyDachi(this.s.users[viewer]?.birthYear);
  }

  async hidePlanetWork(kind: PlanetWorkKind, id: string, on: boolean) {
    const viewer = this.uid();
    const key = `${kind}:${id}`;
    const l = new Set(this.s.workHides?.[viewer] ?? []);
    if (on) l.add(key);
    else l.delete(key);
    this.s.workHides = { ...(this.s.workHides ?? {}), [viewer]: [...l] };
    this.save();
    return { hidden: on };
  }

  async reportPlanetWork(_kind: PlanetWorkKind, _id: string, _body: PlanetWorkReportBody) {
    await sleep(300);
  }

  private uid(): string {
    const t = tokenStore.get();
    const id = t ? this.s.sessions[t] : undefined;
    if (!id || !this.s.users[id]) throw new ApiError(401, 'UNAUTHENTICATED', 'Login required');
    return id;
  }

  /**
   * Demo entry: a member gets a login code; ANY other email is treated as invited by MIKIE⭐︎DRILL so the
   * demo can be walked without an operator (PLACEHOLDER P-INV-4 — the real API refuses strangers).
   */
  async requestCode(email: string) {
    await sleep(300);
    const e = email.toLowerCase();
    const member = Object.values(this.s.users).some((u) => u.email === e);
    if (!member && !Object.values(this.invites()).some((i) => i.email === e && i.status === 'pending')) {
      const code = Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => b.toString(16).padStart(2, '0')).join('');
      this.invites()[code] = { code, inviterName: 'MIKIE⭐︎DRILL', email: e, status: 'pending', createdAt: now(), inviterId: null };
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
    const u = this.s.users[this.uid()];
    // M-R231: the egg's day is worked out each time (it grows every day)
    return u?.bati ? { ...u, batiEgg: demoEggOf(u) } : u;
  }

  async updateMe(body: Parameters<Api['updateMe']>[0]) {
    const id = this.uid();
    if (body.handle && Object.values(this.s.users).some((u) => u.handle === body.handle && u.id !== id)) {
      throw new ApiError(409, 'HANDLE_TAKEN', 'taken');
    }
    const prev = this.s.users[id];
    const u = { ...prev, ...Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined)) };
    // the birth year is set once, like the server (M-R150)
    if (prev.birthYear) u.birthYear = prev.birthYear;
    if (u.birthYear) u.child = isChild(u.birthYear);
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
      recent: w.entries
        .slice(-20)
        .reverse()
        .map((e) => ({ ...e, ledger: 'mana' as const })),
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
    // the member's own {bati}, named on the Moon, speaks under its own name (story chat 2026-11-02)
    const own = this.s.users[id]?.bati?.name;
    if (own) this.s.buddy[id].name = own;
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
    // M-R208 offline: "〜の絵を見せて" brings a local picture, a question a made-up source link (no network)
    const drawn = /絵|描いて|見た目|picture|draw/i.test(text);
    const looked = !drawn && /[?？]|いつ|どこ|なに|何|いくつ|ニュース|天気/.test(text);
    // M-R222: only the member's own 「覚えといて」 keeps something (the same rules as the server); 「〇〇って呼んで」 the 呼び方
    const ask = this.s.users[id]?.bati ? rememberRequest(text) : null;
    const call = ask ? null : this.s.users[id]?.bati ? callRequest(text) : null;
    let said: string | null = null;
    let remembered: BuddyMessageView['remembered'];
    if (ask) {
      try {
        this.patchMe((u) => demoBatiMemory(u, ask));
        said = MEMORY_LINES.kept;
        remembered = { text: ask, result: 'kept' };
      } catch (e) {
        const code = e instanceof ApiError ? e.code : '';
        remembered = { text: ask, result: code === 'MEMORY_FULL' ? 'full' : code === 'MEMORY_ALREADY' ? 'already' : 'refused' };
        said = code === 'MEMORY_FULL' ? MEMORY_LINES.full : code === 'MEMORY_ALREADY' ? 'それ、もう、覚えてるよ！' : MEMORY_LINES.refuse.replace('{neo}', this.s.users[id]?.displayName ?? '');
      }
    } else if (call && !memoryRefusal(call, { birthYear: this.s.users[id]?.birthYear ?? null })) {
      this.patchMe((u) => demoBatiSpeech(u, { call }));
      said = `わかった！　これからは、${call}って呼ぶね！`;
    }
    const reply = said ?? (drawn ? (locale === 'en' ? 'I drew it for you!' : '絵を描いてみたよ！') : cannedReply(text, b.name, b.memory, locale));
    const t0 = Date.now();
    const userMessage: BuddyMessageView = { id: uid(), role: 'user', text, createdAt: new Date(t0).toISOString() };
    const buddyMessage: BuddyMessageView = {
      id: uid(),
      role: 'buddy',
      text: reply,
      createdAt: new Date(t0 + 1).toISOString(),
      ...(drawn ? { image: { url: '/onboarding/s/rocket-space.jpg' } } : {}),
      ...(remembered ? { remembered } : {}),
      ...(looked ? { sources: [{ title: 'デモのページ（本番は調べたページ）', url: 'https://example.com/', domain: 'example.com' }] } : {}),
    };
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

  async voiceStatus() {
    return { fish: false };
  }

  async uploadVoice(blob: Blob) {
    this.uid();
    const id = uid();
    await putBlob(id, blob);
    return { id, url: `idb:${id}` };
  }

  // demo: no AI — the Mercury screen keeps its offline song maker
  /** demo: a short varied reply that picks up a word of what was said (no parroting the same line, story chat 2026-11-02) */
  async composeChat(body: ComposeChatBody): Promise<ComposeChatResult> {
    await sleep(700);
    const said = body.history.filter((h) => h.role === 'user');
    const last = (said[said.length - 1]?.text ?? '').trim();
    const bit = last.replace(/[。、！？!?\s]/g, '').slice(0, 12);
    const b = body.isBati;
    const lines = b
      ? [`「${bit}」、いいね！ それって、どんな気持ちのとき？`, `わかる〜。${bit}って、ワクワクする感じ？ それとも、しんみり？`, `いい歌になりそう！ もうひとつだけ。だれに聴いてほしい？`, `${bit}、メモしたよ！ そろそろ作れそう。ジャンルを選んで！`]
      : [`「${bit}」か、いいケン！ それはどんな気分のときだ？`, `${bit}……ノれる感じか？ しっとり系か？`, `いい歌になりそうだケン！ だれに届けたい？`, `${bit}、もらったケン！ ジャンルを選べ！`];
    return { reply: lines[Math.min(said.length - 1, lines.length - 1)] ?? lines[0], ready: said.length >= 2 };
  }

  async composeDesign(): Promise<SongDesign> {
    throw new ApiError(501, 'DEMO', 'demo');
  }

  async registerVoice(body: { slot: 'self' | 'bati' | 'kororin' }) {
    await sleep(800);
    return this.patchMe((u) => ({ voices: { ...(u.voices ?? { self: false, bati: false }), [body.slot]: true } }));
  }

  // demo: no speech recognition here
  async transcribe(): Promise<{ text: string }> {
    await sleep(500);
    return { text: '' };
  }

  // demo: no voices are made here (the lines with names stay silent)
  async lineVoices(): Promise<{ voices: Record<string, string>; pending: number }> {
    return { voices: {}, pending: 0 };
  }

  async batiSays(): Promise<{ url: string | null }> {
    return { url: null };
  }
  async speak(): Promise<{ url: string }> {
    throw new ApiError(501, 'DEMO', 'デモモードでは読み上げできません');
  }

  async composeFullSong(): Promise<never> {
    throw new ApiError(501, 'DEMO', 'demo');
  }

  async getJob(): Promise<never> {
    throw new ApiError(501, 'DEMO', 'demo');
  }

  async activeJobs() {
    return { jobs: [] };
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
    for (const x of live)
      if (faces.length < 7 && !faces.some((f) => f.id === x.author.id)) faces.push({ id: x.author.id, neoForm: x.author.neoForm, look: this.s.users[x.author.id]?.look ?? x.author.look ?? null });
    return { id: p.id, name: p.name, icon: p.icon, memberCount: p.base + p.members.length, voiceCount: live.length, joined: p.members.includes(viewer), faces, access: p.owner ? 'me' : 'open' };
  }

  async plazas(q?: string) {
    const t = q?.trim().toLowerCase();
    let viewer = '';
    try {
      viewer = this.uid();
    } catch {
      /* logged out */
    }
    return this.plazaList()
      .filter((p) => (!p.owner || p.owner === viewer) && (!t || p.name.toLowerCase().includes(t)))
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
    // 'me': the maker's own (L2-SATURN-S004), never shared by name
    const owner = body.access === 'me' ? this.uid() : undefined;
    let p = owner ? undefined : list.find((x) => x.name === name && !x.owner);
    if (!p) {
      p = { id: `plaza-${uid()}`, name, icon: body.icon, members: [], base: 0, owner };
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
      .filter((p) => !p.replyToId && !p.room && Date.now() - new Date(p.createdAt).getTime() < SATURN_LIFETIME_HOURS * 3600_000 && (plaza ? p.plazaId === plaza : !tab || tab === 'all' || mine.has(p.author.id)) && this.seesWork('saturn_post', p.id, p.author.id))
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
      followedByMe: (f[viewer] ?? []).includes(userId),
      isMe: viewer === userId,
    };
  }

  async saturnUserPosts(userId: string) {
    const viewer = this.uid();
    // your own page is your room: everything you made stays; others see what is still on the planet
    const own = viewer === userId;
    const items = this.s.posts
      .filter((p) => p.author.id === userId && !p.replyToId && (own || (!p.room && Date.now() - new Date(p.createdAt).getTime() < SATURN_LIFETIME_HOURS * 3600_000 && this.seesWork('saturn_post', p.id, p.author.id))))
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
    const room = !!body.room && !replyTo;
    if (body.plazaId && !replyTo && !room) await this.joinPlaza(body.plazaId, true);
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
      plazaId: replyTo || room ? null : (body.plazaId ?? null),
      room,
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

  async publishSaturnPost(postId: string) {
    const id = this.uid();
    const p = this.s.posts.find((x) => x.id === postId && x.author.id === id && x.room && !x.replyToId);
    if (!p) throw new ApiError(404, 'NOT_FOUND', 'not found');
    p.room = false;
    p.createdAt = now();
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
      return { code, inviterName: 'MIKIE⭐︎DRILL', status: 'pending', expiresAt: new Date(Date.now() + 14 * 86400_000).toISOString() };
    }
    const inv = this.invites()[code];
    if (!inv) throw new ApiError(404, 'INVITE_NOT_FOUND', 'not found');
    return { code, inviterName: inv.inviterName, inviterMessage: inv.message ?? null, status: inv.status, expiresAt: new Date(Date.parse(inv.createdAt) + 14 * 86400_000).toISOString() };
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
      invitedByName: inv?.inviterName ?? 'MIKIE⭐︎DRILL',
      invitedByMessage: inv?.message ?? null,
      createdAt: now(),
    };
    this.s.users[id] = user;
    this.s.wallets[id] = {
      mana: STARTER_GEM_MANA,
      lastActivity: now(),
      entries: [{ id: uid(), delta: STARTER_GEM_MANA, reason: 'starter_gem', createdAt: now() }],
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

  async saveSysStory(answers: Record<string, string>) {
    return this.patchMe((u) => ({ story: { ...(u.story ?? {}), ...Object.fromEntries(Object.entries(answers).map(([k, v]) => [`sys.${k}`, v])) } }));
  }

  async completeJourneyDay(day: number, answers?: Record<string, string>) {
    return this.patchMe((u) => {
      if (u.journeyDay !== day || u.journeyCompletedAt) return {};
      // what was made today, for the next days' stories (like the server's onboardingJson)
      const story = { ...(u.story ?? {}), ...Object.fromEntries(Object.entries(answers ?? {}).map(([k, v]) => [`d${day}.${k}`, v])) };
      // M-R231: the first journey's last day done — the app's day 9 (the 2nd egg's morning) opens after the day's wait
      if (day === 8 && !story['eggs.day9']) story['eggs.day9'] = new Date(Date.now() + 24 * 3_600_000).toISOString();
      return { journeyCompletedAt: now(), story };
    });
  }

  async completeLap2(chapter: number, answers?: Record<string, string>) {
    return this.patchMe((u) => {
      if (!u.orderedAt || chapter !== lap2Done(u.story)) return {};
      // like the API: each day opens 24 h after the one before (no skipping)
      const opens = lap2OpensAt(u.story);
      if (opens !== null && Date.now() < opens) throw new ApiError(409, 'NOT_YET', 'not yet');
      const id = LAP2[chapter].id;
      return { story: { ...(u.story ?? {}), ...Object.fromEntries(Object.entries(answers ?? {}).map(([k, v]) => [`l2.${id}.${k}`, v])), 'l2.done': String(chapter + 1), 'l2.at': now() } };
    });
  }

  async jumpJourney(day: number) {
    return this.patchMe(() => ({ journeyDay: day, journeyCompletedAt: null, ...(day <= JOURNEY_PAYMENT ? { orderedAt: null } : {}) }));
  }

  async advanceJourney(skip: boolean) {
    return this.patchMe((u) => {
      if (!u.journeyCompletedAt || u.journeyDay >= JOURNEY_DONE) return {};
      if (!skip && Date.now() < Date.parse(u.journeyCompletedAt) + JOURNEY_WAIT_MS) throw new ApiError(409, 'NOT_YET', 'not yet');
      return { journeyDay: nextJourneyDay(u.journeyDay), journeyCompletedAt: null };
    });
  }

  // Demo looks: SVG portraits built in the browser (lib/look.ts); 4 candidates per round, hidden ceiling
  // like the API (NEO_LOOK_TRIES / NEO_LOOK_REFINES = 8).
  /** a making takes mana from the gem like the API (MAKE_COST, M-R132); a dry gem → 402 NO_MANA + the notice */
  private charge(kind: MakeKind) {
    const w = this.s.wallets[this.uid()];
    const amount = MAKE_COST[kind];
    if (!w || w.mana < amount) {
      window.dispatchEvent(new Event('obolo:nomana'));
      throw new ApiError(402, 'NO_MANA', 'マナジェムが、光らなくなった');
    }
    w.mana -= amount;
    w.lastActivity = now();
    w.entries.push({ id: uid(), delta: -amount, reason: 'generation', createdAt: now() });
    this.save();
  }

  async lookCandidates(body: Parameters<Api['lookCandidates']>[0]) {
    const u = this.s.users[this.uid()];
    const key = `obolo.look.tries.${u.id}`;
    const used = Number(localStorage.getItem(key) ?? 0);
    if (u.journeyDay < JOURNEY_DONE && used >= 8) throw new ApiError(429, 'LOOK_TRIES', 'もう作り直せません');
    // M-R223: no mana on day 2
    if (u.journeyDay > 2) this.charge('look');
    localStorage.setItem(key, String(used + 1));
    await new Promise((r) => setTimeout(r, 1800));
    let urls: string[];
    if ('reference' in body) urls = await Promise.all([0, 1, 2, 3].map((v) => demoFromReference(`data:${body.reference.mime};base64,${body.reference.data}`, body, v + used * 4)));
    else if ('like' in body) {
      const src = this.lookCache.find((c) => c.id === body.like);
      if (!src) throw new ApiError(404, 'NOT_FOUND', 'not found');
      urls = await Promise.all([0, 1, 2, 3].map((v) => demoRefine(src.url, '', v + used * 4)));
    } else if ('words' in body) urls = demoNeoLooks({ animal: body.words, color: body.words, mood: body.words }, used);
    else if ('omakase' in body) urls = demoNeoLooks({ animal: 'おまかせ', color: 'おまかせ', mood: 'おまかせ' }, used);
    else urls = demoNeoLooks(body, used);
    this.lookCache = [...this.lookCache, ...urls.map((url) => ({ id: uid(), url }))];
    return { candidates: this.lookCache.slice(-urls.length), triesLeft: u.journeyDay < JOURNEY_DONE ? 8 - (used + 1) : 99, refinesLeft: this.refinesLeft() };
  }

  private refinesLeft() {
    const u = this.s.users[this.uid()];
    // M-R223: as often as they like (the API's hidden ceiling, NEO_LOOK_REFINES)
    return u.journeyDay < JOURNEY_DONE ? Math.max(0, 30 - Number(localStorage.getItem(`obolo.look.refines.${u.id}`) ?? 0)) : 99;
  }

  async refineLook(mediaId: string | null, instruction: string, magic?: boolean) {
    const u = this.s.users[this.uid()];
    if (magic) return this.lookMagic(mediaId, instruction);
    if (this.refinesLeft() <= 0) throw new ApiError(429, 'LOOK_REFINES', 'もう描き直せません');
    // null: the look worn now (the second journey's basin)
    const src = mediaId ? this.lookCache.find((c) => c.id === mediaId) : { url: u.avatarUrl ?? demoNeoLooks({ animal: 'おまかせ', color: 'おまかせ', mood: 'おまかせ' }, 0)[0] };
    if (!src) throw new ApiError(404, 'NOT_FOUND', 'not found');
    const n = 30 - this.refinesLeft();
    if (u.journeyDay > 2) this.charge('look');
    localStorage.setItem(`obolo.look.refines.${u.id}`, String(n + 1));
    await new Promise((r) => setTimeout(r, 1500));
    // the one refine: four looks with the wish (client 2026-10-25)
    const c = await Promise.all([0, 1, 2, 3].map(async (k) => ({ id: uid(), url: await demoRefine(src.url, instruction, n * 4 + k) })));
    this.lookCache.push(...c);
    return { candidates: c, triesLeft: u.journeyDay < JOURNEY_DONE ? Math.max(0, 8 - Number(localStorage.getItem(`obolo.look.tries.${u.id}`) ?? 0)) : 99, refinesLeft: this.refinesLeft() };
  }
  private lookCache: { id: string; url: string }[] = [];

  /** the day's key for Bati's room (like the API: a per-day counter, free on the first journey) */
  private roomKey(what: string) {
    return `obolo.room.${what}.${this.uid()}.${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date())}`;
  }

  // Bati's magic in Bati's room (P-BATI-ROOM): like the API, BATI_MAGIC_PER_DAY rounds a day
  private async lookMagic(mediaId: string | null, instruction: string) {
    const u = this.s.users[this.uid()];
    const key = this.roomKey('magic');
    const used = Number(localStorage.getItem(key) ?? 0);
    if (used >= BATI_MAGIC_PER_DAY) throw new ApiError(429, 'LOOK_REFINES', '今日はもう描き直せません');
    const src = mediaId ? this.lookCache.find((c) => c.id === mediaId) : { url: u.avatarUrl ?? demoNeoLooks({ animal: 'おまかせ', color: 'おまかせ', mood: 'おまかせ' }, 0)[0] };
    if (!src) throw new ApiError(404, 'NOT_FOUND', 'not found');
    if (u.journeyDay >= JOURNEY_DONE) this.charge('look');
    localStorage.setItem(key, String(used + 1));
    await sleep(1500);
    const c = await Promise.all([0, 1, 2, 3].map(async (k) => ({ id: uid(), url: await demoRefine(src.url, instruction, used * 4 + k) })));
    this.lookCache.push(...c);
    const left = Math.max(0, BATI_MAGIC_PER_DAY - used - 1);
    return { candidates: c, triesLeft: left, refinesLeft: left };
  }

  // demo: the Bati picture recoloured three ways stands in for the dressed-up Bati (no network)
  async batiRestyle(wish = '', from?: string): Promise<BatiRestyleResult> {
    const u = this.s.users[this.uid()];
    if (!u.bati?.imageUrl) throw new ApiError(409, 'NO_BATI', 'Not hatched yet');
    // M-R215: no real person's or another work's lookalike, nothing sexual or violent
    if (wish.trim() && lookWishCategory(wish)) throw new ApiError(422, 'MODERATION', 'その姿には、できないんだ');
    const key = this.roomKey('restyle');
    const used = Number(localStorage.getItem(key) ?? 0);
    if (used >= BATI_RESTYLE_PER_DAY) throw new ApiError(429, 'RESTYLE_TRIES', '今日はもう着替えられません');
    if (u.journeyDay >= JOURNEY_DONE) this.charge('look');
    localStorage.setItem(key, String(used + 1));
    await sleep(1500);
    // M-R223: four cards from the look worn now (or the card tapped just before); four touches without a wish
    const src = (from && this.lookCache.find((c) => c.id === from)?.url) || u.bati.imageUrl;
    const candidates = await Promise.all([0, 1, 2, 3].map(async (k) => ({ id: uid(), url: await demoRefine(src, wish, used * 4 + k, true) })));
    this.lookCache.push(...candidates);
    return { candidates, left: Math.max(0, BATI_RESTYLE_PER_DAY - used - 1), ...(wish.trim() ? {} : { touches: BATI_RESTYLE_TOUCHES.map((t) => t.label) }) };
  }

  /** M-R223: the {bati} looks decided so far (the birth's first), the one worn now noted */
  private batiLooks(u: Me): string[] {
    const b = u.bati;
    if (!b?.imageUrl) return [];
    const looks = b.looks?.length ? [...b.looks] : [];
    if (!looks.includes(b.imageUrl)) looks.push(b.imageUrl);
    return looks.slice(-LOOK_HISTORY_MAX);
  }
  private wearBati(url: string, isNew: boolean) {
    return this.patchMe((u) => {
      if (!u.bati) return {};
      let looks = this.batiLooks(u);
      if (isNew && !looks.includes(url)) looks = [...looks, url].slice(-LOOK_HISTORY_MAX);
      return { bati: { ...u.bati, imageUrl: url, looks, stand: false, faces: Object.fromEntries(BATI_FACES.map((f) => [f, url])) } };
    });
  }
  async batiLookBack() {
    const u = this.s.users[this.uid()];
    const looks = this.batiLooks(u);
    const at = looks.indexOf(u.bati?.imageUrl ?? '');
    if (at <= 0) throw new ApiError(409, 'NO_PREVIOUS', 'もう前の姿はない');
    return this.wearBati(looks[at - 1], false);
  }
  async batiLookRestore(url: string) {
    const u = this.s.users[this.uid()];
    if (!this.batiLooks(u).includes(url)) throw new ApiError(404, 'NOT_FOUND', 'not found');
    return this.wearBati(url, false);
  }
  async lookRestore(url: string) {
    const u = this.s.users[this.uid()];
    if (!(u.lookHistory ?? []).includes(url)) throw new ApiError(404, 'NOT_FOUND', 'not found');
    return this.patchMe(() => ({ avatarUrl: url, lookIcon: null }));
  }

  async chooseBatiRestyle(id: string) {
    const c = this.lookCache.find((x) => x.id === id);
    if (!c) throw new ApiError(404, 'NOT_FOUND', 'not found');
    // the faces are drawn again from the new picture (the demo: the picture itself stands in for each); kept in its looks
    return this.wearBati(c.url, true);
  }

  async chooseLook(mediaId: string) {
    const c = this.lookCache.find((x) => x.id === mediaId);
    if (!c) throw new ApiError(404, 'NOT_FOUND', 'not found');
    // M-R223: the looks worn so far (Bluena's first shelf)
    return this.patchMe((u) => {
      const h = [...(u.lookHistory ?? [])];
      if (u.avatarUrl && !h.includes(u.avatarUrl)) h.push(u.avatarUrl);
      if (!h.includes(c.url)) h.push(c.url);
      return { avatarUrl: c.url, lookHistory: h.slice(-LOOK_HISTORY_MAX) };
    });
  }

  // demo: the test pictures stand in for painted candidates
  async puniPicCandidates(): Promise<PuniPicResult> {
    this.charge('kororinDesign');
    await sleep(900);
    const all = ['salmon', 'gray', 'green', 'purple', 'gorilla'].sort(() => Math.random() - 0.5).slice(0, 2);
    const candidates = all.map((n) => ({ id: uid(), url: `/puni-test/${n}.png` }));
    this.lookCache.push(...candidates);
    return { candidates, left: 99 };
  }

  // demo: the dachi live in this browser — the inviter becomes one on Saturn; deliveries to them are kept
  // here (there is nobody on the other side, so 〔推し〕 shows what you sent, as the dachi would see it)
  async dachi() {
    const inviter = this.s.users[this.uid()]?.invitedByName;
    return this.s.dachiInviter && inviter ? [{ id: 'demo-inviter', displayName: inviter, pic: null }] : [];
  }
  async befriendInviter() {
    this.s.dachiInviter = true;
    this.s.dachiAt ??= now();
    this.save();
    const inviter = this.s.users[this.uid()]?.invitedByName;
    return inviter ? { id: 'demo-inviter', displayName: inviter, pic: null } : null;
  }
  // demo: a link of one's own that nobody else can open (there is nobody on the other side)
  async createDachiLink() {
    return { token: `demo${uid().replace(/-/g, '').slice(0, 20)}`, expiresAt: new Date(Date.now() + 48 * 3600_000).toISOString() };
  }
  async peekDachiLink(): Promise<Awaited<ReturnType<Api['peekDachiLink']>>> {
    const me = this.s.users[this.uid()];
    return { from: { id: me.id, displayName: me.displayName, pic: null }, state: 'open', mine: true };
  }
  async openDachiLink() {
    return this.peekDachiLink();
  }
  async dachiLinkAsks() {
    return [];
  }
  async confirmDachiLink(): Promise<Awaited<ReturnType<Api['confirmDachiLink']>>> {
    throw new Error('demo');
  }
  async endDachiLink() {}
  async deliver(body: Parameters<Api['deliver']>[0]) {
    const to = (await this.dachi()).length;
    if (to) {
      const me = this.s.users[this.uid()];
      (this.s.deliveries ??= []).unshift({ id: uid(), kind: body.kind, title: body.title ?? '', text: body.text ?? '', url: body.url ?? null, posterUrl: body.posterUrl ?? null, from: { id: me.id, displayName: me.displayName, pic: null }, createdAt: now(), returnsAt: new Date(Date.now() + 88 * 3600_000).toISOString() });
      this.save();
    }
    return { to };
  }
  /**
   * demo: what arrives in the ダチ threads — MIKIE⭐︎DRILL's welcome (the demo inviter recorded nothing), and KIMORIN⭐︎'s
   * lines of the wait. For review the wait is short: the day's lines come 1 and 2 minutes after the day is finished
   * (the server puts them at night, shared kimorinSchedule).
   */
  private dachiArrive() {
    const me = this.s.users[this.uid()];
    if (!this.s.dachiAt || !me) return [];
    const list = (this.s.dachiMsgs ??= []);
    const sent = new Set(list.map((m) => m.lineId).filter(Boolean));
    const line = (id: string, thread: string, at: string) => {
      const l = dachiLine(id)!;
      list.push({ id: uid(), thread, lineId: id, fromMe: false, character: l.who, kind: 'voice', audioUrl: l.voice, seconds: null, text: l.text, work: null, createdAt: at });
    };
    if (!sent.has('welcome')) line(MIKIE_WELCOME.id, this.s.dachiInviter && me.invitedByName ? 'demo-inviter' : 'mikie', this.s.dachiAt);
    const done = me.journeyCompletedAt ? Date.parse(me.journeyCompletedAt) : null;
    if (done && done >= Date.parse(this.s.dachiAt) - 86400_000) {
      KIMORIN_WAIT_LINES.filter((l) => l.day === me.journeyDay)
        .slice(0, 2)
        .forEach((l, k) => {
          const at = done + (k + 1) * 60_000;
          if (!sent.has(l.id) && at <= Date.now()) line(l.id, 'kimorin', new Date(at).toISOString());
        });
    }
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    this.save();
    return list;
  }
  async dachiThreads(): Promise<DachiThreadView[]> {
    const list = this.dachiArrive();
    if (!this.s.dachiAt) return [];
    const me = this.s.users[this.uid()];
    const view = (id: string, kind: DachiThreadView['kind'], name: string): DachiThreadView => {
      const mine = list.filter((m) => m.thread === id);
      return { id, kind, name, pic: null, unread: mine.some((m) => !m.fromMe && !m.read), lastAt: mine.at(-1)?.createdAt ?? null };
    };
    const out: DachiThreadView[] = [];
    if (this.s.dachiInviter && me?.invitedByName) out.push(view('demo-inviter', 'dachi', me.invitedByName));
    if (list.some((m) => m.thread === 'mikie')) out.push(view('mikie', 'mikie', 'MIKIE⭐︎DRILL'));
    out.push(view('kimorin', 'kimorin', 'KIMORIN⭐︎'));
    return out;
  }
  private dachiThreadOk(thread: string) {
    const ok = !!this.s.dachiAt && (thread === 'kimorin' || thread === 'mikie' || (thread === 'demo-inviter' && !!this.s.dachiInviter));
    if (!ok) throw new ApiError(403, 'NOT_DACHI', 'Voice messages go only between ダチ');
  }
  async dachiMessages(thread: string) {
    this.dachiThreadOk(thread);
    return this.dachiArrive()
      .filter((m) => m.thread === thread)
      .map(({ thread: _t, lineId: _l, read: _r, ...m }) => m);
  }
  async sendDachiMessage(thread: string, body: Parameters<Api['sendDachiMessage']>[1]) {
    this.dachiThreadOk(thread);
    await sleep(300);
    const m: DachiMessageView =
      'mediaId' in body
        ? { id: uid(), fromMe: true, character: null, kind: 'voice', audioUrl: `idb:${body.mediaId}`, seconds: Math.round(body.seconds * 10) / 10, text: null, work: null, createdAt: now() }
        : { id: uid(), fromMe: true, character: null, kind: 'work', audioUrl: null, seconds: null, text: null, work: body.work, createdAt: now() };
    (this.s.dachiMsgs ??= []).push({ ...m, thread });
    this.save();
    return m;
  }
  async readDachiThread(thread: string) {
    for (const m of this.s.dachiMsgs ?? []) if (m.thread === thread) m.read = true;
    this.save();
  }
  async oshi(kind?: Parameters<Api['oshi']>[0]) {
    const since = Date.now() - 88 * 3600_000;
    return (this.s.deliveries ?? []).filter((d) => new Date(d.createdAt).getTime() > since && (!kind || d.kind === kind));
  }

  async choosePuniPic(mediaId: string | null) {
    const url = mediaId ? this.lookCache.find((x) => x.id === mediaId)?.url : null;
    if (mediaId && !url) throw new ApiError(404, 'NOT_FOUND', 'not found');
    return this.patchMe(() => ({ puniPic: url ?? null }));
  }

  // demo: the butterflies cut from the Jupiter mock stand in for painted candidates
  async stickerArt(text: string) {
    this.charge('jacketArt');
    await new Promise((r) => setTimeout(r, 1500));
    return { id: uid(), url: demoStickerArt(text) };
  }

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
    const flying = (this.s.jposts ?? []).filter((p) => new Date(p.createdAt).getTime() > since && ok(p.owner) && this.seesWork('jupiter_post', p.id, p.owner)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
    const p = {
      id: uid(),
      owner: viewer,
      kind: root.kind,
      url: root.url,
      posterUrl: root.posterUrl,
      text: body.text ?? '',
      filter: body.filter ?? 'none',
      branch: body.branch,
      starCount: 0,
      starredBy: [],
      createdAt: now(),
    };
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
    const mine = (this.s.jposts ?? []).filter((p) => p.owner === userId && this.seesWork('jupiter_post', p.id, p.owner)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const f = this.s.follows ?? {};
    return {
      author: this.jAuthor(userId),
      branches: JUPITER_DEFAULT_BRANCHES.map((d, i) => this.s.jbranches?.[userId]?.[i] || d),
      leaves: mine.filter((p) => new Date(p.createdAt).getTime() <= since).map((p) => this.jView(p, viewer)),
      flying: mine.filter((p) => new Date(p.createdAt).getTime() > since).map((p) => this.jView(p, viewer)),
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

  // --- Mercury & Mars (demo: only the visitor's own posts; the screens draw the sample residents) ---
  private pAuthor(id: string): PlanetAuthor {
    const u = this.s.users[id];
    return { id, handle: u?.handle ?? 'neo', displayName: u?.displayName ?? 'NEO', neoForm: u?.neoForm ?? null, pic: u?.puniPic ?? null };
  }

  private pView(p: NonNullable<DemoState['pposts']>[number], viewer: string): PlanetPostView {
    const { owner, starredBy, ...rest } = p;
    const rs = (this.s.preplies ?? []).filter((r) => r.postId === p.id);
    return { ...rest, author: this.pAuthor(owner), starredByMe: starredBy.includes(viewer), repliers: [...new Set(rs.map((r) => r.owner).reverse())].slice(0, 3).map((o) => this.pAuthor(o)) };
  }

  async savedSongs() {
    return [];
  }

  async planetSky(planet: TimelinePlanet, tab: 'all' | 'following' | 'friends'): Promise<PlanetFlyer[]> {
    const viewer = this.uid();
    const f = this.s.follows ?? {};
    const cut = Date.now() - 88 * 3600_000;
    const ok = (o: string) => tab === 'all' || o === viewer || (tab === 'following' ? (f[viewer] ?? []).includes(o) : (f[viewer] ?? []).includes(o) && (f[o] ?? []).includes(viewer));
    const by = new Map<string, PlanetFlyer>();
    for (const p of (this.s.pposts ?? []).filter((x) => x.planet === planet && new Date(x.createdAt).getTime() > cut && ok(x.owner) && this.seesWork('planet_post', x.id, x.owner)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      const fl = by.get(p.owner) ?? { author: this.pAuthor(p.owner), posts: [] };
      fl.posts.push(this.pView(p, viewer));
      by.set(p.owner, fl);
    }
    return [...by.values()];
  }

  async planetProfile(planet: TimelinePlanet, userId: string): Promise<PlanetProfileView> {
    const viewer = this.uid();
    const cut = Date.now() - 88 * 3600_000;
    const mine = (this.s.pposts ?? []).filter((p) => p.planet === planet && p.owner === userId && this.seesWork('planet_post', p.id, p.owner)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      author: this.pAuthor(userId),
      flying: mine.filter((p) => new Date(p.createdAt).getTime() > cut).map((p) => this.pView(p, viewer)),
      works: mine.filter((p) => new Date(p.createdAt).getTime() <= cut).map((p) => this.pView(p, viewer)),
      followedByMe: (this.s.follows?.[viewer] ?? []).includes(userId),
      isMe: viewer === userId,
    };
  }

  async createPlanetPost(planet: TimelinePlanet, body: Parameters<Api['createPlanetPost']>[1]) {
    const viewer = this.uid();
    const v = planet === 'mars' ? (this.s.backstage ?? []).find((x) => x.id === body.sourceId && x.owner === viewer) : null;
    if (planet === 'mars' && !v) throw new ApiError(404, 'NOT_FOUND', 'not found');
    const p = {
      id: uid(),
      planet,
      owner: viewer,
      kind: planet === 'mars' ? ('video' as const) : ('song' as const),
      title: body.title || v?.title || '',
      text: body.text ?? '',
      url: v?.url ?? '',
      posterUrl: null,
      seconds: v?.seconds ?? null,
      starredBy: [],
      createdAt: now(),
    };
    this.s.pposts = [p, ...(this.s.pposts ?? [])];
    this.save();
    return this.pView(p, viewer);
  }

  async starPlanetPost(_planet: TimelinePlanet, id: string, on: boolean) {
    const viewer = this.uid();
    const p = (this.s.pposts ?? []).find((x) => x.id === id);
    if (p) p.starredBy = on ? [...new Set([...p.starredBy, viewer])] : p.starredBy.filter((x) => x !== viewer);
    this.save();
    return { starredByMe: on };
  }

  async planetReplies(_planet: TimelinePlanet, id: string): Promise<PlanetReplyView[]> {
    return (this.s.preplies ?? []).filter((r) => r.postId === id).map((r) => ({ id: r.id, author: this.pAuthor(r.owner), text: r.text, createdAt: r.createdAt }));
  }

  async replyPlanet(_planet: TimelinePlanet, id: string, text: string) {
    const viewer = this.uid();
    const r = { id: uid(), postId: id, owner: viewer, text: text.trim().slice(0, 120), createdAt: now() };
    this.s.preplies = [...(this.s.preplies ?? []), r];
    this.save();
    return { id: r.id, author: this.pAuthor(viewer), text: r.text, createdAt: r.createdAt };
  }

  // Earth mail & phone need the server (members, between ダチ): closed in the browser-only demo
  async commsStatus() {
    return { open: false, mail: 'poll' as const, call: 'demo' as const, firebaseProjectId: null, firebaseWeb: null };
  }
  async commsContacts(): Promise<never[]> {
    return [];
  }
  private noComms(): never {
    throw new ApiError(403, 'NOT_MEMBER', 'Mail and phone need the server');
  }
  async findPerson() {
    return { person: null };
  }
  async followPerson(): Promise<never> {
    return this.noComms();
  }
  /** demo: only the demo inviter can be blocked (from the ダチ thread's menu, M-R212): they stop being a dachi */
  async blockPerson(id: string, on: boolean): Promise<Awaited<ReturnType<Api['blockPerson']>>> {
    if (id !== 'demo-inviter') return this.noComms();
    if (on) this.s.dachiInviter = false;
    this.save();
    const name = this.s.users[this.uid()]?.invitedByName ?? '';
    return { id, handle: 'inviter', displayName: name, neoForm: null, pic: null, followedByMe: false, followsMe: false, blockedByMe: on };
  }
  async blockedPeople(): Promise<never[]> {
    return [];
  }
  async reportPerson(body: Parameters<Api['reportPerson']>[0]): Promise<void> {
    if (body.userId !== 'demo-inviter') return this.noComms();
    await sleep(300);
  }
  async dmMessages(): Promise<never[]> {
    return [];
  }
  async sendDm(): Promise<never> {
    return this.noComms();
  }
  async readDm() {}
  async subscribePush(): Promise<never> {
    return this.noComms();
  }
  async unsubscribePush() {}
  async firebaseToken(): Promise<never> {
    return this.noComms();
  }
  async startCall(): Promise<never> {
    return this.noComms();
  }
  async incomingCalls(): Promise<never[]> {
    return [];
  }
  async getCall(): Promise<never> {
    return this.noComms();
  }
  async answerCall(): Promise<never> {
    return this.noComms();
  }
  async declineCall(): Promise<never> {
    return this.noComms();
  }
  async endCall(): Promise<never> {
    return this.noComms();
  }

  async atelier() {
    return this.s.ateliers?.[this.uid()] ?? EMPTY_ATELIER;
  }

  async saveAtelier(layout: AtelierLayout) {
    this.s.ateliers = { ...(this.s.ateliers ?? {}), [this.uid()]: layout };
    this.save();
    return layout;
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

  // the MV studio needs the server (ffmpeg + the anime model)
  async mvCreate(): Promise<never> {
    throw new ApiError(501, 'DEMO', 'demo');
  }
  async mvGet(): Promise<never> {
    throw new ApiError(501, 'DEMO', 'demo');
  }
  async mvAddMaterial(): Promise<never> {
    throw new ApiError(501, 'DEMO', 'demo');
  }
  async mvRemoveMaterial(): Promise<never> {
    throw new ApiError(501, 'DEMO', 'demo');
  }
  async mvRender(): Promise<never> {
    throw new ApiError(501, 'DEMO', 'demo');
  }
  async mvStory(): Promise<never> {
    throw new ApiError(501, 'DEMO', 'demo');
  }
  async mvLyrics(): Promise<never> {
    throw new ApiError(501, 'DEMO', 'demo');
  }

  // M-R215 / M-R217: the personality by the rules alone (no model), the card, the small egg
  async batiEgg(food: string, egg?: BatiEggKind) {
    return this.patchMe((u) => demoBatiEgg(u, food, egg ?? 'sun'));
  }

  async batiHatch() {
    await new Promise((r) => setTimeout(r, 2500));
    this.patchMe((u) => (u.bati ? { bati: { ...u.bati, imageUrl: u.bati.imageUrl ?? demoBati(u.bati.food) } } : {}));
    return this.patchMe(demoBatiSync);
  }

  async batiNew(egg: BatiEggKind, seed: string) {
    await sleep(600);
    return this.patchMe((u) => demoBatiNew(u, egg, seed));
  }
  async batiSwitch(id: string) {
    const me = this.patchMe((u) => demoBatiSwitch(u, id));
    this.buddyOf(me.id).name = me.bati?.name ?? this.buddyOf(me.id).name;
    this.save();
    return me;
  }
  async batiSpeech(body: { id?: string; call?: string | null; self?: string | null }) {
    return this.patchMe((u) => demoBatiSpeech(u, body));
  }
  // M-R222: what {bati} remembers (demo: on the {bati} in the chat)
  async batiMemory(text: string) {
    return this.patchMe((u) => demoBatiMemory(u, text));
  }
  async batiForget(memory?: string) {
    return this.patchMe((u) => demoBatiForget(u, memory));
  }
  async batiRole(role: BatiRole) {
    return this.patchMe((u) => demoBatiRole(u, role));
  }

  // demo: the drawn Bati stands in for every face; one picture from the story's own stills
  // demo: the portrait stands in for the standing figure
  async lookStandee() {
    return this.patchMe((u) => ({ lookStandee: u.avatarUrl ?? null }));
  }
  // demo: a fixed read
  async compass(body: Parameters<Api['compass']>[0]) {
    await sleep(1400);
    const art = [['絵のタッチ', '水彩'], ['絵のタッチ', 'にじみ'], ['キャラ', '二頭身'], ['キャラ', '笑顔'], ['背景', '夕暮れの海辺'], ['色と光', 'オレンジと紫'], ['構図', '下から見上げる'], ['雰囲気', 'なつかしい']];
    const song = [['ジャンル', 'シティポップ'], ['速さとリズム', 'ゆったり'], ['楽器', 'ピアノ'], ['楽器', 'ベース'], ['声', 'やわらかい声'], ['曲の形', 'サビから始まる'], ['雰囲気', '夜のドライブ']];
    const all = (body.kind === 'art' ? art : song).map(([group, text]) => ({ group, text }));
    return { cards: body.focus ? all.filter((c) => c.group === body.focus) : all };
  }
  async storyCards(said: string) {
    await sleep(700);
    const parts = said.split(/[、。！？!?\s　]+/).filter(Boolean).slice(0, 4).map((p) => p.slice(0, 12));
    return { cards: [`主人公：${parts[0] ?? 'たこ焼き'}`, ...parts.slice(1), '短いお話'] };
  }
  async writeStory(cards: string[]) {
    this.charge('story');
    await sleep(1600);
    const hero = (cards.find((c) => c.startsWith('主人公：')) ?? '主人公：たこ焼き').slice(4);
    return {
      title: `${hero}の旅`,
      pages: [
        { text: `ある日、${hero}は、いつもの場所から、ころりと転がりだしました。「どこへ行くんだろう」。風が、そっと背中をおしました。`, scene: `${hero}が転がりだす` },
        { text: `星と星のあいだを、${hero}は進みます。こわい夜もあったけれど、小さな光が、道をてらしてくれました。`, scene: '星のあいだの道' },
        { text: `いちばん遠くで、${hero}は、ふりかえりました。来た道が、きらきら光っています。「また、帰ろう」。${hero}は、にっこり笑いました。`, scene: '光る帰り道' },
      ],
    };
  }
  async lookChibi() {
    return this.patchMe((u) => ({ lookChibi: u.avatarUrl ?? null }));
  }
  async batiFaces() {
    await sleep(1200);
    return this.patchMe((u) => (u.bati?.imageUrl ? { bati: { ...u.bati, faces: Object.fromEntries(BATI_FACES.map((f) => [f, u.bati!.imageUrl!])) } } : {}));
  }
  async buddyPicture(question: string) {
    await sleep(900);
    return { picture: { url: '/onboarding/s/rocket-space.jpg', title: question.slice(0, 30), source: 'デモの絵（本番は NASA・Wikimedia Commons）', pageUrl: 'https://images.nasa.gov', free: true } };
  }

  async batiName(name: string) {
    this.patchMe((u) => (u.bati ? { bati: { ...u.bati, name } } : {}));
    const me = this.patchMe(demoBatiSync);
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
    return this.patchMe((u) => (u.journeyDay >= JOURNEY_PAYMENT && !u.orderedAt ? { orderedAt: now(), subscriptionStatus: 'demo' } : {}));
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

  async createInvite(email: string, message?: string, voice?: { mediaId: string; seconds: number }) {
    const id = this.uid();
    const code = Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => b.toString(16).padStart(2, '0')).join('');
    const inv = { code, inviterName: this.s.users[id].displayName, email, status: 'pending' as const, createdAt: now(), inviterId: id, message: message?.trim().slice(0, 60) || null };
    this.invites()[code] = inv;
    this.save();
    // demo: the voice note stays in this browser (there is nobody on the other side to hear it)
    return { ...inv, voice: !!voice, expiresAt: new Date(Date.now() + 14 * 86400_000).toISOString() };
  }

  // --- Venus radio (demo: this browser only; the residents' shows are samples) -------------------

  private rPerson(id: string): RadioShowView['host'] {
    const r = RADIO_RESIDENTS[id];
    if (r) return { id, handle: r.handle, displayName: r.name, neoForm: null, pic: r.pic };
    const u = this.s.users[id];
    return { id, handle: u?.handle ?? 'neo', displayName: u?.displayName ?? 'NEO', neoForm: u?.neoForm ?? null, pic: u?.puniPic ?? null };
  }

  private rShows() {
    if (!this.s.radioShows) this.s.radioShows = seedRadioShows();
    return this.s.radioShows;
  }

  private rLives() {
    if (!this.s.radioLives) this.s.radioLives = seedRadioLives();
    // the residents' sample show is always on air; yours ends when you stop sending a beat
    for (const l of this.s.radioLives) if (l.status === 'live' && !RADIO_RESIDENTS[l.owner] && Date.now() - l.beat > RADIO_LIVE_STALE_SECONDS * 1000) l.status = 'ended';
    return this.s.radioLives;
  }

  private rShowView(r: NonNullable<DemoState['radioShows']>[number], viewer: string): RadioShowView {
    const { owner, ...rest } = r;
    return { ...rest, host: this.rPerson(owner), mine: owner === viewer };
  }

  private rLiveView(l: NonNullable<DemoState['radioLives']>[number], viewer: string): RadioLiveView {
    const { owner, beat: _b, ...rest } = l;
    return { ...rest, host: this.rPerson(owner), mine: owner === viewer };
  }

  async radioHome(): Promise<RadioHome> {
    const viewer = this.uid();
    await sleep(150);
    return {
      live: this.rLives().filter((l) => l.status === 'live' && this.seesWork('radio_show', l.id, l.owner)).map((l) => this.rLiveView(l, viewer)),
      // M-R208: on the air (waves above the clouds) for 88 hours after publishing, then back in the owner's booth
      shows: this.rShows()
        .filter((r) => r.status === 'public' && isFlying(r.publishedAt) && this.seesWork('radio_show', r.id, r.owner))
        .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
        .map((r) => this.rShowView(r, viewer)),
    };
  }

  async radioDeck(): Promise<RadioDeckSong[]> {
    const me = this.s.users[this.uid()];
    const perm = this.s.radioPerm ?? {};
    const saved: Awaited<ReturnType<Api['savedSongs']>> = await this.savedSongs();
    const mine = saved.map<RadioDeckSong>((x) => ({ id: x.id, title: x.title, url: x.url, bpm: x.bpm, seconds: x.seconds, by: me?.displayName ?? 'NEO', byId: me?.id ?? null, from: 'mine', allowRadio: perm[x.id] ?? true }));
    return [...mine, ...RADIO_SAMPLE_SONGS];
  }

  async setSongRadio(songId: string, allow: boolean) {
    this.s.radioPerm = { ...(this.s.radioPerm ?? {}), [songId]: allow };
    this.save();
    return { allowRadio: allow };
  }

  async uploadShow(blob: Blob) {
    return this.uploadVoice(blob);
  }

  async createRadioShow(body: CreateRadioShowBody) {
    const viewer = this.uid();
    const r = {
      id: uid(),
      title: body.title,
      thumbUrl: body.thumbUrl ?? null,
      loop: body.loop,
      audioUrl: `idb:${body.mediaId}`,
      seconds: body.seconds,
      cues: body.cues,
      status: 'private' as const,
      source: body.liveId ? ('live' as const) : ('recorded' as const),
      createdAt: now(),
      publishedAt: null,
      owner: viewer,
    };
    this.s.radioShows = [r, ...this.rShows()];
    this.save();
    return this.rShowView(r, viewer);
  }

  async radioHostShows(hostId: string) {
    const viewer = this.uid();
    return this.rShows()
      .filter((r) => r.owner === hostId && r.status === 'public' && r.publishedAt && !isFlying(r.publishedAt) && this.seesWork('radio_show', r.id, r.owner))
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
      .map((r) => this.rShowView(r, viewer));
  }

  async myRadioShows() {
    const viewer = this.uid();
    return this.rShows()
      .filter((r) => r.owner === viewer)
      .map((r) => this.rShowView(r, viewer));
  }

  async publishRadioShow(id: string, on: boolean) {
    const viewer = this.uid();
    const r = this.rShows().find((x) => x.id === id && x.owner === viewer);
    if (!r) throw new ApiError(404, 'NOT_FOUND', 'Not found');
    r.status = on ? 'public' : 'private';
    // M-R208: "when it was flown" is the first publishing; hiding and showing it again does not fly it again
    if (on) r.publishedAt ??= now();
    this.save();
    return this.rShowView(r, viewer);
  }

  async removeRadioShow(id: string) {
    const viewer = this.uid();
    this.s.radioShows = this.rShows().filter((r) => !(r.id === id && r.owner === viewer));
    this.save();
  }

  async radioShow(id: string) {
    const viewer = this.uid();
    const r = this.rShows().find((x) => x.id === id && (x.status === 'public' || x.owner === viewer));
    if (!r) throw new ApiError(404, 'NOT_FOUND', 'Not found');
    return this.rShowView(r, viewer);
  }

  async startRadioLive(body: StartRadioLiveBody) {
    const viewer = this.uid();
    const me = this.s.users[viewer];
    if (!me?.orderedAt) throw new ApiError(403, 'ORDER_REQUIRED', 'Live shows open for ORDER members');
    for (const l of this.rLives()) if (l.owner === viewer && l.status === 'live') l.status = 'ended';
    const l = { id: uid(), title: body.title, thumbUrl: body.thumbUrl ?? null, loop: body.loop, status: 'live' as const, now: null, startedAt: now(), transport: 'test' as const, owner: viewer, beat: Date.now() };
    this.s.radioLives = [l, ...this.rLives()];
    this.save();
    return this.rLiveView(l, viewer);
  }

  async radioLive(id: string): Promise<RadioLiveState> {
    const viewer = this.uid();
    const l = this.rLives().find((x) => x.id === id);
    if (!l) throw new ApiError(404, 'NOT_FOUND', 'Not found');
    const all = (this.s.radioMessages ?? []).filter((m) => m.liveId === id && !m.hidden);
    // demo: on your own show, the residents drop by with a comment or a request now and then
    if (l.owner === viewer && l.status === 'live') {
      const fake = all.filter((m) => RADIO_RESIDENTS[m.owner]).length;
      const last = all[all.length - 1];
      if (fake < RADIO_DEMO_VISITS.length && (!last || Date.now() - new Date(last.createdAt).getTime() > 9000)) {
        const v = RADIO_DEMO_VISITS[fake];
        this.s.radioMessages = [...(this.s.radioMessages ?? []), { id: uid(), liveId: id, owner: v.who, kind: v.kind, text: v.text, song: v.song ?? null, createdAt: now() }];
        this.save();
      }
    }
    const msgs = (this.s.radioMessages ?? [])
      .filter((m) => m.liveId === id && !m.hidden)
      .slice(-60)
      .map(({ liveId: _l, owner, hidden: _h, ...m }) => ({ ...m, from: this.rPerson(owner), mine: owner === viewer }));
    const host = l.owner === viewer;
    return { ...this.rLiveView(l, viewer), messages: host ? msgs : msgs.filter((m) => m.kind === 'comment' || m.mine) };
  }

  async setRadioNow(id: string, n: RadioNowBody['now']) {
    const viewer = this.uid();
    const l = this.rLives().find((x) => x.id === id && x.owner === viewer);
    if (!l || l.status !== 'live') throw new ApiError(410, 'LIVE_ENDED', 'This show has ended');
    l.now = n ? { songId: n.songId, title: n.title, by: n.by, byId: n.byId ?? null } : null;
    l.beat = Date.now();
    this.save();
    return this.rLiveView(l, viewer);
  }

  async endRadioLive(id: string) {
    const viewer = this.uid();
    const l = this.rLives().find((x) => x.id === id && x.owner === viewer);
    if (!l) throw new ApiError(404, 'NOT_FOUND', 'Not found');
    if (l.status === 'live') l.status = 'ended';
    l.now = null;
    this.save();
    return this.rLiveView(l, viewer);
  }

  async radioMessage(id: string, body: RadioMessageBody) {
    const viewer = this.uid();
    const l = this.rLives().find((x) => x.id === id);
    if (!l || l.status !== 'live') throw new ApiError(410, 'LIVE_ENDED', 'This show has ended');
    const m = { id: uid(), liveId: id, owner: viewer, kind: body.kind, text: body.text ?? '', song: null, createdAt: now() };
    this.s.radioMessages = [...(this.s.radioMessages ?? []), m];
    this.save();
    return { id: m.id, kind: m.kind, text: m.text, song: null, from: this.rPerson(viewer), createdAt: m.createdAt, mine: true };
  }

  async hideRadioMessage(liveId: string, messageId: string) {
    const m = (this.s.radioMessages ?? []).find((x) => x.id === messageId && x.liveId === liveId);
    if (m) m.hidden = true;
    this.save();
  }

  async reportRadio(_body: RadioReportBody) {
    await sleep(300);
  }

  async bluenaKept(): Promise<BluenaKeptView[]> {
    const viewer = this.uid();
    const keep = this.s.bluenaKeeps?.[viewer] ?? [];
    return keep.map((id) => {
      const p = (this.s.pposts ?? []).find((x) => x.id === id);
      return p
        ? { postId: id, planet: p.planet as BluenaKeptView['planet'], kind: p.kind, title: p.title, url: p.url, posterUrl: p.posterUrl, by: this.pAuthor(p.owner).displayName, byId: p.owner, available: true, keptAt: now() }
        : { postId: id, planet: 'mercury', kind: 'song', title: '', url: null, posterUrl: null, by: '', byId: '', available: false, keptAt: now() };
    });
  }

  async keepInBluena(postId: string, on: boolean) {
    const viewer = this.uid();
    const k = new Set(this.s.bluenaKeeps?.[viewer] ?? []);
    if (on) k.add(postId);
    else k.delete(postId);
    this.s.bluenaKeeps = { ...(this.s.bluenaKeeps ?? {}), [viewer]: [...k] };
    this.save();
    return { kept: on };
  }
}
