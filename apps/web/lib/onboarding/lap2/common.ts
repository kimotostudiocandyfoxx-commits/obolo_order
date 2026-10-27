import { LAP2 } from '@obolo/shared';
import type { Step } from '../script';

/**
 * The end of a second-journey chapter (L2-*-S00x 「〇〇が開いた」): 〔(next)へ向かう〕 goes on at once,
 * 〔今日はここまで〕 ends the day here; either way the chapter is saved, and the next open starts from this
 * same choice (resumeSteps). `l2next` holds the answer (components/onboarding/Lap2Story.tsx reads it).
 */
export function chapterEnd(chapter: number, stopLine: Step[] = [{ t: 'say', who: 'KIMORIN', text: 'では、私も今日はここまで。' }]): Step[] {
  const next = LAP2[chapter + 1];
  if (!next) return [{ t: 'end' }];
  return [
    { t: 'choice', key: 'l2next', options: [{ label: next.go, goto: 'l2go' }, { label: '今日はここまで', goto: 'l2stop' }] },
    { t: 'label', id: 'l2stop' },
    ...stopLine,
    { t: 'end' },
    { t: 'label', id: 'l2go' },
    { t: 'end' },
  ];
}

/** opened again after 〔今日はここまで〕: the same choice first (〔今日はここまで〕 again leaves without anything) */
export function resumeSteps(chapter: number): Step[] {
  const c = LAP2[chapter];
  if (!c?.go) return [];
  return [
    { t: 'bgm', track: 'space' },
    { t: 'choice', key: 'l2resume', options: [{ label: c.go }, { label: '今日はここまで', goto: 'l2quit' }] },
    { t: 'goto', id: 'l2begin' },
    { t: 'label', id: 'l2quit' },
    { t: 'end' },
    { t: 'label', id: 'l2begin' },
  ];
}

/** the rocket between planets (the 'go' of the chapter before) */
export function flight(arrive: string): Step[] {
  return [
    { t: 'bgm', track: 'space' },
    { t: 'se', sound: 'rocket' },
    { t: 'still', image: 's/rocket-space' },
    { t: 'wait', s: 1.2 },
    { t: 'se', sound: 'arrive' },
    { t: 'caption', text: arrive },
  ];
}
