import Link from 'next/link';
import { JOURNEY } from '@obolo/shared';
import { PREVIEW_ONLY, STORIES } from '@/lib/onboarding/stories';

/**
 * /preview — check each day's story on its own without walking the journey from day 1.
 * Nothing here touches the account's journey or story progress.
 */
export default function PreviewIndex() {
  const days = Object.keys({ ...STORIES, ...PREVIEW_ONLY }).map(Number).sort((a, b) => a - b);
  const jumps: { href: string; label: string }[] = [
    { href: '/preview/parts', label: '✨ 物語の部品（会話の枠・名前札・テロップ・選択肢・ボタン・舞台）' },
    { href: '/preview/play?day=1', label: '1日目：冒頭（招待状からMONBANまで）の試作' },
    { href: '/preview/dj', label: '🎧 金星 DJ（音声エンジンの仮画面・横向き）' },
    { href: '/preview/story', label: '📖 新しい物語の台本（全場面・どの場面からでも／戻る・演出メモ）' },
    { href: '/preview/story-assets', label: '🎨 物語の素材（人物・場所・声・効果音／候補の見比べ）' },
    { href: '/preview/play?day=2&at=look', label: '2日目：月の神殿・ネオの姿づくりから' },
    { href: '/preview/play?day=2&at=egg', label: '2日目：バティ誕生から' },
    { href: '/preview/play?day=2&at=pause', label: '2日目：「やめておく」（その日を終える）' },
    { href: '/preview/play?day=1&at=riddles', label: '1日目：8つの謎の札から' },
    { href: '/preview/play?day=3&at=screen', label: '3日目：Bluenaの投影から' },
    { href: '/preview/play?day=3&at=screen&timeup=1', label: '3日目：88分を過ぎたとき（20秒後に割りこみ）' },
    { href: '/preview/play?day=3&at=seal', label: '3日目：謎2が解けるところから' },
    { href: '/preview/play?day=3&at=saturn', label: '3日目：コロリン（本物のころりんぱで、つぶやいて自分の部屋へ）から' },
    { href: '/preview/play?day=4&at=jupiter', label: '4日目：木星（コロリン2つからシール→シール帳→シール蝶）から' },
    { href: '/preview/play?day=5&at=mercury', label: '5日目：水星（シールから歌→ジャケットが回る）から' },
    { href: '/preview/play?day=6&at=mars', label: '6日目：火星（曲にMV→▶で見る→裏スタジオ）から' },
    { href: '/preview/play?day=6&at=made', label: '6日目：大スクリーンにMVを映すところから' },
    { href: '/preview/play?day=7&at=ticket', label: '7日目：地球でORDERになるか決めるところから（支払いはデモ）' },
    { href: '/preview/play?day=7&at=branch', label: '7日目：太陽の神殿から' },
    { href: '/preview/play?day=7&at=made', label: '7日目：上映「7日間」から' },
    { href: '/preview/play?day=8', label: '（一周目には出ない）金星：ゴリラ3人組（旧8日目の台本）' },
    { href: '/preview/puni-image', label: 'ぷにぷにキャラの試作（絵のキャラ版・メッシュ変形）' },
    { href: '/preview/robot', label: 'ロボット声のテスト（土星チュートリアル用：録音→ロボット声で再生）' },
    { href: '/preview/play?world=mars', label: '火星だけ（チュートリアルなし）' },
    { href: '/preview/play?world=mercury', label: '水星だけ（チュートリアルなし）' },
    { href: '/preview/play?world=saturn', label: '土星ころりんぱだけ（チュートリアルなし）' },
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
            <span className="ml-3 text-sm text-white/70">{JOURNEY.find((j) => j.day === d)?.title ?? (d === 7 ? 'エクリプス（ORDERへ）' : d === 8 ? '金星（一周目には出ない・旧台本）' : '')}</span>
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
