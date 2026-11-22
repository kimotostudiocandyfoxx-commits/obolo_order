import { CHILD_AGE, seesOnlyDachi, type PlanetWorkKind } from '@obolo/shared';
import { sql, type AnyColumn, type SQL } from 'drizzle-orm';
import { users } from '../db/schema';

/**
 * M-R150: under CHILD_AGE, people meet only their dachi — they never come up in 〔名前で探す〕 and their posts never
 * show on a みんな sky or in a ひろば. The year lives in onboarding_json.birthYear (set once). The viewer always sees
 * their own posts.
 */
export const notChild = (viewerId?: string): SQL =>
  viewerId
    ? sql`(${users.id} = ${viewerId} OR COALESCE(NULLIF(${users.onboardingJson}->>'birthYear', '')::int, 0) <= EXTRACT(YEAR FROM now())::int - ${CHILD_AGE})`
    : sql`COALESCE(NULLIF(${users.onboardingJson}->>'birthYear', '')::int, 0) <= EXTRACT(YEAR FROM now())::int - ${CHILD_AGE}`;

/**
 * M-R213: a viewer under CHILD_AGE — or with no birth year yet (asked on day 1) — sees only their dachi's works (and
 * their own) on the planets; everyone else also sees strangers'. Mirrors `viewerSeesAuthor` for tests and the demo.
 */
export const youngViewer = seesOnlyDachi;

/** the viewer's dachi (mutual follows), as a subquery */
export const dachiOf = (viewerId: string): SQL =>
  sql`SELECT f.followee_id FROM follows f JOIN follows g ON g.follower_id = f.followee_id AND g.followee_id = f.follower_id WHERE f.follower_id = ${viewerId}`;

/** true in SQL when the viewer is under CHILD_AGE or has no birth year */
export const viewerIsYoung = (viewerId: string): SQL =>
  sql`EXISTS (SELECT 1 FROM users v WHERE v.id = ${viewerId} AND COALESCE(NULLIF(v.onboarding_json->>'birthYear', '')::int, 9999) > EXTRACT(YEAR FROM now())::int - ${CHILD_AGE})`;

/** M-R213: may this viewer see works by the author in `authorCol` (own, a dachi's, or any when not young) */
export const viewerSeesAuthor = (viewerId: string, authorCol: AnyColumn | SQL): SQL =>
  sql`(${authorCol} = ${viewerId} OR ${authorCol} IN (${dachiOf(viewerId)}) OR NOT ${viewerIsYoung(viewerId)})`;

export type WorkKind = PlanetWorkKind;

/** M-R213: leaves out the works this viewer chose 〔見えなくする〕 on */
export const notHidden = (viewerId: string, kind: WorkKind, idCol: AnyColumn | SQL): SQL =>
  sql`NOT EXISTS (SELECT 1 FROM work_hides h WHERE h.user_id = ${viewerId} AND h.kind = ${kind} AND h.target_id = ${idCol})`;

/** what every planet's wide place applies to a work: no strangers for the young, no hidden works */
export const planetWorkScope = (viewerId: string, authorCol: AnyColumn, kind: WorkKind, idCol: AnyColumn): SQL =>
  sql`(${viewerSeesAuthor(viewerId, authorCol)} AND ${notHidden(viewerId, kind, idCol)})`;
