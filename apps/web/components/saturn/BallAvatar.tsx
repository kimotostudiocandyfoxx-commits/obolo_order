import { neoForm } from '@obolo/shared';

/** Deterministic colour from a string (for people without a NEO form yet). */
export function hueOf(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.codePointAt(0)!) % 360;
  return h;
}

/**
 * Round, chibi "ころりん" avatar used on Saturn. Placeholder art (P-SAT-3): a coloured ball with a
 * face and the NEO form's emblem as a little badge, until the client's deformed artwork exists.
 */
export function BallAvatar({ seed, neo, size, speaking = false }: { seed: string; neo?: string | null; size: number; speaking?: boolean }) {
  const form = neoForm(neo);
  const h = hueOf(seed);
  const base = form?.color ?? `hsl(${h} 65% 62%)`;
  const id = `g${hueOf(seed + (neo ?? ''))}`;
  return (
    <span className={`relative inline-block ${speaking ? 'animate-[wobble_0.6s_ease-in-out_infinite]' : ''}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
        <defs>
          <radialGradient id={id} cx="35%" cy="30%" r="75%">
            <stop offset="0" stopColor="#fff" stopOpacity=".55" />
            <stop offset=".35" stopColor={base} />
            <stop offset="1" stopColor={base} stopOpacity="1" />
          </radialGradient>
        </defs>
        <ellipse cx="50" cy="94" rx="30" ry="5" fill="#000" opacity=".18" />
        <circle cx="50" cy="52" r="42" fill={`url(#${id})`} />
        <circle cx="50" cy="52" r="42" fill="none" stroke="#000" strokeOpacity=".12" strokeWidth="2" />
        {/* face */}
        <ellipse cx="38" cy="54" rx="4" ry="5.5" fill="#2a2140" />
        <ellipse cx="62" cy="54" rx="4" ry="5.5" fill="#2a2140" />
        <circle cx="39.5" cy="52" r="1.4" fill="#fff" />
        <circle cx="63.5" cy="52" r="1.4" fill="#fff" />
        <ellipse cx="30" cy="63" rx="6" ry="3.5" fill="#ff7aa8" opacity=".55" />
        <ellipse cx="70" cy="63" rx="6" ry="3.5" fill="#ff7aa8" opacity=".55" />
        {speaking ? (
          <ellipse cx="50" cy="65" rx="5" ry="4" fill="#2a2140" />
        ) : (
          <path d="M44 63 q3 3 6 0 q3 3 6 0" fill="none" stroke="#2a2140" strokeWidth="2" strokeLinecap="round" />
        )}
      </svg>
      {form && (
        <span
          className="absolute -top-[6%] left-1/2 -translate-x-1/2 rounded-full bg-white/85 leading-none shadow"
          style={{ fontSize: size * 0.26, padding: size * 0.03 }}
          aria-hidden
        >
          {form.emoji}
        </span>
      )}
    </span>
  );
}
