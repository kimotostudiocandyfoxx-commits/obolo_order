'use client';

import { KORORIN_VOICE_STYLE, neoVoiceUrl, type SaturnPostView } from '@obolo/shared';
import { useEffect, useRef, useState } from 'react';
import { VoiceField } from '@/components/onboarding/StoryExtras';
import { Choice, DecisionButton } from '@/components/story/parts';
import { getApi } from '@/lib/api';
import { subscribeAudio } from '@/lib/audio';
import { useAuth } from '@/lib/auth';
import { spriteUrl } from '@/lib/onboarding/media';
import { LineVoice, lineVoiceUrl } from '@/lib/story/lineVoice';
import type { LessonApi } from '@/lib/onboarding/lessonApi';
import type { Speaker, Step } from '@/lib/onboarding/script';
import { useNameVoices } from '@/lib/story/useNameVoices';
import { singKororin, singUrl } from '@/lib/saturn/sing';
import { KororinWorld } from './KororinWorld';

/**
 * Day 3 on Saturn (D04-S005〜S006; story 9ec42f9, M-R85 — client 2026-10-25). The voice comes out for the
 * first time here, on the real Saturn world (ころりんぱ):
 *  1. outside the temple, round Saturn stones: you blow words into a stone, your {bati} touches it and it
 *     becomes a kororin that sings your words in your own voice, a cappella on a short club melody (M-R152,
 *     lib/saturn/sing; KIMORIN⭐︎ first, with
 *     うんちピンポンくん; a slip of paper with words to read for anyone who cannot think of any)
 *  2. after a spoken murmur: make {bati}'s voice your voice a little higher too? ［する／今のままでいい］
 *  3. the brother's how-to, then ［もうひとつ、つぶやいてみる／今日は、ここまで］ (topics to start from)
 *  4. the residents' ring: a kororin rolls to your feet — the sister's 「……今日の夕焼け、きれいだったわ。」 (story M-R107)
 * The mic is {bati} itself (a round button at the bottom); a small ⌨ in the corner is the way out for
 * anyone who cannot speak (then {bati}'s voice reads the kororin). The lines are the story's.
 */
type Who = 'brother' | 'sister' | 'kimorin' | 'pinpon' | 'bati' | 'guide';
type Beat =
  | { k: 'say'; who: Who; text: string; drop?: 'kimorin'; star?: boolean; redraw?: 'kimorin' }
  | { k: 'note'; text: string }
  | { k: 'recNormal'; prompt: 'first' | 'topics' }
  | { k: 'listen'; id: 'kimorin' | 'mine' | 'sunset' | 'back'; text?: string }
  | { k: 'batiVoice' }
  | { k: 'choice' }
  | { k: 'design' }
  | { k: 'send' }
  /** 〔自分の部屋に飛ばす〕 under the kororin just sung (D04-S005, M-R169) */
  | { k: 'fly' }
  | { k: 'done' };

const SPEAKER: Record<Who, string> = { brother: 'たこ焼きブラザー', sister: 'たこ焼きシスター', kimorin: 'KIMORIN', pinpon: 'うんちピンポンくん', bati: 'バティ', guide: '' };
const NAMES: Record<Who, string> = { brother: 'たこ焼きブラザー', sister: 'たこ焼きシスター', kimorin: 'KIMORIN⭐︎', pinpon: 'うんちピンポンくん', bati: 'バティ', guide: '' };
const SPRITES: Partial<Record<Who, string>> = { brother: 'takoyaki-brother', sister: 'takoyaki-sister', kimorin: 'kimorin-sun', pinpon: 'unchi-pinpon' };

/** the residents' kororin that rolls to your feet on Saturn (story M-R107) */
const SISTER_SUNSET = '……今日の夕焼け、きれいだったワ。';
const KIMORIN_STONE = 'ぷりぷりぷりり！ぷりぷりぷりり！うひょひょひょげへへ！ぷりぷりぷりりり！うん！うん！うんちピンポーン大正かーい！ぷり！げへへへ！ぷりぷり滑り台でボカーン！';
/** the slip of paper KIMORIN⭐︎ hands over, for anyone who cannot think of words */
const PAPER = 'ぷりぷりぷりり！うひょひょひょ！げへへ！うん！うん！うんちピンポーン！だいせいかーい！ぷり！げへへへ！ぷりぷりブランコでボカーン！';

const BEATS: Beat[] = [
  // D04-S005 コロリン: outside the temple, a heap of round Saturn stones
  { k: 'say', who: 'brother', text: '土星は原石の星だZE!!' },
  { k: 'say', who: 'sister', text: 'この原石になんでもいいから言葉を吹き込んでみるといいワ' },
  { k: 'say', who: 'kimorin', text: '本当になんでもいいんですか？' },
  { k: 'say', who: 'brother', text: 'なんでもいいZE!!' },
  { k: 'say', who: 'sister', text: '最初はお試しだから“こんにちは”とか、一言で大丈夫だワ。' },
  { k: 'say', who: 'kimorin', text: 'わかりました。\nでは、、。' },
  { k: 'say', who: 'kimorin', text: KIMORIN_STONE },
  { k: 'say', who: 'sister', text: '.....吹き込みが終わったら、バティが魔法で石をコロリンにしてくれるワ' }, // シーン……みんなが無言でKIMORINを見つめる
  { k: 'say', who: 'pinpon', text: 'ピンポーン！', drop: 'kimorin' }, // うんちピンポンくんが石にタッチ → KIMORINの見た目のコロリン
  { k: 'say', who: 'kimorin', text: 'なんですかこのかわいいたこ焼きは！' },
  { k: 'say', who: 'brother', text: 'これはコロリンだZE!!' },
  { k: 'say', who: 'sister', text: 'コロリンを、タップしてみるといいワ。' },
  { k: 'say', who: 'kimorin', text: 'タッチ..' },
  { k: 'listen', id: 'kimorin' },
  { k: 'say', who: 'kimorin', text: '楽しいですね。' }, // シーン……
  { k: 'say', who: 'sister', text: 'そう、コロリンは歌うの。' },
  { k: 'say', who: 'sister', text: '{neo}もやってみたらいいワ。' },
  { k: 'say', who: 'brother', text: '文字だけだと、冷たく見られたり、怒ってるように思われたりするZE。' },
  { k: 'say', who: 'brother', text: 'かわいいコロリンが声に出せば、そんな勘違いは起きないZE。' },
  { k: 'say', who: 'brother', text: 'なんでもいいから石に声を吹き込むんだZE！' },
  { k: 'say', who: 'kimorin', text: '思いつかない時は、これを読んでください。' },
  { k: 'note', text: `紙に書いてある言葉：\n${PAPER}` },
  { k: 'recNormal', prompt: 'first' },
  { k: 'listen', id: 'mine' },
  // the first song (M-R169): KIMORIN's tail still beats; then the kororin is sent to your room
  { k: 'say', who: 'kimorin', text: '……尾が、勝手に。これは、私の意思ではありません。' },
  { k: 'say', who: 'sister', text: '……いい声だワ。' },
  { k: 'say', who: 'brother', text: '{neo}の言葉が、{neo}の声で、歌になったZE。' },
  { k: 'fly' },
  { k: 'say', who: 'brother', text: '自分で思ったことや、感じたこと、思いついたことは、全部コロリンにしちゃえ。それは全部、大切な思い出だZE。' },
  { k: 'say', who: 'brother', text: '住人たちのつぶやいたコロリンは、土星の空を、リングとなって舞うZE。' },
  { k: 'say', who: 'brother', text: 'つぶやいたコロリンは、自分の部屋に落としとけばいいんだZE。' },
  { k: 'say', who: 'brother', text: 'だから、メモ代わりにでも、日記代わりにでも、使えちゃうZE。' },
  { k: 'batiVoice' },
  // the steps were just done: only the question (QA 7, R16)
  { k: 'note', text: 'もうひとつ、つぶやいてみる？' },
  { k: 'choice' },
  // D04-S005b コロリンのデザイン (draft 21, M-R124): KIMORIN⭐︎ first, then yours (answers or おまかせ → four → one redo)
  { k: 'say', who: 'sister', text: 'つぶやくのは、ここまでね。次は、見た目だワ。' },
  { k: 'say', who: 'sister', text: 'コロリンの見た目は、自分でデザインできるワ。' },
  { k: 'say', who: 'brother', text: '今は{neo}の見た目だZE。好きな見た目に、変えられるZE!!' },
  { k: 'say', who: 'kimorin', text: 'では、私から。' },
  { k: 'say', who: 'kimorin', text: '腕は80本。筋肉ムキムキ。パーティーが好き。……あと、たこ焼きなので、青のりを、多めに。' },
  { k: 'note', text: 'KIMORIN⭐︎のマナジェム　−3マナ' },
  { k: 'say', who: 'pinpon', text: 'ピンポン♪', redraw: 'kimorin' }, // KIMORINのコロリンが光って、腕80本・むきむき・青のり山盛りに
  { k: 'say', who: 'kimorin', text: '……完璧です。私は、人生で一回も、失敗したことがありませんので。' }, // シーン……
  { k: 'say', who: 'sister', text: '……言った言葉どおりに、なるワ。' },
  { k: 'say', who: 'brother', text: '{neo}の番だZE。' },
  { k: 'say', who: 'bati', text: '{neo}のコロリン、どんなのにする？' },
  { k: 'design' },
  // D04-S005c ダチになる／ダチに届ける: KIMORIN⭐︎ and {inviter} are your dachi from today; 〔推し〕 opens
  { k: 'say', who: 'brother', text: '土星では、作ったものを届け合う仲間を、ダチって呼ぶZE。' },
  { k: 'say', who: 'kimorin', text: 'では、ダチに、なりましょう。……というか、もう、ダチですよね？' },
  { k: 'note', text: 'KIMORIN⭐︎がダチになった' },
  { k: 'say', who: 'kimorin', text: '……念のため言っておきますが、詐欺グループの調査の、相棒として、です。' }, // 扇の尾が、ぱたぱた
  { k: 'say', who: 'brother', text: '招待者の、{inviter}だZE。' },
  { k: 'say', who: 'sister', text: '{neo}を、ここに招いてくれた人だワ。' },
  { k: 'note', text: '{inviter}がダチになった' },
  { k: 'say', who: 'sister', text: '今日から、上に〔推し〕ができるワ。ダチの作品だけが、そこに入るワ。' },
  { k: 'say', who: 'kimorin', text: '推し、ですか。……私は、ずっと、自分推しです。' },
  { k: 'note', text: '知らない人からダチの申しこみが来ても、承認しなくてかまいません。断っても、相手には知らせません' },
  { k: 'say', who: 'brother', text: '{neo}のコロリン、ダチに届けてみるといいZE!!' },
  { k: 'send' },
  // KIMORIN⭐︎ rolls his own kororin back on the ring; it dances once in your 〔推し〕
  { k: 'say', who: 'kimorin', text: 'お返しです。ダチなので。' },
  // no 〔推し〕 on this screen (QA 7, R10・R16)
  { k: 'note', text: 'KIMORIN⭐︎から、お返しのコロリンが届いた。タップすると歌うよ' },
  { k: 'listen', id: 'back' },
  // D04-S006 土星の空のリング (story M-R107): the night relay (luxury video V21, to come), then a kororin rolls to your feet
  { k: 'say', who: 'kimorin', text: '……な、なんやこれ。……失礼。土星の夜は、毎日、こうなのですか？' }, // サングラスが鼻先までずり落ちている
  { k: 'say', who: 'brother', text: 'つぶやいた奴がいる夜は、毎日だZE。' },
  { k: 'note', text: '空を舞う住人たちのコロリンをタップすると、歌が聞けます' },
  { k: 'listen', id: 'sunset' },
  { k: 'done' },
];
// the branch after the choice
// the voice kororin is free on every journey (M-R124): no mana line
const TRY: Beat[] = [{ k: 'recNormal', prompt: 'topics' }, { k: 'listen', id: 'mine' }, { k: 'note', text: 'コロリンは、あなたの部屋に、日付と時刻つきで残ります。誰にも送られません。部屋のコロリンを続けてタップすると、順番に歌って、つながります' }];
const SKIP: Beat[] = [{ k: 'say', who: 'sister', text: 'いいワ。つぶやきたくなったら、いつでもどうぞ。' }, { k: 'note', text: 'コロリンは、いつでも作れます（今日でなくても）' }];
const DESIGNED: Beat[] = [
  { k: 'note', text: 'これから生まれるコロリンは、この見た目になります' },
  { k: 'say', who: 'kimorin', text: '……並べると、私のほうが、腕が多いですね。' }, // 80本腕のコロリンを、となりに並べる
];
const UNDESIGNED: Beat[] = [{ k: 'say', who: 'sister', text: '今の見た目のままでも、いいワ。デザインは、あとでもできるワ。' }];
const SENT: Beat[] = [
  { k: 'note', text: 'ダチに、コロリンを届けた' },
  { k: 'say', who: 'brother', text: '届けたコロリンは、88時間、ダチのところを転がって、{neo}の部屋に戻ってくるZE。' },
  { k: 'note', text: '届けたコロリンは、{inviter}とKIMORIN⭐︎の〔推し〕に入ります。届いた時、相手の画面で一度だけ、サングラスを落として踊ります（音が出るのは、相手がタップした時だけ）。届けるのに、マナは使いません' },
];
const NOT_SENT: Beat[] = [{ k: 'say', who: 'sister', text: '届けたくなったら、いつでも届けられるワ。' }];
/** every spoken line of the practice, as story steps: the ones with names in them are voiced per member (useNameVoices) */
const NAME_STEPS: Step[] = [...BEATS, ...TRY, ...SKIP, ...DESIGNED, ...UNDESIGNED, ...SENT, ...NOT_SENT].flatMap((b): Step[] => (b.k === 'say' && SPEAKER[b.who] ? [{ t: 'say', who: SPEAKER[b.who] as Speaker, text: b.text }] : []));
/** KIMORIN⭐︎'s designed kororin (80 muscular arms, a heap of aonori) — design/story-art-queue.json */
const KIMORIN_DESIGNED = '/onboarding/s/kororin-kimorin80.jpg';
const TOPICS = [
  { t: '今したいこと', ex: '滑り台でボカーン！' },
  { t: '最近驚いたこと', ex: 'え！？わき毛ってこんなに美味しいの？' },
  { t: 'やりたいこと', ex: 'ハグキフェチ集合' },
];

/** The story's own kororins (not saved anywhere; they live on this screen). */
const storyPost = (id: string, name: string, pic: string, text: string, url: string): SaturnPostView => ({
  id,
  author: { id: `story-${name}`, handle: name, displayName: name, pic },
  text,
  voiceUrl: url,
  voiceSource: 'default',
  voiceDurationSec: null,
  starCount: 0,
  starredByMe: false,
  createdAt: new Date().toISOString(),
});

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
    const src = await new AudioContext().decodeAudioData(await blob.arrayBuffer());
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

/** Record from the mic (tap to start, tap to stop). Gain control on, so a whisper is heard too. */
function useRecorder() {
  const [on, setOn] = useState(false);
  const rec = useRef<MediaRecorder | null>(null);
  const done = useRef<(b: Blob | null) => void>(() => undefined);
  const start = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const chunks: BlobPart[] = [];
      const r = new MediaRecorder(stream);
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        done.current(chunks.length ? new Blob(chunks, { type: r.mimeType || 'audio/webm' }) : null);
      };
      rec.current = r;
      r.start();
      setOn(true);
      return true;
    } catch {
      return false;
    }
  };
  const stop = () =>
    new Promise<Blob | null>((ok) => {
      done.current = ok;
      setOn(false);
      if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
      else ok(null);
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
  const [extra, setExtra] = useState<SaturnPostView[]>([]);
  const [normal, setNormal] = useState<{ blob: Blob; text: string } | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [asking, setAsking] = useState(false);
  const [typing, setTyping] = useState(false);
  const [micFail, setMicFail] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [star, setStar] = useState(false);
  // your own kororin (QA 6 R6: only it counts at 〔👆 コロリンをタップ〕), a hint when another is tapped
  const [mineId, setMineId] = useState<string | null>(null);
  // the design you picked (D04-S005b), shown next to KIMORIN⭐︎'s at 「並べると…」 (QA 6 P7)
  const [myLook, setMyLook] = useState<string | null>(null);
  const [hint, setHint] = useState('');
  // a tapped kororin sings to the end before the story goes on (QA 6 R11)
  const [waitSong, setWaitSong] = useState(false);
  // 〔🏠 自分の部屋に飛ばす〕: the kororin rolls away to the room (QA 6 P5)
  const [flying, setFlying] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [closeSignal, setCloseSignal] = useState(0);
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
  const tapNext = () => {
    if (Date.now() - shownAt.current < 600) return;
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
  // a line whose voice is not there (yet) goes on after a reading time (0.12 s a character + 1.5 s)
  const heard = useRef(-1);
  const readTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (beat?.k !== 'say') return;
    const at = i;
    const len = fill(beat.text).length;
    const first = setTimeout(() => {
      // a voice that starts later (it came slowly) takes over: it moves the line on when it ends (QA 9 R26)
      if (heard.current !== at)
        readTimer.current = setTimeout(() => {
          if (heard.current === at || iRef.current !== at) return;
          // a voice arriving just now is not played for a moment (QA 10 R31)
          voice.current?.stop();
          setI((n) => (n === at ? n + 1 : n));
        }, len * 120 + 1500);
    }, 1500);
    return () => {
      clearTimeout(first);
      clearTimeout(readTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);
  useEffect(() => {
    const v = voice.current;
    if (!v) return;
    let spokeAt = -1;
    v.onSpeaking = (on) => {
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
  }, []);
  // the Saturn music plays low under the lesson and stops while the mic records (QA 5 N14)
  const duck = (v: number) => {
    window.dispatchEvent(new CustomEvent('obolo:bgm-duck', { detail: v }));
  };
  useEffect(() => {
    duck(rec.on ? 0 : 0.4);
  }, [rec.on]);
  useEffect(() => () => duck(1), []);
  // each line plays its voice; the story's kororins drop in with theirs
  useEffect(() => {
    if (!beat) return;
    if (beat.k !== 'listen') setCloseSignal((n) => n + 1);
    setHint('');
    if (beat.k === 'say') {
      void voice.current?.say(SPEAKER[beat.who], beat.text);
      if (beat.star) setStar(true);
      if (beat.redraw === 'kimorin') setExtra((x) => x.map((p) => (p.id === 'story-kimorin' ? { ...p, author: { ...p.author, pic: KIMORIN_DESIGNED } } : p)));
      if (beat.drop === 'kimorin')
        // KIMORIN⭐︎'s kororin takes a breath and sings his words in his own voice (M-R152)
        void storyVoice('KIMORIN', KIMORIN_STONE).then((u) => setExtra((x) => [storyPost('story-kimorin', 'KIMORIN⭐︎', spriteUrl('kimorin-face'), KIMORIN_STONE, u), ...x]));
    }
    if (beat.k === 'say' && beat.text === 'お返しです。ダチなので。')
      void storyVoice('KIMORIN', 'ダチなので。').then((u) => setExtra((x) => [...x, storyPost('story-kimorin-back', 'KIMORIN⭐︎', KIMORIN_DESIGNED, 'ダチなので。', u)]));
    if (beat.k === 'listen' && beat.id === 'sunset')
      void storyVoice('たこ焼きシスター', SISTER_SUNSET).then((u) => setExtra((x) => [...x, storyPost('story-sunset', 'たこ焼きシスター', spriteUrl('takoyaki-sister'), SISTER_SUNSET, u)]));
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
    if (!words) words = beat?.k === 'recNormal' && beat.prompt === 'first' ? PAPER : '……';
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
    // the story previews (nobody logged in): a kororin that lives on this screen, in the voice just recorded
    post ??= storyPost(`mine-${Date.now()}`, neo || 'あなた', '', words, up ? URL.createObjectURL(up) : neoVoiceUrl(KORORIN_VOICE_STYLE, null, words));
    setExtra((x) => [...x, { ...post!, id: post!.id }]);
    setMineId(post.id);
    setMade((m) => [...m, words]);
    if (blob) setNormal({ blob, text: words });
    setTyped('');
    setTyping(false);
    setBusy(false);
    next();
  };

  const tapBati = async () => {
    if (busy || !beat) return;
    if (beat.k === 'recNormal' && !agreed) return setAsking(true);
    if (!rec.on) {
      if (await rec.start()) return setMicFail(false);
      setMicFail(true);
      if (beat.k === 'recNormal') setTyping(true);
      return;
    }
    const blob = await rec.stop();
    if (!blob) return;
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

  const choose = (tryMore: boolean) => {
    setBeats((b) => [...b.slice(0, i + 1), ...(tryMore ? TRY : SKIP), ...b.slice(i + 1)]);
    next();
  };

  // D04-S005b: the picked design becomes the look of your kororins (null = kept as it is)
  const designed = (url: string | null) => {
    setMyLook(url);
    if (url) setExtra((x) => x.map((p) => (p.id.startsWith('story-') ? p : { ...p, author: { ...p.author, pic: url } })));
    insert(url ? DESIGNED : UNDESIGNED);
    next();
  };
  const sent = (yes: boolean) => {
    if (yes) {
      const mine = [...extra].reverse().find((p) => !p.id.startsWith('story-'));
      const url = mine?.voiceUrl && /^https?:/.test(mine.voiceUrl) ? mine.voiceUrl : undefined;
      void api?.deliver({ kind: 'kororin', text: (made[made.length - 1] ?? '').slice(0, 200), url, refId: mine && /^[0-9a-f-]{36}$/.test(mine.id) ? mine.id : undefined }).catch(() => undefined);
    }
    insert(yes ? SENT : NOT_SENT);
    next();
  };

  const target = beat?.k === 'listen' ? ({ kimorin: 'story-kimorin', sunset: 'story-sunset', back: 'story-kimorin-back', mine: mineId } as Record<string, string | null>)[beat.id] ?? null : null;
  // the song plays to its end (the music dips under it), a breath, then the story goes on (QA 6 R11, P12)
  useEffect(() => {
    if (!waitSong) return;
    const at = i;
    let started = false;
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      duck(0.4);
      setTimeout(() => {
        setWaitSong(false);
        setI((n) => (n === at ? n + 1 : n));
      }, beatRef.current?.k === 'listen' && beatRef.current.id === 'sunset' ? 1500 : 800);
    };
    // a song that never starts (its voice did not load) does not hold the story (QA 7, R14); once it plays, its end
    // (or its stop) moves on, with a cap for a lost end event
    let cap = setTimeout(go, 3000);
    const off = subscribeAudio((st) => {
      if (st.playing) {
        if (!started) {
          clearTimeout(cap);
          cap = setTimeout(go, 20000);
        }
        started = true;
        duck(0.15);
      } else if (started) go();
    });
    return () => {
      off();
      clearTimeout(cap);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitSong]);

  const recording = beat?.k === 'recNormal';
  const coachWho: Who = beat?.k === 'say' ? beat.who : 'guide';
  const coachText =
    beat?.k === 'say'
      ? fill(beat.text)
      : beat?.k === 'note'
        ? fill(beat.text)
        : beat?.k === 'listen'
          ? waitSong ? '♪……' : '👆 光っているコロリンをタップ'
          : beat?.k === 'batiVoice'
            ? fill('いまの普通の声を、少し高くして、{bati}の声にもする？')
            : beat?.k === 'choice'
              ? ''
              : '';

  return (
    <>
    {/* in through black: the temple darkens (0.5 s), the world comes up from black (0.8 s); out the same way (QA 12 R38) */}
    <div className="pointer-events-none fixed inset-0 z-[260] bg-black" style={{ animation: leaving ? 'lessonOut 0.5s ease-in both' : 'lessonCurtain 1.3s ease-in-out both' }} aria-hidden />
    <style>{'@keyframes lessonCurtain{0%{opacity:0}38%{opacity:1}100%{opacity:0}}@keyframes lessonWorld{0%,37%{opacity:0}38%,100%{opacity:1}}@keyframes lessonOut{from{opacity:0}to{opacity:1}}'}</style>
    <div className="fixed inset-0 z-[150]" style={{ animation: 'lessonWorld 1.3s linear both' }}>
      <KororinWorld
        neoOnly
        roomOnly
        noBar
        extra={extra}
        highlightId={beat?.k === 'listen' && !waitSong ? target : null}
        closeSignal={closeSignal}
        singingId={waitSong ? target : null}
        flyId={flying ? mineId : null}
        events={{
          onListen: (p) => {
            if (beat?.k !== 'listen' || waitSong) return;
            if (p.id !== target) {
              setHint(beat.id === 'mine' ? fill('光っている、{neo}のコロリンを押してね') : '光っているコロリンを押してね');
              return;
            }
            setHint('');
            setWaitSong(true);
          },
        }}
        overlay={
          <>
            {star && <span className="pointer-events-none absolute bottom-[34%] left-1/2 z-[210] -translate-x-1/2 animate-[fadeUp_0.5s_ease-out] text-6xl text-amber-300 drop-shadow-[0_0_18px_rgba(255,214,120,0.9)]">★</span>}

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
            {(beat?.k === 'say' || beat?.k === 'note') && /並べると|これから生まれる/.test(beat.text) && myLook && (
              <div className="pointer-events-none absolute inset-x-0 top-[34%] z-[198] flex justify-center gap-4 px-6">
                {[...(beat.text.includes('並べると') ? [{ url: KIMORIN_DESIGNED, name: 'KIMORIN⭐︎' }] : []), { url: myLook, name: neo }].map((d, k, all) => (
                  <figure key={k} className="w-[42%] max-w-[170px] animate-[fadeUp_0.5s_ease-out] text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.url} alt="" className="aspect-square w-full rounded-full bg-white/90 object-contain p-1 shadow-[0_0_24px_rgba(255,220,150,0.6)]" style={k === all.length - 1 && !beat.text.includes('並べると') ? { animation: 'lookSpin 0.9s ease-out' } : undefined} />
                    <figcaption className="mt-2 text-[13px] font-bold text-white drop-shadow">{d.name}</figcaption>
                  </figure>
                ))}
                <style>{'@keyframes lookSpin{0%{transform:rotateY(0) scale(.6)}100%{transform:rotateY(720deg) scale(1)}}'}</style>
              </div>
            )}
            {beat?.k === 'note' && beat.text.endsWith('がダチになった') && (
              <DachiCard who={beat.text.startsWith('KIMORIN') ? 'kimorin' : 'inviter'} name={beat.text.startsWith('KIMORIN') ? 'KIMORIN⭐︎' : inviter} message={beat.text.startsWith('KIMORIN') ? undefined : inviterMessage} />
            )}
            {hint && <p className="pointer-events-none absolute inset-x-0 bottom-[calc(120px+env(safe-area-inset-bottom))] z-[205] text-center"><span className="rounded-full bg-[rgba(20,12,36,0.75)] px-4 py-2 text-[13px] text-amber-100">{hint}</span></p>}
            {flying && <span className="pointer-events-none absolute bottom-[calc(28px+env(safe-area-inset-bottom))] right-5 z-[206] animate-[fadeUp_0.5s_ease-out] rounded-full bg-white/90 px-3 py-1 text-[12px] font-bold text-[#5a3f8a]">🏠 部屋に、ころん</span>}

            {/* {bati} is the mic: a round button at the bottom */}
            {recording && (
              <div className="pb-safe absolute inset-x-0 bottom-0 z-[205] flex flex-col items-center px-5 pb-8">
                <p className="mb-3 max-w-sm rounded-2xl bg-[rgba(20,12,36,0.72)] px-4 py-2.5 text-center text-[14px] leading-relaxed text-white backdrop-blur-sm">
                  {beat?.k === 'recNormal' && beat.prompt === 'first' ? (
                    <>
                      石に、声を吹き込もう
                      <span className="mt-1 block text-[11px] text-white/75">思いつかない時は、紙の言葉を：{PAPER}</span>
                    </>
                  ) : (
                    <>
                      何を言うか迷ったら、お題から
                      <span className="mt-1 block text-[11px] text-white/75">{TOPICS.map((t) => `${t.t}（例「${t.ex}」）`).join('／')}</span>
                    </>
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
                    {busy ? `${bati}が、コロリンにしているよ…` : rec.on ? '話しおわったら、もう一度タップ' : micFail ? 'マイクが使えないみたい' : 'タップして、話してね'}
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

            {typing && beat?.k === 'recNormal' && (
              <div className="absolute inset-0 z-[230] flex items-end justify-center bg-black/50" onClick={() => setTyping(false)}>
                <div className="pb-safe w-full max-w-md rounded-t-3xl bg-white p-5 text-slate-800" onClick={(e) => e.stopPropagation()}>
                  <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && typed.trim() && !busy) void murmur(null, typed); }} maxLength={140} placeholder={beat.prompt === 'first' ? 'こんにちは' : 'いま思ったこと'} className="w-full border-b border-violet-300 py-2 text-[16px] outline-none" />
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
            {beat?.k === 'send' && <SendKororin made={made} inviter={inviter} onDone={sent} />}
            {beat?.k === 'fly' && (
              <div className="pb-safe absolute inset-x-0 bottom-0 z-[205] flex flex-col items-center px-5 pb-10">
                <button
                  onClick={() => {
                    setFlying(true);
                    setTimeout(() => {
                      setFlying(false);
                      next();
                    }, 1500);
                  }}
                  disabled={flying}
                  className="rounded-full border-2 border-amber-100 bg-gradient-to-b from-amber-300 to-orange-500 px-7 py-3 text-[15px] font-bold text-white shadow-lg active:scale-95 animate-[hintGlow_2.2s_ease-in-out_infinite]"
                >
                  🏠 自分の部屋に飛ばす
                </button>
              </div>
            )}

            {beat?.k === 'choice' && (
              <div className="pb-safe absolute inset-x-0 bottom-0 z-[205] flex flex-col items-end gap-2 px-4 pb-8">
                <Choice k={0} onClick={() => choose(true)}>
                  もうひとつ、つぶやいてみる
                </Choice>
                <Choice k={1} onClick={() => choose(false)}>
                  次へ
                </Choice>
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

/** D04-S005c: 〔届ける〕 → the kororin just made, 〔ダチへ〕 ({inviter}・KIMORIN⭐︎) already chosen → 〔届ける〕 (no mana). */
function SendKororin({ made, inviter, onDone }: { made: string[]; inviter: string; onDone: (sent: boolean) => void }) {
  const [open, setOpen] = useState(false);
  // after 〔届ける〕: the kororin rolls along the ring into the stars and splits into two lights, one for each dachi (QA 6 P8)
  const [flying, setFlying] = useState(false);
  if (flying)
    return (
      <div className="pointer-events-none absolute inset-0 z-[205]" aria-hidden>
        <span className="absolute bottom-[30%] left-1/2 h-14 w-14 rounded-full bg-gradient-to-b from-amber-300 to-orange-500 shadow-[0_0_24px_rgba(255,200,120,0.9)]" style={{ animation: 'sendRoll 1.1s ease-in forwards' }} />
        {[-1, 1].map((d) => (
          <span key={d} className="absolute left-1/2 top-[38%] h-4 w-4 rounded-full bg-amber-100 opacity-0 shadow-[0_0_18px_6px_rgba(255,230,160,0.9)]" style={{ animation: `sendLight${d < 0 ? 'L' : 'R'} 1.3s 1s ease-out forwards` }} />
        ))}
        <style>{'@keyframes sendRoll{0%{transform:translate(-50%,0)}100%{transform:translate(-50%,-26svh) rotate(720deg) scale(.4);opacity:.9}}@keyframes sendLightL{0%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-38vw,-30svh) scale(.5)}}@keyframes sendLightR{0%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(34vw,-34svh) scale(.5)}}'}</style>
      </div>
    );
  if (!open)
    return (
      <div className="pb-safe absolute inset-x-0 bottom-0 z-[205] px-5 pb-8">
        <DecisionButton onClick={() => setOpen(true)}>届ける</DecisionButton>
        <button onClick={() => onDone(false)} className="mt-3 w-full text-center text-[13px] text-white/70">
          今はいい
        </button>
      </div>
    );
  const last = made[made.length - 1];
  return (
    <div className={sheet}>
      {last && <p className="rounded-2xl border border-white/20 bg-white/5 px-4 py-2.5 text-[14px]">🪐 {last.length > 40 ? `${last.slice(0, 40)}…` : last}</p>}
      <p className="mt-3 text-[13px] text-white/70">行き先</p>
      <p className="mt-1 rounded-2xl border border-amber-200 bg-amber-200/15 px-4 py-2.5 text-center text-[14px] font-bold">✓ ダチへ（{inviter}・KIMORIN⭐︎）</p>
      <div className="mt-4">
        <DecisionButton
          onClick={() => {
            setFlying(true);
            setTimeout(() => onDone(true), 2400);
          }}
        >
          届ける
        </DecisionButton>
      </div>
      <button onClick={() => onDone(false)} className="mt-3 w-full text-center text-[13px] text-white/55">
        やめる
      </button>
    </div>
  );
}
