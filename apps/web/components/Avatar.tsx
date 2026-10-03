export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  // Deterministic hue from the name — no avatar uploads in the demo.
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) % 360;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-black text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(135deg, hsl(${h} 80% 62%), hsl(${(h + 60) % 360} 70% 45%))`,
      }}
      aria-hidden
    >
      {[...name][0]?.toUpperCase() ?? '?'}
    </span>
  );
}
