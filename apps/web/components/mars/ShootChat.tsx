'use client';

import { useEffect, useRef, useState } from 'react';
import { Face, Mic } from '@/components/mercury/ComposeChat';
import { useAuth } from '@/lib/auth';
import { usePartner } from '@/lib/partner';
import { KINDS, makeVideo, pickKind } from '@/lib/mars/make';
import { fmtLen, type Kind, type Video } from '@/lib/mars/sky';
import { Frame } from './Frame';

/**
 * 撮影 (Mars) — PLACEHOLDER until the client's design (P-MARS-3): talk to your partner and they make
 * the video. KIMORIN until the visitor has Bati (ORDER members), then Bati. Voice first, typing to fix.
 * The finished video goes into the studio's locker (not released), ready to fly as a UFO.
 */
type Msg = { who: 'partner' | 'me'; text: string } | { who: 'video'; video: Video };

export function ShootChat({ onKeep, onOpenStudio, onPreview }: { onKeep: (v: Video) => void; onOpenStudio: () => void; onPreview: (v: Video) => void }) {
  const { me } = useAuth();
  const partner = usePartner();
  const hasBati = partner.isBati;
  const author = me?.displayName || 'neo';

  const [msgs, setMsgs] = useState<Msg[]>([
    {
      who: 'partner',
      text: hasBati
        ? '映像をつくろう！ 撮りたいこと、見せたい場面を話して。わたしが映像にするね。'
        : '撮影するケン！ 撮りたいこと、見せたい場面を話してみろ。オレが映像にしてやるケン。',
    },
  ]);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs, busy, pending]);

  const say = (t: string) => setMsgs((m) => [...m, { who: 'partner', text: t }]);
  const send = () => {
    const t = text.trim();
    if (!t || busy) return;
    setText('');
    setMsgs((m) => [...m, { who: 'me', text: t }]);
    setPending(t);
    setTimeout(() => say(`いいね！ どんな映像にする${hasBati ? '？' : 'ケン？'}`), 500);
  };
  const make = (k: Kind | 'auto') => {
    if (!pending) return;
    const kind = k === 'auto' ? pickKind(pending) : k;
    setMsgs((m) => [...m, { who: 'me', text: k === 'auto' ? 'おまかせ！' : kind }]);
    const words = pending;
    setPending(null);
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setMsgs((m) => [...m, { who: 'partner', text: hasBati ? 'できたよ！ 見てみて。' : 'できたケン！ 見てみろ。' }, { who: 'video', video: makeVideo(words, kind, author) }]);
    }, 2400);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 pb-2 pt-[calc(12px+env(safe-area-inset-top))]">
        <Face face={partner.face} size={40} />
        <div>
          <p className="text-sm font-bold">{partner.name}と撮影</p>
          <p className="text-[11px] text-white/50">話しかけると、{partner.name}が映像にしてくれる（仮の画面）</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.map((m, i) =>
          m.who === 'video' ? (
            <div key={i} className="mx-auto w-full max-w-sm rounded-3xl border border-orange-300/30 bg-gradient-to-b from-[#3a1610] to-[#1a0a08] p-4 shadow-xl">
              <button onClick={() => onPreview(m.video)} className="relative block w-full overflow-hidden rounded-2xl" aria-label="再生">
                <Frame video={m.video} className="aspect-video w-full" />
                <span className="absolute inset-0 flex items-center justify-center text-4xl drop-shadow">▶</span>
              </button>
              <p className="mt-2 font-black">{m.video.title}</p>
              <p className="text-[11px] text-white/55">
                {m.video.kind} ・ {fmtLen(m.video.seconds)} ・ 未公開
              </p>
              <ol className="mt-2 space-y-1 rounded-2xl bg-black/30 p-3 text-xs text-white/85">
                {m.video.scenes.map((s, k) => (
                  <li key={k}>
                    🎬 シーン{k + 1}：{s}
                  </li>
                ))}
              </ol>
              {kept.has(m.video.id) ? (
                <button onClick={onOpenStudio} className="mt-3 w-full rounded-full border border-orange-200/50 py-2 text-sm">
                  🔒 ロッカーにしまいました → スタジオを見る
                </button>
              ) : (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      setPending(m.video.scenes[0]);
                      say('じゃあ、もう一回。どんな映像にする？');
                    }}
                    className="flex-1 rounded-full border border-white/20 py-2 text-xs"
                  >
                    もう一回つくる
                  </button>
                  <button
                    onClick={() => {
                      onKeep(m.video);
                      setKept((s) => new Set(s).add(m.video.id));
                      say(hasBati ? 'スタジオのロッカーにしまったよ。公開すると、UFOになって88時間とんでいくよ。' : 'スタジオのロッカーにしまったケン。公開したら、UFOになって88時間とんでいくぞ！');
                    }}
                    className="flex-[2] rounded-full bg-gradient-to-r from-orange-500 to-fuchsia-600 py-2 text-sm font-bold"
                  >
                    🔒 ロッカーにしまう（未公開）
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div key={i} className={`flex items-end gap-2 ${m.who === 'me' ? 'justify-end' : ''}`}>
              {m.who === 'partner' && <Face face={partner.face} size={32} />}
              <p className={`max-w-[78%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.who === 'me' ? 'rounded-br-sm bg-orange-600/90' : 'rounded-bl-sm bg-white/10'}`}>{m.text}</p>
            </div>
          ),
        )}
        {pending && !busy && (
          <div className="flex flex-wrap justify-end gap-2">
            {KINDS.map((k) => (
              <button key={k.id} onClick={() => make(k.id)} className="rounded-full border border-orange-300/50 bg-orange-500/15 px-3 py-1.5 text-xs">
                {k.label}
              </button>
            ))}
            <button onClick={() => make('auto')} className="rounded-full bg-gradient-to-r from-orange-400 to-fuchsia-500 px-3 py-1.5 text-xs font-bold">
              おまかせ
            </button>
          </div>
        )}
        {busy && (
          <div className="flex items-end gap-2">
            <Face face={partner.face} size={32} />
            <p className="animate-pulse rounded-2xl rounded-bl-sm bg-white/10 px-3 py-2 text-sm">🎬 撮影中…</p>
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2">
        <Mic value={text} onChange={setText} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && send()}
          placeholder="撮りたいことを話してみよう"
          className="min-w-0 flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm outline-none"
        />
        <button onClick={send} disabled={!text.trim() || busy} className="rounded-full bg-orange-600 px-4 py-2.5 text-sm font-bold disabled:opacity-40">
          送る
        </button>
      </div>
    </div>
  );
}
