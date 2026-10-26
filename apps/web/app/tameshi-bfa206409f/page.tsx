'use client';

import { neoForm } from '@obolo/shared';
import { useEffect, useState } from 'react';
import { DemoDay } from '@/components/onboarding/DemoDay';
import { madeFrom } from '@/lib/onboarding/made';
import { STORIES } from '@/lib/onboarding/stories';

/**
 * The testers' link (client 2026-10-26: 15〜20歳の人に、一周目を通しで遊んでもらう). Day 1 → day 7 in order with
 * no server and no 24-hour wait: the name, the NEO, the Bati and what each day made carry over to the next
 * day, kept only in this browser. Nothing is sent or paid (the Eclipse payment is a demo). Separate from
 * the review pages (/kakunin-…), with no link to them.
 */
const KEY = 'obolo.tester.v1';
const LAST = 7;

interface Journey {
  day: number;
  name?: string;
  neoId?: string;
  neoName?: string;
  bati?: string;
  batiFood?: string;
  batiImage?: string;
  story: Record<string, string>;
}
const fresh = (): Journey => ({ day: 1, story: {} });

function load(): Journey {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) ?? '') as Journey;
    return j && typeof j.day === 'number' ? j : fresh();
  } catch {
    return fresh();
  }
}
function save(j: Journey) {
  try {
    localStorage.setItem(KEY, JSON.stringify(j));
  } catch {
    // private mode: the journey lasts as long as the page
  }
}

export default function TesterPage() {
  const [j, setJ] = useState<Journey | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => setJ(load()), []);
  const update = (patch: Partial<Journey>) =>
    setJ((x) => {
      const n = { ...(x ?? fresh()), ...patch };
      save(n);
      return n;
    });

  if (!j) return <main className="fixed inset-0 bg-black" />;
  const done = j.day > LAST;
  const story = STORIES[j.day];

  if (playing && story && !done) {
    return (
      <DemoDay
        key={j.day}
        day={j.day}
        steps={story.steps}
        vars={{
          name: j.name ?? '',
          inviter: 'ともだち',
          inviterMessage: '宇宙で待ってる✌️',
          neo: j.neoName ?? neoForm(j.neoId)?.name,
          bati: j.bati,
          batiFood: j.batiFood,
          batiImage: j.batiImage,
          kimorinStar: j.day >= 3,
          story: j.story,
          made: madeFrom(j.story),
        }}
        onName={(name) => update({ name })}
        onNeoForm={(neoId) => update({ neoId })}
        onNeoName={(neoName) => update({ neoName })}
        onBatiFood={(batiFood) => update({ batiFood })}
        onBatiName={(bati) => update({ bati })}
        onBati={(batiImage) => update({ batiImage })}
        onEnd={(answers) => {
          const kept = Object.fromEntries(Object.entries(answers).map(([k, v]) => [`d${j.day}.${k}`, v]));
          update({ day: j.day + 1, story: { ...j.story, ...kept } });
          setPlaying(false);
        }}
      />
    );
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-[#07060d] px-6 text-center text-white" style={{ fontFamily: '"Shippori Mincho", "Hiragino Mincho ProN", serif' }}>
      <p className="text-xs tracking-[0.5em] text-amber-200/70">Obolo Order</p>
      {done ? (
        <>
          <p className="text-xl tracking-[0.3em] text-amber-100">一周目の旅、おわり</p>
          <p className="text-sm leading-relaxed text-white/70">遊んでくれて、ありがとうございました。</p>
        </>
      ) : (
        <>
          <p className="text-3xl tracking-[0.3em] text-amber-100">{j.day}日目</p>
          <p className="text-xs leading-relaxed text-white/50">{j.day === 1 ? '音を出して遊んでください' : '24時間を飛ばして、次の日へ'}</p>
          <button onClick={() => setPlaying(true)} className="rounded-full border border-amber-200/50 bg-amber-200/10 px-8 py-3 text-base tracking-[0.2em] text-amber-100">
            {j.day === 1 ? 'はじめる' : 'つづける'}
          </button>
        </>
      )}
      {(j.day > 1 || done) && (
        <button
          onClick={() => {
            if (!window.confirm('最初からやり直しますか？　いままでの進み具合は消えます')) return;
            const n = fresh();
            save(n);
            setJ(n);
          }}
          className="mt-6 text-xs text-white/40 underline"
        >
          最初からやり直す
        </button>
      )}
    </main>
  );
}
