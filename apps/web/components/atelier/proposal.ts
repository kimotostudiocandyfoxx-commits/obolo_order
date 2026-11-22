import { MOON_LINES } from '@obolo/shared';
import { daysUntil, isOpen, UNLOCK_DAY, type AtelierKind } from '../../lib/atelier/unlock';
import type { Work } from './work';

/** M-R253 §3: what each kind takes as material, and {bati}'s morning proposal (pure) */
export const TAKES: Partial<Record<AtelierKind, AtelierKind[]>> = { art: ['voice'], song: ['voice'], video: ['art', 'song'], radio: ['song'] };

/** the kinds a material can go into */
export function usesOf(kind: AtelierKind): AtelierKind[] {
  return (Object.keys(TAKES) as AtelierKind[]).filter((k) => TAKES[k]!.includes(kind));
}

/**
 * {bati}'s proposals on the morning a kind opens — the official lines (M-R253 §6 ①, MOON_LINES.propose), said in its
 * manner (batiLine) with 〔使う〕〔今日は新しく〕. Day 4: the day-3 kororin → a picture; day 5: → lyrics; day 6: the day-4
 * picture and yesterday's song → a film; day 7: the songs → a show. Nothing made the day before: no proposal.
 */
export const PROPOSE_KINDS: AtelierKind[] = ['art', 'song', 'video', 'radio'];
/** what {bati} asks with it, when it is taken (the request made from the material) */
export const PROPOSAL_ASK: Partial<Record<AtelierKind, string>> = {
  art: 'コロリンの言葉を絵にして',
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

/** the day a work was made, as {bati} says it: the day before → 「昨日」, earlier → 「〇日目」 (M-R253 §6 ①) */
export const dayWord = (made: number, today: number) => (made === today - 1 ? '昨日' : `${made}日目`);

export type Proposal = {
  kind: AtelierKind;
  /** the line as written (MOON_LINES.propose[kind]) */
  line: string;
  /** its placeholders ({work}: the kororin's words) */
  vars: Record<string, string>;
  /** the day words of the line, when the material was made on another day ([as written, said]) */
  fix: [string, string][];
  materials: Work[];
};

/** the morning's proposal: today opens `kind`, something was made the day before, and there is material to use */
export function proposalFor(today: number | null | undefined, works: { work: Work; createdAt: string }[], now = new Date()): Proposal | null {
  if (!today) return null;
  const kind = PROPOSE_KINDS.find((k) => UNLOCK_DAY[k] === today);
  if (!kind) return null;
  const ready = works.filter((x) => x.work.status === 'ready');
  // §6 ①: nothing made the day before → only the day's own way to make
  if (!ready.some((x) => madeDay(x.createdAt, today, now) === today - 1)) return null;
  const takes = TAKES[kind] ?? [];
  const picks: { work: Work; createdAt: string }[] = [];
  for (const t of takes) {
    const all = ready.filter((x) => x.work.kind === t);
    if (kind === 'radio') picks.push(...all.slice(0, 3));
    else if (all[0]) picks.push(all[0]);
  }
  if (!picks.length || (kind === 'video' && picks.length < 2)) return null;
  // the line's day words always say the real day (the day before → 昨日, earlier → 〇日目)
  const fix: [string, string][] = [];
  const day = (w: { createdAt: string }) => madeDay(w.createdAt, today, now);
  const said = (asWritten: string, w: { createdAt: string }) => {
    const real = dayWord(day(w), today);
    if (real !== asWritten) fix.push([asWritten, real]);
  };
  if (kind === 'art' || kind === 'song') said('3日目', picks[0]);
  else if (kind === 'video') {
    said('4日目', picks.find((p) => p.work.kind === 'art')!);
    said('昨日', picks.find((p) => p.work.kind === 'song')!);
  }
  const words = picks[0].work.text || picks[0].work.title || '';
  return { kind, line: MOON_LINES.propose[kind as keyof typeof MOON_LINES.propose], vars: { work: words.slice(0, 16) }, fix, materials: picks.map((p) => p.work) };
}

/**
 * M-R253 §6 ⑦: {bati}'s line for works dragged in from Bluena — two or more: mixed; nothing it can go into is open
 * yet: the days until it is; one kind open today: that kind (asked at once); else as a rule, with the kinds to pick.
 */
export function dragLine(all: Work[], day: number | null | undefined, name: (w: Work) => string, kindWord: (k: AtelierKind) => string, any = false): { line: string; vars: Record<string, string | number>; kinds: AtelierKind[]; only?: AtelierKind } {
  const w = all[all.length - 1];
  const uses = [...new Set(all.flatMap((x) => usesOf(x.kind)))];
  const open = uses.filter((k) => any || isOpen(k, day));
  if (all.length >= 2) return { line: MOON_LINES.dragMix, vars: { work: name(all[all.length - 2]), work2: name(w) }, kinds: open };
  if (uses.length && !open.length) return { line: MOON_LINES.dragLocked, vars: { d: Math.min(...uses.map((k) => daysUntil(k, day))) }, kinds: [] };
  if (open.length === 1) return { line: MOON_LINES.dragOnly, vars: { work: name(w), kind: kindWord(open[0]) }, kinds: [], only: open[0] };
  return { line: MOON_LINES.dragIn, vars: { work: name(w) }, kinds: open };
}
