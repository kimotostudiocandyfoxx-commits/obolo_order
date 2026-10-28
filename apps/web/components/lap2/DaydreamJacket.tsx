'use client';

import { useRef, useState } from 'react';
import { Sticker, spellCards } from '@/components/jupiter/JupiterLesson';
import { SpellCompass } from './SpellCompass';
import { VoiceField } from '@/components/onboarding/StoryExtras';
import type { LessonApi } from '@/lib/onboarding/lessonApi';
import type { StickerMade } from '@/lib/onboarding/made';

/**
 * A jacket from a daydream (L2-JUPITER-S002): the words by voice (〔おまかせ〕 / 〔パス〕 → 『雲の上の世界樹』),
 * then the picture — 〔写真を添える〕〔{bati}に描いてもらう〕〔字だけ〕, the same size, none lit first. Only Bati's
 * drawing uses mana, asked first and without numbers. Then 〔🔒 根っこにしまう〕 or 〔🦋 投稿する〕 → 〔ダチへ〕 → 〔🦋 飛ばす〕.
 * Obolo Order (R21b, M-R145/M-R167): everyone sees the spell cards and may rearrange them by hand
 * (〔✏️ スペルを組み替える〕: remove, add by voice, take from the spellbook); 〔🧭 スペルコンパス〕 reads a picture
 * you like into cards first.
 */
function loadBook(): string[][] {
  try {
    return JSON.parse(localStorage.getItem('obolo.spellbook') ?? '[]') as string[][];
  } catch {
    return [];
  }
}
const OMAKASE = ['行ってみたい場所', 'まだない曲のジャケット', '夢で見たもの'];
type Phase = 'words' | 'cards' | 'art' | 'ask' | 'drawing' | 'ready' | 'dest' | 'flying';

export function DaydreamJacket({ api, bati, fill, onDone }: { api?: LessonApi; bati: string; fill: (s: string) => string; onDone: (a: Record<string, string>) => void }) {
  const [phase, setPhase] = useState<Phase>('words');
  const [words, setWords] = useState('');
  const [j, setJ] = useState<StickerMade | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cards, setCards] = useState<string[]>([]);
  const [extra, setExtra] = useState<string[]>([]);
  const [compass, setCompass] = useState(false);
  const [edit, setEdit] = useState(false);
  const [add, setAdd] = useState('');
  const [book, setBook] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const begin = (text: string) => {
    const t = text.trim() || '雲の上の世界樹';
    setJ({ text: t, url: null });
    setCards(spellCards(t, extra));
    setPhase('cards');
  };
  const draw = async () => {
    if (!j || !api) return;
    setPhase('drawing');
    try {
      const own = spellCards(j.text);
      const style = cards.filter((c) => !own.includes(c)).join('、');
      const r = await api.stickerArt(j.text, style || undefined);
      setJ({ ...j, url: r.url });
      setPhase('ready');
    } catch {
      setErr('魔法陣、ちょっと焦げちゃった……。言葉は残ってるよ');
      setPhase('art');
    }
  };
  const photo = async (f: File) => {
    if (!j || !api) return;
    setPhase('drawing');
    try {
      const r = await api.uploadPhoto(f);
      setJ({ ...j, url: r.url });
      setPhase('ready');
    } catch {
      setPhase('art');
    }
  };
  const fly = () => {
    if (!j) return;
    setPhase('flying');
    void api?.deliver({ kind: 'jacket', title: j.text.slice(0, 60), url: j.url && /^https?:/.test(j.url) ? j.url : undefined }).catch(() => undefined);
    setTimeout(() => onDone({ jacket: 'send', jacket_text: j.text }), 2200);
  };
  const btn = 'w-full rounded-full border border-amber-200/50 bg-amber-200/10 py-3 text-[14px] tracking-wider active:scale-[0.98] disabled:opacity-40';
  return (
    <div className="absolute inset-0 z-[12] flex items-end justify-center bg-black/55 px-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md animate-[fadeUp_0.5s_ease-out] rounded-3xl border border-amber-100/25 bg-[#0d0b18]/95 p-5 text-amber-50">
        <p className="text-center text-[15px] font-bold tracking-wider">🥚 アートをつくる</p>
        {phase === 'words' && (
          <div className="mt-3 space-y-3">
            <p className="text-center text-[13px] text-amber-50/75">思い描いた景色を、声で</p>
            <VoiceField value={words} onChange={setWords} placeholder="雲の上で、みんなで朝ごはん" maxLength={30} />
            <div className="flex flex-wrap justify-center gap-2">
              {OMAKASE.map((o) => (
                <button key={o} onClick={() => begin(o)} className="rounded-full bg-white/10 px-3 py-1.5 text-[12px]">
                  {o}
                </button>
              ))}
            </div>
            <button onClick={() => begin(words)} className={btn}>
              {words.trim() ? 'この空想で' : 'パス'}
            </button>
            <button onClick={() => setCompass(true)} className="w-full py-1.5 text-[12px] text-amber-200/90">
              🧭 こんな絵にしたい絵を、スペルコンパスで読む{extra.length ? `（${extra.length}枚の札）` : ''}
            </button>
          </div>
        )}
        {phase === 'cards' && (
          <div className="mt-3 space-y-2">
            <p className="text-center text-[12px] text-amber-50/70">{fill(`${bati || 'バティ'}「じゃあ、スペルは、こうなるね！」`)}</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {cards.map((c, i) => (
                <span key={`${c}-${i}`} className="flex items-center gap-1 rounded-md bg-gradient-to-b from-violet-50 to-amber-50 px-2 py-1 font-serif text-[13px] font-bold text-violet-800">
                  〈{c}〉
                  {edit && (
                    <button onClick={() => setCards((x) => x.filter((_, k) => k !== i))} className="text-[11px] text-violet-400" aria-label="外す">
                      ✕
                    </button>
                  )}
                </span>
              ))}
            </div>
            {edit ? (
              <div className="space-y-2">
                <VoiceField value={add} onChange={setAdd} placeholder="足したい札（例：朝の光）" maxLength={14} />
                <button
                  onClick={() => {
                    if (add.trim()) setCards((x) => [...x, add.trim()]);
                    setAdd('');
                  }}
                  disabled={!add.trim()}
                  className={btn}
                >
                  札を足す
                </button>
                <button onClick={() => setBook((b) => !b)} className="w-full py-1 text-[12px] text-violet-200">
                  📖 スペルブックから出す
                </button>
                {book && (
                  <div className="max-h-32 space-y-1 overflow-y-auto">
                    {loadBook().length ? (
                      loadBook().map((sp, k) => (
                        <button key={k} onClick={() => setCards((x) => [...x, ...sp.filter((c) => !x.includes(c))])} className="block w-full truncate rounded-lg bg-white/5 px-2 py-1 text-left text-[12px]">
                          {sp.map((c) => `〈${c}〉`).join('')}
                        </button>
                      ))
                    ) : (
                      <p className="text-center text-[11px] text-amber-50/50">まだ、記したスペルはありません</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => setEdit(true)} className="w-full py-1 text-[12px] text-amber-200/90">
                ✏️ スペルを組み替える
              </button>
            )}
            <button onClick={() => setPhase('art')} className={btn}>
              このスペルで
            </button>
          </div>
        )}
        {j && phase !== 'words' && (
          <div className="mt-3 flex justify-center">
            <div className={phase === 'flying' ? 'animate-[flyAway_2s_ease-in_forwards]' : ''}>
              <Sticker s={j} size={170} />
            </div>
          </div>
        )}
        {phase === 'art' && (
          <div className="mt-4 space-y-2">
            {err && <p className="text-center text-[12px] text-amber-200/80">{err}</p>}
            <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && void photo(e.target.files[0])} />
            <button onClick={() => file.current?.click()} disabled={!api} className={btn}>
              写真を添える
            </button>
            <button onClick={() => setPhase('ask')} disabled={!api} className={btn}>
              {fill(`${bati || 'バティ'}に描いてもらう`)}
            </button>
            <button onClick={() => setPhase('ready')} className={btn}>
              字だけ
            </button>
          </div>
        )}
        {phase === 'ask' && (
          <div className="mt-4 space-y-2">
            <p className="text-center text-[13px] text-amber-50/80">描くのに、マナを使います。描きますか？</p>
            <button onClick={() => void draw()} className={btn}>
              描いてもらう
            </button>
            <button onClick={() => setPhase('art')} className="w-full py-2 text-[13px] text-amber-50/60">
              やめる
            </button>
          </div>
        )}
        {phase === 'drawing' && <p className="mt-4 animate-pulse text-center text-[13px]">{fill(`〈${j?.text ?? ''}〉——ここに、かたちを。`)}</p>}
        {phase === 'ready' && (
          <div className="mt-4 space-y-2">
            <button onClick={() => onDone({ jacket: 'keep', jacket_text: j?.text ?? '' })} className={btn}>
              🔒 根っこにしまう
            </button>
            <button onClick={() => setPhase('dest')} className={btn}>
              🦋 投稿する
            </button>
          </div>
        )}
        {phase === 'dest' && (
          <div className="mt-4 space-y-2">
            <p className="text-center text-[12px] text-amber-50/70">行き先：ダチへ（88時間、ダチの空を飛んで、あなたの枝に帰ってきます）</p>
            <button onClick={fly} className={btn}>
              🦋 飛ばす
            </button>
            <button onClick={() => setPhase('ready')} className="w-full py-2 text-[13px] text-amber-50/60">
              もどる
            </button>
          </div>
        )}
      </div>
      {compass && (
        <SpellCompass
          kind="art"
          onClose={() => setCompass(false)}
          onAdd={(c) => {
            setExtra((x) => [...x, ...c.filter((v) => !x.includes(v))]);
            setCompass(false);
          }}
        />
      )}
      <style>{'@keyframes flyAway{0%{transform:none;opacity:1}30%{transform:translateY(-10px) scaleX(0.6)}60%{transform:translateY(-120px) scaleX(1)}100%{transform:translate(80px,-420px) scale(0.4);opacity:0}}'}</style>
    </div>
  );
}
