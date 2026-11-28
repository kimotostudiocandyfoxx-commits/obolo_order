import { journeyWaitSkippable, JOURNEY_PAYMENT } from '@obolo/shared';
import { describe, expect, it } from 'vitest';
import { waitButtons } from '@/components/onboarding/TomorrowScreen';
import { STORIES } from './stories';
import { NO_SKIP_WAIT_WORDS, noSkipWaitWords, WAIT_DACHI_HREF, WAIT_SKIP_LABEL, WAIT_SKIPPED_TEXT } from './waitWords';

/** what HomeGate shows under the countdown after finishing `day` (with a hatched Bati) */
const shown = (day: number) => waitButtons({ canSkip: journeyWaitSkippable(day), noSkip: !!noSkipWaitWords(day, 'ポポ'), bati: true });

describe('the wait screen between days (client 2026-11-28)', () => {
  it('the skip button after every day but 3 and 7; those two show 〔{bati}と話す〕〔ダチのホームへ〕 instead', () => {
    const days = Array.from({ length: JOURNEY_PAYMENT }, (_, i) => i + 1);
    const withSkip = days.filter((d) => shown(d).includes('skip'));
    expect(withSkip).toEqual([1, 2, 4, 5, 6, 8, 9, 10, 11]);
    for (const d of [3, 7]) expect(shown(d)).toEqual(['bati', 'dachi']);
    expect(shown(4)).toEqual(['bati', 'skip']);
    // no Bati yet (day 1): the skip only
    expect(waitButtons({ canSkip: true, noSkip: false, bati: false })).toEqual(['skip']);
    expect(WAIT_DACHI_HREF).toBe('/moon/atelier?tab=dachi');
  });

  it('each no-skip wait has its own words, {bati} filled in, the countdown in the small line', () => {
    expect(Object.keys(NO_SKIP_WAIT_WORDS).map(Number)).toEqual([3, 7]);
    expect(NO_SKIP_WAIT_WORDS[3].text).not.toBe(NO_SKIP_WAIT_WORDS[7].text);
    const w3 = noSkipWaitWords(3, 'ポポ')!;
    expect(w3.text).toContain('ポポは、月の工房で');
    expect(w3.text).not.toContain('{bati}');
    expect(w3.until).toBe('次の星の門は、{残り時間}後に開きます');
    expect(noSkipWaitWords(7, 'ポポ')!.text).toContain('ポポも、楽しみにしているよ');
    for (const d of [1, 2, 4, 5, 6, 8, 9, 10, 11]) expect(noSkipWaitWords(d, 'ポポ')).toBeUndefined();
  });

  it('day 1 keeps its words (宇宙行きの切符が届くまで, 明日まで待てない); the other skips are 〔待ちきれない〕 + 「24時間スキップした」', () => {
    expect(STORIES[1].untilText).toBe('宇宙行きの切符が届くまで');
    expect(STORIES[1].skipLabel).toBe('明日まで待てない');
    expect(WAIT_SKIP_LABEL).toBe('待ちきれない');
    expect(WAIT_SKIPPED_TEXT).toBe('24時間スキップした');
  });
});
