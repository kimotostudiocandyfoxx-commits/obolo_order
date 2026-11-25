import type { LinkPreview } from '@obolo/shared';
import type { BookView, CompassSpell, GameBrokenBody, GameBuildBody, GameView, MoonCompassBody, NovelChapterBody, SaveSpellBody, SaveSpellResult, SavedSpell } from '@obolo/shared';
import type { ClipFile, ClipStartBody, ClipUploadStart, ChangeResult, HomeOshi, HomePlanet, PlanetHomeView, AddVersionBody, CreateMoonWorkBody, DemoJobBody, MakeConfirm, MakeKind, SpellBody, SpellKind, SpellTag, SpellView, HomecomingView, MoonWorkView, WorkVersion, FindTalksQuery, FindWorksQuery, FoundWork, ItemMarksView, ItemMarkView, MarkNames, MarkNamesBody, SetItemMarkBody, TalkDayView, BatiEggKind, BatiRole, DachiHistoryPage, DachiMessageView, DachiThreadView, SendDachiMessageBody, PlanetWorkKind, PlanetWorkReportBody, BluenaKeptView, CreateRadioShowBody, RadioDeckSong, RadioHome, RadioLiveState, RadioLiveView, RadioMessageBody, RadioMessageView, RadioNowBody, RadioReportBody, RadioShowView, StartRadioLiveBody, CompassCard, StoryResult, BuddyPicture, DachiLinkAsk, DachiLinkPeek, DachiLinkView, DachiView, DeliverBody, DeliveryView, LineVoicesBody, LineVoicesView, AtelierLayout, CallJoin, CallView, CommsContact, CommsFound, CommsStatus, DmMessage, JobView, MvProjectView } from '@obolo/shared';
import type {
  MembersDay,
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
  FullSongBody,
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
  BatiRestyleResult,
  WalletView,
  BillingPortal,
  OrderCheckout,
  GemCheckout,
  GemCredit,
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

/** R11: a paid making asked in the Moon atelier carries the member's yes to the plan and its price */
export type Paid = { confirm?: MakeConfirm; /** the spell said yes to (its key is confirm.spell) */ spell?: SpellTag[] };

/** R12: what the Moon atelier's chat sends with a message (BuddyChatBody) */
export type BuddyChatOpts = { history?: { role: 'user' | 'buddy'; text: string }[]; canMake?: boolean };

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
  /** R12: `opts.history` — the talk's own recent turns (oldest first); `opts.canMake` — the chat can make works */
  buddyChat(text: string, locale: Locale, opts?: BuddyChatOpts): Promise<BuddyChatResponse>;
  /** the same, with the ordinary answer shown as it is written (live API only) */
  buddyChatStream?(text: string, locale: Locale, onText: (piece: string) => void): Promise<BuddyChatResponse>;
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
  /** M-R246: the egg recording (the held takes, appended) → {bati}'s voice (a queued voice model, +2 semitones) */
  batiVoice(body: import('@obolo/shared').BatiVoiceBody): Promise<Me>;
  /** 〔声を消す〕: the recording and the voice model deleted; {bati} speaks in the default voice */
  removeBatiVoice(): Promise<Me>;
  /** 〔写真を消す〕: the looks made from the photo deleted (the photo itself was never kept); the placeholder look */
  removeLook(): Promise<Me>;
  /** M-R247: the start-of-app agreement (terms, privacy, photos and voice) */
  /** M-R252: with the start screen's branch (`media: false` = no photo and voice) and the birth year asked there */
  consent(version: string, guardian?: boolean, opts?: { media?: boolean; birthYear?: number | null }): Promise<Me>;
  /** whether the voice service (Fish Audio) is connected */
  voiceStatus(): Promise<{ fish: boolean }>;
  /** Read a text aloud in a registered voice (Fish Audio). */
  speak(body: SpeakBody): Promise<{ url: string }>;
  /** one sentence of {bati}'s answer in {bati}'s story voice (M-R179); url null when it cannot be made now */
  batiSays(text: string): Promise<{ url: string | null }>;
  /** The words of one of your recordings (from uploadVoice). */
  transcribe(mediaId: string): Promise<{ text: string }>;
  /** story lines with the member's names in them: voiced ones back, the rest being voiced (poll) */
  lineVoices(body: LineVoicesBody): Promise<LineVoicesView>;
  /** Sing the song in a registered voice and mix it over its instrumental (Fish [singing] + ffmpeg). */
  composeSing(body: SingBody): Promise<SongView>;
  /** the whole song sung by the music studio (ACE-Step + HTDemucs + Seed-VC) — a background job */
  composeFullSong(body: FullSongBody): Promise<JobView>;
  /** background work (a song, an MV): poll until done */
  getJob(id: string): Promise<JobView>;
  activeJobs(): Promise<{ jobs: JobView[] }>;
  /** M-R253 §4: a review stand-in job (no AI): it only takes its seconds */
  /** R11: `pay` — the browser demo charges the stand-in like the API charges the real one (with the yes) */
  demoJob(body: DemoJobBody & { pay?: { kind: MakeKind; confirm: MakeConfirm; spell?: { kind: SpellKind; tags: SpellTag[] } } }): Promise<JobView>;
  /** R11: the spell (スペル) {bati} lays out for a paid making — fresh for the words, or changed by them */
  moonSpell(body: SpellBody): Promise<SpellView>;
  /** R12: {bati}'s コンパス — a photo of yours (a 📎 file), a pasted image or a YouTube link read into a spell */
  compassSpell(body: MoonCompassBody): Promise<CompassSpell>;
  /** R12: {bati}'s スペルブック — the spells you keep (newest first), keep one, rename, used, throw away */
  spellBook(): Promise<SavedSpell[]>;
  saveSpell(body: SaveSpellBody): Promise<SaveSpellResult>;
  renameSpell(id: string, name: string): Promise<SavedSpell>;
  usedSpell(id: string): Promise<SavedSpell>;
  dropSpell(id: string): Promise<{ ok: true }>;
  /** client 2026-11-25 (本): a new book from its spell, or the next chapter from a chapter spell (free; capped a day) */
  novelChapter(body: NovelChapterBody): Promise<BookView>;
  books(): Promise<BookView[]>;
  /** your own book, or one a ダチ sent you */
  book(id: string): Promise<BookView>;
  /** client 2026-11-25 (ゲーム): a game built / tweaked with the yes (a background job; its result is the game) */
  gameBuild(body: GameBuildBody): Promise<JobView>;
  /** your own game, or one a ダチ sent you (played in the sandbox) */
  game(id: string): Promise<GameView>;
  /** the version did not run in the sandbox: its mana back (soon after it was built, a few a day) */
  gameBroken(id: string, body: GameBrokenBody): Promise<{ refunded: number }>;
  /** M-R253: the Moon atelier's works — tries inside one work, the face, material, where it was made */
  moonWorks(ids?: string[]): Promise<MoonWorkView[]>;
  createMoonWork(body: CreateMoonWorkBody): Promise<MoonWorkView>;
  addMoonVersion(id: string, body: AddVersionBody): Promise<MoonWorkView & { dropped: WorkVersion[] }>;
  setMoonFace(id: string, index: number): Promise<MoonWorkView>;
  dropMoonVersion(id: string, index: number): Promise<MoonWorkView & { dropped: WorkVersion }>;
  /** M-R253 §5: flown works back home (88 h), not told yet; and told */
  homecomings(): Promise<HomecomingView[]>;
  homecomingsTold(keys: string[]): Promise<void>;
  /** 手直し: a chat message about a sung song (or a retried command) → the partner's reply + the new mix. */
  composeSongEdit(id: string, body: SongEditBody): Promise<SongEditResult>;
  /** 保存する: keep this version of the song. */
  composeSongSave(id: string): Promise<SongView>;
  /** Photo → WebP ≤ 1600 px on the server (docs/media.md). */
  uploadPhoto(blob: Blob): Promise<UploadedPhoto>;
  /** Bluena's 📎 (shared/clip.ts): a file from the device, in pieces — start, each piece, done (the kept file) */
  startClip(body: ClipStartBody): Promise<ClipUploadStart>;
  putClipPart(id: string, n: number, piece: Blob, onProgress?: (sent: number) => void): Promise<void>;
  finishClip(id: string): Promise<ClipFile>;
  /** your 📎 files in Bluena, newest first */
  clips(): Promise<ClipFile[]>;
  /** a 📎 file's bytes (yours, or one a ダチ sent you), for an object URL */
  clipBlob(id: string): Promise<Blob>;
  dropClip(id: string): Promise<void>;
  /** a 📎 file handed to {bati}: a picture is looked at; the line {bati} says */
  lookClip(id: string): Promise<{ line: string; looked: boolean }>;
  /** R12: a pasted link's preview for its portal in the talk (cached on the server; pictures as data: URLs) */
  unfurl(url: string): Promise<LinkPreview>;
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
  /** 〔公開する〕: a kororin kept in your room (Bluena's Saturn folder) flies out to Saturn; its 88 hours start now (M-R208) */
  publishSaturnPost(id: string): Promise<SaturnPostView>;
  starSaturnPost(id: string, on: boolean): Promise<{ starCount: number; starredByMe: boolean }>;
  // --- Invite-only onboarding
  getInvite(code: string): Promise<InviteView>;
  acceptInvite(code: string, displayName: string): Promise<{ token: string; user: Me; isNew: boolean }>;
  completeJourneyDay(day: number, answers?: Record<string, string>): Promise<Me>;
  /** SYS-S002 from the settings: its flags (kept as sys.<key> in me.story) */
  saveSysStory(answers: Record<string, string>): Promise<Me>;
  /** the second journey: chapter `chapter` (shared LAP2) finished */
  completeLap2(chapter: number, answers?: Record<string, string>): Promise<Me>;
  /** Operator testing (/lab, admin token): move this account to a journey day (1–10) or a members' day ('m1'〜'm3'). */
  jumpJourney(day: number | MembersDay): Promise<Me>;
  /** The tester entrance (Me.tester only; 403 otherwise): open everything — every Moon atelier kind, {bati}, Bluena, the ダチ. */
  testerUnlockAll(): Promise<Me>;
  testerMana(): Promise<Me>;
  /** The tester entrance: a journey day 1–8 or a members' day from its start, no wait. */
  testerJump(day: number | MembersDay): Promise<Me>;
  /** The tester entrance: the next day now (the wait skipped). */
  testerNext(): Promise<Me>;
  /** The tester entrance: this account back to before day 1 (the account and the login stay). */
  testerReset(): Promise<Me>;
  /** Start the next day (skip = "明日まで待てへん"). */
  advanceJourney(skip: boolean): Promise<Me>;
  /** Day 9 Eclipse payment: Stripe Embedded Checkout, or demo mode when billing is not configured. */
  orderCheckout(): Promise<OrderCheckout>;
  /** After Embedded Checkout completed: the server checks the session and records the order. */
  confirmOrder(sessionId: string): Promise<Me>;
  /** Demo mode only: "OK" without a charge. */
  becomeOrder(): Promise<Me>;
  /** P-BILL-4: the Stripe Customer Portal (change the card, cancel); demo mode has none. */
  billingPortal(): Promise<BillingPortal>;
  /** P-BILL-1: buy a mana gem (MANA_GEMS id) — Embedded Checkout, or demo mode (the mana is added at once). Members only. */
  gemCheckout(gemId: string): Promise<GemCheckout>;
  /** P-BILL-1: after the gem's Embedded Checkout completed — adds its mana once (NOT_PAID while pending). */
  confirmGem(sessionId: string): Promise<GemCredit>;
  // --- Day 3/4: generated OBOLO NEO look and the Bati egg (client decision 2026-10-05)
  lookCandidates(body: NeoLookBody): Promise<NeoLookResult>;
  /** One instruction → one new version of a candidate (3 per apprentice). */
  /** `mediaId` null: change the look worn now (the second journey's basin) */
  /** `magic`: Bati's magic in Bati's room (the Moon) — rounds counted per day (BATI_MAGIC_PER_DAY), free on the first journey */
  refineLook(mediaId: string | null, instruction: string, magic?: boolean, paid?: Paid): Promise<NeoLookResult>;
  chooseLook(mediaId: string): Promise<Me>;
  /** Saturn picture character: 2 painted candidates from a description (+ optional inspiration picture). */
  puniPicCandidates(body: PuniPicBody): Promise<PuniPicResult>;
  /** Pick a candidate as your Saturn character (null = back to the code-drawn look). */
  choosePuniPic(mediaId: string | null): Promise<Me>;
  /** ダチ (draft 21): your dachi; Saturn D04-S005c makes the inviter one; 〔ダチへ〕 delivers; 〔推し〕 lists what came */
  dachi(): Promise<DachiView[]>;
  befriendInviter(): Promise<DachiView | null>;
  /** 〔🤝 ダチの招待状〕 (M-R175): a link once for 48 hours; both press 〔ダチになる〕 */
  createDachiLink(): Promise<DachiLinkView>;
  peekDachiLink(token: string): Promise<DachiLinkPeek>;
  openDachiLink(token: string): Promise<DachiLinkPeek>;
  dachiLinkAsks(): Promise<DachiLinkAsk[]>;
  confirmDachiLink(token: string): Promise<DachiView>;
  endDachiLink(token: string): Promise<void>;
  deliver(body: Partial<DeliverBody> & Pick<DeliverBody, 'kind'>): Promise<{ to: number }>;
  oshi(kind?: DeliveryView['kind']): Promise<DeliveryView[]>;
  /** ダチの声のメッセージ (M-R212): the atelier drawer's threads ({inviter} / KIMORIN⭐︎ / MIKIE⭐︎DRILL / other dachi), empty until D04-S005c */
  dachiThreads(): Promise<DachiThreadView[]>;
  /** R10: a page at a time — the newest, or the ones before `before` (oldest first) */
  dachiMessages(thread: string, page?: { before?: string; limit?: number }): Promise<DachiMessageView[]>;
  /** R10: every ダチ talk, newest first, with its last message */
  dachiHistory(cursor?: string | null): Promise<DachiHistoryPage>;
  /** a voice message (mediaId from uploadVoice, ≤ 60 s) or a Bluena work card; only between dachi */
  sendDachiMessage(thread: string, body: SendDachiMessageBody): Promise<DachiMessageView>;
  readDachiThread(thread: string): Promise<void>;
  /** Jupiter: 🦋 蝶を描いてもらう (2 painted candidates, 3 tries a day) */
  butterflyCandidates(body: PuniPicBody): Promise<PuniPicResult>;
  chooseButterfly(mediaId: string | null): Promise<Me>;
  /** Jupiter (first journey): Bati draws a sticker's picture from its words (kept only for you). */
  stickerArt(text: string, style?: string, paid?: Paid): Promise<{ id: string; url: string }>;

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

  // Earth mail & phone (members, between ダチ)
  commsStatus(): Promise<CommsStatus>;
  commsContacts(): Promise<CommsContact[]>;
  findPerson(handle: string): Promise<{ person: CommsFound | null }>;
  followPerson(id: string, on: boolean): Promise<CommsFound>;
  blockPerson(id: string, on: boolean): Promise<CommsFound>;
  blockedPeople(): Promise<CommsFound[]>;
  reportPerson(body: { userId: string; kind: 'mail' | 'call' | 'person' | 'voice'; reason: 'mean' | 'scary' | 'other'; note?: string }): Promise<void>;
  dmMessages(peerId: string, after?: string): Promise<DmMessage[]>;
  sendDm(peerId: string, body: { text: string; audioUrl?: string }): Promise<DmMessage>;
  readDm(peerId: string): Promise<void>;
  firebaseToken(): Promise<{ token: string; projectId: string | null }>;
  subscribePush(sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<void>;
  unsubscribePush(endpoint: string): Promise<void>;
  startCall(to: string): Promise<{ call: CallView; join: CallJoin }>;
  incomingCalls(): Promise<CallView[]>;
  getCall(id: string): Promise<CallView>;
  answerCall(id: string): Promise<{ call: CallView; join: CallJoin }>;
  declineCall(id: string): Promise<CallView>;
  endCall(id: string): Promise<CallView>;

  // Mars 裏スタジオ: every video you keep
  marsBackstage(): Promise<MarsBackstageVideo[]>;
  /** Uranus: your atelier (ORDER members) */
  atelier(): Promise<AtelierLayout>;
  saveAtelier(layout: AtelierLayout): Promise<AtelierLayout>;
  /** after POST /media/video */
  keepMarsVideo(body: MarsBackstageBody): Promise<MarsBackstageVideo>;
  removeMarsVideo(id: string): Promise<void>;
  // Mars MV studio: a Mercury song + videos / photos → Bati's MV
  mvCreate(songId: string): Promise<MvProjectView>;
  mvGet(id: string): Promise<MvProjectView>;
  mvAddMaterial(id: string, body: { mediaId: string; kind: 'photo' | 'video'; posterUrl?: string | null; seconds?: number | null }): Promise<MvProjectView>;
  mvRemoveMaterial(id: string, mediaId: string): Promise<MvProjectView>;
  /** waits until the MV is made (a minute or two) */
  mvRender(id: string): Promise<MvProjectView>;
  /** the lyrics on the MV — a background job */
  mvLyrics(id: string): Promise<JobView>;
  /** story MV: painted from the song and the profile picture; `mood` may be empty (Bati decides) — a background job */
  mvStory(id: string, mood: string, from?: 'atelier', paid?: Paid): Promise<JobView>;
  /** `egg`: the egg chosen on the altar (M-R215: 'moon' = 女の子寄り, 'sun' = 男の子寄り); the personality is decided from the food (M-R217) — SEED_REASK: OBOLON asks again */
  batiEgg(food: string, egg?: BatiEggKind): Promise<Me>;
  /** M-R218: the grown egg hatched in the Moon temple from its seed (the 2nd: a sound, the 3rd: a word); EGG_NOT_READY / BATI_FULL / SEED_REASK */
  batiNew(egg: BatiEggKind, seed: string): Promise<Me>;
  /** M-R215: another of the member's {bati} comes into the chat */
  batiSwitch(id: string): Promise<Me>;
  /** M-R215: how {bati} calls the member and its 一人称 (null = the birth's) */
  batiSpeech(body: { id?: string; call?: string | null; self?: string | null }): Promise<Me>;
  /** M-R222: the card's 〔覚えさせる〕 (the chat's 「覚えといて」 is found by the server); MEMORY_REFUSED / MEMORY_FULL / MEMORY_ALREADY */
  batiMemory(text: string, id?: string): Promise<Me>;
  /** M-R222: forget one of 「覚えてること」 (or all without `memory`) */
  batiForget(memory?: string, id?: string): Promise<Me>;
  batiRole(role: BatiRole, id?: string): Promise<Me>;
  /** The egg hatches: the Bati image is generated (can take a while). */
  batiHatch(): Promise<Me>;
  batiName(name: string): Promise<Me>;
  /** Bati's six expressions from the hatched picture (once; M-R139) */
  batiFaces(): Promise<Me>;
  /** Bati's room: pictures of the same Bati dressed up / changed a little by the wish (BATI_RESTYLE_PER_DAY rounds a day) */
  batiRestyle(wish?: string, from?: string, paid?: Paid): Promise<BatiRestyleResult>;
  /** one of them becomes the Bati picture (its expressions are drawn again in the background) */
  chooseBatiRestyle(id: string): Promise<Me>;
  /** M-R223 〔前に戻す〕: the {bati} look decided before the one worn now (NO_PREVIOUS when none) */
  batiLookBack(): Promise<Me>;
  /** M-R223: Bluena's first shelf — a {bati} look kept before (Me.bati.looks), worn again */
  batiLookRestore(url: string): Promise<Me>;
  /** M-R223: Bluena's first shelf — a look of one's own worn before (Me.lookHistory), worn again */
  lookRestore(url: string): Promise<Me>;
  /** the NEO look standing without a background (M-R149), drawn once per look */
  lookStandee(): Promise<Me>;
  /** the small chibi NEO (M-R155/M-R161), drawn once per look */
  lookChibi(): Promise<Me>;
  /** 〔🖼 絵で見る〕 under one of Bati's answers (null = none found) */
  buddyPicture(question: string, answer?: string): Promise<{ picture: BuddyPicture | null }>;
  /** 〔🧭 スペルコンパス〕: a picture / a song clip / a YouTube link → spell cards */
  compass(body: { kind: 'art' | 'song'; focus?: string; media?: { mime: string; data: string }; url?: string }): Promise<{ cards: CompassCard[] }>;
  /** 天王星 〔✒️ 書く〕: said → spell cards (free) / cards → a short story (mana) */
  storyCards(said: string): Promise<{ cards: string[] }>;
  writeStory(cards: string[]): Promise<StoryResult>;
  myInvites(): Promise<MyInviteView[]>;
  /** `message`: a few words of your own printed on the invitation (optional); `voice`: a short voice note (M-R212, from uploadVoice) */
  createInvite(email: string, message?: string, voice?: { mediaId: string; seconds: number }): Promise<MyInviteView>;

  // Venus — the radio planet (docs/工房とブルーナ_設計.md §9–10)
  radioHome(): Promise<RadioHome>;
  /** the booth: Bluena's songs that may go on air (Bluena = the DJ's USB stick) */
  radioDeck(): Promise<RadioDeckSong[]>;
  /** "radio / DJ OK" on one of your songs */
  setSongRadio(songId: string, allow: boolean): Promise<{ allowRadio: boolean }>;
  /** the recording of a show (POST /media/show) */
  uploadShow(blob: Blob): Promise<{ id: string; url: string }>;
  createRadioShow(body: CreateRadioShowBody): Promise<RadioShowView>;
  /** your shows = Bluena's Venus folder */
  myRadioShows(): Promise<RadioShowView[]>;
  /** someone's booth: their public shows back home after 88 hours on the air (M-R208) */
  radioHostShows(hostId: string): Promise<RadioShowView[]>;
  publishRadioShow(id: string, on: boolean): Promise<RadioShowView>;
  removeRadioShow(id: string): Promise<void>;
  radioShow(id: string): Promise<RadioShowView>;
  startRadioLive(body: StartRadioLiveBody): Promise<RadioLiveView>;
  radioLive(id: string): Promise<RadioLiveState>;
  setRadioNow(id: string, now: RadioNowBody['now']): Promise<RadioLiveView>;
  endRadioLive(id: string): Promise<RadioLiveView>;
  radioMessage(id: string, body: RadioMessageBody): Promise<RadioMessageView>;
  hideRadioMessage(liveId: string, messageId: string): Promise<void>;
  reportRadio(body: RadioReportBody): Promise<void>;
  /** M-R236: your ★ / marks on everything, and your names for ♠♦♥♣ */
  itemMarks(): Promise<ItemMarksView>;
  /** M-R236: one item's ★ (0–3) and mark (no ★ and no mark = cleared) */
  setItemMark(body: SetItemMarkBody): Promise<ItemMarkView>;
  setMarkNames(body: MarkNamesBody): Promise<MarkNames>;
  /** M-R237: Bluena's works across the planets (newest first), filtered by planet / ★ / mark / words */
  findWorks(f: FindWorksQuery): Promise<FoundWork[]>;
  /** M-R237: a thread's past talk as days (newest first), filtered by ★ / mark / words */
  findTalkDays(f: FindTalksQuery): Promise<TalkDayView[]>;
  /** M-R213: 〔見えなくする〕 a stranger's planet work, for you only (kept on the server) */
  hidePlanetWork(kind: PlanetWorkKind, id: string, on: boolean): Promise<{ hidden: boolean }>;
  /** M-R213: 〔通報〕 a stranger's planet work */
  reportPlanetWork(kind: PlanetWorkKind, id: string, body: PlanetWorkReportBody): Promise<void>;
  /** M-R258 星のホーム: own forever / dachi and 推し 88 hours / a few strangers far (none under 15) */
  planetHome(planet: HomePlanet): Promise<PlanetHomeView>;
  /** opened now (the next visit sparkles what came after); answers the visit before */
  planetHomeVisit(planet: HomePlanet): Promise<{ lastVisitAt: string | null }>;
  /** 並べかえ: your own works in your place */
  planetHomeOrder(planet: HomePlanet, ids: string[]): Promise<{ ids: string[] }>;
  /** 外す: your own work back into Bluena only */
  planetHomeTakeOut(planet: HomePlanet, id: string): Promise<void>;
  /** M-R263: what {bati} can change (the registry in @obolo/shared changeables) — read all, set one (keeps what it was) */
  changeables(): Promise<Record<string, string>>;
  setChangeable(id: string, value: string): Promise<ChangeResult>;
  /** M-R262: your record's colour on a planet home (Saturn) */
  planetHomeColour(planet: HomePlanet, colour: string): Promise<{ colour: string }>;
  /** 推し: who you follow (dachi marked, in by themselves) */
  oshiList(): Promise<HomeOshi[]>;
  /** 〔推す〕 / 外す (a dachi cannot be taken out) */
  setOshi(userId: string, on: boolean): Promise<HomeOshi[]>;
  /** 〔ブルーナにしまう〕 someone else's song (a Mercury post) */
  keepInBluena(postId: string, on: boolean): Promise<{ kept: boolean }>;
  /** Bluena 〔しまった作品〕: your kept works (links) */
  bluenaKept(): Promise<BluenaKeptView[]>;
}
