'use client';

import { useState } from 'react';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { selfTone, TALK_COLOR_KEY, type TalkTone } from '@/lib/talk/looks';

/**
 * M-R245: your bubble colour — picked once, at the first talk (月光パール until then), kept with your account
 * (Me.story 'sys.talk_color'); changeable in the settings. `ask`: the one-time picker should show.
 */
export function useTalkTone(): { tone: TalkTone; ask: boolean; pick: (id: string) => void } {
  const { me, setMe } = useAuth();
  const [local, setLocal] = useState<string | null>(null);
  const picked = local ?? me?.story?.[TALK_COLOR_KEY];
  const tone = selfTone(picked ? ({ ...(me ?? {}), story: { ...(me?.story ?? {}), [TALK_COLOR_KEY]: picked } } as never) : me);
  const pick = (id: string) => {
    setLocal(id);
    void getApi()
      .saveSysStory({ [TALK_COLOR_KEY.replace(/^sys\./, '')]: id })
      .then(setMe)
      .catch(() => undefined);
  };
  return { tone, ask: !!me && !picked, pick };
}
