'use client';

import type { NeoLookBody, NeoLookCandidate, NeoLookResult } from '@obolo/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fileToReference } from '@/lib/look';
import { spriteUrl } from '@/lib/onboarding/media';
import { NeoChooser } from './NeoChooser';

/**
 * Day 3: making the visitor's OBOLO NEO look (client decisions 2026-10-05).
 *  - 画像から: a reference picture they like. KIMORIN asks TWO questions so the result is original:
 *      1) which part of it they love (only that is taken), 2) what twist makes it theirs.
 *    The picture is only read for the request, never stored, and the prompt forbids copying any
 *    existing character.
 *  - 質問から: three questions (animal / colour / vibe), for anyone without a picture.
 *  Four candidates (3 tries), then refine the chosen one in words (3 times). If generation fails,
 *  the eight preset forms are offered so the story always moves on.
 */
export interface LookApi {
  candidates(body: NeoLookBody): Promise<NeoLookResult>;
  refine(id: string, instruction: string): Promise<NeoLookResult>;
  choose(id: string): Promise<string>;
  chooseForm(formId: string): Promise<void>;
}

type Phase = 'entry' | 'upload' | 'liked' | 'twist' | 'ask' | 'making' | 'pick' | 'refine' | 'failed' | 'forms';

const Q3 = [
  { key: 'animal', label: '好きな動物は？', chips: ['キツネ', 'ネコ', 'ウサギ', 'オオカミ', 'フクロウ', 'リュウ'] },
  { key: 'color', label: '好きな色は？', chips: ['赤', '青', '紫', '金', '黒', '白'] },
  { key: 'mood', label: 'どんな雰囲気になりたい？', chips: ['ミステリアス', 'クール', 'かわいい', '元気', 'やさしい', '強そう'] },
] as const;
const LIKED = ['色づかい', '服・フード', '耳やしっぽ', '目つき', '全体の雰囲気'];
const TWIST = ['色を自分の好きな色に変える', '別の動物にする', '星の杖を持たせる', 'マントをつける', '体に模様を入れる'];
const REFINE = ['もっと明るく', 'もっとクールに', '色を青に', '目をやさしく', '小物を足して'];
const WAIT = ['いい感じだケン…', '星のかけらを集めてるケン…', 'もう少しだ…！', '創って創って、創りまくるケン…'];

export function LookMaker({ api, onDone }: { api: LookApi; onDone: (url: string | null) => void }) {
  const [phase, setPhase] = useState<Phase>('entry');
  const [ans, setAns] = useState({ animal: '', color: '', mood: '' });
  const [ref, setRef] = useState<{ mime: 'image/jpeg'; data: string; url: string } | null>(null);
  const [liked, setLiked] = useState('');
  const [twist, setTwist] = useState('');
  const [cands, setCands] = useState<NeoLookCandidate[]>([]);
  const [left, setLeft] = useState(3);
  const [refinesLeft, setRefinesLeft] = useState(3);
  const [sel, setSel] = useState<NeoLookCandidate | null>(null);
  const [history, setHistory] = useState<NeoLookCandidate[]>([]);
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [w, setW] = useState(0);
  const back = useRef<Phase>('entry');
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (phase !== 'making') return;
    const id = setInterval(() => setW((x) => x + 1), 2200);
    return () => clearInterval(id);
  }, [phase]);

  const fail = (e: unknown, to: Phase) => {
    setErr(e instanceof Error ? e.message : String(e));
    setPhase(to);
  };

  const make = async () => {
    setErr(null);
    back.current = phase;
    setPhase('making');
    try {
      const body: NeoLookBody = ref ? { reference: { mime: ref.mime, data: ref.data }, liked, twist } : ans;
      const r = await api.candidates(body);
      setLeft(r.triesLeft);
      if (r.refinesLeft !== undefined) setRefinesLeft(r.refinesLeft);
      if (!r.candidates.length) return setPhase('failed');
      setCands(r.candidates);
      setSel(null);
      setPhase('pick');
    } catch (e) {
      if (/作り直せません|LOOK_TRIES/.test(String(e))) setLeft(0);
      fail(e, cands.length ? 'pick' : 'failed');
    }
  };

  const refine = async () => {
    if (!sel || !instruction.trim()) return;
    setErr(null);
    setPhase('making');
    try {
      const r = await api.refine(sel.id, instruction.trim());
      if (r.refinesLeft !== undefined) setRefinesLeft(r.refinesLeft);
      if (r.candidates[0]) {
        setHistory((h) => [...h, sel]);
        setSel(r.candidates[0]);
        setInstruction('');
      } else setErr('うまく描き直せなかったケン……');
      setPhase('refine');
    } catch (e) {
      if (/描き直せません|LOOK_REFINES/.test(String(e))) setRefinesLeft(0);
      fail(e, 'refine');
    }
  };

  const decide = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      onDone(await api.choose(sel.id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  if (phase === 'forms')
    return (
      <NeoChooser
        onChoose={async (id) => {
          await api.chooseForm(id);
          onDone(null);
        }}
      />
    );

  if (phase === 'making')
    return (
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black/80 backdrop-blur-sm">
        <div className="relative h-40 w-40">
          <span className="absolute inset-0 animate-ping rounded-full bg-amber-200/20" />
          <span className="absolute inset-6 animate-[spin-slow_6s_linear_infinite] rounded-full border-2 border-dashed border-amber-200/60" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={spriteUrl('kimorin-face')} alt="" className="absolute inset-10 rounded-full" />
        </div>
        <p className="tracking-widest text-amber-100">{WAIT[w % WAIT.length]}</p>
        <p className="text-xs text-white/50">君の姿を創っています（30秒ほど）</p>
      </div>
    );

  if (phase === 'entry')
    return (
      <Panel>
        <Kimorin>どうやって創る？</Kimorin>
        <div className="mt-4 flex flex-col gap-2">
          <Gold onClick={() => setPhase('upload')}>🖼 イメージに近い画像から創る</Gold>
          <button
            onClick={() => {
              setRef(null);
              setPhase('ask');
            }}
            className="rounded-full border border-white/30 py-3 text-sm"
          >
            💬 質問に答えて創る
          </button>
        </div>
      </Panel>
    );

  if (phase === 'upload')
    return (
      <Panel>
        <Kimorin>{'イメージに近い画像を見せてくれ。\n好きなキャラの絵でも、ペットや物の写真でもいいケン。'}</Kimorin>
        <p className="mt-2 rounded-xl bg-white/5 p-3 text-[11px] leading-relaxed text-white/60">
          画像は「イメージの参考」にするだけで、保存はしません。そっくりそのままのキャラクターは作れません。いいところだけもらって、君だけのオリジナルに創りかえます。
        </p>
        {ref ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ref.url} alt="" className="mx-auto mt-3 max-h-48 rounded-2xl" />
        ) : null}
        <input
          ref={file}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              setRef(await fileToReference(f));
            } catch {
              setErr('この画像は読み込めなかったケン');
            }
          }}
        />
        <div className="mt-3 flex flex-col gap-2">
          <button onClick={() => file.current?.click()} className="rounded-full border border-amber-200/50 py-3 text-sm">
            {ref ? '別の画像にする' : '＋ 画像を選ぶ'}
          </button>
          <Gold disabled={!ref} onClick={() => setPhase('liked')}>
            この画像でいく
          </Gold>
          <Back onClick={() => setPhase('entry')} />
          {err && <p className="text-center text-xs text-rose-300">{err}</p>}
        </div>
      </Panel>
    );

  // KIMORIN's originality question 1: take only the part they love
  if (phase === 'liked')
    return (
      <Panel>
        {ref && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ref.url} alt="" className="mx-auto mb-3 max-h-28 rounded-xl opacity-80" />
        )}
        <Kimorin>{'いい画像だケン。\nこの絵の、どこがいちばん好きだ？\nそこだけを、いただくぞ。'}</Kimorin>
        <Field value={liked} onChange={setLiked} chips={LIKED} placeholder="例：フードとサングラス" />
        <div className="mt-3 flex flex-col gap-2">
          <Gold disabled={!liked.trim()} onClick={() => setPhase('twist')}>
            つぎへ
          </Gold>
          <Back onClick={() => setPhase('upload')} />
        </div>
      </Panel>
    );

  // KIMORIN's originality question 2: their own twist
  if (phase === 'twist')
    return (
      <Panel>
        <Kimorin>{'そのままだと、ただのマネだからな。\nそこに、君だけのアレンジを足すケン。\n何を変える？ 何を足す？'}</Kimorin>
        <Field value={twist} onChange={setTwist} chips={TWIST} placeholder="例：色を青にして、星の杖を持たせる" />
        <div className="mt-3 flex flex-col gap-2">
          <Gold disabled={!twist.trim()} onClick={make}>
            ✦ 姿を創る（あと{left}回）
          </Gold>
          <Back onClick={() => setPhase('liked')} />
          {err && <p className="text-center text-xs text-rose-300">{err}</p>}
        </div>
      </Panel>
    );

  if (phase === 'failed')
    return (
      <Panel>
        <p className="text-center text-amber-100">うまく創れなかったケン……</p>
        <p className="mt-1 text-center text-xs text-white/55">{left > 0 ? 'もう一度ためすか、用意した姿から選んでくれ。' : '用意した姿から選んでくれ。'}</p>
        <div className="mt-4 flex flex-col gap-2">
          {left > 0 && <Gold onClick={() => setPhase(ref ? 'twist' : 'ask')}>もう一度創る（あと{left}回）</Gold>}
          <button onClick={() => setPhase('forms')} className="rounded-full border border-white/30 py-3 text-sm">
            用意された8つの姿から選ぶ
          </button>
        </div>
      </Panel>
    );

  if (phase === 'pick')
    return (
      <Panel>
        <Kimorin>気に入った姿をえらぶケン</Kimorin>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {cands.map((c) => (
            <button key={c.id} onClick={() => setSel(c)} className={`overflow-hidden rounded-2xl border-4 transition ${sel?.id === c.id ? 'scale-[1.03] border-amber-300 shadow-[0_0_24px_rgba(255,200,90,0.6)]' : 'border-transparent opacity-85'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.url} alt="" className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <Gold disabled={!sel} onClick={() => setPhase('refine')}>
            この姿で進む
          </Gold>
          {left > 0 ? (
            <button onClick={() => setPhase(ref ? 'liked' : 'ask')} className="rounded-full border border-white/30 py-2.5 text-sm">
              最初から作り直す（あと{left}回）
            </button>
          ) : (
            <p className="text-center text-xs text-white/50">最初からの作り直しはもうできないケン</p>
          )}
          {err && <p className="text-center text-xs text-rose-300">{err}</p>}
        </div>
      </Panel>
    );

  if (phase === 'refine' && sel)
    return (
      <Panel>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sel.url} alt="" className="mx-auto aspect-square w-[min(70vw,300px)] rounded-3xl border-2 border-amber-200/60 object-cover shadow-[0_0_30px_rgba(255,200,90,0.35)]" />
        {history.length > 0 && (
          <div className="mt-2 flex justify-center gap-2">
            {history.map((h) => (
              <button
                key={h.id}
                onClick={() => {
                  setHistory((x) => [...x.filter((y) => y.id !== h.id), sel]);
                  setSel(h);
                }}
                className="h-12 w-12 overflow-hidden rounded-lg border border-white/30 opacity-70"
                aria-label="前の姿にもどす"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={h.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <div className="mt-3">
          <Kimorin>{refinesLeft > 0 ? 'もっとこうしたい、はあるか？\nなければ、これで決まりだケン。' : 'これで決まりだな。いい姿だケン！'}</Kimorin>
        </div>
        {refinesLeft > 0 && <Field value={instruction} onChange={setInstruction} chips={REFINE} placeholder="例：耳をもう少し長く" />}
        <div className="mt-3 flex flex-col gap-2">
          {refinesLeft > 0 && (
            <button disabled={!instruction.trim()} onClick={refine} className="rounded-full border border-amber-200/60 py-3 text-sm disabled:opacity-40">
              ✎ 描き直す（あと{refinesLeft}回）
            </button>
          )}
          <Gold disabled={busy} onClick={decide}>
            {busy ? '……' : 'この姿にする'}
          </Gold>
          <Back onClick={() => setPhase('pick')} label="候補にもどる" />
          {err && <p className="text-center text-xs text-rose-300">{err}</p>}
        </div>
      </Panel>
    );

  // 質問から: three questions
  const ready = ans.animal.trim() && ans.color.trim() && ans.mood.trim();
  return (
    <Panel>
      <div className="space-y-4">
        {Q3.map((q) => (
          <div key={q.key}>
            <p className="mb-1.5 text-sm tracking-widest text-amber-100">{q.label}</p>
            <Field value={ans[q.key]} onChange={(v) => setAns({ ...ans, [q.key]: v })} chips={[...q.chips]} placeholder="自由に書いてもOK" />
          </div>
        ))}
        <div className="flex flex-col gap-2 pt-1">
          <Gold disabled={!ready} onClick={make}>
            ✦ 姿を創る（あと{left}回）
          </Gold>
          <Back onClick={() => setPhase('entry')} />
          {err && <p className="text-center text-xs text-rose-300">{err}</p>}
        </div>
      </div>
    </Panel>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="pb-safe absolute inset-x-0 bottom-0 z-20 max-h-[90svh] overflow-y-auto rounded-t-3xl border-t border-amber-200/30 bg-black/85 px-5 pb-8 pt-5 backdrop-blur-md">
      <div className="mx-auto max-w-md">{children}</div>
    </div>
  );
}

function Kimorin({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={spriteUrl('kimorin-face')} alt="" className="h-10 w-10 shrink-0 rounded-full" />
      <p className="whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-white/10 px-3 py-2 text-[15px] leading-relaxed text-amber-50">{children}</p>
    </div>
  );
}

function Field({ value, onChange, chips, placeholder }: { value: string; onChange: (v: string) => void; chips: string[]; placeholder: string }) {
  return (
    <div className="mt-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 60))}
        className="w-full rounded-full border border-amber-200/50 bg-black/60 px-5 py-2.5 text-white outline-none"
        style={{ fontSize: 16 }}
        placeholder={placeholder}
      />
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button key={c} onClick={() => onChange(c)} className={`rounded-full px-3 py-1 text-xs ${value === c ? 'bg-amber-300 font-bold text-black' : 'bg-white/10 text-white/80'}`}>
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

function Gold({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="w-full rounded-full border border-amber-200/80 bg-gradient-to-b from-amber-200/25 to-amber-500/10 py-3.5 text-lg tracking-widest text-amber-50 disabled:opacity-40">
      {children}
    </button>
  );
}

function Back({ onClick, label = 'もどる' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="py-1 text-xs text-white/50 underline">
      {label}
    </button>
  );
}
