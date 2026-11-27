import { INVITER_WELCOME_TEXT, MIKIE_ORDER_LINE_ID, DACHI_TEXT_MAX, SendDachiMessageBody as SendBody, KIMORIN_PER_WAIT, KIMORIN_WAIT_LINES, kimorinDue, kimorinSchedule, MIKIE_WELCOME, type SendDachiMessageBody } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { DachiVoiceService, mikieOrderRow, mikieThreadShown, reachable, welcomeRow } from './dachi-voice.service';

/** the API error's code ({ error: { code } }) */
const code = (e: unknown) => ((e as { getResponse?: () => { error?: { code?: string } } }).getResponse?.().error?.code ?? null);

type Row = Record<string, unknown> & { id: string; createdAt: Date; senderId: string | null; recipientId: string | null };

/** a service with its database lookups replaced by a little world in memory */
function world(o: { llm?: unknown } = {}) {
  const follows = new Set<string>();
  const blocks = new Set<string>();
  const people: Record<string, { journeyDay: number; journeyCompletedAt: Date | null; dachiAt: Date | null; displayName: string; orderedAt?: Date | null }> = {};
  const invitations: Record<string, { inviterId: string | null; voiceUrl: string | null; voiceMediaId: string | null; voiceSeconds: number | null }> = {};
  const rows: Row[] = [];
  const pushes: string[] = [];
  const media = {
    getOwned: async (userId: string, id: string) => (id.startsWith(userId.slice(0, 1)) ? { id, url: `https://cdn/${id}.webm` } : null),
    // Bluena's 📎: a file is the sender's when its id starts like theirs
    getOwnedFile: async (userId: string, id: string) => (id.startsWith(userId.slice(0, 1)) ? { id, kind: 'photo', name: 'umi.jpg', mime: 'image/webp', sizeBytes: 1200, width: 800, height: 600, seconds: null, posterId: null, createdAt: new Date().toISOString() } : null),
  };
  const notes: { to: string; title: string; body: string; url: string }[] = [];
  const push = { notify: async (to: string, n: { title: string; body: string; url: string }) => void (pushes.push(to), notes.push({ to, ...n })) };
  const s = new DachiVoiceService({} as never, { list: async () => [] } as never, media as never, push as never, o.llm as never);
  const x = s as unknown as Record<string, unknown>;
  x.journey = async (id: string) => people[id] ?? null;
  x.areDachi = async (a: string, b: string) =>
    a !== b && reachable({ follows: Number(follows.has(`${a}>${b}`)) + Number(follows.has(`${b}>${a}`)), blocks: Number(blocks.has(`${a}>${b}`)) + Number(blocks.has(`${b}>${a}`)), peerOk: true });
  x.invitation = async (id: string) => invitations[id] ?? null;
  x.sentLines = async (id: string) => rows.filter((r) => r.recipientId === id && r.lineId).map((r) => r.lineId as string);
  x.insertLines = async (rs: Row[]) => {
    for (const r of rs) if (!rows.some((o) => o.recipientId === r.recipientId && o.lineId === r.lineId)) rows.push({ ...r, id: `m${rows.length}`, createdAt: r.createdAt ?? new Date() });
  };
  x.insertMessage = async (r: Row) => {
    const m = { ...r, id: `m${rows.length}`, createdAt: new Date() };
    rows.push(m);
    return m;
  };
  x.rows = async () => rows;
  // MIKIE⭐︎DRILL's own thread with a member (her lines with no peer, the member's messages to her)
  x.mikieThread = async (u: string) => {
    const hers = rows.filter((r) => r.character === 'mikie' && !r.peerId && ((r.senderId === null && r.recipientId === u) || r.senderId === u));
    return { any: hers.length > 0, mine: hers.some((r) => r.senderId === u) };
  };
  // R9: the 7-day counts as SQL would group them (here from the rows in memory)
  x.weekCounts = async (u: string) => {
    const m = new Map<string, number>();
    const since = Date.now() - 7 * 86_400_000;
    for (const r of rows) {
      if ((r.senderId !== u && r.recipientId !== u) || r.createdAt.getTime() <= since) continue;
      const t = r.senderId === u ? (r.recipientId ?? (r.character as string)) : r.senderId ? r.senderId : ((r.peerId as string) ?? (r.character as string));
      m.set(t, (m.get(t) ?? 0) + 1);
    }
    return m;
  };
  const dachi = (a: string, b: string) => {
    follows.add(`${a}>${b}`);
    follows.add(`${b}>${a}`);
  };
  return { s, follows, blocks, people, invitations, rows, pushes, notes, dachi };
}

const A = 'a0000000-0000-4000-8000-000000000001';
const B = 'b0000000-0000-4000-8000-000000000002';
const C = 'c0000000-0000-4000-8000-000000000003';
const voice = (who: string): SendDachiMessageBody => ({ mediaId: `${who.slice(0, 1)}1111111-1111-4111-8111-111111111111`, seconds: 4.2 });

describe('ダチの声のメッセージ: who may write (M-R212)', () => {
  it('dachi can send each other voice and work cards; the other is notified', async () => {
    const w = world();
    w.dachi(A, B);
    const m = await w.s.send(A, B, voice(A));
    // client 2026-11-27: the sender does not hear their own voice — no audio in their view, the receiver's has it
    expect(m).toMatchObject({ fromMe: true, kind: 'voice', audioUrl: null, sentVoice: true, seconds: 4.2 });
    expect(w.s.toView(B, w.rows.at(-1) as never)).toMatchObject({ fromMe: false, kind: 'voice', audioUrl: expect.stringContaining('https://cdn/'), seconds: 4.2 });
    await w.s.send(B, A, { work: { kind: 'song', title: 'うた', text: '' } });
    expect(w.rows.at(-1)).toMatchObject({ senderId: B, recipientId: A, kind: 'work' });
    await new Promise((r) => setTimeout(r, 0));
    expect(w.pushes).toEqual([B, A]);
  });

  it('a one-way follow, a stranger or oneself cannot write or read', async () => {
    const w = world();
    w.follows.add(`${A}>${B}`);
    await expect(w.s.send(A, B, voice(A))).rejects.toThrow();
    await expect(w.s.send(A, C, voice(A))).rejects.toThrow();
    await expect(w.s.messages(C, A)).rejects.toThrow();
    await expect(w.s.send(A, A, voice(A))).rejects.toThrow();
    expect(w.rows).toHaveLength(0);
  });

  it('a block either way stops it (and looks the same as not being dachi)', async () => {
    const w = world();
    w.dachi(A, B);
    w.blocks.add(`${B}>${A}`);
    expect(code(await w.s.send(A, B, voice(A)).catch((e: unknown) => e))).toBe('NOT_DACHI');
    await expect(w.s.send(B, A, voice(B))).rejects.toThrow();
    await expect(w.s.messages(A, B)).rejects.toThrow();
  });

  it('only your own recording can be sent', async () => {
    const w = world();
    w.dachi(A, B);
    expect(code(await w.s.send(A, B, voice(B)).catch((e: unknown) => e))).toBe('MEDIA_NOT_FOUND');
  });

  it('KIMORIN⭐︎ is everyone\'s ダチ (client 2026-11-24): listed and open before D04-S005c; MIKIE⭐︎DRILL only once dachi', async () => {
    const w = world();
    w.people[A] = { journeyDay: 3, journeyCompletedAt: null, dachiAt: null, displayName: 'a' };
    expect((await w.s.threads(A)).map((t) => t.id)).toEqual(['kimorin']);
    await expect(w.s.send(A, 'mikie', voice(A))).rejects.toThrow();
    expect((await w.s.send(A, 'kimorin', { text: 'こんにちは' })).kind).toBe('text');
    // a person who is not there at all gets nothing
    expect(await w.s.threads(C)).toEqual([]);
    w.people[A].dachiAt = new Date();
    const m = await w.s.send(A, 'kimorin', voice(A));
    expect(m.fromMe).toBe(true);
    expect(w.rows.at(-1)).toMatchObject({ senderId: A, recipientId: null, character: 'kimorin' });
  });

  it('the shapes of the rule itself', () => {
    expect(reachable({ follows: 2, blocks: 0, peerOk: true })).toBe(true);
    expect(reachable({ follows: 1, blocks: 0, peerOk: true })).toBe(false);
    expect(reachable({ follows: 2, blocks: 1, peerOk: true })).toBe(false);
    expect(reachable({ follows: 2, blocks: 0, peerOk: false })).toBe(false);
  });
});

describe('the first voice message: {inviter}’s, else MIKIE⭐︎DRILL’s', () => {
  const at = new Date('2026-11-01T10:00:00Z');
  it('{inviter} recorded a voice with the invitation: it comes from them', () => {
    expect(welcomeRow(A, at, { inviterId: B, inviterIsDachi: true, voiceUrl: 'https://cdn/v.webm', voiceMediaId: null, voiceSeconds: 5 })).toMatchObject({ senderId: B, recipientId: A, audioUrl: 'https://cdn/v.webm', lineId: 'welcome' });
  });
  it('no voice recorded: {inviter}’s welcome as a text message, in their own thread (M-R343) — never MIKIE⭐︎DRILL’s', () => {
    const row = welcomeRow(A, at, { inviterId: B, inviterIsDachi: true, voiceUrl: null, voiceMediaId: null, voiceSeconds: null });
    expect(row).toMatchObject({ senderId: B, recipientId: A, lineId: 'welcome', kind: 'text', workJson: { text: 'ようこそ。……あなたのつぶやき、聞こえたよ。' } });
    expect(row?.character ?? null).toBeNull();
    expect(INVITER_WELCOME_TEXT).toBe('ようこそ。……あなたのつぶやき、聞こえたよ。');
  });
  it('no inviter (an operator invitation), or not dachi with them: no welcome and no thread of MIKIE⭐︎DRILL’s (M-R342)', () => {
    expect(welcomeRow(A, at, null)).toBeNull();
    expect(welcomeRow(A, at, { inviterId: B, inviterIsDachi: false, voiceUrl: 'https://cdn/v.webm', voiceMediaId: null, voiceSeconds: 5 })).toBeNull();
    expect(welcomeRow(A, at, { inviterId: null, inviterIsDachi: false, voiceUrl: null, voiceMediaId: null, voiceSeconds: null })).toBeNull();
  });
  it('MIKIE⭐︎DRILL becomes a ダチ with the Order: her thread and her welcome then, once (M-R342)', async () => {
    expect(mikieOrderRow(A, at)).toMatchObject({ senderId: null, recipientId: A, character: 'mikie', peerId: null, lineId: MIKIE_ORDER_LINE_ID });
    const w = world();
    w.people[A] = { journeyDay: 5, journeyCompletedAt: null, dachiAt: new Date(), displayName: 'a', orderedAt: null };
    // nobody invited, not an Obolo Order: KIMORIN⭐︎ only, and her thread cannot be opened or written to
    expect((await w.s.threads(A)).map((t) => t.id)).toEqual(['kimorin']);
    expect(w.rows.some((r) => r.character === 'mikie')).toBe(false);
    await expect(w.s.messages(A, 'mikie')).rejects.toMatchObject({ response: { error: { code: 'NOT_DACHI' } } });
    await expect(w.s.send(A, 'mikie', voice(A))).rejects.toThrow();
    // the Eclipse: she is there, with her welcome, word for word; a second look adds nothing
    w.people[A].orderedAt = new Date();
    expect((await w.s.threads(A)).map((t) => t.id).sort()).toEqual(['kimorin', 'mikie']);
    await w.s.threads(A);
    expect(w.rows.filter((r) => r.character === 'mikie')).toHaveLength(1);
    expect(w.s.toView(A, w.rows.find((r) => r.character === 'mikie') as never)).toMatchObject({ character: 'mikie', text: MIKIE_WELCOME.text, fromMe: false });
  });
  it('accounts of before: an untouched thread of hers is hidden until the Order; one the member wrote in stays', async () => {
    expect(mikieThreadShown({ ordered: false, wroteToHer: false })).toBe(false);
    expect(mikieThreadShown({ ordered: false, wroteToHer: true })).toBe(true);
    expect(mikieThreadShown({ ordered: true, wroteToHer: false })).toBe(true);
    const w = world();
    w.people[A] = { journeyDay: 5, journeyCompletedAt: null, dachiAt: new Date(Date.now() - 864e5), displayName: 'a', orderedAt: null };
    // her welcome of before (kept under 'welcome', in her own thread)
    w.rows.push({ id: 'old', senderId: null, recipientId: A, character: 'mikie', peerId: null, lineId: 'welcome', kind: 'voice', audioUrl: null, createdAt: new Date(Date.now() - 864e5) } as never);
    expect((await w.s.threads(A)).map((t) => t.id)).toEqual(['kimorin']);
    expect(w.rows.find((r) => r.id === 'old')).toBeTruthy();
    // the member wrote to her before: the talk stays, and they can go on
    w.rows.push({ id: 'mine', senderId: A, recipientId: null, character: 'mikie', peerId: null, lineId: null, kind: 'text', workJson: { text: 'こんにちは' }, createdAt: new Date() } as never);
    expect((await w.s.threads(A)).map((t) => t.id).sort()).toEqual(['kimorin', 'mikie']);
    await expect(w.s.messages(A, 'mikie')).resolves.toBeTruthy();
    // becoming an Obolo Order later adds no second welcome to a thread that is already there
    w.people[A].orderedAt = new Date();
    await w.s.threads(A);
    expect(w.rows.filter((r) => r.character === 'mikie' && r.senderId === null)).toHaveLength(1);
  });
  it('MIKIE⭐︎DRILL’s line, word for word', () => {
    expect(MIKIE_WELCOME.text).toBe('ようこそ。……あなたのつぶやき、聞こえたわよ。');
  });

  it('arrives once, when becoming dachi; shown with its words', async () => {
    const w = world();
    w.dachi(A, B);
    w.people[A] = { journeyDay: 3, journeyCompletedAt: null, dachiAt: new Date(), displayName: 'a' };
    // {inviter} recorded no voice: their welcome as a text message (M-R343)
    w.invitations[A] = { inviterId: B, voiceUrl: null, voiceMediaId: null, voiceSeconds: null };
    await w.s.arrive(A);
    await w.s.arrive(A);
    expect(w.rows.filter((r) => r.lineId === 'welcome')).toHaveLength(1);
    const v = w.s.toView(A, w.rows[0] as never);
    expect(v).toMatchObject({ character: null, kind: 'text', text: 'ようこそ。……あなたのつぶやき、聞こえたよ。', fromMe: false });
    // nobody invited: nothing arrives, however often the threads are read
    const n = world();
    n.people[A] = { journeyDay: 3, journeyCompletedAt: null, dachiAt: new Date(), displayName: 'a' };
    n.invitations[A] = { inviterId: null, voiceUrl: null, voiceMediaId: null, voiceSeconds: null };
    await n.s.arrive(A);
    await n.s.arrive(A);
    expect(n.rows).toHaveLength(0);
  });

  it('{inviter}’s own recording, when they are dachi', async () => {
    const w = world();
    w.dachi(A, B);
    w.people[A] = { journeyDay: 3, journeyCompletedAt: null, dachiAt: new Date(), displayName: 'a' };
    w.invitations[A] = { inviterId: B, voiceUrl: 'https://cdn/hello.webm', voiceMediaId: null, voiceSeconds: 3 };
    await w.s.arrive(A);
    expect(w.rows[0]).toMatchObject({ senderId: B, recipientId: A, audioUrl: 'https://cdn/hello.webm' });
  });
});

describe('KIMORIN⭐︎ during the waits (M-R214)', () => {
  const H = 3600_000;
  // finished day 3 at 15:00 JST
  const done3 = new Date('2026-11-03T06:00:00Z');

  it('the lines are the client’s words: two for the waits of days 3–5, one for day 6 and for the journey’s last night (day 10 since M-R341)', () => {
    expect(KIMORIN_WAIT_LINES).toHaveLength(8);
    expect(KIMORIN_WAIT_LINES[6].text).toBe('明日は、金星。……電子レンジの次は、何でしょうね。私の推理では、、、言いません。');
    expect(KIMORIN_WAIT_LINES[5].text).toContain('？　私の');
    for (const d of [3, 4, 5]) expect(KIMORIN_WAIT_LINES.filter((l) => l.day === d)).toHaveLength(2);
    for (const d of [6, 10]) expect(KIMORIN_WAIT_LINES.filter((l) => l.day === d)).toHaveLength(1);
    // M-R341: 「……明日で、旅が終わるそうですね。」 is said the night before the Eclipse (day 11), not after Venus any more
    expect(KIMORIN_WAIT_LINES.find((l) => l.id === 'k8')?.day).toBe(10);
    for (const d of [7, 8, 9]) expect(KIMORIN_WAIT_LINES.filter((l) => l.day === d)).toHaveLength(0);
  });

  it('at night (Japan time), inside the 24 h wait, at most two, the same for the same person', () => {
    for (const u of [A, B, C]) {
      for (let h = 0; h < 24; h += 0.5) {
        const done = new Date(done3.getTime() + h * H);
        const s = kimorinSchedule(u, 3, done);
        expect(s.length).toBeLessThanOrEqual(KIMORIN_PER_WAIT);
        for (const { at } of s) {
          expect(at.getTime()).toBeGreaterThan(done.getTime());
          expect(at.getTime()).toBeLessThan(done.getTime() + 24 * H);
          const jstHour = (at.getUTCHours() + 9) % 24;
          expect(jstHour >= 20 || jstHour < 2).toBe(true);
        }
        expect(kimorinSchedule(u, 3, done)).toEqual(s);
      }
    }
  });

  it('nothing before becoming dachi, nothing outside a wait, nothing of another day', () => {
    const late = new Date(done3.getTime() + 23 * H);
    expect(kimorinDue({ userId: A, journeyDay: 3, journeyCompletedAt: done3, dachiAt: null, sent: [], now: late })).toEqual([]);
    expect(kimorinDue({ userId: A, journeyDay: 3, journeyCompletedAt: null, dachiAt: done3, sent: [], now: late })).toEqual([]);
    // dachi only on day 4 (after this wait): day 3's lines never come
    expect(kimorinDue({ userId: A, journeyDay: 3, journeyCompletedAt: done3, dachiAt: new Date(done3.getTime() + 22 * H), sent: [], now: late })).toEqual([]);
    expect(kimorinDue({ userId: A, journeyDay: 4, journeyCompletedAt: done3, dachiAt: done3, sent: [], now: late }).map((d) => d.line.day)).toEqual([4, 4]);
    expect(kimorinDue({ userId: A, journeyDay: 2, journeyCompletedAt: done3, dachiAt: done3, sent: [], now: late })).toEqual([]);
  });

  it('each line is delivered once, over a whole journey, and only after dachi', async () => {
    const w = world();
    let now = new Date('2026-11-03T01:00:00Z');
    w.people[A] = { journeyDay: 3, journeyCompletedAt: null, dachiAt: null, displayName: 'a' };
    w.invitations[A] = { inviterId: null, voiceUrl: null, voiceMediaId: null, voiceSeconds: null };
    // before dachi: nothing, even in a wait
    w.people[A].journeyCompletedAt = new Date(now.getTime() - 60_000);
    now = new Date(now.getTime() + 20 * H);
    await w.s.arrive(A, now);
    expect(w.rows).toHaveLength(0);
    // dachi on day 3 (D04-S005c), before finishing it
    w.people[A].journeyCompletedAt = null;
    w.people[A].dachiAt = new Date(now.getTime());
    for (let day = 3; day <= 10; day++) {
      w.people[A].journeyDay = day;
      w.people[A].journeyCompletedAt = new Date(now.getTime() + H);
      // read the threads every hour through the wait
      for (let h = 1; h <= 26; h++) {
        now = new Date(now.getTime() + H);
        await w.s.arrive(A, now);
      }
      w.people[A].journeyCompletedAt = null;
    }
    const lines = w.rows.filter((r) => r.character === 'kimorin').map((r) => r.lineId);
    expect(lines).toEqual(['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8']);
    expect(new Set(lines).size).toBe(lines.length);
    // each was written at its own time (not when read) and after becoming dachi
    for (const r of w.rows) expect(r.createdAt.getTime()).toBeGreaterThanOrEqual(w.people[A].dachiAt!.getTime());
  });
});

describe('client 2026-11-24: text messages in the ダチ talk', () => {
  it('dachi send each other words: kept as a text row, shown as a text bubble, the friend notified like a voice', async () => {
    const w = world();
    w.dachi(A, B);
    const m = await w.s.send(A, B, { text: 'あした、土星で会おう', face: 'smile' });
    expect(m).toMatchObject({ fromMe: true, kind: 'text', text: 'あした、土星で会おう', audioUrl: null, work: null, face: 'smile' });
    expect(m.faces?.length).toBeGreaterThan(0);
    expect(w.rows.at(-1)).toMatchObject({ senderId: A, recipientId: B, kind: 'text' });
    // the friend sees it as theirs to read
    const seen = w.s.toView(B, w.rows.at(-1) as never);
    expect(seen).toMatchObject({ fromMe: false, kind: 'text', text: 'あした、土星で会おう', read: false });
    await new Promise((r) => setTimeout(r, 0));
    expect(w.notes).toMatchObject([{ to: B, title: '💬 ダチから、メッセージ', body: 'あした、土星で会おう', url: `/moon/atelier?tab=dachi&dachi=${A}` }]);
  });
  it('the same walls as voice: not dachi, blocked → refused; flagged words are never sent', async () => {
    const w = world();
    expect(code(await w.s.send(A, B, { text: 'やあ' }).catch((e) => e))).toBe('NOT_DACHI');
    w.dachi(A, B);
    w.blocks.add(`${B}>${A}`);
    expect(code(await w.s.send(A, B, { text: 'やあ' }).catch((e) => e))).toBe('NOT_DACHI');
    w.blocks.clear();
    expect(code(await w.s.send(A, B, { text: '死ね' }).catch((e) => e))).toBe('CONTENT_FLAGGED');
    expect(w.rows.filter((r) => r.kind === 'text')).toHaveLength(0);
  });
  it('the body: words 1–300 characters (trimmed)', () => {
    expect(SendBody.safeParse({ text: '  ' }).success).toBe(false);
    expect(SendBody.safeParse({ text: 'x'.repeat(DACHI_TEXT_MAX + 1) }).success).toBe(false);
    expect(SendBody.safeParse({ text: ' やあ ' }).data).toEqual({ text: 'やあ' });
  });
});

describe('R9: KIMORIN⭐︎ answers in the ダチ talk (the chat provider mocked)', () => {
  const llm = (answer: string) => {
    const calls: { system: string; history: { role: string; text: string }[] }[] = [];
    return { calls, provider: { name: 'fake', chat: async (r: { system: string; history: { role: string; text: string }[] }) => (r.system.includes('content moderator') ? 'OK' : (calls.push(r), answer)), transcribe: async () => 'きょうは、なにをしてたの？' } };
  };
  it('a text: KIMORIN answers in character, voiced with the story\'s KIMORIN voice, kept as a message from KIMORIN', async () => {
    const l = llm('……こんにちは。私は、新しい発明の途中です🔧。あなたは、どうですか？');
    const w = world({ llm: l.provider });
    w.people[A] = { journeyDay: 3, journeyCompletedAt: null, dachiAt: null, displayName: 'ネオ' };
    const x = w.s as unknown as Record<string, unknown>;
    const voiced: string[] = [];
    x.kimorinVoice = async (_u: string, text: string) => (voiced.push(text), 'https://cdn/kimorin.mp3');
    const m = await w.s.send(A, 'kimorin', { text: 'KIMORIN、元気？' }, { reply: true, origin: 'http://api' });
    expect(m).toMatchObject({ fromMe: true, kind: 'text', text: 'KIMORIN、元気？' });
    // the persona: polite, in character, the safety rules; the member's words last
    expect(l.calls[0].system).toContain('KIMORIN');
    expect(l.calls[0].system).toContain('です・ます');
    expect(l.calls[0].system).toContain('お医者さん');
    expect(l.calls[0].system).toContain('話を向けない');
    expect(l.calls[0].history.at(-1)).toEqual({ role: 'user', text: 'KIMORIN、元気？' });
    // emoji gone, three sentences at most
    expect(m.reply).toMatchObject({ fromMe: false, character: 'kimorin', kind: 'voice', audioUrl: 'https://cdn/kimorin.mp3', text: '……こんにちは。私は、新しい発明の途中です。あなたは、どうですか？' });
    expect(voiced).toEqual([m.reply!.text]);
    expect(w.rows.at(-1)).toMatchObject({ senderId: null, recipientId: A, character: 'kimorin' });
    // it is in the KIMORIN thread as unread for the member
    expect(w.s.toView(A, w.rows.at(-1) as never).read).toBe(false);
  });
  it('no voice possible: the words alone; a voice message is transcribed first', async () => {
    const l = llm('それは、私にもわかりません。');
    const w = world({ llm: l.provider });
    w.people[A] = { journeyDay: 3, journeyCompletedAt: null, dachiAt: null, displayName: 'ネオ' };
    const x = w.s as unknown as Record<string, unknown>;
    x.kimorinVoice = async () => null;
    x.transcribeVoice = async () => 'きょうは、なにをしてたの？';
    const m = await w.s.send(A, 'kimorin', voice(A), { reply: true });
    expect(l.calls[0].history.at(-1)).toEqual({ role: 'user', text: 'きょうは、なにをしてたの？' });
    expect(m.reply).toMatchObject({ kind: 'text', audioUrl: null, text: 'それは、私にもわかりません。' });
  });
  it('R18: a non-member at 0 mana (voiced: false): the answer comes as text, no read-aloud is made', async () => {
    const l = llm('はい。元気です。');
    const w = world({ llm: l.provider });
    w.people[A] = { journeyDay: 9, journeyCompletedAt: null, dachiAt: null, displayName: 'ネオ' };
    const x = w.s as unknown as Record<string, unknown>;
    const voiced: string[] = [];
    x.kimorinVoice = async (_u: string, text: string) => (voiced.push(text), 'https://cdn/kimorin.mp3');
    const m = await w.s.send(A, 'kimorin', { text: 'やあ' }, { reply: true, voiced: false });
    expect(m.reply).toMatchObject({ kind: 'text', audioUrl: null, text: 'はい。元気です。' });
    expect(voiced).toEqual([]);
  });
  it('past the day\'s limit (reply: false), or a real ダチ thread: no answer', async () => {
    const l = llm('はい。');
    const w = world({ llm: l.provider });
    w.people[A] = { journeyDay: 3, journeyCompletedAt: null, dachiAt: null, displayName: 'ネオ' };
    expect((await w.s.send(A, 'kimorin', { text: 'やあ' }, { reply: false })).reply).toBeUndefined();
    w.dachi(A, B);
    expect((await w.s.send(A, B, { text: 'やあ' }, { reply: true })).reply).toBeUndefined();
    expect(l.calls).toHaveLength(0);
  });
});

describe('R9: the Moon temple — ダチ ranked by the last 7 days', () => {
  it('threads come ranked by messages both ways in 7 days; ties to the most recent; KIMORIN ranked like anyone', async () => {
    const w = world();
    w.people[A] = { journeyDay: 5, journeyCompletedAt: null, dachiAt: new Date(Date.now() - 864e5 * 30), displayName: 'a' };
    const friends = [B, C].map((id) => ({ id, displayName: id.slice(0, 1), pic: null }));
    (w.s as unknown as { dachi: { list: () => Promise<unknown> } }).dachi = { list: async () => friends };
    (w.s as unknown as Record<string, unknown>).db = { read: { select: () => ({ from: () => ({ where: async () => [] }) }) } };
    w.dachi(A, B);
    w.dachi(A, C);
    const old = new Date(Date.now() - 864e5 * 10);
    const msg = (from: string | null, to: string | null, at: Date, extra: Record<string, unknown> = {}) => w.rows.push({ id: `x${w.rows.length}`, senderId: from, recipientId: to, createdAt: at, kind: 'text', ...extra });
    // B: 3 this week (both ways); C: 1 this week but 5 old ones; KIMORIN: 2 this week
    msg(A, B, new Date(Date.now() - 3600e3));
    msg(B, A, new Date(Date.now() - 7200e3));
    msg(A, B, new Date(Date.now() - 9000e3));
    for (let k = 0; k < 5; k++) msg(A, C, old);
    msg(C, A, new Date(Date.now() - 60e3));
    msg(A, null, new Date(Date.now() - 100e3), { character: 'kimorin' });
    msg(null, A, new Date(Date.now() - 90e3), { character: 'kimorin' });
    const t = await w.s.threads(A);
    expect(t.map((x) => [x.id, x.recent])).toEqual([
      [B, 3],
      ['kimorin', 2],
      [C, 1],
      // (no MIKIE⭐︎DRILL before the Order: M-R342)
    ]);
  });
});

describe('R10: the ダチ history and older messages', () => {
  it('every talk newest first with its last message: words, 🎤 a voice, a work', async () => {
    const w = world();
    w.people[A] = { journeyDay: 5, journeyCompletedAt: null, dachiAt: new Date(Date.now() - 864e5 * 30), displayName: 'a' };
    (w.s as unknown as { dachi: { list: () => Promise<unknown> } }).dachi = { list: async () => [B, C].map((id) => ({ id, displayName: id.slice(0, 1), pic: null })) };
    (w.s as unknown as Record<string, unknown>).db = { read: { select: () => ({ from: () => ({ where: async () => [] }) }) } };
    w.dachi(A, B);
    w.dachi(A, C);
    const msg = (from: string | null, to: string | null, min: number, extra: Record<string, unknown>) => w.rows.push({ id: `x${w.rows.length}`, senderId: from, recipientId: to, createdAt: new Date(Date.now() - min * 60_000), ...extra });
    msg(A, C, 30, { kind: 'work', workJson: { kind: 'song', title: 'うた', text: '' } });
    msg(B, A, 10, { kind: 'voice', audioUrl: 'https://cdn/v.mp3' });
    msg(null, A, 5, { kind: 'text', character: 'kimorin', workJson: { text: '……こんにちは。' } });
    const page = await w.s.history(A);
    expect(page.items.map((t) => [t.id, t.preview])).toEqual([
      ['kimorin', { kind: 'text', text: '……こんにちは。', fromMe: false }],
      [B, { kind: 'voice', text: '声のメッセージ', fromMe: false }],
      [C, { kind: 'work', text: 'うた', fromMe: true }],
    ]);
    expect(page.next).toBeNull();
    // two at a time: the cursor goes on
    const p1 = await w.s.history(A, null, 2);
    const p2 = await w.s.history(A, p1.next, 2);
    expect([...p1.items, ...p2.items].map((t) => t.id)).toEqual(page.items.map((t) => t.id));
  });
  it('older messages: the page before a time, a limit kept within 1–200', async () => {
    const w = world();
    w.dachi(A, B);
    const calls: { limit: number }[] = [];
    const x = w.s as unknown as Record<string, unknown>;
    x.rows = async (_where: unknown, limit: number) => (calls.push({ limit }), []);
    await w.s.messages(A, B, { before: new Date().toISOString(), limit: 50 });
    await w.s.messages(A, B, { limit: 9999 });
    expect(calls.map((c) => c.limit)).toEqual([50, 200]);
  });
});

describe("Bluena's 📎: a file into a ダチ talk", () => {
  const file = (who: string) => ({ fileId: `${who.slice(0, 1)}2222222-2222-4222-8222-222222222222` });
  it('your own file goes to a ダチ, kept by its id; both see it in the talk and the history', async () => {
    const w = world();
    w.dachi(A, B);
    w.people[A] = { journeyDay: 4, journeyCompletedAt: null, dachiAt: new Date(), displayName: 'ネオ' };
    const m = await w.s.send(A, B, file(A));
    expect(m).toMatchObject({ kind: 'file', fromMe: true, file: { kind: 'photo', name: 'umi.jpg' } });
    expect(w.rows.at(-1)).toMatchObject({ senderId: A, recipientId: B, kind: 'file', audioMediaId: file(A).fileId });
    const seen = w.s.toView(B, w.rows.at(-1) as never);
    expect(seen).toMatchObject({ fromMe: false, kind: 'file', file: { id: file(A).fileId } });
    await new Promise((r) => setTimeout(r, 0));
    expect(w.notes.at(-1)).toMatchObject({ to: B, title: '📎 ネオから、写真' });
  });

  it("someone else's file, or one that is not there, is not sent; nor to a non-ダチ", async () => {
    const w = world();
    w.dachi(A, B);
    await expect(w.s.send(A, B, file(B))).rejects.toThrow();
    await expect(w.s.send(A, C, file(A))).rejects.toThrow();
    expect(w.rows).toHaveLength(0);
  });

  it('KIMORIN⭐︎ hears what was sent', async () => {
    const said: string[] = [];
    const w = world({ llm: { name: 't', chat: async (r: { history: { text: string }[] }) => (said.push(r.history.at(-1)!.text), 'いい写真ですね。') } });
    w.people[A] = { journeyDay: 4, journeyCompletedAt: null, dachiAt: null, displayName: 'ネオ' };
    const m = await w.s.send(A, 'kimorin', file(A), { reply: true });
    expect(m.kind).toBe('file');
    expect(said.some((t) => t.includes('写真「umi.jpg」'))).toBe(true);
  });
});
