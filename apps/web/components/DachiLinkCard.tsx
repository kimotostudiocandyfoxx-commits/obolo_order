'use client';

import type { DachiLinkAsk, DachiLinkView } from '@obolo/shared';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { getApi } from '@/lib/api';

export const dachiLinkUrl = (token: string) => `${window.location.origin}/dachi/${token}`;

/**
 * 〔🤝 ダチの招待状〕 (M-R175, earth.md E-7, saturn.md S-6): a link / QR that works once for 48 hours, for people
 * already in space whom one really knows. 〔リンクを送る〕 opens the phone's own share sheet (LINE, mail…),
 * 〔QRを見せる〕 shows it big to be read when they meet, 〔やめる〕 closes the link. When someone opened it and pressed
 * 〔ダチになる〕, the giver is asked 「〈名前〉が、ダチの招待状を開きました。ダチになる？」. No mana, no age limit.
 */
export function DachiLinkCard() {
  const [link, setLink] = useState<DachiLinkView | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [given, setGiven] = useState(false);
  const [asks, setAsks] = useState<DachiLinkAsk[]>([]);
  const [made, setMade] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      getApi()
        .dachiLinkAsks()
        .then(setAsks)
        .catch(() => undefined);
    void load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, []);

  const make = async () => {
    setErr(null);
    try {
      const l = link ?? (await getApi().createDachiLink());
      setLink(l);
      return l;
    } catch {
      setErr('今は、ダチの招待状を作れませんでした。少したってから、もう一度');
      return null;
    }
  };
  const send = async () => {
    const l = await make();
    if (!l) return;
    const url = dachiLinkUrl(l.token);
    try {
      if (navigator.share) await navigator.share({ title: 'ダチの招待状', text: 'ダチの招待状です。開いて〔ダチになる〕を押してね（48時間で消えます）', url });
      else await navigator.clipboard.writeText(url);
      setGiven(true);
    } catch {
      /* the share sheet was closed */
    }
  };
  const showQr = async () => {
    const l = await make();
    if (!l) return;
    setQr(await QRCode.toDataURL(dachiLinkUrl(l.token), { margin: 1, width: 560, color: { dark: '#1a1206', light: '#fff8e6' } }));
    setGiven(true);
  };
  const stop = async () => {
    if (link) await getApi().endDachiLink(link.token).catch(() => undefined);
    setLink(null);
    setQr(null);
    setGiven(false);
  };
  const yes = async (a: DachiLinkAsk) => {
    try {
      const who = await getApi().confirmDachiLink(a.token);
      setMade(who.displayName);
      setAsks((x) => x.filter((y) => y.token !== a.token));
      if (link?.token === a.token) await stop();
    } catch {
      setAsks((x) => x.filter((y) => y.token !== a.token));
    }
  };

  return (
    <section className="card p-5">
      <h3 className="text-sm font-bold text-white/70">🤝 ダチの招待状</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-white/60">もう宇宙にいる、本当に知っている人とダチになる招待状です。一回だけ使えるリンクとQRが出ます（48時間で消えます）</p>
      <p className="mt-1 text-[11px] text-white/45">知らない人を名前で探すことは、できません。マナは使いません</p>
      {asks.map((a) => (
        <div key={a.token} className="mt-3 rounded-2xl border border-amber-200/40 bg-amber-200/10 p-3 text-center">
          <p className="text-[14px] text-amber-50">{a.who.displayName}が、ダチの招待状を開きました。ダチになる？</p>
          <button onClick={() => void yes(a)} className="mt-2 rounded-full border border-amber-200 bg-amber-200/20 px-6 py-2 text-[14px] font-bold text-amber-50">
            ダチになる
          </button>
        </div>
      ))}
      {made && <p className="mt-3 text-center text-[13px] text-amber-100">{made}と、ダチになりました</p>}
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="ダチの招待状のQR" className="mx-auto mt-3 w-[min(70vw,280px)] rounded-2xl" />
      )}
      {given && <p className="mt-2 text-center text-[12px] text-white/60">ダチの招待状を渡しました。相手が開くかどうかは、相手が決めます</p>}
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <button onClick={() => void send()} className="rounded-full bg-white/10 px-4 py-2 text-[13px] font-bold">
          リンクを送る
        </button>
        <button onClick={() => void showQr()} className="rounded-full bg-white/10 px-4 py-2 text-[13px] font-bold">
          QRを見せる
        </button>
        {link && (
          <button onClick={() => void stop()} className="rounded-full px-4 py-2 text-[13px] text-white/60">
            やめる
          </button>
        )}
      </div>
      {err && <p className="mt-2 text-center text-xs text-rose-300">{err}</p>}
    </section>
  );
}
