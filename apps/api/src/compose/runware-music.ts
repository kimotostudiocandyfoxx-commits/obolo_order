import { HttpStatus, Logger } from '@nestjs/common';
import { RUNWARE_URL, type RunwareAudioTask } from '@obolo/shared';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apiError } from '../common/errors';
import { probeAudio } from '../media/transcode';

const log = new Logger('RunwareMusic');

/** a song made on Runware: the MP3, what Runware says it cost (includeCost), and which task it was */
export type RunwareSong = { data: Buffer; audioUrl: string; costUsd: number | null; taskUUID: string; model: string; ms: number };

export type RunwareDeps = {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** how often getResponse is asked (default 4 s) and for how long at most (default 10 minutes) */
  pollMs?: number;
  timeoutMs?: number;
};

type Item = { taskUUID?: string; audioURL?: string; audioUrl?: string; status?: string; cost?: number; error?: string; message?: string };
type Reply = { data?: Item[]; errors?: { message?: string; code?: string; taskUUID?: string }[] };

const failed = (why: string) => apiError(HttpStatus.BAD_GATEWAY, 'MUSIC_FAILED', `The song could not be made: ${why}`.slice(0, 300));

/**
 * R17: one audioInference task on Runware (scripts/music-lab/runware_compare.py, tested 2026-11-25): sent async, then
 * getResponse until its audio is there (a sync answer that already has the audio is taken as it is); the audio is
 * downloaded; the cost is Runware's own (`cost`, USD) — the per-job cost record and the mana rule read it.
 */
export async function runwareAudio(key: string, task: RunwareAudioTask, deps: RunwareDeps = {}): Promise<RunwareSong> {
  const f = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const t0 = Date.now();
  const call = async (body: unknown[]): Promise<Reply> => {
    let res: Response;
    try {
      res = await f(RUNWARE_URL, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(120_000) });
    } catch (e) {
      throw failed(`unreachable ${String(e)}`);
    }
    const j = (await res.json().catch(() => ({}))) as Reply;
    if (!res.ok || j.errors?.length) throw failed(`${res.status} ${JSON.stringify(j.errors ?? j).slice(0, 200)}`);
    return j;
  };
  const mine = (j: Reply) => j.data?.find((d) => d.taskUUID === task.taskUUID);
  const audioOf = (d: Item | undefined) => d?.audioURL ?? d?.audioUrl;
  let got = mine(await call([task]));
  const until = t0 + (deps.timeoutMs ?? 600_000);
  while (!audioOf(got)) {
    if (got?.status === 'error' || got?.status === 'failed') throw failed(got.error ?? got.message ?? 'error');
    if (Date.now() > until) throw failed('timed out');
    await sleep(deps.pollMs ?? 4000);
    got = mine(await call([{ taskType: 'getResponse', taskUUID: task.taskUUID }])) ?? got;
  }
  const audioUrl = audioOf(got)!;
  let res: Response;
  try {
    res = await f(audioUrl, { signal: AbortSignal.timeout(120_000) });
  } catch (e) {
    throw failed(`download ${String(e)}`);
  }
  if (!res.ok) throw failed(`download ${res.status}`);
  const data = Buffer.from(await res.arrayBuffer());
  const costUsd = typeof got?.cost === 'number' ? got.cost : null;
  const ms = Date.now() - t0;
  log.log(`${task.model} ${task.taskUUID}: ${Math.round(data.length / 1024)} KB in ${Math.round(ms / 1000)}s, cost ${costUsd ?? '?'} USD`);
  return { data, audioUrl, costUsd, taskUUID: task.taskUUID, model: task.model, ms };
}

/** how long an audio file is (ffprobe), 0 when it cannot be read */
export async function audioSeconds(data: Buffer, ext = 'mp3'): Promise<number> {
  const dir = await mkdtemp(join(tmpdir(), 'rwa-'));
  try {
    const p = join(dir, `a.${ext}`);
    await writeFile(p, data);
    return Math.round((await probeAudio(p)).seconds * 10) / 10;
  } catch {
    return 0;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
