import {
  addVersion,
  dropVersion,
  estimateEtaMs,
  ETA_BASE_MS,
  hiddenRefs,
  homecomingSay,
  fillLine,
  JOB_MAX_ATTEMPTS,
  lateEta,
  leftWords,
  MAX_VERSIONS,
  reactionsFor,
  setFace,
  shouldRetry,
  targetWords,
  withTarget,
  type WorkVersion,
} from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { JobsService } from '../jobs/jobs.service';
import { MoonWorksService, type HomeItem } from './moon-works.service';

const v = (id: string, extra: Partial<WorkVersion> = {}): WorkVersion => ({ ref: { kind: 'jupiter_root', id }, prompt: id, at: '2026-11-22T00:00:00Z', ...extra });

describe('M-R253 §1: a redo stays inside the same work', () => {
  it('a new try goes on top and is the face; the oldest goes past the cap', () => {
    let vs: WorkVersion[] = [v('a')];
    const r = addVersion(vs, v('b'));
    expect(r.versions.map((x) => x.prompt)).toEqual(['a', 'b']);
    expect(r.active).toBe(1);
    for (let i = 0; i < MAX_VERSIONS + 2; i++) vs = addVersion(vs, v(`x${i}`)).versions;
    expect(vs).toHaveLength(MAX_VERSIONS);
    expect(vs[0].prompt).toBe('x2');
  });
  it('the face is the one looked at last (kept in range)', () => {
    const vs = [v('a'), v('b'), v('c')];
    expect(setFace(vs, 0)).toBe(0);
    expect(setFace(vs, 9)).toBe(2);
    expect(setFace(vs, -1)).toBe(0);
  });
  it('a try can be thrown away inside the work, never the last one', () => {
    const vs = [v('a'), v('b'), v('c')];
    expect(dropVersion(vs, 2, 2)).toMatchObject({ active: 1, dropped: { prompt: 'c' } });
    expect(dropVersion(vs, 2, 0)).toMatchObject({ active: 1 });
    expect(dropVersion(vs, 0, 1)?.active).toBe(0);
    expect(dropVersion([v('a')], 0, 0)).toBeNull();
  });
  it('Bluena lists the face only: the other tries are hidden', () => {
    const h = hiddenRefs([{ versions: [v('a'), v('b'), v('c')], active: 1 }]);
    expect([...h].sort()).toEqual(['jupiter_root:a', 'jupiter_root:c']);
  });
  it('the service stacks a redo on the same row', async () => {
    const rows = new Map<string, { id: string; userId: string; kind: string; versionsJson: WorkVersion[]; active: number; originJson: null; materialsJson: []; createdAt: Date; updatedAt: Date; deletedAt: null }>();
    rows.set('w1', { id: 'w1', userId: 'u', kind: 'art', versionsJson: [v('a')], active: 0, originJson: null, materialsJson: [], createdAt: new Date(), updatedAt: new Date(), deletedAt: null });
    const s = new MoonWorksService({} as never);
    Object.assign(s, {
      own: async (_u: string, id: string) => rows.get(id),
      save: async (id: string, set: object) => {
        rows.set(id, { ...rows.get(id)!, ...set });
        return rows.get(id);
      },
    });
    const out = await s.addVersion('u', 'w1', { version: v('b') });
    expect(out.versions).toHaveLength(2);
    expect(out.active).toBe(1);
    expect((await s.setFace('u', 'w1', 0)).active).toBe(0);
    await expect(s.dropVersion('u', 'w1', 5)).rejects.toThrow();
  });
});

describe('M-R253 §2: point, then ask', () => {
  it('the part in words', () => {
    expect(targetWords({ kind: 'point', x: 0.1, y: 0.1 })).toBe('左上のあたり');
    expect(targetWords({ kind: 'point', x: 0.5, y: 0.5 })).toBe('まん中のあたり');
    expect(targetWords({ kind: 'point', x: 0.5, y: 0.9 })).toBe('まん中の下のあたり');
    expect(targetWords({ kind: 'range', from: 65, to: 40 })).toBe('0:40〜1:05のところ');
    expect(targetWords({ kind: 'frame', index: 2, of: 6 })).toBe('3つ目の場面');
    expect(withTarget('もっと青く', { kind: 'point', x: 0.9, y: 0.1 })).toBe('右上のあたりを、もっと青く');
    expect(withTarget('もっと青く')).toBe('もっと青く');
  });
});

describe('M-R253 §4: how long it takes', () => {
  it('the table, pulled toward recent real times, longer with a queue', () => {
    expect(estimateEtaMs('song')).toBe(ETA_BASE_MS.song);
    // two recent times are not enough to trust
    expect(estimateEtaMs('song', [60_000, 60_000])).toBe(ETA_BASE_MS.song);
    expect(estimateEtaMs('song', [120_000, 120_000, 120_000])).toBe(170_000);
    expect(estimateEtaMs('art', [], 2)).toBe(40_000);
    expect(estimateEtaMs('voice')).toBeLessThanOrEqual(30_000);
  });
  it('the card says what is left; late means more time, said first', () => {
    expect(leftWords(180_000)).toBe('あと3分');
    expect(leftWords(20_000)).toBe('あと20秒');
    expect(leftWords(4_000)).toBe('もうすぐ');
    expect(lateEta(100_000, 50_000)).toEqual({ etaAt: 100_000, late: false });
    expect(lateEta(100_000, 99_000).late).toBe(false);
    expect(lateEta(100_000, 100_000)).toEqual({ etaAt: 160_000, late: true });
  });
  it('a failure is tried again a few times, not words the mend cannot help', () => {
    expect(shouldRetry('MUSIC_FAILED', 1)).toBe(true);
    expect(shouldRetry('MUSIC_FAILED', JOB_MAX_ATTEMPTS)).toBe(false);
    expect(shouldRetry('MODERATION', 1)).toBe(false);
  });

  type JobRow = Record<string, unknown> & { id: string; status: string; attempts: number };
  const jobsHarness = (row: JobRow, work: (r: JobRow) => Promise<Record<string, unknown>>) => {
    const db = { row: { ...row } as JobRow, pushes: [] as string[], queued: 0 };
    const queue = { register: () => undefined, enqueue: async () => void db.queued++ };
    const push = { notify: async (_u: string, p: { title: string; body: string }) => void db.pushes.push(`${p.title}|${p.body}`) };
    const s = new JobsService({} as never, queue as never, {} as never, {} as never, push as never, {} as never, {} as never);
    Object.assign(s, {
      load: async () => ({ ...db.row }),
      patch: async (_id: string, set: object) => void Object.assign(db.row, set),
      recentMs: async () => [],
      waiting: async () => 0,
      batiOf: async () => ({ name: 'タコポン', speech: { personality: 'kansai' } }),
      work: (r: JobRow) => work(r),
    });
    return { s, db };
  };
  const base = { id: 'j1', userId: 'u', kind: 'demo', status: 'queued', attempts: 0, inputJson: { seconds: 20, failTimes: 1 }, startedAt: null, etaAt: new Date(), late: 0, lastErrorCode: null, createdAt: new Date() };

  it('queued → running → (failed try) queued again with a new time → done, one push', async () => {
    const { s, db } = jobsHarness(base, async (r) => {
      if (r.attempts <= 1) throw new Error('blip');
      return { demo: { seconds: 20 } };
    });
    await s.run('j1');
    expect(db.row).toMatchObject({ status: 'queued', stage: 'retrying', attempts: 1, lastErrorCode: 'ERROR' });
    expect(db.queued).toBe(1);
    expect(db.pushes).toEqual([]);
    await s.run('j1');
    expect(db.row).toMatchObject({ status: 'done', attempts: 2 });
    // M-R253 §6 ⑤: the push in {bati}'s words and manner
    expect(db.pushes).toEqual(['タコポン|タコポン：作品、できたよ！　見に来てな。']);
  });

  it('after two failures in a row the re-try stops, and {bati} asks to try again a little later', async () => {
    const { s, db } = jobsHarness(base, async () => {
      throw new Error('down');
    });
    for (let i = 0; i < JOB_MAX_ATTEMPTS; i++) await s.run('j1');
    expect(db.row).toMatchObject({ status: 'failed', attempts: JOB_MAX_ATTEMPTS });
    expect(db.queued).toBe(JOB_MAX_ATTEMPTS - 1);
    expect(JOB_MAX_ATTEMPTS).toBe(2);
    expect(db.pushes[0]).toContain('少ししてから、もう一回、頼んでくれる？');
  });

  it('R16: a Moon atelier song that fails for good gives its yes back (once), a song without a yes gives nothing', async () => {
    const refunds: string[] = [];
    const ledger = { refundYes: async (_db: unknown, u: string, kind: string, c: { id: string }) => (refunds.push(`${u}:${kind}:${c.id}`), 2) };
    const song = { ...base, kind: 'song', inputJson: { body: { title: 'よるのステップ' }, origin: 'x', confirm: { id: 'yes-1', price: 2 } } };
    const { s } = jobsHarness(song, async () => {
      throw new Error('studio down');
    });
    Object.assign(s, { ledger });
    for (let i = 0; i < JOB_MAX_ATTEMPTS; i++) await s.run('j1');
    expect(refunds).toEqual(['u:song:yes-1']);
    const plain = jobsHarness({ ...song, inputJson: { body: { title: 'x' }, origin: 'x' } }, async () => {
      throw new Error('studio down');
    });
    Object.assign(plain.s, { ledger });
    for (let i = 0; i < JOB_MAX_ATTEMPTS; i++) await plain.s.run('j1');
    expect(refunds).toHaveLength(1);
  });

  it('the review stand-in takes the seconds asked; a real one is estimated', async () => {
    const { s } = jobsHarness(base, async () => ({}));
    expect(await s.estimate('demo', { seconds: 120, failTimes: 0 })).toBe(120_000);
    expect(await s.estimate('song')).toBe(ETA_BASE_MS.song);
  });

  it('near its time and not done: late, a minute more (kept)', async () => {
    const { s, db } = jobsHarness(base, async () => ({}));
    const now = Date.now();
    const row = { ...base, status: 'running', etaAt: new Date(now - 1_000), late: 0 } as never;
    const out = await s.lateCheck(row, now);
    expect((out as { late: number }).late).toBe(1);
    expect((out as { etaAt: Date }).etaAt.getTime()).toBe(now + 60_000);
    expect((db.row as unknown as { late: number }).late).toBe(1);
    const fine = await s.lateCheck({ ...base, status: 'running', etaAt: new Date(now + 60_000) } as never, now);
    expect((fine as { late: number }).late).toBe(0);
  });
});

describe('M-R253 §5: back home after 88 hours', () => {
  const rs = [
    { name: 'ミキエ', dachi: true, stars: 1 },
    { name: 'だれか', dachi: false, stars: 1 },
    { name: 'もうひとり', dachi: false, stars: 1 },
  ];
  const now = new Date('2026-11-22T12:00:00Z');
  it('under 15 (or no birth year): only the dachi', () => {
    expect(reactionsFor(2015, rs, now)).toEqual({ named: [{ name: 'ミキエ', stars: 1 }], strangers: 0 });
    expect(reactionsFor(null, rs, now).strangers).toBe(0);
  });
  it('15 and over: the dachi by name, others as a count', () => {
    expect(reactionsFor(2000, rs, now)).toEqual({ named: [{ name: 'ミキエ', stars: 1 }], strangers: 2 });
  });
  it("{bati}'s report (§6 ⑥): one ★, several, none (no numbers), then where it was put", () => {
    const say = (h: Parameters<typeof homecomingSay>[0]) => homecomingSay(h).map((x) => fillLine(x.text, x.vars));
    expect(say({ title: '月のうた', planet: 'mercury', named: [{ name: 'ミキエ', stars: 1 }], strangers: 0 })).toEqual(['「月のうた」が、水星から帰ってきたよ。ミキエが★つけてたよ。', '島に、しまっておいたよ。']);
    expect(say({ title: '月のうた', planet: 'mercury', named: [{ name: 'ミキエ', stars: 1 }], strangers: 3 })[0]).toBe('「月のうた」が、水星から帰ってきたよ。ミキエと、ほか3人が★つけてた。');
    const none = say({ title: 'あさ', planet: 'saturn', named: [], strangers: 0 });
    expect(none[0]).toBe('「あさ」が、土星から帰ってきたよ。のんびり、浮かんでたって。');
    expect(none[0]).not.toMatch(/\d/);
    expect(none[1]).toBe('レコードに、しまっておいたよ。');
  });
  it('the service tells each once, with the viewer’s age rule', async () => {
    const item: HomeItem = { key: 'planet_post:p1', targetType: 'planet_post', id: 'p1', planet: 'mercury', title: '月のうた', image: null, flownAt: new Date(now.getTime() - 90 * 3600_000) };
    const mk = (birthYear: number | null, told: string[] = []) => {
      const s = new MoonWorksService({} as never);
      Object.assign(s, { homeItems: async () => [item], told: async () => new Set(told), birthYear: async () => birthYear, reactions: async () => new Map([[item.key, rs]]) });
      return s;
    };
    expect((await mk(2014).homecomings('u', now))[0]).toMatchObject({ named: [{ name: 'ミキエ' }], strangers: 0, homeAt: '2026-11-22T10:00:00.000Z' });
    expect((await mk(1990).homecomings('u', now))[0].strangers).toBe(2);
    expect(await mk(1990, [item.key]).homecomings('u', now)).toEqual([]);
  });
});
