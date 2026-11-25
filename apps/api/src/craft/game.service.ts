import { HttpException, HttpStatus, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { type ChatTurn, type LlmProvider, moderateText } from '@obolo/ai';
import { demoGame, gameFromTemplate, gameTemplateSystem, gameTemplateUser, gameTierOf, KIND_HOME_PLANET, GAME_REFUNDS_PER_DAY, gameSystem, gameUser, jstDay, MAKE_COST, validateGameCode, type GameBrokenBody, type GameMakeKind, type GameTemplateId, type GameView, type MakeConfirm, type SpellTag } from '@obolo/shared';
import { Script } from 'node:vm';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { apiError } from '../common/errors';
import { Database } from '../db/db';
import { games, type GameVersionRow } from '../db/schema';
import type { KvStore } from '../infra/kv';
import { GAME_CHEAP_LLM, GAME_LLM, GAME_TRIAL_LLM, KV, LLM } from '../infra/tokens';
import { LedgerService } from '../wallet/ledger.service';
import { gameView, notFound, sentTo, type GameRow } from './craft.store';

/** what a game job carries (the yes too: its mana goes back when the build fails for good) */
export type GameJobInput = { gameId?: string; tags: SpellTag[]; said?: string; confirm: MakeConfirm; kind: GameMakeKind; from: 'atelier'; /** R17: the trial's template */ template?: GameTemplateId };
/** versions kept per game (the oldest go) */
const MAX_VERSIONS = 8;
/** a version reported as not running gives its mana back only this soon after it was built */
const BROKEN_WITHIN_MS = 30 * 60_000;

const json = (raw: string) => JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as Record<string, unknown>;
const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);

/** the generated logic, checked: the rules (validateGameCode), then that it parses (compiled only, never run here) */
export function checkGameCode(raw: unknown): { ok: true; code: string } | { ok: false; reason: string } {
  const v = validateGameCode(raw);
  if (!v.ok) return v;
  try {
    new Script(`(${v.code})`, { filename: 'game.js' });
  } catch (e) {
    return { ok: false, reason: `syntax error: ${String(e instanceof Error ? e.message : e).slice(0, 160)}` };
  }
  return v;
}

/** the Japanese words inside the code (its on-screen texts), for the text check */
export const wordsInCode = (code: string) => [...code.matchAll(/(['"`])((?:(?!\1).){0,80}[\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Han}](?:(?!\1).){0,80})\1/gu)].map((m) => m[2]).join('、').slice(0, 1500);

/**
 * Client 2026-11-25 (ゲーム): a small canvas game written by its tier's chain (R17: the trial from a template on GAME_MODEL_TRIAL, the cheap
 * chain GAME_MODEL_CHEAP, the full one GAME_MODEL_FULL) inside the
 * fixed harness. The model answers JSON {title, howTo, code}; the code is checked (validateGameCode + a parse) and, when
 * refused, sent back once with the reason (one repair round) before the build fails (the job then gives the mana back).
 * The sandbox in the app is the real guard. Without a key the canned demo game stands in.
 */
@Injectable()
export class GameService {
  private readonly log = new Logger('Game');
  constructor(
    @Inject(GAME_LLM) private readonly llm: LlmProvider,
    @Inject(LLM) private readonly modLlm: LlmProvider,
    private readonly db: Database,
    private readonly ledger: LedgerService,
    @Inject(KV) private readonly kv: KvStore,
    /** R17: the cheap chain (a member's own game, every tweak first) and the trial's (the template values) */
    @Optional() @Inject(GAME_CHEAP_LLM) private readonly cheapLlm?: LlmProvider,
    @Optional() @Inject(GAME_TRIAL_LLM) private readonly trialLlm?: LlmProvider,
  ) {}

  /** the chain a game making is written by (its tier) */
  chainFor(kind: GameMakeKind): LlmProvider {
    const tier = gameTierOf(kind);
    return tier === 'trial' ? (this.trialLlm ?? this.cheapLlm ?? this.llm) : tier === 'cheap' ? (this.cheapLlm ?? this.llm) : this.llm;
  }

  /** the member has made no game yet (the trial is for the first one) */
  async firstGame(userId: string): Promise<boolean> {
    const [row] = await this.db.write.select({ id: games.id }).from(games).where(eq(games.userId, userId)).limit(1);
    return !row;
  }

  private async clean(text: string) {
    if (text.trim() && (await moderateText(text, this.modLlm)).flagged) throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'MODERATION', 'その言葉は使えません');
  }

  async own(userId: string, id: string): Promise<GameRow> {
    const [row] = await this.db.write
      .select()
      .from(games)
      .where(and(eq(games.id, id), eq(games.userId, userId), isNull(games.deletedAt)));
    if (!row) throw notFound('Game');
    return row;
  }

  async list(userId: string): Promise<GameView[]> {
    const rows = await this.db.read
      .select()
      .from(games)
      .where(and(eq(games.userId, userId), isNull(games.deletedAt)))
      .orderBy(desc(games.createdAt))
      .limit(100);
    return rows.map(gameView);
  }

  /** the game for its maker, or for a ダチ it was sent to */
  async play(viewerId: string, id: string): Promise<GameView> {
    const [row] = await this.db.read
      .select()
      .from(games)
      .where(and(eq(games.id, id), isNull(games.deletedAt)));
    if (!row || (row.userId !== viewerId && !(await sentTo(this.db, row.userId, viewerId, id)))) throw notFound('Game');
    return gameView(row);
  }

  /** before the charge: the words are checked and a tweak's game is the member's own */
  async precheck(userId: string, b: { gameId?: string; tags: SpellTag[]; said?: string }) {
    if (b.gameId) await this.own(userId, b.gameId);
    await this.clean([...b.tags.map((t) => t.ja), b.said ?? ''].join('、'));
  }

  /** the job's work: write (and repair once), check, keep as a new game or a new version of it */
  async make(userId: string, input: GameJobInput): Promise<GameView> {
    const row = input.gameId ? await this.own(userId, input.gameId) : null;
    const prev = row ? row.versionsJson[row.active] : null;
    const made =
      input.kind === 'gameTrial' && input.template && !row
        ? await this.fromTemplate(input.template, input.tags, input.said)
        : await this.write(input.tags, prev ? { code: prev.code, tags: prev.tags } : null, input.said, this.chainFor(input.kind));
    await this.clean(`${made.title}\n${made.howTo}\n${wordsInCode(made.code)}`);
    const v: GameVersionRow = { ...made, tags: input.tags, at: new Date().toISOString(), confirmId: input.confirm.id, kind: input.kind, price: input.confirm.price };
    if (!row) {
      const [r] = await this.db.write.insert(games).values({ userId, title: made.title, versionsJson: [v], active: 0, homePlanet: KIND_HOME_PLANET.game }).returning();
      return gameView(r);
    }
    const versions = [...row.versionsJson, v].slice(-MAX_VERSIONS);
    const [r] = await this.db.write
      .update(games)
      .set({ versionsJson: versions, active: versions.length - 1, title: made.title || row.title, updatedAt: new Date() })
      .where(eq(games.id, row.id))
      .returning();
    return gameView(r);
  }

  /**
   * R17: the first game — the template's code, its values (title, how to play, speed, amount, goal, time, lives; a
   * quiz's questions) from the trial chain as a small JSON; the template's own values when the model gives none
   */
  protected async fromTemplate(id: GameTemplateId, tags: SpellTag[], said?: string): Promise<{ title: string; howTo: string; code: string }> {
    const llm = this.chainFor('gameTrial');
    let raw: Record<string, unknown> | null = null;
    if (llm.name !== 'mock') {
      try {
        raw = json(await llm.chat({ system: gameTemplateSystem(id), history: [{ role: 'user', text: gameTemplateUser({ tags, said }) }], json: true, temperature: 0.6, maxOutputTokens: 1500 }));
      } catch (e) {
        this.log.warn(`game template values failed (${id}), its defaults: ${String(e)}`);
      }
    }
    return gameFromTemplate(id, raw, (code) => checkGameCode(code).ok);
  }

  protected async write(tags: SpellTag[], prev: { code: string; tags: SpellTag[] } | null, said?: string, llm: LlmProvider = this.llm): Promise<{ title: string; howTo: string; code: string }> {
    if (llm.name === 'mock') return demoGame(tags);
    const history: ChatTurn[] = [{ role: 'user', text: gameUser({ tags, prev, said }) }];
    let reason = '';
    for (let round = 0; round < 2; round++) {
      const raw = await llm.chat({ system: gameSystem(), history, json: true, temperature: 0.6, maxOutputTokens: 24_000 });
      let j: Record<string, unknown> = {};
      try {
        j = json(raw);
      } catch {
        reason = 'the answer was not JSON';
      }
      const c = j.code !== undefined ? checkGameCode(j.code) : { ok: false as const, reason: reason || 'no "code" in the JSON' };
      if (c.ok) return { title: clip(j.title, 12) || 'ゲーム', howTo: clip(j.howTo, 40), code: c.code };
      reason = c.reason;
      this.log.warn(`game code refused (round ${round + 1}): ${reason}`);
      // the one repair round: the same model gets its answer back with the reason
      history.push({ role: 'assistant', text: raw.slice(0, 20_000) }, { role: 'user', text: `The code was rejected: ${reason}. Fix it and answer the same JSON again ({"title","howTo","code"}), keeping to the rules.` });
    }
    throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION', `game code refused: ${reason}`);
  }

  /** a build that failed for good: its yes's mana goes back (once) */
  async refundJob(userId: string, input: GameJobInput): Promise<number> {
    return this.ledger.refundYes(this.db, userId, input.kind, input.confirm, input.gameId).catch((e) => {
      this.log.error(`refund failed for ${userId}: ${String(e)}`);
      return 0;
    });
  }

  /**
   * the version did not run in the sandbox (it threw at once, or never started): its mana goes back — the maker's own,
   * soon after it was built, once, a few times a day — and the version is marked
   */
  async broken(userId: string, id: string, b: GameBrokenBody): Promise<{ refunded: number }> {
    const row = await this.own(userId, id);
    const v = row.versionsJson[b.version];
    if (!v || v.broken) return { refunded: 0 };
    if (Date.now() - Date.parse(v.at) > BROKEN_WITHIN_MS) return { refunded: 0 };
    const n = await this.kv.incr(`game-broken:${userId}:${jstDay(new Date().toISOString())}`, 30 * 3600);
    if (n > GAME_REFUNDS_PER_DAY) return { refunded: 0 };
    this.log.warn(`game ${id} v${b.version} does not run: ${b.reason}`);
    const refunded = await this.ledger.refundYes(this.db, userId, v.kind, { id: v.confirmId, price: v.price ?? MAKE_COST[v.kind] }, id);
    const versions = row.versionsJson.map((x, i) => (i === b.version ? { ...x, broken: true } : x));
    // a broken tweak on the face: the face goes back to the last version that ran
    let active = row.active;
    if (active === b.version) for (let i = b.version - 1; i >= 0; i--) if (!versions[i].broken) { active = i; break; }
    await this.db.write.update(games).set({ versionsJson: versions, active, updatedAt: new Date() }).where(eq(games.id, id));
    return { refunded };
  }
}

export const isHttp = (e: unknown): e is HttpException => e instanceof HttpException;
