'use client';

import type { NeoLookBody, NeoLookCandidate, NeoLookResult } from '@obolo/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { spriteUrl } from '@/lib/onboarding/media';
import { fileToReference } from '@/lib/look';
import { NeoChooser } from './NeoChooser';
import { VoiceField } from './StoryExtras';

/**
 * Day 2 on the Moon (D03-S004, M-R207): the visitor's NEO look, drawn by the bowl of water. OBOLON's
 * 「{name}、、、こっちへ来い。」「まず、お前の姿を、器の水に映せ。」 are story lines just before this screen.
 *  - 〔写真フォルダから器の水に映す〕〔カメラで撮って器の水に映す〕: always their own photo (no way without one)
 *  - OBOLON 「何の動物に、アレンジする？」, answered by voice (〔文字で答える〕 in the corner); the words as said are the
 *    bubble and go into the drawing as they are (no list of animals)
 *  - four looks from the photo, each with that animal's ears, the society's hood and round sunglasses, in four
 *    different touches. Pick one → the chosen look big on the screen (ドーン). 〔要望を言って描き直す〕 redraws with a wish
 *    as often as they like, 〔前の4枚〕 goes back (M-R223: no mana on day 2, so no −3マナ either). Gender is never asked.
 *  - if drawing fails, the eight preset forms are offered so the story always moves on.
 * The answers and the last four looks are kept for this visit.
 */
export interface LookApi {
  candidates(body: NeoLookBody): Promise<NeoLookResult>;
  refine(id: string, instruction: string): Promise<NeoLookResult>;
  choose(id: string): Promise<string>;
  chooseForm(formId: string): Promise<void>;
}

type Phase = 'photo' | 'animal' | 'making' | 'pick' | 'chosen' | 'add' | 'failed' | 'forms';

/** what the look screen answered (D03-S004): `f_d03_photo`, `f_d03_animal` (the words as said), `f_d03_card`, `f_d03_redraw` */
export interface LookFlags {
  photo?: 'folder' | 'camera';
  animal?: string;
  card?: number;
  redraw?: 0 | 1;
}

const DRAFT = 'obolo.look.draft';

interface Draft {
  ans: { animal: string; color: string[]; mood: string; hobby: string; photo?: 'folder' | 'camera' };
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

/**
 * `ask`: OBOLON's question for the animal; `spell`: {bati}'s line as it casts the magic into the water (M-R209: {bati} is born
 * before the look and makes it). Both come from the day's script (lib/onboarding/day2.ts), already filled.
 */
export function LookMaker({
  api,
  onDone,
  ask = '何の動物に、アレンジする？',
  spell,
  spellName = 'バティ',
  spellFace,
  noPhoto = false,
}: {
  /**
   * M-R250: no photo may be used (under 13, or 13〜15 without the guardian's consent): the photo passage is skipped — OBOLON's
   * 「、、、器の水に、好きな動物を、思い浮かべろ。」 is the story line just before (day2.ts, f_media no); asked for a favourite animal and the four are that animal itself in the hood and the round sunglasses (the server picks
   * the prompt by the account). The rest (redraw, the cards later) is the same.
   */
  noPhoto?: boolean;
  api: LookApi;
  onDone: (url: string | null, flags?: LookFlags) => void;
  ask?: string;
  spell?: string;
  spellName?: string;
  spellFace?: string;
}) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [phase, setPhase] = useState<Phase>(noPhoto ? 'animal' : 'photo');
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
      // on 「器の水が描いている」); a making that failed costs no mana (the server refunds it)
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
    // the wish redraws from the card picked, or the first of the four on screen (M-R223: 何度でも)
    const from = sel ?? draft.cands[0];
    if (!from || !instruction.trim()) return;
    setErr(null);
    setPhase('making');
    try {
      const r = await within(api.refine(from.id, instruction.trim()), 180_000);
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
    setPhase(sel ? 'chosen' : 'pick');
  };

  const [reveal, setReveal] = useState<string | null>(null);
  const decide = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      const url = await within(api.choose(sel.id), 45_000);
      const card = draft.cands.findIndex((c) => c.id === sel.id) + 1;
      // M-R149: the chosen look fills the screen for a moment (ドーン)
      setReveal(url || sel.url);
      await new Promise((ok) => setTimeout(ok, 2600));
      onDone(url, { photo: ans.photo, animal: ans.animal || undefined, card: card || undefined, redraw: draft.refined ? 1 : 0 });
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

  if (phase === 'making') return <Basin said={instruction || ans.animal} spell={spell} spellName={spellName} spellFace={spellFace} />;

  if (phase === 'photo')
    return (
      <Panel>
        {/* OBOLON's 「まず、お前の姿を、器の水に映せ。」 is the story line just before; the two buttons of the script */}
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
                setAns({ photo: k === 1 ? 'camera' : 'folder' });
                // 写真が器の水に沈み、波紋がゆっくり広がる → OBOLON asks the animal
                setErr(null);
                setPhase('animal');
              } catch {
                setErr('その写真は、読みこめなかった……');
              }
            }}
          />
        ))}
        <p className="text-[11px] leading-relaxed text-white/55">自分だけが写っている写真にしてね。ほかの人の顔は使えません。写真は、姿を作るためだけに使い、作ったあとは残しません</p>
        {err && <p className="mt-2 text-xs text-amber-200/80">{err}</p>}
        <div className="mt-3 flex flex-col gap-2">
          <Gold onClick={() => photoInput.current?.click()}>写真フォルダから器の水に映す</Gold>
          <Gold onClick={() => cameraInput.current?.click()}>カメラで撮って器の水に映す</Gold>
          {/* the look is always made from their own photo now (client 2026-11-22: 「写真を使わずに作る」 is gone) */}
        </div>
      </Panel>
    );

  // only the animal is asked (client 2026-11-22): their photo with that animal's ears, the society's hood and the round
  // sunglasses, in four different touches (the server's look prompt)
  const drawAnimal = (animal: string) => {
    setFree('');
    setInstruction('');
    const d = { ...draft, ans: { ...ans, animal, color: [], mood: '', hobby: '' } };
    save(d);
    void draw({ animal, color: 'おまかせ', mood: 'おまかせ', ...withPhoto() });
  };

  if (phase === 'animal')
    return (
      <Panel>
        {photo && (
          // the photo sunk into the bowl of water: {name} seen dimly on the surface
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt="" className="mx-auto mb-3 h-24 w-24 rounded-full object-cover opacity-70 ring-2 ring-sky-100/40 [filter:saturate(0.7)_blur(0.5px)]" />
        )}
        <Obolon>{ask}</Obolon>
        {/* the mic first, 〔文字で答える〕 in the corner (VoiceField); the words as said, never matched to a list */}
        <div className="mt-3" />
        <VoiceField value={free} onChange={setFree} placeholder="例「しろくま」" />
        {free.trim() && (
          <div className="mt-2 flex flex-col gap-2">
            <Gold onClick={() => drawAnimal(free.trim())}>これにする</Gold>
          </div>
        )}
        {!photo && !noPhoto && <Back onClick={() => setPhase('photo')} />}
      </Panel>
    );

  if (phase === 'failed')
    return (
      <Panel>
        <p className="text-center text-amber-100">{tired ? '器の水が、今日は疲れてしまった……' : '器の水が、うまく描けなかった。もう一度'}</p>
        <p className="mt-1 text-center text-xs text-white/55">{tired ? '用意された姿から選んでください。' : 'もう一度ためすか、用意された姿から選んでください。'}</p>
        <div className="mt-4 flex flex-col gap-2">
          {!tired && <Gold onClick={() => (last.current ? draw(last.current) : setPhase('animal'))}>もう一度</Gold>}
          <Plain onClick={() => setPhase('forms')}>用意された8つの姿から選ぶ</Plain>
        </div>
      </Panel>
    );

  if ((phase === 'chosen' || phase === 'add') && (sel || phase === 'add'))
    return (
      <Panel>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={(sel ?? draft.cands[0])?.url} alt="" className="mx-auto aspect-square w-[min(66vw,280px)] rounded-3xl border-2 border-amber-200/60 object-cover shadow-[0_0_30px_rgba(255,200,90,0.35)]" />
        {phase === 'chosen' ? (
          <div className="mt-4 flex flex-col gap-2">
            <Gold disabled={busy} onClick={decide}>
              {busy ? '……' : 'これにする'}
            </Gold>
            {REDO_ON && !tired && <Plain onClick={() => setPhase('add')}>要望を言って描き直す</Plain>}
            <Back onClick={() => setPhase('pick')} label="4枚にもどる" />
            {err && <p className="text-center text-xs text-rose-300">{err}</p>}
          </div>
        ) : (
          <div className="mt-3">
            {/* the wish by voice (〔文字で答える〕 in the corner); the words as said */}
            <VoiceField value={instruction} onChange={setInstruction} placeholder="例「もっとかっこよく」" maxLength={60} />
            <div className="mt-3 flex flex-col gap-2">
              <Gold disabled={!instruction.trim()} onClick={add}>
                これにする
              </Gold>
              <Back onClick={() => setPhase(sel ? 'chosen' : 'pick')} />
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
        {/* D03-S004#c2 〔要望を言って描き直す〕 as often as they like; 〔前の4枚〕 goes back (M-R223) */}
        {REDO_ON && !tired && (
          <Plain
            onClick={() => {
              setSel(null);
              setPhase('add');
            }}
          >
            要望を言って描き直す
          </Plain>
        )}
        {tired && <p className="text-center text-xs text-white/50">器の水が今日は疲れてしまった……この4枚から選んでください</p>}
        {draft.refined && draft.prev && draft.prev.length > 0 && (
          <Plain onClick={() => save({ ...draft, cands: draft.prev!, prev: draft.cands })}>前の4枚</Plain>
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

/**
 * While the bowl of water draws: what was said, as said, in {name}'s bubble; the light from the mana gem into the water
 * (D03-S004; M-R223: day 2 uses no mana, so no −3マナ telop). No narration the script does not have (story chat 2026-10-29).
 */
function Basin({ said, spell, spellName, spellFace }: { said?: string; spell?: string; spellName?: string; spellFace?: string }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black/70 px-6 backdrop-blur-[2px]">
      {said && <p className="max-w-[80%] self-end rounded-2xl rounded-br-sm bg-amber-200/90 px-3 py-2 text-[15px] text-amber-950">{said}</p>}
      {/* {bati} jumps onto the rim of the bowl: 「いくよ、{name}！」 (D03-S004) */}
      {spell && (
        <div className="flex max-w-[85%] items-start gap-2 self-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {spellFace && <img src={spellFace} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />}
          <div>
            <p className="text-[11px] text-amber-100/70">{spellName}</p>
            <p className="rounded-2xl rounded-tl-sm bg-white/10 px-3 py-2 text-[15px] text-amber-50">{spell}</p>
          </div>
        </div>
      )}
      <div className="relative h-44 w-72" aria-hidden>
        <span className="absolute inset-x-0 bottom-0 h-20 rounded-[50%] border border-sky-100/40 bg-[radial-gradient(ellipse_at_center,rgba(190,225,255,0.45)_0%,rgba(80,120,170,0.15)_60%,transparent_75%)]" />
        <span className="absolute inset-x-10 bottom-5 h-10 animate-pulse rounded-[50%] bg-sky-100/25 blur-md" />
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

function Obolon({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={spriteUrl('obolon')} alt="" className="h-10 w-10 shrink-0 object-contain" />
      <p className="whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-white/10 px-3 py-2 text-[15px] leading-relaxed text-amber-50">{children}</p>
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

/** a wait that always ends (story chat 2026-10-29: never 「器の水が、描いている」 for good) */
function within<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
}

/**
 * The redraw 〔要望を言って描き直す〕 (D03-S004#c2): back with M-R223 — as often as they like, no mana on day 2.
 * 〔もう一度〕 after a failure stays.
 */
const REDO_ON = true;
