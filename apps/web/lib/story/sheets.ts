/**
 * The story chat's cast and place sheets (docs/story-rewrite/cast.md, places.md — the notation in
 * docs/handoff/to-story-chat.md「追加（2026-10-13）」): one block per person / place —
 *
 *   ## エビ
 *   - デザイン：なし
 *   - 見た目：…
 *   - 声：…
 *
 * They say what already has a picture (the client sends it) and what must be painted / voiced, and the
 * text is the order for the picture and the voice. Plain functions, no I/O.
 */

export interface Sheet {
  name: string;
  fields: Record<string, string>;
}

export interface CastSheet {
  name: string;
  /** a file-safe id: the sheet's 「ID：」, else made from the name */
  id: string;
  /** the client has a design (they send it) */
  designed: boolean;
  look: string;
  personality: string;
  voice: string;
  /** other names in the script that are the same person / the same look */
  aliases: string[];
}

export interface PlaceSheet {
  name: string;
  id: string;
  /** the client has a picture */
  drawn: boolean;
  look: string;
  light: string;
  scenes: string;
}

/** `## name` blocks with `- key：value` lines (a value may run on over the following indented lines). */
export function parseSheets(md: string): Sheet[] {
  const out: Sheet[] = [];
  let cur: Sheet | null = null;
  let last = '';
  for (const raw of md.split(/\r?\n/)) {
    const h = raw.match(/^##\s+(.+?)\s*$/);
    if (h) {
      cur = { name: h[1].trim(), fields: {} };
      out.push(cur);
      last = '';
      continue;
    }
    if (!cur) continue;
    const f = raw.match(/^\s*[-・*]\s*([^：:]{1,16})[：:]\s*(.*)$/);
    if (f) {
      last = f[1].trim();
      cur.fields[last] = f[2].trim();
      continue;
    }
    // a run-on line belongs to the field above
    if (last && raw.trim() && !/^#/.test(raw)) cur.fields[last] = `${cur.fields[last]} ${raw.trim()}`.trim();
  }
  return out;
}

const no = (v: string | undefined) => !v || /^(なし|無し|ない|no|none|-|—)/i.test(v.trim());

/** A short stable id for a name: ASCII names as they are, others as c-<hash>. */
export function idOf(name: string, prefix = 'c'): string {
  const ascii = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (ascii && ascii.length >= 2 && /^[\x00-\x7f]+$/.test(name.trim())) return ascii;
  let h = 2166136261;
  for (const ch of name) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0;
  return `${prefix}-${h.toString(36)}`;
}

export function castSheets(md: string): CastSheet[] {
  return parseSheets(md).map(({ name, fields: f }) => ({
    name,
    id: f['ID']?.trim() || idOf(name, 'c'),
    designed: !no(f['デザイン']),
    look: f['見た目'] ?? '',
    personality: f['性格'] ?? '',
    voice: f['声'] ?? '',
    aliases: (f['同じ姿でよい呼び方'] ?? '').split(/[、,／/]/).map((s) => s.trim()).filter(Boolean),
  }));
}

export function placeSheets(md: string): PlaceSheet[] {
  return parseSheets(md).map(({ name, fields: f }) => ({
    name,
    id: f['ID']?.trim() || idOf(name, 'p'),
    drawn: !no(f['絵']),
    look: f['見た目'] ?? '',
    light: f['時間・光'] ?? f['時間'] ?? '',
    scenes: f['出てくる場面'] ?? '',
  }));
}
