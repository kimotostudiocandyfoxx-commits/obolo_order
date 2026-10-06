'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LookMaker } from '@/components/onboarding/LookMaker';
import { getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * /lab — operator page to try the real image generation (Gemini) as many times as needed:
 * the OBOLO NEO look (picture or questions → 4 candidates → refine) and the Bati from a food.
 * Uses the logged-in account; the admin token lifts the try limits. Not linked from the app.
 */
export default function LabPage() {
  const { me, status, setMe } = useAuth();
  const api = getApi();
  const [admin, setAdmin] = useState('');
  const [round, setRound] = useState(0);
  const [made, setMade] = useState<string[]>([]);
  const [food, setFood] = useState('ラーメン');
  const [bati, setBati] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    try {
      setAdmin(localStorage.getItem('obolo.lookAdmin') ?? '');
    } catch {
      /* ignore */
    }
  }, []);

  if (status === 'loading') return <main className="min-h-svh bg-black" />;
  return (
    <main className="min-h-svh bg-[#07060d] px-5 pb-24 pt-[calc(20px+env(safe-area-inset-top))] text-white">
      <h1 className="text-center text-lg tracking-[0.4em] text-amber-100">生成テスト</h1>
      <p className="mt-1 text-center text-xs text-white/55">
        {api.mode === 'live' ? '本番の AI（Gemini）で生成します' : 'デモモードです（仮の絵）。本番の AI にはつながっていません'}
      </p>
      {!me ? (
        <p className="mt-8 text-center text-sm">
          ログインが必要です。
          <Link href="/" className="ml-1 underline">
            トップでログイン
          </Link>
          してから、もう一度開いてください。
        </p>
      ) : (
        <>
          <section className="mx-auto mt-5 max-w-md rounded-2xl border border-white/15 bg-white/5 p-4">
            <p className="text-xs text-white/60">管理トークン（入れると回数制限なしで何回でも試せます）</p>
            <input
              value={admin}
              onChange={(e) => {
                setAdmin(e.target.value.trim());
                try {
                  localStorage.setItem('obolo.lookAdmin', e.target.value.trim());
                } catch {
                  /* ignore */
                }
              }}
              type="password"
              className="mt-1 w-full rounded-full border border-white/20 bg-black/60 px-4 py-2 text-sm outline-none"
              placeholder="obolo-admin-token の値"
            />
            <p className="mt-2 text-[11px] text-white/45">ログイン中：{me.displayName}（{me.email}）。決めた姿・バティはこのアカウントに保存されます。</p>
          </section>

          <section className="mx-auto mt-5 max-w-md rounded-2xl border border-white/15 bg-white/5 p-4">
            <p className="text-xs text-white/60">
              旅の日を移動（管理トークンが必要）　いま：{me.journeyDay >= 10 ? 'ORDER' : `${me.journeyDay}日目`}
              {me.orderedAt ? '・支払い済み' : ''}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <button
                  key={d}
                  disabled={!admin || busy}
                  onClick={async () => {
                    setBusy(true);
                    setErr(null);
                    try {
                      setMe(await api.jumpJourney(d));
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : String(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className={`h-9 w-9 rounded-full text-sm disabled:opacity-30 ${me.journeyDay === d ? 'bg-amber-300 font-bold text-black' : 'bg-white/10'}`}
                >
                  {d}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-white/45">
              9 を押す → トップを開くと9日目が最初から始まります（支払いもやり直せます）。Stripe のテストはこれで。
            </p>
          </section>

          <section className="mx-auto mt-6 max-w-md">
            <h2 className="mb-2 text-sm tracking-widest text-amber-100">① ネオの姿</h2>
            <div className="relative h-[640px] overflow-hidden rounded-3xl border border-amber-200/20 bg-[radial-gradient(circle_at_50%_30%,#2a2140,#07060d)]">
              <LookMaker
                key={round}
                api={{
                  candidates: (a) => api.lookCandidates(a),
                  refine: (id, instruction) => api.refineLook(id, instruction),
                  choose: async (id) => {
                    const u = await api.chooseLook(id);
                    setMe(u);
                    return u.avatarUrl ?? '';
                  },
                  chooseForm: async (id) => {
                    setMe(await api.updateMe({ neoForm: id }));
                  },
                }}
                onDone={(url) => {
                  if (url) setMade((m) => [url, ...m]);
                  setRound((r) => r + 1);
                }}
              />
            </div>
            {made.length > 0 && (
              <>
                <p className="mb-2 mt-3 text-xs text-white/55">決めた姿（新しい順）</p>
                <div className="grid grid-cols-3 gap-2">
                  {made.map((u, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={u} alt="" className="aspect-square w-full rounded-xl object-cover" />
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="mx-auto mt-8 max-w-md">
            <h2 className="mb-2 text-sm tracking-widest text-amber-100">② バティ（好きな食べ物から）</h2>
            <div className="flex gap-2">
              <input value={food} onChange={(e) => setFood(e.target.value)} className="min-w-0 flex-1 rounded-full border border-white/20 bg-black/60 px-4 py-2.5 text-sm outline-none" />
              <button
                disabled={busy || !food.trim()}
                onClick={async () => {
                  setBusy(true);
                  setErr(null);
                  try {
                    const keepName = me.bati?.name;
                    await api.batiEgg(food.trim());
                    let u = await api.batiHatch();
                    if (keepName) u = await api.batiName(keepName);
                    setMe(u);
                    if (u.bati?.imageUrl) setBati((b) => [u.bati!.imageUrl!, ...b]);
                    else setErr('うまく生まれなかった（生成に失敗）');
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
                className="rounded-full bg-amber-500 px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40"
              >
                {busy ? '生成中…' : '生む'}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-white/45">押すたびに新しいバティを生成します（いまのバティは置き換わります）</p>
            {err && <p className="mt-2 text-xs text-rose-300">{err}</p>}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {bati.map((u, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={u} alt="" className="aspect-square w-full rounded-xl object-cover" />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
