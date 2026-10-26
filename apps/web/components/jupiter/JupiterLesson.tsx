'use client';

import { useRef, useState } from 'react';
import { Butterfly } from '@/components/jupiter/Butterfly';
import { Big, LessonShell, Later, NextButton, Panel, Soft, type CoachLine } from '@/components/onboarding/LessonShell';
import { VoiceField } from '@/components/onboarding/StoryExtras';
import { spriteUrl } from '@/lib/onboarding/media';
import type { StickerMade } from '@/lib/onboarding/made';

/**
 * Day 4 on Jupiter (first journey; client 2026-10-14): two of yesterday's three kororins become stickers.
 *  1. 大根カイザー: Jupiter is the planet where life lives — words become 『シール』 (stickers)
 *  2. pick 2 of the 3 kororins (words typed / said fresh if fewer are there)
 *  3. each gets a picture: a photo / {bati} draws it (mana, asked first) / words only
 *  4. the two stickers make a sticker book (シール帳); butterflies carry them around Jupiter's sky
 * Kept only for the visitor (nothing is posted: 〔🦋 投稿する〕 opens on the second journey). The lines
 * are this app's (the story left D05-S005〜S008 to the UI, 引き継ぎ §1-3); 大根カイザー ends with 「DA」.
 */
export interface JupiterLessonApi {
  stickerArt(text: string): Promise<{ url: string }>;
  uploadPhoto(blob: Blob): Promise<{ url: string }>;
}

type Beat =
  | { k: 'say'; who: 'kaiser' | 'kimorin' | 'bati' | 'guide'; text: string; choices?: { label: string; reply: { who: 'kaiser' | 'kimorin'; text: string } }[] }
  | { k: 'pick' }
  | { k: 'make'; n: 0 | 1 }
  | { k: 'book' }
  | { k: 'fly' }
  | { k: 'done' };

const BEATS: Beat[] = [
  { k: 'say', who: 'kaiser', text: '木星は、命が宿る星ダ。' },
  { k: 'say', who: 'kaiser', text: '見た景色も、食べたご飯も、ふと思った言葉も。ここでは『シール』になって、思い出として残るのダ。' },
  {
    k: 'say',
    who: 'kaiser',
    text: '百聞は、一見にしかず。……いい言葉DA。我が考えたDA。',
    choices: [
      { label: '「それ、昔からあることわざだよ」', reply: { who: 'kaiser', text: '……なんと。先に言った者が、おったのダ。' } },
      { label: '黙って見ている', reply: { who: 'kimorin', text: '……自分で言って、自分で感動していますね。' } },
    ],
  },
  { k: 'say', who: 'kaiser', text: 'きのう土星で、コロリンを作ったな。その言葉から、シールを作るダ。' },
  { k: 'say', who: 'kaiser', text: '形にしたい言葉を、2つ選ぶダ。' },
  { k: 'pick' },
  { k: 'make', n: 0 },
  { k: 'make', n: 1 },
  { k: 'say', who: 'guide', text: 'シールを、{neo}だけの根っこにしまいました。誰にも送られていません' },
  { k: 'say', who: 'kaiser', text: 'シールが2枚たまったら、それは『シール帳』ダ。' },
  { k: 'book' },
  { k: 'say', who: 'kaiser', text: '木星ではな、蝶は『シール』を持って飛ぶダ。' },
  { k: 'fly' },
  { k: 'done' },
];

const WHO: Record<'kaiser' | 'kimorin' | 'bati' | 'guide', { sprite?: string; name?: string }> = {
  kaiser: { sprite: 'daikon-kaiser', name: '大根カイザー' },
  kimorin: { sprite: 'kimorin-sun', name: 'KIMORIN⭐︎' },
  bati: { name: 'バティ' },
  guide: {},
};

/** A round sticker: the picture (or a soft colour) with the words on a ribbon. */
export function Sticker({ s, size = 140, spin = false }: { s: StickerMade; size?: number; spin?: boolean }) {
  const h = [...s.text].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7) % 360;
  return (
    <div className={`relative shrink-0 rounded-full border-[5px] border-white bg-white shadow-[0_8px_22px_rgba(80,50,20,0.3)] ${spin ? 'animate-[spin_9s_linear_infinite]' : ''}`} style={{ width: size, height: size }}>
      <div className="absolute inset-0 overflow-hidden rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, hsl(${h} 80% 90%), hsl(${(h + 40) % 360} 60% 70%))` }}>
        {s.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.url} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className={`absolute inset-x-[8%] ${s.url ? 'bottom-[12%]' : 'top-1/2 -translate-y-1/2'} text-center`}>
        <span className="inline-block max-w-full rounded-full bg-white/85 px-2 py-0.5 font-bold leading-snug text-stone-700 [word-break:keep-all]" style={{ fontSize: Math.max(9, size * 0.085) }}>
          {s.text}
        </span>
      </div>
    </div>
  );
}

export function JupiterLesson({ api, kororins, neo, bati, batiImage, onDone }: { api: JupiterLessonApi; kororins: string[]; neo: string; bati: string; batiImage?: string; onDone: (stickers: StickerMade[]) => void }) {
  const [i, setI] = useState(0);
  const [reply, setReply] = useState<{ who: 'kaiser' | 'kimorin'; text: string } | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [extra, setExtra] = useState('');
  const [stickers, setStickers] = useState<StickerMade[]>([]);
  const [draft, setDraft] = useState<StickerMade | null>(null);
  const [mode, setMode] = useState<'choose' | 'ask-mana' | 'drawing' | 'burnt' | 'ready'>('choose');
  const [spelled, setSpelled] = useState(false);
  const [flyStep, setFlyStep] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  const beat = BEATS[i];
  const fill = (t: string) => t.replaceAll('{neo}', neo).replaceAll('{bati}', bati);
  const next = () => {
    setReply(null);
    setI((x) => x + 1);
  };
  const words = [...kororins, ...(extra.trim() && !kororins.includes(extra.trim()) ? [extra.trim()] : [])];

  const startMake = (n: number) => {
    setDraft({ text: chosen[n], url: null });
    setMode('choose');
  };
  const keep = () => {
    if (!draft) return;
    const list = [...stickers, draft];
    setStickers(list);
    setDraft(null);
    setMode('choose');
    if (beat.k === 'make' && beat.n === 0) startMake(1);
    next();
  };
  const draw = async () => {
    if (!draft) return;
    setMode('drawing');
    try {
      const r = await api.stickerArt(draft.text);
      setDraft({ ...draft, url: r.url });
      setMode('ready');
    } catch {
      setMode('burnt');
    }
  };
  const photo = async (f: File) => {
    if (!draft) return;
    setMode('drawing');
    try {
      const r = await api.uploadPhoto(f);
      setDraft({ ...draft, url: r.url });
      setMode('ready');
    } catch {
      setMode('choose');
    }
  };

  // --- the resident's line at the top -------------------------------------------------------------------
  let coach: CoachLine | null = null;
  let actions: React.ReactNode = null;
  if (beat.k === 'say') {
    const say = reply ?? beat;
    const w = WHO[say.who];
    coach = { sprite: say.who === 'bati' ? batiImage : w.sprite, name: say.who === 'bati' ? bati : w.name, text: fill(say.text) };
    actions =
      beat.choices && !reply ? (
        beat.choices.map((c) => (
          <button key={c.label} onClick={() => setReply(c.reply)} className="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-bold text-violet-700">
            {c.label}
          </button>
        ))
      ) : (
        <NextButton onClick={next} />
      );
  } else if (beat.k === 'pick') {
    coach = { sprite: WHO.kaiser.sprite, name: WHO.kaiser.name, text: chosen.length < 2 ? `言葉を、あと${2 - chosen.length}つ選ぶDA。` : 'よし。この2つで、シールを作るDA。' };
  } else if (beat.k === 'make') {
    const t = chosen[beat.n];
    coach =
      mode === 'ask-mana'
        ? { sprite: batiImage, name: bati, text: '写真がなくても、ボクが描くよ。マナを少し使うけど、いい？' }
        : mode === 'drawing'
          ? { sprite: batiImage, name: bati, text: `〈${t}〉——ここに、かたちを。` }
          : mode === 'burnt'
            ? { sprite: batiImage, name: bati, text: '魔法陣、ちょっと焦げちゃった……。言葉は残ってるよ。もう1回やる？　字だけにする？' }
            : mode === 'ready'
              ? { sprite: batiImage, name: bati, text: draft?.url ? 'できた！　見て見て！' : '字だけのシールも、いいね！' }
              : { sprite: WHO.kaiser.sprite, name: WHO.kaiser.name, text: `「${t}」に、絵をつけるDA。写真か、${bati}の絵か、字だけか。` };
  } else if (beat.k === 'book') {
    coach = { sprite: WHO.kaiser.sprite, name: WHO.kaiser.name, text: '開いてみるDA。{neo}だけのシール帳DA。'.replace('{neo}', neo) };
    actions = <NextButton onClick={next} />;
  } else if (beat.k === 'fly') {
    const lines: { who: 'kaiser' | 'kimorin' | 'bati' | 'guide'; text: string }[] = [
      { who: 'bati', text: `ちょうちょ！　${neo}のちょうちょだ！` },
      { who: 'kimorin', text: '……飛んだ。オレのが、飛んだケン……！　言葉の翼ケン！' },
      { who: 'kimorin', text: '……失礼。おしゃれですね。' },
      { who: 'guide', text: 'シール蝶は、木星の空を舞うだけで、誰にも送られていません。〔🦋 投稿する〕（届ける）は、二周目からひらきます' },
      { who: 'kaiser', text: `${neo}。今日という日も、ひとつの命DA。` },
      { who: 'bati', text: 'うん！　今日のちょうちょ、ずっと覚えてる！' },
    ];
    const l = lines[Math.min(flyStep, lines.length - 1)];
    coach = { sprite: l.who === 'bati' ? batiImage : WHO[l.who].sprite, name: l.who === 'bati' ? bati : WHO[l.who].name, text: l.text };
    actions = <NextButton onClick={() => (flyStep < lines.length - 1 ? setFlyStep(flyStep + 1) : onDone(stickers))} />;
  }

  return (
    <LessonShell bg="/art/jupiter-bg.jpg" coach={coach} actions={actions}>
      {/* the great tree */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={spriteUrl('jupiter-tree')} alt="" className="pointer-events-none absolute bottom-0 left-1/2 w-[min(110vw,640px)] -translate-x-1/2 opacity-90" aria-hidden />
      {batiImage && beat.k !== 'fly' && (
        // the Bati stays in one place on screen (M-R14)
        // eslint-disable-next-line @next/next/no-img-element
        <img src={batiImage} alt="" className="pointer-events-none absolute bottom-[calc(16px+env(safe-area-inset-bottom))] left-3 z-[170] h-16 w-16 rounded-2xl border-2 border-white/70 object-cover shadow-lg" aria-hidden />
      )}

      {beat.k === 'pick' && (
        <Panel>
          <p className="text-center text-sm font-black text-amber-700">🔒 根っこ（{neo}だけ）</p>
          <p className="mt-0.5 text-center text-[11px] text-slate-400">土星でつぶやいた言葉が、日付つきで並んでいます</p>
          <div className="mt-3 space-y-2">
            {words.map((w) => {
              const on = chosen.includes(w);
              return (
                <button
                  key={w}
                  onClick={() => setChosen((c) => (on ? c.filter((x) => x !== w) : c.length < 2 ? [...c, w] : c))}
                  className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ${on ? 'bg-amber-100 ring-2 ring-amber-400' : 'bg-slate-50'}`}
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${on ? 'bg-amber-400 text-white' : 'bg-white text-slate-300 ring-1 ring-slate-200'}`}>{on ? '✓' : ''}</span>
                  <span className="text-[15px] font-bold leading-snug">{w}</span>
                </button>
              );
            })}
          </div>
          {words.length < 3 && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-bold text-slate-500">新しく言う（声か文字）</p>
              <VoiceField value={extra} onChange={setExtra} placeholder="いま思ったこと" maxLength={30} />
            </div>
          )}
          <div className="mt-3">
            <Big
              tone="amber"
              disabled={chosen.length < 2}
              onClick={() => {
                startMake(0);
                next();
              }}
            >
              この2つで、シールを作る
            </Big>
          </div>
        </Panel>
      )}

      {beat.k === 'make' && draft && (
        <Panel>
          <p className="text-center text-xs font-black text-amber-700">シール {beat.n + 1}／2</p>
          <div className="mt-2 flex justify-center">
            <div className={mode === 'drawing' ? 'animate-pulse' : ''}>
              <Sticker s={draft} size={150} />
            </div>
          </div>
          <input
            ref={file}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void photo(f);
            }}
          />
          {mode === 'choose' && (
            <div className="mt-4 space-y-2">
              <Big tone="sky" onClick={() => file.current?.click()}>
                📷 写真を添える
              </Big>
              <Big
                tone="violet"
                onClick={() => {
                  setMode('ask-mana');
                  if (!spelled) setSpelled(true);
                }}
              >
                🎨 {bati}に描いてもらう
              </Big>
              <Soft onClick={() => setMode('ready')}>🔤 字だけ</Soft>
              <p className="text-center text-[11px] leading-relaxed text-slate-400">人が写っている写真は、その人がいいと言ったものだけ使おう</p>
            </div>
          )}
          {mode === 'ask-mana' && (
            <div className="mt-4 space-y-2">
              <Big tone="violet" onClick={() => void draw()}>
                使う
              </Big>
              <Soft onClick={() => setMode('choose')}>やめる</Soft>
            </div>
          )}
          {mode === 'drawing' && <p className="mt-4 text-center text-sm font-bold text-violet-500">✨ 魔法陣を描いています…</p>}
          {mode === 'burnt' && (
            <div className="mt-4 space-y-2">
              <Big tone="violet" onClick={() => void draw()}>
                もう1回
              </Big>
              <Soft onClick={() => setMode('ready')}>字だけにする</Soft>
            </div>
          )}
          {mode === 'ready' && (
            <div className="mt-4 space-y-2">
              <Big tone="amber" onClick={keep}>
                しまう
              </Big>
              <Soft
                onClick={() => {
                  setDraft({ ...draft, url: null });
                  setMode('choose');
                }}
              >
                絵を変える
              </Soft>
              <Later label="🦋 投稿する" />
            </div>
          )}
        </Panel>
      )}

      {beat.k === 'book' && (
        <div className="absolute inset-x-0 bottom-[12svh] z-[175] flex justify-center px-4">
          <div className="flex animate-[fadeUp_0.6s_ease-out] gap-1 rounded-3xl bg-[#7a5230] p-2 shadow-2xl">
            {stickers.map((s, k) => (
              <div key={k} className={`flex h-56 w-40 items-center justify-center bg-[#f6ead2] ${k === 0 ? 'rounded-l-2xl' : 'rounded-r-2xl'} shadow-inner`}>
                <Sticker s={s} size={120} />
              </div>
            ))}
          </div>
        </div>
      )}

      {beat.k === 'fly' && (
        <div className="pointer-events-none absolute inset-0 z-[160]">
          {[...stickers, { text: '私、宇宙一の天才発明家', url: spriteUrl('kimorin-face') }].map((s, k) => (
            <div key={k} className="absolute" style={{ left: `${15 + k * 28}%`, top: `${38 + (k % 2) * 12}%`, animation: `stickerFly ${7 + k * 1.5}s ease-in-out ${k * 0.6}s infinite` }}>
              <div className="relative">
                <Butterfly emoji="" size={110} wing={['#f5b971', '#a8d8ea', '#f7a8c8'][k % 3]} />
                <div className="absolute left-1/2 top-[70%] -translate-x-1/2">
                  <Sticker s={s} size={64} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </LessonShell>
  );
}
