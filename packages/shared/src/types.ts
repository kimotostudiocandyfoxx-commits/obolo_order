import type { BuddyPersona, Locale } from './index';
import type { SongEditCommand } from './schemas';
import type { PuniLook } from './puni';
import type { BatiCustomStyle, BatiEggKind, BatiPersonality } from './batiPersona';
import type { BatiMemory, BatiRole } from './batiMemory';
import type { TalkBeat, TalkFace, TalkLook, TalkMotion } from './talk';
import type { PlanetFigures } from './planetFigures';

/** API response shapes. Kept framework-free so web, api and future native shells share them. */

export interface Me {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  bio: string;
  country: string;
  locale: Locale;
  /** Stripe's subscription status as the webhook last saw it (see membership.ts isActiveMember) */
  subscriptionStatus: 'none' | 'demo' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'paused' | 'trialing';
  /** P-BILL-4: the member cancelled in the Customer Portal; the subscription ends at `currentPeriodEnd` (usable until then) */
  cancelAtPeriodEnd?: boolean;
  /** the end of the paid month (ISO), from customer.subscription.updated; null until known */
  currentPeriodEnd?: string | null;
  /** 1–6 = journey day to play, 7 = the Eclipse day (story + payment), 8 = ORDER member. */
  journeyDay: number;
  /** Set when the current day has been finished (the next unlocks 24 h later or by skipping). */
  journeyCompletedAt: string | null;
  invitedByName: string | null;
  /** the words on the invitation that brought them */
  invitedByMessage?: string | null;
  /** OBOLO NEO form id (Day 2, on the Moon), null until chosen. */
  neoForm: string | null;
  /** Generated OBOLO NEO look (Day 2, on the Moon), null until chosen — falls back to the neoForm emblem. */
  avatarUrl: string | null;
  /** The visitor's Bati: born and named on Day 2 on the Moon (from the favourite food). */
  bati: BatiView | null;
  /** every {bati} of the member (M-R215: up to BATI_MAX_AWAKE awake; the rest sleep on the Moon), the active one included */
  batis?: BatiSummary[];
  /**
   * the small glowing egg (M-R218 / M-R231): the 2nd hatches on the app's day 9, the 3rd on day 16; `growth` 0..1 (size
   * and light, never a number); `readyAt` once day 9's time is known
   */
  batiEgg?: { nth?: 2 | 3; readyAt: string | null; ready: boolean; growth?: number } | null;
  /** Day 7: when the Eclipse was paid for (null = not yet). */
  orderedAt: string | null;
  /** Registered voices (Fish Audio): own voice (Saturn, songs) and Bati's voice.
   *  `selfSings` = the recording is kept, so songs are sung in it (Seed-VC; registered before 2026-10-09 = no). */
  voices: { self: boolean; bati: boolean; selfSings?: boolean; kororin?: boolean; /** M-R246: {bati}'s voice from the egg recording */ batiState?: import('./batiVoice').BatiVoiceState };
  /** M-R247: the start-of-app agreement (terms, privacy, photos and voice) — the version agreed to; null = not yet */
  consent?: { version: string; at: string; /** M-R248: a guardian agreed too (13〜15) */ guardian?: boolean; /** M-R252: false = the start screen's branch without the photo and voice */ media?: boolean } | null;
  /** M-R248: whether the photo and the voice may be used (age + agreement + the guardian's for 13〜15) */
  mediaOk?: boolean;
  /** the round ぷにぷに character (null until dressed on the profile) */
  look: PuniLook | null;
  /** the year they were born (M-R150), null = not asked yet; `child` = under 15 */
  birthYear?: number | null;
  child?: boolean;
  /** the NEO look standing, without a background (M-R149): made once after the look is chosen (POST /me/look/standee) */
  lookStandee?: string | null;
  /** the small chibi NEO without a background (M-R155/M-R161): the butterfly, the owl, the captain… (POST /me/look/chibi) */
  lookChibi?: string | null;
  /** the chosen look cut to a round 512px icon around the face (no painting) */
  lookIcon?: string | null;
  /** M-R232〜M-R235: the look in the side-by-side talk — standing, its expressions with blink / mouth parts, its コロリン mini */
  talk?: TalkLook | null;
  /** M-R223: the looks worn so far, oldest first (the one worn now included) — Bluena's first shelf, 〔前に戻す〕 */
  lookHistory?: string[];
  /** the painted ぷにぷに picture (AI, transparent PNG); shown instead of the code-drawn look */
  puniPic: string | null;
  /** M-R262: the 2-heads glossy mini figure painted once from the look (null until it is made) */
  chibiPic?: string | null;
  /**
   * client 2026-11-25: the figures of the look worn now on every home planet (the Saturn chibi and ball, the seven
   * planets' chibis), made in the background after each look; a missing one is still being made
   */
  planetFigures?: PlanetFigures;
  /** M-R275: the chosen kororin picture (1–24); unset = not chosen yet */
  kororin?: { pic: number } | null;
  /** Jupiter: your painted butterfly (🦋 蝶を描いてもらう) */
  butterfly: string | null;
  /**
   * What the member made and chose on each journey day, as saved with the day ("d3.kororins",
   * "d4.stickers", "d5.song" …): the next day's story picks them up (Jupiter's stickers from Saturn's
   * kororins, Mercury's song from a sticker, Mars's MV from the song).
   */
  story?: Record<string, string>;
  /**
   * A tester account (the API's TESTER_EMAILS / TESTER_ACCOUNT_IDS allowlist): the web shows the tester bar
   * (components/TesterBar.tsx) and POST /me/tester/* is allowed. Absent / false for everyone else.
   */
  tester?: boolean;
  createdAt: string;
}

/**
 * Day 9 "エクリプス" payment (¥88/month). `stripe`: mount Stripe Embedded Checkout with the client
 * secret, then confirm the session. `demo`: billing is not configured — confirm with /me/order.
 */
export type OrderCheckout = { mode: 'stripe'; publishableKey: string; clientSecret: string; sessionId: string } | { mode: 'demo' };
/** P-BILL-4: POST /billing/portal — the Stripe Customer Portal (change the card, cancel); demo mode has none. */
export type BillingPortal = { mode: 'stripe'; url: string } | { mode: 'demo'; url: null };
/**
 * P-BILL-1: POST /billing/gems/:id/checkout — a mana gem (MANA_GEMS), a one-time payment in the same Embedded Checkout
 * as the Eclipse. `stripe`: mount it, then POST /billing/gems/confirm. `demo` (no Stripe key): the mana was added at
 * once, without a charge (`credit`).
 */
export type GemCheckout =
  | { mode: 'stripe'; gemId: string; publishableKey: string; clientSecret: string; sessionId: string }
  | { mode: 'demo'; gemId: string; credit: GemCredit; note: string };
/** the mana a gem added (once per Checkout Session) and the balance after it */
export interface GemCredit {
  gemId: string;
  manaAdded: number;
  manaBalance: number;
}

export interface BatiView {
  /** favourite food the egg was made from */
  food: string;
  /** set once it has hatched and been named */
  name: string | null;
  imageUrl: string | null;
  /** the picture is the egg's plain body for now (the painter failed); it is painted again in the background */
  stand?: boolean;
  /**
   * the expressions drawn from the hatched picture (M-R139): smile / sparkle / surprise / think / sad / yawn →
   * URL; made once after the hatching (POST /me/bati/faces), missing ones fall back to `imageUrl`
   */
  faces?: Partial<Record<BatiFace, string>>;
  /** M-R215: which of the member's {bati} this is (the one in the chat) */
  id?: string;
  egg?: BatiEggKind;
  /** decided at birth from the seed (M-R217), never changed */
  personality?: BatiPersonality;
  /** the 一人称 in use (the member's own, else the birth's) */
  self?: string;
  /** the member's own 一人称 / 呼び方 (null = the birth's) */
  selfCustom?: string | null;
  callCustom?: string | null;
  /** the 呼び方 the birth gave, as a template ({neo} = the name) */
  call?: string;
  /** the card (M-R217): 口ぐせ, the introduction, the birth date */
  card?: BatiCard;
  /**
   * a rare personality's fixed story lines, rewritten once at birth (script line as written → its line; a line that
   * failed the check is missing and is said as written). The ordinary ones use BATI_VARIANTS.
   */
  lines?: Record<string, string>;
  /** M-R222: 「覚えてること」 — what the member asked it to remember (five at most); the only memory the chat is given */
  memories?: BatiMemory[];
  /** M-R230: a style made for a wish (none of the seventeen fitted); its story lines are in `lines` */
  custom?: BatiCustomStyle;
  /** its role (the 1st: なんでも, changeable) */
  role?: BatiRole;
  /** M-R223: the looks decided so far, oldest first (the one worn now and the birth's included) */
  looks?: string[];
  /** M-R223: the seed and what it was (food / sound / word): it stays somewhere small in every look */
  seedKind?: 'food' | 'sound' | 'word' | 'wish';
  /** M-R232〜M-R235: this look in the side-by-side talk (expressions, blink / mouth parts, コロリン mini) */
  talk?: TalkLook | null;
}

/** バティのカード (M-R217): shown in the chat at birth, kept on Bluena's first shelf, exported as a picture */
export interface BatiCard {
  name: string | null;
  /** ISO date-time of the birth */
  bornAt: string;
  egg: BatiEggKind;
  /** the seed as answered, word for word (the first {bati}: the favourite food) */
  seed: string;
  personality: BatiPersonality;
  /** the personality's name (元気な子 …) */
  label: string;
  catchphrase: string;
  /** M-R225: the card's 性格 (one word: おっちょこちょい, 食いしん坊 …) — on the card only, never in the speech */
  trait?: string;
  /** about 40 characters, written for the seed at birth */
  intro: string;
  /** a rare personality: the card's edge glows gold */
  rare: boolean;
  /** M-R230: the third {bati}, born from a wish — the card shows 「ねがいの子」 */
  wish?: boolean;
  imageUrl: string | null;
}

/** one of the member's {bati} (M-R215: three at most; one is in the chat) */
export interface BatiSummary {
  id: string;
  name: string | null;
  egg: BatiEggKind;
  personality: BatiPersonality;
  imageUrl: string | null;
  faces?: Partial<Record<BatiFace, string>>;
  /** the one in the chat now */
  active: boolean;
  self: string;
  call: string;
  selfCustom: string | null;
  callCustom: string | null;
  card: BatiCard;
  role?: BatiRole;
  createdAt: string;
}
export const BATI_FACES = ['smile', 'sparkle', 'surprise', 'think', 'sad', 'yawn'] as const;
export type BatiFace = (typeof BATI_FACES)[number];

export interface NeoLookCandidate {
  id: string;
  url: string;
}

export interface NeoLookResult {
  candidates: NeoLookCandidate[];
  /** tries left for this OBOLO NEO (3 per apprentice; ORDER members are not limited) */
  triesLeft: number;
  /** refinements left (3 per apprentice) */
  refinesLeft?: number;
}

/** POST /me/bati/restyle (Bati's room): pictures of the same Bati changed by the wish, and the rounds left today */
export interface BatiRestyleResult {
  candidates: NeoLookCandidate[];
  left: number;
  /** M-R223: asked without a wish — each candidate's art touch (BATI_RESTYLE_TOUCHES label), in order */
  touches?: string[];
}

/** Result of POST /auth/request-code: who is this email? */
export type EntryKind = 'member' | 'invited';

/** POST /auth/verify returns a session for members, or the invitation to start Day 1 for invitees. */
export type VerifyResult = { kind: 'member'; token: string; user: Me } | { kind: 'invited'; inviteCode: string; inviterName: string };

export interface InviteView {
  code: string;
  inviterName: string;
  /** the inviter's own words on the invitation (null = none) */
  inviterMessage?: string | null;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
}

export interface MyInviteView extends InviteView {
  email: string;
  /** a voice note was recorded with it (M-R212) */
  voice?: boolean;
  createdAt: string;
}

export interface WalletView {
  manaBalance: number;
  earningsBalanceJpy: number;
  /** ISO date when MANA would expire if the user stays inactive (spec §3.1.1). */
  manaExpiresAt: string | null;
  recent: LedgerEntryView[];
}

export interface LedgerEntryView {
  id: string;
  ledger: 'mana' | 'earnings';
  delta: number;
  reason: string;
  createdAt: string;
}

export interface BuddyProfileView {
  buddyName: string;
  persona: BuddyPersona;
  hasMemory: boolean;
}

export interface BuddyMessageView {
  id: string;
  role: 'user' | 'buddy';
  text: string;
  createdAt: string;
  /** M-R208: an answer looked up on the web — the pages it is based on (shown as links under the bubble) */
  sources?: BuddySource[];
  /** M-R208: a picture {bati} drew in the chat ("〜の絵を見せて"), shown as its own bubble */
  image?: { url: string } | null;
  /** M-R222: the member's 「覚えといて」 in this message: kept, or refused / full / already (shown with the bubble) */
  remembered?: { text: string; result: 'kept' | 'refused' | 'full' | 'already' };
  /** M-R234/M-R235: {bati}'s expression and reaction for this reply, from the same call (the first sentence's) */
  face?: TalkFace;
  motion?: TalkMotion;
  /** M-R238: the expression and motion of each sentence ({bati}: the same call; yours: one small call on sending) */
  faces?: TalkBeat[];
  /** M-R243: the words with their marks (**bold** / ^^larger^^ / !!shout!!) — your own message's, from the small call */
  marked?: string;
}

/** a page a looked-up answer is based on: its title and the site's name */
export interface BuddySource {
  title: string;
  url: string;
  domain: string;
}

export interface BuddyQuotaView {
  usedToday: number;
  freeDaily: number;
  /** R18: {bati} is quiet now (no mana for a non-member / tired after a member's day): the chat shows a calm hint */
  rest?: 'noMana' | 'tired' | null;
}

/** 〔🖼 絵で見る〕: a picture from a library whose pictures may be used, with where it came from (M-R140) */
/** one spell card read by 〔🧭 スペルコンパス〕 */
export interface CompassCard {
  group: string;
  text: string;
}

/** 天王星: a story {bati} wrote from the spell cards; each page carries a scene line for its picture */
export interface StoryResult {
  title: string;
  pages: { text: string; scene: string }[];
}

export interface BuddyPicture {
  url: string;
  title: string;
  /** shown small under the picture: the library, author and licence */
  source: string;
  pageUrl: string;
  /** always true: pictures take no mana (M-R147) */
  free: boolean;
}

export interface BuddyChatResponse {
  userMessage: BuddyMessageView;
  reply: BuddyMessageView;
  quota: BuddyQuotaView;
  /** a worry about oneself or something dangerous: the app shows no 〔🖼 絵で見る〕 under it */
  kind?: 'normal' | 'worry' | 'danger';
  /** R12 (`canMake` chats): the message asks to make a work of this kind — the app's making flow takes it over */
  make?: BuddyMakeKind;
  /** R18: the reply is {bati}'s once-a-day line for why it goes quiet (access.ts batiRestLine); the chat closes after it */
  rest?: 'noMana' | 'tired';
}
/** R12: the kinds the Moon atelier makes, as the reply's classification names them */
export const BUDDY_MAKE_KINDS = ['art', 'song', 'video', 'novel', 'game', 'voice', 'radio'] as const;
export type BuddyMakeKind = (typeof BUDDY_MAKE_KINDS)[number];

export interface SaturnPostView {
  id: string;
  author: { id: string; handle: string; displayName: string; neoForm?: string | null; look?: PuniLook | null; pic?: string | null };
  text: string;
  voiceUrl: string;
  voiceSource: 'recorded' | 'cloned' | 'default';
  voiceDurationSec: number | null;
  starCount: number;
  starredByMe: boolean;
  createdAt: string;
  /** set on a reply: the post it answers */
  replyToId?: string | null;
  replyCount?: number;
  repostCount?: number;
  /** quote repost: the post it introduces (one level, no nesting) */
  repostOf?: SaturnPostRef | null;
  /** a photo posted with the voice (the character holds it) */
  photoUrl?: string | null;
  /** only in its author's own room (自分の部屋): nobody else ever sees it */
  room?: boolean;
}

/** A ひろば on Saturn's みんな map. `faces` = a few people who spoke there lately (drawn on the island). */
export interface PlazaView {
  id: string;
  name: string;
  icon: string;
  memberCount: number;
  /** voices alive there now (88 hours) */
  voiceCount: number;
  joined: boolean;
  faces: { id: string; neoForm?: string | null; look?: PuniLook | null; pic?: string | null }[];
  /** 'open' (the みんな map) or 'me' (only its maker) */
  access: 'open' | 'me';
}

/** A short form of a post, embedded in a quote repost. */
export interface SaturnPostRef {
  id: string;
  author: { id: string; handle: string; displayName: string; neoForm?: string | null; look?: PuniLook | null; pic?: string | null };
  text: string;
  voiceUrl: string;
}

/** Someone's Saturn page. */
export interface SaturnProfileView {
  user: { id: string; handle: string; displayName: string; neoForm?: string | null; bio: string; look?: PuniLook | null; pic?: string | null };
  // no counts on anyone's page (client rule 2026-10-07: no followers, following, friends or stars received)
  followedByMe: boolean;
  isMe: boolean;
}

export interface Paged<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

/**
 * Mercury 作曲 (client decision 2026-10-06): the partner (KIMORIN / Bati) talks with the visitor,
 * then an LLM designs the song. The design is the blueprint for the instrumental (MusicGen) and the
 * vocal (DiffSinger): lyrics in kana, chords, tempo and a melody of one note per mora.
 */
export interface SongNote {
  /** one mora in hiragana ("きょ", "ん", "っ"); '' = rest */
  kana: string;
  /** MIDI note number; null for a rest */
  midi: number | null;
  beats: number;
}

export interface SongLine {
  text: string;
  kana: string;
  notes: SongNote[];
}

export interface SongSection {
  name: 'verse' | 'chorus' | 'bridge';
  lines: SongLine[];
}

export interface SongDesign {
  title: string;
  emoji: string;
  genre: string;
  mood: string;
  bpm: number;
  /** pitch class of the key, 0 = C … 11 = B */
  keyRoot: number;
  scale: 'major' | 'minor';
  /** chord loop as scale degrees (0 = I) and as names for display */
  progression: number[];
  chords: string[];
  sections: SongSection[];
  /** English prompt for the instrumental generator (no vocals) */
  instrumentalPrompt: string;
  /** the partner's line when handing the song over */
  comment: string;
  /** length of one pass through all sections */
  seconds: number;
}

export interface ComposeChatResult {
  reply: string;
  /** enough was said to make a song: show the genre buttons */
  ready: boolean;
}

export interface InstrumentalResult {
  url: string;
  seconds: number;
}

/** How the song is sung (chosen by the LLM from the song design; sent to Fish as tags / prosody). */
export interface SingDirection {
  /** tags for the whole song, e.g. ["bright"] (after [singing]) */
  style: string[];
  /** tags at the start of each section, e.g. chorus: ["pitch_up", "energetic"] */
  sections: { name: 'verse' | 'chorus' | 'bridge'; tags: string[] }[];
  /** Fish prosody.speed (0.5–2.0) */
  speed: number;
  /** Fish prosody.volume in dB */
  volume: number;
  /** a [breath] after every n lines (0 = none) */
  breathEvery: number;
}

/** One sung lyric line: its own vocal file, so a single line can be re-sung or moved. */
export interface SongPhrase {
  index: number;
  section: 'verse' | 'chorus' | 'bridge';
  text: string;
  /** which registered voice sings it (self = own voice, bati = Bati's voice) */
  slot: 'self' | 'bati';
  url: string;
  /** length of the vocal file */
  seconds: number;
  /** where the line starts in the design (beats from the top) and how long its slot is */
  startBeat: number;
  beats: number;
  /** R13: its block's metatag label (〔サビ〕〔2番Aメロ〕) and key (lyricBlockKeys: 'chorus#2'), for a song sung from lyrics with metatags */
  label?: string;
  block?: string;
}

/** How the stored parts are put together (changing these costs no AI call). */
export interface SongMix {
  /** whole-song speed (pitch kept), 0.8–1.25 */
  tempo: number;
  /** gain in dB added to the vocal / the instrumental */
  vocalDb: number;
  bgmDb: number;
  /** the vocal comes in this many beats later */
  delayBeats: number;
  /** extra silence (seconds) after phrase i, pushing the later lines back */
  gaps: number[];
}

export interface SongView {
  id: string;
  title: string;
  /** the finished song (vocal + instrumental) */
  url: string;
  instrumentalUrl: string;
  instrumentalPrompt: string;
  bpm: number;
  phrases: SongPhrase[];
  mix: SongMix;
  direction: SingDirection;
  seconds: number;
  savedAt: string | null;
  /** the song's latest finished MV (Mars), for the Venus VJ — only in the saved-songs list */
  mvUrl?: string | null;
  /** R18 (君の声にする魔法): the versions kept (the original voice and the member's) and the one heard now */
  voice?: { using: 'original' | 'own'; versions: ('original' | 'own')[] };
}

export type SongEditAction = 'VOLUME_TEMPO_EDIT' | 'LYRICS_EDIT' | 'VOICE_REPLACE' | 'TIMING_EDIT' | 'GENRE_EDIT' | 'SONG_EXTEND' | 'CHAT';

export interface SongEditResult {
  /** the partner's answer in the chat */
  reply: string;
  action: SongEditAction;
  song: SongView;
  /** the GPU studio is starting: send `command` again once it is ready */
  pending?: 'MUSIC_WARMING';
  command?: SongEditCommand;
}

export interface PuniPicResult {
  candidates: { id: string; url: string }[];
  /** tries left today */
  left: number;
}

// --- Jupiter (パタパタ, docs/jupiter.md) ------------------------------------------------------------

/** Someone on Jupiter: how their butterfly is drawn. */
export interface JupiterAuthor {
  id: string;
  handle: string;
  displayName: string;
  neoForm?: string | null;
  /** painted butterfly (🦋 蝶を描いてもらう) */
  butterfly?: string | null;
  /** their Saturn character, shown with wings when there is no painted butterfly */
  pic?: string | null;
}

/** A private 根っこ item: everything you add lands here first. */
export interface JupiterRootView {
  id: string;
  kind: 'photo' | 'video';
  url: string;
  posterUrl: string | null;
  createdAt: string;
}

export interface JupiterPostView {
  id: string;
  author: JupiterAuthor;
  kind: 'photo' | 'video';
  url: string;
  posterUrl: string | null;
  text: string;
  filter: string;
  /** branch slot 0–3 on the owner's tree */
  branch: number;
  starCount: number;
  starredByMe: boolean;
  createdAt: string;
  replyCount: number;
  /** the latest few who replied (their butterflies are shown on the sticker) */
  repliers: JupiterAuthor[];
}

/** A reply to a Jupiter post (words, spoken or typed). */
export interface JupiterReplyView {
  id: string;
  author: JupiterAuthor;
  text: string;
  createdAt: string;
}

/** One butterfly in the sky: a person and their posts of the last 88 hours (newest first). */
export interface JupiterFlyer {
  author: JupiterAuthor;
  posts: JupiterPostView[];
}

/** Someone's tree (profile). */
export interface JupiterTreeView {
  author: JupiterAuthor;
  /** the four branch names (signs on the tree) */
  branches: string[];
  /** posts that finished flying (older than 88 hours), newest first */
  leaves: JupiterPostView[];
  /** still flying */
  flying: JupiterPostView[];
  // no counts (client rule 2026-10-07): no fruits / friends numbers
  followedByMe: boolean;
  isMe: boolean;
}

// --- Mars ---------------------------------------------------------------------------------------------

/** A video in your 裏スタジオ (private): every video you keep lives on Mars. */
export interface MarsBackstageVideo {
  id: string;
  url: string;
  posterUrl: string | null;
  seconds: number | null;
  title: string;
  createdAt: string;
}

// --- Mercury & Mars timelines (client decision 2026-10-07: they work like Saturn / Jupiter) ---------

export type TimelinePlanet = 'mercury' | 'mars';

/** Someone on Mercury / Mars: their picture (Saturn character) or NEO form. */
export interface PlanetAuthor {
  id: string;
  handle: string;
  displayName: string;
  neoForm?: string | null;
  pic?: string | null;
}

/**
 * A post on Mercury (a song: round) or Mars (a movie: square). It sails / flies on the
 * timelines for 88 hours, then stays on the owner's island / studio. No counts are sent
 * (client rule 2026-10-07): only whether you starred it and who answered lately.
 */
export interface PlanetPostView {
  id: string;
  planet: TimelinePlanet;
  author: PlanetAuthor;
  kind: 'song' | 'video';
  title: string;
  text: string;
  url: string;
  posterUrl: string | null;
  seconds: number | null;
  starredByMe: boolean;
  repliers: PlanetAuthor[];
  createdAt: string;
}

export interface PlanetFlyer {
  author: PlanetAuthor;
  posts: PlanetPostView[];
}

/** An island (Mercury) / studio (Mars): still sailing / flying, and what stays there. */
export interface PlanetProfileView {
  author: PlanetAuthor;
  flying: PlanetPostView[];
  works: PlanetPostView[];
  followedByMe: boolean;
  isMe: boolean;
}

export interface PlanetReplyView {
  id: string;
  author: PlanetAuthor;
  text: string;
  createdAt: string;
}
