'use client';

import { eggMark, formatMana, LOOK_STEP_MAX, lookStepChoices, MAKE_COST, type BatiEggKind, type LookStepsInfo, type LookStepView, type LookStepWho } from '@obolo/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NeoChooser } from '@/components/onboarding/NeoChooser';
import { VoiceField } from '@/components/onboarding/StoryExtras';
import { getApi } from '@/lib/api';
import { fileToReference } from '@/lib/look';

/**
 * Client 2026-11-27 (story M-R334; the rules are shared lookSteps.ts): a look changed step by step.
 *  - LookStepsPanel: {bati}'s 進化 (D03-S005b) and one's own 変身 (D03-S004) — say how to change it FROM THE LOOK IT HAS
 *    NOW: the mic (the shared voice field, so what was heard can be put right before it is sent; 〔文字で答える〕 is its
 *    small corner key) or 〔画像を送る〕 (a reference for the shape / colours only). Each step takes one step's mana from the
 *    gem (shown small: 「マナジェム −0.4」) and 「進化 あと◯回」 counts down from 8. After every step the two choices
 *    (decide / again); after the 8th only deciding is left and `limit` (OBOLON's line) is said.
 *  - LookPick4Panel: the four first pictures of one's own look (photo → four anime touches, 2 / 3 / 5 / 7 heads).
 * Neither knows about day 2: the labels, the lines and what happens when it is decided come from the caller, so an
 * Obolo Order member's later change (POST /me/look/steps/open first) uses the same panels.
 */
const SERIF = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

/** the one short line when a picture could not be made or cut cleanly (the API's LOOK_AGAIN) */
const AGAIN = 'うまく描けなかった……もういちど';

export interface StepLine {
  name: string;
  text: string;
  face?: string;
}

type Ref = { mime: 'image/jpeg'; data: string; url: string };

const words = (e: unknown, fallback: string) => {
  const x = e as { code?: string; message?: string } | null;
  if (x?.code === 'NO_MANA') return 'マナジェムが、光らなくなった……';
  if (x?.code === 'MODERATION' || x?.code === 'LOOK_LOCKED' || x?.code === 'LOOK_STEPS_DONE') return x.message || fallback;
  // nothing was taken and nothing counted: the picture could not be made, or not cut cleanly (never shown badly cut)
  if (x?.code === 'LOOK_CUT_FAILED' || x?.code === 'LOOK_STEP_FAILED') return AGAIN;
  if (x?.code === 'PHOTO_NOT_ALLOWED') return 'ここでは、画像は使えません';
  return fallback;
};

export function LookStepsPanel({
  who,
  counter,
  ok,
  more,
  example,
  spell,
  limit,
  image,
  egg,
  noImage = false,
  film = false,
  fixNote = false,
  onSaid,
  onLimit,
  onStep,
  onDone,
}: {
  who: LookStepWho;
  /** 「進化」 / 「変身」 (あと◯回) */
  counter: string;
  ok: string;
  more: string;
  example: string;
  /** {bati}'s line as it casts (「いくよ！」) */
  spell?: StepLine;
  /** OBOLON's line after the last step (「、、、今日の魔法は、ここまでだ。」) */
  limit?: StepLine;
  /** the picture before the round's own state arrives */
  image?: string | null;
  /** {bati}'s egg: the small ♀ / ♂ mark beside it */
  egg?: BatiEggKind;
  /** no picture may be sent (M-R250) */
  noImage?: boolean;
  /** D03-S004: deciding plays the film of the bowl of water (~8 s, 〔スキップ〕) and shows the decided look full screen */
  film?: boolean;
  /** a member's later change: what deciding a changed look takes, small under the button */
  fixNote?: boolean;
  /** what was said, as said (the chat's bubble) */
  onSaid?: (text: string) => void;
  onLimit?: () => void;
  /** after each step: the new picture and the steps used */
  onStep?: (url: string, used: number) => void;
  /** decided: the picture worn now (null: there was nothing to decide), the steps used, the mana the deciding took */
  onDone: (r: { url: string | null; used: number; mana: number }) => void;
}) {
  const [info, setInfo] = useState<LookStepsInfo | null>(null);
  const [view, setView] = useState<LookStepView | null>(null);
  const [wish, setWish] = useState('');
  const [ref, setRef] = useState<Ref | null>(null);
  const [phase, setPhase] = useState<'ask' | 'cast' | 'shown' | 'film' | 'reveal'>('ask');
  const [said, setSaid] = useState('');
  const [took, setTook] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const told = useRef(false);
  const ended = useRef(false);

  const finish = (r: { url: string | null; used: number; mana: number }) => {
    if (ended.current) return;
    ended.current = true;
    onDone(r);
  };

  useEffect(() => {
    let live = true;
    getApi()
      .lookStepsInfo()
      .then((i) => {
        if (!live) return;
        setInfo(i);
        const v = i[who];
        setView(v);
        // nothing to change (no look of one's own: a preset form) or decided already (a resumed day): on with the story
        if (!v.url || v.fixed) return finish({ url: v.url, used: v.used, mana: 0 });
        if (v.used > 0) setPhase('shown');
      })
      .catch(() => setErr('うまく読みこめなかった……'));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [who]);

  const stepMana = info?.prices.step ?? MAKE_COST.lookStep;
  const used = view?.used ?? 0;
  const left = view?.left ?? LOOK_STEP_MAX;
  const choices = lookStepChoices({ used, fixed: false });
  const picture = view?.url ?? image ?? null;

  // OBOLON's line when the last step is used (once, into the chat too)
  useEffect(() => {
    if (choices.last && phase === 'shown' && !told.current) {
      told.current = true;
      onLimit?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choices.last, phase]);

  const cast = async () => {
    const w = wish.trim();
    if ((!w && !ref) || busy) return;
    setBusy(true);
    setErr(null);
    setSaid(w);
    setPhase('cast');
    if (w) onSaid?.(w);
    const started = Date.now();
    try {
      const r = await getApi().lookStep({ who, wish: w, ...(ref ? { image: { mime: ref.mime, data: ref.data } } : {}) });
      // the water rises and the light clears: never a flash of a result
      await new Promise((go) => setTimeout(go, Math.max(0, 2600 - (Date.now() - started))));
      setView(r.steps);
      setTook(r.mana);
      setWish('');
      setRef(null);
      setPhase('shown');
      if (r.steps.url) onStep?.(r.steps.url, r.steps.used);
    } catch (e) {
      setErr(words(e, AGAIN));
      setPhase(used > 0 ? 'shown' : 'ask');
    }
    setBusy(false);
  };

  const goBack = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await getApi().lookStepBack(who);
      setView(r.steps);
      setTook(null);
      if (r.steps.url) onStep?.(r.steps.url, r.steps.used);
    } catch {
      setErr('うまく戻せなかった……もういちど');
    }
    setBusy(false);
  };

  // decided: (the film of the bowl of water →) the round is closed and the look worn → (the look full screen →) on
  const settle = async () => {
    try {
      const r = await getApi().lookStepFix(who);
      const done = { url: r.steps.url, used: r.steps.used, mana: r.mana };
      if (!film) return finish(done);
      if (r.steps.url) setView(r.steps);
      setPhase('reveal');
      setTimeout(() => finish(done), 2800);
    } catch (e) {
      setErr(words(e, 'うまく決められなかった……もういちど'));
      setPhase(used > 0 ? 'shown' : 'ask');
      setBusy(false);
    }
  };
  const decide = () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    if (film) return setPhase('film');
    void settle();
  };

  if (!view || !picture) {
    return (
      <Veil>
        <p className="mt-[40svh] text-center text-sm tracking-[0.3em] text-amber-100/70" style={{ fontFamily: SERIF }}>
          {err ?? '……'}
        </p>
        {err && <Quiet onClick={() => finish({ url: image ?? null, used: 0, mana: 0 })}>このまま進む</Quiet>}
      </Veil>
    );
  }

  if (phase === 'film') return <FixFilm picture={picture} onDone={() => void settle()} />;
  if (phase === 'reveal')
    return (
      // 決めた姿が、背景のない大きな絵になって、画面いっぱいに、ドーンと出る
      <div className="absolute inset-0 z-[30] flex items-center justify-center overflow-hidden bg-black/85">
        <span aria-hidden className="absolute inset-0 animate-[fadeIn_0.4s_ease-out] bg-[radial-gradient(circle,rgba(255,220,140,0.38),transparent_62%)]" />
        <span aria-hidden className="mystic-motes absolute inset-0" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={picture} alt="" className="look-boom relative max-h-[86svh] w-[92vw] max-w-lg object-contain" style={{ filter: 'drop-shadow(0 0 46px rgba(255,214,140,0.7))' }} />
      </div>
    );

  return (
    <Veil>
      {/* small, in the corner: 「進化 あと◯回」 and what the last step took */}
      <div className="pt-safe absolute left-4 top-14 z-10 text-left" style={{ fontFamily: SERIF }}>
        <p data-testid="look-steps-left" className="text-[11px] tracking-[0.18em] text-amber-100/75">
          {counter} あと{left}回
        </p>
        {took != null && took > 0 && phase === 'shown' && <p className="mt-0.5 animate-[fadeIn_0.6s_ease-out] text-[10px] tracking-[0.12em] text-amber-200/60">マナジェム −{formatMana(took)}</p>}
      </div>

      {/* the look it has now: no frame — light under it, and (for {bati}) its small ♀ / ♂ mark */}
      <div className="relative mx-auto mt-[9svh] flex h-[38svh] w-full max-w-sm items-end justify-center">
        <span aria-hidden className="look-water absolute bottom-0 left-1/2 h-[9svh] w-[78%] -translate-x-1/2 rounded-[50%]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={picture}
          src={picture}
          alt=""
          className={`relative max-h-full max-w-[82%] object-contain ${phase === 'cast' ? 'look-cast' : 'look-arrive'}`}
          style={{ filter: 'drop-shadow(0 0 26px rgba(255,220,150,0.45))' }}
        />
        {who === 'bati' && egg && <EggMark egg={egg} className="absolute right-[12%] top-[8%]" />}
        {/* M-R338: small, at the picture's corner, over the two choices — the look before the last step (the count and the mana stay) */}
        {phase === 'shown' && view.canBack && (
          <button type="button" disabled={busy} onClick={() => void goBack()} data-testid="look-step-back" className="absolute bottom-1 left-[6%] rounded-full border border-white/20 bg-black/45 px-2.5 py-1 text-[10px] tracking-wider text-white/70 backdrop-blur-sm disabled:opacity-40" style={{ fontFamily: SERIF }}>
            ↶ ひとつ前の姿にもどす
          </button>
        )}
        {phase === 'cast' && <span aria-hidden className="look-rise absolute inset-x-[10%] bottom-0 top-0 rounded-[45%]" />}
      </div>

      <div className="pb-safe absolute inset-x-0 bottom-0 px-6 pb-7" style={{ fontFamily: SERIF }}>
        <div className="mx-auto flex max-w-sm flex-col gap-3">
          {phase === 'cast' && (
            <>
              {said && <p className="max-w-[85%] self-end rounded-2xl rounded-br-sm bg-amber-200/90 px-3 py-2 text-[15px] text-amber-950">{said}</p>}
              {ref && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ref.url} alt="" className="h-14 w-14 self-end rounded-xl object-cover opacity-90" />
              )}
              {spell && <Said line={spell} />}
            </>
          )}

          {phase === 'shown' && (
            <>
              {choices.last && limit && <Said line={limit} />}
              {err && <p className="text-center text-xs text-amber-200/85">{err}</p>}
              <Gold disabled={busy} onClick={decide}>
                {busy ? '……' : ok}
              </Gold>
              {fixNote && who === 'self' && used > 0 && <p className="-mt-1 text-center text-[10px] tracking-[0.12em] text-amber-200/60">この姿にすると　マナ −{formatMana(info?.prices.fix ?? MAKE_COST.profileLook)}</p>}
              {choices.again && (
                <Plain disabled={busy} onClick={() => (setErr(null), setPhase('ask'))}>
                  {more}
                </Plain>
              )}
            </>
          )}

          {phase === 'ask' && (
            <>
              {ref && (
                <div className="flex items-center justify-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ref.url} alt="" className="h-16 w-16 rounded-xl object-cover ring-1 ring-amber-200/40" />
                  <button type="button" onClick={() => setRef(null)} className="text-[11px] text-white/50 underline">
                    とりけす
                  </button>
                </div>
              )}
              {/* the shared voice answer: what was heard can be put right before it is sent */}
              <VoiceField value={wish} onChange={setWish} placeholder={`例「${example}」`} maxLength={60} />
              {err && <p className="text-center text-xs text-amber-200/85">{err}</p>}
              <div className="flex gap-2">
                {!noImage && (
                  <>
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
                          setErr(null);
                        } catch {
                          setErr('その画像は、読みこめなかった……');
                        }
                      }}
                    />
                    <Plain onClick={() => file.current?.click()}>画像を送る</Plain>
                  </>
                )}
                <Gold disabled={(!wish.trim() && !ref) || busy} onClick={cast}>
                  これにする
                </Gold>
              </div>
              {!noImage && <p className="text-center text-[10px] leading-relaxed text-white/40">画像は、形や色の参考にだけ使います。ほかの人の顔は使えません</p>}
              {/* back to the two choices; before the first step, small: the look as it is (happy with it, or nothing can be
                  changed — no mana, the painter down) */}
              <Quiet onClick={used > 0 ? () => setPhase('shown') : decide}>{used > 0 ? 'もどる' : ok}</Quiet>
            </>
          )}
        </div>
      </div>
    </Veil>
  );
}

/**
 * D03-S004 〔映像（映画の場面・約8秒）〕 drawn with light (no painted film yet): the water of the bowl rises and wraps the
 * visitor, light spirals up inside it, it clears, and the still surface shows the decided look. 〔スキップ〕 at the
 * corner; for those who ask for less motion it is a short still.
 */
function FixFilm({ picture, onDone }: { picture: string; onDone: () => void }) {
  const done = useRef(false);
  const end = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };
  useEffect(() => {
    const calm = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(end, calm ? 1800 : 8000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div data-testid="look-fix-film" className="absolute inset-0 z-[30] overflow-hidden bg-[#03040c]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/onboarding/s/d2-moon-in.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-35" />
      <span aria-hidden className="mystic-motes absolute inset-0" />
      {/* the water rises and wraps us */}
      <span aria-hidden className="film-water absolute inset-x-0 bottom-0 h-full" />
      {/* light spirals up inside the water */}
      <span aria-hidden className="film-spiral absolute left-1/2 top-1/2 h-[120vmax] w-[120vmax]" />
      {/* it clears: the still surface, the decided look on it */}
      <div className="film-surface absolute inset-x-0 bottom-[14svh] flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={picture} alt="" className="max-h-[46svh] max-w-[70vw] object-contain" style={{ filter: 'drop-shadow(0 0 30px rgba(190,225,255,0.6))' }} />
        <span aria-hidden className="look-water -mt-3 h-[8svh] w-[80vw] max-w-md rounded-[50%]" />
      </div>
      <button type="button" onClick={end} className="pb-safe absolute bottom-4 right-4 rounded-full border border-white/25 bg-black/40 px-3 py-1 text-[11px] tracking-widest text-white/60">
        スキップ
      </button>
    </div>
  );
}

/** what one's own look screen answered (D03-S004): `f_d03_photo`, `f_d03_card` */
export interface Pick4Flags {
  photo?: 'folder' | 'camera';
  card?: number;
}

export function LookPick4Panel({
  noPhoto = false,
  spell,
  onSaid,
  onChooseForm,
  onDone,
}: {
  /** M-R250: no photo may be used — the wished look is said by voice */
  noPhoto?: boolean;
  spell?: StepLine;
  onSaid?: (text: string) => void;
  /** nothing could be drawn: one of the eight prepared forms instead */
  onChooseForm: (id: string) => Promise<void>;
  /** the base chosen (null: a prepared form) */
  onDone: (url: string | null, flags?: Pick4Flags) => void;
}) {
  const [phase, setPhase] = useState<'ask' | 'making' | 'pick' | 'failed' | 'forms'>('ask');
  const [wish, setWish] = useState('');
  const [cands, setCands] = useState<{ id: string; url: string }[]>([]);
  const [took, setTook] = useState(0);
  const [via, setVia] = useState<'folder' | 'camera' | undefined>();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const last = useRef<Parameters<ReturnType<typeof getApi>['lookPick4']>[0] | null>(null);
  const folder = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);

  const draw = async (body: Parameters<ReturnType<typeof getApi>['lookPick4']>[0]) => {
    last.current = body;
    setErr(null);
    setPhase('making');
    const started = Date.now();
    try {
      const r = await Promise.race([getApi().lookPick4(body), new Promise<never>((_, no) => setTimeout(() => no(new Error('timeout')), 180_000))]);
      await new Promise((go) => setTimeout(go, Math.max(0, 3600 - (Date.now() - started))));
      if (!r.candidates.length) return setPhase('failed');
      setCands(r.candidates);
      setTook(r.mana);
      setPhase('pick');
    } catch (e) {
      setErr(words(e, ''));
      setPhase('failed');
    }
  };

  const choose = async (c: { id: string; url: string }, k: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await getApi().lookStepBase(c.id);
      onDone(c.url, { photo: via, card: k + 1 });
    } catch {
      setErr('うまく決められなかった……もう一度');
      setBusy(false);
    }
  };

  if (phase === 'forms')
    return (
      <NeoChooser
        onChoose={async (id) => {
          await onChooseForm(id);
          onDone(null);
        }}
      />
    );

  if (phase === 'making')
    return (
      <Veil>
        <div className="mx-auto mt-[22svh] flex max-w-sm flex-col gap-4 px-6" style={{ fontFamily: SERIF }}>
          {wish.trim() && <p className="max-w-[85%] self-end rounded-2xl rounded-br-sm bg-amber-200/90 px-3 py-2 text-[15px] text-amber-950">{wish.trim()}</p>}
          {spell && <Said line={spell} />}
          <div className="relative mx-auto mt-4 h-40 w-72" aria-hidden>
            <span className="look-water absolute inset-x-0 bottom-0 h-20 rounded-[50%]" />
            <span className="look-rise absolute inset-x-10 bottom-4 top-0 rounded-[45%]" />
          </div>
        </div>
      </Veil>
    );

  if (phase === 'failed')
    return (
      <Sheet>
        <p className="text-center text-amber-100">{err || AGAIN}</p>
        <div className="mt-4 flex flex-col gap-2">
          <Gold onClick={() => (last.current ? void draw(last.current) : setPhase('ask'))}>もう一度</Gold>
          <Plain onClick={() => setPhase('forms')}>用意された8つの姿から選ぶ</Plain>
        </div>
      </Sheet>
    );

  if (phase === 'pick')
    return (
      <Sheet>
        <p className="text-right text-[10px] tracking-[0.12em] text-amber-200/60" style={{ fontFamily: SERIF }}>
          {took > 0 ? `マナジェム −${formatMana(took)}` : ''}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {cands.map((c, k) => (
            <button key={c.id} disabled={busy} onClick={() => void choose(c, k)} aria-label={`${k + 1}枚目`} className="overflow-hidden rounded-2xl border border-amber-200/30 bg-white/5 transition active:scale-[0.97] disabled:opacity-60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.url} alt="" className="aspect-[3/4] w-full object-contain" />
            </button>
          ))}
        </div>
        {err && <p className="mt-2 text-center text-xs text-rose-300">{err}</p>}
      </Sheet>
    );

  // ask: the photo's two ways in, or (no photo) the wished look by voice
  return (
    <Sheet>
      {noPhoto ? (
        <>
          <VoiceField
            value={wish}
            onChange={setWish}
            placeholder="例「銀色の髪の、星の旅人」"
            maxLength={60}
          />
          <div className="mt-3">
            <Gold
              disabled={!wish.trim()}
              onClick={() => {
                onSaid?.(wish.trim());
                void draw({ wish: wish.trim() });
              }}
            >
              これにする
            </Gold>
          </div>
        </>
      ) : (
        <>
          {[folder, camera].map((r, k) => (
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
                  const p = await fileToReference(f);
                  const way = k === 1 ? 'camera' : 'folder';
                  setVia(way);
                  // the photo is only handed to the painter (never kept here or there)
                  void draw({ photo: { mime: p.mime, data: p.data }, via: way });
                } catch {
                  setErr('その写真は、読みこめなかった……');
                }
              }}
            />
          ))}
          <p className="text-[11px] leading-relaxed text-white/55">自分だけが写っている写真にしてね。ほかの人の顔は使えません。写真は、姿を作るためだけに使い、作ったあとは残しません</p>
          {err && <p className="mt-2 text-xs text-amber-200/80">{err}</p>}
          <div className="mt-3 flex flex-col gap-2">
            <Gold onClick={() => folder.current?.click()}>写真フォルダから器の水に映す</Gold>
            <Gold onClick={() => camera.current?.click()}>カメラで撮って器の水に映す</Gold>
          </div>
        </>
      )}
    </Sheet>
  );
}

/** ♀ (the moon egg) / ♂ (the sun egg): a small glowing mark beside {bati} — on the screen only, never in its picture */
export function EggMark({ egg, className = '' }: { egg: BatiEggKind; className?: string }) {
  const m = eggMark(egg);
  return (
    <span
      data-testid="egg-mark"
      aria-label={m === '♀' ? '月のたまごの子' : '太陽のたまごの子'}
      className={`egg-mark grid h-7 w-7 place-items-center rounded-full text-[15px] leading-none ${m === '♀' ? 'text-sky-100' : 'text-amber-100'} ${className}`}
      style={{ textShadow: m === '♀' ? '0 0 10px rgba(190,220,255,0.95)' : '0 0 10px rgba(255,214,140,0.95)' }}
    >
      {m}
    </span>
  );
}

function Said({ line }: { line: StepLine }) {
  return (
    <div className="flex max-w-[88%] animate-[fadeIn_0.5s_ease-out] items-start gap-2 self-start">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {line.face && <img src={line.face} alt="" className="h-9 w-9 shrink-0 object-contain" />}
      <div>
        <p className="text-[10px] tracking-[0.2em] text-amber-100/65">{line.name}</p>
        <p className="rounded-2xl rounded-tl-sm bg-white/10 px-3 py-2 text-[15px] text-amber-50">{line.text}</p>
      </div>
    </div>
  );
}

/** the bowl of water's room: the Moon temple dimmed, a few motes of light (still for those who ask for less motion) */
function Veil({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 overflow-hidden bg-black/70 text-amber-50 backdrop-blur-[2px]">
      <span aria-hidden className="mystic-motes absolute inset-0" />
      {children}
    </div>
  );
}

function Sheet({ children }: { children: ReactNode }) {
  return (
    <div className="pb-safe absolute inset-x-0 bottom-0 z-20 max-h-[90svh] overflow-y-auto rounded-t-3xl border-t border-amber-200/30 bg-black/85 px-5 pb-8 pt-5 text-amber-50 backdrop-blur-md">
      <div className="mx-auto max-w-md">{children}</div>
    </div>
  );
}

function Gold({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="w-full rounded-full border border-amber-200/80 bg-gradient-to-b from-amber-200/25 to-amber-500/10 py-3.5 text-[16px] tracking-widest text-amber-50 disabled:opacity-40">
      {children}
    </button>
  );
}

function Plain({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="w-full rounded-full border border-white/30 bg-black/30 py-3 text-sm tracking-wider text-white/85 disabled:opacity-40">
      {children}
    </button>
  );
}

function Quiet({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mx-auto block py-1 text-xs text-white/50 underline">
      {children}
    </button>
  );
}
