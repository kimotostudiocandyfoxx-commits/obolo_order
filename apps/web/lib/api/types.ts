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
  saturnFeed(cursor?: string, fresh?: boolean): Promise<Paged<SaturnPostView>>;
  createSaturnPost(body: CreateSaturnPostBody): Promise<SaturnPostView>;
  deleteSaturnPost(id: string): Promise<void>;
  starSaturnPost(id: string, on: boolean): Promise<{ starCount: number; starredByMe: boolean }>;
  // --- Invite-only onboarding
  getInvite(code: string): Promise<InviteView>;
  acceptInvite(code: string, displayName: string): Promise<{ token: string; user: Me; isNew: boolean }>;
  completeJourneyDay(day: number, answers?: Record<string, string>): Promise<Me>;
  /** Start the next day (skip = "明日まで待てへん"). */
  advanceJourney(skip: boolean): Promise<Me>;
  /** "ORDERになるか？" → yes. Payment is PLACEHOLDER (P-BILL-1). */
  becomeOrder(): Promise<Me>;
  // --- Day 3/4: generated OBOLO NEO look and the Bati egg (client decision 2026-10-05)
  lookCandidates(body: NeoLookBody): Promise<NeoLookResult>;
  chooseLook(mediaId: string): Promise<Me>;
  batiEgg(food: string): Promise<Me>;
  /** The egg hatches: the Bati image is generated (can take a while). */
  batiHatch(): Promise<Me>;
  batiName(name: string): Promise<Me>;
  myInvites(): Promise<MyInviteView[]>;
  createInvite(email: string): Promise<MyInviteView>;
}
