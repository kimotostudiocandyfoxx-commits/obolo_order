"use client";

import type { Me, NeoLookCandidate } from "@obolo/shared";
import { useEffect, useRef, useState } from "react";
import { ApiError, getApi } from "@/lib/api";
import { VoiceField } from "@/components/onboarding/StoryExtras";

/**
 * M-R223 (D03-S008 {bati}の見た目): inside the chat, four cards of the {bati} as it is now in four art touches (アニメ風・
 * ゆるキャラ風・3D風・ドット絵風). A tap on a card makes {bati} pop into that look (only on the screen until decided); a
 * wish said in words (「もっとかっこよく」「服を着せて」) brings a new four, from the card tapped last. 〔前に戻す〕 goes
 * back any time (the look tapped before, then the looks decided before: POST /me/bati/restyle/back). Once a card is
 * tapped {bati} asks `ask` (「これで、決まり？」) with `ok` / `more`; `more` lays out another four, as often as they like.
 * No mana on the first journey (the server's rule), no counts on screen.
 */
type Card = NeoLookCandidate & { label?: string };

const LINES = {
  busy: "えいっ……ちょっと待ってね",
  words: "その言葉は使えないみたい。別の言い方にしてみて",
  failed: "うまくいかなかった。もう一回やってみよう",
  limit: "今日の魔法は、ここまで。また明日、つづきをしよう",
} as const;

export function BatiLook({
  bati,
  ask,
  ok = "これで決まり",
  more = "もうちょっと変える",
  onDecided,
  onClose,
  onMe,
  auto = true,
}: {
  bati: string;
  /** {bati}'s question once a card is tapped (the script's 「これで、決まり？」) */
  ask: string;
  ok?: string;
  more?: string;
  /** the look decided and saved (Me after it) */
  onDecided: (me: Me) => void;
  /** the sheet's 〔とじる〕 (the story has none: the look is decided there) */
  onClose?: () => void;
  onMe?: (me: Me) => void;
  /** the four touches come at once (the story); off: they come with the first wish or 〔いろんなタッチ〕 */
  auto?: boolean;
}) {
  const api = getApi();
  const [now, setNow] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  // what was tapped, in order (〔前に戻す〕 goes back through it)
  const [tapped, setTapped] = useState<Card[]>([]);
  const [prevCards, setPrevCards] = useState<Card[][]>([]);
  const [wish, setWish] = useState("");
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const [pop, setPop] = useState(0);
  /** a card of the four on screen was tapped: {bati} asks whether it is decided */
  const [asking, setAsking] = useState(false);
  const started = useRef(false);
  const sel = tapped[tapped.length - 1] ?? null;
  const shown = sel?.url ?? now;

  useEffect(() => {
    void api
      .me()
      .then((m) => setNow(m.bati?.imageUrl ?? null))
      .catch(() => undefined);
  }, [api]);

  const cast = async (w: string) => {
    if (busy) return;
    setBusy(true);
    setLine(LINES.busy);
    try {
      const r = await api.batiRestyle(w.trim() || undefined, sel?.id);
      if (!r.candidates.length) return setLine(LINES.failed);
      if (cards.length) setPrevCards((p) => [...p, cards]);
      setCards(r.candidates.map((c, k) => ({ ...c, label: r.touches?.[k] })));
      setWish("");
      setLine(null);
      setAsking(false);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "";
      setLine(
        code === "RESTYLE_TRIES"
          ? LINES.limit
          : code === "MODERATION"
            ? (e as ApiError).message || LINES.words
            : code === "NO_MANA"
              ? (e as ApiError).message
              : LINES.failed,
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!auto || started.current) return;
    started.current = true;
    void cast("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  const tap = (c: Card) => {
    if (busy) return;
    setTapped((t) => [...t, c]);
    setPop((n) => n + 1);
    setAsking(true);
  };

  const back = async () => {
    if (busy) return;
    if (tapped.length) {
      setTapped((t) => t.slice(0, -1));
      setPop((n) => n + 1);
      return;
    }
    if (prevCards.length) {
      setCards(prevCards[prevCards.length - 1]);
      setPrevCards((p) => p.slice(0, -1));
      return;
    }
    // nothing tapped here: the look decided before this one
    setBusy(true);
    try {
      const me = await api.batiLookBack();
      setNow(me.bati?.imageUrl ?? null);
      setPop((n) => n + 1);
      onMe?.(me);
    } catch {
      setLine("これより前の姿は、ないみたい");
    } finally {
      setBusy(false);
    }
  };

  const decide = async () => {
    if (!sel || busy) return;
    setBusy(true);
    try {
      const me = await api.chooseBatiRestyle(sel.id);
      onMe?.(me);
      onDecided(me);
    } catch {
      setLine(LINES.failed);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* {bati} in the look on the screen: pops into each card tapped */}
      <div className="relative mx-auto h-36 w-36">
        {shown && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={pop}
            src={shown}
            alt=""
            className={`h-full w-full animate-[batiPop_0.45s_cubic-bezier(.2,1.6,.4,1)] object-contain drop-shadow-[0_0_18px_rgba(255,220,150,0.35)] ${busy ? "opacity-50" : ""}`}
          />
        )}
        {busy && (
          <span
            className="pointer-events-none absolute inset-[-12%] animate-[spin_3s_linear_infinite] rounded-full border border-dashed border-amber-200/60"
            aria-hidden
          />
        )}
        <style>
          {
            "@keyframes batiPop{0%{transform:scale(.6)}60%{transform:scale(1.12)}100%{transform:scale(1)}}"
          }
        </style>
      </div>
      {line && (
        <p className="mx-auto max-w-[22rem] rounded-2xl bg-white/10 px-3 py-2 text-center text-[13px] leading-relaxed">
          {line}
        </p>
      )}

      {cards.length > 0 && (
        <div
          className="grid grid-cols-4 gap-2"
          aria-label={`${bati}の見た目の候補`}
        >
          {cards.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={busy}
              onClick={() => tap(c)}
              className={`flex flex-col items-center overflow-hidden rounded-2xl border-2 bg-white/[0.06] p-1 transition active:scale-95 ${sel?.id === c.id ? "border-amber-200" : "border-transparent"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.url}
                alt=""
                className="aspect-square w-full object-contain"
              />
              {c.label && (
                <span className="mt-0.5 truncate text-[10px] text-amber-50/70">
                  {c.label}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* once a card is tapped: {bati}'s 「これで、決まり？」 */}
      {sel && asking && !busy && (
        <div className="space-y-2">
          <p className="max-w-[86%] rounded-2xl rounded-bl-sm bg-white/10 px-3 py-2 text-[14px]">
            <span className="mr-1 text-[10px] tracking-widest text-amber-200/70">
              {bati}
            </span>
            {ask}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => void decide()}
              className="flex-1 rounded-full border border-amber-200/70 bg-amber-200/15 py-2.5 text-[14px]"
            >
              {ok}
            </button>
            <button
              onClick={() => void cast("")}
              className="flex-1 rounded-full border border-white/25 py-2.5 text-[14px] text-amber-50/80"
            >
              {more}
            </button>
          </div>
        </div>
      )}

      {/* a wish in words: a new four */}
      <VoiceField
        value={wish}
        onChange={setWish}
        placeholder="例「もっとかっこよく」「服を着せて」"
        maxLength={60}
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => void back()}
          disabled={busy}
          className="rounded-full bg-white/10 px-4 py-2 text-[12px] disabled:opacity-40"
        >
          前に戻す
        </button>
        {wish.trim() ? (
          <button
            onClick={() => void cast(wish)}
            disabled={busy}
            className="flex-1 rounded-full border border-amber-200/50 bg-amber-200/10 py-2 text-[13px] disabled:opacity-40"
          >
            {bati}に頼む
          </button>
        ) : (
          !auto &&
          !cards.length && (
            <button
              onClick={() => void cast("")}
              disabled={busy}
              className="flex-1 rounded-full border border-amber-200/40 py-2 text-[13px] disabled:opacity-40"
            >
              いろんなタッチで描く
            </button>
          )
        )}
        {onClose && (
          <button
            onClick={onClose}
            disabled={busy}
            className="ml-auto text-[12px] text-amber-50/60 underline"
          >
            とじる
          </button>
        )}
      </div>
    </div>
  );
}
