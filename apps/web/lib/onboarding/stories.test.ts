import { formatMana, JOURNEY_PAYMENT, MAKE_COST } from '@obolo/shared';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hasMotion, PLANNED_MOTIONS } from './media';
import { DAY_TITLE, labelIndex, type Step } from './script';
import { FOREGROUNDS, SHOTS } from './shots';
import { AFTER_DAYS } from './after';
import { SYS002_ALONE } from './sys002';
import { DEFAULT_SKIP_LABEL, PREVIEW_ONLY, STORIES, STORIES_NEW_HOMES } from './stories';

const all = { ...STORIES, ...PREVIEW_ONLY };
const kinds = (steps: Step[]) => steps.map((s) => s.t);
/** stills queued for Seedream (saved under public/onboarding/<dir>/<id>.jpg once painted) */
const artQueue = JSON.parse(readFileSync('../../design/story-art-queue.json', 'utf8')) as { dir: string; items: { id: string }[] };
const queuedStills = new Set(artQueue.items.map((x) => `${artQueue.dir.replace(/^onboarding\//, '')}/${x.id}`));

describe('all day scripts', () => {
  for (const [day, story] of Object.entries(all)) {
    it(`day ${day}: labels resolve, ends with end, every picture exists`, () => {
      const steps = story.steps;
      for (const s of steps) {
        if (s.t === 'goto') expect(() => labelIndex(steps, s.id)).not.toThrow();
        if (s.t === 'pause') expect(() => labelIndex(steps, s.resume)).not.toThrow();
        if (s.t === 'age') expect(() => labelIndex(steps, s.skip)).not.toThrow();
        if (s.t === 'choice') for (const o of s.options) if (o.goto) expect(() => labelIndex(steps, o.goto!)).not.toThrow();
        // a still exists, or is queued to be painted (design/story-art-queue.json)
        if (s.t === 'still') expect(existsSync(`public/onboarding/${s.image}.jpg`) || queuedStills.has(s.image), s.image).toBe(true);
        // days 1–3 are built for real: every motion exists or is planned and being made (PLANNED_MOTIONS)
        if (Number(day) <= 3 && (s.t === 'video' || s.t === 'loop' || s.t === 'bgvideo')) expect(hasMotion(s.motion) || PLANNED_MOTIONS.has(s.motion), String(s.motion)).toBe(true);
      }
      expect(steps[steps.length - 1]).toEqual({ t: 'end' });
    });
  }

  it('the first journey is eleven days (M-R341: 8 Pluto, 9 Neptune, 10 Uranus, 11 the Sun); only day 1 has its own skip label (the button itself: journeyWaitSkippable, client 2026-11-28)', () => {
    expect(Object.keys(STORIES).map(Number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(JOURNEY_PAYMENT).toBe(11);
    const labels = Object.fromEntries(Object.entries(STORIES).map(([d, s]) => [d, s.skipLabel]));
    expect(labels).toEqual({ 1: DEFAULT_SKIP_LABEL, 2: undefined, 3: undefined, 4: undefined, 5: undefined, 6: undefined, 7: undefined, 8: undefined, 9: undefined, 10: undefined, 11: undefined });
    expect(DEFAULT_SKIP_LABEL).toBe('明日まで待てない');
    expect(STORIES[JOURNEY_PAYMENT].steps.some((s) => s.t === 'order')).toBe(true);
  });
});

describe('day 1 (story 2026-10-14)', () => {
  const steps = STORIES[1].steps;
  it('asks the name (no age), and MONBAN offers the ticket; the riddles, the gem and the letter are not on day 1 (story 2026-10-15)', () => {
    const t = kinds(steps);
    expect(t).not.toContain('age');
    expect(t).not.toContain('riddles');
    expect(t).not.toContain('letter');
    const c = steps.find((s) => s.t === 'choice' && s.key === 'f_d01_ticket');
    expect(c?.t === 'choice' && c.options.map((o) => o.label)).toEqual(['切符を受け取る', '受け取らない']);
    // the inviter's own words are on the invitation card itself (set in code, only when written)
    expect(steps.some((s) => s.t === 'invitation')).toBe(true);
  });
  it('goes from the name straight on to 「ここは、宇宙秘密結社だ。」 (client 2026-10-15)', () => {
    const n = steps.findIndex((s) => s.t === 'name');
    expect(steps.slice(n + 1, n + 3).map((s) => (s.t === 'say' ? s.text : s.t))).toEqual(['そうか、いいな。', 'ここは、宇宙秘密結社だ。']);
  });
  it('the client corrections of 2026-10-20: the gate line while it opens, the temple title, MONBAN before the ticket', () => {
    const g = steps.findIndex((s) => s.t === 'bgvideo' && s.motion === 11);
    expect(steps[g + 1]).toMatchObject({ t: 'say', text: '門をくぐり、地球の神殿に行け…。' });
    const v12 = steps.find((s) => s.t === 'video' && s.motion === 12);
    expect(v12?.t === 'video' && v12.captions?.[0].text).toBe('地球の神殿に着いた');
    const k = steps.findIndex((s) => s.t === 'say' && s.text === 'それより先はObolo Orderしか知ることができない。');
    expect(steps[k + 1]).toMatchObject({ t: 'say', text: 'ただ、お前はObolo Orderに招待されてここに来た。' });
    expect(steps[k + 2]).toMatchObject({ t: 'say', text: 'だから知る権利がある。' });
    // the loops behind MONBAN no longer fade to black where they loop
    expect(steps.some((s) => s.t === 'loop' && (s.motion === 9 || s.motion === 28))).toBe(false);
  });
  it('has no guide KIMORIN on day 1', () => {
    expect(steps.some((s) => s.t === 'say' && s.who === 'KIMORIN')).toBe(false);
    expect(steps.some((s) => s.t === 'say' && /案内人/.test(s.text))).toBe(false);
  });
});

describe('day 2: KIMORIN, then the Moon (story 2026-10-14)', () => {
  const steps = STORIES[2].steps;
  it('KIMORIN appears behind you at the gate, as an invited guest', () => {
    const first = steps.findIndex((s) => s.t === 'say' && s.who === 'KIMORIN');
    expect(steps[first]).toMatchObject({ text: '待ちなさい。' });
    expect(steps.some((s) => s.t === 'say' && s.text.includes('天才発明家'))).toBe(true);
  });
  it('the gate (M-R334): MONBAN out of the smoke, the ticket shown, the gate opens, 「地球の神殿に行け…」 — and only then 「待ちなさい。」', () => {
    const at = (f: (s: Step) => boolean) => steps.findIndex(f);
    const say = (text: string) => at((s) => s.t === 'say' && s.text === text);
    const line = at((s) => s.t === 'loop' && s.motion === 'd1-gate-loop');
    const monban = at((s) => s.t === 'video' && s.motion === 'd1-monban');
    const ask = say('来たか…切符は持ってきたか？');
    const show = at((s) => s.t === 'action' && s.label === '切符を見せる');
    const give = at((s) => s.t === 'video' && s.motion === 'd2-ticket-give');
    const open = at((s) => s.t === 'bgvideo' && s.motion === 11);
    const go = say('地球の神殿に行け…結社の奥の大広間に、ロケットがある');
    const wait = say('待ちなさい。');
    const who = say('誰だお前…。');
    const invite = say('……なんだ、招待か。');
    const through = at((s) => s.t === 'still' && s.shot === 'gate-through');
    const into = at((s) => s.t === 'still' && s.image === 's/d2-hall-dark-kimorin');
    expect([line, monban, ask, show, give, open, go, wait, who, invite, through, into].every((x, k, a) => x > -1 && (k === 0 || x > a[k - 1]))).toBe(true);
    // his entrance is held only briefly: one still after the look back, then he talks (the walk-up and the long reveal are cut)
    expect(steps.some((s) => s.t === 'video' && (s.motion === 'd2-kimorin-walkup' || s.motion === 'd2-reveal'))).toBe(false);
    const between = steps.slice(wait + 1, say('なんですか、この怪しい建物は。'));
    // the look back is a whip pan onto the still (client 2026-11-28: no generated video from here to the rocket)
    expect(between.filter((s) => s.t === 'video' || s.t === 'bgvideo')).toEqual([]);
    expect(between.some((s) => s.t === 'still' && s.shot === 'reveal-whip')).toBe(true);
    expect(between.filter((s) => s.t === 'wait').every((s) => s.t === 'wait' && s.s <= 1)).toBe(true);
    // the crane's flight to HQ is back before the gate (client 2026-11-28), after the ticket's 〔本部へ向かう〕
    const fly = at((s) => s.t === 'video' && s.motion === '5-f');
    const arrive = at((s) => s.t === 'video' && s.motion === 'd1-arrive');
    expect(fly).toBeGreaterThan(at((s) => s.t === 'action' && s.label === '本部へ向かう'));
    expect(arrive).toBe(fly + 2);
    expect(arrive).toBeLessThan(line);
  });
  it('「待ちなさい。」 to 〔ロケットに乗る〕 with pictures (client 2026-11-28): no video, every shot exists, no stairs down, OBOLON / MONBAN over KIMORIN\'s shoulder', () => {
    const from = steps.findIndex((s) => s.t === 'say' && s.text === '待ちなさい。');
    const to = steps.findIndex((s) => s.t === 'action' && s.label === 'ロケットに乗る');
    const span = steps.slice(from, to + 1);
    // the one exception (client playtest 2026-11-28): the universe in the Earth temple is day 1's films 14 → 15, with
    // KIMORIN's back in front
    expect(span.filter((s) => s.t === 'video' || s.t === 'bgvideo' || s.t === 'loop')).toEqual([{ t: 'bgvideo', motion: 14, then: [15] }]);
    const sky = span.findIndex((s) => s.t === 'bgvideo');
    expect(span[sky - 1]).toEqual({ t: 'fore', layers: 'kimorin-watch' });
    for (const l of Object.values(FOREGROUNDS).flat()) expect(existsSync(`public/onboarding/${l.src}.webp`), l.src).toBe(true);
    for (const s of span) if (s.t === 'still' && s.shot) expect(SHOTS[s.shot], s.shot).toBeDefined();
    for (const s of Object.values(SHOTS)) for (const l of s.layers ?? []) expect(existsSync(`public/onboarding/${l.src}.webp`), l.src).toBe(true);
    expect(JSON.stringify(span)).not.toMatch(/d2-floor-open|d2-descend|launch-pit|monban-pit|obolon-pit/);
    // on the plaza: OBOLON's and MONBAN's lines over KIMORIN's shoulder, KIMORIN's on the reverse
    const shotOf = (k: number) => {
      for (let j = k; j >= 0; j--) if (steps[j].t === 'still') return (steps[j] as Extract<Step, { t: 'still' }>).shot;
    };
    const plaza = steps.findIndex((s) => s.t === 'still' && s.shot === 'plaza-wide');
    for (let k = plaza; k < to; k++) {
      const s = steps[k];
      if (s.t !== 'say') continue;
      const shot = shotOf(k) ?? '';
      if (s.who === 'MONBAN') expect(shot, s.text).toMatch(/^(ots-|gem-monban)/);
      if (s.who === 'OBOLON') expect(shot, s.text).toMatch(/^(ots-|plaza-low)/);
      if (s.who === 'KIMORIN') expect(shot, s.text).toMatch(/^(reverse|gem-kimorin|plaza-after)$/);
    }
  });
  it('the launch pit (M-R334): 「キモリンのもある」, 「…月へ！」, and MONBAN no longer says 「月だ」', () => {
    const says = steps.filter((s): s is Extract<Step, { t: 'say' }> => s.t === 'say');
    expect(says.some((s) => s.who === 'MONBAN' && s.text === 'キモリンのもある')).toBe(true);
    expect(says.some((s) => s.text === 'お前のもある')).toBe(false);
    expect(says.some((s) => s.who === 'KIMORIN' && s.text === 'それでは私たちも行きましょう。。。月へ！')).toBe(true);
    expect(says.some((s) => s.text === '月だ')).toBe(false);
  });
  it('the Moon temple is the short one (M-R348): 「来たか」, his lab boast, magic, the partner', () => {
    const k = steps.findIndex((s) => s.t === 'say' && s.text === '、、、来たか。');
    const says = steps.slice(k).filter((s): s is Extract<Step, { t: 'say' }> => s.t === 'say').slice(0, 5).map((s) => `${s.who}:${s.text}`);
    expect(says).toEqual([
      'OBOLON:、、、来たか。',
      'KIMORIN:月の神殿ですか。まぁ、私の研究所の方が、広いですけど。',
      'OBOLON:この月の神殿なら、、、魔法を、唱えられる。',
      'KIMORIN:え？　魔法？',
      'OBOLON:それでは、、、魔法の相方を、誕生させよう。',
    ]);
    // the trick question, the SNS talk and the second press are gone; Pinpon 2.5 is shown at the gate
    expect(JSON.stringify(steps)).not.toMatch(/引っかけ問題|SNSに書いても|12回目です|最初は、いっぱい望みすぎないほうがいい/);
    const gate = steps.findIndex((s) => s.t === 'say' && s.text === '見てわかりませんか？　どっからどう見ても、、、キリンです。');
    expect(steps[gate + 2]).toEqual({ t: 'se', sound: 'pinpon' });
    expect(steps.slice(gate, gate + 8).filter((s) => s.t === 'still').map((s) => (s as { image: string }).image)).toEqual(['s/pp-hand', 's/pp-head']);
  });
  it('the egg: the visitor picks one, KIMORIN⭐︎ gets the other; ♀ / ♂ is not told before the birth (M-R334)', () => {
    const c = steps.find((s) => s.t === 'choice' && s.key === 'egg');
    expect(c?.t === 'choice' && c.options.map((o) => o.label)).toEqual(['月のたまご', '太陽のたまご']);
    const k = steps.findIndex((s) => s.t === 'choice' && s.key === 'egg');
    expect(steps[k - 1]).toEqual({ t: 'notice', text: 'どちらのたまごからも、旅の相方が生まれます。生まれたあとの姿は、魔法で自由に変えられます' });
    // nothing of the day says girl-leaning / boy-leaning, and no line or note carries the mark (it is drawn by the screen)
    expect(JSON.stringify(steps)).not.toMatch(/女の子寄り|男の子寄り|♀|♂/);
    expect(steps.filter((s) => s.t === 'set' && s.key === 'f_egg').map((s) => s.t === 'set' && s.value)).toEqual(['moon', 'sun']);
    const b = steps.filter((s): s is Extract<Step, { t: 'branch' }> => s.t === 'branch' && s.key === 'f_egg');
    // the gem, KIMORIN⭐︎'s egg (its pinpon and うんちピンポンくん), then the visitor's own egg hatching (M-R207: on day 2 again)
    expect(b.map((x) => x.cases.sun)).toEqual(['gem-sun', 'pinpon-earth', 'unpon-earth', 'hatch-sun']);
    // M-R218 / M-R217: the shell becomes a small egg, then the card
    const t = steps.map((s) => s.t);
    expect(steps.findIndex((s) => s.t === 'fx' && s.fx === 'shell-egg')).toBeGreaterThan(t.indexOf('hatch'));
    expect(t.indexOf('baticard')).toBeGreaterThan(t.indexOf('batiname'));
  });
  it('the order of the Moon (M-R334): 愛 → the food → うんち → うんちピンポンくん → {name}’s food → {bati} → its name → the voice → the bowl → 進化 → the own look → the dragon → the names → the chat', () => {
    const t = kinds(steps);
    expect(t).not.toContain('riddles');
    const scenes = steps.filter((s): s is Extract<Step, { t: 'scene' }> => s.t === 'scene').map((s) => s.id);
    expect(scenes.slice(scenes.indexOf('D03-S003'))).toEqual(['D03-S003', 'D03-S005', 'D03-S005b', 'D03-S004', 'D03-S004b', 'D03-S004c', 'D03-S008', 'D03-S009']);
    const at = (f: (s: Step) => boolean) => steps.findIndex(f);
    const say = (text: string) => at((s) => s.t === 'say' && s.text === text);
    const evolve = (who: 'bati' | 'self') => at((s) => s.t === 'evolve' && s.who === who);
    const order = [
      at((s) => s.t === 'caption' && s.text === 'マナジェムを手に入れた'),
      say('好きな食べ物を、教えてほしい。、、、まずは、KIMORINだ。'),
      say('……うんち。'),
      say('うんちピンポンくん！'),
      say('次は、、、{name}だ。好きな食べ物は？'),
      t.indexOf('egg'),
      t.indexOf('hatch'),
      t.indexOf('batiname'),
      t.indexOf('baticard'),
      say('{bati}は、、、お前の声を、覚える。'),
      say('だから、、、お前の声を、聞かせてやれ。'),
      t.indexOf('eggvoice'),
      say('{name}の声、おぼえたよ！'),
      say('魔法を唱える時は、、、この器の前に、来るんだ。'),
      say('まず、、、{bati}の姿と、お前の姿を、魔法で、変えるんだ。'),
      say('決まりは、ひとつだけ。、、、今の姿から、どう変えるか、を伝えろ。'),
      evolve('bati'),
      say('これが、ぼくの姿だね！'),
      say('、、、次は、お前の番だ。'),
      t.indexOf('pick4'),
      say('ここからは、、、{bati}の時と、同じだ。今の姿から、どう変えるか、を伝えろ。'),
      evolve('self'),
      at((s) => s.t === 'video' && s.motion === 'd2-dragon'),
      t.indexOf('neoname'),
      say('ねえ、{neo}！　ボクたち、新しい姿になったね！'),
      t.indexOf('batitalk'),
    ];
    expect(order.every((x, k, a) => x > -1 && (k === 0 || x > a[k - 1])), JSON.stringify(order)).toBe(true);
    // M-R348: the food question right after the mana gem (no 「ア、、、アイ//？」 / 「愛、と言っても…」); 「何と話しかければ」 is gone
    expect(steps.slice(say('この卵にマナと、愛が、加われば、、、お前だけの旅の相方、バティが、生まれる。') + 1, say('好きな食べ物を、教えてほしい。、、、まずは、KIMORINだ。')).filter((s) => s.t === 'say')).toEqual([]);
    expect(JSON.stringify(steps)).not.toMatch(/なんて話しかければいいか|たまごに、、、声を、聞かせてやれ|相方は、お前たちの声から、生まれる/);
    // the animal question and the redraw of the old look screen are gone
    expect(t).not.toContain('look');
    expect(JSON.stringify(steps)).not.toMatch(/何の動物に、アレンジする|好きな動物を、思い浮かべろ/);
    // Bluena is given on the morning of day 3 (M-R207/M-R212)
    expect(steps.some((s) => s.t === 'say' && s.text.includes('作るのは、月。しまうのは、Bluena。'))).toBe(false);
  });
  it('the two rounds (M-R334): the choices, OBOLON’s last line, {bati}’s spell; the four pictures before the own round', () => {
    const rounds = steps.filter((s): s is Extract<Step, { t: 'evolve' }> => s.t === 'evolve');
    expect(rounds.map((r) => [r.who, r.counter, r.ok, r.more])).toEqual([
      ['bati', '進化', '{bati}の姿はこれだ', '進化させる'],
      ['self', '変身', 'この姿にする', '変身させる'],
    ]);
    for (const r of rounds) expect(r.limit).toEqual({ t: 'say', who: 'OBOLON', text: '、、、今日の魔法は、ここまでだ。' });
    expect(rounds[0].spell).toEqual({ t: 'say', who: 'バティ', text: 'いくよ！' });
    const four = steps.find((s): s is Extract<Step, { t: 'pick4' }> => s.t === 'pick4');
    expect(four?.spell).toEqual({ t: 'say', who: 'バティ', text: 'いくよ、{name}！' });
    // what the confirmed look took is told right after it (the profile look's price), not at the end of the day
    const k = steps.findIndex((s) => s.t === 'evolve' && s.who === 'self');
    expect(steps[k + 1]).toMatchObject({ t: 'notice' });
    const told = steps[k + 1];
    expect(told.t === 'notice' && told.text).toBe(`この姿が、あなたのプロフィールになった｜マナジェム −${formatMana(MAKE_COST.profileLook)}（表情・後ろ姿・星ごとの姿を作る分）`);
    // OBOLON says the eight (M-R338) before each round
    expect(steps[steps.findIndex((s) => s.t === 'evolve' && s.who === 'bati') - 2]).toEqual({ t: 'say', who: 'OBOLON', text: '魔法は、、、8回まで、唱えられる。変えたい所を、、、1か所ずつ、変えていくのがいい。' });
    expect(steps[k - 2]).toEqual({ t: 'say', who: 'OBOLON', text: '8回まで、、、変身できる。変えたい所を、、、1か所ずつ、変えていくのがいい。' });
    expect(steps.slice(steps.findIndex((s) => s.t === 'scene' && s.id === 'D03-S009')).some((s) => s.t === 'notice')).toBe(false);
  });
  it("M-R338: no restyle in the chat any more — the looks stay until Obolo Order; then OBOLON's lookups and the free questions", () => {
    const t = kinds(steps);
    expect(t).not.toContain('magic');
    expect(t).not.toContain('batilook');
    expect(JSON.stringify(steps)).not.toMatch(/これで、決まり？|ボクの見た目も、\{neo\}の好きにして|この姿、気に入った/);
    const k = steps.findIndex((s) => s.t === 'scene' && s.id === 'D03-S008');
    const first = steps.slice(k).find((s) => s.t === 'say');
    expect(first).toEqual({ t: 'say', who: 'バティ', text: 'ねえ、{neo}！　ボクたち、新しい姿になったね！' });
    expect(steps.slice(k).find((s) => s.t === 'notice')).toEqual({ t: 'notice', text: '{neo}と{bati}の姿は、しばらくこのまま。Obolo Orderになったら、マナを使って、今の姿から変えられます' });
    expect(steps.some((s) => s.t === 'set' && s.key === 'f_d03_bati_look' && s.value === 'true')).toBe(true);
    const research = steps.findIndex((s) => s.t === 'say' && s.text === '{bati}は、、、マナの力で、調べるのが、得意だ。');
    expect(research).toBeGreaterThan(k);
    expect(research).toBeLessThan(t.indexOf('batitalk'));
    const wait = steps.findIndex((s) => s.t === 'say' && s.text === '今日は、、、月で、好きに過ごせ。{bati}と、いくらでも、話していい。');
    expect(wait).toBeGreaterThan(t.indexOf('batitalk'));
    expect(STORIES[2].waitNote).toBe('明日、星へ遊びに行くまでの24時間は、{bati}と好きなだけ話せます'); // M-R340: no look change before Order
  });
  it("day 1's countdown waits for the ticket; the other days keep the default words (client 2026-11-28)", () => {
    expect(STORIES[1].untilText).toBe('宇宙行きの切符が届くまで');
    for (const d of Object.keys(STORIES).map(Number)) if (d !== 1) expect(STORIES[d].untilText).toBeUndefined();
  });
  it('shows no day numbers to members: day titles are passed by, no notice or answer names a day (client 2026-11-28)', () => {
    const all = [...Object.values(STORIES), ...Object.values(PREVIEW_ONLY)].flatMap((d) => d.steps).concat(...AFTER_DAYS, SYS002_ALONE);
    for (const s of all) {
      if (s.t === 'caption' && /\d+日目/.test(s.text)) expect(s.text).toMatch(DAY_TITLE);
      if (s.t === 'notice') expect(s.text).not.toMatch(/\d+日目/);
      if (s.t === 'choice') for (const o of s.options) expect(o.label).not.toMatch(/\d+日目/);
    }
  });
  it('no day starts with the email check 〔扉の合言葉〕 (client 2026-11-28: day 2, then days 3–11)', () => {
    for (const st of [...Object.values(STORIES), ...Object.values(STORIES_NEW_HOMES)]) expect('auth' in st).toBe(false);
    // the day's screen asks for no address or code; signing in elsewhere stays on the entry screen
    const day = readFileSync('components/onboarding/StoryDay.tsx', 'utf8');
    expect(day).not.toMatch(/requestCode|\.verify\(/);
    expect(readFileSync('components/onboarding/EntryScreen.tsx', 'utf8')).toMatch(/requestCode[\s\S]*\.verify\(/);
  });
  it('KIMORIN wears the sunglasses look after the dragon', () => {
    const dragon = steps.findIndex((s) => s.t === 'video' && s.motion === 'd2-dragon');
    expect(dragon).toBeGreaterThan(-1);
    const after = steps.slice(dragon + 1).filter((s): s is Extract<Step, { t: 'sprite' }> => s.t === 'sprite');
    expect(after.some((s) => [s.image].flat().includes('kimorin-1'))).toBe(false);
    expect(after.some((s) => [s.image].flat().includes('kimorin-sun'))).toBe(true);
  });
});

describe('day 3: Bluena and Saturn (story 2026-10-14)', () => {
  const steps = STORIES[3].steps;
  it('MONBAN only speaks through Bluena’s square screen', () => {
    let open = false;
    // until SYS-S002 (becoming Obolo Order early), where MONBAN meets you at the Earth temple
    for (const s of steps.slice(0, steps.findIndex((x) => x.t === 'scene' && x.id === 'SYS-S002'))) {
      if (s.t === 'screen') open = s.open;
      if (s.t === 'say' && s.who === 'MONBAN') expect(open).toBe(true);
    }
  });
  it('Bluena in the morning, the first kororins made on the Moon, fly or keep, then the rocket and Saturn to look; MONBAN offers Obolo Order early (SYS-S002)', () => {
    const t = kinds(steps);
    expect(t).not.toContain('seal');
    // {bati} was born on day 2 (M-R207): no hatching on day 3; nothing is made on Saturn (M-R208)
    expect(t).not.toContain('hatch');
    expect(t).not.toContain('saturn');
    const bluena = steps.findIndex((s) => s.t === 'set' && s.key === 'f_d04_bluena');
    expect(bluena).toBeGreaterThan(-1);
    expect(steps.findIndex((s) => s.t === 'say' && s.text.includes('作るのは、月。しまうのは、Bluena。'))).toBeLessThan(t.indexOf('atelier'));
    expect(steps.find((s) => s.t === 'atelier')).toMatchObject({ kind: 'voice' });
    const fly = steps.findIndex((s) => s.t === 'choice' && s.key === 'f_d04_fly');
    expect(t.lastIndexOf('atelier')).toBeLessThan(fly);
    // the 88 minutes start when the rocket leaves the Moon after making (SYS-S001)
    expect(fly).toBeLessThan(t.indexOf('clock'));
    expect(t.indexOf('clock')).toBeLessThan(steps.findIndex((s) => s.t === 'scene' && s.id === 'D04-S005'));
    expect(steps.filter((s) => s.t === 'set' && s.key === 'f_d04_fly').map((s) => s.t === 'set' && s.value)).toEqual(['fly', 'skip']);
    // D04-S005c: the first voice message in the inviter's dachi thread (M-R212), then the way on by its answer
    const dv = t.indexOf('dachivoice');
    expect(steps[dv]).toEqual({ t: 'dachivoice', fallback: { t: 'say', who: '{inviter}', text: 'ようこそ。……あなたのつぶやき、聞こえたよ。' } });
    expect(steps[dv + 1]).toMatchObject({ t: 'branch', key: 'f_d04_voice_reply', cases: { reply: 'reply' }, otherwise: 'reply-later' });
    expect(t.indexOf('ticket')).toBeGreaterThan(t.indexOf('clock'));
    // M-R274: no MONBAN transmission at the end of day 3 (no early/later choice, no SYS-S002 from here)
    expect(steps.some((s) => s.t === 'choice' && s.key === 'f_join_early')).toBe(false);
    expect(steps.some((s) => s.t === 'scene' && s.id === 'SYS-S002')).toBe(false);
  });
});

describe('days 3–7: made on the Moon, flown, then seen on the planet (M-R208)', () => {
  const plan: [number, string, string, [string, string]][] = [
    [3, 'voice', 'f_d04_fly', ['fly', 'skip']],
    [4, 'art', 'f_d05_sent_jacket', ['send', 'keep']],
    [5, 'song', 'f_d06_sent_song', ['sail', 'keep']],
    [6, 'video', 'f_d07_sent_mv', ['send', 'keep']],
    [7, 'radio', 'f_d07v_show', ['send', 'keep']],
  ];
  for (const [day, kind, flag, values] of plan) {
    it(`day ${day}: OBOLON teaches in the Moon temple, the ${kind} is made in {bati}'s chat, ${flag} = ${values.join(' / ')}, then the rocket`, () => {
      const steps = STORIES[day].steps;
      const t = kinds(steps);
      const teach = steps.findIndex((s) => s.t === 'say' && s.who === 'OBOLON' && /お前は、ついに、.+を、作れるようになる。/.test(s.text));
      expect(teach).toBeGreaterThan(-1);
      const made = steps.findIndex((s) => s.t === 'atelier' && s.kind === kind);
      expect(made).toBeGreaterThan(teach);
      const fly = steps.findIndex((s) => s.t === 'choice' && s.key === flag);
      expect(fly).toBeGreaterThan(made);
      expect(steps.filter((s) => s.t === 'set' && s.key === flag).map((s) => s.t === 'set' && s.value)).toEqual(values);
      // the 88 minutes start as the rocket leaves the Moon, after making; no planet practice any more
      expect(t.indexOf('clock')).toBeGreaterThan(fly);
      for (const p of ['saturn', 'jupiter', 'mercury', 'mars', 'venus']) expect(t).not.toContain(p);
    });
  }
  it('the removed flags are gone (M-R208/M-R210)', () => {
    const gone = ['f_d05_tree', 'f_d05_tree_parts', 'f_d06_island', 'f_d06_island_parts', 'f_d06_island_name', 'f_d06_know', 'f_d07_studio', 'f_d07_studio_parts', 'f_d07v_dj', 'f_d07v_set_done', 'f_d05_spell', 'f_d06_spell'];
    const keys = Object.values(STORIES).flatMap((s) => s.steps.flatMap((x) => (x.t === 'set' || x.t === 'choice' || x.t === 'branch' ? [x.key] : [])));
    for (const g of gone) expect(keys).not.toContain(g);
  });
});

describe('Venus (day 7)', () => {
  const steps = STORIES[7].steps;
  it('the show made on the Moon, then the booth and the fifth stamp; the night is slept on Venus', () => {
    const booth = steps.findIndex((s) => s.t === 'scene' && s.id === 'D07V-S004');
    expect(booth).toBeGreaterThan(steps.findIndex((s) => s.t === 'atelier'));
    expect(steps.slice(booth).find((s) => s.t === 'ticket')).toEqual({ t: 'ticket', stamp: 'venus' });
    expect(steps.slice(booth).some((s) => s.t === 'still' && s.image.startsWith('s/moon'))).toBe(false);
  });
});

describe('the Sun day (11 since M-R341; 8 in draft 21)', () => {
  const steps = STORIES[JOURNEY_PAYMENT].steps;
  it('〔エクリプスを受ける〕 leads to the payment; 〔今は、住人のままでいる〕 ends the journey as a resident', () => {
    const c = steps.findIndex((s) => s.t === 'choice' && s.key === 'f_d08_decide');
    const opts = steps[c].t === 'choice' ? steps[c].options : [];
    expect(opts.map((o) => o.label)).toEqual(['エクリプスを受ける', '今は、住人のままでいる']);
    const pay = labelIndex(steps, opts[0].goto!);
    expect(steps.slice(pay, pay + 8).find((s) => s.t === 'order')).toMatchObject({ t: 'order', cancel: 'back' });
    expect(steps.slice(c + 1).find((s) => s.t === 'end' || s.t === 'order')?.t).toBe('end');
  });
  it('no riddles or records any more; members who joined early take the short way (f_join_early)', () => {
    expect(steps.some((s) => s.t === 'seal' || s.t === 'film')).toBe(false);
    expect(steps.some((s) => s.t === 'branch' && s.key === 'f_join_early')).toBe(true);
    expect(steps.some((s) => s.t === 'caption' && s.text === '通信：火星シアターの扉が、開いた')).toBe(true);
  });
});
