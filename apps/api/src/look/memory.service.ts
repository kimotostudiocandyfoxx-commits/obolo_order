import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { moderateText, type LlmProvider } from '@obolo/ai';
import { MEMORY_LINES, MEMORY_PER_BATI, memoryRefusal, tidyMemory, type BatiForgetBody, type BatiRoleBody, type Me } from '@obolo/shared';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { users } from '../db/schema';
import { LLM } from '../infra/tokens';
import { toMe } from '../users/users.service';
import { batiList } from './batis';

type User = typeof users.$inferSelect;
const same = (a: string, b: string) => a.replace(/[\s、。！!？?]/g, '') === b.replace(/[\s、。！!？?]/g, '');
export type RememberResult = 'kept' | 'refused' | 'full' | 'already';

/**
 * バティが覚えること (M-R222): only the member's own 「覚えといて」 (the chat finds it, or the card) keeps something —
 * five a {bati}; {bati} never asks. The 呼び方 (the society name by default) changes from the card or by 「〇〇って呼んで」.
 * Never kept: an address, a phone, an email, a school or company, a password, money, other people's details, health
 * details (stricter under 15 / no birth year yet), nor what the general moderation flags.
 */
@Injectable()
export class BatiMemoryService {
  constructor(
    private readonly db: Database,
    @Inject(LLM) private readonly llm: LlmProvider,
  ) {}

  private async user(userId: string) {
    const [u] = await this.db.write.select().from(users).where(eq(users.id, userId));
    if (!u) throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'User not found');
    return u;
  }

  private async refused(u: User, text: string) {
    const birthYear = Number((u.onboardingJson as Record<string, string> | null)?.birthYear) || null;
    return !!memoryRefusal(text, { birthYear }) || (await moderateText(text, this.llm)).flagged;
  }

  /** what the member asked {bati} to remember — kept now, or why not (`user` = the row after it) */
  async remember(userId: string, raw: string, batiId?: string): Promise<{ result: RememberResult; text: string; user?: User }> {
    const u = await this.user(userId);
    const text = tidyMemory(raw);
    const list = batiList(u);
    const id = batiId ?? u.batiId ?? list[0]?.id;
    const r = list.find((x) => x.id === id);
    if (!r) throw apiError(HttpStatus.CONFLICT, 'NO_BATI', 'Not hatched yet');
    if (await this.refused(u, text)) return { result: 'refused', text };
    const on = r.memories ?? [];
    if (on.some((p) => same(p.text, text))) return { result: 'already', text };
    if (on.length >= MEMORY_PER_BATI) return { result: 'full', text };
    const memories = [...on, { id: randomUUID(), text, at: new Date().toISOString() }];
    const [nu] = await this.db.write
      .update(users)
      .set({ batisJson: list.map((x) => (x.id === r.id ? { ...x, memories } : x)), updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return { result: 'kept', text, user: nu };
  }

  /** the card's 〔覚えさせる〕 (the same rules as the chat's 「覚えといて」) */
  async add(userId: string, text: string, batiId?: string): Promise<Me> {
    const r = await this.remember(userId, text, batiId);
    if (r.result === 'refused') throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MEMORY_REFUSED', MEMORY_LINES.refuse);
    if (r.result === 'full') throw apiError(HttpStatus.CONFLICT, 'MEMORY_FULL', MEMORY_LINES.full);
    if (r.result === 'already') throw apiError(HttpStatus.CONFLICT, 'MEMORY_ALREADY', 'それ、もう、覚えてるよ！');
    return toMe(r.user!);
  }

  /** 「〇〇って呼んで」 / the card: the 呼び方 of the {bati} in the chat (null = the society name again); false = refused */
  async callAs(userId: string, call: string | null): Promise<User | false> {
    const u = await this.user(userId);
    const name = call ? tidyMemory(call).slice(0, 12) : null;
    if (name && (await this.refused(u, name))) return false;
    const list = batiList(u);
    const id = u.batiId ?? list[0]?.id;
    const [nu] = await this.db.write
      .update(users)
      .set({ batisJson: list.map((x) => (x.id === id ? { ...x, callCustom: name } : x)), updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return nu;
  }

  /** forget one memory, or all of a {bati}'s */
  async forget(userId: string, body: BatiForgetBody): Promise<Me> {
    const u = await this.user(userId);
    const list = batiList(u);
    const id = body.id ?? u.batiId ?? list[0]?.id;
    const [nu] = await this.db.write
      .update(users)
      .set({ batisJson: list.map((x) => (x.id === id ? { ...x, memories: body.memory ? (x.memories ?? []).filter((p) => p.id !== body.memory) : [] } : x)), updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return toMe(nu);
  }

  async role(userId: string, body: BatiRoleBody): Promise<Me> {
    const u = await this.user(userId);
    const list = batiList(u);
    const id = body.id ?? u.batiId ?? list[0]?.id;
    if (!list.some((x) => x.id === id)) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'No such bati');
    const [nu] = await this.db.write
      .update(users)
      .set({ batisJson: list.map((x) => (x.id === id ? { ...x, role: body.role } : x)), updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return toMe(nu);
  }
}
