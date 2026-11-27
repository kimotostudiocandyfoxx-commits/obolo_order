'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PERMISSION_WORDS, allowSteps, checkVerdict, envLabel, faultOfError, voiceGate, type CheckResult, type MicAdvice, type MicEnv, type MicFault, type MicPermission } from '@/lib/mic/core';
import { MIC_CHECK_EVENT, currentEngine, currentEnv, openMicCheck, reportMic } from '@/lib/mic/env';
import { micMeter } from '@/lib/mic/meter';
import { closeMic, openMic, quietMic } from '@/lib/micStream';

/**
 * 〔マイクをためす〕 (client 2026-11-27: 「設定を見ても、何を変えたらいいのか分からない」): one small sheet that says, in words,
 * whether the mic works on this phone — the browser, the permission, a live loudness bar while you speak, and the
 * result (「聞こえているよ」 or what to change, step by step). Opened from the settings (/settings, the Moon's settings)
 * and from every mic notice (MicNotice below). It lives once in the layout and listens for MIC_CHECK_EVENT.
 * Nothing is recorded or sent: the sound is only measured. PROVISIONAL wording (lib/mic/core).
 */
const LISTEN_MS = 5000;

function MicGlyph({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current`} strokeWidth={1.8} strokeLinecap="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  );
}

async function permissionNow(): Promise<MicPermission> {
  try {
    const p = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return p.state === 'granted' || p.state === 'denied' || p.state === 'prompt' ? p.state : 'unknown';
  } catch {
    return 'unknown';
  }
}

export function MicCheck() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener(MIC_CHECK_EVENT, on);
    return () => window.removeEventListener(MIC_CHECK_EVENT, on);
  }, []);
  if (!open) return null;
  return <Sheet onClose={() => setOpen(false)} />;
}

function Sheet({ onClose }: { onClose: () => void }) {
  const [env] = useState<MicEnv>(() => currentEnv());
  const [engine] = useState(() => currentEngine());
  const [perm, setPerm] = useState<MicPermission>('unknown');
  const [state, setState] = useState<'idle' | 'opening' | 'listening' | 'done'>('idle');
  const [level, setLevel] = useState(0);
  const [left, setLeft] = useState(0);
  const [result, setResult] = useState<(CheckResult & { fault: MicFault | null }) | null>(null);
  const stopRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    void permissionNow().then(setPerm);
    return () => stopRef.current();
  }, []);

  const run = useCallback(() => {
    if (state === 'opening' || state === 'listening') return;
    setResult(null);
    setLevel(0);
    setState('opening');
    let over = false;
    const finish = (fault: MicFault | null, peak: number, spoke: boolean, name?: string) => {
      if (over) return;
      over = true;
      const v = checkVerdict({ fault, peak, spoke }, env);
      if (fault) reportMic({ path: 'check', fault, engine: 'stream', name });
      else if (!v.ok) reportMic({ path: 'check', fault: 'silent', engine: 'stream', name: 'zero-level' });
      setResult({ ...v, fault });
      setState('done');
      setLevel(0);
      void permissionNow().then(setPerm);
    };
    // asked for at once, inside the tap
    openMic().then(
      (stream) => {
        if (over) return quietMic();
        const meter = micMeter(stream);
        const gate = voiceGate();
        const t0 = Date.now();
        setState('listening');
        setLeft(Math.ceil(LISTEN_MS / 1000));
        let fed = 0;
        const end = () => {
          clearInterval(tick);
          meter?.close();
          quietMic();
          // the check lets the mic go at once (the orange dot goes out)
          closeMic();
          stopRef.current = () => undefined;
        };
        const tick = setInterval(() => {
          const now = Date.now();
          if (meter?.live()) {
            const lv = meter.level();
            fed++;
            gate.feed(lv, now);
            setLevel(lv);
          }
          setLeft(Math.max(0, Math.ceil((LISTEN_MS - (now - t0)) / 1000)));
          // a voice heard and a moment more: enough
          const enough = gate.spoke && now - t0 > 1800;
          if (now - t0 >= LISTEN_MS || enough) {
            end();
            // no meter (no Web Audio): the mic opened, the loudness is unknown — said as "it works"
            finish(null, fed > 5 ? gate.peak : 1, fed > 5 ? gate.spoke : true);
          }
        }, 60);
        stopRef.current = () => {
          over = true;
          end();
        };
        for (const tr of stream.getAudioTracks())
          tr.addEventListener(
            'ended',
            () => {
              end();
              finish('busy', 0, false, 'track-ended');
            },
            { once: true },
          );
      },
      (e) => finish(faultOfError(e), 0, false, (e as Error)?.name),
    );
  }, [env, state]);

  const busy = state === 'opening' || state === 'listening';
  const steps = result?.fault === 'denied' || (!result && perm === 'denied') ? allowSteps(env) : env.inApp && result && !result.ok ? allowSteps(env) : null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/65" onClick={onClose} data-testid="mic-check">
      <div className="max-h-[92svh] w-full max-w-md overflow-y-auto rounded-t-[26px] border border-white/10 bg-[#0d1030] px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-5 text-[#f4f1ff]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[17px] font-black">マイクをためす</h3>
          <button type="button" onClick={onClose} className="rounded-full border border-white/20 px-3 py-1.5 text-[12px] text-white/75">
            とじる
          </button>
        </div>
        <dl className="mt-3 space-y-1.5 text-[12.5px] leading-relaxed">
          <div className="flex gap-2">
            <dt className="w-[92px] shrink-0 text-white/50">いまのブラウザ</dt>
            <dd data-testid="mic-check-env">{envLabel(env)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-[92px] shrink-0 text-white/50">マイクの許可</dt>
            <dd data-testid="mic-check-perm" className={perm === 'denied' ? 'text-rose-200' : undefined}>
              {PERMISSION_WORDS[perm]}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-[92px] shrink-0 text-white/50">声の聞き取り</dt>
            <dd data-testid="mic-check-engine">{engine === 'speech' ? 'ブラウザが、そのまま聞き取るよ' : engine === 'record' ? '録音してから、文字にするよ（話し終わって少し待ってね）' : 'このブラウザでは使えないよ'}</dd>
          </div>
        </dl>

        {/* the loudness now: it moves when a voice comes in */}
        <div className="mt-4 rounded-2xl bg-white/5 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${state === 'listening' ? 'bg-rose-300/25 text-rose-100' : 'bg-white/10 text-white/70'}`} style={{ transform: `scale(${1 + Math.min(0.35, level * 0.5)})`, transition: 'transform 80ms linear' }}>
              <MicGlyph className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="h-3 overflow-hidden rounded-full bg-white/10" role="meter" aria-label="マイクの音の大きさ" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)} data-testid="mic-check-level">
                <div className="h-full rounded-full bg-gradient-to-r from-sky-300 to-emerald-300" style={{ width: `${Math.round(Math.min(1, level * 1.6) * 100)}%`, transition: 'width 80ms linear' }} />
              </div>
              <p className="mt-2 text-[12.5px] text-white/75" data-testid="mic-check-state">
                {state === 'opening' ? 'マイクをひらいているよ…（聞かれたら「許可」をえらんでね）' : state === 'listening' ? `「あー」と、声を出してみてね（あと${left}秒）` : state === 'done' ? 'おわったよ' : '下のボタンを押して、声を出してみてね'}
              </p>
            </div>
          </div>
        </div>

        {result && (
          <div className={`mt-3 rounded-2xl border px-4 py-3 ${result.ok ? 'border-emerald-300/40 bg-emerald-300/10' : 'border-rose-300/40 bg-rose-300/10'}`} data-testid="mic-check-result" data-ok={result.ok ? '1' : '0'}>
            <p className="text-[15px] font-black">{result.title}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-white/85">{result.text}</p>
          </div>
        )}
        {steps && (
          <ol className="mt-3 list-decimal space-y-1 rounded-2xl bg-white/5 py-3 pl-8 pr-4 text-[12.5px] leading-relaxed text-white/85" data-testid="mic-check-steps">
            {steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        )}

        <button type="button" onClick={run} disabled={busy} data-testid="mic-check-run" className="mt-4 w-full rounded-full bg-[#dfe6ff] py-3 text-[15px] font-black text-[#070b24] disabled:opacity-50">
          {busy ? 'ためしているよ…' : result ? 'もう一度ためす' : 'ためす'}
        </button>
        <p className="mt-2 text-center text-[11px] text-white/45">ためすだけで、声は録音も保存もしないよ</p>
      </div>
    </div>
  );
}

/**
 * The one line under a mic that could not hear, with 〔マイクをためす〕 beside it when checking helps. `tone`: the talk's
 * pale blue, the story's amber, or rose on the ダチ bar.
 */
export function MicNotice({ advice, className = '', linkClass = 'underline underline-offset-2' }: { advice: MicAdvice | null; className?: string; linkClass?: string }) {
  if (!advice) return null;
  return (
    <p className={className} data-testid="mic-notice" role="status">
      {advice.text}
      {advice.action === 'check' && (
        <>
          {' '}
          <button type="button" onClick={openMicCheck} className={linkClass} data-testid="mic-notice-check">
            マイクをためす
          </button>
        </>
      )}
    </p>
  );
}

/** the settings' row: 〔マイクをためす〕 */
export function MicCheckRow({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-white/50">マイクが反応しないときは、ここでたしかめられます</p>
      <button type="button" onClick={openMicCheck} data-testid="open-mic-check" className="shrink-0 rounded-full border border-sky-200/50 px-3 py-1.5 text-[12px] text-sky-100">
        マイクをためす
      </button>
    </div>
  );
}
