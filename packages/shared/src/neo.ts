/**
 * OBOLO NEO — the apprentice form every newcomer takes on Day 3 (client decision 2026-10-04).
 * Members choose one of eight prepared forms; the real, self-created form comes after they become
 * ORDER. PLACEHOLDER (P-NEO-1): names, motifs and colours are provisional until the client's
 * artwork arrives (public/onboarding/neo-<id>.webp replaces the placeholder emblem automatically).
 */
export interface NeoForm {
  id: string;
  name: string;
  /** Placeholder emblem until the artwork exists. */
  emoji: string;
  /** Accent colour for the placeholder emblem. */
  color: string;
  /** One-line flavour text shown when previewing the form. */
  line: string;
}

export const NEO_FORMS: readonly NeoForm[] = [
  { id: 'kitsune', name: 'キツネ', emoji: '🦊', color: '#ff8a4c', line: '気まぐれで、ひらめきに強い。' },
  { id: 'usagi', name: 'ウサギ', emoji: '🐰', color: '#f7b7d2', line: '耳がいい。音を拾うのが得意。' },
  { id: 'neko', name: 'ネコ', emoji: '🐱', color: '#ffd36b', line: '自由。好きなものに一直線。' },
  { id: 'ookami', name: 'オオカミ', emoji: '🐺', color: '#9fb3c8', line: '仲間思い。遠くまで声が届く。' },
  { id: 'fukurou', name: 'フクロウ', emoji: '🦉', color: '#c9a36b', line: '夜に強い。じっと見て、深く考える。' },
  { id: 'ryu', name: 'リュウ', emoji: '🐉', color: '#5fd3a5', line: '大きな夢を、形にする。' },
  { id: 'kuma', name: 'クマ', emoji: '🐻', color: '#b07a52', line: 'あたたかい。そばにいると安心する。' },
  { id: 'shika', name: 'シカ', emoji: '🦌', color: '#a7d8ff', line: '静かで、美しいものに敏感。' },
];

export const NEO_FORM_IDS = NEO_FORMS.map((f) => f.id) as [string, ...string[]];

export function neoForm(id: string | null | undefined): NeoForm | undefined {
  return NEO_FORMS.find((f) => f.id === id);
}
