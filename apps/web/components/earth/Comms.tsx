'use client';

import { neoForm, type CallJoin, type CallView, type CommsContact, type CommsFound, type CommsPerson, type CommsStatus, type DmMessage } from '@obolo/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Mic } from '@/components/mercury/ComposeChat';
import { ApiError, getApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { connectAudio, type CallAudio } from '@/lib/comms/call';
import { watchConversation } from '@/lib/comms/mail';

/**
 * Earth mail & phone (client decision 2026-10-08): they open for each member after the ¥88
 * ORDER, between ダチ only (people who follow each other). Mail arrives in real time through
 * Firebase (or by checking every few seconds until it is set up); calls carry their audio through
 * Agora (or ring and connect in demo mode). No counts anywhere: unread is a dot.
 */
export function CommsTiles() {
  const [status, setStatus] = useState<CommsStatus | null>(null);
  const [open, setOpen] = useState<'mail' | 'phone' | null>(null);
  const [call, setCall] = useState<{ view: CallView; join?: CallJoin } | null>(null);
  const [anyUnread, setAnyUnread] = useState(false);

  useEffect(() => {
    getApi()
      .commsStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);
  useEffect(() => {
    if (!status?.open) return;
    getApi()
      .commsContacts()
      .then((c) => setAnyUnread(c.some((x) => x.unread)))
      .catch(() => undefined);
  }, [status, open]);

  const locked = !status?.open;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Tile icon="✉️" title="メール" hint="ダチとメッセージ（声でも送れる）" locked={locked} dot={anyUnread} onClick={() => setOpen('mail')} />
        <Tile icon="📞" title="電話" hint="ダチと声で話す" locked={locked} onClick={() => setOpen('phone')} />
      </div>
      {status?.open && open === 'mail' && <MailScreen status={status} onClose={() => setOpen(null)} />}
      {status?.open && open === 'phone' && (
        <PhoneScreen
          onClose={() => setOpen(null)}
          onCall={async (to) => {
            const r = await getApi().startCall(to.id);
            setCall({ view: r.call, join: r.join });
          }}
        />
      )}
      {status?.open && !call && <IncomingCall onAnswer={(view, join) => setCall({ view, join })} />}
      {call && <CallScreen initial={call.view} join={call.join} demo={status?.call !== 'agora'} onClose={() => setCall(null)} />}
    </>
  );
}

function Tile({ icon, title, hint, locked, dot, onClick }: { icon: string; title: string; hint: string; locked: boolean; dot?: boolean; onClick: () => void }) {
  return (
    <button onClick={locked ? undefined : onClick} className={`card relative p-4 text-left ${locked ? 'opacity-70' : 'hover:bg-white/10'}`} aria-disabled={locked}>
      {dot && <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(255,120,150,0.9)]" aria-label="未読あり" />}
      <div className="text-2xl">{icon}</div>
      <div className="mt-1 text-sm font-bold">{title}</div>
      <p className="mt-1 text-[11px] leading-snug text-white/55">{hint}</p>
      {locked && <span className="chip mt-2 bg-white/10 text-white/60">🔒 ORDERに入るとひらきます</span>}
    </button>
  );
}

function Face({ p, size = 40 }: { p: CommsPerson; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-[#1b1f3a]" style={{ width: size, height: size, fontSize: size * 0.5 }}>
      {p.pic ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.pic} alt="" className="h-full w-full object-cover" />
      ) : (
        (neoForm(p.neoForm)?.emoji ?? '🙂')
      )}
    </span>
  );
}
const nameOf = (p: CommsPerson) => p.displayName || p.handle;

/** Full-screen layers go straight into <body>, above the planet header. */
function Layer({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready ? createPortal(children, document.body) : null;
}

function Overlay({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <Layer>
      <div className="fixed inset-0 z-[120] flex flex-col bg-[#0b1530] backdrop-blur">
        <div className="pt-safe flex items-center gap-2 border-b border-white/10 px-3 py-3">
          <button onClick={onBack} className="btn btn-ghost h-9 w-9 !p-0 text-lg" aria-label="もどる">
            ←
          </button>
          <p className="min-w-0 flex-1 truncate font-bold">{title}</p>
        </div>
        {children}
      </div>
    </Layer>
  );
}

function useContacts() {
  const [list, setList] = useState<CommsContact[] | null>(null);
  const [key, setKey] = useState(0);
  useEffect(() => {
    getApi()
      .commsContacts()
      .then(setList)
      .catch(() => setList([]));
  }, [key]);
  return [list, () => setKey((k) => k + 1)] as const;
}

/**
 * ＋ ダチをさがす: find someone by their user ID and follow them; when they follow you back you
 * are ダチ and can write / call. Your own ID is shown so you can tell your friend.
 */
function FindFriend({ onChange }: { onChange: () => void }) {
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<CommsFound | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const search = async () => {
    if (!q.trim()) return;
    setBusy(true);
    try {
      setFound((await getApi().findPerson(q.trim())).person);
    } catch {
      setFound(null);
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (f: CommsFound) => {
    setBusy(true);
    try {
      const r = await getApi().followPerson(f.id, !f.followedByMe);
      setFound(r);
      onChange();
    } finally {
      setBusy(false);
    }
  };
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="mb-2 w-full rounded-2xl border-2 border-dashed border-white/20 py-2.5 text-sm font-bold text-white/80">
        ＋ ダチをさがす（ユーザーIDで）
      </button>
    );
  return (
    <div className="mb-3 rounded-2xl border border-white/15 bg-white/5 p-3">
      {me && (
        <p className="mb-2 text-center text-xs text-white/60">
          あなたのID：<b className="select-all text-white">@{me.handle}</b>（相手に教えてね）
        </p>
      )}
      <div className="flex items-center gap-2">
        <span className="text-white/50">@</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value.slice(0, 40))}
          onKeyDown={(e) => e.key === 'Enter' && void search()}
          placeholder="相手のユーザーID"
          autoCapitalize="none"
          autoCorrect="off"
          className="h-11 min-w-0 flex-1 rounded-full bg-white/10 px-4 text-[16px] outline-none"
        />
        <button onClick={() => void search()} disabled={!q.trim() || busy} className="h-11 rounded-full bg-white/15 px-4 text-sm font-bold disabled:opacity-40">
          さがす
        </button>
      </div>
      {found === null && <p className="mt-3 text-center text-xs text-white/55">そのIDの人は見つかりませんでした</p>}
      {found && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-black/25 p-2">
          <Face p={found} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{nameOf(found)}</p>
            <p className="truncate text-[11px] text-white/55">
              {found.followedByMe && found.followsMe
                ? '🤝 ダチです。メールと電話ができます'
                : found.followedByMe
                  ? '相手がフォローしかえすとダチになります'
                  : found.followsMe
                    ? 'あなたをフォローしています。フォローするとダチ！'
                    : `@${found.handle}`}
            </p>
          </div>
          <button
            onClick={() => void toggle(found)}
            disabled={busy}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold disabled:opacity-50 ${found.followedByMe ? 'border border-white/30' : 'bg-violet-600'}`}
          >
            {found.followedByMe ? 'フォロー中' : 'フォローする'}
          </button>
        </div>
      )}
    </div>
  );
}

const NO_FRIENDS = 'まだダチがいません。上の「＋ ダチをさがす」で相手のユーザーIDをさがしてフォローし、相手もフォローしかえすとダチになります。メールと電話はダチとだけできます。';

function MailScreen({ status, onClose }: { status: CommsStatus; onClose: () => void }) {
  const [contacts, reload] = useContacts();
  const [peer, setPeer] = useState<CommsContact | null>(null);
  if (peer) return <Conversation status={status} peer={peer} onBack={() => setPeer(null)} />;
  return (
    <Overlay title="✉️ メール" onBack={onClose}>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <FindFriend onChange={reload} />
        {contacts === null && <p className="py-10 text-center text-sm text-white/50">ひらいています…</p>}
        {contacts?.length === 0 && <p className="px-4 py-10 text-center text-sm leading-relaxed text-white/60">{NO_FRIENDS}</p>}
        {contacts?.map((c) => (
          <button key={c.id} onClick={() => setPeer(c)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-white/5">
            <Face p={c} size={46} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{nameOf(c)}</p>
              <p className="truncate text-xs text-white/55">{c.lastText ?? 'メッセージを送ってみよう'}</p>
            </div>
            {c.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-400" aria-label="未読" />}
          </button>
        ))}
      </div>
    </Overlay>
  );
}

function Conversation({ status, peer, onBack }: { status: CommsStatus; peer: CommsContact; onBack: () => void }) {
  const { me } = useAuth();
  const [msgs, setMsgs] = useState<DmMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!me) return;
    const stop = watchConversation(status, me.id, peer.id, (added) => {
      setMsgs((cur) => {
        const seen = new Set(cur.map((m) => m.id));
        return [...cur, ...added.filter((m) => !seen.has(m.id))];
      });
      void getApi()
        .readDm(peer.id)
        .catch(() => undefined);
    });
    return stop;
  }, [status, me, peer.id]);
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs]);

  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setErr('');
    try {
      const m = await getApi().sendDm(peer.id, { text: t });
      setText('');
      setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'MODERATION' ? 'その言葉は送れないよ' : e instanceof ApiError && e.code === 'NOT_FRIENDS' ? 'ダチにだけ送れます' : '送れなかった…もう一度');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay title={nameOf(peer)} onBack={onBack}>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {!msgs.length && <p className="py-10 text-center text-sm text-white/50">{nameOf(peer)} にメッセージを送ってみよう</p>}
        {msgs.map((m) =>
          m.fromMe ? (
            <p key={m.id} className="ml-auto w-fit max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-gradient-to-r from-sky-600 to-violet-600 px-3 py-2 text-sm">
              {m.text || '🎤 ボイス'}
            </p>
          ) : (
            <div key={m.id} className="flex items-end gap-2">
              <Face p={peer} size={30} />
              <p className="max-w-[78%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-white/10 px-3 py-2 text-sm">{m.text || '🎤 ボイス'}</p>
            </div>
          ),
        )}
        <div ref={end} />
      </div>
      {err && <p className="px-4 text-center text-xs text-rose-300">{err}</p>}
      <div className="pb-safe flex items-center gap-2 border-t border-white/10 p-3">
        <Mic value={text} onChange={(v) => setText(v.slice(0, 500))} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 500))}
          onKeyDown={(e) => e.key === 'Enter' && void send()}
          placeholder="メッセージ"
          className="h-11 min-w-0 flex-1 rounded-full bg-white/10 px-4 text-[16px] outline-none"
        />
        <button onClick={() => void send()} disabled={!text.trim() || busy} className="h-11 rounded-full bg-gradient-to-r from-sky-500 to-violet-600 px-4 text-sm font-bold disabled:opacity-40">
          送る
        </button>
      </div>
    </Overlay>
  );
}

function PhoneScreen({ onClose, onCall }: { onClose: () => void; onCall: (to: CommsContact) => Promise<void> }) {
  const [contacts, reload] = useContacts();
  const [err, setErr] = useState('');
  return (
    <Overlay title="📞 電話" onBack={onClose}>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <FindFriend onChange={reload} />
        {contacts === null && <p className="py-10 text-center text-sm text-white/50">ひらいています…</p>}
        {contacts?.length === 0 && <p className="px-4 py-10 text-center text-sm leading-relaxed text-white/60">{NO_FRIENDS}</p>}
        {err && <p className="pb-2 text-center text-xs text-rose-300">{err}</p>}
        {contacts?.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-2xl px-2 py-2.5">
            <Face p={c} size={46} />
            <p className="min-w-0 flex-1 truncate font-bold">{nameOf(c)}</p>
            <button
              onClick={() => {
                setErr('');
                onCall(c).catch((e) => setErr(e instanceof ApiError && e.code === 'PEER_NOT_MEMBER' ? 'まだORDERに入っていない人には電話できません' : 'かけられなかった…もう一度'));
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-xl shadow-[0_0_14px_rgba(60,220,140,0.5)]"
              aria-label={`${nameOf(c)}に電話する`}
            >
              📞
            </button>
          </div>
        ))}
      </div>
    </Overlay>
  );
}

/** Rings while someone is calling you (the Earth page checks every few seconds). */
function IncomingCall({ onAnswer }: { onAnswer: (view: CallView, join: CallJoin) => void }) {
  const [ringing, setRinging] = useState<CallView | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = () =>
      getApi()
        .incomingCalls()
        .then((list) => alive && setRinging(list[0] ?? null))
        .catch(() => undefined);
    void tick();
    const id = setInterval(tick, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  if (!ringing) return null;
  return (
    <Layer>
      <div className="fixed inset-x-3 top-[calc(12px+env(safe-area-inset-top))] z-[130] mx-auto flex max-w-md items-center gap-3 rounded-3xl border border-emerald-300/40 bg-[#0d2a24]/95 p-3 shadow-2xl backdrop-blur">
        <span className="animate-pulse">
          <Face p={ringing.caller} size={48} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{nameOf(ringing.caller)}</p>
          <p className="text-xs text-emerald-200">📞 電話がかかってきています</p>
        </div>
        <button
          onClick={() => {
            const r = ringing;
            setRinging(null);
            void getApi()
              .declineCall(r.id)
              .catch(() => undefined);
          }}
          className="h-11 rounded-full bg-rose-500 px-3 text-sm font-bold"
        >
          出ない
        </button>
        <button
          onClick={() => {
            const r = ringing;
            setRinging(null);
            getApi()
              .answerCall(r.id)
              .then((a) => onAnswer(a.call, a.join))
              .catch(() => undefined);
          }}
          className="h-11 rounded-full bg-emerald-500 px-3 text-sm font-bold"
        >
          出る
        </button>
      </div>
    </Layer>
  );
}

const STATUS_TEXT: Record<CallView['status'], string> = {
  ringing: '呼び出し中…',
  active: '通話中',
  declined: '出られないみたい',
  missed: '応答がありませんでした',
  ended: '通話を終えました',
};

function CallScreen({ initial, join, demo, onClose }: { initial: CallView; join?: CallJoin; demo: boolean; onClose: () => void }) {
  const { me } = useAuth();
  const [view, setView] = useState(initial);
  const [secs, setSecs] = useState(0);
  const [muted, setMuted] = useState(false);
  const [audioErr, setAudioErr] = useState('');
  const audio = useRef<CallAudio | null>(null);
  const other = view.caller.id === me?.id ? view.callee : view.caller;
  const done = view.status === 'declined' || view.status === 'missed' || view.status === 'ended';

  // follow the call: answered, declined, hung up on the other side
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => {
      getApi()
        .getCall(view.id)
        .then(setView)
        .catch(() => undefined);
    }, 2000);
    return () => clearInterval(id);
  }, [view.id, done]);

  // the audio: joins once the call is answered, leaves when it ends
  useEffect(() => {
    if (view.status !== 'active' || !join || audio.current) return;
    connectAudio(join, () => setView((v) => ({ ...v, status: 'ended' })))
      .then((a) => (audio.current = a))
      .catch(() => setAudioErr('マイクにつながりませんでした（マイクの許可を確かめてね）'));
  }, [view.status, join]);
  useEffect(() => {
    if (!done) return;
    void audio.current?.leave();
    audio.current = null;
  }, [done]);
  useEffect(() => () => void audio.current?.leave(), []);

  useEffect(() => {
    if (view.status !== 'active') return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [view.status]);

  const hangUp = () => {
    if (!done)
      void getApi()
        .endCall(view.id)
        .then(setView)
        .catch(() => undefined);
    onClose();
  };

  return (
    <Layer>
      <div className="fixed inset-0 z-[140] flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-[#0d2a3a] to-[#06101e] px-6 text-center">
        <span className={view.status === 'ringing' ? 'animate-pulse' : ''}>
          <Face p={other} size={120} />
        </span>
        <div>
          <p className="text-2xl font-black">{nameOf(other)}</p>
          <p className="mt-1 text-sm text-white/70">
            {STATUS_TEXT[view.status]}
            {view.status === 'active' && ` ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}
          </p>
          {demo && view.status === 'active' && <p className="mt-2 text-[11px] text-amber-200/80">（デモ：声はまだつながりません。Agoraの設定がすむと話せます）</p>}
          {audioErr && <p className="mt-2 text-xs text-rose-300">{audioErr}</p>}
        </div>
        <div className="flex gap-6">
          {view.status === 'active' && (
            <button
              onClick={() => {
                setMuted(!muted);
                audio.current?.mute(!muted);
              }}
              className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl ${muted ? 'bg-white text-black' : 'bg-white/15'}`}
              aria-label={muted ? 'ミュートを解除' : 'ミュート'}
            >
              {muted ? '🔇' : '🎙️'}
            </button>
          )}
          <button
            onClick={hangUp}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 text-2xl shadow-[0_0_20px_rgba(255,80,110,0.6)]"
            aria-label={done ? 'とじる' : '切る'}
          >
            {done ? '✕' : '📵'}
          </button>
        </div>
      </div>
    </Layer>
  );
}
