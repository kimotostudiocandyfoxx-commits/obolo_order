import Link from 'next/link';
import { PuniStage } from '@/components/puni/PuniStage';

/** /preview/puni — the ぷにぷに character prototype (touch, squash, throw, wardrobe). */
export default function PuniPreviewPage() {
  return (
    <div className="fixed inset-0">
      <PuniStage />
      <Link href="/preview" className="fixed left-3 top-[calc(8px+env(safe-area-inset-top))] z-[400] rounded-full bg-black/45 px-3 py-1 text-xs text-white/80 backdrop-blur">
        ← 確認用ページ
      </Link>
    </div>
  );
}
