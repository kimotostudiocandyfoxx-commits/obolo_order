'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Cast, Motes } from '@/components/story/Stage';
import { ActionButton, Choice, DecisionButton, DialogueWindow, FieldFrame, IconButton, MixerPanel, SERIF, Telop } from '@/components/story/parts';
import { DEFAULT_MIX } from '@/lib/story/lineVoice';

/**
 * /preview/parts — the story's UI parts on one page (production UI 6, 2026-10-15): the dialogue window and
 * name plate, titles, choices, the action button, the text box, the icon buttons, the mixer, and the stage
 * (the speaker lit, the others in the dark; the bust-up when several are on stage).
 */
export default function PartsPage() {
  const [picked, setPicked] = useState<string | null>(null);
  const [mix, setMix] = useState(DEFAULT_MIX);
  const [speaker, setSpeaker] = useState<string | null>(null);
  const [name, setName] = useState('');
  const sprite = (n: string) => `/onboarding/${n}.webp`;
  return (
    <main className="min-h-svh bg-[#07060d] pb-24 text-white" style={{ fontFamily: SERIF }}>
      <div className="mx-auto max-w-xl px-4">
        <Link href="/preview" className="mt-3 inline-block text-xs text-white/50">
          ← 確認用ページ
        </Link>
        <h1 className="mt-4 text-center text-sm tracking-[0.5em] text-amber-200">物語の部品</h1>

        <Section title="テロップ：映画の字幕のように（枠も帯もなし）">
          <Telop text="1日目" />
          <div className="h-3" />
          <Telop text="MONBANが現れた" />
        </Section>

        <Section title="セリフ：絵を隠さない薄い帯と、小さな名前（画面のどこをタップしても進む）">
          <div className="pt-2">
            <DialogueWindow name="MONBAN" done>
              誰だお前…ここは秘密結社だ…。
            </DialogueWindow>
          </div>
          <div className="mt-8">
            <DialogueWindow name="OBOLON">{'“OBOLO ORDER”\nそれは、新しい何かを、生み出す者達'}</DialogueWindow>
          </div>

        </Section>

        <Section title="選択肢：自分の側から出る小さな吹き出し（押すと、それが自分のセリフになる）">
          <div className="flex flex-col items-end gap-2">
            {['行きたい', '行きたくない', 'まだわかんない'].map((o, k) => (
              <Choice key={o} k={k} hint={k === 0 && !picked} on={picked === o} onClick={() => setPicked(o)}>
                {o}
              </Choice>
            ))}
          </div>
        </Section>

        <Section title="物語の中の行動も、同じ吹き出し">
          <div className="flex flex-col items-end gap-2">
            <ActionButton>封を開く</ActionButton>
            <ActionButton>門をくぐり、地球の神殿に向かう</ActionButton>
          </div>
        </Section>

        <Section title="大きくはっきりしたボタンは「決断の瞬間」だけ（支払い・声の使い方の同意）">
          <div className="mx-auto max-w-sm">
            <DecisionButton>支払う</DecisionButton>
          </div>
        </Section>

        <Section title="文字の入力（土星に着くまでは文字だけ）">
          <div className="mx-auto max-w-sm">
            <FieldFrame>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="名前" className="w-full bg-transparent py-1.5 text-center text-[18px] tracking-widest text-amber-50 outline-none placeholder:text-white/35" />
            </FieldFrame>
            <div className="mt-3 flex justify-end">
              <ActionButton disabled={!name.trim()}>名乗る</ActionButton>
            </div>
          </div>
        </Section>

        <Section title="すみの小さな印（謎の書・音の大きさ・音のオン／オフ）。演出が流れている間は消える">
          <div className="flex justify-center gap-4">
            <IconButton icon="book" label="謎の書" onClick={() => undefined} />
            <IconButton icon="mixer" label="音の大きさ" onClick={() => undefined} />
            <IconButton icon="sound" label="音を消す" onClick={() => undefined} />
            <IconButton icon="mute" label="音を出す" onClick={() => undefined} />
          </div>
        </Section>

        <Section title="音の大きさ">
          <div className="flex justify-center">
            <MixerPanel mix={mix} onChange={setMix} />
          </div>
        </Section>

        <Section title="舞台：話している人だけ明るく、ふだんは引きの絵／話すとバストアップ">
          <div className="mb-3 flex justify-center gap-2">
            {[null, 'たこ焼きブラザー', 'たこ焼きシスター'].map((w) => (
              <button key={w ?? 'none'} onClick={() => setSpeaker(w)} className={`rounded-full border px-3 py-1 text-xs ${speaker === w ? 'border-amber-200 text-amber-100' : 'border-white/20 text-white/60'}`}>
                {w ?? '引きの絵'}
              </button>
            ))}
          </div>
          <div className="relative mx-auto aspect-[9/16] w-full max-w-[360px] overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/onboarding/s/saturn-inside.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
            <Motes count={30} />
            <Cast
              names={['takoyaki-brother', 'takoyaki-sister']}
              src={sprite}
              speaking={speaker === 'たこ焼きブラザー' ? 'takoyaki-brother' : speaker === 'たこ焼きシスター' ? 'takoyaki-sister' : null}
              talking={!!speaker}
              slot={(k, n) => ({ left: `${50 - 22 + (44 * k) / Math.max(1, n - 1)}%` })}
            />
            {speaker && (
              <div className="absolute inset-x-2 bottom-3 z-10">
                <DialogueWindow name={speaker} done>
                  {speaker === 'たこ焼きブラザー' ? 'ひとこと吹きこむだけだZE。裏声でも、変な声でも、いいZE!!' : '遊ぶ前に、まずは、声を作るわ。'}
                </DialogueWindow>
              </div>
            )}
          </div>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <p className="mb-4 text-center text-[11px] tracking-[0.3em] text-white/45">{title}</p>
      {children}
    </section>
  );
}
