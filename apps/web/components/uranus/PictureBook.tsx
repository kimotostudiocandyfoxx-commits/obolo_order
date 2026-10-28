'use client';

import { useRef, useState } from 'react';
import { VoiceField } from '@/components/onboarding/StoryExtras';
import { getApi } from '@/lib/api';
import { type Book, type BookPage, loadDrawer, putInDrawer } from './drawer';

/**
 * L2-URANUS-S003 絵本にする (M-R158): the story from the drawer, split into its pages; {bati} asks the colour and touch
 * (cards for every page + each page's own scene card, 〔✏️ スペルを組み替える〕); each page picks how its picture is
 * made — 〔アート帳から選ぶ〕〔{bati}に描いてもらう〕〔写真を添える〕〔字だけ〕, four the same size (Jupiter's way). Only
 * when {bati} draws a page is the mana asked about first (no number). The book closes with the first picture on its
 * cover and goes back to the drawer (nobody is sent anything).
 */
type Art = { text: string; url: string | null };
type How = NonNullable<BookPage['how']>;
const OMAKASE = ['クレヨンで、にじんだ感じ。夕方みたいな色', '水彩で、やわらかい色', '切り絵みたいな、くっきりした色'];

async function smallPhoto(f: File): Promise<string | null> {
  try {
    const img = await createImageBitmap(f);
    const s = Math.min(1, 480 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * s);
    c.height = Math.round(img.height * s);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  } catch {
    return null;
  }
}

export function PictureBook({ bati, neo, arts, onDone }: { bati: string; neo: string; arts: Art[]; onDone: (a: Record<string, string>) => void }) {
  const [book, setBook] = useState<Book | null>(() => loadDrawer().filter((b) => !b.picture).at(-1) ?? loadDrawer().at(-1) ?? null);
  const [phase, setPhase] = useState<'ask' | 'pages' | 'confirm' | 'drawing' | 'closed'>('ask');
  const [talk, setTalk] = useState('');
  const [style, setStyle] = useState<string[]>([]);
  const [pages, setPages] = useState<BookPage[]>(() => (book?.pages ?? []).map((p) => ({ ...p, how: 'bati' as How, pic: null })));
  const [pickFor, setPickFor] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const photo = useRef<HTMLInputElement>(null);
  const photoFor = useRef(-1);
  const btn = 'w-full rounded-full border border-teal-200/60 bg-teal-200/15 py-3 text-[14px] font-bold tracking-wider text-teal-50 active:scale-[0.98] disabled:opacity-40';

  if (!book) {
    return (
      <div className="absolute inset-0 z-[12] flex items-end justify-center bg-gradient-to-b from-teal-200 to-teal-700 px-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
        <div className="w-full max-w-md space-y-2 rounded-3xl bg-[#062023]/90 p-4 text-center text-teal-50">
          <p className="text-[13px]">引き出しに、まだお話がありません</p>
          <button onClick={() => onDone({ picturebook: 'text' })} className={btn}>
            OK
          </button>
        </div>
      </div>
    );
  }
  const toPages = (said: string) => {
    setStyle([
      ...said
        .split(/[、。,.\s　]+/)
        .map((p) => p.replace(/^(で|に|の)|(で|な感じ|感じ|みたいな|みたい)$/g, '').trim())
        .filter(Boolean)
        .slice(0, 4),
      '絵本のページ',
    ]);
    setTalk('');
    setPhase('pages');
  };
  const setHow = (k: number, how: How) => {
    if (how === 'book') setPickFor(k);
    if (how === 'photo') {
      photoFor.current = k;
      photo.current?.click();
    }
    setPages((ps) => ps.map((p, i) => (i === k ? { ...p, how, pic: how === 'words' || how === 'bati' ? null : p.pic } : p)));
  };
  const finish = (done: BookPage[], drawn: boolean) => {
    const b: Book = { ...book, pages: done, picture: true, made: Date.now() };
    putInDrawer(b);
    setBook(b);
    setPhase('closed');
    setTimeout(() => onDone({ picturebook: 'make', ...(drawn ? { pb_drawn: 'true' } : {}) }), 2600);
  };
  const make = async () => {
    const drawn = pages.some((p) => p.how === 'bati');
    if (!drawn) return finish(pages, false);
    setPhase('drawing');
    setBusy(true);
    const out = [...pages];
    for (let k = 0; k < out.length; k++) {
      if (out[k].how !== 'bati') continue;
      try {
        const r = await getApi().stickerArt(out[k].scene || out[k].text.slice(0, 20), style.join('、'));
        out[k] = { ...out[k], pic: r.url };
      } catch (e) {
        out[k] = { ...out[k], how: 'words', pic: null };
        setNote((e as { code?: string })?.code === 'NO_MANA' ? 'マナジェムが光らなかったページは、字だけにしました' : '描けなかったページは、字だけにしました（あとで描き直せます）');
      }
      setPages([...out]);
    }
    setBusy(false);
    finish(out, out.some((p) => p.how === 'bati' && p.pic));
  };
  const HOW: [How, string][] = [
    ['book', 'アート帳から選ぶ'],
    ['bati', `${bati}に描いてもらう`],
    ['photo', '写真を添える'],
    ['words', '字だけ'],
  ];
  const cover = pages.find((p) => p.pic)?.pic;

  return (
    <div className="absolute inset-0 z-[12] flex flex-col items-center justify-end bg-gradient-to-b from-teal-200 via-sky-300 to-teal-700 px-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
      <input
        ref={photo}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          const k = photoFor.current;
          const url = f ? await smallPhoto(f) : null;
          setPages((ps) => ps.map((p, i) => (i === k ? (url ? { ...p, how: 'photo', pic: url } : { ...p, how: 'words' }) : p)));
        }}
      />
      {phase === 'closed' ? (
        <div className="mb-8 flex flex-col items-center" style={{ animation: 'bookShut 0.9s ease-out' }}>
          <div className="relative h-56 w-44 overflow-hidden rounded-r-xl rounded-l-sm border-l-8 border-amber-900 bg-[#fbf6ea] shadow-2xl">
            {cover && <img src={cover} alt="" className="h-36 w-full object-cover" />}
            <p className="p-2 text-center font-serif text-[13px] font-bold text-amber-950">『{book.title}』</p>
            <p className="text-center text-[10px] text-amber-900/60">{neo}</p>
          </div>
          <p className="mt-3 text-[12px] text-teal-950/80">ぱたん。</p>
        </div>
      ) : null}
      <div className="max-h-[70svh] w-full max-w-md space-y-2 overflow-y-auto rounded-3xl border border-teal-100/25 bg-[#062023]/90 p-4 text-teal-50">
        {phase === 'ask' && (
          <>
            <p className="text-center font-serif text-[15px] font-bold">『{book.title}』</p>
            <p className="text-center text-[11px] text-teal-50/60">{bati}が、お話を{book.pages.length}ページに分けました</p>
            <p className="text-center text-[13px]">{bati}「どんな絵にする？　色とか、タッチとか、できるだけ、くわしく教えて！」</p>
            <VoiceField value={talk} onChange={setTalk} placeholder="クレヨンで、にじんだ感じ。夕方みたいな色" maxLength={40} />
            <button onClick={() => toPages(talk.trim())} disabled={!talk.trim()} className={btn}>
              これで話す
            </button>
            <button onClick={() => toPages(OMAKASE[Math.floor(Math.random() * OMAKASE.length)])} className="w-full rounded-full bg-white/10 py-2 text-[12px]">
              おまかせ
            </button>
          </>
        )}
        {phase === 'pages' && (
          <>
            <p className="text-center text-[12px] text-teal-50/80">{bati}「じゃあ、スペルは、こうなるね！」</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {style.map((c) => (
                <button key={c} onClick={() => setStyle((s) => s.filter((x) => x !== c))} className="rounded-md bg-gradient-to-b from-amber-50 to-amber-200 px-2 py-0.5 font-serif text-[12px] font-bold text-amber-900">
                  〈{c}〉
                </button>
              ))}
            </div>
            <p className="text-center text-[10px] text-teal-50/50">どのページにもかかる札（押すと外れます）</p>
            {pages.map((p, k) => (
              <div key={k} className="rounded-2xl bg-white/5 p-2">
                <div className="flex items-start gap-2">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#fbf6ea] text-[10px] text-amber-900/60">{p.pic ? <img src={p.pic} alt="" className="h-full w-full object-cover" /> : k + 1}</div>
                  <div className="min-w-0 flex-1">
                    <span className="rounded bg-amber-100 px-1.5 font-serif text-[11px] font-bold text-amber-900">
                      {k + 1}〈{p.scene || p.text.slice(0, 12)}〉
                    </span>
                    <p className="mt-1 line-clamp-2 text-[11px] text-teal-50/70">{p.text}</p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1">
                  {HOW.map(([h, label]) => (
                    <button key={h} onClick={() => setHow(k, h)} className={`rounded-lg px-1 py-1.5 text-[10px] leading-tight ${p.how === h ? 'bg-teal-300 font-bold text-teal-950' : 'bg-white/10'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {pickFor === k && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {arts.filter((a) => a.url).length ? (
                      arts
                        .filter((a) => a.url)
                        .map((a, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setPages((ps) => ps.map((x, j) => (j === k ? { ...x, how: 'book', pic: a.url } : x)));
                              setPickFor(-1);
                            }}
                            className="h-12 w-12 overflow-hidden rounded-md"
                          >
                            <img src={a.url!} alt="" className="h-full w-full object-cover" />
                          </button>
                        ))
                    ) : (
                      <p className="text-[11px] text-teal-50/60">アート帳に、まだ絵がありません</p>
                    )}
                  </div>
                )}
              </div>
            ))}
            <button onClick={() => (pages.some((p) => p.how === 'bati') ? setPhase('confirm') : void make())} disabled={pages.some((p) => (p.how === 'book' || p.how === 'photo') && !p.pic)} className={btn}>
              絵本にする
            </button>
          </>
        )}
        {phase === 'confirm' && (
          <>
            <p className="text-center text-[13px]">{bati}「このスペルで、ページの絵を描くよ。マナを少し使うけど、いい？」</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => void make()} className={btn}>
                使う
              </button>
              <button onClick={() => setPhase('pages')} className="w-full rounded-full bg-white/10 py-3 text-[12px]">
                やめる（ほかの作り方にする）
              </button>
            </div>
          </>
        )}
        {phase === 'drawing' && (
          <>
            <p className="animate-pulse text-center text-[14px]">{bati}「〈{neo}のお話〉——ページごとに、絵を。」</p>
            <div className="flex justify-center gap-2">
              {pages.map((p, k) => (
                <div key={k} className={`h-16 w-16 overflow-hidden rounded-md bg-[#fbf6ea] ${busy && p.how === 'bati' && !p.pic ? 'animate-pulse ring-2 ring-amber-200' : ''}`}>
                  {p.pic && <img src={p.pic} alt="" className="h-full w-full object-cover" />}
                </div>
              ))}
            </div>
          </>
        )}
        {phase === 'closed' && <p className="text-center text-[12px] text-teal-50/80">{note || '絵本を、引き出しにしまいます'}</p>}
      </div>
      <style>{'@keyframes bookShut{from{transform:perspective(500px) rotateY(-70deg);opacity:.4}to{transform:none;opacity:1}}'}</style>
    </div>
  );
}
