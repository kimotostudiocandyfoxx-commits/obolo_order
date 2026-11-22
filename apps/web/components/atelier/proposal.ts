import { UNLOCK_DAY, type AtelierKind } from '../../lib/atelier/unlock';
import type { Work } from './work';

/** M-R253 §3: what each kind takes as material, and {bati}'s morning proposal (pure) */
export const TAKES: Partial<Record<AtelierKind, AtelierKind[]>> = { art: ['voice'], song: ['voice'], video: ['art', 'song'], radio: ['song'] };

/** the kinds a material can go into */
export function usesOf(kind: AtelierKind): AtelierKind[] {
  return (Object.keys(TAKES) as AtelierKind[]).filter((k) => TAKES[k]!.includes(kind));
}

/**
 * {bati}'s proposals on the morning a kind opens (the lines of the client's decision, the doc's examples).
 * PLACEHOLDER (P-ATELIER-9): provisional until the story script writes them; said in {bati}'s manner (batiLine).
 */
export const PROPOSAL: Partial<Record<AtelierKind, (d: string[]) => string>> = {
  song: ([a]) => `${a}のコロリン、歌詞にしてみる？`,
  video: ([a, b]) => `${a}の絵と、${b}の曲で、映像にしよう`,
  radio: () => '今まで作った曲を流して、しゃべってみる？',
};
/** what {bati} asks with it, when it is taken (the request made from the material) */
export const PROPOSAL_ASK: Partial<Record<AtelierKind, string>> = {
  song: 'コロリンの言葉を歌詞にした曲',
  video: 'この絵と曲で作る映像',
  radio: '作った曲を流す番組',
};

const localDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** which journey day a work was made on (today's journey day, back by the days since) */
export function madeDay(createdAt: string, today: number, now = new Date()): number {
  const days = Math.round((localDay(now) - localDay(new Date(createdAt))) / 86400_000);
  return Math.max(1, today - Math.max(0, days));
}

export const dayWord = (made: number, today: number) => (made === today - 1 ? '昨日' : made === today ? '今日' : `${made}日目`);

export type Proposal = { kind: AtelierKind; line: string; materials: Work[] };

/** the morning's proposal: today opens `kind` and there is something made before to use (newest of each kind it takes) */
export function proposalFor(today: number | null | undefined, works: { work: Work; createdAt: string }[], now = new Date()): Proposal | null {
  if (!today) return null;
  const kind = (Object.keys(PROPOSAL) as AtelierKind[]).find((k) => UNLOCK_DAY[k] === today);
  if (!kind) return null;
  const takes = TAKES[kind] ?? [];
  const picks: { work: Work; createdAt: string }[] = [];
  for (const t of takes) {
    const all = works.filter((x) => x.work.kind === t && x.work.status === 'ready');
    if (kind === 'radio') picks.push(...all.slice(0, 3));
    else if (all[0]) picks.push(all[0]);
  }
  if (!picks.length || (kind === 'video' && picks.length < 2)) return null;
  const words = picks.map((p) => dayWord(madeDay(p.createdAt, today, now), today));
  return { kind, line: PROPOSAL[kind]!(words), materials: picks.map((p) => p.work) };
}

