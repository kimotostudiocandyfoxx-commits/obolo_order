'use client';

import { jstDay, talkDays, type TalkDayView, type TalkLine } from '@obolo/shared';
import type { Talk } from '@/components/atelier/shelf';
import type { Msg } from '@/components/atelier/work';
import { getApi } from '@/lib/api';
import { markOf } from './marks';
import { dayOf } from './spiral';

/** the day a talk line falls on: Japan time on the server, the device's own day in the demo (as the API counts it) */
export const talkDayOf = (iso: string) => (getApi().mode === 'live' ? jstDay(iso) : dayOf(iso));

/** the words of one atelier message (a card: its title) */
export const msgText = (m: Msg) => (m.who === 'work' ? (m.work.title ?? m.work.prompt ?? '') : m.text);

/**
 * {bati}'s thread in the atelier is kept on this device (shelf.ts talks): each talk counts on the day it was last
 * spoken in; its lines' ★ / marks are kind 'local'.
 */
export function batiTalkDays(list: Talk[], f: { star?: boolean; mark?: TalkDayView['mark'] & string; q?: string }): TalkDayView[] {
  const lines: TalkLine[] = [];
  for (const t of list) t.msgs.forEach((m, k) => lines.push({ id: m.id, at: new Date(new Date(t.at).getTime() - (t.msgs.length - k)).toISOString(), who: m.who === 'me' ? 'me' : 'bati', text: msgText(m) }));
  return talkDays(lines, (id) => markOf('local', id), { star: f.star, mark: f.mark || undefined, q: f.q }, dayOf);
}

/** the messages of {bati}'s talks on one day, in order */
export function batiDayMsgs(list: Talk[], day: string): Msg[] {
  return list
    .filter((t) => dayOf(t.at) === day)
    .sort((a, b) => a.at.localeCompare(b.at))
    .flatMap((t) => t.msgs);
}
