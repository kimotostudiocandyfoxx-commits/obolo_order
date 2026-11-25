import { SongTweakOp, type SongPaidEdit } from '@obolo/shared';

/**
 * R13: the free changes of a finished song when the rules did not understand the words (@obolo/shared parseTweak) — the
 * model turns them into the same ops, or says the change needs the studio (new words sung, a new melody, longer with new
 * music, another voice or genre: a spell and mana).
 */
export function songTweakSystem(): string {
  return [
    'A child asks to change a finished song in Japanese. You turn the words into edit operations the app can do itself on the recorded song. Return ONLY JSON {"ops": [...], "paid": null}.',
    'Operations: {"op":"tempo","factor":0.75–1.3} (faster > 1), {"op":"key","semitones":-5–5}, {"op":"cut","part":{"cycle":2}} (2番) or {"op":"cut","part":{"section":"intro|verse|pre-chorus|chorus|final-chorus|bridge|instrumental|guitar-solo|outro"}}, {"op":"repeat","part":{...}}, {"op":"length","seconds":10–180}, {"op":"fade","in":0–8,"out":0–12}, {"op":"balance","vocalDb":-12–12,"bgmDb":-12–12}, {"op":"only","stem":"instrumental|vocals|both"} (karaoke = instrumental), {"op":"room","amount":0–1} (echo / reverb).',
    'Several operations may be asked in one sentence: list them all, in order.',
    'If the change needs the song to be sung or composed again — new or changed lyrics sung ("lyrics"), a new melody ("melody"), longer with new parts such as a third verse ("extend"), another singer\'s voice ("voice"), another genre or instruments ("genre") — return {"ops": [], "paid": "lyrics|melody|extend|voice|genre"}.',
    'If it is not a change of the song (a thank-you, a question), return {"ops": [], "paid": null}.',
  ].join('\n');
}

const PAID: SongPaidEdit[] = ['lyrics', 'melody', 'extend', 'voice', 'genre'];
export function parseSongTweak(raw: string): { ops: SongTweakOp[]; paid?: SongPaidEdit } {
  let j: { ops?: unknown; paid?: unknown } = {};
  try {
    j = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return { ops: [] };
  }
  const ops = (Array.isArray(j.ops) ? j.ops : []).flatMap((o) => {
    const r = SongTweakOp.safeParse(o);
    return r.success ? [r.data] : [];
  });
  const paid = PAID.find((p) => p === j.paid);
  return { ops: ops.slice(0, 8), ...(paid && !ops.length ? { paid } : {}) };
}
