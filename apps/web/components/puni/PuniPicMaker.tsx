'use client';

import { useState } from 'react';
import { ApiError, getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * 🎨 AI で絵のキャラを作る (client decision 2026-10-07): describe your character (optionally with a
 * picture to take colours / motifs from, or your OBOLO NEO look) → the AI paints 2 round ぷにぷに
 * candidates in the style of the reference characters → pick one → it becomes your Saturn body
 * (painted, warped by the physics). 3 tries a day (≈ ¥6 an image).
 */
export function PuniPicMaker({ onClose, onSaved }: { onClose: () => void; onSaved: (pic: string | null) => void }) {
  const { me, setMe } = useAuth();
  const [text, setText] = useState('');
  const [ref, setRef] = useState<{ mime: string; data: string; preview: string } | null>(null);
  const [useNeo, setUseNeo] = useState(false);
  const [cands, setCands] = useState<{ id: string; url: string }[]>([]);
  const [pick, setPick] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState<'gen' | 'save' | null>(null);
  const [err, setErr] = useState('');
  const [bounce, setBounce] = useState(0);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 4_000_000) return setErr('画像が大きすぎます（4MBまで）');
    const buf = new Uint8Array(await f.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    setRef({ mime: f.type || 'image/png', data: btoa(bin), preview: URL.createObjectURL(f) });
    setUseNeo(false);
  };

  const generate = async () => {
    if (text.trim().length < 2) return setErr('どんなキャラか、ひとこと書いてね');
    setBusy('gen');
    setErr('');
    try {
      const r = await getApi().puniPicCandidates({
        description: text.trim(),
        ...(ref ? { reference: { mime: ref.mime, data: ref.data } } : {}),
        ...(useNeo ? { useNeoLook: true } : {}),
      });
      setCands(r.candidates);
      setPick(r.candidates[0]?.id ?? null);
      setLeft(r.left);
      if (!r.candidates.length) setErr('うまく描けなかった…もう一度ためしてね');
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'PUNI_PIC_TRIES' ? '今日はもう作れないよ。また明日ためしてね' : e instanceof ApiError && e.code === 'MODERATION' ? 'その言葉は使えないよ' : '描けなかった…もう一度ためしてね');
    } finally {
      setBusy(null);
    }
  };

  const save = async (mediaId: string | null) => {
    setBusy('save');
    setErr('');
    try {
      const u = await getApi().choosePuniPic(mediaId);
      setMe(u);
      onSaved(u.puniPic);
    } catch {
      setErr('保存できなかった…もう一度');
    } finally {
      setBusy(null);
    }
  };

  const shown = cands.find((c) => c.id === pick)?.url ?? me?.puniPic ?? null;

  return (
    <div className="fixed inset-0 z-[97] flex flex-col bg-[#fff7fb] text-[#3d2a5c] animate-[fadeUp_0.25s_ease-out]" style={{ fontFamily: '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", system-ui, sans-serif' }}>
      <div className="pt-safe relative shrink-0 overflow-hidden bg-gradient-to-b from-[#2f2268] via-[#6d48b0] to-[#e6a3cf] pb-4">
        <div className="starfield" aria-hidden />
        <div className="relative flex items-center justify-between px-4 pt-2">
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-lg font-black text-violet-600 shadow" aria-label="back">
            ←
          </button>
          <p className="text-sm font-black text-white drop-shadow">🎨 AIで絵のキャラを作る</p>
          <span className="w-9" />
        </div>
        <button onClick={() => setBounce(Date.now())} className="relative mx-auto mt-2 flex h-[190px] w-[190px] items-center justify-center" aria-label="squish">
          {busy === 'gen' ? (
            <span className="animate-pulse text-sm font-black text-white">描いています…（10〜20秒）</span>
          ) : shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={bounce} src={shown} alt="" className="h-full w-full animate-[puniSquish_0.55s_cubic-bezier(.3,1.6,.5,1)] object-contain drop-shadow-[0_6px_10px_rgba(40,10,80,.35)]" style={{ transformOrigin: '50% 85%' }} />
          ) : (
            <span className="px-6 text-center text-xs font-bold text-white/80">ここにあなたのキャラが描かれるよ</span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
        {cands.length > 0 && (
          <div className="mb-3 flex justify-center gap-3">
            {cands.map((c) => (
              <button key={c.id} onClick={() => setPick(c.id)} className={`h-24 w-24 rounded-3xl bg-white p-1 shadow ${pick === c.id ? 'ring-4 ring-pink-300' : ''}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.url} alt="" className="h-full w-full object-contain" />
              </button>
            ))}
          </div>
        )}
        <p className="text-xs font-black text-[#8a76bd]">どんなキャラ？</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 200))}
          placeholder="例：サーモンのお寿司みたいな、ゆるくて元気なキャラ。小さな王冠をかぶってる"
          className="mt-1 h-24 w-full resize-none rounded-2xl bg-white p-3 text-[16px] shadow-sm outline-none"
        />
        <p className="mt-3 text-xs font-black text-[#8a76bd]">参考にする絵（なくてもOK）</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#7a62b0] shadow-sm">
            🖼 画像をえらぶ
            <input type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          </label>
          {me?.avatarUrl && (
            <button
              onClick={() => {
                setUseNeo((v) => !v);
                setRef(null);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ${useNeo ? 'bg-violet-500 text-white' : 'bg-white text-[#7a62b0]'}`}
            >
              ✨ ネオの姿を参考にする
            </button>
          )}
          {ref && (
            <span className="flex items-center gap-1 rounded-full bg-white py-1 pl-1 pr-2 text-[11px] shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ref.preview} alt="" className="h-6 w-6 rounded-full object-cover" />
              <button onClick={() => setRef(null)} className="text-[#a08fc4]" aria-label="remove">
                ✕
              </button>
            </span>
          )}
        </div>
        <p className="mt-2 text-[10px] text-[#a08fc4]">参考の画像は描くときに見せるだけで、保存はしないよ</p>
      </div>

      <div className="pb-safe shrink-0 border-t border-violet-100 bg-white px-4 py-3">
        {err && <p className="mb-1 text-center text-xs text-rose-500">{err}</p>}
        <div className="flex gap-2">
          <button onClick={() => void generate()} disabled={!!busy} className="flex-1 rounded-full bg-[#f3ecff] py-3 text-sm font-black text-[#5a3f8a] disabled:opacity-50">
            {cands.length ? '🎨 もう一度描く' : '🎨 描いてもらう'}
            {left !== null && <span className="ml-1 text-[10px] font-bold">（今日あと{left}回）</span>}
          </button>
          {pick && (
            <button onClick={() => void save(pick)} disabled={!!busy} className="flex-1 rounded-full bg-gradient-to-r from-pink-400 to-violet-400 py-3 text-sm font-black text-white shadow disabled:opacity-50">
              {busy === 'save' ? '保存中…' : 'このキャラにする'}
            </button>
          )}
        </div>
        {me?.puniPic && (
          <button onClick={() => void save(null)} disabled={!!busy} className="mt-2 w-full text-center text-[11px] font-bold text-slate-400">
            絵のキャラをやめる（シンプルな丸にもどす）
          </button>
        )}
      </div>
    </div>
  );
}
