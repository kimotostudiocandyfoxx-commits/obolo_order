'use client';

import type { BuddyPicture } from '@obolo/shared';
import { useEffect, useRef, useState } from 'react';
import { getApi } from '@/lib/api';
import { saveSpell } from '@/components/jupiter/JupiterLesson';
import { VoiceField } from './StoryExtras';

/**
 * 〔💬 バティに聞く〕 (D03-S008 「はじめての、おしゃべり」, M-R138〜140): a chat like any other — Bati's face on top
 * (its expressions change with the talk: sparkle → think → surprise → smile), the bubbles, and the big 〔🎙〕 at
 * the bottom (⌨ in the corner). Bati looks things up by magic: it closes its eyes, says the spell 「〈問い〉——ここに、
 * こたえを。」, the mana gem glows and letters of light unwind; the answer comes in words first, and 〔🖼 絵で見る〕
 * under it brings a picture from a library whose pictures may be used, with its source — no mana (M-R147). Every
 * answer carries the 'can be wrong' line. No counts, no numbers, no "AI". A talk is gone when closed unless
 * 〔この話を残す〕 keeps it (R21b, M-R119): only kept talks are listed under 〔📜 前の話〕 (on this device, TALKS_KEY).
 */
/** a tenth of a second of silence (WAV) */
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
export const TALKS_KEY = 'obolo.batiTalks';
type Talk = { at: string; lines: { who: 'me' | 'bati'; text: string }[] };
function loadTalks(): Talk[] {
  try {
    return JSON.parse(localStorage.getItem(TALKS_KEY) ?? '[]') as Talk[];
  } catch {
    return [];
  }
}
// noPic: a worry or a danger — no 〔🖼 絵で見る〕 under it (generation test 1, G-4)
type Msg = { id: number; who: 'me' | 'bati'; text: string; q?: string; picture?: BuddyPicture | null; picLoading?: boolean; noPic?: boolean };
const EXAMPLES = ['ビッグバンって、いつ起きたの？', 'ブラックホールの正体って、なに？', '宇宙の果てって、あるの？'];

export function BatiChat(props: Parameters<typeof BatiChatFull>[0] & { muted?: boolean }) {
  return props.first ? <BatiFirstTalk {...props} /> : <BatiChatFull {...props} />;
}

/** how many answers the first talk on the Moon lasts (M-R179: about five rounds, then {bati} grows sleepy) */
const FIRST_ROUNDS = 5;
const sentences = (t: string) => (t.match(/[^。！？!?\n]+[。！？!?]*/g) ?? [t]).map((x) => x.trim()).filter(Boolean);

/**
 * D03-S008 「はじめての、おしゃべり」 as M-R179 has it: no how-to, no examples, no buttons — a chat where {neo} and
 * {bati} talk freely for about five rounds. {bati}'s answer comes in words at once and in {bati}'s own voice as each
 * sentence is made (words alone if the voice does not come); a picture, when there is one, comes inside the answer
 * with its source. One small line at the bottom says the answers can be wrong. Nothing is kept, no numbers.
 */
function BatiFirstTalk({ bati, neo, image, faces, me, muted = false, onDone }: { bati: string; neo: string; image?: string; faces?: Partial<Record<string, string>>; me?: string; muted?: boolean; onDone: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]); // its first words were said as a story line just before (no second time)
  const [q, setQ] = useState('');
  const [face, setFace] = useState<string>('sparkle');
  const [casting, setCasting] = useState(false);
  const [rounds, setRounds] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs, casting]);
  const pic = faces?.[face] || image;
  // the voice: one sentence after another, each played as soon as it is made
  const playing = useRef<HTMLAudioElement | null>(null);
  const gen = useRef(0);
  useEffect(() => () => void (gen.current++, playing.current?.pause()), []);
  const sayAloud = async (text: string) => {
    const g = ++gen.current;
    if (muted) return;
    const parts = sentences(text).slice(0, 4);
    const urls = parts.map((t) => getApi().batiSays(t).then((r) => r.url).catch(() => null));
    for (const u of urls) {
      const url = await u;
      if (g !== gen.current) return;
      if (!url) continue;
      await new Promise<void>((done) => {
        // the one element opened by the tap that asked (iOS plays a fresh Audio only inside a tap)
        const a = (playing.current ??= new Audio());
        const t = setTimeout(done, 15_000);
        a.onended = () => (clearTimeout(t), done());
        a.onerror = () => (clearTimeout(t), done());
        a.src = url;
        a.play().catch(() => (clearTimeout(t), done()));
      });
    }
  };
  /** inside the tap: open the voice's element with a moment of silence, so its later play() is allowed */
  const openVoice = () => {
    if (muted) return;
    try {
      const a = (playing.current ??= new Audio());
      a.src = SILENCE;
      void a.play().catch(() => undefined);
    } catch {
      /* no sound */
    }
  };

  const ask = async (text: string) => {
    const t = text.trim();
    if (!t || casting || rounds >= FIRST_ROUNDS) return;
    gen.current++;
    playing.current?.pause();
    openVoice();
    setQ('');
    setMsgs((m) => [...m, { id: m.length, who: 'me', text: t }]);
    setFace('think');
    setCasting(true);
    const started = Date.now();
    let reply = '';
    let noPic = false;
    try {
      // at most 20 s: a set answer counts as a round, so the talk always reaches its end (story chat 2026-10-29)
      const r = await Promise.race([getApi().buddyChat(t, 'ja'), new Promise<never>((_, no) => setTimeout(() => no(new Error('slow')), 20_000))]);
      reply = r.reply.text;
      noPic = !!r.kind && r.kind !== 'normal';
    } catch {
      reply = 'むむ…いまは、うまく調べられなかった！　ほかのこと、聞いてみて！';
      noPic = true;
    }
    // the magic takes a moment, even when the answer is quick
    await new Promise((r) => setTimeout(r, Math.max(0, 1200 - (Date.now() - started))));
    setCasting(false);
    setFace('surprise');
    const id = Date.now();
    setMsgs((m) => [...m, { id, who: 'bati', text: reply, q: t, noPic, picLoading: !noPic }]);
    setTimeout(() => setFace('smile'), 1400);
    const n = rounds + 1;
    setRounds(n);
    const voice = sayAloud(reply);
    // a picture, when there is one, comes into the answer by itself (no button: M-R179)
    if (!noPic)
      void getApi()
        .buddyPicture(t, reply)
        .then((r) => r.picture)
        .catch(() => null)
        .then((picture) => setMsgs((all) => all.map((x) => (x.id === id ? { ...x, picLoading: false, picture } : x))));
    // about five rounds: {bati} grows sleepy once the last answer has been said
    if (n >= FIRST_ROUNDS) {
      await Promise.race([voice, new Promise((r) => setTimeout(r, 12_000))]);
      await new Promise((r) => setTimeout(r, 1500));
      setFace('yawn');
      setTimeout(onDone, 1600);
    }
  };

  return (
    <div className="absolute inset-0 z-[12] flex flex-col bg-gradient-to-b from-[#0a0f24] via-[#0b0a1a] to-black text-amber-50">
      {/* {bati}, its face changing with the talk */}
      <div className={`pt-safe relative mx-auto mt-12 w-28 ${pic ? 'h-28' : 'h-0'}`}>
        {pic && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pic} alt="" className="h-full w-full object-contain drop-shadow-[0_0_18px_rgba(255,220,150,0.35)] transition-opacity duration-300" />
        )}
        {casting && <div className="pointer-events-none absolute inset-[-25%] animate-[spin_3s_linear_infinite] rounded-full border border-dashed border-amber-200/50" />}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-3 pt-3">
        {msgs.map((m) =>
          m.who === 'me' ? (
            <div key={m.id} className="flex items-end justify-end gap-2">
              <p className="max-w-[72%] rounded-2xl rounded-br-sm bg-amber-200/90 px-3 py-2 text-[14px] text-amber-950">{m.text}</p>
              {me && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-amber-200/60" />
              )}
            </div>
          ) : (
            <div key={m.id} className="max-w-[86%] space-y-1.5 rounded-2xl rounded-bl-sm bg-white/10 px-3 py-2">
              <p className="text-[14px] leading-relaxed">
                <span className="mr-1 text-[10px] tracking-widest text-amber-200/70">{bati}</span>
                {m.text}
              </p>
              {m.picture && (
                <figure className="overflow-hidden rounded-xl bg-black/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.picture.url} alt={m.picture.title} className="max-h-56 w-full object-contain" />
                  <figcaption className="px-2 py-1 text-[10px] text-amber-50/55">
                    {m.picture.title}
                    <a href={m.picture.pageUrl} target="_blank" rel="noreferrer" className="ml-1 underline">
                      出どころ：{m.picture.source}
                    </a>
                  </figcaption>
                </figure>
              )}
            </div>
          ),
        )}
        {casting && <p className="animate-pulse pl-2 text-[18px] tracking-[0.3em] text-amber-100/80">…</p>}
        <div ref={end} />
      </div>
      <div className="pb-safe space-y-2 px-4 pb-3">
        {rounds < FIRST_ROUNDS && (
          <>
            <VoiceField value={q} onChange={setQ} placeholder="" maxLength={120} />
            {q.trim() && (
              <button onClick={() => void ask(q)} disabled={casting} className="w-full rounded-full border border-amber-200/50 bg-amber-200/10 py-2.5 text-[14px] disabled:opacity-40">
                {bati}に話す
              </button>
            )}
          </>
        )}
        <p className="text-center text-[10px] text-amber-50/40">{bati}の答えが、まちがっていることもあります</p>
      </div>
    </div>
  );
}

function BatiChatFull({
  bati,
  neo,
  image,
  faces,
  first,
  me,
  spell = false,
  onDone,
}: {
  /** Obolo Order (L2 Moon, M-R166): an answer can be kept in the spellbook as cards */
  spell?: boolean;
  bati: string;
  neo: string;
  image?: string;
  faces?: Partial<Record<string, string>>;
  /** the first chat (day 2): the three-line how-to */
  first: boolean;
  /** the visitor's round icon, beside their own bubbles (M-R149) */
  me?: string;
  onDone: () => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, who: 'bati', text: first ? `ねえ、${neo}。宇宙のことで、知りたいこと、ある？　ボク、調べてみる！` : 'なにを調べる？　宇宙のことじゃなくても、何でも聞いてね！' }]);
  const [q, setQ] = useState('');
  const [face, setFace] = useState<string>('sparkle');
  const [casting, setCasting] = useState<string | null>(null);
  const [asked, setAsked] = useState(false);
  const [history, setHistory] = useState<{ who: string; text: string }[] | null>(null);
  const [kept, setKept] = useState(false);
  const [noted, setNoted] = useState<Set<number>>(new Set());
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs, casting]);
  const pic = faces?.[face] || image;

  const ask = async (text: string) => {
    const t = text.trim();
    if (!t || casting) return;
    setQ('');
    setMsgs((m) => [...m, { id: m.length, who: 'me', text: t }]);
    setFace('think');
    setCasting(t);
    const started = Date.now();
    let reply = '';
    let noPic = false;
    try {
      const r = await getApi().buddyChat(t, 'ja');
      reply = r.reply.text;
      noPic = !!r.kind && r.kind !== 'normal';
    } catch {
      reply = 'うーん、いまは、うまく調べられなかった……。また聞いてね。';
    }
    // the spell takes a moment, even when the answer is quick
    await new Promise((r) => setTimeout(r, Math.max(0, 2200 - (Date.now() - started))));
    setCasting(null);
    setFace('surprise');
    setMsgs((m) => [...m, { id: m.length, who: 'bati', text: reply, q: t, noPic }]);
    setAsked(true);
    setTimeout(() => setFace('smile'), 1400);
  };
  const showPicture = async (id: number) => {
    const m = msgs.find((x) => x.id === id);
    if (!m?.q) return;
    setMsgs((all) => all.map((x) => (x.id === id ? { ...x, picLoading: true } : x)));
    let picture: BuddyPicture | null = null;
    try {
      picture = (await getApi().buddyPicture(m.q, m.text)).picture;
    } catch {
      picture = null;
    }
    setMsgs((all) => all.map((x) => (x.id === id ? { ...x, picLoading: false, picture } : x)));
  };
  // only the talks kept with 〔この話を残す〕
  const openHistory = () => setHistory(loadTalks().flatMap((t) => t.lines.map((l) => ({ who: l.who === 'me' ? neo : bati, text: l.text }))));
  const keepTalk = () => {
    try {
      const talk: Talk = { at: new Date().toISOString(), lines: msgs.slice(1).map((m) => ({ who: m.who, text: m.text })) };
      localStorage.setItem(TALKS_KEY, JSON.stringify([...loadTalks(), talk].slice(-50)));
    } catch {
      /* private mode */
    }
    setKept(true);
  };

  return (
    <div className="absolute inset-0 z-[12] flex flex-col bg-gradient-to-b from-[#0a0f24] via-[#0b0a1a] to-black text-amber-50">
      <div className="pt-safe flex items-center justify-between px-4 pt-12">
        <button onClick={openHistory} className="rounded-full bg-white/10 px-3 py-1.5 text-[12px]">
          📜 前の話
        </button>
        <p className="text-[13px] tracking-widest text-amber-100/80">💬 {bati}に聞く</p>
        <span className="w-16" />
      </div>
      {/* Bati, its face changing with the talk */}
      <div className={`relative mx-auto mt-2 w-28 ${pic ? 'h-28' : 'h-0'}`}>
        {pic && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pic} alt="" className="h-full w-full object-contain drop-shadow-[0_0_18px_rgba(255,220,150,0.35)] transition-opacity duration-300" />
        )}
        {casting && (
          <div className="pointer-events-none absolute inset-[-30%] animate-[spin_3s_linear_infinite] rounded-full border border-dashed border-amber-200/60 text-[10px] text-amber-200/80">
            {'✦ﾏﾅ✧ᚱ✦ᛟ✧ᚨ✦'.split('').map((ch, k) => (
              <span key={k} className="absolute left-1/2 top-1/2" style={{ transform: `rotate(${k * 33}deg) translateY(-70px)` }}>
                {ch}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-3 pt-3">
        {/* the how-to comes one step at a time, at the moment it is used (M-R169) */}
        {first && !asked && <p className="rounded-2xl bg-white/[0.06] px-3 py-2 text-[12px] leading-relaxed text-amber-50/75">使い方｜〔🎙〕を押して、知りたいことを話してみよう（宇宙のことでも、それ以外のことでも、何でも）</p>}
        {msgs.map((m) =>
          m.who === 'me' ? (
            <div key={m.id} className="flex items-end justify-end gap-2">
              <p className="max-w-[72%] rounded-2xl rounded-br-sm bg-amber-200/90 px-3 py-2 text-[14px] text-amber-950">{m.text}</p>
              {me && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-amber-200/60" />
              )}
            </div>
          ) : (
            <div key={m.id} className="max-w-[86%] space-y-1.5">
              <p className="rounded-2xl rounded-bl-sm bg-white/10 px-3 py-2 text-[14px] leading-relaxed">
                <span className="mr-1 text-[10px] tracking-widest text-amber-200/70">{bati}</span>
                {m.text}
              </p>
              {m.q && (
                <>
                  {m.noPic ? null : m.picture ? (
                    <figure className="overflow-hidden rounded-xl bg-black/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.picture.url} alt={m.picture.title} className="max-h-64 w-full object-contain" />
                      <figcaption className="px-2 py-1 text-[11px] text-amber-50/80">
                        {m.picture.title}
                        <a href={m.picture.pageUrl} target="_blank" rel="noreferrer" className="block text-[10px] text-amber-50/55 underline">
                          出どころ：{m.picture.source}
                        </a>
                      </figcaption>
                    </figure>
                  ) : m.picture === null ? (
                    <p className="text-[11px] text-amber-50/55">ぴったりの絵は、見つからなかった……</p>
                  ) : m.picLoading ? (
                    <p className="animate-pulse text-[12px] text-amber-100/70">絵を、さがしている……</p>
                  ) : (
                    <>
                      <button onClick={() => void showPicture(m.id)} className="rounded-full border border-amber-200/40 px-3 py-1 text-[12px]">
                        🖼 絵で見る
                      </button>
                      {first && !msgs.some((x) => x.picture !== undefined) && <p className="text-[11px] text-amber-50/60">〔🖼 絵で見る〕を押すと、調べてきた写真や図も見られます</p>}
                    </>
                  )}
                  {spell && (
                    <button
                      onClick={() => {
                        saveSpell(m.text.split(/[、。！？!?\s　]+/).filter((w) => w.length > 1).slice(0, 6));
                        setNoted((n) => new Set(n).add(m.id));
                      }}
                      disabled={noted.has(m.id)}
                      className="text-[11px] text-violet-200 disabled:text-amber-50/40"
                    >
                      {noted.has(m.id) ? 'スペルブックに記しました' : '📖 記す'}
                    </button>
                  )}
                  <p className="text-[10px] leading-snug text-amber-50/45">{bati}の答えが、まちがっていることもあります。大事なことは、自分でも確かめてね</p>
                </>
              )}
            </div>
          ),
        )}
        {casting && <p className="animate-pulse text-center text-[13px] text-amber-100/85">〈{casting}〉——ここに、こたえを。</p>}
        <div ref={end} />
      </div>
      <div className="pb-safe space-y-2 px-4 pb-4">
        {!asked && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {EXAMPLES.map((e) => (
              <button key={e} onClick={() => void ask(e)} className="rounded-full bg-white/10 px-3 py-1.5 text-[11px]">
                {e}
              </button>
            ))}
          </div>
        )}
        <VoiceField value={q} onChange={setQ} placeholder="ブラックホールの正体って、なに？" maxLength={120} />
        <div className="flex gap-2">
          <button onClick={() => void ask(q)} disabled={!q.trim() || !!casting} className="flex-1 rounded-full border border-amber-200/50 bg-amber-200/10 py-3 text-[14px] disabled:opacity-40">
            {asked ? 'もっと聞いてみる' : '聞く'}
          </button>
          {asked && (
            <button onClick={onDone} disabled={!!casting} className="flex-1 rounded-full bg-white/5 py-3 text-[14px] text-amber-50/75">
              今日は、ここまで
            </button>
          )}
        </div>
        {first && asked && msgs.some((x) => x.picture !== undefined) && !kept && <p className="text-center text-[11px] text-amber-50/60">気に入った話は〔この話を残す〕。左上の〔📜 前の話〕から、いつでも続きを聞けます</p>}
        {asked && (
          <button onClick={keepTalk} disabled={kept || !!casting} className="mx-auto block text-[12px] text-amber-100/80 disabled:text-amber-50/40">
            {kept ? '📜 この話を残しました' : '📜 この話を残す'}
          </button>
        )}
      </div>
      {history && (
        <div className="absolute inset-0 z-10 flex flex-col bg-black/85 px-4 pb-6 pt-[calc(16px+env(safe-area-inset-top))]" onClick={() => setHistory(null)}>
          <p className="text-center text-[13px] tracking-widest">📜 前の話</p>
          <div className="mt-3 flex-1 space-y-2 overflow-y-auto text-[13px]">
            {history.length ? history.map((h, k) => <p key={k}><span className="mr-1 text-[10px] text-amber-200/70">{h.who}</span>{h.text}</p>) : <p className="text-center text-amber-50/50">まだ、残した話はありません</p>}
          </div>
          <button className="mt-3 rounded-full bg-white/10 py-3 text-[14px]">とじる</button>
        </div>
      )}
    </div>
  );
}
