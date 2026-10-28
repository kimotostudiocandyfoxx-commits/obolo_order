'use client';

/**
 * The {neo} owl (L2-URANUS-S004, M-R158(6)): a small owl whose face is {neo}'s, made small and round; it hugs a book
 * with both feet and carries it through the dachi's 〔推し〕 sky for 88 hours, then back to the library shelf.
 * KIMORIN⭐︎'s owl wears his round sunglasses and carries a thin book.
 */
export function NeoOwl({ face, title, size = 110, shades = false, flap = true, thin = false }: { face?: string; title?: string; size?: number; shades?: boolean; flap?: boolean; thin?: boolean }) {
  const head = size * 0.46;
  return (
    <div className="relative" style={{ width: size, height: size * 1.1 }}>
      {/* wings, flapping like turning pages */}
      {[-1, 1].map((side) => (
        <div
          key={side}
          className="absolute"
          style={{
            top: size * 0.3,
            width: size * 0.42,
            height: size * 0.5,
            left: side < 0 ? 0 : undefined,
            right: side > 0 ? 0 : undefined,
            transformOrigin: side < 0 ? '100% 20%' : '0% 20%',
            animation: flap ? 'owlFlap 0.42s ease-in-out infinite alternate' : undefined,
          }}
        >
          <svg viewBox="0 0 40 50" className="h-full w-full" style={{ transform: side < 0 ? 'scaleX(-1)' : undefined }}>
            <path d="M2 6 C 22 0, 40 14, 36 40 C 24 46, 8 34, 2 6 Z" fill="#9a6b45" stroke="#6b4428" strokeWidth="1.5" />
            <path d="M8 14 C 18 14, 28 22, 30 34" fill="none" stroke="#c99a6b" strokeWidth="1.5" />
            <path d="M8 22 C 16 22, 24 28, 26 38" fill="none" stroke="#c99a6b" strokeWidth="1.5" />
          </svg>
        </div>
      ))}
      {/* the body */}
      <div className="absolute left-1/2 -translate-x-1/2 rounded-[45%] border-2 border-[#6b4428] bg-[#b8875a]" style={{ top: size * 0.28, width: size * 0.5, height: size * 0.6 }}>
        <div className="absolute inset-x-[18%] bottom-[10%] top-[30%] rounded-[45%] bg-[#ecd9b8]" />
      </div>
      {/* the head: ear tufts and {neo}'s round face */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 0, width: head, height: head }}>
        <span className="absolute -left-[6%] -top-[10%] h-[34%] w-[26%] rotate-[-24deg] rounded-t-full bg-[#9a6b45]" />
        <span className="absolute -right-[6%] -top-[10%] h-[34%] w-[26%] rotate-[24deg] rounded-t-full bg-[#9a6b45]" />
        <div className="relative h-full w-full overflow-hidden rounded-full border-[3px] border-[#9a6b45] bg-amber-100 shadow-md">
          {face ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={face} alt="" className="h-full w-full object-cover object-top" />
          ) : (
            <span className="flex h-full w-full items-center justify-center" style={{ fontSize: head * 0.5 }}>
              🦉
            </span>
          )}
          {shades && (
            <svg viewBox="0 0 100 40" className="absolute left-[12%] top-[34%] w-[76%]">
              <circle cx="27" cy="20" r="16" fill="#151020" stroke="#ffd36f" strokeWidth="4" />
              <circle cx="73" cy="20" r="16" fill="#151020" stroke="#ffd36f" strokeWidth="4" />
              <path d="M43 18 Q50 13 57 18" fill="none" stroke="#ffd36f" strokeWidth="4" />
            </svg>
          )}
        </div>
      </div>
      {/* the book, hugged with both feet */}
      <div className="absolute left-1/2 -translate-x-1/2 rounded-sm border-l-4 border-amber-900 bg-[#fbf6ea] px-1 text-center font-serif font-bold leading-tight text-amber-950 shadow" style={{ top: size * 0.78, width: size * 0.5, height: thin ? size * 0.18 : size * 0.26, fontSize: Math.max(7, size * 0.07) }}>
        {title ? `『${title.slice(0, 8)}』` : ''}
      </div>
      <span className="absolute h-2 w-2 rounded-full bg-amber-500" style={{ top: size * 0.76, left: size * 0.36 }} />
      <span className="absolute h-2 w-2 rounded-full bg-amber-500" style={{ top: size * 0.76, right: size * 0.36 }} />
      <style>{'@keyframes owlFlap{from{transform:rotate(-18deg)}to{transform:rotate(16deg)}}'}</style>
    </div>
  );
}
