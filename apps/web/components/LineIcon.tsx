import type { SVGProps } from 'react';

/**
 * Small line marks for buttons whose only visual used to be an emoji (the client: emoji look cheap).
 * Same hand as components/bluena/glyphs.tsx: thin strokes of one weight, currentColor, decorative
 * (the button keeps its own aria-label or text).
 */
export type LineIconId = 'moon' | 'mic' | 'micOff' | 'keyboard' | 'lock' | 'unlock' | 'bell' | 'bellOff' | 'phone' | 'phoneOff' | 'gear' | 'chat' | 'camera' | 'tool' | 'mail' | 'phoneDevice' | 'pencil' | 'compass' | 'arrowDown';

const PATHS: Record<LineIconId, React.ReactNode> = {
  moon: <path d="M15.5 3.5a8.5 8.5 0 1 0 5 13.6A7 7 0 0 1 15.5 3.5z" />,
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
    </>
  ),
  micOff: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7M4 4l16 16" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6 10h0M9 10h0M12 10h0M15 10h0M18 10h0M6 13h0M18 13h0M8.5 14.5h7" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="1.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  unlock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="1.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7" />
    </>
  ),
  bell: <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15zM10 20.5a2 2 0 0 0 4 0" />,
  bellOff: <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15zM10 20.5a2 2 0 0 0 4 0M4 4l16 16" />,
  phone: <path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2 4 1.5V19a1.5 1.5 0 0 1-1.5 1.5A15.5 15.5 0 0 1 3.5 5.5 1.5 1.5 0 0 1 5 4z" />,
  phoneOff: <path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2 4 1.5V19a1.5 1.5 0 0 1-1.5 1.5A15.5 15.5 0 0 1 3.5 5.5 1.5 1.5 0 0 1 5 4zM4 20L20 4" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </>
  ),
  chat: <path d="M4 5h16v11H10l-5 4v-4H4z" />,
  camera: (
    <>
      <rect x="3" y="7" width="13" height="10" rx="1.5" />
      <path d="M16 10.5l5-3v9l-5-3" />
    </>
  ),
  tool: <path d="M14.5 4a4.5 4.5 0 0 0-4.3 5.8L3.5 16.5l4 4 6.7-6.7A4.5 4.5 0 0 0 20 9.5l-3 3-3.5-1-1-3.5 3-3a4.5 4.5 0 0 0-1-1z" />,
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
      <path d="M3.5 6.5l8.5 7 8.5-7" />
    </>
  ),
  phoneDevice: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M11 18.5h2" />
    </>
  ),
  pencil: <path d="M4 20l1-4.5L15.5 5l3.5 3.5L8.5 19zM13.5 7l3.5 3.5" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  arrowDown: <path d="M12 4v15M6 13l6 6 6-6" />,
};

export function LineIcon({ id, className = 'h-6 w-6', ...rest }: { id: LineIconId } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {PATHS[id]}
    </svg>
  );
}
