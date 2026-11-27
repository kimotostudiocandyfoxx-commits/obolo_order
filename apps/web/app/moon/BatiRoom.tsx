'use client';

import { useEffect, useState } from 'react';
import { ApiError, getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { BatiLook } from '@/components/bati/BatiLook';
import { isActiveMember, LOOK_LOCKED_LINE } from '@obolo/shared';
import { LookStepsPanel } from '@/components/look/LookSteps';
import { batiLine, batiLineVoiceOf } from '@/lib/onboarding/batiLine';

/**
 * Bati's room (the Moon; client 2026-11-22: "24時間の間はバティと喋らせまくる時間にしたい"): next to the chat,
 * 〔着替え・変身〕 dresses up / changes the Bati a little (POST /me/bati/restyle) and 〔自分の姿を変えてもらう〕 is Bati's
 * magic on the member's own look (POST /me/look/refine with `magic`, again and again until they like it).
 * No counts on screen; at the day's end Bati says so.
 */
export type RoomMode = 'bati' | 'me';

// PLACEHOLDER (P-BATI-ROOM): Bati's short lines in the room, stand-ins until the script writes them
const LINES = {
  bati: {
    open: 'どんなふうに着替えようか？ 帽子でも、マントでも、言ってみて',
    busy: '着替えてくるね。少し時間がかかるから、待っててね',
    pick: 'どれがいい？ 気に入らなかったら、もう一回言ってね',
    done: 'どう？ 似合ってる？',
  },
  me: {
    open: '魔法で、{name}の姿を変えてあげる。どこをどう変えたい？',
    busy: 'いくよ……えいっ。少し時間がかかるから、待っててね',
    pick: 'どれがいい？ 選んでから、もっと変えることもできるよ',
    done: 'うん、いい感じ！',
  },
  limit: '今日の魔法は、ここまで。また明日、つづきをしよう',
  words: 'その言葉は使えないみたい。別の言い方にしてみて',
  failed: 'うまくいかなかった。もう一回やってみよう',
} as const;

const IDEAS: Record<RoomMode, string[]> = {
  bati: ['帽子をかぶせて', 'マントを着せて', 'リボンをつけて', '小さな羽をはやして'],
  me: ['髪の色を変えて', '笑顔にして', '服を明るい色に', '帽子をかぶせて'],
};

/** thin one-weight marks like components/bluena/glyphs.tsx */
export function RoomIcon({ id, className = 'h-[18px] w-[18px]' }: { id: 'dress' | 'magic'; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {id === 'dress' ? (
        // a hanger
        <path d="M12 7.2a1.9 1.9 0 1 1 1.9-1.9c0 1-.9 1.4-1.9 2.2v1.2M12 8.7 3.5 15.2c-.7.6-.3 1.8.6 1.8h15.8c.9 0 1.3-1.2.6-1.8L12 8.7" />
      ) : (
        // a wand with a little star
        <>
          <path d="M4 20 14.5 9.5" />
          <path d="M17 3.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
          <path d="M7 5.5v2M6 6.5h2M19 15v2M18 16h2" />
        </>
      )}
    </svg>
  );
}

export function RoomSheet({ mode, onClose, onDone, name }: { mode: RoomMode; onClose: () => void; onDone: (line: string) => void; /** the name {bati} calls you (the story's {neo} when no account: the review page) */ name?: string }) {
  const { me } = useAuth();
  // client 2026-11-27: an Obolo Order member changes {bati} (進化) and their own look (変身) step by step — the same round
  // as day 2 (shared lookSteps.ts): each step from the look it has now, 8 a round, the mana per step
  if (me && isActiveMember(me)) return <StepsRoom mode={mode} onClose={onClose} onDone={onDone} />;
  // a resident: the looks decided on day 2 stay as they are until Obolo Order — {bati} says so. (No account — the review
  // page — keeps the four cards of the story.)
  if (mode === 'bati') return me ? <LockedSheet onClose={onClose} /> : <BatiLookSheet onClose={onClose} onDone={onDone} />;
  return <MeSheet onClose={onClose} onDone={onDone} name={name} />;
}

/** PLACEHOLDER (story chat): {bati}'s words when a resident asks to change {bati}'s look after day 2 ({self}: its 一人称) */
export const BATI_LOOK_LOCKED_LINE = '{self}の姿は、もう決まったよ。Obolo Orderに入ったら、また進化できるからね！';

function LockedSheet({ onClose }: { onClose: () => void }) {
  const { me } = useAuth();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="card w-full max-w-xl rounded-b-none px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-4" onClick={(e) => e.stopPropagation()}>
        {me?.bati?.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={me.bati.imageUrl} alt="" className="mx-auto h-40 w-40 object-contain" />
        )}
        <p className="mx-auto mt-3 max-w-[22rem] rounded-2xl bg-white/10 px-4 py-2.5 text-center text-[14px] leading-relaxed">{batiLine(BATI_LOOK_LOCKED_LINE, batiLineVoiceOf(me?.bati))}</p>
        <button className="btn btn-ghost mt-3 h-11 w-full" onClick={onClose}>
          とじる
        </button>
      </div>
    </div>
  );
}

/** an Obolo Order member's round: opened from the look worn now (POST /me/look/steps/open), then the day-2 panel */
function StepsRoom({ mode, onClose, onDone }: { mode: RoomMode; onClose: () => void; onDone: (line: string) => void }) {
  const { me, setMe } = useAuth();
  const who = mode === 'bati' ? ('bati' as const) : ('self' as const);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    getApi()
      .lookStepOpen(who)
      .then(() => live && setReady(true))
      .catch((e) => live && setErr(e instanceof ApiError && e.code === 'LOOK_LOCKED' ? e.message : LINES.failed));
    return () => {
      live = false;
    };
  }, [who]);
  const bati = me?.bati?.name || 'バティ';
  return (
    <div className="fixed inset-0 z-50 bg-[#05060f]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/onboarding/s/d2-moon-in.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-60" />
      {ready ? (
        <LookStepsPanel
          who={who}
          counter={who === 'bati' ? '進化' : '変身'}
          ok={who === 'bati' ? `${bati}の姿はこれだ` : 'この姿にする'}
          more={who === 'bati' ? '進化させる' : '変身させる'}
          example={who === 'bati' ? '翼を生やして' : '髪を銀色にして'}
          limit={{ name: bati, text: batiLine(LINES.limit, batiLineVoiceOf(me?.bati)), face: me?.bati?.imageUrl ?? undefined }}
          image={who === 'bati' ? me?.bati?.imageUrl : me?.avatarUrl}
          egg={who === 'bati' ? me?.bati?.egg : undefined}
          noImage={me?.mediaOk === false}
          fixNote
          onDone={({ used }) => {
            void getApi()
              .me()
              .then((u) => u && setMe(u))
              .catch(() => undefined);
            if (used > 0) onDone(LINES[mode].done);
            onClose();
          }}
        />
      ) : (
        <p className="absolute inset-x-6 top-[42svh] text-center text-sm leading-relaxed text-amber-100/80">{err ?? '……'}</p>
      )}
      <button className="pt-safe absolute right-3 top-3 z-30 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white/70" onClick={onClose} aria-label="閉じる">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}

function BatiLookSheet({ onClose, onDone }: { onClose: () => void; onDone: (line: string) => void }) {
  const { me, setMe } = useAuth();
  const bati = me?.bati?.name || 'バティ';
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="card max-h-[92svh] w-full max-w-xl overflow-y-auto rounded-b-none px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-4" onClick={(e) => e.stopPropagation()}>
        <BatiLook
          bati={bati}
          ask="これで、決まり？"
          auto={false}
          onMe={setMe}
          onClose={onClose}
          onDecided={() => {
            onDone(LINES.bati.done);
            onClose();
          }}
        />
      </div>
    </div>
  );
}

function MeSheet({ onClose, onDone, name: given }: { onClose: () => void; onDone: (line: string) => void; name?: string }) {
  const mode = 'me' as RoomMode;
  const { me, setMe } = useAuth();
  const api = getApi();
  const name = me?.displayName || given || 'あなた';
  // the lock line in {bati}'s own style ({self} = its 一人称)
  const lockedLine = (n: string) => batiLine(LOOK_LOCKED_LINE, batiLineVoiceOf(me?.bati)).replaceAll('{neo}', n);
  const current = mode === 'bati' ? (me?.bati?.imageUrl ?? null) : (me?.avatarUrl ?? null);
  const [wish, setWish] = useState('');
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<{ id: string; url: string }[]>([]);
  const [pick, setPick] = useState<string | null>(null);
  // client 2026-11-25: a resident's look stays as it is once confirmed (day 2's night) until they join — {bati} says so
  // (PLACEHOLDER line, LOOK_LOCKED_LINE) and offers no magic
  const locked = mode === 'me' && !!me?.lookLocked;
  const [line, setLine] = useState<string>(locked ? lockedLine(name) : LINES[mode].open.replace('{name}', name));
  const [ended, setEnded] = useState(locked);

  const shown = candidates.find((c) => c.id === pick)?.url ?? current;
  const hist = me?.lookHistory ?? [];
  const prevLook = current ? (hist[hist.indexOf(current) - 1] ?? null) : null;

  const cast = async () => {
    const w = wish.trim();
    if (!w || busy) return;
    setBusy(true);
    setLine(LINES[mode].busy);
    try {
      // Bati's magic goes on from the picked one, so the look can be changed step by step
      const r = mode === 'bati' ? await api.batiRestyle(w) : await api.refineLook(pick, w, true);
      if (!r.candidates.length) {
        setLine(LINES.failed);
        return;
      }
      setCandidates(r.candidates);
      setPick(r.candidates[0].id);
      setWish('');
      setLine(LINES[mode].pick);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      if (code === 'RESTYLE_TRIES' || code === 'LOOK_REFINES') {
        setEnded(true);
        setLine(LINES.limit);
      } else if (code === 'LOOK_LOCKED') {
        setEnded(true);
        setLine(lockedLine(name));
      } else if (code === 'MODERATION') setLine(LINES.words);
      else if (code === 'NO_MANA' && e instanceof ApiError) setLine(e.message);
      else setLine(LINES.failed);
    } finally {
      setBusy(false);
    }
  };

  const choose = async () => {
    if (!pick || busy) return;
    setBusy(true);
    try {
      setMe(mode === 'bati' ? await api.chooseBatiRestyle(pick) : await api.chooseLook(pick));
      onDone(LINES[mode].done);
      onClose();
    } catch {
      setLine(LINES.failed);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={busy ? undefined : onClose}>
      <div className="card max-h-[92svh] w-full max-w-xl overflow-y-auto rounded-b-none px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          <RoomIcon id={mode === 'bati' ? 'dress' : 'magic'} />
          <h3 className="flex-1 text-[15px] font-black">{mode === 'bati' ? '着替え・変身' : '自分の姿を変えてもらう'}</h3>
          <button className="btn btn-ghost h-9 w-9 !p-0" onClick={onClose} disabled={busy} aria-label="閉じる">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {/* the picture, big: the one picked, or the one worn now */}
        <div className={`relative mx-auto aspect-square w-full max-w-[260px] overflow-hidden rounded-3xl ${mode === 'bati' ? 'bg-[radial-gradient(circle_at_50%_40%,rgba(255,240,210,0.16),rgba(255,255,255,0.03)_70%)]' : 'bg-white/5'}`}>
          {shown && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className={`h-full w-full ${mode === 'bati' ? 'object-contain p-3' : 'object-cover'} ${busy ? 'opacity-40' : ''} transition-opacity`} />
          )}
          {busy && (
            <span className="absolute inset-0 m-auto block h-16 w-16" aria-hidden>
              <span className="absolute inset-0 animate-[spin_3s_linear_infinite] rounded-full border-2 border-dashed border-amber-200/80" />
              <span className="absolute inset-[10px] animate-[spin_2s_linear_infinite_reverse] rounded-full border border-sky-200/80" />
              <span className="absolute inset-[24px] animate-pulse rounded-full bg-amber-100/90" />
            </span>
          )}
        </div>

        {/* the choices: the one worn now first */}
        {candidates.length > 0 && (
          <div className="mt-3 flex justify-center gap-2">
            {[...(current ? [{ id: '', url: current }] : []), ...candidates].map((c) => {
              const on = (pick ?? '') === c.id;
              return (
                <button
                  key={c.id || 'now'}
                  type="button"
                  disabled={busy}
                  onClick={() => setPick(c.id || null)}
                  className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 ${on ? 'border-amber-200' : 'border-transparent bg-white/5'}`}
                  aria-label={c.id ? '候補' : 'いまの姿'}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.url} alt="" className={`h-full w-full ${mode === 'bati' ? 'object-contain' : 'object-cover'}`} />
                  {!c.id && <span className="absolute inset-x-0 bottom-0 bg-black/55 text-[9px] leading-4 text-white/80">いま</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Bati's line */}
        <p className="mx-auto mt-3 max-w-[22rem] rounded-2xl bg-white/10 px-4 py-2.5 text-center text-[14px] leading-relaxed">{line}</p>

        {!ended && (
          <>
            {/* the ideas wrap onto a second row rather than run off a phone's edge */}
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {IDEAS[mode].map((idea) => (
                <button key={idea} type="button" disabled={busy} onClick={() => setWish(idea)} className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-[12px] text-white/75">
                  {idea}
                </button>
              ))}
            </div>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void cast();
              }}
            >
              <input className="input min-h-11 min-w-0 flex-1" maxLength={60} placeholder={mode === 'bati' ? 'どんなかっこうにする？' : 'どこをどう変える？'} value={wish} disabled={busy} onChange={(e) => setWish(e.target.value)} />
              <button className="btn btn-ghost h-11 shrink-0 !px-4" disabled={busy || !wish.trim()}>
                魔法をかける
              </button>
            </form>
          </>
        )}
        {pick && (
          <button className="btn btn-primary mt-3 h-12 w-full" disabled={busy} onClick={() => void choose()}>
            これにする
          </button>
        )}
        {/* M-R223 〔前に戻す〕: the look worn before this one */}
        {!pick && prevLook && !locked && (
          <button
            className="mt-3 w-full text-[12px] text-white/60 underline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                setMe(await api.lookRestore(prevLook));
              } catch {
                setLine(LINES.failed);
              } finally {
                setBusy(false);
              }
            }}
          >
            前に戻す
          </button>
        )}
      </div>
    </div>
  );
}
