'use client';

import type { TalkFace, TalkIn, TalkMotion, TalkShape } from '@obolo/shared';
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { TalkComposer } from '@/components/talk/TalkComposer';
import { TalkScene, type TalkItem, type TalkPerson } from '@/components/talk/TalkScene';
import { BATI_COLOR, colorOf, DACHI_COLOR, PLACE_BG, SELF_COLOR } from '@/lib/talk/looks';
import { castLook, DEMO_GROUP_SEEDS } from '@/lib/talk/demoLooks';

/**
 * /kakunin-5798f28713/talk — 隣に並ぶトーク (M-R232〜M-R235) alive, with stand-in looks (no generation): the client
 * judges the motion here — breathing, sway, blink, lip flap, idle, listening, thinking, reactions — and the layouts
 * (1, 2, 3+, 9+ messages, a long reply, a card, the keyboard, a ダチ voice message, groups of 3 and 7).
 * ?s=<scene> opens one; ?bare=1 hides the panel (screenshots).
 */
const SCENES = ['live', '1', '2', '3', '9', 'past', 'long', 'card', 'kb', 'dachi', 'g3', 'g7'] as const;
type Scene = (typeof SCENES)[number];
const LABEL: Record<Scene, string> = { live: '話してみる', '1': '1つ', '2': '2つ', '3': '3つ', '9': '9つ以上', long: '長い返事', card: 'カード', kb: 'キーボード', past: '過去に戻る', dachi: 'ダチの声', g3: '3人', g7: '7人' };

/** the prototype's talk (design/talk/proto.html): what was said before (on the ring), then the lines played in a row */
type Said = [string, [string, TalkFace, TalkMotion | '', { in?: TalkIn; shape?: TalkShape }?][]];
const HISTORY: [string, string][] = [['bati', 'おはよ、ネオ！　よく眠れた？'], ['me', 'おはよう。ちょっと寝坊した'], ['bati', '今日も月は静かだね〜'], ['me', 'さっきのコロリン、作ったよ'], ['bati', 'いい声だった！　ほんとに！']];
const SCRIPT: Said[] = [
  ['me', [['ねえウニュ、明日の土星ってどんなとこ？', 'normal', '']]],
  ['bati', [['土星はね、コロリンたちが**レコードの上でサイファー**してる星だよ！', 'smile', 'hop'], ['ネオのつぶやきも、きっと回ってるはず！', 'smile', '']]],
  ['me', [['え、[[赤:マジで！？]]　見てみたい！', 'surprised', 'hop', { in: 'slam', shape: 'burst' }]]],
  ['bati', [['^^でしょでしょ！^^', 'smile', 'hop', { in: 'shake' }], ['……でも、ボク、ちょっと緊張するかも？', 'thinking', 'tilt', { in: 'slow', shape: 'cloud' }]]],
  ['me', [['ウニュも緊張するんだ笑', 'smile', '']]],
  ['bati', [['[[かわいい:えへへ]]……バレた？', 'shy', '', { in: 'slow', shape: 'whisper' }]]],
  ['me', [['明日、一緒に行こうな。', 'smile', '']]],
  ['bati', [['うん！　[[金:約束]]だよ、ネオ！', 'smile', 'hop', { in: 'shake' }]]],
];
const said = ([who, parts]: Said, k: number): TalkItem => ({ id: `s${k}`, who, text: parts.map((p) => p[0]).join(''), faces: parts.map(([, face, motion, st]) => ({ face, ...(motion ? { motion } : {}), ...(st ?? {}) })) });

const LINES: [string, string, TalkFace?, TalkMotion?][] = [
  ['bati', 'おはよう！ 今日はなにする？', 'smile', 'hop'],
  ['me', '月のこと、もっと知りたい'],
  ['bati', 'いいね！ 月は、地球のまわりを27日で回ってるんだよ。', 'smile'],
  ['me', 'うさぎは本当にいるの？'],
  ['bati', 'えっ、うさぎ！？ 模様がうさぎに見えるんだって！', 'surprised', 'lean'],
  ['me', 'へえ、おもしろい'],
  ['bati', 'でしょ！ ほかにも聞いて！', 'smile', 'sway'],
  ['me', '土星の輪はなにでできてる？'],
  ['bati', '氷とちりのつぶだよ。大きいのは家くらい！', 'shy'],
  ['me', 'すごい！'],
  ['bati', 'ボクも、いつか見に行きたいな。', 'normal', 'nod'],
];
/** M-R238: lines whose faces change sentence by sentence */
const SAMPLES = ['やったー！ でも、ちょっと不安かも……', '土星の輪って、なに？', 'ふふ、ありがとう笑'];
const REPLIES = ['えっ、本当！？ すごいね！ ……でも、むりはしないでね。', 'いい質問だね！ 氷とちりのつぶなんだよ。大きいのは家くらいあるんだって！', 'うーん、どうかな？ ボクにも、わからないや……。 でも、いっしょに調べよう！'];
const LONG_TEXT =
  'ビッグバンは、だいたい138億年前に起きたと考えられているよ。はじめは、とても小さくて、とても熱いところから、宇宙がいっきにふくらんだんだって。そのあと、だんだん冷えて、星や銀河ができていったんだ。いまも宇宙はふくらみつづけていて、遠くの銀河ほど、速く遠ざかっているんだよ。夜空の星の光は、何年も、何万年も前に出た光なんだ。だから、星を見るのは、むかしの宇宙を見ていることになるんだね。';

export default function TalkReview() {
  return (
    <Suspense>
      <Review />
    </Suspense>
  );
}

function Review() {
  const q = useSearchParams();
  const [scene, setScene] = useState<Scene>((SCENES as readonly string[]).includes(q.get('s') ?? '') ? (q.get('s') as Scene) : 'live');
  const bare = q.get('bare') === '1';
  return (
    <main className="mx-auto flex h-svh max-w-xl flex-col overflow-hidden bg-[#05060f] text-amber-50" style={{ fontFamily: '"Shippori Mincho", "Hiragino Mincho ProN", serif' }}>
      {!bare && (
        <div className="z-30 flex shrink-0 gap-1 overflow-x-auto px-2 py-1.5 text-[11px]">
          <Link href="/kakunin-5798f28713" className="shrink-0 px-1 text-white/50">
            ←
          </Link>
          {SCENES.map((s) => (
            <button key={s} onClick={() => setScene(s)} className={`shrink-0 rounded-full px-2.5 py-1 ${s === scene ? 'bg-amber-200 text-[#2b1b06]' : 'bg-white/10'}`}>
              {LABEL[s]}
            </button>
          ))}
        </div>
      )}
      <Play key={scene} scene={scene} bare={bare} />
    </main>
  );
}

function Play({ scene, bare }: { scene: Scene; bare?: boolean }) {
  // the client's talk cast (public/talk, from design/talk): ネオ, ウニュ the {bati}, アポロ the dachi
  const me: TalkPerson = useMemo(() => ({ id: 'me', name: 'ネオ', look: castLook('user'), color: SELF_COLOR, self: true }), []);
  const bati: TalkPerson = useMemo(() => ({ id: 'bati', name: 'ウニュ', look: castLook('bati'), color: BATI_COLOR }), []);
  const kimorin: TalkPerson = useMemo(() => ({ id: 'kimorin', name: 'アポロ', look: castLook('friend'), color: DACHI_COLOR }), []);
  const group = scene === 'g3' || scene === 'g7';
  const people: TalkPerson[] = group
    ? [...DEMO_GROUP_SEEDS.slice(0, scene === 'g3' ? 2 : 6).map((s, k) => ({ id: `p${k}`, name: ['アポロ', 'ウニュ', 'ミナ', 'ポコ', 'ソラ', 'テト'][k], look: castLook((['friend', 'bati', 'user'] as const)[k % 3], `g${k}`), color: colorOf(s, k) })), me]
    : scene === 'dachi'
      ? [kimorin, me]
      : [bati, me];

  const initial = (): TalkItem[] => {
    const pick = (n: number) => LINES.slice(0, n).map(([who, text, face, motion], k) => ({ id: `l${k}`, who, text, face, motion }));
    // the prototype's talk: the ring holds what was said before, the script plays in a row (taps go on)
    if (scene === 'live') return [...HISTORY.map(([who, text], k) => ({ id: `h${k}`, who, text })), ...SCRIPT.map(said)];
    if (scene === '1') return pick(1);
    if (scene === '2') return pick(2);
    if (scene === '3') return pick(3);
    if (scene === '9' || scene === 'past' || scene === 'kb') return pick(11);
    if (scene === 'long') return [...pick(5), { id: 'long', who: 'bati', text: LONG_TEXT, face: 'smile' }];
    if (scene === 'card')
      return [
        ...pick(4),
        { id: 'ask', who: 'me', text: '月の絵を見せて' },
        {
          id: 'card',
          who: 'bati',
          text: '月の絵を描いてみたよ！',
          face: 'smile',
          motion: 'hop',
          card: {
            label: '月の絵',
            // eslint-disable-next-line @next/next/no-img-element
            thumb: <img src="/onboarding/s/moon-surface.jpg" alt="" className="aspect-[4/3] w-full object-cover" />,
            full: (
              <div className="overflow-hidden rounded-2xl border border-amber-200/30 bg-[#120c1c]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/onboarding/s/moon-surface.jpg" alt="" className="w-full" />
                <div className="flex gap-2 p-3 text-[12px]">
                  <span className="rounded-full border border-amber-200/40 px-3 py-1.5">再生</span>
                  <span className="rounded-full border border-amber-200/40 px-3 py-1.5">やり直し</span>
                  <span className="rounded-full border border-amber-200/40 px-3 py-1.5">星へ飛ばす</span>
                </div>
              </div>
            ),
          },
        },
      ];
    if (scene === 'dachi')
      return [
        { id: 'd0', who: 'kimorin', text: 'ういっす' },
        { id: 'd1', who: 'kimorin', text: 'よう！　今日の曲、聴いたぞ。サビで鳥肌が立った……。', voice: { url: '/onboarding/kimorin-mercury-1.m4a', seconds: 4 }, faces: [{ face: 'smile' }, { face: 'surprised', motion: 'lean' }] },
        { id: 'd2', who: 'me', text: 'ほんと！？　うれしい！', voice: { url: '/onboarding/kimorin-mercury-2.m4a', seconds: 3 }, faces: [{ face: 'smile', motion: 'hop' }] },
        { id: 'd3', who: 'kimorin', text: '……[[しんみり:鍛えすぎたか]]。いや、!!むしろ見せたい!!。', voice: { url: '/onboarding/kimorin-mercury-1.m4a', seconds: 5 }, faces: [{ face: 'normal' }, { face: 'thinking', motion: 'tilt' }] },
      ];
    if (group) return people.slice(0, -1).flatMap((p, k) => [{ id: `g${k}`, who: p.id, text: ['やっほー！', 'こんばんは！', '今日の曲、聞いた？', 'うん、よかった！', '次は木星だね', 'たのしみ！'][k % 6], face: 'smile' as TalkFace }]).concat([{ id: 'gm', who: 'me', text: 'みんな、おつかれさま！', face: 'smile' }]);
    return pick(2);
  };
  const [items, setItems] = useState<TalkItem[]>(initial);
  const [thinking, setThinking] = useState<string | null>(null);
  const [state, setState] = useState({ listening: false, keyboard: scene === 'kb' });

  const [turn, setTurn] = useState(0);

  const partner = people[0].id;
  const send = async (text: string) => {
    setItems((l) => [...l, { id: `u${Date.now()}`, who: 'me', text }]);
    setThinking(partner);
    await new Promise((r) => setTimeout(r, 1800));
    setThinking(null);
    // M-R238: the faces come from the words, sentence by sentence (here the rules; in the app the reply's own call)
    setItems((l) => [...l, { id: `r${Date.now()}`, who: partner, text: REPLIES[turn % REPLIES.length] }]);
    setTurn((t) => t + 1);
  };

  return (
    <>
      <TalkScene
        people={people}
        items={items}
        thinking={thinking}
        listening={state.listening}
        keyboard={state.keyboard}
        place={PLACE_BG.moon}
        group={group ? { name: '土星のサイファー仲間', count: people.length } : undefined}
        top={0}
        // M-R239: the ダチ scene opens with two unread lines (the last read one and the unread ones play in a row)
        unreadFrom={scene === 'dachi' ? 2 : scene === 'live' ? HISTORY.length : undefined}
        bar={{ title: group ? '' : scene === 'dachi' ? 'アポロ（ダチ）' : 'ウニュ（バティ）', onBluena: () => undefined }}
        composer={<TalkComposer placeholder="ことばで話す" onSend={send} onState={(s) => setState((o) => (scene === 'kb' ? { ...s, keyboard: true } : s))} initial={scene === 'kb' ? '土星の輪は' : ''} startTyping={scene === 'kb'} />}
      />
      {scene === 'live' && !bare && (
        <div className="z-30 flex shrink-0 flex-wrap gap-1 px-2 py-1 text-[10.5px]">
          <span className="text-white/50">言ってみる：</span>
          {SAMPLES.map((t) => (
            <button key={t} onClick={() => void send(t)} disabled={!!thinking} className="rounded-full bg-white/10 px-2 py-0.5 disabled:opacity-40">
              {t}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
