import { HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { LlmProvider, moderateText } from '@obolo/ai';
import {
  CHILD_AGE,
  flyingSince,
  radioTags,
  RADIO_LIVE_STALE_SECONDS,
  type BluenaKeptView,
  type CommsPerson,
  type CreateRadioShowBody,
  type RadioCue,
  type RadioDeckSong,
  type RadioHome,
  type RadioLiveState,
  type RadioLiveView,
  type RadioLoop,
  type RadioMessageBody,
  type RadioMessageView,
  type RadioNowBody,
  type RadioReportBody,
  type RadioShowView,
  type StartRadioLiveBody,
} from '@obolo/shared';
import { and, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { notChild, planetWorkScope, viewerSeesAuthor } from '../common/child';
import { apiError } from '../common/errors';
import { AppConfig, CONFIG } from '../config';
import { Database } from '../db/db';
import { bluenaSaves, mediaObjects, personHides, planetPosts, radioLives, radioMessages, radioShows, songs, userBlocks, userReports, users } from '../db/schema';
import { LLM } from '../infra/tokens';
import { activeMember } from '../users/tester';
import { PlanetWorksService } from '../planets/planet-works.service';

type ShowRow = typeof radioShows.$inferSelect;
type LiveRow = typeof radioLives.$inferSelect;

const personCols = { id: users.id, handle: users.handle, displayName: users.displayName, neoForm: users.neoForm, pic: users.puniPicUrl };
const nameOf = (p: Pick<CommsPerson, 'displayName' | 'handle'>) => p.displayName || p.handle;
const stale = () => new Date(Date.now() - RADIO_LIVE_STALE_SECONDS * 1000);

/**
 * Venus — the radio planet (client decision 2026-11-21, docs/工房とブルーナ_設計.md §9–10).
 *  - The booth reads Bluena like a DJ's USB stick: your own songs and songs you kept from others,
 *    only those born here whose maker left "radio / DJ OK" on.
 *  - 〔収録〕: the recording becomes a show in Bluena's Venus folder (private) → 〔公開する〕.
 *  - 〔生配信〕: voice only, ORDER members only at first; the picture and the playing song travel as
 *    data. Ending keeps the recording in Bluena. Safety: report, block, the host hides comments,
 *    the team stops a show / takes a recording down.
 * No numbers anywhere: no listener counts, no play counts.
 */
@Injectable()
export class RadioService {
  constructor(
    private readonly db: Database,
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(LLM) private readonly llm: LlmProvider,
    @Optional() private readonly works?: PlanetWorksService,
  ) {}

  // --- who may do what ---------------------------------------------------------------------------

  private async member(userId: string) {
    const [u] = await this.db.read
      .select({ id: users.id, email: users.email, orderedAt: users.orderedAt, subscriptionStatus: users.subscriptionStatus, suspendedAt: users.suspendedAt, onboarding: users.onboardingJson })
      .from(users)
      .where(eq(users.id, userId));
    if (!u || u.suspendedAt) return { ok: false, child: false };
    const year = Number((u.onboarding as Record<string, unknown> | null)?.birthYear ?? 0);
    const child = year > new Date().getFullYear() - CHILD_AGE;
    // P-BILL-4: paid, and the subscription has not ended (shared isActiveMember)
    return { ok: !this.cfg.COMMS_MEMBERS_ONLY || activeMember(u), child };
  }

  /** people this user blocked or who blocked them (both ways: they never meet on the radio) */
  private async blockedWith(userId: string): Promise<Set<string>> {
    const rows = await this.db.read
      .select({ a: userBlocks.blockerId, b: userBlocks.blockedId })
      .from(userBlocks)
      .where(or(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, userId)));
    // planets 2-3 (M-R317): people this user reported are out of their sight too (one way: only this user's rows)
    const hidden = (await this.db.read.select({ id: personHides.hiddenId }).from(personHides).where(eq(personHides.userId, userId))) ?? [];
    return new Set([...rows.map((r) => (r.a === userId ? r.b : r.a)), ...hidden.map((h) => h.id)]);
  }

  private async people(ids: string[]): Promise<Map<string, CommsPerson>> {
    const uniq = [...new Set(ids)];
    const rows = uniq.length ? await this.db.read.select(personCols).from(users).where(inArray(users.id, uniq)) : [];
    return new Map(rows.map((p) => [p.id, p as CommsPerson]));
  }

  // --- the booth's USB: songs from Bluena -------------------------------------------------------

  async deck(userId: string): Promise<RadioDeckSong[]> {
    const [me] = await this.db.read.select(personCols).from(users).where(eq(users.id, userId));
    const mine = await this.db.read
      .select({ id: songs.id, title: songs.title, url: songs.mixUrl, design: songs.designJson, seconds: songs.seconds, allowRadio: songs.allowRadio })
      .from(songs)
      .where(and(eq(songs.userId, userId), isNull(songs.deletedAt), sql`${songs.savedAt} IS NOT NULL`))
      .orderBy(desc(songs.savedAt))
      .limit(200);
    const blocked = await this.blockedWith(userId);
    const kept = await this.db.read
      .select({
        postId: planetPosts.id,
        title: planetPosts.title,
        url: planetPosts.url,
        seconds: planetPosts.seconds,
        ownerId: planetPosts.userId,
        songId: songs.id,
        design: songs.designJson,
        allowRadio: songs.allowRadio,
        songGone: songs.deletedAt,
      })
      .from(bluenaSaves)
      .innerJoin(planetPosts, eq(planetPosts.id, bluenaSaves.postId))
      .leftJoin(songs, eq(songs.id, planetPosts.sourceId))
      .where(and(eq(bluenaSaves.userId, userId), eq(bluenaSaves.kind, 'planet_post'), eq(planetPosts.planet, 'mercury'), isNull(planetPosts.deletedAt)))
      .orderBy(desc(bluenaSaves.createdAt))
      .limit(200);
    const who = await this.people(kept.map((k) => k.ownerId));
    const bpm = (d: unknown) => {
      const n = Number((d as Record<string, unknown> | null)?.bpm);
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    return [
      ...mine.map<RadioDeckSong>((s) => ({
        id: s.id,
        title: s.title,
        url: s.url,
        bpm: bpm(s.design),
        seconds: s.seconds,
        by: me ? nameOf(me) : '',
        byId: userId,
        from: 'mine',
        allowRadio: s.allowRadio,
      })),
      // someone else's song: only while it is still out there, they let radio use it, and neither blocked the other
      ...kept
        .filter((k) => k.songId && !k.songGone && k.allowRadio && !blocked.has(k.ownerId))
        .map<RadioDeckSong>((k) => ({
          id: k.songId!,
          title: k.title,
          url: k.url,
          bpm: bpm(k.design),
          seconds: k.seconds ?? 0,
          by: who.get(k.ownerId) ? nameOf(who.get(k.ownerId)!) : '',
          byId: k.ownerId,
          from: 'saved',
        })),
    ];
  }

  /** the maker turns "radio / DJ OK" on or off for one of their songs */
  async setSongPermission(userId: string, songId: string, allow: boolean) {
    const res = await this.db.write
      .update(songs)
      .set({ allowRadio: allow, updatedAt: new Date() })
      .where(and(eq(songs.id, songId), eq(songs.userId, userId), isNull(songs.deletedAt)))
      .returning({ id: songs.id });
    if (!res.length) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
    return { allowRadio: allow };
  }

  /**
   * Every song cue of a show must be one the host could load: their own song or one they kept, with
   * "radio OK" on. (The booth only loads those; this is the server's own check.)
   */
  private async checkCues(userId: string, cues: RadioCue[]): Promise<RadioCue[]> {
    if (!cues.length) return [];
    const allowed = new Map((await this.deck(userId)).filter((s) => s.from !== 'mine' || s.allowRadio).map((s) => [s.id, s]));
    for (const c of cues) {
      const s = allowed.get(c.songId);
      if (!s) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'SONG_NOT_ALLOWED', 'Only songs born here, with radio allowed, can go on air');
    }
    return cues.map((c) => {
      const s = allowed.get(c.songId)!;
      return { at: c.at, songId: s.id, title: s.title, by: s.by, byId: s.byId };
    });
  }

  // --- recorded shows (Bluena's Venus folder → Venus) -------------------------------------------

  private async showView(rows: ShowRow[], viewer: string): Promise<RadioShowView[]> {
    const who = await this.people(rows.map((r) => r.userId));
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      host: who.get(r.userId) ?? { id: r.userId, handle: '', displayName: null, neoForm: null, pic: null },
      thumbUrl: r.thumbUrl,
      loop: r.loop as RadioLoop,
      audioUrl: r.audioUrl,
      seconds: r.seconds,
      cues: r.cuesJson as RadioCue[],
      status: r.status as 'private' | 'public',
      source: r.source as 'recorded' | 'live',
      createdAt: r.createdAt.toISOString(),
      publishedAt: r.publishedAt?.toISOString() ?? null,
      mine: r.userId === viewer,
    }));
  }

  async createShow(userId: string, body: CreateRadioShowBody): Promise<RadioShowView> {
    const [m] = await this.db.write
      .select({ id: mediaObjects.id, url: mediaObjects.url })
      .from(mediaObjects)
      .where(and(eq(mediaObjects.id, body.mediaId), eq(mediaObjects.userId, userId), eq(mediaObjects.kind, 'show'), isNull(mediaObjects.deletedAt)));
    if (!m) throw apiError(HttpStatus.BAD_REQUEST, 'MEDIA_NOT_FOUND', 'Upload the recording first');
    if ((await moderateText(body.title, this.llm)).flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MODERATION', 'This title breaks the community rules');
    const cues = await this.checkCues(userId, body.cues);
    if (body.liveId) {
      const [l] = await this.db.read.select({ id: radioLives.id }).from(radioLives).where(and(eq(radioLives.id, body.liveId), eq(radioLives.userId, userId)));
      if (!l) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
    }
    const [r] = await this.db.write
      .insert(radioShows)
      .values({
        userId,
        mediaId: m.id,
        title: body.title,
        audioUrl: m.url,
        thumbUrl: body.thumbUrl ?? null,
        loop: body.loop,
        seconds: body.seconds,
        cuesJson: cues,
        source: body.liveId ? 'live' : 'recorded',
        liveId: body.liveId ?? null,
      })
      .returning();
    // planets 2-1 (05 Venus): the topic from its title, how it is spoken from its settings (loop, hour, songs on air)
    await this.works?.tag('radio_show', r.id, { userId, planet: 'venus', tags: radioTags({ title: r.title, loop: r.loop, cues: cues.length, at: r.createdAt }), words: r.title });
    return (await this.showView([r], userId))[0];
  }

  /** your shows (Bluena's Venus folder: private and public) */
  async myShows(userId: string): Promise<RadioShowView[]> {
    const rows = await this.db.read
      .select()
      .from(radioShows)
      .where(and(eq(radioShows.userId, userId), isNull(radioShows.deletedAt), isNull(radioShows.removedAt)))
      .orderBy(desc(radioShows.createdAt))
      .limit(100);
    return this.showView(rows, userId);
  }

  /**
   * Someone's booth (M-R208): their public shows back home after 88 hours on the air, newest first.
   * Your own booth is myShows (private ones too).
   */
  async hostShows(viewer: string, hostId: string): Promise<RadioShowView[]> {
    if ((await this.blockedWith(viewer)).has(hostId)) return [];
    const rows = await this.db.read
      .select({ s: radioShows })
      .from(radioShows)
      .innerJoin(users, eq(users.id, radioShows.userId))
      .where(
        and(
          eq(radioShows.userId, hostId),
          eq(radioShows.status, 'public'),
          isNull(radioShows.deletedAt),
          isNull(radioShows.removedAt),
          isNull(users.suspendedAt),
          notChild(viewer),
          lt(radioShows.publishedAt, flyingSince()),
          planetWorkScope(viewer, radioShows.userId, 'radio_show', radioShows.id),
        ),
      )
      .orderBy(desc(radioShows.publishedAt))
      .limit(60);
    return this.showView(rows.map((x) => x.s), viewer);
  }

  /**
   * 〔星へ飛ばす〕 / back to private. M-R326 audit: a show flown AGAIN (it was private) starts its 88 hours again, like every
   * other kind (M-R208); one already public keeps its time.
   */
  async publishShow(userId: string, id: string, on: boolean): Promise<RadioShowView> {
    const [r] = await this.db.write
      .update(radioShows)
      .set(on ? { status: 'public', publishedAt: sql`CASE WHEN ${radioShows.status} = 'public' THEN coalesce(${radioShows.publishedAt}, now()) ELSE now() END`, updatedAt: new Date() } : { status: 'private', updatedAt: new Date() })
      .where(and(eq(radioShows.id, id), eq(radioShows.userId, userId), isNull(radioShows.deletedAt), isNull(radioShows.removedAt)))
      .returning();
    if (!r) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
    return (await this.showView([r], userId))[0];
  }

  async removeShow(userId: string, id: string) {
    const res = await this.db.write
      .update(radioShows)
      .set({ deletedAt: new Date() })
      .where(and(eq(radioShows.id, id), eq(radioShows.userId, userId), isNull(radioShows.deletedAt)))
      .returning({ id: radioShows.id });
    if (!res.length) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
  }

  async show(viewer: string, id: string): Promise<RadioShowView> {
    const blocked = await this.blockedWith(viewer);
    const [r] = await this.db.read
      .select()
      .from(radioShows)
      .where(and(eq(radioShows.id, id), isNull(radioShows.deletedAt), isNull(radioShows.removedAt), or(eq(radioShows.status, 'public'), eq(radioShows.userId, viewer)), viewerSeesAuthor(viewer, radioShows.userId)));
    if (!r || blocked.has(r.userId)) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
    return (await this.showView([r], viewer))[0];
  }

  // --- the Venus home: ON AIR + the shows on the air as waves (88 hours, M-R208) ----------------

  async home(viewer: string): Promise<RadioHome> {
    await this.endStale();
    const blocked = [...(await this.blockedWith(viewer))];
    const notBlocked = (col: typeof radioShows.userId | typeof radioLives.userId) => (blocked.length ? sql`${col} NOT IN (${sql.join(blocked.map((b) => sql`${b}`), sql`, `)})` : sql`true`);
    const lives = await this.db.read
      .select({ l: radioLives })
      .from(radioLives)
      .innerJoin(users, eq(users.id, radioLives.userId))
      .where(and(eq(radioLives.status, 'live'), notBlocked(radioLives.userId), isNull(users.suspendedAt), notChild(viewer), viewerSeesAuthor(viewer, radioLives.userId)))
      .orderBy(desc(radioLives.startedAt))
      .limit(30);
    const shows = await this.db.read
      .select({ s: radioShows })
      .from(radioShows)
      .innerJoin(users, eq(users.id, radioShows.userId))
      // a published show drifts above the clouds for 88 hours, then goes back to its owner's booth
      .where(and(eq(radioShows.status, 'public'), gt(radioShows.publishedAt, flyingSince()), isNull(radioShows.deletedAt), isNull(radioShows.removedAt), notBlocked(radioShows.userId), isNull(users.suspendedAt), notChild(viewer), planetWorkScope(viewer, radioShows.userId, 'radio_show', radioShows.id)))
      .orderBy(desc(radioShows.publishedAt))
      .limit(60);
    return { live: await this.liveView(lives.map((x) => x.l), viewer), shows: await this.showView(shows.map((x) => x.s), viewer) };
  }

  // --- live shows -------------------------------------------------------------------------------

  private async liveView(rows: LiveRow[], viewer: string): Promise<RadioLiveView[]> {
    const who = await this.people(rows.map((r) => r.userId));
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      host: who.get(r.userId) ?? { id: r.userId, handle: '', displayName: null, neoForm: null, pic: null },
      thumbUrl: r.thumbUrl,
      loop: r.loop as RadioLoop,
      status: r.status as RadioLiveView['status'],
      now: (r.nowJson as RadioLiveView['now']) ?? null,
      startedAt: r.startedAt.toISOString(),
      mine: r.userId === viewer,
      transport: r.transport === 'realtime' ? 'realtime' : 'test',
    }));
  }

  /** a live show whose host went quiet for two minutes (closed the app, lost the network) ends */
  private async endStale() {
    await this.db.write
      .update(radioLives)
      .set({ status: 'ended', endedAt: new Date() })
      .where(and(eq(radioLives.status, 'live'), lt(radioLives.beatAt, stale())));
  }

  async startLive(userId: string, body: StartRadioLiveBody): Promise<RadioLiveView> {
    const m = await this.member(userId);
    // ORDER members only at first (client decision 2026-11-21); people under CHILD_AGE do not go live
    if (!m.ok) throw apiError(HttpStatus.FORBIDDEN, 'ORDER_REQUIRED', 'Live shows open for ORDER members');
    if (m.child) throw apiError(HttpStatus.FORBIDDEN, 'TOO_YOUNG', 'Live shows are not open yet at your age');
    if ((await moderateText(body.title, this.llm)).flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MODERATION', 'This title breaks the community rules');
    await this.endStale();
    // one show at a time: an earlier one of yours ends here
    await this.db.write.update(radioLives).set({ status: 'ended', endedAt: new Date() }).where(and(eq(radioLives.userId, userId), eq(radioLives.status, 'live')));
    const [r] = await this.db.write
      .insert(radioLives)
      .values({ userId, title: body.title, thumbUrl: body.thumbUrl ?? null, loop: body.loop, transport: 'test' })
      .returning();
    return (await this.liveView([r], userId))[0];
  }

  private async hostLive(userId: string, id: string): Promise<LiveRow> {
    const [r] = await this.db.write.select().from(radioLives).where(and(eq(radioLives.id, id), eq(radioLives.userId, userId)));
    if (!r) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
    if (r.status === 'stopped') throw apiError(HttpStatus.GONE, 'LIVE_STOPPED', 'This show was stopped');
    return r;
  }

  /** the host's beat: what is playing now (also keeps the show alive) */
  async setNow(userId: string, id: string, body: RadioNowBody): Promise<RadioLiveView> {
    const r = await this.hostLive(userId, id);
    if (r.status !== 'live') throw apiError(HttpStatus.GONE, 'LIVE_ENDED', 'This show has ended');
    let now: RadioLiveView['now'] = null;
    if (body.now) {
      const [c] = await this.checkCues(userId, [{ ...body.now, at: 0 }]);
      now = { songId: c.songId, title: c.title, by: c.by, byId: c.byId ?? null };
    }
    const [u] = await this.db.write.update(radioLives).set({ nowJson: now, beatAt: new Date() }).where(eq(radioLives.id, id)).returning();
    return (await this.liveView([u], userId))[0];
  }

  async endLive(userId: string, id: string): Promise<RadioLiveView> {
    const r = await this.hostLive(userId, id);
    const [u] = await this.db.write
      .update(radioLives)
      .set(r.status === 'live' ? { status: 'ended', endedAt: new Date(), nowJson: null } : {})
      .where(eq(radioLives.id, id))
      .returning();
    return (await this.liveView([u ?? r], userId))[0];
  }

  async live(viewer: string, id: string): Promise<RadioLiveState> {
    await this.endStale();
    // M-R213: under 15, only a dachi's live can be opened
    const [r] = await this.db.read.select().from(radioLives).where(and(eq(radioLives.id, id), viewerSeesAuthor(viewer, radioLives.userId)));
    const blocked = await this.blockedWith(viewer);
    if (!r || blocked.has(r.userId)) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
    const host = r.userId === viewer;
    const rows = await this.db.read
      .select()
      .from(radioMessages)
      .where(and(eq(radioMessages.liveId, id), isNull(radioMessages.hiddenAt)))
      .orderBy(desc(radioMessages.createdAt))
      .limit(60);
    // blocked people's comments are never shown, whichever side blocked
    const visible = rows.filter((m) => !blocked.has(m.userId)).reverse();
    const who = await this.people(visible.map((m) => m.userId));
    const posts = visible.filter((m) => m.postId).map((m) => m.postId!);
    const ps = posts.length ? await this.db.read.select({ id: planetPosts.id, title: planetPosts.title, owner: planetPosts.userId }).from(planetPosts).where(inArray(planetPosts.id, posts)) : [];
    const owners = await this.people(ps.map((p) => p.owner));
    const postBy = new Map(ps.map((p) => [p.id, p]));
    const messages: RadioMessageView[] = visible.map((m) => {
      const p = m.postId ? postBy.get(m.postId) : undefined;
      const o = p ? owners.get(p.owner) : undefined;
      return {
        id: m.id,
        kind: m.kind as RadioMessageView['kind'],
        text: m.text,
        song: p ? { postId: p.id, title: p.title, by: o ? nameOf(o) : '' } : null,
        from: who.get(m.userId) ?? { id: m.userId, handle: '', displayName: null, neoForm: null, pic: null },
        createdAt: m.createdAt.toISOString(),
        mine: m.userId === viewer,
      };
    });
    // requests go to the host only; listeners see the comments
    return { ...(await this.liveView([r], viewer))[0], messages: host ? messages : messages.filter((m) => m.kind === 'comment' || m.mine) };
  }

  async message(userId: string, id: string, body: RadioMessageBody): Promise<RadioMessageView> {
    const [r] = await this.db.read.select().from(radioLives).where(eq(radioLives.id, id));
    if (!r || r.status !== 'live' || r.beatAt < stale()) throw apiError(HttpStatus.GONE, 'LIVE_ENDED', 'This show has ended');
    if ((await this.blockedWith(userId)).has(r.userId)) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
    const m = await this.member(userId);
    if (!m.ok && !this.cfg.COMMS_MEMBERS_ONLY) throw apiError(HttpStatus.FORBIDDEN, 'NOT_MEMBER', 'Not open');
    const text = body.text ?? '';
    if (text && (await moderateText(text, this.llm)).flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MODERATION', 'This message breaks the community rules');
    let postId: string | null = null;
    if (body.kind === 'request') {
      const [p] = await this.db.read
        .select({ id: planetPosts.id })
        .from(planetPosts)
        .innerJoin(songs, eq(songs.id, planetPosts.sourceId))
        .where(and(eq(planetPosts.id, body.postId), eq(planetPosts.planet, 'mercury'), isNull(planetPosts.deletedAt), eq(songs.allowRadio, true)));
      if (!p) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'SONG_NOT_ALLOWED', 'That song cannot be requested');
      postId = p.id;
    }
    const [row] = await this.db.write.insert(radioMessages).values({ liveId: id, userId, kind: body.kind, text, postId }).returning();
    const [me] = await this.db.read.select(personCols).from(users).where(eq(users.id, userId));
    return { id: row.id, kind: body.kind, text, song: null, from: me as CommsPerson, createdAt: row.createdAt.toISOString(), mine: true };
  }

  /** the host hides a comment (it goes away for everyone) */
  async hideMessage(userId: string, liveId: string, messageId: string) {
    await this.hostLive(userId, liveId);
    const res = await this.db.write
      .update(radioMessages)
      .set({ hiddenAt: new Date() })
      .where(and(eq(radioMessages.id, messageId), eq(radioMessages.liveId, liveId)))
      .returning({ id: radioMessages.id });
    if (!res.length) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
  }

  async report(userId: string, body: RadioReportBody) {
    let target: string | undefined;
    if (body.target === 'show') [target] = (await this.db.read.select({ u: radioShows.userId }).from(radioShows).where(eq(radioShows.id, body.id))).map((r) => r.u);
    else if (body.target === 'live') [target] = (await this.db.read.select({ u: radioLives.userId }).from(radioLives).where(eq(radioLives.id, body.id))).map((r) => r.u);
    else [target] = (await this.db.read.select({ u: radioMessages.userId }).from(radioMessages).where(eq(radioMessages.id, body.id))).map((r) => r.u);
    if (!target || target === userId) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
    await this.db.write.insert(userReports).values({
      reporterId: userId,
      targetUserId: target,
      kind: `radio-${body.target}`,
      targetId: body.id,
      reason: body.reason,
      note: body.note ?? '',
    });
  }

  // --- the team ---------------------------------------------------------------------------------

  async adminLives() {
    await this.endStale();
    const rows = await this.db.read.select().from(radioLives).where(ne(radioLives.status, 'ended')).orderBy(desc(radioLives.startedAt)).limit(100);
    return this.liveView(rows, '');
  }

  /** the team stops a live show at once (a report review) */
  async adminStop(id: string, reason: string) {
    const res = await this.db.write
      .update(radioLives)
      .set({ status: 'stopped', endedAt: new Date(), nowJson: null, stoppedReason: reason })
      .where(eq(radioLives.id, id))
      .returning({ id: radioLives.id });
    if (!res.length) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
  }

  /** the team takes a recording down (it disappears from Venus and from the host's Bluena) */
  async adminRemoveShow(id: string, on: boolean) {
    const res = await this.db.write
      .update(radioShows)
      .set({ removedAt: on ? new Date() : null })
      .where(eq(radioShows.id, id))
      .returning({ id: radioShows.id });
    if (!res.length) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
  }

  async adminHideMessage(id: string) {
    await this.db.write.update(radioMessages).set({ hiddenAt: new Date() }).where(eq(radioMessages.id, id));
  }

  // --- Bluena: keep someone else's song ---------------------------------------------------------

  /** your kept works (links): a removed / blocked one stays listed as not available */
  async kept(userId: string): Promise<BluenaKeptView[]> {
    const rows = await this.db.read
      .select({ keptAt: bluenaSaves.createdAt, p: planetPosts, suspended: users.suspendedAt })
      .from(bluenaSaves)
      .innerJoin(planetPosts, eq(planetPosts.id, bluenaSaves.postId))
      .innerJoin(users, eq(users.id, planetPosts.userId))
      .where(and(eq(bluenaSaves.userId, userId), eq(bluenaSaves.kind, 'planet_post')))
      .orderBy(desc(bluenaSaves.createdAt))
      .limit(300);
    const blocked = await this.blockedWith(userId);
    const who = await this.people(rows.map((r) => r.p.userId));
    return rows.map(({ keptAt, p, suspended }) => {
      const available = !p.deletedAt && !suspended && !blocked.has(p.userId);
      const o = who.get(p.userId);
      return {
        postId: p.id,
        planet: p.planet as BluenaKeptView['planet'],
        kind: p.kind as BluenaKeptView['kind'],
        title: p.title,
        url: available ? p.url : null,
        posterUrl: available ? p.posterUrl : null,
        by: o ? nameOf(o) : '',
        byId: p.userId,
        available,
        keptAt: keptAt.toISOString(),
      };
    });
  }

  async keep(userId: string, postId: string, on: boolean) {
    if (on) {
      const [p] = await this.db.read
        .select({ id: planetPosts.id, owner: planetPosts.userId })
        .from(planetPosts)
        .where(and(eq(planetPosts.id, postId), isNull(planetPosts.deletedAt), gt(sql`length(${planetPosts.url})`, 0)));
      if (!p || (await this.blockedWith(userId)).has(p.owner)) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
      await this.db.write.insert(bluenaSaves).values({ userId, postId }).onConflictDoNothing();
    } else {
      await this.db.write.delete(bluenaSaves).where(and(eq(bluenaSaves.userId, userId), eq(bluenaSaves.kind, 'planet_post'), eq(bluenaSaves.postId, postId)));
    }
    return { kept: on };
  }
}
