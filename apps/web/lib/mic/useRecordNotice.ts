'use client';

import { useEffect, useState } from 'react';
import { recordNoticeOnce } from './core';

/**
 * Story chat 2026-11-27: the first time (on this device, anywhere in the app) a take is sent to the server to be made
 * into words, one line says the voice is not kept. True while that first listening goes on; false ever after.
 */
export function useRecordNotice(listening: boolean, engine: string | null | undefined): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (listening && engine === 'record') {
      if (recordNoticeOnce()) setShow(true);
    } else if (!listening) setShow(false);
  }, [listening, engine]);
  return show;
}
