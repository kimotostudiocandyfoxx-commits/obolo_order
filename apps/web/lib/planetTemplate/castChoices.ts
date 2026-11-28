import { isCastOshiKey, isCastWorkId, type CastChoicesView, type CastOshiKey, type PlanetHomeView } from '@obolo/shared';

/**
 * Client 2026-11-28: the homes' residents (the seven Sushimon and the eleven residents — the oshi of the roster,
 * roster.ts) are the member's oshi from the start: ♡ on. The member can take the ♡ off one of them — then they no longer
 * come to the member's homes (any planet) and stay only on the profile's row, dimmed, where the ♡ gives them back.
 * Their works can be ☆-saved to Bluena like a member's work. The choices are the member's, kept on the server
 * (GET/PUT /me/cast: cast_choices); the cast stay the app's own static files. KIMORIN⭐︎ / MIKIE⭐︎DRILL are ダチ: no ♡ here.
 * There is no report for the cast: they are the app's own characters.
 */

/** the resident a home person / author id is (`cast-<key>`), when they are one of the oshi */
export function residentOf(personId: string | null | undefined): CastOshiKey | null {
  const k = personId?.startsWith('cast-') ? personId.slice(5) : null;
  return isCastOshiKey(k) ? k : null;
}

/** the residents with the ♡ off leave the home: their works out of `around` (everything else as it was) */
export function withoutUnoshi(view: PlanetHomeView, unoshi: ReadonlySet<string>): PlanetHomeView {
  if (!unoshi.size) return view;
  const around = view.around.filter((w) => {
    const k = residentOf(w.author.id);
    return !(k && unoshi.has(k));
  });
  return around.length === view.around.length ? view : { ...view, around };
}

/** the residents' works that left the home (the profile's row still shows them, dimmed) */
export function unoshiAround(view: PlanetHomeView, unoshi: ReadonlySet<string>): PlanetHomeView['around'] {
  if (!unoshi.size) return [];
  return view.around.filter((w) => {
    const k = residentOf(w.author.id);
    return !!k && unoshi.has(k);
  });
}

export interface CastChoices {
  unoshi: ReadonlySet<CastOshiKey>;
  saved: ReadonlySet<string>;
}
export const NO_CHOICES: CastChoices = { unoshi: new Set(), saved: new Set() };
export const choicesOf = (v: CastChoicesView | null | undefined): CastChoices =>
  v ? { unoshi: new Set(v.unoshi.filter(isCastOshiKey)), saved: new Set(v.saved.map((s) => s.id).filter(isCastWorkId)) } : NO_CHOICES;

/** ♡ / ☆ changed at once on the screen (the server's answer replaces it when it comes) */
export function toggled(c: CastChoices, change: { oshi: CastOshiKey; on: boolean } | { save: string; on: boolean }): CastChoices {
  if ('oshi' in change) {
    const unoshi = new Set(c.unoshi);
    if (change.on) unoshi.delete(change.oshi);
    else unoshi.add(change.oshi);
    return { ...c, unoshi };
  }
  const saved = new Set(c.saved);
  if (change.on) saved.add(change.save);
  else saved.delete(change.save);
  return { ...c, saved };
}

/** the toasts (PROVISIONAL wording for the story session) */
export const castToast = {
  oshiOff: (name: string) => `${name} の推しを、はずしたよ。もう、ホームには来ないよ`,
  oshiOn: (name: string) => `${name} を、また推しにしたよ。ホームに来てくれるよ`,
  saved: 'ブルーナに保存したよ',
  unsaved: 'ブルーナから、はずしたよ',
};
