import type { Work } from '@/components/atelier/work';
import type { ViewItem } from '@/components/atelier/BluenaView';

/**
 * R16: the hand-offs between Bluena's viewer and {bati}'s talk, over the page (the talk may be hidden under the ダチ tab,
 * or not mounted yet: the work waits here until it is taken).
 *   〔バティといじる〕 → editWithBati(w): {bati}'s talk takes it as the work being changed (「どういじる？」)
 *   {bati} 「〇〇流して」 → openInBluena(item): the page opens the viewer (playing / reading at once)
 */
export const EDIT_EVENT = 'obolo:bati-edit';
export const VIEW_EVENT = 'obolo:bluena-view';

let queued: Work | null = null;
export function editWithBati(w: Work) {
  queued = w;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EDIT_EVENT));
}
/** the work waiting for {bati}'s talk (taken once) */
export function takeEdit(): Work | null {
  const w = queued;
  queued = null;
  return w;
}

export type ViewAsk = { item: ViewItem; autoplay?: boolean; autoOpen?: boolean };
export function openInBluena(a: ViewAsk) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<ViewAsk>(VIEW_EVENT, { detail: a }));
}
