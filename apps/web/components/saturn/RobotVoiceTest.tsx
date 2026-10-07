'use client';

import { useEffect, useState } from 'react';
import { spriteUrl } from '@/lib/onboarding/media';
import { decodeVoice, playRobot, ROBOT_LEVELS, stopRobot, unlockRobot, type RobotLevel } from '@/lib/robotVoice';
import { useRecorder } from '@/lib/useRecorder';

/**
 * Robot voice test (client idea 2026-10-07): KIMORIN asks you to prove you are human, you say
 * the line into the mic … and it plays back as a robot. Here: record once, then compare as is /
 * ちょいロボ / ロボ / がっつりロボ.
 */
const LINE = '俺は人間だ。信じてくれ。本当に人間なんだ。';

export function RobotVoiceTest() {
  const rec = useRecorder(15);
  const [buf, setBuf] = useState<AudioBuffer | null>(null);
  const [playing, setPlaying] = useState<RobotLevel | 'raw' | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    setBuf(null);
    if (!rec.blob) return;
    decodeVoice(rec.blob)
      .then(setBuf)
      .catch(() => setErr('録音を読みこめなかった…もう一度ためしてね'));
  }, [rec.blob]);

  useEffect(() => () => stopRobot(), []);

  const play = async (level: RobotLevel | null) => {
    if (!buf) return;
    unlockRobot();
    setPlaying(level ?? 'raw');
    await playRobot(buf, level);
    setPlaying((cur) => (cur === (level ?? 'raw') ? null : cur));
  };

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto bg-gradient-to-b from-[#2f2268] via-[#6d48b0] to-[#e6a3cf] px-5 pb-10 pt-16 text-[#3d2a5c]" style={{ fontFamily: '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Hiragino Sans", system-ui, sans-serif' }}>
      <div className="flex w-full max-w-md items-end gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={spriteUrl('kimorin-3')} alt="" className="h-28 w-auto shrink-0 drop-shadow-xl" />
        <div className="mb-2 flex-1 rounded-2xl bg-white/95 p-3 shadow-xl">
          <p className="text-[11px] font-black text-violet-500">KIMORIN</p>
          <p className="mt-0.5 whitespace-pre-wrap text-[15px] font-bold leading-snug">
            お前、さては…ロボットじゃないだろうな？{'\n'}ちゃんと人間か、確かめる必要があるケン。{'\n'}マイクに向かって、こう言え！
          </p>
        </div>
      </div>
      <p className="mt-4 w-full max-w-md rounded-2xl bg-white/90 px-4 py-3 text-center text-lg font-black text-[#5a3f8a] shadow">「{LINE}」</p>

      <button
        onClick={() => {
          unlockRobot();
          stopRobot();
          if (rec.recording) rec.stop();
          else void rec.start();
        }}
        className={`mt-6 flex h-28 w-28 flex-col items-center justify-center rounded-full text-white shadow-[0_6px_0_rgba(120,60,170,.4)] ${rec.recording ? 'animate-pulse bg-gradient-to-br from-rose-400 to-pink-500' : 'bg-gradient-to-br from-[#f39bd0] to-[#b58cff]'}`}
      >
        <span className="text-4xl">{rec.recording ? '■' : '🎙'}</span>
        <span className="mt-1 text-xs font-black">{rec.recording ? `${rec.elapsed}秒・とめる` : buf ? 'とりなおす' : '録音する'}</span>
      </button>
      {rec.error && <p className="mt-2 text-xs font-bold text-rose-100">マイクが使えなかった…（設定でマイクを許可してね）</p>}
      {err && <p className="mt-2 text-xs font-bold text-rose-100">{err}</p>}

      {buf && (
        <div className="mt-6 w-full max-w-md rounded-3xl bg-white/95 p-4 shadow-xl">
          <p className="text-center text-xs font-black text-[#8a76bd]">聞きくらべてみてね（{buf.duration.toFixed(1)}秒）</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => void play(null)} className={`rounded-2xl py-3 text-sm font-black ${playing === 'raw' ? 'bg-violet-500 text-white' : 'bg-violet-50 text-[#5a3f8a]'}`}>
              🙂 そのまま
            </button>
            {ROBOT_LEVELS.map((l) => (
              <button key={l.id} onClick={() => void play(l.id)} className={`rounded-2xl py-3 text-sm font-black ${playing === l.id ? 'bg-violet-500 text-white' : 'bg-violet-50 text-[#5a3f8a]'}`}>
                🤖 {l.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] text-slate-400">チュートリアルでは、このどれかで再生して「怪しいなあ…」につなげる予定</p>
        </div>
      )}
    </div>
  );
}
