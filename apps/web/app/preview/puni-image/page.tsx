import Link from 'next/link';
import { PuniImageStage } from '@/components/puni/PuniImageStage';

/** /preview/puni-image — painted characters warped onto the soft-body physics (prototype). */
export default function PuniImagePreviewPage() {
  return (
    <div className="fixed inset-0">
      <PuniImageStage />
      <Link href="/preview" className="fixed left-3 top-[calc(8px+env(safe-area-inset-top))] z-[400] rounded-full bg-black/45 px-3 py-1 text-xs text-white/80 backdrop-blur">
        ← 確認用ページ
      </Link>
    </div>
  );
}
