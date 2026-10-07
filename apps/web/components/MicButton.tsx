'use client';

/**
 * The big mic of every text box (client decision 2026-10-07: mic first). Tap = start / stop.
 * Shows what is being heard while listening and a short hint on how to fix a part.
 */
export function MicButton({
  listening,
  interim,
  supported,
  error,
  onToggle,
  size = 76,
}: {
  listening: boolean;
  interim: string;
  supported: boolean;
  error: 'denied' | 'failed' | null;
  onToggle: () => void;
  size?: number;
}) {
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={onToggle}
        disabled={!supported}
        aria-label={listening ? '録音をとめる' : '話して入力'}
        className={`relative flex items-center justify-center rounded-full text-white shadow-[0_6px_0_rgba(150,80,190,.35)] transition active:translate-y-0.5 disabled:opacity-40 ${
          listening ? 'bg-gradient-to-br from-rose-400 to-pink-500' : 'bg-gradient-to-br from-[#f39bd0] to-[#b58cff]'
        }`}
        style={{ width: size, height: size }}
      >
        {listening && <span className="absolute inset-0 animate-ping rounded-full bg-pink-400/40" />}
        {listening ? (
          <span className="relative block rounded-md bg-white" style={{ width: size * 0.3, height: size * 0.3 }} />
        ) : (
          <svg className="relative" width={size * 0.46} height={size * 0.46} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <rect x="8.5" y="3" width="7" height="12" rx="3.5" fill="currentColor" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        )}
      </button>
      <p className="mt-2 min-h-[1.25rem] text-center text-xs font-black text-violet-500">
        {!supported
          ? 'この端末では音声入力が使えないので、文字で入力してね'
          : error === 'denied'
            ? 'マイクを許可してね（設定 → Safari → マイク）'
            : error === 'failed'
              ? 'うまく聞き取れなかった…もう一度タップしてね'
              : listening
                ? interim || 'きいてるよ… 話しおわったら、もう一度タップ'
                : 'タップして話してね'}
      </p>
    </div>
  );
}
