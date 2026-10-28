'use client';

import { useState } from 'react';
import { VoiceField } from '@/components/onboarding/StoryExtras';
import { getApi } from '@/lib/api';
import { loadDrawer } from './drawer';
import { LIBRARY_DEFAULT, MyLibrary, libraryCards, libraryFromWords, libraryOmakase, type LibraryLook } from './MyLibrary';
import { NeoOwl } from './NeoOwl';

/**
 * L2-URANUS-S004 my図書館 (M-R154/M-R158): 「どんな図書館にしたい？」 → the part cards → talking or the cards change it →
 * the sign (8 characters, may be empty) → 〔この図書館にする〕 (no mana) → shelves rise like pages, the lamp is lit,
 * and the drawer's story and picture book stand on the shelf. The library lives on this device until the server keeps
 * my places.
 */
export const LIBRARY_KEY = 'obolo.myLibrary';
function saveLibrary(l: LibraryLook) {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(l));
  } catch {
    /* private mode */
  }
}

export function LibraryBuild({ bati, neo, onDone }: { bati: string; neo: string; onDone: (a: Record<string, string>) => void }) {
  const books = loadDrawer();
  const [look, setLook] = useState<LibraryLook>(LIBRARY_DEFAULT);
  const [step, setStep] = useState<'ask' | 'cards' | 'rise' | 'shelf'>('ask');
  const [talk, setTalk] = useState('');
  const [rise, setRise] = useState(0);
  const btn = 'w-full rounded-full border border-teal-200/60 bg-teal-200/15 py-3 text-[14px] font-bold tracking-wider text-teal-50 active:scale-[0.98] disabled:opacity-40';
  const toCards = (said: string, omakase = false) => {
    setLook((l) => (omakase ? { ...libraryOmakase(books.map((b) => b.cards.join(' ')).join(' ')), sign: l.sign } : libraryFromWords(said, l)));
    setTalk('');
    setStep('cards');
    setRise(1);
  };
  const build = () => {
    saveLibrary(look);
    setStep('rise');
    setRise(0);
    let r = 0;
    const id = setInterval(() => {
      r += 0.05;
      setRise(Math.min(1, r));
      if (r >= 1) {
        clearInterval(id);
        setTimeout(() => setStep('shelf'), 500);
      }
    }, 90);
  };
  const shelf = books.slice(-2).map((b) => ({ title: b.title, cover: b.pages.find((p) => p.pic)?.pic ?? null }));

  return (
    <div className="absolute inset-0 z-[12] flex flex-col items-center justify-end bg-gradient-to-b from-teal-200 via-sky-300 to-teal-700 px-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
      <div className="mb-3 flex w-full max-w-sm justify-center rounded-3xl bg-white/20 p-2 shadow-2xl">
        {step === 'ask' ? (
          <div className="flex h-[200px] flex-col items-center justify-end rounded-2xl bg-gradient-to-b from-teal-100 to-lime-100 pb-6">
            <span className="rounded bg-[#fbf6ea] px-2 py-0.5 text-[12px] font-bold text-amber-900 shadow">{neo}</span>
            <span className="mt-1 h-8 w-0.5 bg-amber-900/60" />
          </div>
        ) : (
          <MyLibrary look={look} rise={rise} books={step === 'shelf' ? shelf : []} width={step === 'cards' ? 260 : 340} />
        )}
      </div>
      <div className="max-h-[58svh] w-full max-w-md space-y-2 overflow-y-auto rounded-3xl border border-teal-100/25 bg-[#062023]/90 p-4 text-teal-50">
        {step === 'ask' && (
          <>
            <p className="text-center text-[13px]">{bati}「どんな図書館にしたい？　ざっくりでいいよ！」</p>
            <VoiceField value={talk} onChange={setTalk} placeholder="森の中の、天井まで本棚がある、古い図書館" maxLength={40} />
            <button onClick={() => toCards(talk.trim())} disabled={!talk.trim()} className={btn}>
              これで話す
            </button>
            <button onClick={() => toCards('', true)} className="w-full rounded-full bg-white/10 py-2 text-[12px]">
              おまかせ
            </button>
            <p className="text-center text-[10px] text-teal-50/45">〔おまかせ〕は、{neo}のお話に合う図書館を、{bati}が組みます</p>
          </>
        )}
        {step === 'cards' && (
          <>
            <p className="text-center text-[12px] text-teal-50/80">{bati}「じゃあ、こんな感じかな！」</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {libraryCards(look).map((c) => (
                <span key={c} className="rounded-md bg-teal-50 px-2 py-0.5 text-[12px] font-bold text-teal-800">
                  〈{c}〉
                </span>
              ))}
            </div>
            <VoiceField value={talk} onChange={setTalk} placeholder="夜の図書館がいい。星が見える感じ" maxLength={30} />
            <button
              onClick={() => {
                setLook((l) => libraryFromWords(talk, l));
                setTalk('');
              }}
              disabled={!talk.trim()}
              className="w-full rounded-full bg-white/10 py-2 text-[13px] disabled:opacity-40"
            >
              話して直す
            </button>
            <VoiceField value={look.sign} onChange={(t) => setLook((x) => ({ ...x, sign: t.slice(0, 8) }))} placeholder="入口の看板（8文字まで・なくてもいい）" maxLength={8} />
            <button onClick={build} className={btn}>
              この図書館にする
            </button>
            <p className="text-center text-[11px] text-teal-50/50">マナは使いません。あとで変えられます</p>
            <button onClick={() => onDone({ library: 'hold' })} className="w-full py-1 text-[12px] text-teal-50/60">
              今はここで止める
            </button>
          </>
        )}
        {step === 'rise' && <p className="animate-pulse text-center text-[13px]">本棚が、ページをめくるように、一段ずつせり上がる……</p>}
        {step === 'shelf' && (
          <>
            <p className="text-center text-[14px] font-bold">〈{neo}〉の図書館</p>
            <p className="text-center text-[12px] text-teal-50/80">{books.length ? (books.some((b) => b.picture) ? '引き出しのお話が本になって、棚にすっと収まる。となりに、絵本が一冊' : '引き出しのお話が一冊の本になって、棚にすっと収まる') : '棚は、まだ空いている'}</p>
            <p className="text-center text-[11px] text-teal-50/55">棚に並べた本は、ダチが図書館に来た時に見られます。〔🔒 机の引き出し〕の中は、{neo}だけ</p>
            <button onClick={() => onDone({ library: 'true', library_sign: look.sign || 'none', has_book: books.length ? 'yes' : 'no' })} className={btn}>
              OK
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 〔🦉 届ける〕 → the destination opens with 〔ダチへ〕 chosen → 〔🦉 飛ばす〕: the skylight opens and the owl with {neo}'s
 * face hugs the book and flies into the blue-green sky (88 hours in the dachi's 〔推し〕, then back to the shelf). No mana.
 */
export function OwlSend({ face, neo, onDone }: { face?: string; neo: string; onDone: (a: Record<string, string>) => void }) {
  const book = loadDrawer().at(-1);
  const [step, setStep] = useState<'ask' | 'to' | 'fly'>('ask');
  const btn = 'w-full rounded-full border border-teal-200/60 bg-teal-200/15 py-3 text-[14px] font-bold tracking-wider text-teal-50 active:scale-[0.98]';
  const fly = () => {
    setStep('fly');
    if (book) void getApi().deliver({ kind: 'book', title: book.title.slice(0, 60), text: book.pages[0]?.text.slice(0, 200) ?? '' }).catch(() => undefined);
    setTimeout(() => onDone({ sent_book: 'send' }), 3200);
  };
  return (
    <div className="absolute inset-0 z-[12] flex flex-col items-center justify-end overflow-hidden bg-gradient-to-b from-teal-300 via-sky-300 to-teal-600 px-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
      <div className="relative mb-4 flex h-[34svh] w-full max-w-sm items-end justify-center">
        <div style={step === 'fly' ? { animation: 'owlAway 3s ease-in forwards' } : undefined}>
          <NeoOwl face={face} title={book?.title} size={step === 'fly' ? 120 : 130} flap={step === 'fly'} />
        </div>
      </div>
      <div className="w-full max-w-md space-y-2 rounded-3xl border border-teal-100/25 bg-[#062023]/90 p-4 text-teal-50">
        {step === 'ask' && (
          <>
            <p className="text-center text-[12px] leading-relaxed text-teal-50/80">本の〔🦉 届ける〕を押すと、{neo}の顔のフクロウが本を抱えて、ダチの空を88時間とび、この図書館の棚に戻ります（届くのはダチだけ）</p>
            <button onClick={() => setStep('to')} className={btn}>
              🦉 届ける
            </button>
            <button onClick={() => onDone({ sent_book: 'keep' })} className="w-full py-1.5 text-[12px] text-teal-50/60">
              今は、棚に置いておく
            </button>
          </>
        )}
        {step === 'to' && (
          <>
            <p className="text-center text-[12px] text-teal-50/70">行き先</p>
            <div className="flex justify-center">
              <span className="rounded-full bg-teal-300 px-4 py-1 text-[13px] font-bold text-teal-950">✓ ダチへ</span>
            </div>
            <button onClick={fly} className={btn}>
              🦉 飛ばす
            </button>
            <button onClick={() => onDone({ sent_book: 'keep' })} className="w-full py-1.5 text-[12px] text-teal-50/60">
              やめる
            </button>
          </>
        )}
        {step === 'fly' && <p className="text-center text-[13px]">天窓が開く。フクロウが、ページをめくるような羽音を立てて、青緑の空へ</p>}
      </div>
      <style>{'@keyframes owlAway{0%{transform:translate(0,0) scale(1)}30%{transform:translate(-10px,-30px) scale(1)}100%{transform:translate(160px,-60svh) scale(.3);opacity:.2}}'}</style>
    </div>
  );
}

/** KIMORIN⭐︎'s owl comes into {neo}'s 〔推し〕 sky with a thin book; tapping it opens 『天才の一生』 — three lines. */
export function KimorinOwl({ face, onDone }: { face?: string; onDone: (a: Record<string, string>) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute inset-0 z-[12] flex flex-col items-center overflow-hidden bg-gradient-to-b from-sky-900 via-teal-700 to-teal-400 px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-[calc(16px+env(safe-area-inset-top))]">
      <div className="flex w-full max-w-md justify-center gap-4 text-[13px] text-white/80">
        <span className="border-b-2 border-white pb-1 font-bold text-white">推し</span>
      </div>
      {!open ? (
        <button onClick={() => setOpen(true)} className="mt-[14svh] flex flex-col items-center" style={{ animation: 'kOwlIn 2.4s ease-out' }}>
          <NeoOwl face={face} title="天才の一生" size={130} shades thin />
          <span className="mt-1 rounded-full bg-black/40 px-2 text-[11px] text-white">@KIMORIN⭐︎</span>
          <span className="mt-3 animate-pulse text-[12px] text-white/80">タップすると本が開きます</span>
        </button>
      ) : (
        <div className="mt-[10svh] w-full max-w-xs rounded-lg border-l-8 border-neutral-900 bg-[#fbf6ea] p-5 font-serif text-amber-950 shadow-2xl" style={{ animation: 'bookShut 0.7s ease-out' }}>
          <p className="text-center text-[16px] font-bold">『天才の一生』</p>
          <p className="mt-1 text-center text-[11px] text-amber-900/60">KIMORIN⭐︎</p>
          <p className="mt-4 text-[14px] leading-loose">
            KIMORIN⭐︎は、生まれた。
            <br />
            天才だった。
            <br />
            今も、天才である。
          </p>
          <button onClick={() => onDone({})} className="mt-5 w-full rounded-full bg-amber-900/10 py-2 text-[13px]">
            本を閉じる
          </button>
        </div>
      )}
      <style>{'@keyframes kOwlIn{from{transform:translate(-60vw,-10svh) scale(.4)}to{transform:none}}@keyframes bookShut{from{transform:perspective(500px) rotateY(-70deg);opacity:.4}to{transform:none;opacity:1}}'}</style>
    </div>
  );
}
