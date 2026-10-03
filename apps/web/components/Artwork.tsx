import type { CSSProperties, ReactNode } from 'react';

/** Generated square cover art (spec §1.1: everything is SQUARE). No image files needed. */
export function Artwork({
  hue,
  hue2,
  emoji,
  className = '',
  animated = false,
  children,
}: {
  hue: number;
  hue2?: number;
  emoji: string;
  className?: string;
  animated?: boolean;
  children?: ReactNode;
}) {
  const h2 = hue2 ?? (hue + 50) % 360;
  const style: CSSProperties = {
    background: `
      radial-gradient(circle at 75% 20%, hsl(${(hue + 30) % 360} 90% 75% / 0.55), transparent 40%),
      radial-gradient(circle at 20% 85%, hsl(${h2} 85% 60% / 0.6), transparent 45%),
      linear-gradient(135deg, hsl(${hue} 70% 35%), hsl(${h2} 65% 18%))`,
    backgroundSize: animated ? '200% 200%' : undefined,
  };
  return (
    <div className={`square relative overflow-hidden ${animated ? 'animate-[pan_8s_ease-in-out_infinite_alternate]' : ''} ${className}`} style={style}>
      <div className="absolute inset-0 flex items-center justify-center" style={{ containerType: 'size' } as CSSProperties}>
        <span className={`drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)] ${animated ? 'animate-[bob_3s_ease-in-out_infinite]' : ''}`} style={{ fontSize: 'min(42cqw, 42cqh)' }}>
          {emoji}
        </span>
      </div>
      {children}
    </div>
  );
}
