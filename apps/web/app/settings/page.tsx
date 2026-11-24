"use client";

import { isActiveMember, membershipEnded, type Me } from "@obolo/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { getApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * 〔設定〕 — for now the 〔毎月のマナ〕 part (M-R199 / M-R202): your mana, whether you are Obolo Order, and on days 3–7 of
 * the first journey 〔先にObolo Orderになる〕, which always plays SYS-S002 (the explanation) before the payment.
 * P-BILL-4: 〔エクリプス（月¥88）〕 — the status and 〔支払い方法の変更・解約〕 (the Stripe Customer Portal).
 * M-R252 (the draft's section 4): 〔写真と声を消す〕, 〔作った物を消す〕〔会話を消す〕, 〔毎月のマナ〕→〔やめる〕, 〔利用規約〕〔プライバシーについて〕.
 */
export default function SettingsPage() {
  return (
    <RequireAuth>
      <Settings />
    </RequireAuth>
  );
}

function Settings() {
  const { me } = useAuth();
  const [mana, setMana] = useState<number | null>(null);
  useEffect(() => {
    getApi()
      .wallet()
      .then((w) => setMana(w.manaBalance))
      .catch(() => setMana(null));
  }, []);
  if (!me) return null;
  const ordered = !!me.orderedAt;
  // from the end of day 3 to day 7 (day 8 decides it in the story itself)
  const early =
    !ordered &&
    (me.journeyDay > 3 || (me.journeyDay === 3 && !!me.journeyCompletedAt)) &&
    me.journeyDay < 8;
  return (
    <main className="pt-safe pb-safe mx-auto min-h-svh max-w-md px-4 py-4">
      <header className="flex items-center gap-2">
        <Link
          href="/"
          className="btn btn-ghost h-9 w-9 !p-0 text-lg"
          aria-label="もどる"
        >
          ←
        </Link>
        <h1 className="text-lg font-black">設定</h1>
      </header>
      <section className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-black text-[color:var(--color-mana)]">
          毎月のマナ
        </h2>
        <p className="mt-2 text-3xl font-black text-[color:var(--color-mana)]">
          {mana === null ? "…" : mana.toLocaleString()}
        </p>
        <p className="mt-1 text-xs text-white/55">
          {isActiveMember(me)
            ? "Obolo Order：毎月、体から88マナが湧きます（月額88円）"
            : "住人：マナジェムのマナで作ります"}
        </p>
        {early && (
          <Link
            href="/settings/order-early"
            className="mt-4 block rounded-full bg-gradient-to-b from-amber-300 to-orange-500 py-3 text-center text-[15px] font-black text-slate-950"
          >
            先にObolo Orderになる
          </Link>
        )}
      </section>
      {ordered && <Eclipse />}
      <VoiceAndPhoto />
      <WorksAndTalk />
      <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="flex gap-2">
          <Link
            href="/terms"
            className="flex-1 rounded-full border border-white/20 py-2.5 text-center text-[13px] text-white/85"
          >
            利用規約
          </Link>
          <Link
            href="/privacy"
            className="flex-1 rounded-full border border-white/20 py-2.5 text-center text-[13px] text-white/85"
          >
            プライバシーについて
          </Link>
        </div>
        <Link
          href="/tokushoho"
          className="mt-2 block rounded-full border border-white/20 py-2.5 text-center text-[13px] text-white/85"
        >
          特定商取引法に基づく表記
        </Link>
      </section>
    </main>
  );
}

const SUB_STATUS: Record<Me["subscriptionStatus"], string> = {
  active: "続いています",
  trialing: "続いています",
  past_due: "お支払いが確認できていません。カードをご確認ください",
  incomplete: "お支払いが確認できていません。カードをご確認ください",
  canceled: "終わりました",
  unpaid: "お支払いができなかったため、止まっています",
  incomplete_expired: "終わりました",
  paused: "止まっています",
  demo: "デモ（請求はありません）",
  none: "まだ始まっていません",
};

/** 「12月26日」 */
const monthDay = (iso: string) =>
  new Date(iso).toLocaleDateString("ja-JP", {
    month: "long",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  });

/**
 * P-BILL-4: 〔エクリプス（月¥88）〕 for members who have paid — the subscription status and 〔支払い方法の変更・解約〕,
 * which opens the Stripe Customer Portal (POST /billing/portal; it comes back to /settings). Demo mode has nothing to cancel.
 * The portal cancels at the end of the paid month (the dashboard's default, "At end of billing period"): until then
 * 「〇月〇日で終わります（それまでは使えます）」. Once it has ended (canceled / unpaid: shared membershipEnded) the
 * member features close — the works stay — and 〔もう一度はじめる〕 pays again (/settings/order-again, the same checkout).
 */
function Eclipse() {
  const { me } = useAuth();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!me) return null;
  const ended = membershipEnded(me);
  const ending = !ended && !!me.cancelAtPeriodEnd && !!me.currentPeriodEnd;
  const open = async () => {
    setBusy(true);
    setNote(null);
    try {
      const p = await getApi().billingPortal();
      if (p.mode === "demo") {
        setNote("デモなので解約はありません");
        setBusy(false);
        return;
      }
      window.location.assign(p.url);
    } catch {
      setNote("うまく開けませんでした。少し待って、もう一度どうぞ");
      setBusy(false);
    }
  };
  return (
    <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
      <h2 className="text-sm font-black text-amber-100">エクリプス（月¥88）</h2>
      <div className="py-2.5">
        <p className="text-[11px] text-white/50">いまの状態</p>
        <p className="mt-0.5 text-[14px] font-bold">
          {ending
            ? `${monthDay(me.currentPeriodEnd!)}で終わります（それまでは使えます）`
            : (SUB_STATUS[me.subscriptionStatus] ?? me.subscriptionStatus)}
        </p>
      </div>
      {ended ? (
        <>
          <p className="mb-3 text-[11px] leading-relaxed text-white/50">
            作った物は、そのまま残っています。もう一度はじめると、Obolo
            Orderの場所がまたひらきます。
          </p>
          <Link
            href="/settings/order-again"
            className="block rounded-full bg-gradient-to-b from-amber-300 to-orange-500 py-3 text-center text-[15px] font-black text-slate-950"
          >
            もう一度はじめる
          </Link>
        </>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void open()}
          className="block w-full rounded-full border border-amber-200/60 py-2.5 text-center text-[13px] text-amber-100 disabled:opacity-40"
        >
          {busy ? "開いています…" : "支払い方法の変更・解約"}
        </button>
      )}
      {!ended && (
        <p className="mt-2 text-[11px] leading-relaxed text-white/50">
          解約しても、その月の終わりまでは使えます。作った物は残ります
        </p>
      )}
      {note && <p className="mt-2 text-[12px] text-amber-100/80">{note}</p>}
      <Link
        href="/tokushoho"
        className="mt-2 inline-block text-[11px] text-white/55 underline underline-offset-4"
      >
        特定商取引法に基づく表記
      </Link>
    </section>
  );
}

/**
 * M-R246 / M-R247 / M-R252: 〔写真と声を消す〕 — both at once (the draft's settings item): the egg recording and {bati}'s
 * voice model are deleted (DELETE /voice/bati) — {bati} speaks in the prepared voice; the photo itself was never kept,
 * the looks made from it are deleted (DELETE /me/look) — you stand as the look made without a photo.
 */
function VoiceAndPhoto() {
  const { me, setMe } = useAuth();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!me) return null;
  const voice = me.voices?.batiState ?? (me.voices?.bati ? "ready" : "none");
  const hasVoice = voice !== "none" || !!me.voices?.bati;
  const hasLook = !!(me.avatarUrl || me.lookStandee);
  const run = async () => {
    setBusy(true);
    setNote(null);
    try {
      if (hasVoice) setMe(await getApi().removeBatiVoice());
      if (hasLook) setMe(await getApi().removeLook());
      setNote(
        "写真と声を消しました。写真を使わない姿と、用意した声に戻りました",
      );
    } catch {
      setNote("うまく消せませんでした。もう一度どうぞ");
    } finally {
      setBusy(false);
      setAsk(false);
    }
  };
  const state = (title: string, now: string) => (
    <div className="py-2.5">
      <p className="text-[14px] font-bold">{title}</p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-white/50">{now}</p>
    </div>
  );
  return (
    <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
      <h2 className="text-sm font-black">写真と声</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-white/50">
        写真と声は、あなたの姿と相方（バティ）の声を作るためだけに使います。ほかの目的には使いません。
      </p>
      <div className="mt-1 divide-y divide-white/10">
        {state(
          "相方の声",
          hasVoice
            ? voice === "making"
              ? "あなたの声から、相方の声を作っています"
              : "あなたの声を、少し高くして使っています"
            : "用意した声で話しています",
        )}
        {state(
          "あなたの姿",
          hasLook
            ? "写真から作った姿があります（写真そのものは保存していません）"
            : "写真から作った姿はありません",
        )}
      </div>
      <ConfirmRow
        label="写真と声を消す"
        note="消すと、写真を使わない姿と、用意した声に戻ります"
        can={hasVoice || hasLook}
        ask={ask}
        busy={busy}
        onAsk={setAsk}
        onRun={() => void run()}
      />
      {note && <p className="mt-2 text-[12px] text-amber-100/80">{note}</p>}
    </section>
  );
}

/** a delete button that asks once more (〔やめる〕〔消す〕) */
function ConfirmRow({
  label,
  note,
  can,
  ask,
  busy,
  onAsk,
  onRun,
}: {
  label: string;
  note: string;
  can: boolean;
  ask: boolean;
  busy: boolean;
  onAsk: (on: boolean) => void;
  onRun: () => void;
}) {
  return (
    <div className="flex items-center gap-3 pt-3">
      <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-white/50">
        {note}
      </p>
      {ask ? (
        <div className="flex shrink-0 gap-1.5">
          <button
            disabled={busy}
            onClick={() => onAsk(false)}
            className="rounded-full border border-white/20 px-3 py-1.5 text-[12px] text-white/70"
          >
            やめる
          </button>
          <button
            disabled={busy}
            onClick={onRun}
            className="rounded-full bg-rose-400/90 px-3 py-1.5 text-[12px] font-bold text-slate-950 disabled:opacity-40"
          >
            消す
          </button>
        </div>
      ) : (
        <button
          disabled={!can || busy}
          onClick={() => onAsk(true)}
          className="shrink-0 rounded-full border border-rose-300/60 px-3 py-1.5 text-[12px] text-rose-200 disabled:opacity-30"
        >
          {label}
        </button>
      )}
    </div>
  );
}

/**
 * M-R252: 〔作った物を消す〕〔会話を消す〕. 〔会話を消す〕: the talk with {bati} and what {bati} remembered (DELETE /buddy/memory).
 * PLACEHOLDER (P-LEGAL-3): 〔作った物を消す〕 (every work on every planet at once) is not built yet — the button is shown, off.
 */
function WorksAndTalk() {
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const forget = async () => {
    setBusy(true);
    setNote(null);
    try {
      await getApi().buddyForget();
      setNote("会話を消しました");
    } catch {
      setNote("うまく消せませんでした。もう一度どうぞ");
    } finally {
      setBusy(false);
      setAsk(false);
    }
  };
  return (
    <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
      <h2 className="text-sm font-black">作った物と会話</h2>
      <div className="flex items-center gap-3 pt-3">
        <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-white/50">
          作った物を、まとめて消します（準備中です）
        </p>
        <button
          type="button"
          disabled
          className="shrink-0 rounded-full border border-rose-300/60 px-3 py-1.5 text-[12px] text-rose-200 disabled:opacity-30"
        >
          作った物を消す
        </button>
      </div>
      <ConfirmRow
        label="会話を消す"
        note="相方との会話と、相方が覚えたことを消します"
        can
        ask={ask}
        busy={busy}
        onAsk={setAsk}
        onRun={() => void forget()}
      />
      {note && <p className="mt-2 text-[12px] text-amber-100/80">{note}</p>}
    </section>
  );
}
