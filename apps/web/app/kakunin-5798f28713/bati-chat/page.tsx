'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BatiChat } from '@/components/onboarding/BatiChat';
import { unlockSfx } from '@/components/onboarding/StoryExtras';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { demoBati } from '@/lib/look';

/**
 * /kakunin-5798f28713/bati-chat — only the first talk with {bati} (D03-S008: five rounds, read aloud), as many times as
 * wanted. Logged in: your own {bati}, answered for real (each try counts toward the day's 30 messages); otherwise the
 * stand-in {bati} of the browser's demo.
 */
export default function BatiChatCheck() {
  const { me, status } = useAuth();
  const [round, setRound] = useState(0);
  const [on, setOn] = useState(false);
  if (status === 'loading') return <div className="fixed inset-0 bg-black" />;
  const live = getApi().mode === 'live';
  if (live && !me)
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-black px-8 text-center text-amber-50">
        <p>バティと話すには、先にログインしてください（自分のバティで、本番と同じ答えと声になります）。</p>
        <Link href="/" className="rounded-full border border-amber-200/70 px-6 py-3">
          ログインへ
        </Link>
        <Link href="/kakunin-5798f28713" className="text-sm text-white/50">
          ← 確認用ページ
        </Link>
      </main>
    );
  if (!on)
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-5 bg-black px-8 text-center text-amber-50">
        <p className="text-lg tracking-widest">はじめての、おしゃべり</p>
        <p className="text-sm text-white/60">{me?.bati?.name ?? 'バティ'}と5回話すと、あくびをして終わります。何度でもためせます。</p>
        <button
          className="rounded-full border border-amber-200/70 px-8 py-3.5 tracking-[0.2em]"
          onClick={() => {
            unlockSfx();
            setOn(true);
          }}
        >
          ▶ はじめる
        </button>
        <Link href="/kakunin-5798f28713" className="text-sm text-white/50">
          ← 確認用ページ
        </Link>
      </main>
    );
  return (
    <div className="fixed inset-0 bg-black">
      <BatiChat
        key={round}
        bati={me?.bati?.name ?? 'ぽん'}
        neo={me?.displayName ?? 'あなた'}
        image={me?.bati?.imageUrl ?? demoBati(me?.bati?.food ?? 'ラーメン')}
        faces={me?.bati?.faces}
        first
        me={me?.avatarUrl ?? undefined}
        onDone={() => {
          setOn(false);
          setRound((r) => r + 1);
        }}
      />
    </div>
  );
}
