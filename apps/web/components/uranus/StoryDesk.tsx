'use client';

import { useState } from 'react';
import { saveSpell } from '@/components/jupiter/JupiterLesson';
import { VoiceField } from '@/components/onboarding/StoryExtras';
import { getApi } from '@/lib/api';
import { type Book, putInDrawer, spellbookCards } from './drawer';

/**
 * L2-URANUS-S002 〔✒️ 書く〕 (M-R158): {bati} asks who, where and what; what is said (or a work from the journey, or
 * 〔おまかせ〕) becomes the spell cards; 〔✏️ スペルを組み替える〕; one question before the mana is used (no number);
 * the feather pen writes a short story of a few pages; 〔🔒 机の引き出しにしまう〕 or 話して直す (asked again).
 * The story goes only to this device's drawer — nobody is sent anything.
 */
type Art = { text: string; url: string | null };
const OMAKASE = ['たこ焼きが、屋台から転がり落ちて、宇宙の果てまで旅をする話', '雨の日にだけ開く、小さな本屋さんの話', '星を拾い集める、ねぼすけなフクロウの話'];

export function StoryDesk({ neo, bati, arts, words, onDone }: { neo: string; bati: string; arts: Art[]; words: string[]; onDone: (a: Record<string, string>) => void }) {
  const [phase, setPhase] = useState<'ask' | 'trip' | 'cards' | 'confirm' | 'writing' | 'done' | 'redo' | 'fail'>('ask');
  const [how, setHow] = useState<'talk' | 'trip' | 'auto'>('talk');
  const [talk, setTalk] = useState('');
  const [cards, setCards] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(false);
  const [add, setAdd] = useState('');
  const [book, setBook] = useState<Book | null>(null);
  const [page, setPage] = useState(-1);
  const [noted, setNoted] = useState(false);
  const [err, setErr] = useState('');
  const [trip, setTrip] = useState<Art | null>(null);
  const btn = 'w-full rounded-full border border-teal-200/60 bg-teal-200/15 py-3 text-[14px] font-bold tracking-wider text-teal-50 active:scale-[0.98] disabled:opacity-40';

  const toCards = async (said: string, h: typeof how) => {
    setHow(h);
    setBusy(true);
    try {
      setCards((await getApi().storyCards(said)).cards);
    } catch {
      setCards([...said.split(/[、。\s　]+/).filter(Boolean).slice(0, 4), '短いお話']);
    }
    setBusy(false);
    setTalk('');
    setPhase('cards');
  };
  const write = async () => {
    setPhase('writing');
    try {
      const r = await getApi().writeStory(cards);
      const b: Book = { id: book?.id ?? `${Date.now()}`, title: r.title, pages: r.pages, cards, made: Date.now() };
      setBook(b);
      setPage(-1);
      setNoted(false);
      setTimeout(() => setPhase('done'), 1200);
    } catch (e) {
      setErr((e as { code?: string })?.code === 'NO_MANA' ? 'マナジェムが、光らなかった。言葉と札は、残してあるよ' : '羽ペンが、止まってしまった……。言葉と札は、残してあるよ');
      setPhase('fail');
    }
  };
  const Cards = ({ removable = false }: { removable?: boolean }) => (
    <div className="flex flex-wrap justify-center gap-1.5">
      {cards.map((c) => (
        <button
          key={c}
          disabled={!removable}
          onClick={() => setCards((x) => x.filter((y) => y !== c))}
          className="rounded-md bg-gradient-to-b from-amber-50 to-amber-200 px-2 py-0.5 font-serif text-[13px] font-bold text-amber-900"
        >
          〈{c}〉{removable && <span className="ml-1 text-amber-900/50">×</span>}
        </button>
      ))}
    </div>
  );

  return (
    <div className="absolute inset-0 z-[12] flex flex-col items-center justify-end bg-gradient-to-b from-teal-200 via-sky-300 to-teal-700 px-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
      {/* the big open book on the field, the feather pen standing on it */}
      <div className="relative mb-3 flex h-[30svh] w-full max-w-sm items-center justify-center">
        <div className="relative flex h-[78%] w-[88%] rounded-lg bg-[#fbf6ea] shadow-2xl" style={{ transform: 'perspective(600px) rotateX(18deg)' }}>
          <div className="flex-1 border-r border-amber-900/15 p-3 text-[10px] leading-relaxed text-amber-950/80">{book && page >= 0 ? book.pages[page]?.text : book ? `『${book.title}』` : ''}</div>
          <div className="flex-1 p-3 text-[10px] leading-relaxed text-amber-950/80">{book && page >= 0 ? `― ${page + 1} ―` : ''}</div>
        </div>
        <span className="absolute text-5xl" style={{ animation: phase === 'writing' ? 'penRun 0.5s ease-in-out infinite alternate' : undefined, left: '58%', top: '8%' }}>
          🪶
        </span>
        {phase === 'writing' && <div className="absolute h-40 w-40 animate-ping rounded-full border-2 border-amber-200/80" />}
      </div>
      <div className="max-h-[56svh] w-full max-w-md space-y-2 overflow-y-auto rounded-3xl border border-teal-100/25 bg-[#062023]/90 p-4 text-teal-50">
        {phase === 'ask' && (
          <>
            <p className="text-center text-[13px]">{bati}「どんなお話にする？　だれが、どこで、何をするのか、できるだけ、くわしく教えて！」</p>
            <VoiceField value={talk} onChange={setTalk} placeholder="たこ焼きが、宇宙の果てまで旅をする話" maxLength={120} multiline />
            <button onClick={() => void toCards(talk.trim(), 'talk')} disabled={!talk.trim() || busy} className={btn}>
              {busy ? '……' : 'これで話す'}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setPhase('trip')} className="rounded-full bg-white/10 py-2 text-[12px]">
                旅で作ったものから
              </button>
              <button onClick={() => void toCards([...words.slice(0, 2), OMAKASE[Math.floor(Math.random() * OMAKASE.length)]].join('。'), 'auto')} disabled={busy} className="rounded-full bg-white/10 py-2 text-[12px]">
                おまかせ
              </button>
            </div>
            <p className="text-center text-[10px] text-teal-50/45">〔おまかせ〕は、{neo}の旅で作ったものから、{bati}がお話の種を選びます</p>
            <button onClick={() => onDone({ novel: 'none' })} className="w-full py-1.5 text-[12px] text-teal-50/60">
              今日は書かない
            </button>
          </>
        )}
        {phase === 'trip' && (
          <>
            <p className="text-center text-[12px] text-teal-50/70">コロリンの言葉・アート・曲を、お話の材料にできます</p>
            <div className="flex flex-wrap justify-center gap-2">
              {arts.map((a, k) => (
                <button key={k} onClick={() => setTrip(a)} className={`w-[30%] overflow-hidden rounded-lg border-2 ${trip === a ? 'border-amber-300' : 'border-transparent'} bg-white/10`}>
                  {a.url ? <img src={a.url} alt="" className="aspect-square w-full object-cover" /> : <div className="flex aspect-square items-center justify-center p-1 text-[11px]">{a.text}</div>}
                </button>
              ))}
              {words.map((w) => (
                <button key={w} onClick={() => setTrip({ text: w, url: null })} className={`rounded-full px-3 py-1 text-[12px] ${trip?.text === w && !trip.url ? 'bg-amber-300 text-amber-950' : 'bg-white/10'}`}>
                  「{w}」
                </button>
              ))}
            </div>
            {trip && <p className="text-center text-[11px] text-amber-200">✨ {trip.url ? 'アートの端から、光の糸が一本、ページへのびる' : '言葉から、光の糸が一本、ページへのびる'}</p>}
            <VoiceField value={talk} onChange={setTalk} placeholder="この絵の場所で、迷子になる話" maxLength={120} multiline />
            <button onClick={() => trip && void toCards(`${trip.text}。${talk.trim()}`, 'trip')} disabled={!trip || busy} className={btn}>
              {busy ? '……' : 'これで話す'}
            </button>
            <button onClick={() => setPhase('ask')} className="w-full py-1 text-[12px] text-teal-50/60">
              もどる
            </button>
          </>
        )}
        {phase === 'cards' && (
          <>
            <p className="text-center text-[12px] text-teal-50/80">{bati}「じゃあ、スペルは、こうなるね！」</p>
            <Cards removable={edit} />
            {edit ? (
              <div className="space-y-2 rounded-2xl bg-white/5 p-2">
                <p className="text-center text-[11px] text-teal-50/60">札を押すと外れます。話すと、札が足されます</p>
                <VoiceField value={add} onChange={setAdd} placeholder="主人公：ねこ" maxLength={16} />
                <button
                  onClick={() => {
                    const a = add.trim();
                    if (a) setCards((x) => (a.startsWith('主人公') ? [a, ...x.filter((y) => !y.startsWith('主人公'))] : [...x, a]));
                    setAdd('');
                  }}
                  disabled={!add.trim()}
                  className="w-full rounded-full bg-white/10 py-2 text-[12px] disabled:opacity-40"
                >
                  札を足す
                </button>
                {spellbookCards().length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1">
                    <span className="text-[10px] text-violet-200">📖 スペルブック</span>
                    {spellbookCards().map((c) => (
                      <button key={c} onClick={() => setCards((x) => (x.includes(c) ? x : [...x, c]))} className="rounded bg-violet-300/20 px-1.5 text-[11px]">
                        〈{c}〉
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => setEdit(false)} className="w-full text-[12px] text-teal-50/70">
                  組み替えおわり
                </button>
              </div>
            ) : (
              <button onClick={() => setEdit(true)} className="w-full text-center text-[12px] text-amber-200">
                ✏️ スペルを組み替える
              </button>
            )}
            <p className="text-center text-[11px] text-teal-50/60">たこ焼きブラザー「主人公の札を一枚変えれば、別のお話になるZE。」</p>
            <button onClick={() => setPhase('confirm')} disabled={!cards.length} className={btn}>
              このスペルで書く
            </button>
          </>
        )}
        {phase === 'confirm' && (
          <>
            <p className="text-center text-[13px]">{bati}「このスペルで、お話を書くよ。マナを少し使うけど、いい？」</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => void write()} className={btn}>
                使う
              </button>
              <button onClick={() => setPhase(book ? 'redo' : 'ask')} className="w-full rounded-full bg-white/10 py-3 text-[13px]">
                やめる（話し直す）
              </button>
            </div>
          </>
        )}
        {phase === 'writing' && <p className="animate-pulse text-center text-[14px]">{bati}「〈{neo}のお話〉——ここに、かたちを。」</p>}
        {phase === 'fail' && (
          <>
            <p className="text-center text-[13px] text-teal-50/80">{err}</p>
            <button onClick={() => setPhase('cards')} className={btn}>
              札にもどる
            </button>
          </>
        )}
        {phase === 'done' && book && (
          <>
            <p className="text-center text-[11px] text-teal-50/60">お話ができました</p>
            <p className="text-center font-serif text-[17px] font-bold">『{book.title}』</p>
            {page >= 0 ? (
              <div className="rounded-2xl bg-[#fbf6ea] p-3 text-[13px] leading-relaxed text-amber-950">
                {book.pages[page].text}
                <div className="mt-2 flex justify-between text-[12px] text-amber-900/70">
                  <button onClick={() => setPage((p) => p - 1)}>{page > 0 ? '← まえ' : '表紙'}</button>
                  <span>
                    {page + 1}／{book.pages.length}
                  </span>
                  <button onClick={() => setPage((p) => (p + 1 < book.pages.length ? p + 1 : -1))}>{page + 1 < book.pages.length ? 'つぎ →' : 'おわり'}</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setPage(0)} className="w-full rounded-full bg-white/10 py-2 text-[13px]">
                ▶ 読む
              </button>
            )}
            <Cards />
            <button
              onClick={() => {
                saveSpell(cards);
                setNoted(true);
              }}
              disabled={noted}
              className="w-full text-center text-[12px] text-violet-200 disabled:text-teal-50/40"
            >
              {noted ? 'スペルブックに記しました' : '📖 記す'}
            </button>
            <button
              onClick={() => {
                putInDrawer(book);
                onDone({ novel: how, story_title: book.title.slice(0, 20) });
              }}
              className={btn}
            >
              🔒 机の引き出しにしまう
            </button>
            <button onClick={() => setPhase('redo')} className="w-full py-1 text-[12px] text-teal-50/70">
              話して直す
            </button>
          </>
        )}
        {phase === 'redo' && (
          <>
            <p className="text-center text-[12px] text-teal-50/70">どこを直す？（直して書く時も、書く前にたずねます）</p>
            <Cards />
            <VoiceField value={talk} onChange={setTalk} placeholder="最後は、笑える感じに" maxLength={40} />
            <button
              onClick={() => {
                const said = talk.trim();
                setCards((x) => {
                  const feel = /感じ|笑|泣|こわ|楽し|せつな|あったか/;
                  const at = x.findIndex((c) => feel.test(c));
                  const card = said.replace(/^(最後は|もっと)[、,]?/, '').replace(/感じに?$|に$/, '').trim() || said;
                  if (at >= 0 && feel.test(said)) return x.map((c, k) => (k === at ? card : c));
                  return [...x, card];
                });
                setTalk('');
                setPhase('confirm');
              }}
              disabled={!talk.trim()}
              className={btn}
            >
              札を直して書く
            </button>
            <button onClick={() => setPhase('done')} className="w-full py-1 text-[12px] text-teal-50/60">
              もどる
            </button>
          </>
        )}
      </div>
      <style>{'@keyframes penRun{from{transform:translate(-30px,6px) rotate(-12deg)}to{transform:translate(20px,18px) rotate(8deg)}}'}</style>
    </div>
  );
}
