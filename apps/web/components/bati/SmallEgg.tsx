'use client';

/**
 * The small glowing egg the first shell became (M-R218): drawn with shapes (no art yet — PROVISIONAL, P-BATI-EGGS).
 * `growth` 0..1 makes it a little bigger and brighter as the days pass; no number is ever shown.
 */
export function SmallEgg({
  growth = 0,
  size = 28,
  ready = false,
  className = '',
  light,
}: {
  growth?: number;
  size?: number;
  ready?: boolean;
  className?: string;
  /** SYS-S003: the moon's (white) and the sun's (gold) light taking turns ('alt'), or the chosen one soaked in */
  light?: 'alt' | 'moon' | 'sun';
}) {
  const g = Math.min(1, Math.max(0, growth));
  const s = size * (0.75 + 0.45 * g);
  const glow = 0.25 + 0.6 * g;
  return (
    <span
      aria-label="小さなたまご"
      className={`relative inline-block animate-[bob_3.2s_ease-in-out_infinite] ${className}`}
      style={{ width: s, height: s * 1.25 }}
    >
      <span
        className="absolute inset-0 animate-pulse rounded-full blur-md"
        style={{ background: `radial-gradient(circle, rgba(255,236,190,${glow}) 0%, rgba(255,214,140,0) 70%)`, transform: 'scale(1.8)' }}
      />
      <span
        className="absolute inset-0"
        style={{
          borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
          background: `radial-gradient(circle at 35% 30%, #fffdf4 0%, #f4e7c4 ${45 + 15 * g}%, #d9c08a 100%)`,
          boxShadow: `0 0 ${6 + 18 * g}px rgba(255,226,160,${0.4 + 0.5 * g})${ready ? ', 0 0 28px 6px rgba(255,240,200,0.9)' : ''}`,
        }}
      />
      {light && (
        <span
          className="absolute inset-0 mix-blend-screen"
          style={{
            borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
            background: light === 'sun' ? 'radial-gradient(circle at 50% 45%, rgba(255,196,80,0.85), rgba(255,160,40,0) 75%)' : 'radial-gradient(circle at 50% 45%, rgba(235,240,255,0.9), rgba(200,215,255,0) 75%)',
            animation: light === 'alt' ? 'eggLights 2.4s ease-in-out infinite' : 'fadeIn 1.2s ease-out',
          }}
        />
      )}
      {light === 'alt' && <style>{`@keyframes eggLights{0%,100%{background:radial-gradient(circle at 50% 45%,rgba(235,240,255,.9),rgba(200,215,255,0) 75%)}50%{background:radial-gradient(circle at 50% 45%,rgba(255,196,80,.85),rgba(255,160,40,0) 75%)}}`}</style>}
    </span>
  );
}

/**
 * M-R218: the broken shell glows, its pieces gather like star grains and become a thumb-sized egg on the altar —
 * over the chat, shapes only.
 */
export function ShellEggFx() {
  const bits = Array.from({ length: 9 }, (_, k) => k);
  return (
    <div className="pointer-events-none absolute inset-0 z-[45] overflow-hidden" aria-hidden>
      <div className="absolute left-1/2 top-[30svh] h-0 w-0">
        {bits.map((k) => {
          const a = (k / bits.length) * Math.PI * 2;
          return (
            <span
              key={k}
              className="absolute block h-2 w-3 rounded-sm bg-amber-50 shadow-[0_0_10px_rgba(255,236,190,0.9)]"
              style={
                {
                  '--fx': `${Math.cos(a) * 120}px`,
                  '--fy': `${Math.sin(a) * 90}px`,
                  animation: 'shellGather 2.2s ease-in forwards',
                  animationDelay: `${k * 0.06}s`,
                } as React.CSSProperties
              }
            />
          );
        })}
        <span className="absolute -translate-x-1/2 -translate-y-1/2 opacity-0" style={{ animation: 'fadeIn 0.8s ease-out 2s forwards' }}>
          <SmallEgg growth={0} size={30} />
        </span>
      </div>
      <style>{`@keyframes shellGather{0%{transform:translate(var(--fx),var(--fy)) rotate(40deg);opacity:0}25%{opacity:1}90%{opacity:1}100%{transform:translate(-50%,-50%) scale(.3);opacity:0}}`}</style>
    </div>
  );
}
