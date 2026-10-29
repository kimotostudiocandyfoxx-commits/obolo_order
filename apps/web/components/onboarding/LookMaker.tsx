'use client';

import type { NeoLookBody, NeoLookCandidate, NeoLookResult } from '@obolo/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { spriteUrl } from '@/lib/onboarding/media';
import { fileToReference } from '@/lib/look';
import { NeoChooser } from './NeoChooser';
import { VoiceField } from './StoryExtras';

/**
 * Day 2 on the Moon (D03-S004, story 2026-10-15, M-R64 / production UI 20): the visitor's NEO look, drawn
 * by the water basin — short, so nobody gets stuck (the second journey's Moon can redo it).
 *  - OBOLON asks four questions with buttons: animal (or in their own words) → up to two colours (KIMORIN:
 *    「腕は80本？」) → mood → what they are into (or their own words, or pass). Gender is never asked.
 *  - the basin draws four looks (two boyish, two girlish; semi-real, a big hood, round sunglasses — client
 *    2026-10-25). Pick the closest → 〔これにする〕 or 〔ここを変えたい〕: one wish → four looks with it, and
 *    the visitor decides from those (one refine; the look can be changed later). Before that, 〔最初から描き
 *    直す〕 draws four new ones from the same answers. No count is shown; the server keeps a hidden ceiling.
 *  - if drawing fails, the eight preset forms are offered so the story always moves on.
 * The answers and the last four looks are kept for this visit.
 */
export interface LookApi {
  candidates(body: NeoLookBody): Promise<NeoLookResult>;
  refine(id: string, instruction: string): Promise<NeoLookResult>;
  choose(id: string): Promise<string>;
  chooseForm(formId: string): Promise<void>;
}

type Phase = 'photo' | 'animal' | 'color' | 'mood' | 'hobby' | 'making' | 'pick' | 'chosen' | 'add' | 'failed' | 'forms';

const ANIMALS = ['犬', '猫', '狐', 'うさぎ', 'くま', '鳥', '竜', 'おまかせ'];
const COLORS: { name: string; css: string }[] = [
  { name: '赤', css: '#e0453a' },
  { name: '橙', css: '#f08a2c' },
  { name: '黄', css: '#f2cf3a' },
  { name: '緑', css: '#3fae5a' },
  { name: '水色', css: '#5cc6e8' },
  { name: '青', css: '#3360d8' },
  { name: '紫', css: '#8a4fd0' },
  { name: '桃', css: '#f08ab8' },
  { name: '白', css: '#f4f1ea' },
  { name: '黒', css: '#1d1b22' },
  { name: '金', css: 'linear-gradient(135deg,#f7e08a,#b8862b)' },
  { name: '銀', css: 'linear-gradient(135deg,#f2f4f7,#9aa3ad)' },
];
const MOODS = ['かっこいい', 'かわいい', 'クール', 'パーティーが好き', 'おまかせ'];
const HOBBIES = ['スポーツ', 'ゲーム', 'パーティー'];
const ADD = ['もっとかっこよく', 'もっとかわいく', '色を明るく', '髪を長く', '小物を足して'];
const DRAFT = 'obolo.look.draft';

interface Draft {
  ans: { animal: string; color: string[]; mood: string; hobby: string };
  words: string;
  cands: NeoLookCandidate[];
  /** the four are the redone ones (one redo on the first journey, M-R132): decide from these or the four before */
  refined?: boolean;
  /** the four before the redo */
  prev?: NeoLookCandidate[];
}
const emptyDraft: Draft = { ans: { animal: '', color: [], mood: '', hobby: '' }, words: '', cands: [] };
function loadDraft(): Draft {
  try {
    const raw = sessionStorage.getItem(DRAFT);
    return raw ? { ...emptyDraft, ...(JSON.parse(raw) as Draft) } : emptyDraft;
  } catch {
    return emptyDraft;
  }
}

export function LookMaker({ api, onDone }: { api: LookApi; onDone: (url: string | null) => void }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [phase, setPhase] = useState<Phase>('photo');
  // a favourite photo of themselves (M-R148): kept only in this screen, handed to the basin, never stored
  const [photo, setPhoto] = useState<{ mime: 'image/jpeg'; data: string; url: string } | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [free, setFree] = useState('');
  const [sel, setSel] = useState<NeoLookCandidate | null>(null);
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tired, setTired] = useState(false);
  const last = useRef<NeoLookBody | null>(null);

  // coming back (「もう一度選ぶ」): the answers and the last four looks are still there
  useEffect(() => {
    const d = loadDraft();
    setDraft(d);
    if (d.cands.length) setPhase('pick');
  }, []);
  const save = (d: Draft) => {
    setDraft(d);
    try {
      sessionStorage.setItem(DRAFT, JSON.stringify(d));
    } catch {
      /* ignore */
    }
  };
  const ans = draft.ans;
  const setAns = (a: Partial<Draft['ans']>) => save({ ...draft, ans: { ...ans, ...a } });

  const withPhoto = () => (photo ? { photo: { mime: photo.mime, data: photo.data } } : {});

  const draw = async (body: NeoLookBody) => {
    setErr(null);
    last.current = body;
    setPhase('making');
    const started = Date.now();
    try {
      // never wait for ever: about two minutes, then the screen says so and offers another try (client 2026-10-29: it sat
      // on 「水盤が描いている」); a making that failed costs no mana (the server refunds it)
      const r = await Promise.race([
        api.candidates(body),
        new Promise<never>((_, no) => setTimeout(() => no(new Error('timeout')), 180_000)),
      ]);
      // let the basin scene play out (KIMORIN's whisper, the splash, OBOLON's line)
      await new Promise((ok) => setTimeout(ok, Math.max(0, 5200 - (Date.now() - started))));
      if (!r.candidates.length) return setPhase('failed');
      // a second drawing is the one redo (M-R132)
      save(draft.cands.length ? { ...draft, cands: r.candidates, refined: true, prev: draft.cands } : { ...draft, cands: r.candidates, refined: false });
      setSel(null);
      setPhase('pick');
    } catch (e) {
      if (/作り直せません|LOOK_TRIES/.test(String(e))) {
        setTired(true);
        return setPhase(draft.cands.length ? 'pick' : 'failed');
      }
      setErr(null);
      setPhase(draft.cands.length ? 'pick' : 'failed');
    }
  };

  const add = async () => {
    if (!sel || !instruction.trim()) return;
    setErr(null);
    setPhase('making');
    try {
      const r = await within(api.refine(sel.id, instruction.trim()), 180_000);
      if (r.candidates.length) {
        save({ ...draft, cands: r.candidates, refined: true, prev: draft.cands });
        setSel(null);
        setInstruction('');
        return setPhase('pick');
      }
      setErr('うまく描き変わらなかった……もう一度');
    } catch (e) {
      if (/描き直せません|LOOK_REFINES/.test(String(e))) setTired(true);
      else setErr('うまく描き変わらなかった……もう一度');
    }
    setPhase('chosen');
  };

  const [reveal, setReveal] = useState<string | null>(null);
  const decide = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      const url = await within(api.choose(sel.id), 45_000);
      // M-R149: the chosen look fills the screen for a moment (ドーン)
      setReveal(url || sel.url);
      await new Promise((ok) => setTimeout(ok, 2600));
      onDone(url);
    } catch (e) {
      setErr('うまく決められなかった……もう一度');
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

  if (reveal)
    return (
      <div className="absolute inset-0 z-[30] flex items-center justify-center bg-black/80">
        <div className="absolute inset-0 animate-[fadeUp_0.4s_ease-out] bg-[radial-gradient(circle,rgba(255,220,140,0.35),transparent_60%)]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={reveal} alt="" className="relative w-[82vw] max-w-sm animate-[lookBoom_0.9s_cubic-bezier(.2,1.4,.4,1)] rounded-full object-cover shadow-[0_0_80px_rgba(255,214,140,0.7)] ring-4 ring-amber-200/80" />
        <style>{'@keyframes lookBoom{0%{transform:scale(.2);opacity:0}70%{transform:scale(1.08);opacity:1}100%{transform:scale(1)}}'}</style>
      </div>
    );

  if (phase === 'making') return <Basin />;

  if (phase === 'photo')
    return (
      <Panel>
        <Obolon>{'、、、お前の、気に入っている、自分の写真は、あるか？\nあるなら、、、水盤に、映せ。'}</Obolon>
        {/* 〔写真を使う〕 picks one already taken, 〔写真を撮る〕 opens the front camera (client 2026-10-29) */}
        {[photoInput, cameraInput].map((r, k) => (
          <input
            key={k}
            ref={r}
            type="file"
            accept="image/*"
            {...(k === 1 ? { capture: 'user' as const } : {})}
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                setPhoto(await fileToReference(f));
              } catch {
                setErr('その写真は、読みこめなかった……');
              }
            }}
          />
        ))}
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt="" className="mx-auto mt-3 h-36 w-36 rounded-2xl object-cover ring-2 ring-amber-200/60" />
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-white/55">自分だけが写っている写真を選んでね。ほかの人の顔は使えません。写真は、姿を作るためだけに使い、作ったあとは残しません</p>
        {err && <p className="mt-2 text-xs text-amber-200/80">{err}</p>}
        <div className="mt-3 flex flex-col gap-2">
          {photo ? (
            <>
              <Gold onClick={() => (setErr(null), setPhase('animal'))}>この写真で作る</Gold>
              <div className="flex justify-center gap-4">
                <button onClick={() => photoInput.current?.click()} className="py-2 text-sm text-white/60">
                  ちがう写真を使う
                </button>
                <button onClick={() => cameraInput.current?.click()} className="py-2 text-sm text-white/60">
                  撮りなおす
                </button>
              </div>
            </>
          ) : (
            <>
              <Gold onClick={() => photoInput.current?.click()}>🖼 写真を使う</Gold>
              <Gold onClick={() => cameraInput.current?.click()}>📷 写真を撮る</Gold>
            </>
          )}
          <button onClick={() => (setPhoto(null), setErr(null), setPhase('animal'))} className="py-2 text-sm text-white/60">
            写真を使わずに作る
          </button>
        </div>
      </Panel>
    );

  if (phase === 'animal')
    return (
      <Panel>
        <Obolon>{'どんな見た目に、なりたい？\nそうだ、好きな動物は？'}</Obolon>
        {/* the mic first (client 2026-10-29); the examples under it */}
        <div className="mt-3" />
        <VoiceField value={free} onChange={setFree} placeholder="例：しろくま" />
        {free.trim() && (
          <div className="mt-2 flex flex-col gap-2">
            <Gold onClick={() => (setAns({ animal: free.trim() }), setFree(''), setPhase('color'))}>これにする</Gold>
          </div>
        )}
        <p className="mt-4 text-center text-[11px] text-white/45">または、えらぶ</p>
        <Chips items={ANIMALS} value={ans.animal} onPick={(v) => (setAns({ animal: v }), setFree(''), setPhase('color'))} />
      </Panel>
    );

  if (phase === 'color')
    return (
      <Panel>
        <Kimorin>腕は80本？</Kimorin>
        <div className="mt-2" />
        <Obolon>好きな色は？</Obolon>
        <div className="mt-3" />
        <VoiceField value={free} onChange={setFree} placeholder="例：青と金" />
        {free.trim() && (
          <div className="mt-2 flex flex-col gap-2">
            <Gold onClick={() => (setAns({ color: [free.trim()] }), setFree(''), setPhase('mood'))}>これにする</Gold>
          </div>
        )}
        <p className="mt-4 text-center text-[11px] text-white/50">または、えらぶ（2つまで）</p>
        <div className="mt-3 grid grid-cols-6 gap-2">
          {COLORS.map((c) => {
            const on = ans.color.includes(c.name);
            return (
              <button
                key={c.name}
                onClick={() => setAns({ color: on ? ans.color.filter((x) => x !== c.name) : [...ans.color, c.name].slice(-2) })}
                className={`flex flex-col items-center gap-1 rounded-xl py-1.5 ${on ? 'bg-amber-200/20 ring-2 ring-amber-200' : ''}`}
                aria-label={c.name}
              >
                <span className="h-8 w-8 rounded-full border border-white/40" style={{ background: c.css }} />
                <span className="text-[10px] text-white/70">{c.name}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <Gold disabled={!ans.color.length} onClick={() => setPhase('mood')}>
            つぎへ
          </Gold>
          <Plain onClick={() => (setAns({ color: [] }), setPhase('mood'))}>おまかせ</Plain>
          <Back onClick={() => setPhase('animal')} />
        </div>
      </Panel>
    );

  if (phase === 'mood')
    return (
      <Panel>
        <Obolon>どんな雰囲気が、いい？</Obolon>
        <div className="mt-3" />
        <VoiceField value={free} onChange={setFree} placeholder="例：ミステリアス" />
        {free.trim() && (
          <div className="mt-2 flex flex-col gap-2">
            <Gold onClick={() => (setAns({ mood: free.trim() }), setFree(''), setPhase('hobby'))}>これにする</Gold>
          </div>
        )}
        <p className="mt-4 text-center text-[11px] text-white/45">または、えらぶ</p>
        <Chips items={MOODS} value={ans.mood} onPick={(v) => (setAns({ mood: v }), setFree(''), setPhase('hobby'))} />
        <Back onClick={() => setPhase('color')} />
      </Panel>
    );

  if (phase === 'hobby')
    return (
      <Panel>
        <Obolon>今、好きなことは？</Obolon>
        <div className="mt-3" />
        <VoiceField value={free} onChange={setFree} placeholder="例：カメラ" />
        <div className="mt-2 flex flex-col gap-2">
          {free.trim() && (
            <Gold
              onClick={() => {
                const hobby = free.trim();
                const d = { ...draft, ans: { ...ans, hobby } };
                save(d);
                void draw({ animal: d.ans.animal || 'おまかせ', color: d.ans.color.join('と') || 'おまかせ', mood: d.ans.mood || 'おまかせ', hobby, ...withPhoto() });
              }}
            >
              水盤に描いてもらう
            </Gold>
          )}
          <p className="mt-2 text-center text-[11px] text-white/45">または、えらぶ</p>
          <Chips
            items={HOBBIES}
            value={ans.hobby}
            onPick={(hobby) => {
              const d = { ...draft, ans: { ...ans, hobby } };
              save(d);
              void draw({ animal: d.ans.animal || 'おまかせ', color: d.ans.color.join('と') || 'おまかせ', mood: d.ans.mood || 'おまかせ', hobby, ...withPhoto() });
            }}
          />
          <Plain
            onClick={() => {
              save({ ...draft, ans: { ...ans, hobby: '' } });
              void draw({ animal: ans.animal || 'おまかせ', color: ans.color.join('と') || 'おまかせ', mood: ans.mood || 'おまかせ', ...withPhoto() });
            }}
          >
            パス
          </Plain>
          <Back onClick={() => setPhase('mood')} />
        </div>
      </Panel>
    );

  if (phase === 'failed')
    return (
      <Panel>
        <p className="text-center text-amber-100">{tired ? '水盤が、今日は疲れてしまった……' : '水盤が、うまく描けなかった。もう一度'}</p>
        <p className="mt-1 text-center text-xs text-white/55">{tired ? '用意された姿から選んでください。' : 'もう一度ためすか、用意された姿から選んでください。'}</p>
        <div className="mt-4 flex flex-col gap-2">
          {!tired && <Gold onClick={() => (last.current ? draw(last.current) : setPhase('animal'))}>もう一度</Gold>}
          <Plain onClick={() => setPhase('forms')}>用意された8つの姿から選ぶ</Plain>
        </div>
      </Panel>
    );

  if ((phase === 'chosen' || phase === 'add') && sel)
    return (
      <Panel>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sel.url} alt="" className="mx-auto aspect-square w-[min(66vw,280px)] rounded-3xl border-2 border-amber-200/60 object-cover shadow-[0_0_30px_rgba(255,200,90,0.35)]" />
        {phase === 'chosen' ? (
          <div className="mt-4 flex flex-col gap-2">
            <Gold disabled={busy} onClick={decide}>
              {busy ? '……' : 'これにする'}
            </Gold>
            {REDO_ON && !tired && !draft.refined && <Plain onClick={() => setPhase('add')}>ここを変えたい</Plain>}
            <Back onClick={() => setPhase('pick')} label="4枚にもどる" />
            {err && <p className="text-center text-xs text-rose-300">{err}</p>}
          </div>
        ) : (
          <div className="mt-3">
            <Obolon>どう、変えたい？</Obolon>
            <div className="mt-2">
              <VoiceField value={instruction} onChange={setInstruction} placeholder="例：もっとかっこよく" maxLength={60} />
            </div>
            <div className="mt-1 flex flex-wrap justify-center gap-1.5">
              {ADD.map((c) => (
                <button key={c} onClick={() => setInstruction(c)} className={`rounded-full px-3 py-1 text-xs ${instruction === c ? 'bg-amber-300 font-bold text-black' : 'bg-white/10 text-white/80'}`}>
                  {c}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Gold disabled={!instruction.trim()} onClick={add}>
                この要望で、4つ描いてもらう
              </Gold>
              <Back onClick={() => setPhase('chosen')} />
            </div>
          </div>
        )}
      </Panel>
    );

  // pick one of the four
  return (
    <Panel>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {draft.cands.map((c) => (
          <button
            key={c.id}
            onClick={() => (setSel(c), setPhase('chosen'))}
            className="overflow-hidden rounded-2xl border-2 border-amber-200/30 transition active:scale-[0.97]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.url} alt="" className="aspect-square w-full object-cover" />
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {draft.refined ? (
          <>
            {draft.prev && draft.prev.length > 0 && (
              <Plain onClick={() => save({ ...draft, cands: draft.prev!, prev: draft.cands })}>前の4つ</Plain>
            )}
            <p className="text-center text-xs text-white/50">この4つか、前の4つから決めてください（作り直しは、ここまで）。姿は、あとでまた変えられます</p>
          </>
        ) : !REDO_ON ? null : !tired ? (
          <Plain onClick={() => (last.current ? draw(last.current) : setPhase('animal'))}>最初から描き直す（1回だけ）</Plain>
        ) : (
          <p className="text-center text-xs text-white/50">水盤が今日は疲れてしまった……この4枚から選んでください</p>
        )}
        {err && <p className="text-center text-xs text-rose-300">{err}</p>}
      </div>
    </Panel>
  );
}

/** Forget the kept answers and looks (after the look is saved). */
export function clearLookDraft() {
  try {
    sessionStorage.removeItem(DRAFT);
  } catch {
    /* ignore */
  }
}

/** While the basin draws: KIMORIN whispers into it, the water splashes, OBOLON explains. */
function Basin() {
  // the screen's own note only (no narration the script does not have, story chat 2026-10-29)
  const [who, text] = ['', '水盤が描いています'];
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black/70 px-6 backdrop-blur-[2px]">
      <div className="relative h-44 w-72" aria-hidden>
        <span className="absolute inset-x-0 bottom-0 h-20 rounded-[50%] border border-sky-100/40 bg-[radial-gradient(ellipse_at_center,rgba(190,225,255,0.45)_0%,rgba(80,120,170,0.15)_60%,transparent_75%)]" />
        <span className="absolute inset-x-10 bottom-5 h-10 animate-pulse rounded-[50%] bg-sky-100/25 blur-md" />
      </div>
      <div className="min-h-16 animate-[fadeUp_0.5s_ease-out] text-center">
        {who && <p className="text-xs tracking-[0.25em] text-amber-200/80">{who}</p>}
        <p className="mt-1 text-[17px] text-amber-50">{text}</p>
      </div>
    </div>
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
    <div className="flex items-start justify-end gap-2">
      <p className="whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-white/10 px-3 py-2 text-[15px] leading-relaxed text-amber-50">{children}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={spriteUrl('kimorin-sun')} alt="" className="h-10 w-10 shrink-0 object-contain object-top" />
    </div>
  );
}

function Obolon({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={spriteUrl('obolon')} alt="" className="h-10 w-10 shrink-0 object-contain" />
      <p className="whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-white/10 px-3 py-2 text-[15px] leading-relaxed text-amber-50">{children}</p>
    </div>
  );
}

function Chips({ items, value, onPick }: { items: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-2">
      {items.map((c) => (
        <button key={c} onClick={() => onPick(c)} className={`rounded-full px-4 py-2 text-sm ${value === c ? 'bg-amber-300 font-bold text-black' : 'border border-amber-200/30 bg-white/5 text-white/85'}`}>
          {c}
        </button>
      ))}
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

function Plain({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full rounded-full border border-white/30 py-3 text-sm tracking-wider text-white/85">
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

/** a wait that always ends (story chat 2026-10-29: never 「水盤が、描いている」 for good) */
function within<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
}

/**
 * The redraws (〔ここを変えたい〕, 〔最初から描き直す〕) are hidden for now: waiting again was the weaker moment (client
 * 2026-10-29, for the investors' evening). The script keeps them; set true to bring them back. 〔もう一度〕 after a
 * failure stays.
 */
const REDO_ON = false;
