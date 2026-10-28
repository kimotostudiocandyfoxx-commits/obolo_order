'use client';

import { useEffect, useRef, useState } from 'react';
import { KororinParty, KororinPartySky, type KororinPartyHandle } from '@/components/saturn/KororinParty';
import { audioCtx, masterBus } from '@/lib/onboarding/audio';
import { spriteUrl } from '@/lib/onboarding/media';
import { singUrl } from '@/lib/saturn/sing';
import { lineVoiceUrl } from '@/lib/story/lineVoice';

/**
 * L2-SATURN-S004 「……全員、私です。」 (M-R153): KIMORIN⭐︎ lays three of his kororins on the mat and presses
 * 〔▶ リレー〕. The sky dims, the ring lights up; one by one their glasses drop and they sing on the same beat, in
 * his voice; on the last 「♪オー！」 the three voices stack (the same note). The kororins are his own story lines,
 * sung on the phone (lib/saturn/sing). 〔スキップ〕 at the corner; it ends by itself.
 */
const LINES = ['それなら、私にも、できます。', '……問いかけの広場です。哲学ですので、わざとです。', '変えません。'];
/** his day-3 lines on Saturn, already voiced: used while a line above has no voice yet */
const FALLBACK = ['本当になんでもいいんですか？', 'なんですかこのかわいいたこ焼きは！', '楽しいですね。'];

export function KororinRelay({ muted = false, onDone }: { muted?: boolean; onDone: (a: Record<string, string>) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'ready' | 'loading' | 'sing'>('ready');
  const [singer, setSinger] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  const party = useRef<KororinPartyHandle>(null);
  const spots = useRef<(HTMLDivElement | null)[]>([]);
  const stopped = useRef(false);
  const nodes = useRef<AudioBufferSourceNode[]>([]);
  const done = () => {
    if (stopped.current) return;
    stopped.current = true;
    nodes.current.forEach((n) => {
      try {
        n.stop();
      } catch {
        /* not started */
      }
    });
    onDone({ relay: 'heard' });
  };
  useEffect(() => () => void (stopped.current = true), []);
  // the party kit follows whoever sings
  useEffect(() => {
    const el = singer === null ? null : spots.current[singer];
    if (!el) return party.current?.place(undefined);
    const r = el.getBoundingClientRect();
    const o = root.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    party.current?.place({ x: r.left - o.left + r.width / 2, y: r.top - o.top + r.height / 2, R: r.width / 2 });
  }, [singer]);

  const play = async () => {
    setPhase('loading');
    const c = audioCtx();
    const urls = await Promise.all(LINES.map(async (t, k) => (await lineVoiceUrl('KIMORIN', t)) ?? (await lineVoiceUrl('KIMORIN', FALLBACK[k]))));
    const sung = await Promise.all(urls.map((u, k) => (u ? singUrl(u, LINES[k]) : Promise.resolve(null))));
    const ohs = await Promise.all(urls.map((u) => (u ? singUrl(u, '', true) : Promise.resolve(null))));
    if (stopped.current) return;
    setPhase('sing');
    if (!c || sung.some((u) => !u)) {
      // no sound: the relay still goes round on the clock
      for (let k = 0; k < 3 && !stopped.current; k++) {
        setSinger(k);
        await new Promise((r) => setTimeout(r, 2200));
      }
      setSinger(null);
      setAll(true);
      await new Promise((r) => setTimeout(r, 1800));
      return done();
    }
    const gain = c.createGain();
    gain.gain.value = muted ? 0 : 1;
    gain.connect(masterBus(c));
    const decode = async (u: string) => c.decodeAudioData(await (await fetch(u)).arrayBuffer());
    const bufs = await Promise.all(sung.map((u) => decode(u!)));
    const ohBufs = (await Promise.all(ohs.map((u) => (u ? decode(u) : null)))).filter((b): b is AudioBuffer => !!b);
    // one after another on the beat: each song's tail (its echo) overlaps the next one's lead-in a little
    let at = c.currentTime + 0.1;
    const starts: number[] = [];
    for (const b of bufs) {
      const n = c.createBufferSource();
      n.buffer = b;
      n.connect(gain);
      n.start(at);
      nodes.current.push(n);
      starts.push(at);
      at += b.duration - 0.9;
    }
    for (const b of ohBufs) {
      const n = c.createBufferSource();
      n.buffer = b;
      n.connect(gain);
      n.start(at);
      nodes.current.push(n);
    }
    const end = at + Math.max(2, ...ohBufs.map((b) => b.duration));
    const tick = () => {
      if (stopped.current) return;
      const t = c.currentTime;
      if (t >= end) return done();
      if (t >= at) {
        setSinger(null);
        setAll(true);
      } else setSinger(starts.reduce((k, s, j) => (t >= s ? j : k), 0));
      setTimeout(tick, 120);
    };
    tick();
  };

  const on = phase === 'sing';
  return (
    <div ref={root} className="absolute inset-0 z-[14] overflow-hidden bg-gradient-to-b from-[#b9a2ff] via-[#e8b6e6] to-[#ffd2c4]">
      <KororinPartySky on={on} />
      {/* the mat with KIMORIN⭐︎'s three kororins */}
      <div className="absolute inset-x-6 bottom-[22%] h-24 rounded-[40%] bg-[#d9b779] shadow-[inset_0_-6px_0_rgba(120,80,30,.35)]" />
      <div className="absolute inset-x-0 bottom-[25%] flex justify-center gap-5">
        {[0, 1, 2].map((k) => (
          <div
            key={k}
            ref={(el) => {
              spots.current[k] = el;
            }}
            className="relative h-24 w-24 transition-transform duration-300"
            style={{ transform: singer === k || all ? 'translateY(-10px) scale(1.06)' : 'none', animation: singer === k || all ? 'relayBob 0.476s ease-in-out infinite alternate' : undefined }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={spriteUrl('kimorin-face')} alt="" className="h-full w-full rounded-full bg-[#e8a35c] object-cover ring-4 ring-white/70" />
            {all && (
              <svg viewBox="0 0 100 40" className="absolute left-[18%] top-[30%] w-[64%]">
                <circle cx="27" cy="20" r="16" fill="#151020" stroke="#ffd36f" strokeWidth="3" />
                <circle cx="73" cy="20" r="16" fill="#151020" stroke="#ffd36f" strokeWidth="3" />
                <path d="M43 18 Q50 13 57 18" fill="none" stroke="#ffd36f" strokeWidth="3" />
              </svg>
            )}
          </div>
        ))}
      </div>
      <KororinParty ref={party} on={singer !== null} />
      {all && <p className="absolute inset-x-0 top-[24%] animate-[fadeUp_0.5s_ease-out] text-center text-4xl font-black text-white drop-shadow-[0_2px_8px_rgba(120,40,160,.6)]">♪オー！</p>}
      {phase !== 'sing' && (
        <div className="pb-safe absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-8">
          <button onClick={() => void play()} disabled={phase === 'loading'} className="rounded-full border-4 border-white bg-gradient-to-b from-pink-400 to-violet-500 px-8 py-3 text-lg font-black text-white shadow-lg disabled:opacity-60">
            {phase === 'loading' ? '……' : '▶ リレー'}
          </button>
        </div>
      )}
      <button onClick={done} className="absolute bottom-[calc(24px+env(safe-area-inset-bottom))] right-4 z-[70] rounded-full border border-white/40 px-4 py-1.5 text-xs tracking-widest text-white/80">
        スキップ
      </button>
      <style>{'@keyframes relayBob{from{translate:0 0}to{translate:0 -6px}}'}</style>
    </div>
  );
}
