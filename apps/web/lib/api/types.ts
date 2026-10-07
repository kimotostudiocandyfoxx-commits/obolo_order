import type {
  BuddyChatResponse,
  BuddyMessageView,
  BuddyProfileView,
  BuddyQuotaView,
  CreateJupiterPostBody,
  CreatePlazaBody,
  JupiterAuthor,
  JupiterFlyer,
  JupiterPostView,
  JupiterReplyView,
  JupiterRootView,
  JupiterTreeView,
  MarsBackstageBody,
  CreatePlanetPostBody,
  PlanetFlyer,
  PlanetPostView,
  PlanetProfileView,
  PlanetReplyView,
  TimelinePlanet,
  MarsBackstageVideo,
  CreateSaturnPostBody,
  InviteView,
  Locale,
  MyInviteView,
  Me,
  Paged,
  PlazaView,
  SaturnPostView,
  SaturnProfileView,
  PuniPicBody,
  PuniPicResult,
  UpdateBuddyProfileBody,
  UpdateProfileBody,
  EntryKind,
  VerifyResult,
  NeoLookBody,
  NeoLookResult,
  WalletView,
  OrderCheckout,
  ComposeChatBody,
  ComposeChatResult,
  ComposeDesignBody,
  SongDesign,
  InstrumentalBody,
  InstrumentalResult,
  RegisterVoiceBody,
  SingBody,
  SongEditBody,
  SongEditResult,
  SongView,
  SpeakBody,
} from '@obolo/shared';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Everything the web app needs from the backend. Implemented by HttpApi (Cloud Run) and DemoApi (in-browser). */
export interface UploadedPhoto {
  id: string;
  url: string;
  width: number;
  height: number;
}

export interface UploadedVideo {
  id: string;
  url: string;
  posterUrl: string;
  seconds: number;
  width: number;
  height: number;
}

export interface Api {
  readonly mode: 'live' | 'demo';
  /** Entry: members and invited people get a 6-digit code; anyone else → NOT_INVITED. */
  requestCode(email: string): Promise<{ sent: true; kind: EntryKind; devCode?: string }>;
  /** Members get a session; invited people get their invitation (account is created on Day 1). */
  verify(email: string, code: string): Promise<VerifyResult>;
  logout(): Promise<void>;
  me(): Promise<Me>;
  updateMe(body: UpdateProfileBody): Promise<Me>;
  wallet(): Promise<WalletView>;
  buddyProfile(): Promise<BuddyProfileView>;
  updateBuddyProfile(body: UpdateBuddyProfileBody): Promise<BuddyProfileView>;
  buddyMessages(cursor?: string): Promise<Paged<BuddyMessageView>>;
  buddyQuota(): Promise<BuddyQuotaView>;
  buddyChat(text: string, locale: Locale): Promise<BuddyChatResponse>;
  buddyForget(): Promise<void>;
  uploadVoice(blob: Blob): Promise<{ id: string; url: string }>;
  /** Mercury 作曲: the partner's reply while talking about the song. */
  composeChat(body: ComposeChatBody): Promise<ComposeChatResult>;
  /** Mercury 作曲: the song design (lyrics in kana, chords, melody). */
  composeDesign(body: ComposeDesignBody): Promise<SongDesign>;
  /** Mercury 伴奏: the instrumental from the design (GPU service), stored on Bunny. */
  composeInstrumental(body: InstrumentalBody): Promise<InstrumentalResult>;
  /** The GPU studio's state (phase, download progress, error) while it warms up. */
  composeMusicStatus(): Promise<Record<string, unknown>>;
  /** Register one of the two voices (own / Bati) from a recording of the fixed script. */
  registerVoice(body: RegisterVoiceBody): Promise<Me>;
  /** Read a text aloud in a registered voice (Fish Audio). */
  speak(body: SpeakBody): Promise<{ url: string }>;
  /** The words of one of your recordings (from uploadVoice). */
  transcribe(mediaId: string): Promise<{ text: string }>;
  /** Sing the song in a registered voice and mix it over its instrumental (Fish [singing] + ffmpeg). */
  composeSing(body: SingBody): Promise<SongView>;
  /** 手直し: a chat message about a sung song (or a retried command) → the partner's reply + the new mix. */
  composeSongEdit(id: string, body: SongEditBody): Promise<SongEditResult>;
  /** 保存する: keep this version of the song. */
  composeSongSave(id: string): Promise<SongView>;
  /** Photo → WebP ≤ 1600 px on the server (docs/media.md). */
  uploadPhoto(blob: Blob): Promise<UploadedPhoto>;
  /** Video → 720p / ~1.5 Mbps MP4 trimmed to `maxSeconds`, plus a poster image. */
  uploadVideo(blob: Blob, maxSeconds: number): Promise<UploadedVideo>;
  /** `plaza`: only the voices dropped in that ひろば (みんな map) */
  saturnFeed(cursor?: string, fresh?: boolean, tab?: 'all' | 'following' | 'friends', limit?: number, plaza?: string): Promise<Paged<SaturnPostView>>;
  /** ひろば (みんな map): most members first; `q` searches the names */
  plazas(q?: string): Promise<PlazaView[]>;
  plaza(id: string): Promise<PlazaView>;
  createPlaza(body: CreatePlazaBody): Promise<PlazaView>;
  joinPlaza(id: string, on: boolean): Promise<PlazaView>;
  /** The voice replies under a post (oldest first). */
  saturnReplies(postId: string): Promise<SaturnPostView[]>;
  saturnProfile(userId: string): Promise<SaturnProfileView>;
  saturnUserPosts(userId: string, cursor?: string): Promise<Paged<SaturnPostView>>;
  followSaturnUser(userId: string, on: boolean): Promise<SaturnProfileView>;
  createSaturnPost(body: CreateSaturnPostBody): Promise<SaturnPostView>;
  deleteSaturnPost(id: string): Promise<void>;
  starSaturnPost(id: string, on: boolean): Promise<{ starCount: number; starredByMe: boolean }>;
  // --- Invite-only onboarding
  getInvite(code: string): Promise<InviteView>;
  acceptInvite(code: string, displayName: string): Promise<{ token: string; user: Me; isNew: boolean }>;
  completeJourneyDay(day: number, answers?: Record<string, string>): Promise<Me>;
  /** Operator testing (/lab, admin token): move this account to a journey day. */
  jumpJourney(day: number): Promise<Me>;
  /** Start the next day (skip = "明日まで待てへん"). */
  advanceJourney(skip: boolean): Promise<Me>;
  /** Day 9 Eclipse payment: Stripe Embedded Checkout, or demo mode when billing is not configured. */
  orderCheckout(): Promise<OrderCheckout>;
  /** After Embedded Checkout completed: the server checks the session and records the order. */
  confirmOrder(sessionId: string): Promise<Me>;
  /** Demo mode only: "OK" without a charge. */
  becomeOrder(): Promise<Me>;
  // --- Day 3/4: generated OBOLO NEO look and the Bati egg (client decision 2026-10-05)
  lookCandidates(body: NeoLookBody): Promise<NeoLookResult>;
  /** One instruction → one new version of a candidate (3 per apprentice). */
  refineLook(mediaId: string, instruction: string): Promise<NeoLookResult>;
  chooseLook(mediaId: string): Promise<Me>;
  /** Saturn picture character: 2 painted candidates from a description (+ optional inspiration picture). */
  puniPicCandidates(body: PuniPicBody): Promise<PuniPicResult>;
  /** Pick a candidate as your Saturn character (null = back to the code-drawn look). */
  choosePuniPic(mediaId: string | null): Promise<Me>;
  /** Jupiter: 🦋 蝶を描いてもらう (2 painted candidates, 3 tries a day) */
  butterflyCandidates(body: PuniPicBody): Promise<PuniPicResult>;
  chooseButterfly(mediaId: string | null): Promise<Me>;

  // Jupiter — パタパタ
  jupiterSky(tab: 'all' | 'following' | 'friends'): Promise<JupiterFlyer[]>;
  jupiterRoots(): Promise<JupiterRootView[]>;
  /** after POST /media/photo (Jupiter is photos only; videos go to Mars's 裏スタジオ) */
  addJupiterRoot(body: { mediaId: string }): Promise<JupiterRootView>;
  removeJupiterRoot(id: string): Promise<void>;
  createJupiterPost(body: CreateJupiterPostBody): Promise<JupiterPostView>;
  starJupiterPost(id: string, on: boolean): Promise<{ starCount: number; starredByMe: boolean }>;
  jupiterReplies(postId: string): Promise<JupiterReplyView[]>;
  replyJupiter(postId: string, text: string): Promise<JupiterReplyView>;
  jupiterTree(userId: string): Promise<JupiterTreeView>;
  renameJupiterBranch(index: number, name: string): Promise<{ branches: string[] }>;
  searchJupiter(q: string): Promise<JupiterAuthor[]>;

  /** your saved songs (the soil of your island); `posted` = already sent out as a ship */
  savedSongs(): Promise<(SongView & { posted: boolean })[]>;
  // Mercury & Mars timelines (songs / square movies)
  planetSky(planet: TimelinePlanet, tab: 'all' | 'following' | 'friends'): Promise<PlanetFlyer[]>;
  planetProfile(planet: TimelinePlanet, userId: string): Promise<PlanetProfileView>;
  createPlanetPost(planet: TimelinePlanet, body: CreatePlanetPostBody): Promise<PlanetPostView>;
  starPlanetPost(planet: TimelinePlanet, id: string, on: boolean): Promise<{ starredByMe: boolean }>;
  planetReplies(planet: TimelinePlanet, id: string): Promise<PlanetReplyView[]>;
  replyPlanet(planet: TimelinePlanet, id: string, text: string): Promise<PlanetReplyView>;

  // Mars 裏スタジオ: every video you keep
  marsBackstage(): Promise<MarsBackstageVideo[]>;
  /** after POST /media/video */
  keepMarsVideo(body: MarsBackstageBody): Promise<MarsBackstageVideo>;
  removeMarsVideo(id: string): Promise<void>;
  batiEgg(food: string): Promise<Me>;
  /** The egg hatches: the Bati image is generated (can take a while). */
  batiHatch(): Promise<Me>;
  batiName(name: string): Promise<Me>;
  myInvites(): Promise<MyInviteView[]>;
  createInvite(email: string): Promise<MyInviteView>;
}
