'use client';

import { neoVoiceUrl, type SaturnPostView } from '@obolo/shared';
import { useMemo, useState } from 'react';
import { spriteUrl } from '@/lib/onboarding/media';
import { KororinWorld } from './KororinWorld';

/**
 * Day 3 on Saturn (story 2026-10-14, D04-S005〜S006): the story IS the how-to of the real Saturn world
 * (ころりんぱ). たこ焼きブラザー・シスター and KIMORIN⭐︎ talk on top of it while the visitor uses it:
 *  - KIMORIN⭐︎ murmurs 「ラーメン食べたい。」 → his kororin falls in → tap it → 「たこ焼き食べたい。」
 *  - 声をおとす: speak to the Bati → it reads it → 〔自分の部屋に飛ばす〕 (the first journey: own room only;
 *    the plaza opens on the second journey) — or 「今日はつぶやかない」
 *  - the residents' kororins; the brother's sneeze falls → tap it → ☆ (no count anywhere)
 *  - 「OBOLO ORDERは、みーんな、表現者なんだZE!!」 → back to the story (riddle 2)
 * The lines are the story's (§9); the hint cards are its 〔画面：…〕 notes.
 */
type Who = 'brother' | 'sister' | 'kimorin' | 'bati' | 'guide';
type Wait = 'next' | 'listen-kimorin' | 'listen-sneeze' | 'star' | 'choose' | 'post' | 'done';
interface Line {
  who: Who;
  text: string;
  wait: Wait;
  /** drop one of the story's kororins when this line appears */
  drop?: 'kimorin' | 'sneeze';
  /** branch: only after つぶやいてみる / 今日はつぶやかない */
  only?: 'try' | 'skip';
}

const LINES: Line[] = [
  { who: 'kimorin', text: 'なんだこれ。', wait: 'next' },
  { who: 'sister', text: 'テキトーに思いついた言葉を、バティに向かって、つぶやいてみたらいいわ。', wait: 'next' },
  { who: 'kimorin', text: 'ラーメン食べたい。', wait: 'next' },
  { who: 'kimorin', text: 'なんやこれ、たこ焼きになった！', wait: 'next', drop: 'kimorin' },
  { who: 'sister', text: 'このたこ焼きのことを、コロリンというわ。', wait: 'next' },
  { who: 'sister', text: 'コロリンを、タップしてみて。', wait: 'listen-kimorin' },
  { who: 'kimorin', text: 'うわ、喋った！', wait: 'next' },
  { who: 'sister', text: 'そう、コロリンは喋るの。', wait: 'next' },
  { who: 'brother', text: '文字だけだと、冷たく見られたり、怒ってるように思われたりするZE。', wait: 'next' },
  { who: 'brother', text: 'かわいいコロリンが声に出せば、そんな勘違いは起きないZE。', wait: 'next' },
  { who: 'brother', text: '自分で思ったことや、感じたこと、思いついたことは、全部コロリンにしちゃえ。それは全部、大切な思い出だZE。', wait: 'next' },
  { who: 'brother', text: 'つぶやいたコロリンは、全部、土星の空を、リングとなって舞うZE。', wait: 'next' },
  { who: 'brother', text: 'そして、人に見せたいものだけを広場に飛ばし、見せないものは自分の部屋に飛ばせばいいんだZE。', wait: 'next' },
  { who: 'brother', text: 'だから、メモ代わりにでも、日記代わりにでも、使えちゃうZE。', wait: 'next' },
  { who: 'brother', text: 'みんなの広場に飛ばしたコロリンも、88時間経ったら、自分の部屋に帰ってくるZE。', wait: 'next' },
  { who: 'guide', text: '〔🎙 声をおとす〕を押して、{bati}に向かって、独り言みたいにつぶやく（文字で打ってもいい）→ {bati}がコロリンにする → タップすると喋る → 〔自分の部屋に飛ばす〕\n広場に飛ばせるのは、二周目の旅から', wait: 'choose' },
  { who: 'guide', text: '👇〔声をおとす〕をタップして、{bati}につぶやいてみよう', wait: 'post', only: 'try' },
  { who: 'bati', text: 'できた！　ボクが作った、{neo}のコロリン！', wait: 'next', only: 'try' },
  { who: 'sister', text: 'いいわ。つぶやきたくなったら、いつでもどうぞ。', wait: 'next', only: 'skip' },
  { who: 'guide', text: 'コロリンは、いつでも作れます（今日でなくても）', wait: 'next', only: 'skip' },
  { who: 'guide', text: 'コロリンが、ころん、と落ちてきた。\n広場のコロリンをタップすると、声が聞けます。☆を押すと「いいな」の印（☆の数は、どこにも出ません）', wait: 'listen-sneeze', drop: 'sneeze' },
  { who: 'brother', text: '……俺のだZE。押すボタンを、間違えたZE。', wait: 'star' },
  { who: 'brother', text: '……くしゃみに、星がついたZE。', wait: 'next' },
  { who: 'sister', text: 'うまく言えなくても、くしゃみでも、いいの。出したら、それはもう、表現よ。', wait: 'next' },
  { who: 'brother', text: 'だから、OBOLO ORDERは、みーんな、表現者なんだZE!!', wait: 'done' },
];

const NAMES: Record<Who, string> = { brother: 'たこ焼きブラザー', sister: 'たこ焼きシスター', kimorin: 'KIMORIN⭐︎', bati: 'バティ', guide: '' };
const SPRITES: Partial<Record<Who, string>> = { brother: 'takoyaki-brother', sister: 'takoyaki-sister', kimorin: 'kimorin-sun' };

/** The story's own kororins (not saved anywhere; they live on this screen). */
const storyPost = (id: string, name: string, pic: string, text: string, style: string): SaturnPostView => ({
  id,
  author: { id: `story-${name}`, handle: name, displayName: name, pic },
  text,
  voiceUrl: neoVoiceUrl(style, null, text),
  voiceSource: 'default',
  voiceDurationSec: null,
  starCount: 0,
  starredByMe: false,
  createdAt: new Date().toISOString(),
});
const KIMORIN_KORORIN = storyPost('story-kimorin', 'KIMORIN⭐︎', spriteUrl('kimorin-face'), 'たこ焼き食べたい。', 'genki');
const SNEEZE_KORORIN = storyPost('story-sneeze', 'たこ焼きブラザー', spriteUrl('takoyaki-brother-face'), '……へっくしゅん！', 'hikui');

export function SaturnLesson({ bati, neo, batiImage, onDone }: { bati: string; neo: string; batiImage?: string; onDone: (choice: 'try' | 'skip') => void }) {
  const [branch, setBranch] = useState<'try' | 'skip' | null>(null);
  const lines = useMemo(() => LINES.filter((l) => !l.only || l.only === branch), [branch]);
  const [i, setI] = useState(0);
  const line = lines[i];
  // the story's kororins stay once dropped
  const dropped = new Set(lines.slice(0, i + 1).flatMap((l) => (l.drop ? [l.drop] : [])));
  const extra = [...(dropped.has('kimorin') ? [KIMORIN_KORORIN] : []), ...(dropped.has('sneeze') ? [SNEEZE_KORORIN] : [])];
  const fill = (t: string) => t.replaceAll('{bati}', bati).replaceAll('{neo}', neo);
  const advanceOn = (w: Wait, ok = true) => ok && setI((cur) => (lines[cur]?.wait === w ? cur + 1 : cur));

  return (
    <div className="fixed inset-0 z-[150]">
      <KororinWorld
        neoOnly
        roomOnly
        extra={extra}
        highlightDrop={line?.wait === 'post'}
        events={{
          onListen: (p) => {
            advanceOn('listen-kimorin', p.id === KIMORIN_KORORIN.id);
            advanceOn('listen-sneeze', p.id === SNEEZE_KORORIN.id);
          },
          onStar: (p) => advanceOn('star', p.id === SNEEZE_KORORIN.id),
          onPosted: () => advanceOn('post'),
        }}
        overlay={
          line && (
            <div className="pointer-events-none absolute inset-x-0 top-[calc(96px+env(safe-area-inset-top))] z-[200] flex justify-center px-3">
              <div key={i} className="pointer-events-auto flex w-full max-w-md animate-[fadeUp_0.4s_ease-out] items-end gap-2">
                {line.who === 'bati' && batiImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={batiImage} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow-xl" aria-hidden />
                ) : (
                  SPRITES[line.who] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={spriteUrl(SPRITES[line.who]!)} alt="" className="h-28 w-auto shrink-0 drop-shadow-xl" aria-hidden />
                  )
                )}
                <div className={`relative mb-2 flex-1 rounded-2xl p-3 shadow-xl ${line.who === 'guide' ? 'bg-[#2a1d4a]/90 text-white' : 'bg-white/95 text-slate-800'}`}>
                  {NAMES[line.who] && <p className="text-[11px] font-black text-violet-500">{line.who === 'bati' ? bati : NAMES[line.who]}</p>}
                  <p className={`mt-0.5 whitespace-pre-wrap leading-snug ${line.who === 'guide' ? 'text-[13px] font-bold' : 'text-[15px] font-bold'}`}>{fill(line.text)}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                    {line.wait === 'next' && (
                      <button onClick={() => setI(i + 1)} className="rounded-full bg-violet-500 px-4 py-1.5 text-xs font-bold text-white">
                        つぎへ
                      </button>
                    )}
                    {line.wait === 'choose' && (
                      <>
                        <button
                          onClick={() => {
                            setBranch('skip');
                            setI(i + 1);
                          }}
                          className="rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold text-white"
                        >
                          今日はつぶやかない
                        </button>
                        <button
                          onClick={() => {
                            setBranch('try');
                            setI(i + 1);
                          }}
                          className="rounded-full bg-pink-400 px-4 py-1.5 text-xs font-black text-white"
                        >
                          つぶやいてみる
                        </button>
                      </>
                    )}
                    {line.wait === 'done' && (
                      <button onClick={() => onDone(branch ?? 'skip')} className="rounded-full bg-violet-500 px-4 py-1.5 text-xs font-bold text-white">
                        つぎへ
                      </button>
                    )}
                    {(line.wait === 'listen-kimorin' || line.wait === 'listen-sneeze') && (
                      <span className="animate-pulse text-[11px] font-bold text-pink-400">👆 落ちてきたコロリンをタップ</span>
                    )}
                    {line.wait === 'star' && <span className="animate-pulse text-[11px] font-bold text-pink-500">☆ を、そっと押してみよう</span>}
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
