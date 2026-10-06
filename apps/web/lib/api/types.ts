import type {
  BuddyChatResponse,
  BuddyMessageView,
  BuddyProfileView,
  BuddyQuotaView,
  CreateSaturnPostBody,
  InviteView,
  Locale,
  MyInviteView,
  Me,
  Paged,
  SaturnPostView,
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
  /** Photo → WebP ≤ 1600 px on the server (docs/media.md). */
  uploadPhoto(blob: Blob): Promise<UploadedPhoto>;
  /** Video → 720p / ~1.5 Mbps MP4 trimmed to `maxSeconds`, plus a poster image. */
  uploadVideo(blob: Blob, maxSeconds: number): Promise<UploadedVideo>;
  saturnFeed(cursor?: string, fresh?: boolean): Promise<Paged<SaturnPostView>>;
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
  batiEgg(food: string): Promise<Me>;
  /** The egg hatches: the Bati image is generated (can take a while). */
  batiHatch(): Promise<Me>;
  batiName(name: string): Promise<Me>;
  myInvites(): Promise<MyInviteView[]>;
  createInvite(email: string): Promise<MyInviteView>;
}
