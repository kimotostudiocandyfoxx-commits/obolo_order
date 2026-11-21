import type { Step } from './script';

/**
 * SYS-S002 (M-R202): KIMORIN walked out to talk to his mother; at the start of the next scene he appears in, once:
 * 「……母に言いましたが、聞く耳を持ちません。調査は、続けます。」 Put before a day's first KIMORIN line (days 4–8).
 */
export function kimorinBack(day: number): Step[] {
  return [
    { t: 'branch', key: 'f_kimorin_back', cases: { due: `kb${day}` }, otherwise: `kb${day}-no` },
    { t: 'label', id: `kb${day}` },
    { t: 'say', who: 'KIMORIN', text: '……母に言いましたが、聞く耳を持ちません。調査は、続けます。' },
    { t: 'set', key: 'kimorin_back_shown', value: 'true' },
    { t: 'label', id: `kb${day}-no` },
  ];
}
