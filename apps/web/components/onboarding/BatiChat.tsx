'use client';

import type { BuddyPicture, BuddySource } from '@obolo/shared';
import { DrawnPicture, PlaceMap, SourceChips, placeOf } from '@/components/chat/BuddyExtras';
import { RoomSheet, type RoomMode } from '@/app/moon/BatiRoom';
import { useAuth } from '@/lib/auth';
import { useEffect, useRef, useState } from 'react';
import { getApi } from '@/lib/api';
import { unlockAudio } from '@/lib/onboarding/audio';
import { playClip, type Clip } from '@/lib/voice/webVoice';
import { saveSpell } from '@/components/jupiter/JupiterLesson';
import { kororinRing, TALK_FIXED_FACE_KEY, type BatiView, type Me, type TalkBeat, type TalkFace, type TalkMotion } from '@obolo/shared';
import { TalkComposer } from '@/components/talk/TalkComposer';
import { TalkScene, type TalkItem, type TalkPerson } from '@/components/talk/TalkScene';
import { BATI_COLOR, batiLook, PLACE_BG, SELF_COLOR, selfLook } from '@/lib/talk/looks';

/**
 * 〔💬 バティに聞く〕 (D03-S008 「はじめての、おしゃべり」, M-R138〜140): a chat like any other — Bati's face on top
 * (its expressions change with the talk: sparkle → think → surprise → smile), the bubbles, and the big 〔🎙〕 at
 * the bottom (⌨ in the corner). Bati looks things up by magic: it closes its eyes, says the spell 「〈問い〉——ここに、
 * こたえを。」, the mana gem glows and letters of light unwind; the answer comes in words first, and 〔🖼 絵で見る〕
 * under it brings a picture from a library whose pictures may be used, with its source — no mana (M-R147). Every
 * answer carries the 'can be wrong' line. No counts, no numbers, no "AI". A talk is gone when closed unless
 * 〔この話を残す〕 keeps it (R21b, M-R119): only kept talks are listed under 〔📜 前の話〕 (on this device, TALKS_KEY).
 */
export const TALKS_KEY = 'obolo.batiTalks';
type Talk = { at: string; lines: { who: 'me' | 'bati'; text: string }[] };
function loadTalks(): Talk[] {
  try {
    return JSON.parse(localStorage.getItem(TALKS_KEY) ?? '[]') as Talk[];
  } catch {
    return [];
  }
}
// noPic: a worry or a danger — no 〔🖼 絵で見る〕 under it (generation test 1, G-4)
// drawn / sources (M-R208): a picture {bati} drew when asked, the pages it looked the answer up on
type Msg = { id: number; who: 'me' | 'bati'; text: string; q?: string; picture?: BuddyPicture | null; picLoading?: boolean; noPic?: boolean; drawn?: string; sources?: BuddySource[]; face?: TalkFace; motion?: TalkMotion; faces?: TalkBeat[] };
const EXAMPLES = ['ビッグバンって、いつ起きたの？', 'ブラックホールの正体って、なに？', '宇宙の果てって、あるの？'];

export function BatiChat(props: Parameters<typeof BatiChatFull>[0] & { muted?: boolean }) {
  return props.first ? <BatiFirstTalk {...props} /> : <BatiChatFull {...props} />;
}

/** how many answers the first talk on the Moon lasts (M-R179: about five rounds, then {bati} grows sleepy) */
/** D03-S008 (M-R207): about three rounds, then {bati} hops; M-R223: 「1〜2往復すると」 — two */
const FIRST_ROUNDS = 2;
const sentences = (t: string) => (t.match(/[^。！？!?\n]+[。！？!?]*/g) ?? [t]).map((x) => x.trim()).filter(Boolean);

/**
 * D03-S008 「はじめての、おしゃべり」 as M-R179 has it: no how-to, no examples, no buttons — a chat where {neo} and
 * {bati} talk freely for about five rounds. {bati}'s answer comes in words at once and in {bati}'s own voice as each
 * sentence is made (words alone if the voice does not come); a picture, when there is one, comes inside the answer
 * with its source. One small line at the bottom says the answers can be wrong. Nothing is kept, no numbers.
 */
function BatiFirstTalk({ bati, neo, image, faces, me, muted = false, onDone }: { bati: string; neo: string; image?: string; faces?: Partial<Record<string, string>>; me?: string; muted?: boolean; onDone: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]); // its first words were said as a story line just before (no second time)
  const [face, setFace] = useState<string>('sparkle');
  const [casting, setCasting] = useState(false);
  const [rounds, setRounds] = useState(0);
  const [talk, setTalk] = useState({ listening: false, keyboard: false });
  // M-R223: a tap on {bati}'s face (or your own small one) above the chat changes the look; a look changed here wins
  const { me: auth } = useAuth();
  const [room, setRoom] = useState<RoomMode | null>(null);
  const changed = auth?.bati?.imageUrl && image && auth.bati.imageUrl !== image ? auth.bati : null;
  const pic = changed ? changed.faces?.[face as 'smile'] || changed.imageUrl || undefined : faces?.[face] || image;
  const myIcon = auth?.lookIcon || auth?.avatarUrl || me;
  // the voice: one sentence after another, each played as soon as it is made — through Web Audio (M-R239: quiet with
  // the silent switch on; the AudioContext is let out by the tap that asked)
  const playing = useRef<Clip | null>(null);
  const gen = useRef(0);
  useEffect(() => () => void (gen.current++, playing.current?.stop()), []);
  const sayAloud = async (text: string) => {
    const g = ++gen.current;
    if (muted) return;
    const parts = sentences(text).slice(0, 4);
    const urls = parts.map((t) => getApi().batiSays(t).then((r) => r.url).catch(() => null));
    for (const u of urls) {
      const url = await u;
      if (g !== gen.current) return;
      if (!url) continue;
      const clip = await playClip(url);
      if (!clip || g !== gen.current) {
        clip?.stop();
        continue;
      }
      playing.current = clip;
      await Promise.race([clip.done, new Promise((r) => setTimeout(r, 15_000))]);
    }
  };
  /** inside the tap: let the AudioContext out, so the later plays are allowed */
  const openVoice = () => {
    if (!muted) unlockAudio();
  };

  const ask = async (text: string) => {
    const t = text.trim();
    if (!t || casting || rounds >= FIRST_ROUNDS) return;
    gen.current++;
    playing.current?.stop();
    openVoice();
    setMsgs((m) => [...m, { id: m.length, who: 'me', text: t }]);
    setFace('think');
    setCasting(true);
    const started = Date.now();
    let reply = '';
    let noPic = false;
    let drawn: string | undefined;
    let sources: BuddySource[] | undefined;
    let look: { face?: TalkFace; motion?: TalkMotion; faces?: TalkBeat[] } = {};
    try {
      // at most 20 s: a set answer counts as a round, so the talk always reaches its end (story chat 2026-10-29)
      const r = await Promise.race([getApi().buddyChat(t, 'ja'), new Promise<never>((_, no) => setTimeout(() => no(new Error('slow')), 20_000))]);
      reply = r.reply.text;
      noPic = !!r.kind && r.kind !== 'normal';
      drawn = r.reply.image?.url;
      sources = r.reply.sources;
      look = { face: r.reply.face, motion: r.reply.motion, faces: r.reply.faces };
    } catch {
      reply = 'むむ…いまは、うまく調べられなかった！　ほかのこと、聞いてみて！';
      noPic = true;
    }
    // the magic takes a moment, even when the answer is quick
    await new Promise((r) => setTimeout(r, Math.max(0, 1200 - (Date.now() - started))));
    setCasting(false);
    setFace('surprise');
    const id = Date.now();
    // a picture it drew takes the library picture's place
    setMsgs((m) => [...m, { id, who: 'bati', text: reply, q: t, noPic, picLoading: !noPic && !drawn, drawn, sources, ...look }]);
    setTimeout(() => setFace('smile'), 1400);
    const n = rounds + 1;
    setRounds(n);
    const voice = sayAloud(reply);
    // a picture, when there is one, comes into the answer by itself (no button: M-R179)
    if (!noPic && !drawn)
      void getApi()
        .buddyPicture(t, reply)
        .then((r) => r.picture)
        .catch(() => null)
        .then((picture) => setMsgs((all) => all.map((x) => (x.id === id ? { ...x, picLoading: false, picture } : x))));
    // about three rounds: {bati} hops once the last answer has been said
    if (n >= FIRST_ROUNDS) {
      await Promise.race([voice, new Promise((r) => setTimeout(r, 12_000))]);
      await new Promise((r) => setTimeout(r, 1500));
      setFace('smile');
      setTimeout(onDone, 1600);
    }
  };

  // M-R232: the side-by-side talk ({bati} at the left, you at the right, the Moon behind); its old face names → the six
  const people = talkPeople(bati, neo, changed?.imageUrl || image, changed ? changed.faces : faces, auth?.bati, me, auth);
  const items: TalkItem[] = msgs.map((m) => ({
    id: String(m.id),
    who: m.who,
    text: m.text,
    face: m.faces ? undefined : m.face,
    motion: m.motion,
    faces: m.faces,
    card: m.drawn ? drawnCard(m.drawn, m.text) : m.picture ? pictureCard(m.picture) : undefined,
    extra:
      m.who === 'bati' ? (
        <>
          <SourceChips sources={m.sources} tone="story" />
          {m.q && !m.noPic && placeOf(m.q) && <PlaceMap place={placeOf(m.q)!} tone="story" />}
        </>
      ) : undefined,
  }));
  return (
    <div className="absolute inset-0 z-[12] flex flex-col bg-[#05060f] text-amber-50">
      <div className="pt-safe flex min-h-0 flex-1 flex-col pt-10">
        <TalkScene
          people={people}
          items={items}
          thinking={casting ? 'bati' : null}
          listening={talk.listening}
          keyboard={talk.keyboard}
          place={PLACE_BG.moon}
          kororin={kororinRing(auth)}
          fixedSelfFace={auth?.story?.[TALK_FIXED_FACE_KEY] === '1'}
          top={8}
          composer={
            <div>
              {rounds < FIRST_ROUNDS && <TalkComposer placeholder="" maxLength={120} disabled={casting} onState={setTalk} onSend={(v) => void ask(v)} />}
              <p className="pb-safe pb-1 text-center text-[10px] text-amber-50/40">{bati}の答えが、まちがっていることもあります</p>
            </div>
          }
        />
      </div>
      <LookButtons bati={bati} neo={neo} pic={pic} myIcon={myIcon} onRoom={setRoom} />
      {room && <RoomSheet mode={room} onClose={() => setRoom(null)} onDone={() => setRoom(null)} />}
    </div>
  );
}

function BatiChatFull({
  bati,
  neo,
  image,
  faces,
  first,
  me,
  spell = false,
  onDone,
}: {
  /** Obolo Order (L2 Moon, M-R166): an answer can be kept in the spellbook as cards */
  spell?: boolean;
  bati: string;
  neo: string;
  image?: string;
  faces?: Partial<Record<string, string>>;
  /** the first chat (day 2): the three-line how-to */
  first: boolean;
  /** the visitor's round icon, beside their own bubbles (M-R149) */
  me?: string;
  onDone: () => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, who: 'bati', text: first ? `ねえ、${neo}。宇宙のことで、知りたいこと、ある？　ボク、調べてみる！` : 'なにを調べる？　宇宙のことじゃなくても、何でも聞いてね！' }]);
  const [casting, setCasting] = useState<string | null>(null);
  const [asked, setAsked] = useState(false);
  const [history, setHistory] = useState<{ who: string; text: string }[] | null>(null);
  const [kept, setKept] = useState(false);
  const [noted, setNoted] = useState<Set<number>>(new Set());
  const [talk, setTalk] = useState({ listening: false, keyboard: false });

  const ask = async (text: string) => {
    const t = text.trim();
    if (!t || casting) return;
    setMsgs((m) => [...m, { id: m.length, who: 'me', text: t }]);
    setCasting(t);
    const started = Date.now();
    let reply = '';
    let noPic = false;
    let drawn: string | undefined;
    let sources: BuddySource[] | undefined;
    let look: { face?: TalkFace; motion?: TalkMotion; faces?: TalkBeat[] } = {};
    try {
      const r = await getApi().buddyChat(t, 'ja');
      reply = r.reply.text;
      noPic = !!r.kind && r.kind !== 'normal';
      drawn = r.reply.image?.url;
      sources = r.reply.sources;
      look = { face: r.reply.face, motion: r.reply.motion, faces: r.reply.faces };
    } catch {
      reply = 'うーん、いまは、うまく調べられなかった……。また聞いてね。';
    }
    // the spell takes a moment, even when the answer is quick
    await new Promise((r) => setTimeout(r, Math.max(0, 2200 - (Date.now() - started))));
    setCasting(null);
    setMsgs((m) => [...m, { id: m.length, who: 'bati', text: reply, q: t, noPic, drawn, sources, ...look }]);
    setAsked(true);
  };
  const showPicture = async (id: number) => {
    const m = msgs.find((x) => x.id === id);
    if (!m?.q) return;
    setMsgs((all) => all.map((x) => (x.id === id ? { ...x, picLoading: true } : x)));
    let picture: BuddyPicture | null = null;
    try {
      picture = (await getApi().buddyPicture(m.q, m.text)).picture;
    } catch {
      picture = null;
    }
    setMsgs((all) => all.map((x) => (x.id === id ? { ...x, picLoading: false, picture } : x)));
  };
  // only the talks kept with 〔この話を残す〕
  const openHistory = () => setHistory(loadTalks().flatMap((t) => t.lines.map((l) => ({ who: l.who === 'me' ? neo : bati, text: l.text }))));
  const keepTalk = () => {
    try {
      const talk: Talk = { at: new Date().toISOString(), lines: msgs.slice(1).map((m) => ({ who: m.who, text: m.text })) };
      localStorage.setItem(TALKS_KEY, JSON.stringify([...loadTalks(), talk].slice(-50)));
    } catch {
      /* private mode */
    }
    setKept(true);
  };

  const { me: auth } = useAuth();
  const people = talkPeople(bati, neo, image, faces, auth?.bati, me, auth);
  const items: TalkItem[] = msgs.map((m) => ({
    id: String(m.id),
    who: m.who,
    text: m.text,
    face: m.faces ? undefined : m.face,
    motion: m.motion,
    faces: m.faces,
    card: m.drawn ? drawnCard(m.drawn, m.text) : m.picture ? pictureCard(m.picture) : undefined,
    extra:
      m.who === 'bati' && m.q ? (
        <>
          <SourceChips sources={m.sources} tone="story" />
          {!m.noPic && placeOf(m.q) && <PlaceMap place={placeOf(m.q)!} tone="story" />}
          {m.noPic || m.drawn || m.picture ? null : m.picture === null ? (
            <p className="text-[11px] text-amber-50/55">ぴったりの絵は、見つからなかった……</p>
          ) : m.picLoading ? (
            <p className="animate-pulse text-[12px] text-amber-100/70">絵を、さがしている……</p>
          ) : (
            <button onClick={() => void showPicture(m.id)} className="rounded-full border border-amber-200/40 px-3 py-1 text-[12px]">
              絵で見る
            </button>
          )}
          {spell && (
            <button
              onClick={() => {
                saveSpell(m.text.split(/[、。！？!?\s　]+/).filter((w) => w.length > 1).slice(0, 6));
                setNoted((n) => new Set(n).add(m.id));
              }}
              disabled={noted.has(m.id)}
              className="ml-2 text-[11px] text-violet-200 disabled:text-amber-50/40"
            >
              {noted.has(m.id) ? 'スペルブックに記しました' : '記す'}
            </button>
          )}
          <p className="text-[10px] leading-snug text-amber-50/45">{bati}の答えが、まちがっていることもあります。大事なことは、自分でも確かめてね</p>
        </>
      ) : undefined,
  }));
  return (
    <div className="absolute inset-0 z-[12] flex flex-col bg-[#05060f] text-amber-50">
      <div className="pt-safe flex min-h-0 flex-1 flex-col pt-10">
        <TalkScene
          people={people}
          items={items}
          thinking={casting ? 'bati' : null}
          listening={talk.listening}
          keyboard={talk.keyboard}
          place={PLACE_BG.moon}
          kororin={kororinRing(auth)}
          fixedSelfFace={auth?.story?.[TALK_FIXED_FACE_KEY] === '1'}
          top={8}
          logLabel="前の話"
          composer={
            <div className="space-y-1.5">
              {/* the how-to comes one step at a time, at the moment it is used (M-R169) */}
              {first && !asked && <p className="mx-4 rounded-2xl bg-black/50 px-3 py-2 text-[12px] leading-relaxed text-amber-50/80">使い方｜マイクを押して、知りたいことを話してみよう（宇宙のことでも、それ以外のことでも、何でも）</p>}
              {!asked && (
                <div className="flex flex-wrap justify-center gap-1.5 px-3">
                  {EXAMPLES.map((e) => (
                    <button key={e} onClick={() => void ask(e)} className="rounded-full bg-black/45 px-3 py-1.5 text-[11px]">
                      {e}
                    </button>
                  ))}
                </div>
              )}
              {asked && (
                <div className="flex justify-center gap-2 px-3 text-[12px]">
                  <button onClick={keepTalk} disabled={kept || !!casting} className="rounded-full bg-black/45 px-3 py-1.5 text-amber-100/85 disabled:text-amber-50/40">
                    {kept ? 'この話を残しました' : 'この話を残す'}
                  </button>
                  <button onClick={openHistory} className="rounded-full bg-black/45 px-3 py-1.5">
                    前の話
                  </button>
                  <button onClick={onDone} disabled={!!casting} className="rounded-full bg-black/45 px-3 py-1.5 text-amber-50/80">
                    今日は、ここまで
                  </button>
                </div>
              )}
              <TalkComposer placeholder="ブラックホールの正体って、なに？" maxLength={120} disabled={!!casting} onState={setTalk} onSend={(v) => void ask(v)} />
            </div>
          }
        />
      </div>
      {casting && <p className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+64px)] z-[14] animate-pulse text-center text-[13px] text-amber-100/85">〈{casting}〉——ここに、こたえを。</p>}
      {history && (
        <div className="absolute inset-0 z-10 flex flex-col bg-black/85 px-4 pb-6 pt-[calc(16px+env(safe-area-inset-top))]" onClick={() => setHistory(null)}>
          <p className="text-center text-[13px] tracking-widest">前の話</p>
          <div className="mt-3 flex-1 space-y-2 overflow-y-auto text-[13px]">
            {history.length ? history.map((h, k) => <p key={k}><span className="mr-1 text-[10px] text-amber-200/70">{h.who}</span>{h.text}</p>) : <p className="text-center text-amber-50/50">まだ、残した話はありません</p>}
          </div>
          <button className="mt-3 rounded-full bg-white/10 py-3 text-[14px]">とじる</button>
        </div>
      )}
    </div>
  );
}

/** the two in the talk: {bati} (its look in the talk, else the story's picture and faces) and you */
function talkPeople(bati: string, neo: string, image: string | undefined, faces: Partial<Record<string, string>> | undefined, own: BatiView | null | undefined, myIcon: string | undefined, me: Me | null): TalkPerson[] {
  const look = own?.talk && own.imageUrl === image ? own.talk : batiLook({ ...(own ?? ({} as BatiView)), imageUrl: image ?? own?.imageUrl ?? null, faces: (faces ?? own?.faces) as BatiView['faces'], talk: undefined }, image);
  return [
    { id: 'bati', name: bati, look, color: BATI_COLOR },
    { id: 'me', name: neo, look: selfLook(me) ?? (myIcon ? { of: myIcon, stand: myIcon } : null), color: SELF_COLOR, self: true, avatar: me?.lookIcon ?? myIcon },
  ];
}

/** a picture {bati} drew, small in its bubble (big on a tap) */
const drawnCard = (url: string, alt: string) => ({ label: '絵', thumb: <DrawnPicture url={url} alt={alt} />, full: <DrawnPicture url={url} alt={alt} /> });

/** a library picture with its source (M-R140), small in the bubble */
function pictureCard(p: BuddyPicture) {
  const fig = (big: boolean) => (
    <figure className="overflow-hidden rounded-xl bg-black/40">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.url} alt={p.title} className={`${big ? 'max-h-[70svh]' : 'max-h-40'} w-full object-contain`} />
      <figcaption className="px-2 py-1 text-[10px] text-amber-50/60">
        {p.title}
        <a href={p.pageUrl} target="_blank" rel="noreferrer" className="ml-1 underline">
          出どころ：{p.source}
        </a>
      </figcaption>
    </figure>
  );
  return { label: p.title, thumb: fig(false), full: fig(true) };
}

/** M-R223: a tap on {bati}'s small face (or your own) changes the look — two small round buttons at the top right */
function LookButtons({ bati, neo, pic, myIcon, onRoom }: { bati: string; neo: string; pic?: string; myIcon?: string | null; onRoom: (m: RoomMode) => void }) {
  return (
    <div className="pt-safe absolute right-3 top-2 z-[14] flex gap-2">
      {pic && (
        <button type="button" onClick={() => onRoom('bati')} aria-label={`${bati}の見た目を変える`} className="h-9 w-9 overflow-hidden rounded-full bg-black/40 ring-1 ring-amber-200/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pic} alt="" className="h-full w-full object-contain" />
        </button>
      )}
      {myIcon && (
        <button type="button" onClick={() => onRoom('me')} aria-label={`${neo}の見た目を変える`} className="h-9 w-9 overflow-hidden rounded-full ring-1 ring-sky-200/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={myIcon} alt="" className="h-full w-full object-cover" />
        </button>
      )}
    </div>
  );
}
