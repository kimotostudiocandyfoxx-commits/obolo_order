/**
 * The story flags of becoming Obolo Order early (M-R199 / M-R202), from the answers SYS-S002 saved — at the end of day 3
 * (`d3.*`) or from the settings (`sys.*`). Day 8 branches on them: f_join_early = 'true' when paid before day 8 (the
 * short おかえり, no decision, no payment), f_ej_heard = 'true' when the explanation was heard (said only once).
 */
export function joinFlags(story: Record<string, string> | null | undefined): Record<string, string> {
  const s = story ?? {};
  const paid = s['d3.f_join_early_now'] === 'early' || s['sys.f_join_early_now'] === 'early';
  const heard = s['d3.f_ej_heard_now'] === 'true' || s['sys.f_ej_heard_now'] === 'true';
  return { ...(paid ? { f_join_early: 'true' } : {}), ...(heard ? { f_ej_heard: 'true' } : {}) };
}
