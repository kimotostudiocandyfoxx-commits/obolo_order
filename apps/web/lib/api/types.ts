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
  requestCode(email: string): Promise<{ sent: true; devCode?: string }>;
  verify(email: string, code: string): Promise<{ token: string; user: Me; isNew: boolean }>;
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
  onboardingProgress(stage: 'day1_done', answers?: Record<string, string>): Promise<Me>;
  myInvites(): Promise<MyInviteView[]>;
  createInvite(email: string): Promise<MyInviteView>;
}
