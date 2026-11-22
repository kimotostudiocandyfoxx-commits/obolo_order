'use client';

import { batiLineVoiceOf } from '@/lib/onboarding/batiLine';
import { JOURNEY_DONE, LAP2_DONE, lap2Done, lap2OpensAt } from '@obolo/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StoryPlayer, type StoryProgress } from '@/components/onboarding/StoryPlayer';
import { knownSealsOn, solvedSealsOn, stampsOn } from '@/components/onboarding/StoryExtras';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { lap2Steps } from '@/lib/onboarding/lap2';
import { realLessonApi } from '@/lib/onboarding/lessonApi';
import { madeFrom } from '@/lib/onboarding/made';
import { EggMorning } from '@/components/bati/EggMorning';
import { eggReady } from '@/components/bati/BatiSheet';

const key = (uid: string, chapter: number) => `obolo.after.${uid}.${chapter}`;
function load(k: string): StoryProgress | null {
  try {
    return JSON.parse(localStorage.getItem(k) ?? 'null') as StoryProgress | null;
  } catch {
    return null;
  }
}
function save(k: string, p: StoryProgress | null) {
  try {
    if (p) localStorage.setItem(k, JSON.stringify(p));
    else localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

/** the step answers that go to the server with the day (flags and short names; nothing long) */
const SENT = /^(f_m_|goods_|story_title|game_title)/;

/**
 * The days after joining as they are played (shared LAP2, lib/onboarding/after.ts): 天王星, 冥王星, 海王星 (+ the end),
 * one a day — each opens 24 hours after the one before was finished (`l2.at`; no skipping, M-R199). Before it opens
 * this leaves straight to the map (〔🚀〕 on the map shows when it opens). A day left in the middle resumes where it was.
 */
export function Lap2Story({ onLeave }: { onLeave: () => void }) {
  const { me, setMe } = useAuth();
  // the day this visit opened on (after it is saved, me.story moves on)
  const [chapter] = useState(() => lap2Done(me?.story));
  const opensAt = lap2OpensAt(me?.story);
  const waiting = opensAt !== null && Date.now() < opensAt;
  const k = me ? key(me.id, chapter) : '';
  const steps = useMemo(() => lap2Steps(chapter), [chapter]);
  const initial = useMemo<StoryProgress>(() => (k ? load(k) : null) ?? { i: 0, name: me?.displayName ?? '', answers: {} }, [k, me?.displayName]);
  const onProgress = useCallback((p: StoryProgress) => k && save(k, p), [k]);
  // M-R231: on the morning an egg is ready (the app's day 9 / 16), its scene (SYS-S003) plays first, then the day's story
  const [eggFirst, setEggFirst] = useState(() => eggReady(me));
  useEffect(() => {
    if (waiting && !eggFirst) onLeave();
  }, [waiting, eggFirst, onLeave]);

  if (eggFirst && me) return <EggMorning onClose={() => setEggFirst(false)} />;
  if (!me || !me.orderedAt || chapter >= LAP2_DONE || waiting) return null;
  return (
    <StoryPlayer
      key={chapter}
      steps={steps}
      vars={{
        name: me.displayName,
        inviter: me.invitedByName ?? '',
        neo: me.displayName,
        kimorinStar: true,
        bati: me.bati?.name ?? undefined,
        batiImage: me.bati?.imageUrl ?? undefined,
        batiFaces: me.bati?.faces,
        batiFood: me.bati?.food,
        // M-R215–M-R217: {bati}'s lines in its own manner, and its card
        batiSpeech: batiLineVoiceOf(me.bati),
        batiCard: me.bati?.card,
        look: me.avatarUrl ?? undefined,
        lookChibi: me.lookChibi ?? undefined,
        lookStandee: me.lookStandee ?? undefined,
        story: me.story,
        made: madeFrom(me.story),
      }}
      lessonApi={realLessonApi}
      seals={{ known: knownSealsOn(JOURNEY_DONE), solved: solvedSealsOn(JOURNEY_DONE, true) }}
      stamps={stampsOn(JOURNEY_DONE)}
      initial={initial}
      onProgress={onProgress}
      onName={async () => undefined}
      ordered
      onPause={() => setTimeout(onLeave, 1200)}
      onEnd={(answers) => {
        save(k, null);
        const made = Object.fromEntries(Object.entries(answers).filter(([q, v]) => SENT.test(q) && v.length <= 200));
        void getApi()
          .completeLap2(chapter, made)
          .then((u) => setMe(u))
          .catch(() => undefined)
          .finally(() => setTimeout(onLeave, 1200));
      }}
    />
  );
}
