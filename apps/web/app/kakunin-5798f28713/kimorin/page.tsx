'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Cast } from '@/components/story/Stage';
import { SERIF } from '@/components/story/parts';
import MOUTHS from '@/lib/story/sprite-mouths.json';

/**
 * /kakunin-5798f28713/kimorin — every KIMORIN pose of the story on the stage (client 2026-11-22): the repainted
 * pictures (scripts/kimorin/build.py), each with its mouth open as while speaking, to check that the mouth patch
 * lands on the mouth. 「口を閉じる」 shows them quiet.
 */
const LOOKS: [string, string, string][] = [
  ['kimorin-i', 'kimorin-i', '白衣・ゴーグル'],
  ['kimorin-iu', 'kimorin-iu', '白衣・ゴーグル上げ'],
  ['kimorin-sun', 'kimorin-xs', '赤いローブ・サングラス'],
];
const EXPRS = ['', 'talk', 'lecture', 'joy', 'point', 'shock', 'smug', 'tears', 'think', 'blush'];

export default function KimorinPage() {
  const [talking, setTalking] = useState(true);
  const loud = () => (talking ? 1 : 0);
  return (
    <main className="min-h-svh bg-[#07060d] pb-24 text-white" style={{ fontFamily: SERIF }}>
      <div className="mx-auto max-w-5xl px-4">
        <Link href="/kakunin-5798f28713" className="mt-3 inline-block text-xs text-white/50">
          ← 確認用ページ
        </Link>
        <h1 className="mt-4 text-center text-sm tracking-[0.5em] text-amber-200">KIMORIN の立ち絵と口</h1>
        <div className="mt-3 flex justify-center">
          <button onClick={() => setTalking((t) => !t)} className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70">
            {talking ? '口を閉じる' : '口を開ける'}
          </button>
        </div>
        {LOOKS.map(([sprite, stem, label]) => (
          <section key={sprite} className="mt-8">
            <h2 className="text-xs text-white/60">{label}</h2>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {EXPRS.map((e) => {
                const file = e ? `${stem}-${e}` : sprite;
                return (
                  <div key={e} data-pose={file} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-[#2a2a3a]">
                    <Cast names={[sprite]} src={() => `/onboarding/${sprite}.webp`} speaking={sprite} talking={talking} level={loud} expressions={e ? { [sprite]: e } : {}} slot={() => ({ left: '50%' })} />
                    <span className="absolute left-1 top-1 z-10 text-[10px] text-white/70">
                      {file}
                      {file in MOUTHS ? '' : ' (口の位置なし)'}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
