/**
 * The story flags of becoming Obolo Order early (M-R199 / M-R202), from the answers SYS-S002 saved — from the settings
 * (`sys.*`; M-R274: the end of day 3 no longer offers it, `d3.*` is still read for those who chose it there before). Day 8 branches on them: f_join_early = 'true' when paid before day 8 (the
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

/**
 * M-R274: 〔先にObolo Orderになる〕 in the settings — from the end of day 4 (Jupiter, where OBOLON first says the price)
 * to day 7; not once a member (day 8 decides it in the story itself).
 */
export function canJoinEarly(me: { orderedAt?: string | null; journeyDay: number; journeyCompletedAt: string | null }): boolean {
  if (me.orderedAt) return false;
  return (me.journeyDay > 4 || (me.journeyDay === 4 && !!me.journeyCompletedAt)) && me.journeyDay < 8;
}
