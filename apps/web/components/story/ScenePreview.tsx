'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CAST } from '@/lib/story/cast';
import type { Scene } from '@/lib/story/parse';
import { Story, type Options, type RunState, type Shown } from '@/lib/story/runtime';
import { hasMotion, motionUrl, spriteUrl } from '@/lib/onboarding/media';
import { formOf, voiceKey } from '@/lib/story/voice';
import { playPreset, type Preset } from '@/lib/story/sfx';

/**
 * Sound for the read-through: each line's voice (public/story/voices/manifest.json, by voiceKey), the
 * sound effects met before a line (public/story/sound/manifest.json "se": text → file) and the tune
 * (manifest "bgm": name → file, looped). One element each, unlocked on the first tap (iOS only lets a
 * tap start sound).
 */
function useStorySound(on: boolean) {
  const els = useRef<{ voice: HTMLAudioElement; se: HTMLAudioElement[]; bgm: HTMLAudioElement } | null>(null);
  const [voices, setVoices] = useState<Record<string, string>>({});
  const [sound, setSound] = useState<{ se?: Record<string, string>; bgm?: Record<string, string> }>({});
  const tune = useRef<string | null>(null);
  const synth = useRef<AudioContext | null>(null);
  useEffect(() => {
    els.current = { voice: new Audio(), se: [new Audio(), new Audio(), new Audio()], bgm: Object.assign(new Audio(), { loop: true, volume: 0.35 }) };
    const get = (u: string) => fetch(u).then((r) => (r.ok ? r.json() : {}), () => ({}));
    void get('/story/voices/manifest.json').then(setVoices);
    void get('/story/sound/manifest.json').then(setSound);
    return () => {
      const e = els.current;
      if (e) [e.voice, e.bgm, ...e.se].forEach((a) => a.pause());
    };
  }, []);
  const unlock = useCallback(() => {
    const e = els.current;
    if (!e || (e.voice as HTMLAudioElement & { unlocked?: boolean }).unlocked) return;
    for (const a of [e.voice, e.bgm, ...e.se]) {
      a.muted = true;
      void a.play().catch(() => undefined);
      a.pause();
      a.muted = false;
    }
    (e.voice as HTMLAudioElement & { unlocked?: boolean }).unlocked = true;
    // the synthesised sound effects: a context made (and resumed) inside the tap
    synth.current ??= new AudioContext();
    void synth.current.resume();
  }, []);
  const play = useCallback(
    (shown: Shown | null, se: string[], bgm: string | null | undefined) => {
      const e = els.current;
      if (!e) return;
      // the tune: change only when it changes
      const want = on && bgm ? sound.bgm?.[bgm] ?? null : null;
      if (want !== tune.current) {
        tune.current = want;
        e.bgm.pause();
        if (want) {
          e.bgm.src = want;
          void e.bgm.play().catch(() => undefined);
        }
      }
      if (!on) return e.voice.pause();
      se.forEach((t, k) => {
        const f = sound.se?.[t];
        const a = e.se[k % e.se.length];
        if (!f) return;
        if (f.startsWith('synth:')) {
          if (synth.current) playPreset(synth.current, f.slice(6) as Preset);
          return;
        }
        a.src = f;
        void a.play().catch(() => undefined);
      });
      e.voice.pause();
      const f = shown?.k === 'say' ? voices[voiceKey(shown.who, shown.act, shown.text)] : undefined;
      if (f) {
        e.voice.src = f;
        void e.voice.play().catch(() => undefined);
      }
    },
    [on, voices, sound],
  );
  return { unlock, play };
}

/**
 * /kakunin-5798f28713/story — the imported story (docs/story-rewrite → public/story/*.json) played scene by
 * scene, for the client's final read-through on the real screen (client decision 2026-10-12):
 * jump to any scene, go back a step, show the stage notes, set the names and states used in the
 * text. App screens that do not exist yet show as a card and let the story go on.
 */
type Vars = Record<'name' | 'inviter' | 'neo' | 'bati' | 'food' | 'age', string>;
const DEFAULT_VARS: Vars = { name: 'ユウ', inviter: 'ハル', neo: 'ネオ', bati: 'ポコ', food: 'たこ焼き', age: '12' };
const KEY = 'obolo-story-preview';

const load = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
};
const save = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* private mode: no resume */
  }
};

export function ScenePreview() {
  const [story, setStory] = useState<Story | null>(null);
  const [stills, setStills] = useState<Set<string>>(new Set());
  // standing pictures made after cast.ts (public/story/cast/manifest.json: name or alias → picture)
  const [sprites, setSprites] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const [vars, setVars] = useState<Vars>(DEFAULT_VARS);
  const [opts, setOpts] = useState<Options & { sound?: boolean }>({ notes: false, states: [], sound: true });
  const audio = useStorySound(opts.sound !== false);
  const [se, setSe] = useState<string[]>([]);
  const [st, setSt] = useState<RunState | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [back, setBack] = useState<RunState[]>([]);
  const [panel, setPanel] = useState<'none' | 'scenes' | 'settings'>('none');

  // the scenes (all parts: a choice can jump across parts) and the painted stills
  useEffect(() => {
    (async () => {
      try {
        const idx = (await (await fetch('/story/index.json')).json()) as { parts: string[] };
        const parts = await Promise.all(idx.parts.map(async (p) => (await (await fetch(`/story/${p}.json`)).json()) as Scene[]));
        setStory(new Story(parts.flat()));
        const m = await fetch('/story/stills/manifest.json').then((r) => (r.ok ? (r.json() as Promise<string[]>) : []), () => []);
        setStills(new Set(m));
        setSprites(await fetch('/story/cast/manifest.json').then((r) => (r.ok ? (r.json() as Promise<Record<string, string>>) : {}), () => ({})));
      } catch (e) {
        setErr(String(e));
      }
    })();
    setVars(load(`${KEY}-vars`, DEFAULT_VARS));
    setOpts(load(`${KEY}-opts`, { notes: false, states: [], sound: true }));
  }, []);

  const show = useCallback(
    (from: RunState, push = true) => {
      if (!story) return;
      const r = story.next(from, opts);
      if (push && st) setBack((b) => [...b.slice(-150), st]);
      setSt(r.st);
      setShown(r.shown);
      setSe(r.se);
      save(KEY, r.st);
    },
    [story, opts, st],
  );

  // start where the last read-through stopped
  useEffect(() => {
    if (!story || st) return;
    const saved = load<RunState | null>(KEY, null);
    show(saved && story.byId.has(saved.scene) ? { ...saved, stack: saved.stack.map((f) => ({ ...f, i: Math.max(-1, f.i - 1) })) } : story.start(), false);
  }, [story, st, show]);

  const fill = useCallback((t: string) => t.replace(/\{(name|inviter|neo|bati|food|age)\}/g, (_, k: keyof Vars) => vars[k] || '…'), [vars]);
  const goScene = (id: string) => {
    if (!story) return;
    setPanel('none');
    show(story.start(id));
  };
  // play the line's voice, its sound effects and the tune as it appears
  useEffect(() => {
    audio.play(shown, se, st?.bgm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);
  const tap = () => {
    audio.unlock();
    if (st && story) show(story.advance(st));
  };
  const undo = () => {
    const prev = back[back.length - 1];
    if (!prev || !story) return;
    setBack((b) => b.slice(0, -1));
    const r = story.next(prev, opts);
    setSt(r.st);
    setShown(r.shown);
  };

  const scene = st && story ? story.byId.get(st.scene) : null;
  const speaker = shown?.k === 'say' ? shown.who : null;
  const sprite = useMemo(() => {
    if (!speaker) return null;
    // a form named in the line (大根カイザー（第2形態）「…」) picks that form's picture
    const form = shown?.k === 'say' ? formOf(shown.act) : null;
    if (form && sprites[`${speaker}#${form}`]) return sprites[`${speaker}#${form}`];
    if (sprites[speaker]) return sprites[speaker];
    const c = CAST.find((m) => m.name === speaker);
    return c?.sprite && !c.sprite.startsWith('@') ? spriteUrl(c.sprite) : null;
  }, [speaker, sprites, shown]);

  if (err) return <p className="p-6 text-sm text-rose-300">読み込めませんでした: {err}</p>;
  if (!story || !shown || !st) return <div className="fixed inset-0 bg-black" />;

  const pic = st.picture;
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#07060d] text-white">
      {/* the picture behind: a painted still, else what it will show */}
      <div className="absolute inset-0">
        {pic?.kind === 'video' && hasMotion(/^\d+$/.test(pic.id) ? Number(pic.id) : pic.id) ? (
          <video key={pic.id} src={motionUrl(/^\d+$/.test(pic.id) ? Number(pic.id) : pic.id)} autoPlay muted playsInline className="h-full w-full object-cover" />
        ) : pic?.kind === 'still' && stills.has(pic.id) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/story/stills/${pic.id}.jpg`} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-start justify-center bg-gradient-to-b from-[#1b1440] via-[#0d0a22] to-black px-6 pt-24">
            {pic && (
              <p className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-4 text-xs leading-relaxed text-white/55">
                {pic.kind === 'still' ? `一枚絵（まだ描いていません）：${pic.desc}` : pic.kind === 'video' ? `動画 ${pic.id}` : `背景 ${pic.id}`}
              </p>
            )}
          </div>
        )}
      </div>
      {sprite && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sprite} alt="" className="pointer-events-none absolute bottom-[26%] left-1/2 z-[3] h-[46%] -translate-x-1/2 object-contain drop-shadow-[0_18px_40px_rgba(0,0,0,0.55)]" />
      )}

      <Line shown={shown} fill={fill} onTap={tap} onChoose={(o) => show(story.choose(st, o))} onAnswer={(k) => show(story.answer(st, k))} />

      {/* the read-through tools */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-gradient-to-b from-black/80 to-transparent px-3 pb-6 pt-[calc(8px+env(safe-area-inset-top))] text-xs">
        <Link href="/kakunin-5798f28713" className="rounded-full bg-black/50 px-3 py-1 text-white/80">←</Link>
        <button onClick={() => setPanel(panel === 'scenes' ? 'none' : 'scenes')} className="min-w-0 flex-1 truncate rounded-full bg-black/50 px-3 py-1 text-left text-amber-100">
          {scene ? `${scene.id}｜${scene.title}` : ''}
        </button>
        <button onClick={undo} disabled={!back.length} className="rounded-full bg-black/50 px-3 py-1 text-white/80 disabled:opacity-30">↶ 戻る</button>
        <button onClick={() => setPanel(panel === 'settings' ? 'none' : 'settings')} className="rounded-full bg-black/50 px-3 py-1 text-white/80">⚙</button>
      </div>
      {panel === 'scenes' && <ScenePicker story={story} current={st.scene} onPick={goScene} />}
      {panel === 'settings' && (
        <Settings
          vars={vars}
          opts={opts}
          onVars={(v) => (setVars(v), save(`${KEY}-vars`, v))}
          onOpts={(o) => (setOpts(o), save(`${KEY}-opts`, o))}
          chosen={st.chosen}
        />
      )}
    </div>
  );
}

function Line({ shown, fill, onTap, onChoose, onAnswer }: { shown: Shown; fill: (t: string) => string; onTap: () => void; onChoose: (o: { label: string; to: string | null }) => void; onAnswer: (k: string) => void }) {
  const box = 'relative mx-auto mb-6 w-full max-w-xl rounded-2xl border border-amber-200/35 bg-black/60 px-5 pb-6 pt-7 text-left backdrop-blur-md';
  const bottom = (inner: React.ReactNode, tap = true) =>
    tap ? (
      <button className="absolute inset-0 z-10 flex items-end justify-center" onClick={onTap}>
        <div className="pb-safe w-full bg-gradient-to-t from-black via-black/80 to-transparent px-4 pt-16">{inner}</div>
      </button>
    ) : (
      <div className="pb-safe absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/85 to-transparent px-4 pt-16">{inner}</div>
    );
  switch (shown.k) {
    case 'sceneStart':
      return (
        <button className="absolute inset-0 z-10 flex items-center justify-center" onClick={onTap}>
          <div className="rounded-3xl bg-black/60 px-6 py-4 text-center backdrop-blur">
            <p className="text-[10px] tracking-[0.3em] text-white/45">{shown.scene.id}</p>
            <p className="mt-1 text-base text-amber-100">{shown.scene.title}</p>
          </div>
        </button>
      );
    case 'say':
      return bottom(
        <div className={box}>
          <span className="absolute -top-3.5 left-5 rounded-full border border-amber-200/50 bg-black px-3 py-0.5 text-xs font-bold tracking-[0.2em] text-amber-200">{fill(shown.who)}</span>
          {shown.act && <p className="mb-1 text-[11px] text-white/45">（{fill(shown.act)}）</p>}
          <p className="whitespace-pre-wrap text-[17px] leading-relaxed">{fill(shown.text)}</p>
        </div>,
      );
    case 'narr':
      return bottom(
        <div className="mx-auto mb-10 max-w-xl rounded-2xl bg-black/55 px-5 py-3 text-center text-[15px] leading-relaxed text-amber-50 backdrop-blur-sm">{fill(shown.text)}</div>,
      );
    case 'card':
      return (
        <button className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 px-8" onClick={onTap}>
          <div className="w-full max-w-sm -rotate-1 whitespace-pre-wrap rounded-sm bg-[#f3e8d2] px-7 py-8 text-left text-base leading-loose text-[#3b2a17] shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
            <p className="mb-2 text-[10px] tracking-widest text-[#8a6a44]">{shown.kind}</p>
            {fill(shown.text)}
          </div>
        </button>
      );
    case 'dir':
      return bottom(<div className="mx-auto mb-10 max-w-xl rounded-2xl border border-dashed border-sky-300/40 bg-sky-950/50 px-4 py-3 text-xs italic leading-relaxed text-sky-100/80">演出：{fill(shown.text)}</div>);
    case 'still':
    case 'video':
      return bottom(<p className="mb-10 text-center text-xs text-white/40">{shown.k === 'still' ? (shown.arrival ? '到着の一枚絵' : '一枚絵') : `動画 ${shown.id}`}　▼</p>);
    case 'ui': {
      const label = { screen: '画面', make: '制作', input: '入力', button: 'ボタン', confirm: '確認画面', done: '完了画面' }[shown.kind];
      const inputs = shown.kind === 'input' ? shown.text.split(/[／/｜]/).map((s) => s.trim()).filter((s) => s.length <= 6) : [];
      return bottom(
        <div className={`${box} border-violet-300/40`}>
          <span className="absolute -top-3.5 left-5 rounded-full border border-violet-300/50 bg-black px-3 py-0.5 text-xs font-bold text-violet-200">{label}{shown.feature ? `：${shown.feature}` : ''}</span>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">{fill(shown.text)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(inputs.length ? inputs : [shown.kind === 'button' ? fill(shown.text) : '（ここで機能の画面）続ける']).map((x) => (
              <button key={x} onClick={() => (inputs.length ? onAnswer(x) : onTap())} className="rounded-full bg-violet-500/80 px-4 py-2 text-sm font-bold">
                {x}
              </button>
            ))}
          </div>
        </div>,
        false,
      );
    }
    case 'choice':
      return bottom(
        <div className="mx-auto mb-6 flex max-w-sm flex-col gap-3">
          {shown.options.map((o) => (
            <button key={o.label} onClick={() => onChoose(o)} className="rounded-full border border-amber-200/60 bg-black/60 px-5 py-3 text-[15px] text-amber-50 backdrop-blur">
              {fill(o.label)}
            </button>
          ))}
        </div>,
        false,
      );
    case 'stop':
      return bottom(<div className={box}>今日はここまで（次に開くと、ここから再開）　▼ 先へ</div>);
    case 'text':
      return bottom(<div className="mx-auto mb-10 max-w-xl rounded-2xl border border-rose-300/40 bg-rose-950/50 px-4 py-3 text-xs text-rose-100/80">（読み取れない行）{shown.text}</div>);
    case 'end':
      return <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-white/60">おわり</div>;
    default:
      return null;
  }
}

function ScenePicker({ story, current, onPick }: { story: Story; current: string; onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const list = story.list().filter((s) => !q || `${s.id}${s.title}`.includes(q));
  return (
    <div className="absolute inset-x-0 bottom-0 top-[calc(48px+env(safe-area-inset-top))] z-30 overflow-y-auto bg-black/90 px-4 pb-10 pt-3">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="場面ID・題名でさがす" className="mb-3 w-full rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm outline-none" />
      {list.map((s, k) => (
        <div key={s.id}>
          {(k === 0 || list[k - 1].part !== s.part) && <p className="mb-1 mt-4 text-[10px] tracking-widest text-white/40">{s.part}</p>}
          <button onClick={() => onPick(s.id)} className={`block w-full truncate rounded-xl px-3 py-2 text-left text-sm ${s.id === current ? 'bg-amber-300/20 text-amber-100' : 'text-white/80'}`}>
            <span className="mr-2 text-[11px] text-white/40">{s.id}</span>
            {s.title}
          </button>
        </div>
      ))}
    </div>
  );
}

function Settings({ vars, opts, onVars, onOpts, chosen }: { vars: Vars; opts: Options & { sound?: boolean }; onVars: (v: Vars) => void; onOpts: (o: Options & { sound?: boolean }) => void; chosen: string[] }) {
  const labels: Record<keyof Vars, string> = { name: '{name} 名前', inviter: '{inviter} 招待した人', neo: '{neo} ネオの名前', bati: '{bati} バティの名前', food: '{food} 好きな食べ物', age: '{age}' };
  const toggle = (s: string) => onOpts({ ...opts, states: opts.states.includes(s) ? opts.states.filter((x) => x !== s) : [...opts.states, s] });
  return (
    <div className="absolute inset-x-0 bottom-0 top-[calc(48px+env(safe-area-inset-top))] z-30 overflow-y-auto bg-black/90 px-5 pb-10 pt-4 text-sm">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={opts.notes} onChange={(e) => onOpts({ ...opts, notes: e.target.checked })} />
        演出メモ（〔…〕）も表示する
      </label>
      <label className="mt-3 flex items-center gap-2">
        <input type="checkbox" checked={opts.sound !== false} onChange={(e) => onOpts({ ...opts, sound: e.target.checked })} />
        声・効果音・BGM を鳴らす（作ったものだけ）
      </label>
      <p className="mb-2 mt-6 text-xs text-white/50">状態（（mana_low）などの行を出す）</p>
      <div className="flex flex-wrap gap-2">
        {['mana_ok', 'mana_low'].map((s) => (
          <button key={s} onClick={() => toggle(s)} className={`rounded-full px-3 py-1 text-xs ${opts.states.includes(s) ? 'bg-amber-300 text-black' : 'bg-white/10'}`}>
            {s}
          </button>
        ))}
      </div>
      <p className="mb-2 mt-6 text-xs text-white/50">差し込み文字</p>
      <div className="grid gap-2">
        {(Object.keys(labels) as (keyof Vars)[]).map((k) => (
          <label key={k} className="flex items-center gap-2">
            <span className="w-32 shrink-0 text-xs text-white/50">{labels[k]}</span>
            <input value={vars[k]} onChange={(e) => onVars({ ...vars, [k]: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1" />
          </label>
        ))}
      </div>
      <p className="mb-1 mt-6 text-xs text-white/50">ここまでに選んだ枝</p>
      <p className="text-xs text-white/60">{chosen.length ? chosen.join(' → ') : '（まだなし）'}</p>
    </div>
  );
}
