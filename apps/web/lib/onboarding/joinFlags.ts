/**
 * The story flags of becoming Obolo Order early (M-R199 / M-R202), from the answers SYS-S002 saved — at the end of day 3
 * (`d3.*`) or from the settings (`sys.*`). Day 8 branches on them: f_join_early = 'true' when paid before day 8 (the
 * short おかえり, no decision, no payment), f_ej_heard = 'true' when the explanation was heard (said only once),
 * f_kimorin_back = 'due' until KIMORIN's one line after walking out has played (lib/onboarding/kimorinBack.ts).
 */
export function joinFlags(story: Record<string, string> | null | undefined): Record<string, string> {
  const s = story ?? {};
  const paid = s['d3.f_join_early_now'] === 'early' || s['sys.f_join_early_now'] === 'early';
  const heard = s['d3.f_ej_heard_now'] === 'true' || s['sys.f_ej_heard_now'] === 'true';
  // KIMORIN walked out of SYS-S002 (the first time): at his next appearance, once, 「……母に言いましたが、…」 (f_kimorin_back)
  const walked = s['d3.f_ej_first_now'] === 'true' || s['sys.f_ej_first_now'] === 'true';
  const said = Object.keys(s).some((k) => k.endsWith('.kimorin_back_shown'));
  return { ...(paid ? { f_join_early: 'true' } : {}), ...(heard ? { f_ej_heard: 'true' } : {}), ...(walked && !said ? { f_kimorin_back: 'due' } : {}) };
}
