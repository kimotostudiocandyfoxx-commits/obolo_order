'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { PRESETS, playPreset } from '@/lib/story/sfx';

/**
 * /kakunin-5798f28713/story-assets (client plan 2026-10-13): everything the story needs — people, places, sound
 * effects, tunes, voices — with where each stands, from public/story/assets.json (scripts/story-assets.ts).
 * Candidates are numbered: the client picks by number ("エビは2"), the pick goes in design/story-picks.json.
 */
type Status = 'ready' | 'arrived' | 'waiting' | 'candidates' | 'orderable' | 'needs-sheet';
interface Person {
  name: string;
  id: string;
  uses: number;
  aliases: string[];
  status: Status;
  sprite: string | null;
  candidates: string[];
  pick: string | null;
  sheet: { look: string; personality: string; voice: string } | null;
}
interface Place {
  name: string;
  id: string;
  scenes: string[];
  status: Status;
  image: string | null;
  candidates: string[];
  pick: string | null;
  sheet: { look: string; light: string } | null;
}
interface Assets {
  made: string;
  sheets: { cast: number; places: number };
  cast: Person[];
  places: Place[];
  sounds: { text: string; scenes: string[]; file: string | null; preset: string | null }[];
  music: { name: string; scenes: string[]; file: string | null }[];
}
interface Voices {
  auditions?: { name: string; line: string; takes: { voice: string; file: string }[] }[];
  chosen?: Record<string, string>;
}

const STATUS: Record<Status, [string, string]> = {
  ready: ['絵あり', 'bg-emerald-400/20 text-emerald-200'],
  arrived: ['届いた・取り込み待ち', 'bg-sky-400/20 text-sky-200'],
  waiting: ['クライアントの絵待ち', 'bg-sky-400/10 text-sky-200/80'],
  candidates: ['候補から選ぶ', 'bg-amber-400/25 text-amber-100'],
  orderable: ['描ける', 'bg-white/10 text-white/70'],
  'needs-sheet': ['見た目の説明待ち', 'bg-white/5 text-white/45'],
};

export function StoryAssets() {
  const [a, setA] = useState<Assets | null>(null);
  const [v, setV] = useState<Voices>({});
  const [tab, setTab] = useState<'cast' | 'places' | 'voices' | 'sound'>('cast');
  const [hideReady, setHideReady] = useState(false);
  useEffect(() => {
    fetch('/story/assets.json').then((r) => r.json()).then(setA, () => undefined);
    fetch('/story/voices/auditions.json').then((r) => (r.ok ? r.json() : {})).then(setV, () => undefined);
  }, []);
  if (!a) return <div className="min-h-dvh bg-[#07060d]" />;
  const tabs = [
    ['cast', `人物 ${a.cast.length}`],
    ['places', `場所 ${a.places.length}`],
    ['voices', `声 ${v.auditions?.length ?? 0}`],
    ['sound', `効果音・BGM ${a.sounds.length + a.music.length}`],
  ] as const;
  return (
    <div className="min-h-dvh bg-[#07060d] px-4 pb-16 pt-[calc(12px+env(safe-area-inset-top))] text-white">
      <div className="mb-3 flex items-center gap-2">
        <Link href="/kakunin-5798f28713" className="rounded-full bg-white/10 px-3 py-1 text-xs">←</Link>
        <h1 className="text-sm font-bold tracking-widest text-amber-100">物語の素材</h1>
        <span className="ml-auto text-[10px] text-white/40">人物表 {a.sheets.cast || '未着'} ／ 場所表 {a.sheets.places || '未着'}</span>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-3 py-1 text-xs ${tab === k ? 'bg-amber-300 text-black' : 'bg-white/10'}`}>
            {label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1 text-[11px] text-white/60">
          <input type="checkbox" checked={hideReady} onChange={(e) => setHideReady(e.target.checked)} />
          絵ありを隠す
        </label>
      </div>

      {tab === 'cast' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {a.cast.filter((c) => !hideReady || c.status !== 'ready').map((c) => (
            <Card key={c.name} title={c.name} sub={`セリフ ${c.uses}${c.aliases.length ? `・${c.aliases.join('、')}` : ''}`} status={c.status} pick={c.pick}>
              {c.sprite && <Thumb src={c.sprite} label="いまの絵" contain />}
              {c.candidates.map((src, k) => (
                <Thumb key={src} src={src} label={`${k + 1}`} picked={c.pick === String(k + 1)} />
              ))}
              {c.sheet && (
                <p className="col-span-full text-[11px] leading-relaxed text-white/55">
                  {c.sheet.look}
                  {c.sheet.voice ? <span className="block text-white/40">声：{c.sheet.voice}</span> : null}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {tab === 'places' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {a.places.filter((p) => !hideReady || p.status !== 'ready').map((p) => (
            <Card key={p.name} title={p.name} sub={p.scenes.slice(0, 4).join('、')} status={p.status} pick={p.pick}>
              {p.image && <Thumb src={p.image} label="いまの絵" />}
              {p.candidates.map((src, k) => (
                <Thumb key={src} src={src} label={`${k + 1}`} picked={p.pick === String(k + 1)} />
              ))}
              {p.sheet && <p className="col-span-full text-[11px] leading-relaxed text-white/55">{p.sheet.look}</p>}
            </Card>
          ))}
        </div>
      )}

      {tab === 'voices' && (
        <div className="grid gap-3">
          {!v.auditions?.length && <p className="text-xs text-white/50">声の候補はまだありません。</p>}
          {v.auditions?.map((x) => (
            <div key={x.name} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-sm font-bold text-amber-100">
                {x.name}
                {v.chosen?.[x.name] && <span className="ml-2 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] text-emerald-200">決定：{v.chosen[x.name]}</span>}
              </p>
              <p className="mb-2 text-[11px] text-white/50">「{x.line}」</p>
              <div className="grid gap-2">
                {x.takes.map((t, k) => (
                  <div key={t.file} className="flex items-center gap-2">
                    <span className="w-6 text-center text-xs font-bold text-amber-200">{k + 1}</span>
                    <audio controls preload="none" src={t.file} className="h-8 min-w-0 flex-1" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'sound' && (
        <div className="grid gap-4 text-sm">
          <Presets />
          <section>
            <p className="mb-2 text-xs text-white/50">効果音（〔SE：…〕）</p>
            {!a.sounds.length && <p className="text-xs text-white/40">台本にまだありません。</p>}
            {a.sounds.map((s) => (
              <div key={s.text} className="mb-2 flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{s.text}</span>
                {s.file ? <audio controls preload="none" src={s.file} className="h-8 w-40" /> : s.preset ? <span className="text-[11px] text-amber-200">合成：{s.preset}</span> : <span className="text-[11px] text-white/40">本物の音が必要</span>}
              </div>
            ))}
          </section>
          <section>
            <p className="mb-2 text-xs text-white/50">BGM（〔BGM：…〕）</p>
            {!a.music.length && <p className="text-xs text-white/40">台本にまだありません。</p>}
            {a.music.map((m) => (
              <div key={m.name} className="mb-2 flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                {m.file ? <audio controls preload="none" src={m.file} className="h-8 w-40" /> : <span className="text-[11px] text-white/40">まだ</span>}
              </div>
            ))}
          </section>
        </div>
      )}
      <p className="mt-8 text-[10px] text-white/30">更新 {new Date(a.made).toLocaleString('ja-JP')}</p>
    </div>
  );
}

function Card({ title, sub, status, pick, children }: { title: string; sub: string; status: Status; pick: string | null; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-sm font-bold">{title}</p>
        <span className={`rounded-full px-2 py-0.5 text-[10px] ${STATUS[status][1]}`}>{STATUS[status][0]}</span>
        {pick && <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] text-emerald-200">選んだ：{pick === 'client' ? '届いた絵' : pick}</span>}
      </div>
      {sub && <p className="mb-2 truncate text-[11px] text-white/40">{sub}</p>}
      <div className="grid grid-cols-3 gap-2">{children}</div>
    </div>
  );
}

function Thumb({ src, label, picked, contain }: { src: string; label: string; picked?: boolean; contain?: boolean }) {
  return (
    <a href={src} target="_blank" rel="noreferrer" className={`relative block overflow-hidden rounded-xl border ${picked ? 'border-emerald-300' : 'border-white/10'} bg-[repeating-conic-gradient(#222_0_25%,#2c2c2c_0_50%)] bg-[length:16px_16px]`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className={`aspect-[9/16] w-full ${contain ? 'object-contain' : 'object-cover'}`} />
      <span className="absolute left-1 top-1 rounded-full bg-black/70 px-2 text-[11px] font-bold text-amber-200">{label}</span>
    </a>
  );
}

/** The synthesised sound effects, to hear each (lib/story/sfx.ts). */
function Presets() {
  const ctx = useRef<AudioContext | null>(null);
  return (
    <section>
      <p className="mb-2 text-xs text-white/50">合成で鳴らせる効果音（タップで試聴）</p>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => {
              ctx.current ??= new AudioContext();
              void ctx.current.resume();
              playPreset(ctx.current, p);
            }}
            className="rounded-full bg-white/10 px-3 py-1 text-xs"
          >
            {p}
          </button>
        ))}
      </div>
    </section>
  );
}
