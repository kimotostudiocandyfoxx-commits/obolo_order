import Link from 'next/link';
import { JOURNEY } from '@obolo/shared';
import { STORIES } from '@/lib/onboarding/stories';

/**
 * /preview — check each day's story on its own without walking the journey from day 1.
 * Nothing here touches the account's journey or story progress.
 */
export default function PreviewIndex() {
  const days = Object.keys(STORIES).map(Number).sort((a, b) => a - b);
  const jumps: { href: string; label: string }[] = [
    { href: '/preview/play?day=3&at=neo', label: '3日目：ネオの姿えらびから' },
    { href: '/preview/play?day=4&at=saturn', label: '4日目：ころりん（土星で遊ぶ）から' },
    { href: '/preview/play?day=5&at=jupiter', label: '5日目：パタパタ（木星で遊ぶ）から' },
    { href: '/preview/play?day=6&at=choice', label: '6日目：フリージーの質問（ある／ない）から' },
    { href: '/preview/play?day=6&at=mercury', label: '6日目：水星（船の海と島）から' },
    { href: '/preview/play?day=7&at=mars', label: '7日目：火星（UFOの星図とスタジオ）から' },
    { href: '/preview/play?day=8&at=venus', label: '8日目：金星（マーケット）から' },
    { href: '/preview/play?day=9&at=choice', label: '9日目：MONBANの「月88円」から（支払いはデモ）' },
    { href: '/preview/puni', label: 'ぷにぷにキャラの試作（つつく・投げる・着せ替え）' },
    { href: '/preview/puni-image', label: 'ぷにぷにキャラの試作（絵のキャラ版・メッシュ変形）' },
    { href: '/preview/play?world=venus', label: '金星だけ（チュートリアルなし）' },
    { href: '/preview/play?world=mars', label: '火星だけ（チュートリアルなし）' },
    { href: '/preview/play?world=mercury', label: '水星だけ（チュートリアルなし）' },
    { href: '/preview/play?world=saturn', label: '土星ころりんだけ（チュートリアルなし）' },
    { href: '/preview/play?world=jupiter', label: '木星パタパタだけ（チュートリアルなし）' },
  ];
  return (
    <main className="min-h-svh bg-[#07060d] px-5 pb-16 pt-[calc(24px+env(safe-area-inset-top))] text-white">
      <h1 className="text-center text-lg tracking-[0.4em] text-amber-100">確認用ページ</h1>
      <p className="mt-2 text-center text-xs text-white/50">日ごとにストーリーを確認できます。アカウントの進み具合には影響しません。</p>
      <h2 className="mb-2 mt-8 text-xs tracking-widest text-white/50">日ごとに最初から</h2>
      <div className="grid gap-2">
        {days.map((d) => (
          <Link key={d} href={`/preview/play?day=${d}`} className="rounded-2xl border border-amber-200/30 bg-white/5 px-4 py-3">
            <span className="text-amber-100">{d}日目</span>
            <span className="ml-3 text-sm text-white/70">{JOURNEY.find((j) => j.day === d)?.title ?? (d === 9 ? 'エクリプス（ORDERへ）' : '')}</span>
          </Link>
        ))}
      </div>
      <h2 className="mb-2 mt-8 text-xs tracking-widest text-white/50">途中から</h2>
      <div className="grid gap-2">
        {jumps.map((j) => (
          <Link key={j.href} href={j.href} className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm">
            {j.label}
          </Link>
        ))}
      </div>
    </main>
  );
}
