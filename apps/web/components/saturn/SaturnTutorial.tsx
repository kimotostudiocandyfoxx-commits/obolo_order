'use client';

import { useEffect, useRef, useState } from 'react';
import { spriteUrl } from '@/lib/onboarding/media';
import { decodeVoice, playRobot, stopRobot, TUTORIAL_ROBOT, unlockRobot } from '@/lib/robotVoice';
import { useRecorder } from '@/lib/useRecorder';
import { KororinWorld } from './KororinWorld';

/**
 * Day 4 tutorial on top of ころりん, coached by たこ焼きブラザー / たこ焼きシスター.
 * Steps: listen to a voice → give a star → write something and have it read in the NEO voice
 * (speak into the mic → Bati reads it) → the registered Bati voice later → done.
 * Before posting, KIMORIN checks you are human (client idea 2026-10-07, P-SAT-16): you say
 * 「俺は人間だ。信じてくれ。本当に人間なんだ。」 into the mic … and it plays back as a robot.
 * PLACEHOLDER (P-OB-13): provisional lines by Claude.
 */
type Who = 'brother' | 'sister' | 'kimorin';
// Endings (client, 2026-10-04): ブラザー → 「だZE!!」/「ZE!!」, シスター → 「わ。」
const HUMAN_LINE = '俺は人間だ。信じてくれ。本当に人間なんだ。';

const STEPS: { who: Who; text: string; wait: 'listen' | 'star' | 'robot' | 'post' | 'next' | 'done' }[] = [
  { who: 'sister', text: 'ころころしてるのは、ぜんぶ、みんなの声だわ。\nひとつ、さわってみるといいわ。', wait: 'listen' },
  { who: 'brother', text: 'な？ 声で聞くと、気持ちがぜんぶ伝わるだろ？\nこれが土星だZE!!', wait: 'next' },
  { who: 'sister', text: 'いいなと思ったら、星をあげるといいわ。\n星は、そのまま気持ちになって届くわ。', wait: 'star' },
  { who: 'kimorin', text: 'ちょっと待つケン！\nお前、さては……ロボットじゃないだろうな？', wait: 'next' },
  { who: 'kimorin', text: `ちゃんと人間か、確かめる必要があるケン。\nマイクに向かって、こう言え！\n「${HUMAN_LINE}」`, wait: 'robot' },
  { who: 'kimorin', text: '……怪しいなあ。\nよし、もうちょっとやるぞ。', wait: 'next' },
  { who: 'sister', text: '試しに呟いてみたらいいわ。', wait: 'post' },
  { who: 'brother', text: 'マイクを押して話すだけで、文字になるんだZE!!\nそれを、バティが読んでくれるZE!!', wait: 'next' },
  { who: 'sister', text: 'バティの声を登録したら、\nあなたのバティの声で読んでくれるわ。', wait: 'next' },
  { who: 'sister', text: 'あなたの声が、土星にころがったわ。\nこれが土星の遊び方だわ。', wait: 'done' },
];

const NAMES: Record<Who, string> = { brother: 'たこ焼きブラザー', sister: 'たこ焼きシスター', kimorin: 'KIMORIN' };
const SPRITES: Record<Who, string> = { brother: 'takoyaki-brother', sister: 'takoyaki-sister', kimorin: 'kimorin-3' };

export function SaturnTutorial({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const advanceOn = (w: typeof step.wait) => setI((cur) => (STEPS[cur]?.wait === w ? cur + 1 : cur));

  return (
    <div className="fixed inset-0 z-[150]">
      <KororinWorld
        neoOnly
        highlightDrop={step?.wait === 'post'}
        events={{ onListen: () => advanceOn('listen'), onStar: () => advanceOn('star'), onPosted: () => advanceOn('post') }}
        overlay={
          step && (
            <div className="pointer-events-none absolute inset-x-0 top-[calc(132px+env(safe-area-inset-top))] z-[200] flex justify-center px-3">
              <div className="pointer-events-auto flex w-full max-w-md items-end gap-2 animate-[fadeUp_0.4s_ease-out]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={spriteUrl(SPRITES[step.who])} alt="" className="h-28 w-auto shrink-0 drop-shadow-xl" aria-hidden />
                <div className="relative mb-2 flex-1 rounded-2xl bg-white/95 p-3 text-slate-800 shadow-xl">
                  <p className="text-[11px] font-black text-violet-500">{NAMES[step.who]}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[15px] font-bold leading-snug">{step.text}</p>
                  <div className="mt-2 flex items-center justify-end gap-3">
                    {step.wait === 'robot' && <HumanCheck onDone={() => setI(i + 1)} />}
                    {step.wait === 'post' && <span className="animate-pulse text-[11px] font-bold text-pink-500">👇「声をおとす」をタップ</span>}
                    {step.wait === 'next' && (
                      <button onClick={() => setI(i + 1)} className="rounded-full bg-violet-500 px-4 py-1.5 text-xs font-bold text-white">
                        つぎへ
                      </button>
                    )}
                    {step.wait === 'done' && (
                      <button onClick={onDone} className="rounded-full bg-violet-500 px-4 py-1.5 text-xs font-bold text-white">
                        土星をあとにする
                      </button>
                    )}
                    {(step.wait === 'listen' || step.wait === 'star') && (
                      <span className="animate-pulse text-[11px] font-bold text-pink-500">{step.wait === 'listen' ? '👆 アイコンをタップ' : '☆ をタップ'}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        }
      />
    </div>
  );
}

/**
 * KIMORIN's human check: record the line, and it plays back as a robot (まんなかロボ) — then
 * 「……怪しいなあ」. The sound starts from the tap that stops the recording (iPad Safari).
 */
function HumanCheck({ onDone }: { onDone: () => void }) {
  const rec = useRecorder(12);
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready');
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (!rec.blob) return;
    let live = true;
    setPhase('playing');
    decodeVoice(rec.blob)
      .then((buf) => playRobot(buf, TUTORIAL_ROBOT))
      .catch(() => undefined)
      .finally(() => live && setTimeout(() => done.current(), 500));
    return () => {
      live = false;
    };
  }, [rec.blob]);

  useEffect(() => () => stopRobot(), []);

  if (phase === 'playing') return <span className="animate-pulse text-[11px] font-bold text-violet-500">🔊 再生中……</span>;
  return (
    <span className="flex items-center gap-2">
      {rec.error ? (
        <button onClick={onDone} className="rounded-full bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600">
          マイクが使えない…つぎへ
        </button>
      ) : (
        <button
          onClick={() => {
            unlockRobot();
            if (rec.recording) rec.stop();
            else void rec.start();
          }}
          className={`rounded-full px-4 py-1.5 text-xs font-bold text-white ${rec.recording ? 'animate-pulse bg-rose-500' : 'bg-violet-500'}`}
        >
          {rec.recording ? `■ 言い終わったらタップ（${rec.elapsed}秒）` : '🎙 タップして話す'}
        </button>
      )}
    </span>
  );
}
