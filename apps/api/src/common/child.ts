import { CHILD_AGE } from '@obolo/shared';
import { sql, type SQL } from 'drizzle-orm';
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
