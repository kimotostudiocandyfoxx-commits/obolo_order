'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { BATI_COLOR, batiLook, characterLook, colorOf, SELF_COLOR, selfLook } from '@/lib/talk/looks';
import { TALK_CSS } from './Figure';
import { Circle, Kororin, type TalkItem, type TalkPerson } from './TalkScene';

/**
 * D04-S005c (M-R233), over the story: the round rims of the talk's ring pop one by one, ぽん、ぽん, and the speakers'
 * コロリン roll out holding their word tags, lining up clockwise (yours, {inviter}'s / MIKIE⭐︎DRILL's, {bati}'s). The
 * story's 'fx: kororin-ring' step; the flag (d3.f_kororin_ring) is set by the step after it, so every talk's ring is
 * コロリン from here on.
 */
export function RingFx({ inviter: given }: { inviter?: string | null }) {
  const { me } = useAuth();
  const inviter = given ?? me?.invitedByName;
  const people: TalkPerson[] = [
    { id: 'me', name: me?.displayName ?? '', look: selfLook(me), color: SELF_COLOR, self: true, avatar: me?.lookIcon },
    inviter ? { id: 'them', name: inviter, look: null, color: colorOf(inviter) } : { id: 'them', name: 'MIKIE⭐︎DRILL', look: characterLook('mikie'), color: colorOf('mikie', 3) },
    { id: 'bati', name: me?.bati?.name ?? '', look: batiLook(me?.bati) ?? characterLook('kimorin'), color: BATI_COLOR },
  ];
  // the words said in the talks so far (a stand-in set: the story player does not keep the talk's lines)
  const items: TalkItem[] = [
    { id: 'a', who: 'them', text: 'ようこそ' },
    { id: 'b', who: 'bati', text: '声で返してみよう' },
    { id: 'c', who: 'me', text: 'ありがとう' },
    { id: 'd', who: 'bati', text: 'いつでも' },
    { id: 'e', who: 'me', text: 'はじめまして' },
    { id: 'f', who: 'them', text: '聞こえたわよ' },
  ];
  const by = new Map(people.map((p) => [p.id, p]));
  const [popAt, setPopAt] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setPopAt(Date.now()), 700);
    return () => clearTimeout(t);
  }, []);
  const slots = [0, 30, 60, 90, -60, -30];
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[9svh] z-[11] h-[30svh]" aria-hidden>
      <style>{TALK_CSS}</style>
      {items.map((it, k) => {
        const a = (slots[k] * Math.PI) / 180;
        return (
          <span key={it.id} className="absolute" style={{ left: `${50 + 40 * Math.sin(a)}%`, top: `${100 - 92 * Math.cos(a)}%`, transform: 'translate(-50%,-50%)' }}>
            {popAt ? <Kororin item={it} who={by.get(it.who)} k={k} popAt={popAt} reduced={false} /> : <Circle item={it} who={by.get(it.who)} />}
          </span>
        );
      })}
    </div>
  );
}
