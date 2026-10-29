'use client';

import { KORORIN_VOICE_STYLE, neoVoiceUrl, type SaturnPostView } from '@obolo/shared';
import { useEffect, useRef, useState } from 'react';
import { VoiceField } from '@/components/onboarding/StoryExtras';
import { Choice, DecisionButton } from '@/components/story/parts';
import { getApi } from '@/lib/api';
import { stopAudio, subscribeAudio, toggleAudio } from '@/lib/audio';
import { useAuth } from '@/lib/auth';
import { unlockAudio } from '@/lib/onboarding/audio';
import { spriteUrl } from '@/lib/onboarding/media';
import { LineVoice, lineVoiceUrl } from '@/lib/story/lineVoice';
import type { LessonApi } from '@/lib/onboarding/lessonApi';
import type { Speaker, Step } from '@/lib/onboarding/script';
import { useNameVoices } from '@/lib/story/useNameVoices';
import { singKororin, singUrl } from '@/lib/saturn/sing';
import { KororinVessels, type Kororin } from './KororinVessels';

/**
 * Day 3 on Saturn (D04-S005〜S006), rebuilt for M-R176 (client 2026-10-29). Inside the temple's great hall, drawn the
 * kororin way: a heap of round stones and two big vessels, KIMORIN⭐︎'s and {neo}'s. Each blows three words into a
 * stone (KIMORIN⭐︎ first, the takoyaki brother and sister helping); {bati} (うんちピンポンくん for KIMORIN⭐︎) touches it
 * and the kororin rolls into its vessel, where it stays with its date and time, singing the words in that voice (M-R152,
 * lib/saturn/sing). The first is tapped to sing; the second and third sing as they land. Then the design (D04-S005b),
 * the dachi (D04-S005c): a kororin flicked up out of the screen flies to the plaza outside — your dachi's plaza too —
 * and the plaza at dusk (D04-S006): 〔🎤 サイファー〕, the mic relay. The mic is the round button at the bottom; a
 * small ⌨ in the corner is the way out for anyone who cannot speak. The lines are the story's (wip/P02/c03.md).
 */
type Who = 'brother' | 'sister' | 'kimorin' | 'pinpon' | 'bati' | 'guide';
type Beat =
  | { k: 'say'; who: Who; text: string; redraw?: 'kimorin' }
  | { k: 'note'; text: string }
  /** KIMORIN⭐︎'s kororin rolls into his vessel (sing: it sings at once as it lands) */
  | { k: 'drop'; text: string; sing?: boolean }
  /** {neo} blows the n-th words into a stone (n > 1: the kororin sings as it lands) */
  | { k: 'rec'; n: 1 | 2 | 3 }
  | { k: 'listen'; id: 'kimorin-1' | 'mine-1' | 'sister' }
  | { k: 'batiVoice' }
  | { k: 'design' }
  /** KIMORIN⭐︎ flicks his three up, one by one */
  | { k: 'kimFly' }
  /** {neo} flicks any of theirs up (or 〔今はいい〕) */
  | { k: 'fly' }
  /** out of the temple to the plaza (the luxury cut to come: the gate, the plaza at dusk) */
  | { k: 'plaza' }
  /** the sister and the brother throw one each onto the plaza */
  | { k: 'throw' }
  | { k: 'cypher' }
  | { k: 'done' };

const SPEAKER: Record<Who, string> = { brother: 'たこ焼きブラザー', sister: 'たこ焼きシスター', kimorin: 'KIMORIN', pinpon: 'うんちピンポンくん', bati: 'バティ', guide: '' };
const NAMES: Record<Who, string> = { brother: 'たこ焼きブラザー', sister: 'たこ焼きシスター', kimorin: 'KIMORIN⭐︎', pinpon: 'うんちピンポンくん', bati: 'バティ', guide: '' };
const SPRITES: Partial<Record<Who, string>> = { brother: 'takoyaki-brother', sister: 'takoyaki-sister', kimorin: 'kimorin-sun', pinpon: 'unchi-pinpon' };

const SISTER_SUNSET = '……今日の夕焼け、きれいだったワ。';
const BROTHER_STONE = '土星は原石の星だZE!!';
const K1 = 'うんち。';
const K2 = '滑り台。';
const K3 = 'ぷりぷりぷりり、うひょひょひょ、げへへ！　ピンポン大正解！';

const BEATS: Beat[] = [
  // D04-S005 コロリン: the hall, the heap of stones, the two empty vessels
  { k: 'say', who: 'brother', text: '土星は原石の星だZE!!' },
  { k: 'say', who: 'sister', text: 'この原石になんでもいいから言葉を吹き込んでみるといいワ' },
  { k: 'say', who: 'brother', text: 'さあ、つぶやいてみるZE!!' },
  { k: 'say', who: 'kimorin', text: '……何を、つぶやけばいいですか？' },
  { k: 'say', who: 'brother', text: '最近食べて、うまかったものを、言ってみるZE!!' },
  { k: 'say', who: 'kimorin', text: 'わかりました。……では。' },
  { k: 'say', who: 'kimorin', text: 'うんち。' },
  { k: 'say', who: 'sister', text: '.....吹き込みが終わったら、バティが魔法で石をコロリンにしてくれるワ' }, // シーン……
  { k: 'say', who: 'pinpon', text: 'ピンポーン！' },
  { k: 'drop', text: K1 }, // the vessel's very first kororin
  { k: 'say', who: 'kimorin', text: 'なんですかこのかわいいたこ焼きは！' },
  { k: 'say', who: 'brother', text: 'これはコロリンだZE!!' },
  { k: 'say', who: 'sister', text: 'コロリンを、タップしてみるといいワ。' },
  { k: 'say', who: 'kimorin', text: 'タッチ..' },
  { k: 'listen', id: 'kimorin-1' },
  { k: 'say', who: 'kimorin', text: '楽しいですね。' }, // シーン……
  { k: 'say', who: 'sister', text: 'そう、コロリンは歌うの。' },
  { k: 'say', who: 'sister', text: '{neo}も、最近食べておいしかったものを、言ってみるといいワ。' },
  { k: 'rec', n: 1 },
  { k: 'listen', id: 'mine-1' },
  { k: 'say', who: 'kimorin', text: '……尾が、勝手に。これは、私の意思ではありません。' },
  { k: 'say', who: 'sister', text: '……いい声だワ。' },
  { k: 'say', who: 'brother', text: '{neo}の言葉が、{neo}の声で、歌になったZE。' },
  { k: 'say', who: 'brother', text: '次だZE。最近、楽しかったことは？' },
  { k: 'say', who: 'kimorin', text: '滑り台。' },
  { k: 'drop', text: K2, sing: true },
  { k: 'say', who: 'brother', text: '{neo}の番だZE。' },
  { k: 'rec', n: 2 },
  { k: 'say', who: 'sister', text: '最後は、自由に、なんでもいいワ。' },
  { k: 'say', who: 'kimorin', text: 'ぷりぷりぷりり、うひょひょひょ、げへへ！　ピンポン大正解！' },
  { k: 'say', who: 'pinpon', text: 'ピンポーン！' }, // シーン……のあと
  { k: 'drop', text: K3, sing: true },
  { k: 'say', who: 'brother', text: '{neo}の番だZE。なんでもいいZE!!' },
  { k: 'rec', n: 3 },
  { k: 'say', who: 'brother', text: '自分で思ったことや、感じたこと、思いついたことは、全部コロリンにしちゃえ。それは全部、大切な思い出だZE。' },
  { k: 'say', who: 'brother', text: '器のコロリンは、ずっと残るZE。だから、メモ代わりにでも、日記代わりにでも、使えちゃうZE。' },
  { k: 'note', text: 'コロリンは、あなたの器に、日付と時刻つきで残ります。器のコロリンを続けてタップすると、順番に歌って、つながります。コロリンは、いつでも作れます' },
  { k: 'batiVoice' },
  // D04-S005b コロリンのデザイン: the vessels' three change
  { k: 'say', who: 'sister', text: 'つぶやくのは、ここまでね。次は、見た目だワ。' },
  { k: 'say', who: 'sister', text: 'コロリンの見た目は、自分でデザインできるワ。' },
  { k: 'say', who: 'brother', text: '今は{neo}の見た目だZE。好きな見た目に、変えられるZE!!' },
  { k: 'say', who: 'kimorin', text: 'では、私から。' },
  { k: 'say', who: 'kimorin', text: '腕は80本。筋肉ムキムキ。パーティーが好き。……あと、たこ焼きなので、青のりを、多めに。' },
  { k: 'note', text: 'KIMORIN⭐︎のマナジェム　−3マナ' },
  { k: 'say', who: 'pinpon', text: 'ピンポン♪', redraw: 'kimorin' }, // KIMORINの器の三つが、腕80本・むきむき・青のり山盛りに
  { k: 'say', who: 'kimorin', text: '……完璧です。私は、人生で一回も、失敗したことがありませんので。' }, // シーン……
  { k: 'say', who: 'sister', text: '……言った言葉どおりに、なるワ。' },
  { k: 'say', who: 'brother', text: '{neo}の番だZE。' },
  { k: 'say', who: 'bati', text: '{neo}のコロリン、どんなのにする？' },
  { k: 'design' },
  // D04-S005c ダチになる／広場へ飛ばす
  { k: 'say', who: 'brother', text: '土星では、作ったものを届け合う仲間を、ダチって呼ぶZE。' },
  { k: 'say', who: 'brother', text: 'ダチは、本当に知ってる奴とだけ、なるもんだZE。' }, // M-R175
  { k: 'say', who: 'kimorin', text: 'では、ダチに、なりましょう。……というか、もう、ダチですよね？' },
  { k: 'note', text: 'KIMORIN⭐︎がダチになった' },
  { k: 'say', who: 'kimorin', text: '……念のため言っておきますが、詐欺グループの調査の、相棒として、です。' }, // 扇の尾が、ぱたぱた
  { k: 'say', who: 'brother', text: '招待者の、{inviter}だZE。' },
  { k: 'say', who: 'sister', text: '{neo}を、ここに招いてくれた人だワ。' },
  { k: 'note', text: '{inviter}がダチになった' },
  { k: 'say', who: 'sister', text: '今日から、上に〔推し〕ができるワ。ダチの作品だけが、そこに入るワ。' },
  { k: 'say', who: 'kimorin', text: '推し、ですか。……私は、ずっと、自分推しです。' },
  // M-R175: no requests from strangers at all — dachi only through invitations, people you really know
  { k: 'note', text: 'ダチになれるのは、招待状でつながった、本当に知っている人だけです。知らない人から、ダチの申しこみが来ることはありません' },
  { k: 'say', who: 'brother', text: '器のコロリンを、上に、飛ばしてみるZE!!' },
  { k: 'say', who: 'brother', text: '画面の外まで飛んだコロリンは、神殿の外の広場に届くZE。' },
  { k: 'say', who: 'sister', text: '広場には、ダチのコロリンが集まるワ。{neo}が飛ばしたコロリンも、ダチの広場に並ぶワ。' },
  { k: 'say', who: 'brother', text: '飛ばしたいのがあったら、飛ばせばいいZE。何個でもいいZE!!' },
  { k: 'say', who: 'kimorin', text: 'では、三つとも。……全部、名作ですので。' },
  { k: 'kimFly' },
  { k: 'fly' },
  // D04-S006 土星の広場のサイファー
  { k: 'plaza' },
  { k: 'say', who: 'sister', text: '今夜は、ワタシたちのも、入れるワ。' },
  { k: 'throw' },
  { k: 'say', who: 'brother', text: 'サイファー、始めるZE!!' },
  { k: 'cypher' },
  { k: 'say', who: 'kimorin', text: '……な、なんやこれ。……失礼。土星の夜は、毎日、こうなのですか？' }, // サングラスが鼻先までずり落ちている
  { k: 'say', who: 'brother', text: 'サイファーを押した夜は、毎日だZE。' },
  { k: 'note', text: '広場のコロリンをタップすると、一つずつ歌が聞けます。〔🎤 サイファー〕を押すと、次々に歌いだして、マイクリレーが始まります' },
  { k: 'listen', id: 'sister' },
  { k: 'done' },
];
const DESIGNED: Beat[] = [
  { k: 'note', text: 'これから生まれるコロリンは、この見た目になります' },
  { k: 'say', who: 'kimorin', text: '……並べると、私のほうが、腕が多いですね。' }, // KIMORINが、自分の器を、{neo}の器のとなりに、そっと寄せる
];
const UNDESIGNED: Beat[] = [{ k: 'say', who: 'sister', text: '今の見た目のままでも、いいワ。デザインは、あとでもできるワ。' }];
const FLOWN: Beat[] = [
  { k: 'note', text: 'コロリンが、広場へ飛んでいった' },
  { k: 'say', who: 'brother', text: '広場のコロリンは、88時間たつと、自分の器に戻ってくるZE。' },
  { k: 'note', text: '上へ飛ばしたコロリンは、神殿の外の土星の広場に届き、ダチ（{inviter}・KIMORIN⭐︎）の広場にも並びます。広場には、ダチと自分のコロリンが集まります（三周目からは、推した人のコロリンも）。飛ばすのに、マナは使いません' },
];
const NOT_FLOWN: Beat[] = [{ k: 'say', who: 'sister', text: '飛ばしたくなったら、いつでも飛ばせるワ。' }];
/** every spoken line of the practice, as story steps: the ones with names in them are voiced per member (useNameVoices) */
const NAME_STEPS: Step[] = [...BEATS, ...DESIGNED, ...UNDESIGNED, ...FLOWN, ...NOT_FLOWN].flatMap((b): Step[] => (b.k === 'say' && SPEAKER[b.who] ? [{ t: 'say', who: SPEAKER[b.who] as Speaker, text: b.text }] : []));
/** KIMORIN⭐︎'s designed kororin (80 muscular arms, a heap of aonori) — design/story-art-queue.json */
const KIMORIN_DESIGNED = '/onboarding/s/kororin-kimorin80.jpg';
const TOPICS = [
  { t: '今したいこと', ex: '滑り台でボカーン！' },
  { t: '最近驚いたこと', ex: 'え！？わき毛ってこんなに美味しいの？' },
  { t: 'やりたいこと', ex: 'ハグキフェチ集合' },
];

/**
 * A story kororin's voice: the speaker's own recorded line (the story voice, else the kororin voice), sung on the
 * melody; the plain voice when it cannot be sung.
 */
async function storyVoice(who: string, text: string): Promise<string> {
  const plain = (await lineVoiceUrl(who, text)) ?? (await lineVoiceUrl('コロリン', text)) ?? neoVoiceUrl(KORORIN_VOICE_STYLE, null, text);
  return (await singUrl(plain, text)) ?? plain;
}

const toBase64 = (b: Blob) =>
  new Promise<string>((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] ?? '');
    r.onerror = () => no(r.error);
    r.readAsDataURL(b);
  });

/** A recording two semitones up (pitch and pace together, like a sped-up tape) → WAV: used only if singing fails. */
async function upTwo(blob: Blob): Promise<Blob> {
  try {
    const rate = Math.pow(2, 2 / 12);
    // decoded offline: a new AudioContext each time ran out on iOS after a few kororins
    const src = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(await blob.arrayBuffer());
    const off = new OfflineAudioContext(1, Math.ceil((src.length / rate) * (44100 / src.sampleRate)), 44100);
    const node = off.createBufferSource();
    node.buffer = src;
    node.playbackRate.value = rate;
    node.connect(off.destination);
    node.start();
    const out = await off.startRendering();
    const pcm = out.getChannelData(0);
    const buf = new ArrayBuffer(44 + pcm.length * 2);
    const v = new DataView(buf);
    const w = (o: number, t: string) => [...t].forEach((c, k) => v.setUint8(o + k, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 44100, true); v.setUint32(28, 88200, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, pcm.length * 2, true);
    for (let k = 0; k < pcm.length; k++) v.setInt16(44 + k * 2, Math.max(-1, Math.min(1, pcm[k])) * 0x7fff, true);
    return new Blob([buf], { type: 'audio/wav' });
  } catch {
    return blob;
  }
}

/**
 * Record from the mic (tap to start, tap to stop). Gain control on, so a whisper is heard too.
 * iPhone (client 2026-10-29: the kororin mic did not work well): the take comes in small pieces (a single piece at the
 * end came back empty), a tap right after starting does not stop it before anything was heard, the format is the one
 * the phone records, and the page's sound is woken up again after the mic (iOS suspends it while recording).
 */
const MIN_TAKE_MS = 700;
function recType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined;
  return ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t));
}
function useRecorder() {
  const [on, setOn] = useState(false);
  const rec = useRef<MediaRecorder | null>(null);
  const startedAt = useRef(0);
  const done = useRef<(b: Blob | null) => void>(() => undefined);
  const start = async (): Promise<boolean> => {
    if (rec.current && rec.current.state !== 'inactive') return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const chunks: Blob[] = [];
      const type = recType();
      const r = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        rec.current = null;
        unlockAudio();
        done.current(chunks.length ? new Blob(chunks, { type: r.mimeType || type || 'audio/webm' }) : null);
      };
      rec.current = r;
      r.start(250);
      startedAt.current = Date.now();
      setOn(true);
      return true;
    } catch {
      rec.current = null;
      return false;
    }
  };
  const stop = () =>
    new Promise<Blob | null>((ok) => {
      const r = rec.current;
      if (!r || r.state === 'inactive') {
        setOn(false);
        return ok(null);
      }
      const end = () => {
        done.current = ok;
        setOn(false);
        try {
          r.requestData();
        } catch {
          /* not recording any more */
        }
        r.stop();
      };
      // a tap right after starting: let it hear a moment first
      const wait = MIN_TAKE_MS - (Date.now() - startedAt.current);
      if (wait > 0) setTimeout(end, wait);
      else end();
    });
  return { on, start, stop };
}

export function SaturnLesson({
  bati,
  neo,
  inviter,
  inviterMessage,
  batiImage,
  food,
  api,
  onDone,
}: {
  bati: string;
  neo: string;
  inviter: string;
  /** the inviter's own words on Day 1's invitation, shown again on their dachi card (M-R169) */
  inviterMessage?: string;
  batiImage?: string;
  /** the favourite food said on the Moon (the design takes it in) */
  food?: string;
  api?: LessonApi;
  onDone: (made: string[]) => void;
}) {
  const { me } = useAuth();
  const [beats, setBeats] = useState<Beat[]>(BEATS);
  const [i, setI] = useState(0);
  const [made, setMade] = useState<string[]>([]);
  // the two vessels and the plaza (M-R176)
  const [kimorinK, setKimorinK] = useState<Kororin[]>([]);
  const [mineK, setMineK] = useState<Kororin[]>([]);
  const [plazaK, setPlazaK] = useState<Kororin[]>([]);
  const [scene, setScene] = useState<'hall' | 'plaza'>('hall');
  const [singingId, setSingingId] = useState<string | null>(null);
  const [oh, setOh] = useState(false);
  const [flown, setFlown] = useState(0);
  const [normal, setNormal] = useState<{ blob: Blob; text: string } | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [asking, setAsking] = useState(false);
  const [typing, setTyping] = useState(false);
  const [micFail, setMicFail] = useState(false);
  const [missed, setMissed] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  // the design you picked (D04-S005b), shown next to KIMORIN⭐︎'s at 「並べると…」 (QA 6 P7)
  const [myLook, setMyLook] = useState<string | null>(null);
  const [hint, setHint] = useState('');
  // a kororin singing holds the story until its song ends (QA 6 R11)
  const [waitSong, setWaitSong] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const voice = useRef<LineVoice | null>(null);
  const rec = useRecorder();
  const beat = beats[i];
  const fill = (t: string) => t.replaceAll('{bati}', bati).replaceAll('{neo}', neo).replaceAll('{inviter}', inviter);
  const insert = (more: Beat[]) => setBeats((b) => [...b.slice(0, i + 1), ...more, ...b.slice(i + 1)]);
  const next = () => setI((n) => n + 1);
  // a tap right after the line changed (by itself or by a tap) is taken as reading it, not as the next one (QA 7, R17)
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = Date.now();
  }, [i]);
  // a spoken line is heard to the end, as in the story (client 2026-10-28); never stuck behind a voice that did not
  // come or did not end: 4 s + 0.26 s a character, or once it started, its own length + 1 s
  const voiceBusy = useRef(false);
  const voiceUntil = useRef(0);
  const tapNext = () => {
    const now = Date.now();
    if (now - shownAt.current < 600) return;
    const len = beat?.k === 'say' ? fill(beat.text).length : 0;
    if (voiceBusy.current && now < (voiceUntil.current || shownAt.current + 4000 + len * 260)) return;
    next();
  };

  // the voice is also state, so the member's own voices of the lines with names in them reach it (QA 8, R18: ten
  // lines with {neo} / {inviter} were silent and waited for a tap)
  const [lineVoice, setLineVoice] = useState<LineVoice | null>(null);
  useEffect(() => {
    const v = new LineVoice();
    v.unlock();
    voice.current = v;
    setLineVoice(v);
    return () => v.dispose();
  }, []);
  useNameVoices(lineVoice, NAME_STEPS, { neo, bati, inviter });
  // a spoken line goes on by itself a moment after its voice ends; a tap still skips ahead (QA 6 P2)
  const iRef = useRef(i);
  iRef.current = i;
  const beatRef = useRef(beat);
  beatRef.current = beat;
  // a line with no voice goes on after a reading time, as the story's escape: 4 s + 0.26 s a character (QA 13 R45).
  // While its voice is being fetched the clock stops; a voice that starts moves the line on when it ends; only a
  // voice that failed to come starts the clock again (a slow voice no longer let the line go by unheard, M-R174)
  const heard = useRef(-1);
  const readTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const countFrom = (at: number) => {
    clearTimeout(readTimer.current);
    const b = beatRef.current;
    if (b?.k !== 'say' || iRef.current !== at) return;
    readTimer.current = setTimeout(() => {
      if (heard.current === at || iRef.current !== at || voiceBusy.current) return;
      setI((n) => (n === at ? n + 1 : n));
    }, 4000 + fill(b.text).length * 260);
  };
  useEffect(() => {
    if (beat?.k !== 'say') return;
    if (!voiceBusy.current) countFrom(i);
    return () => clearTimeout(readTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);
  useEffect(() => {
    const v = voice.current;
    if (!v) return;
    let spokeAt = -1;
    v.onLoading = (on) => {
      voiceBusy.current = on;
      voiceUntil.current = 0;
      if (on) clearTimeout(readTimer.current);
      // fetched but never started (it failed): the reading clock starts now
      else if (heard.current !== iRef.current) countFrom(iRef.current);
    };
    v.onSpeaking = (on) => {
      voiceBusy.current = on;
      voiceUntil.current = on && v.duration() ? Date.now() + (v.duration() + 1) * 1000 : 0;
      if (on) {
        heard.current = iRef.current;
        clearTimeout(readTimer.current);
      }
      if (on) spokeAt = iRef.current;
      else if (spokeAt === iRef.current && beatRef.current?.k === 'say') {
        const at = spokeAt;
        setTimeout(() => iRef.current === at && setI((n) => (n === at ? n + 1 : n)), 900);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // the Saturn music plays low under the lesson and stops while the mic records (QA 5 N14)
  const duck = (v: number) => {
    window.dispatchEvent(new CustomEvent('obolo:bgm-duck', { detail: v }));
  };
  useEffect(() => {
    duck(rec.on ? 0 : 0.4);
  }, [rec.on]);
  useEffect(() => () => duck(1), []);
  // a kororin sings to its end (the music dips under it); a song that never starts does not hold the story (QA 7,
  // R14), a lost end is capped
  const sing = (k: Kororin | undefined) =>
    new Promise<void>((done) => {
      if (!k?.url) return done();
      setSingingId(k.id);
      duck(0.15);
      let started = false;
      let finished = false;
      const end = () => {
        if (finished) return;
        finished = true;
        off();
        clearTimeout(cap);
        setSingingId(null);
        duck(0.4);
        done();
      };
      let cap = setTimeout(end, 3000);
      const off = subscribeAudio((st) => {
        if (st.playing) {
          if (!started) {
            clearTimeout(cap);
            cap = setTimeout(end, 20000);
          }
          started = true;
        } else if (started) end();
      });
      void toggleAudio(k.url);
    });
  const singThenNext = async (k: Kororin | undefined, at: number) => {
    setWaitSong(true);
    await sing(k);
    setTimeout(() => {
      setWaitSong(false);
      setI((n) => (n === at ? n + 1 : n));
    }, 800);
  };
  const story = (owner: Kororin['owner'], id: string, name: string, pic: string | null, text: string, who: string): Promise<Kororin> =>
    storyVoice(who, text).then((url) => ({ id, owner, name, pic, seed: name, text, url, at: Date.now() }));
  // KIMORIN⭐︎'s three fly up off the screen, one by one (D04-S005c)
  const [flyingIds, setFlyingIds] = useState<string[]>([]);

  // each line plays its voice; the story's kororins come in with theirs
  useEffect(() => {
    if (!beat) return;
    setHint('');
    const at = i;
    if (beat.k === 'say') {
      void voice.current?.say(SPEAKER[beat.who], beat.text);
      if (beat.redraw === 'kimorin') setKimorinK((x) => x.map((k) => ({ ...k, pic: KIMORIN_DESIGNED })));
    }
    if (beat.k === 'drop') {
      const n = kimorinK.length + 1;
      void story('kimorin', `kimorin-${n}`, 'KIMORIN⭐︎', spriteUrl('kimorin-face'), beat.text, 'KIMORIN').then((k) => {
        setKimorinK((x) => [...x, k]);
        if (beat.sing) setTimeout(() => void singThenNext(k, at), 900);
        else setTimeout(() => setI((m) => (m === at ? m + 1 : m)), 1100);
      });
    }
    if (beat.k === 'kimFly') {
      setFlyingIds(kimorinK.map((k) => k.id));
      setTimeout(() => {
        setPlazaK((x) => [...x, ...kimorinK]);
        setKimorinK([]);
        setFlyingIds([]);
        setI((m) => (m === at ? m + 1 : m));
      }, 1700);
    }
    if (beat.k === 'plaza') {
      stopAudio();
      setScene('plaza');
      setTimeout(() => setI((m) => (m === at ? m + 1 : m)), 1400);
    }
    if (beat.k === 'throw')
      void Promise.all([
        story('sister', 'sister', 'たこ焼きシスター', spriteUrl('takoyaki-sister'), SISTER_SUNSET, 'たこ焼きシスター'),
        story('brother', 'brother', 'たこ焼きブラザー', spriteUrl('takoyaki-brother'), BROTHER_STONE, 'たこ焼きブラザー'),
      ]).then((two) => {
        setPlazaK((x) => [...x, ...two]);
        setTimeout(() => setI((m) => (m === at ? m + 1 : m)), 1300);
      });
    // D04-S005c: the inviter really becomes a dachi here
    if (beat.k === 'note' && beat.text === '{inviter}がダチになった') void api?.befriendInviter().catch(() => undefined);
    if (beat.k === 'done') {
      // out through black: 0.5 s darker, then back to the story (QA 12 R38: it left in one frame)
      setLeaving(true);
      setTimeout(() => onDone(made), 520);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, beats]);

  // 1. words blown into a stone (spoken or typed) → {bati} touches it: a kororin that sings in your own voice
  const murmur = async (blob: Blob | null, text: string) => {
    setBusy(true);
    let words = text.trim();
    try {
      if (blob && me && !words) {
        const up = await getApi().uploadVoice(blob);
        words = (await getApi().transcribe(up.id)).text.trim();
      }
    } catch {
      /* keep going with what we have */
    }
    if (!words) words = '……';
    const up = blob ? await singKororin(blob, words).catch(() => upTwo(blob)) : null;
    let post: SaturnPostView | null = null;
    try {
      if (me) {
        const voiceMediaId = up ? (await getApi().uploadVoice(up)).id : undefined;
        post = await getApi().createSaturnPost(voiceMediaId ? { text: words.slice(0, 140), voiceMediaId, room: true } : { text: words.slice(0, 140), voiceStyle: KORORIN_VOICE_STYLE, readBy: 'bati', room: true });
      }
    } catch {
      post = null;
    }
    // into {neo}'s vessel with its date and time; the story previews (nobody logged in) keep it on this screen only
    const n = beat?.k === 'rec' ? beat.n : 1;
    const k: Kororin = { id: post?.id ?? `mine-${Date.now()}`, owner: 'mine', name: neo || 'あなた', pic: myLook, seed: neo || 'あなた', text: words, url: post?.voiceUrl ?? (up ? URL.createObjectURL(up) : neoVoiceUrl(KORORIN_VOICE_STYLE, null, words)), at: Date.now() };
    setMineK((x) => [...x, k]);
    setMade((m) => [...m, words]);
    if (blob) setNormal({ blob, text: words });
    setTyped('');
    setTyping(false);
    setBusy(false);
    // the first is tapped to sing; the second and third sing as they land
    if (n === 1) next();
    else setTimeout(() => void singThenNext(k, i), 900);
  };

  const tapBati = async () => {
    if (busy || !beat) return;
    if (beat.k === 'rec' && !agreed) return setAsking(true);
    if (!rec.on) {
      setMissed(false);
      if (await rec.start()) return setMicFail(false);
      setMicFail(true);
      if (beat.k === 'rec') setTyping(true);
      return;
    }
    const blob = await rec.stop();
    // nothing came back: say so and let them try again (it used to do nothing at all)
    if (!blob || blob.size < 1000) return setMissed(true);
    setMissed(false);
    void murmur(blob, '');
  };

  // 2. {bati}'s voice: your voice two semitones up
  const batiVoice = async (yes: boolean) => {
    if (!yes || !normal) return next();
    setBusy(true);
    const line = fill('わあ！　ボク、{neo}と、おそろいの声になった！');
    let url: string | null = null;
    try {
      if (me) {
        await getApi().registerVoice({ slot: 'bati', audio: { mime: normal.blob.type || 'audio/webm', data: await toBase64(normal.blob) }, text: normal.text, pitch: 2 });
        url = (await getApi().speak({ slot: 'bati', text: line })).url;
      }
    } catch {
      url = null;
    }
    // play {bati}'s new voice (the preview: the murmur itself, two semitones up)
    const a = new Audio(url ?? URL.createObjectURL(normal.blob));
    if (!url) {
      a.playbackRate = Math.pow(2, 2 / 12);
      (a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = false;
    }
    void a.play().catch(() => undefined);
    setBusy(false);
    setBeats((b) => [...b.slice(0, i + 1), { k: 'say', who: 'bati', text: 'わあ！　ボク、{neo}と、おそろいの声になった！' }, ...b.slice(i + 1)]);
    next();
  };

  // D04-S005b: the picked design becomes the look of your kororins (null = kept as it is)
  const designed = (url: string | null) => {
    setMyLook(url);
    if (url) setMineK((x) => x.map((k) => ({ ...k, pic: url })));
    insert(url ? DESIGNED : UNDESIGNED);
    next();
  };
  // D04-S005c: a kororin flicked up out of the screen flies to the plaza — and to the dachi's 〔推し〕 (no mana)
  const flick = (k: Kororin) => {
    setMineK((x) => x.filter((y) => y.id !== k.id));
    setPlazaK((x) => [...x, k]);
    setFlown((n) => n + 1);
    const url = k.url && /^https?:/.test(k.url) ? k.url : undefined;
    void api?.deliver({ kind: 'kororin', text: k.text.slice(0, 200), url, refId: /^[0-9a-f-]{36}$/.test(k.id) ? k.id : undefined }).catch(() => undefined);
  };
  const flyDone = () => {
    insert(flown ? FLOWN : NOT_FLOWN);
    next();
  };
  // 〔🎤 サイファー〕: one after another on the same beat, the mic passing on; the last 「♪オー！」 all together
  const [relay, setRelay] = useState(false);
  const cypher = async () => {
    if (relay) return;
    setRelay(true);
    const at = i;
    for (const k of plazaK) await sing(k);
    setOh(true);
    setTimeout(() => {
      setOh(false);
      setRelay(false);
      setI((n) => (n === at ? n + 1 : n));
    }, 1600);
  };

  const target = beat?.k === 'listen' ? (beat.id === 'kimorin-1' ? kimorinK[0]?.id : beat.id === 'mine-1' ? mineK[0]?.id : 'sister') ?? null : null;
  const tapKororin = (k: Kororin) => {
    if (singingId || relay) return;
    if (beat?.k === 'listen' && !waitSong) {
      if (k.id !== target) return setHint(beat.id === 'mine-1' ? fill('光っている、{neo}のコロリンを押してね') : '光っているコロリンを押してね');
      setHint('');
      return void singThenNext(k, i);
    }
    // any other time: a tap just sings it (the story waits for nothing)
    if (!waitSong && beat?.k !== 'rec') void sing(k);
  };

  const recording = beat?.k === 'rec';
  const coachWho: Who = beat?.k === 'say' ? beat.who : 'guide';
  const coachText =
    beat?.k === 'say'
      ? fill(beat.text)
      : beat?.k === 'note'
        ? fill(beat.text)
        : beat?.k === 'listen'
          ? waitSong ? '♪……' : beat.id === 'mine-1' ? 'コロリンを、タップしてみよう' : '👆 光っているコロリンをタップ'
          : beat?.k === 'batiVoice'
            ? fill('いまの普通の声を、少し高くして、{bati}の声にもする？')
            : beat?.k === 'fly'
              ? '飛ばしたいコロリンを、上へはじこう（何個でも。飛ばさなくてもいい）'
              : beat?.k === 'cypher'
                ? relay ? '♪……' : ''
                : '';

  return (
    <>
    {/* in through black: the temple darkens (0.5 s), the world comes up from black (0.8 s); out the same way (QA 12 R38) */}
    <div className="pointer-events-none fixed inset-0 z-[260] bg-black" style={{ animation: leaving ? 'lessonOut 0.5s ease-in both' : 'lessonCurtain 1.3s ease-in-out both' }} aria-hidden />
    <style>{'@keyframes lessonCurtain{0%{opacity:0}38%{opacity:1}100%{opacity:0}}@keyframes lessonWorld{0%,37%{opacity:0}38%,100%{opacity:1}}@keyframes lessonOut{from{opacity:0}to{opacity:1}}'}</style>
    <div className="fixed inset-0 z-[150]" style={{ animation: 'lessonWorld 1.3s linear both' }}>
      <KororinVessels
        scene={scene}
        kimorin={kimorinK}
        mine={mineK}
        neo={neo}
        plaza={plazaK}
        singingId={singingId}
        highlightId={beat?.k === 'listen' && !waitSong ? target : null}
        partyOn={!!singingId || oh}
        flickable={beat?.k === 'fly'}
        flyingIds={flyingIds}
        oh={oh}
        onTap={tapKororin}
        onFlick={flick}
        overlay={
          <>

            {/* the line (a thin band at the top so the planet stays in view) */}
            {coachText && (
              <div className="pointer-events-none absolute inset-x-0 top-[calc(70px+env(safe-area-inset-top))] z-[200] flex justify-center px-3">
                <div key={`${i}-${coachText}`} className="flex w-full max-w-md animate-[fadeUp_0.35s_ease-out] items-end gap-2">
                  {SPRITES[coachWho] && (
                    // the speaker from the chest up, as big as in the temple (QA 6 P1, a little bigger again: QA 7)
                    <span className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-white/10 shadow-lg ring-2 ring-white/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={spriteUrl(SPRITES[coachWho]!)} alt="" className="absolute left-1/2 top-0 h-[230%] w-auto max-w-none -translate-x-1/2 object-contain" />
                    </span>
                  )}
                  {coachWho === 'bati' && batiImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={batiImage} alt="" className="h-12 w-12 shrink-0 rounded-2xl object-cover" />
                  )}
                  <div className="min-w-0 flex-1 rounded-2xl bg-[rgba(20,12,36,0.72)] px-4 py-2.5 text-white shadow-lg backdrop-blur-sm">
                    {NAMES[coachWho] && <p className="text-[10.5px] tracking-[0.25em] text-amber-200/90">{coachWho === 'bati' ? bati : NAMES[coachWho]}</p>}
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{coachText}</p>
                  </div>
                </div>
              </div>
            )}
            {(beat?.k === 'say' || beat?.k === 'note') && (
              <button className="absolute inset-0 z-[195]" aria-label="つぎへ" onClick={tapNext}>
                <span className="absolute right-4 top-[calc(178px+env(safe-area-inset-top))] animate-pulse text-xs text-white/80">▶</span>
              </button>
            )}
            {beat?.k === 'note' && beat.text.endsWith('がダチになった') && (
              <DachiCard who={beat.text.startsWith('KIMORIN') ? 'kimorin' : 'inviter'} name={beat.text.startsWith('KIMORIN') ? 'KIMORIN⭐︎' : inviter} message={beat.text.startsWith('KIMORIN') ? undefined : inviterMessage} />
            )}
            {hint && <p className="pointer-events-none absolute inset-x-0 bottom-[calc(120px+env(safe-area-inset-bottom))] z-[205] text-center"><span className="rounded-full bg-[rgba(20,12,36,0.75)] px-4 py-2 text-[13px] text-amber-100">{hint}</span></p>}

            {/* {bati} is the mic: a round button at the bottom */}
            {recording && !waitSong && (
              <div className="pb-safe absolute inset-x-0 bottom-0 z-[205] flex flex-col items-center px-5 pb-8">
                <p className="mb-3 max-w-sm rounded-2xl bg-[rgba(20,12,36,0.72)] px-4 py-2.5 text-center text-[14px] leading-relaxed text-white backdrop-blur-sm">
                  {beat?.k === 'rec' && beat.n === 3 ? (
                    <>
                      なんでもいい。迷ったら、小さな字のお題から
                      <span className="mt-1 block text-[11px] text-white/75">{TOPICS.map((t) => `${t.t}（例「${t.ex}」）`).join('／')}</span>
                    </>
                  ) : beat?.k === 'rec' && beat.n === 2 ? (
                    <>最近、楽しかったことを、石に吹き込もう</>
                  ) : (
                    <>最近食べておいしかったものを、石に吹き込もう</>
                  )}
                </p>
                {(
                  // a big, plain mic: tap to talk, tap again to stop ({bati} listens from its shoulder)
                  <button
                    onClick={() => void tapBati()}
                    disabled={busy}
                    className={`relative flex h-32 w-32 items-center justify-center rounded-full border-4 shadow-[0_8px_30px_rgba(60,20,90,0.45)] transition active:scale-95 disabled:opacity-60 ${rec.on ? 'border-rose-200 bg-gradient-to-b from-rose-400 to-rose-600' : 'border-amber-100 bg-gradient-to-b from-amber-300 to-orange-500'} ${!rec.on && !busy ? 'animate-[hintGlow_2.2s_ease-in-out_infinite]' : ''}`}
                    aria-label={rec.on ? '録音をとめる' : '録音する'}
                  >
                    {rec.on && <span className="absolute inset-0 animate-ping rounded-full bg-rose-300/50" />}
                    {rec.on ? (
                      <span className="relative h-11 w-11 rounded-lg bg-white" />
                    ) : (
                      <svg viewBox="0 0 24 24" className="relative h-16 w-16 fill-white drop-shadow" aria-hidden>
                        <path d="M12 14.5a3.5 3.5 0 0 0 3.5-3.5V5a3.5 3.5 0 0 0-7 0v6a3.5 3.5 0 0 0 3.5 3.5Z" />
                        <path d="M18.5 11a.9.9 0 0 0-1.8 0 4.7 4.7 0 0 1-9.4 0 .9.9 0 0 0-1.8 0 6.5 6.5 0 0 0 5.6 6.4V20H8.8a.9.9 0 0 0 0 1.8h6.4a.9.9 0 0 0 0-1.8H12.9v-2.6a6.5 6.5 0 0 0 5.6-6.4Z" />
                      </svg>
                    )}
                    {batiImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={batiImage} alt="" className="absolute -left-3 -top-3 h-12 w-12 rounded-full border-2 border-white object-cover shadow" />
                    )}
                  </button>
                )}
                {(
                  <p className="mt-3 rounded-full bg-[rgba(20,12,36,0.72)] px-4 py-1.5 text-[14px] font-bold text-white">
                    {busy ? `${bati}が、コロリンにしているよ…` : rec.on ? '話しおわったら、もう一度タップ' : micFail ? 'マイクが使えないみたい' : missed ? 'うまく録れなかった。もう一度タップして、話してね' : 'タップして、話してね'}
                  </p>
                )}
                {/* the way out for anyone who cannot speak (hidden while the typing sheet is open) */}
                {!typing && (
                <button onClick={() => setTyping(true)} className="absolute bottom-[calc(14px+env(safe-area-inset-bottom))] right-4 rounded-full bg-[rgba(20,12,36,0.6)] px-3 py-1.5 text-[13px] text-white" aria-label="文字で入力">
                  ⌨ 文字で
                </button>
                )}
              </div>
            )}

            {typing && beat?.k === 'rec' && (
              <div className="absolute inset-0 z-[230] flex items-end justify-center bg-black/50" onClick={() => setTyping(false)}>
                <div className="pb-safe w-full max-w-md rounded-t-3xl bg-white p-5 text-slate-800" onClick={(e) => e.stopPropagation()}>
                  <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && typed.trim() && !busy) void murmur(null, typed); }} maxLength={140} placeholder={beat.n === 1 ? 'たこ焼き' : beat.n === 2 ? '滑り台' : 'いま思ったこと'} className="w-full border-b border-violet-300 py-2 text-[16px] outline-none" />
                  <button disabled={!typed.trim() || busy} onClick={() => void murmur(null, typed)} className="mt-4 w-full rounded-full bg-violet-500 py-3 font-black text-white disabled:opacity-40">
                    {bati}にコロリンにしてもらう
                  </button>
                </div>
              </div>
            )}

            {asking && (
              <div className="absolute inset-0 z-[240] flex items-center justify-center bg-black/60 px-6">
                <div className="w-full max-w-sm rounded-3xl bg-[rgba(14,10,24,0.95)] p-5 text-center text-amber-50">
                  <p className="text-[15px] leading-relaxed">吹きこんだ声は、あなたのコロリンの声としてだけ使います</p>
                  <div className="mt-4">
                    <DecisionButton
                      onClick={() => {
                        setAgreed(true);
                        setAsking(false);
                        void rec.start().then((ok) => !ok && setTyping(true));
                      }}
                    >
                      いいよ
                    </DecisionButton>
                  </div>
                  <button onClick={() => setAsking(false)} className="mt-3 text-sm text-white/55">
                    やめる
                  </button>
                </div>
              </div>
            )}

            {beat?.k === 'batiVoice' && (
              <div className="pb-safe absolute inset-x-0 bottom-0 z-[205] flex flex-col items-end gap-2 px-4 pb-8">
                {normal ? (
                  <>
                    <Choice k={0} disabled={busy} onClick={() => void batiVoice(true)}>
                      する
                    </Choice>
                    <Choice k={1} disabled={busy} onClick={() => void batiVoice(false)}>
                      今のままでいい
                    </Choice>
                  </>
                ) : (
                  <BatiSkip onSkip={next} />
                )}
              </div>
            )}

            {beat?.k === 'design' && <KororinDesign api={api} bati={bati} neo={neo} food={food} onDone={designed} />}
            {beat?.k === 'fly' && (
              <div className="pb-safe absolute inset-x-0 bottom-0 z-[205] flex justify-center px-5 pb-3">
                <button onClick={flyDone} className="rounded-full bg-[rgba(20,12,36,0.72)] px-5 py-2 text-[13px] text-white">
                  {flown ? 'これでいい' : '今はいい'}
                </button>
              </div>
            )}
            {beat?.k === 'cypher' && !relay && (
              <div className="pb-safe absolute inset-x-0 bottom-0 z-[205] flex justify-center px-5 pb-8">
                <button onClick={() => void cypher()} className="rounded-full border-2 border-amber-100 bg-gradient-to-b from-amber-300 to-orange-500 px-8 py-3 text-[17px] font-black text-white shadow-lg active:scale-95 animate-[hintGlow_2.2s_ease-in-out_infinite]">
                  🎤 サイファー
                </button>
              </div>
            )}
          </>
        }
      />
    </div>
    </>
  );
}

/** Typed murmurs have no voice to borrow: the question is skipped. */
function BatiSkip({ onSkip }: { onSkip: () => void }) {
  useEffect(() => {
    onSkip();
  }, [onSkip]);
  return null;
}

/**
 * D04-S005b コロリンのデザイン (M-R130/M-R132): 〔おまかせ〕 (the NEO look + the favourite food) or 〔🎙 話して
 * 決める〕 (two colours and the mood, said aloud; ⌨ only when you cannot speak) → the mana question → four designs
 * → pick one, or say what to change once (then the new four, or 〔前の4つ〕 again).
 */
function KororinDesign({ api, bati, neo, food, onDone }: { api?: LessonApi; bati: string; neo: string; food?: string; onDone: (url: string | null) => void }) {
  const [phase, setPhase] = useState<'how' | 'ask' | 'mana' | 'drawing' | 'pick' | 'refine'>('how');
  const [said, setSaid] = useState('');
  const [wish, setWish] = useState('');
  const [refined, setRefined] = useState(false);
  const [designs, setDesigns] = useState<{ id: string; url: string }[]>([]);
  const [before, setBefore] = useState<{ id: string; url: string }[] | null>(null);
  const [showBefore, setShowBefore] = useState(false);
  const [err, setErr] = useState(false);

  const describe = (extra?: string) =>
    ['a round takoyaki-ball kororin', said ? `colours and mood: ${said}` : '', food ? `favourite food: ${food}` : '', extra ? `request: ${extra}` : ''].filter(Boolean).join('. ');
  const draw = async (extra?: string) => {
    setPhase('drawing');
    setErr(false);
    try {
      const d = api ? await api.kororinDesigns(describe(extra)) : [];
      if (!d.length) throw new Error('none');
      if (extra) setBefore(designs);
      setDesigns(d);
      setPhase('pick');
    } catch {
      setErr(true);
      setPhase(extra ? 'pick' : 'mana');
    }
  };
  const pick = (d: { id: string; url: string }) => {
    void api?.chooseKororin(d.id).catch(() => undefined);
    onDone(d.url);
  };

  if (phase === 'how')
    return (
      <div className="pb-safe absolute inset-x-0 bottom-0 z-[205] flex flex-col items-end gap-2 px-4 pb-8">
        <Choice k={0} onClick={() => setPhase('mana')}>
          おまかせ
        </Choice>
        <Choice k={1} onClick={() => setPhase('ask')}>
          🎙 話して決める
        </Choice>
      </div>
    );
  if (phase === 'ask')
    return (
      <div className={sheet}>
        <p className="text-[13px] text-amber-200/90">{bati}「好きな色と、今の気分。話してみて。」</p>
        <div className="mt-4">
          <VoiceField value={said} onChange={setSaid} placeholder="青と金。わくわく" maxLength={40} />
        </div>
        <div className="mt-4 space-y-2">
          <DecisionButton disabled={!said.trim()} onClick={() => setPhase('mana')}>
            これで描く
          </DecisionButton>
          <button
            onClick={() => {
              setSaid('');
              setPhase('mana');
            }}
            className="w-full text-center text-[13px] text-white/55"
          >
            パス
          </button>
        </div>
      </div>
    );
  if (phase === 'mana')
    return (
      <div className="absolute inset-0 z-[240] flex items-center justify-center bg-black/60 px-6">
        <div className="w-full max-w-sm rounded-3xl bg-[rgba(14,10,24,0.95)] p-5 text-center text-amber-50">
          <p className="text-[15px] leading-relaxed">{err ? '描けなかった…もう一度ためしてね' : 'コロリンのデザインの魔法に、マナジェムのマナを使います'}</p>
          <div className="mt-4">
            <DecisionButton onClick={() => void draw()}>使う</DecisionButton>
          </div>
          <button onClick={() => onDone(null)} className="mt-3 text-sm text-white/55">
            やめる
          </button>
        </div>
      </div>
    );
  if (phase === 'drawing')
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-[18%] z-[205] flex flex-col items-center gap-2">
        <p className="animate-pulse rounded-full bg-[rgba(20,12,36,0.8)] px-5 py-2 text-[15px] text-white">{bati}が、{neo}のコロリンにタッチしている…</p>
        <p className="rounded-full bg-[rgba(20,12,36,0.8)] px-4 py-1 text-[13px] text-amber-200">−3マナ</p>
      </div>
    );
  const shown = showBefore && before ? before : designs;
  return (
    <div className={sheet}>
      <p className="mb-3 text-center text-[15px] font-bold text-amber-50">気に入ったのを、タップしてね</p>
      <div className="grid grid-cols-2 gap-3">
        {shown.map((d, k) => (
          <button key={d.id} onClick={() => pick(d)} className="aspect-square overflow-hidden rounded-2xl border border-white/20 bg-white/90 p-1 active:scale-95">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.url} alt={`${k + 1}つ目`} className="h-full w-full object-contain" />
          </button>
        ))}
      </div>
      {err && <p className="mt-3 text-center text-[13px] text-rose-200">描き直せなかった…このなかから選んでね</p>}
      {before && (
        <button onClick={() => setShowBefore((x) => !x)} className="mt-3 w-full text-center text-[13px] text-amber-200/90 underline">
          {showBefore ? '新しい4つ' : '前の4つ'}
        </button>
      )}
      {!refined &&
        (phase === 'refine' ? (
          <div className="mt-4">
            <VoiceField value={wish} onChange={setWish} placeholder="もっとまるく" maxLength={40} />
            <div className="mt-3">
              <DecisionButton
                disabled={!wish.trim()}
                onClick={() => {
                  setRefined(true);
                  void draw(wish.trim());
                }}
              >
                描き直す（1回だけ）
              </DecisionButton>
            </div>
          </div>
        ) : (
          <button onClick={() => setPhase('refine')} className="mt-4 w-full text-center text-[14px] text-amber-200/90 underline">
            🎙 要望を言って描き直す（1回だけ）
          </button>
        ))}
    </div>
  );
}

/**
 * A new dachi (QA 6 P9, M-R169): a small card sealed like Day 1's invitation (the compass seal), the face and
 * the name, and for {inviter} their words from the invitation once more. KIMORIN⭐︎'s face sways as he arrives.
 */
function DachiCard({ who, name, message }: { who: 'kimorin' | 'inviter'; name: string; message?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[198] flex items-center justify-center px-8">
      <div className="relative w-full max-w-[280px] animate-[fadeUp_0.5s_ease-out] rounded-2xl border-2 border-amber-300/80 bg-gradient-to-b from-[#2a1a3e] to-[#120a1e] px-5 pb-5 pt-9 text-center text-amber-50 shadow-[0_0_40px_rgba(255,200,120,0.35)]">
        {/* the compass seal, as on the invitation */}
        <span className="absolute -top-7 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border-4 border-double border-amber-200 bg-gradient-to-b from-[#b4282e] to-[#6e1418] text-2xl shadow-lg">🧭</span>
        <p className="text-[11px] tracking-[0.3em] text-amber-200/90">👥 ダチ</p>
        <span className={`mx-auto mt-3 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-white/10 ring-2 ring-amber-200/70 ${who === 'kimorin' ? 'animate-[tailFlap_0.5s_ease-in-out_4]' : ''}`}>
          {who === 'kimorin' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={spriteUrl('kimorin-face')} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-3xl font-bold">{[...name][0]}</span>
          )}
        </span>
        <p className="mt-3 text-[18px] font-bold" style={{ fontFamily: '"Shippori Mincho", "Hiragino Mincho ProN", serif' }}>
          {name}
        </p>
        {message && (
          <p className="mt-3 whitespace-pre-wrap border-t border-amber-200/30 pt-3 text-[13px] leading-relaxed text-amber-50/90" style={{ fontFamily: '"Shippori Mincho", "Hiragino Mincho ProN", serif' }}>
            「{message}」
          </p>
        )}
      </div>
      <style>{'@keyframes tailFlap{0%,100%{transform:rotate(0)}30%{transform:rotate(-8deg)}70%{transform:rotate(8deg)}}'}</style>
    </div>
  );
}

const sheet = 'pb-safe absolute inset-x-0 bottom-0 z-[205] max-h-[72%] overflow-y-auto rounded-t-3xl bg-[rgba(14,10,24,0.94)] px-5 pb-8 pt-5 text-amber-50';
