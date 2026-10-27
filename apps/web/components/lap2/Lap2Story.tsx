'use client';

import { JOURNEY_DONE, LAP2, LAP2_DONE, lap2Done } from '@obolo/shared';
import { useCallback, useMemo, useState } from 'react';
import { StoryPlayer, type StoryProgress } from '@/components/onboarding/StoryPlayer';
import { knownSealsOn, solvedSealsOn, stampsOn } from '@/components/onboarding/StoryExtras';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { lap2Steps } from '@/lib/onboarding/lap2';
import { realLessonApi } from '@/lib/onboarding/lessonApi';
import { madeFrom } from '@/lib/onboarding/made';

const key = (uid: string, chapter: number, resumed: boolean) => `obolo.lap2.${uid}.${chapter}.${resumed ? 'r' : 'n'}`;
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

/** what the first journey and the earlier chapters decided, for the chapters' branches */
function carried(story: Record<string, string> | undefined): Record<string, string> {
  const s = story ?? {};
  const l2 = Object.fromEntries(Object.entries(s).filter(([k]) => k.startsWith('l2.') && k !== 'l2.done').map(([k, v]) => [k.replace(/^l2\./, 'l2_').replace(/\./g, '_'), v]));
  const made = ['l2_earth_look', 'l2_saturn_plaza', 'l2_jupiter_jacket', 'l2_mercury_place', 'l2_mars_theater', 'l2_venus_l2_synced', 'l2_uranus_goods', 'l2_neptune_road'].filter((k) => l2[k] && !['stay', 'later', 'none', 'skip'].includes(l2[k])).length;
  return {
    ...l2,
    l1_jacket: s['d4.f_d05_send'] ?? 'keep',
    l1_song: s['d5.f_d06_sail'] ?? 'keep',
    l1_dj: s['d7.f_d07v_mode'] ?? '',
    ...(s['d7.f_d07v_mode'] === 'self' ? { l2_synced: 'yes' } : {}),
    cards_many: made >= 4 ? 'yes' : 'no',
  };
}

/**
 * The second journey as it is played (shared LAP2, lib/onboarding/lap2): the chapter after the last one finished.
 * 〔(next)へ向かう〕 at a chapter's end goes straight on; 〔今日はここまで〕 saves and leaves to the map, and the next
 * open starts with that same choice. A chapter left in the middle (a pause, or the app closed) resumes where it was.
 */
export function Lap2Story({ onLeave }: { onLeave: () => void }) {
  const { me, setMe } = useAuth();
  const start = lap2Done(me?.story);
  const [at, setAt] = useState({ chapter: start, resumed: start > 0 });
  const k = me ? key(me.id, at.chapter, at.resumed) : '';
  const steps = useMemo(() => lap2Steps(at.chapter, at.resumed), [at]);
  const initial = useMemo<StoryProgress>(() => {
    const saved = k ? load(k) : null;
    return saved ?? { i: 0, name: me?.displayName ?? '', answers: carried(me?.story) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  const onProgress = useCallback((p: StoryProgress) => k && save(k, p), [k]);

  if (!me || !me.orderedAt || at.chapter >= LAP2_DONE) return null;
  const chapter = at.chapter;
  return (
    <StoryPlayer
      key={`${chapter}-${at.resumed}`}
      steps={steps}
      vars={{
        name: me.displayName,
        inviter: me.invitedByName ?? '',
        neo: me.displayName,
        kimorinStar: true,
        bati: me.bati?.name ?? undefined,
        batiImage: me.bati?.imageUrl ?? undefined,
        batiFood: me.bati?.food,
        look: me.avatarUrl ?? undefined,
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
        // opened again and left at once: nothing changes
        if (answers.l2resume === '今日はここまで') return setTimeout(onLeave, 600);
        const carriedKeys = new Set(Object.keys(carried(me.story)));
        const made = Object.fromEntries(Object.entries(answers).filter(([q, v]) => !carriedKeys.has(q) && !q.startsWith('l2resume') && q !== 'l2next' && v.length <= 200));
        const goOn = !!LAP2[chapter + 1] && answers.l2next === LAP2[chapter + 1].go;
        void getApi()
          .completeLap2(chapter, made)
          .then((u) => {
            setMe(u);
            if (goOn) setAt({ chapter: chapter + 1, resumed: false });
            else setTimeout(onLeave, 1200);
          })
          .catch(() => setTimeout(onLeave, 1200));
      }}
    />
  );
}
