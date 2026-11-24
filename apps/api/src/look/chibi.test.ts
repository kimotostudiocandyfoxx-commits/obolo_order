import { describe, expect, it, vi } from 'vitest';

vi.mock('../media/keying', async (orig) => ({ ...(await orig<typeof import('../media/keying')>()), chooseKey: async () => 'green' }));
const { CHIBI_TRIES, LookService } = await import('./look.service');

/** a member row kept in memory; update().set() merges into it */
function make(row: Record<string, unknown>, paint: () => Promise<{ data: Buffer; mime: string }>) {
  const db = { write: { update: () => ({ set: (v: Record<string, unknown>) => ({ where: async () => void Object.assign(row, v) }) }) } };
  const s = Object.create(LookService.prototype) as InstanceType<typeof LookService> & Record<string, unknown>;
  const painted: string[] = [];
  Object.assign(s, {
    db,
    log: { warn: () => undefined },
    looks: { generate: async (prompt: string) => (painted.push(prompt), paint()) },
    media: { storeImage: async () => ({ url: 'https://x/chibi.png' }) },
    user: async () => ({ ...row }),
    current: async () => ({ data: Buffer.from([0x89]), mime: 'image/png' }),
    cut: async () => Buffer.from('png'),
  });
  return { s, painted };
}

describe('M-R262: the Saturn mini figure, one per member (one painting + at most one retry)', () => {
  it('painted once from the look, then never again', async () => {
    const row: Record<string, unknown> = { avatarUrl: 'https://x/look.png', chibiPicUrl: null, onboardingJson: {} };
    const { s, painted } = make(row, async () => ({ data: Buffer.from('a'), mime: 'image/png' }));
    await s.kororinChibi('u1', 'https://api');
    expect(row.chibiPicUrl).toBe('https://x/chibi.png');
    expect(painted).toHaveLength(1);
    expect(painted[0]).toContain('2-heads-tall chibi');
    expect(painted[0]).toContain('glossy cute 3D vinyl mini figure');
    await s.kororinChibi('u1', 'https://api');
    expect(painted).toHaveLength(1);
  });
  it('a failed painting is retried once at most, also across queue retries', async () => {
    const row: Record<string, unknown> = { avatarUrl: 'https://x/look.png', chibiPicUrl: null, onboardingJson: {} };
    const { s, painted } = make(row, async () => Promise.reject(new Error('painter down')));
    await s.kororinChibi('u1', 'https://api');
    await s.kororinChibi('u1', 'https://api');
    expect(painted).toHaveLength(CHIBI_TRIES);
    expect(CHIBI_TRIES).toBe(2);
    expect(row.chibiPicUrl).toBeNull();
  });
  it('no look yet: nothing painted', async () => {
    const row: Record<string, unknown> = { avatarUrl: null, chibiPicUrl: null, onboardingJson: {} };
    const { s, painted } = make(row, async () => ({ data: Buffer.from('a'), mime: 'image/png' }));
    await s.kororinChibi('u1', 'https://api');
    expect(painted).toHaveLength(0);
  });
});
