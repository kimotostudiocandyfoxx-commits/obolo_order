'use client';

import { GLASS } from '@/components/talk/TalkScene';

/**
 * R10 (client): the Bluena device's button — the device's own art in a round glass button. It sits in one place
 * everywhere, within thumb reach: bottom left, beside the big mic (mirroring the ⌨ on the right); floating there on
 * the ダチ hall and plain (no mic there).
 */
export function DeviceButton({ onClick, floating = false }: { onClick: () => void; floating?: boolean }) {
  const button = (
    <button
      onClick={onClick}
      aria-label="ブルーナを開く"
      className={`${GLASS} overflow-hidden p-0 ${floating ? 'shadow-[0_4px_16px_rgba(0,0,0,.45)]' : ''}`}
      data-testid="bluena-device-button"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ui/bluena-icon.webp" alt="" className="h-full w-full scale-[1.3] rounded-full object-cover" />
    </button>
  );
  // (floating: in a wrapper of its own — GLASS is `relative`, which would win over an `absolute` on the button itself)
  return floating ? <div className="absolute bottom-[calc(14px+env(safe-area-inset-bottom))] left-3.5 z-[25]">{button}</div> : button;
}
