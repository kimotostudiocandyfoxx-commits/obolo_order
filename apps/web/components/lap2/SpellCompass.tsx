'use client';

import type { CompassCard } from '@obolo/shared';
import { useRef, useState } from 'react';
import { saveSpell } from '@/components/jupiter/JupiterLesson';
import { getApi } from '@/lib/api';

/**
 * 〔🧭 スペルコンパス〕 (M-R167/M-R168): point it at a picture you like (Jupiter) or a song (Mercury: a public
 * YouTube link, or ten seconds played next to the phone and heard through 〔🎙〕) and the feather-pen needle spins
 * and stops: the spell is read as small cards, grouped by kind. Before reading, 「何のスペルがほしい？」 —
 * ［全部（ざっくり）］ or one kind (then that kind comes out finely). Each card can be used or left out; 〔全部足す〕
 * and 〔📖 記す〕 too. Real names never become cards; the picture and the sound are not kept; no mana.
 */
const GROUPS = {
  art: ['絵のタッチ', 'キャラ', '背景', '色と光', '構図', '雰囲気'],
  song: ['ジャンル', '速さとリズム', '楽器', '声', '曲の形', '雰囲気'],
} as const;

const toBase64 = (b: Blob) =>
  new Promise<string>((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] ?? '');
    r.onerror = () => no(r.error);
    r.readAsDataURL(b);
  });

/** a picture made smaller before it is sent (the reading needs no more) */
async function shrink(f: File): Promise<{ mime: string; data: string }> {
  try {
    const img = await createImageBitmap(f);
    const s = Math.min(1, 1024 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * s);
    c.height = Math.round(img.height * s);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const b = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.85));
    if (b) return { mime: 'image/jpeg', data: await toBase64(b) };
  } catch {
    /* send as it is */
  }
  return { mime: f.type || 'image/jpeg', data: await toBase64(f) };
}

export function SpellCompass({ kind, onAdd, onClose }: { kind: 'art' | 'song'; onAdd: (cards: string[]) => void; onClose: () => void }) {
  const [focus, setFocus] = useState<string>('');
  const [phase, setPhase] = useState<'pick' | 'spin' | 'cards' | 'fail'>('pick');
  const [cards, setCards] = useState<CompassCard[]>([]);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [url, setUrl] = useState('');
  const [listening, setListening] = useState(false);
  const [noted, setNoted] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const read = async (input: { media?: { mime: string; data: string }; url?: string }) => {
    setPhase('spin');
    try {
      const r = await getApi().compass({ kind, ...(focus ? { focus } : {}), ...input });
      if (!r.cards.length) throw new Error('none');
      setCards(r.cards);
      setOff(new Set());
      setPhase('cards');
    } catch {
      setPhase('fail');
    }
  };
  // ten seconds of the song played next to the phone
  const listen = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
      const rec = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setListening(false);
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        void read({ media: { mime: (blob.type || 'audio/webm').split(';')[0], data: await toBase64(blob) } });
      };
      rec.start();
      setListening(true);
      setTimeout(() => rec.state !== 'inactive' && rec.stop(), 10_000);
    } catch {
      setPhase('fail');
    }
  };
  const chosen = cards.filter((c) => !off.has(c.text)).map((c) => c.text);
  const btn = 'w-full rounded-full border border-amber-200/60 bg-amber-200/15 py-2.5 text-[14px] font-bold text-amber-50 active:scale-[0.98] disabled:opacity-40';

  return (
    <div className="absolute inset-0 z-[40] flex items-end justify-center bg-black/60 px-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
      <div className="max-h-[86svh] w-full max-w-md overflow-y-auto rounded-3xl border border-amber-200/30 bg-[#140f08]/95 p-4 text-amber-50">
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-bold">🧭 スペルコンパス</p>
          <button onClick={onClose} className="text-[12px] text-amber-50/60">
            とじる
          </button>
        </div>
        {phase === 'pick' && (
          <div className="mt-3 space-y-3">
            <p className="text-[12px] text-amber-50/70">何のスペルがほしい？</p>
            <div className="flex flex-wrap gap-1.5">
              {['', ...GROUPS[kind]].map((g) => (
                <button key={g || 'all'} onClick={() => setFocus(g)} className={`rounded-full px-3 py-1 text-[12px] ${focus === g ? 'bg-amber-300 font-bold text-amber-950' : 'bg-white/10'}`}>
                  {g || '全部（ざっくり）'}
                </button>
              ))}
            </div>
            {kind === 'art' ? (
              <>
                <input
                  ref={file}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) void read({ media: await shrink(f) });
                  }}
                />
                <button onClick={() => file.current?.click()} className={btn}>
                  好きな絵を送る
                </button>
              </>
            ) : (
              <>
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="YouTube の曲のURL" className="w-full rounded-xl bg-white/10 px-3 py-2 text-[14px] outline-none placeholder:text-amber-50/40" style={{ fontSize: 16 }} />
                <button onClick={() => void read({ url: url.trim() })} disabled={!/^https:\/\/(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/.test(url.trim())} className={btn}>
                  URLで読み取る
                </button>
                <button onClick={() => void listen()} disabled={listening} className={btn}>
                  {listening ? '🎙 聞いています…（10秒）' : '🎙 スマホのそばで流して聞かせる'}
                </button>
              </>
            )}
            <p className="text-[11px] leading-relaxed text-amber-50/50">人や作品の名前は札にしません。送った{kind === 'art' ? '画像' : '音'}は残しません。マナは使いません</p>
          </div>
        )}
        {phase === 'spin' && (
          <div className="flex flex-col items-center py-8">
            <span className="text-5xl" style={{ animation: 'compassSpin 0.8s linear infinite' }}>
              🪶
            </span>
            <p className="mt-3 animate-pulse text-[13px]">羽ペンが、回っている……</p>
          </div>
        )}
        {phase === 'fail' && (
          <div className="mt-3 space-y-2 text-center">
            <p className="text-[13px] text-amber-50/80">羽ペンが、止まらなかった……。ほかの{kind === 'art' ? '絵' : '曲'}で、もう一度</p>
            <button onClick={() => setPhase('pick')} className={btn}>
              もどる
            </button>
          </div>
        )}
        {phase === 'cards' && (
          <div className="mt-3 space-y-3">
            <p className="text-[12px] text-amber-50/70">{kind === 'art' ? 'この絵のスペルは、こうなってるみたい！' : 'この曲のスペルは、こうなってるみたい！'}（押すと、使う／使わないが切りかわる）</p>
            {GROUPS[kind]
              .filter((g) => cards.some((c) => c.group === g))
              .map((g) => (
                <div key={g}>
                  <p className="text-[10px] tracking-widest text-amber-200/70">{g}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {cards
                      .filter((c) => c.group === g)
                      .map((c) => (
                        <button
                          key={c.text}
                          onClick={() =>
                            setOff((s) => {
                              const n = new Set(s);
                              if (n.has(c.text)) n.delete(c.text);
                              else n.add(c.text);
                              return n;
                            })
                          }
                          className={`rounded-md px-2 py-1 font-serif text-[13px] font-bold ${off.has(c.text) ? 'bg-white/5 text-amber-50/35 line-through' : 'bg-gradient-to-b from-amber-50 to-amber-200 text-amber-900'}`}
                        >
                          〈{c.text}〉
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => onAdd(chosen)} disabled={!chosen.length} className={btn}>
                スペルに足す
              </button>
              <button onClick={() => onAdd(cards.map((c) => c.text))} className={btn}>
                全部足す
              </button>
            </div>
            <button
              onClick={() => {
                saveSpell(chosen);
                setNoted(true);
              }}
              disabled={noted || !chosen.length}
              className="w-full text-center text-[12px] text-violet-200 disabled:text-amber-50/40"
            >
              {noted ? 'スペルブックに記しました' : '📖 記す'}
            </button>
          </div>
        )}
        <style>{'@keyframes compassSpin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  );
}
