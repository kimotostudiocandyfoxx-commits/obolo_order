'use client';

import { useCallback, useRef, useState } from 'react';

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 1800);
  }, []);
  const node = msg ? (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(24px+env(safe-area-inset-bottom))] z-50 flex justify-center">
      <div className="rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-slate-900 shadow-xl">{msg}</div>
    </div>
  ) : null;
  return { show, node };
}
