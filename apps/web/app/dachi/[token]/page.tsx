'use client';

import type { DachiLinkPeek } from '@obolo/shared';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * Opening a 〔🤝 ダチの招待状〕 (M-R175): the one who received the link (or read the QR) presses 〔ダチになる〕; the giver
 * is asked next, and only when both pressed it are they dachi. Only for people already in space (signed in).
 */
export default function DachiLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { me, status } = useAuth();
  const [peek, setPeek] = useState<DachiLinkPeek | null>(null);
  const [gone, setGone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!me) return;
    getApi()
      .peekDachiLink(token)
      .then(setPeek)
      .catch(() => setGone(true));
  }, [me, token]);

  const yes = async () => {
    setBusy(true);
    try {
      setPeek(await getApi().openDachiLink(token));
    } catch {
      setGone(true);
    }
    setBusy(false);
  };

  const box = (body: React.ReactNode) => (
    <main className="flex min-h-svh flex-col items-center justify-center gap-5 bg-[#07060d] px-8 text-center text-amber-50" style={{ fontFamily: '"Shippori Mincho", "Hiragino Mincho ProN", serif' }}>
      <p className="text-[12px] tracking-[0.4em] text-amber-200/80">🤝 ダチの招待状</p>
      {body}
      <Link href="/" className="text-[12px] text-white/50 underline">
        宇宙へもどる
      </Link>
    </main>
  );

  if (status === 'loading') return box(<p className="text-white/60">……</p>);
  if (!me) return box(<p className="text-[15px] leading-loose">ダチの招待状は、宇宙にいる人どうしのものです。<br />宇宙に入ってから、もう一度開いてね</p>);
  if (gone || peek?.state === 'gone') return box(<p className="text-[15px] leading-loose">このダチの招待状は、もう使えません</p>);
  if (!peek) return box(<p className="text-white/60">……</p>);
  if (peek.mine) return box(<p className="text-[15px] leading-loose">これは、あなたが渡したダチの招待状です。相手が開いて〔ダチになる〕を押すと、あなたにも聞きます</p>);
  if (peek.state === 'waiting')
    return box(<p className="text-[15px] leading-loose">{peek.from.displayName}にも、聞いています。<br />{peek.from.displayName}も〔ダチになる〕を押したら、ダチです</p>);
  return box(
    <>
      {peek.from.pic && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={peek.from.pic} alt="" className="h-24 w-24 rounded-full object-cover ring-2 ring-amber-200/60" />
      )}
      <p className="text-[16px] leading-loose">{peek.from.displayName}からの、ダチの招待状です</p>
      <button disabled={busy} onClick={() => void yes()} className="rounded-full border border-amber-200 bg-amber-200/15 px-8 py-3 text-[16px] tracking-[0.2em] shadow-[0_0_30px_rgba(255,214,140,0.4)]">
        ダチになる
      </button>
    </>,
  );
}
