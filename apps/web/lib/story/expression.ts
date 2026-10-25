/**
 * Which expression / pose picture a speaker shows for a line (client 2026-10-25: the one talking shows
 * their face and gesture). Picked from the words — the first rule that matches wins; a 'face' step in the
 * script still sets one by hand. Names match the pictures onboarding/<sprite>-x-<expr>.webp (Stage faces).
 */
type Rule = [RegExp, string];

const KIMORIN: Rule[] = [
  [/会えましたね|肯定してくれて|これが、、私の|これが、、、オレの/, 'tears'],
  [/^(え[？！、]|え！|うわ|な、|は！|はい？)|！？|！\?|マジで|なんや|どういう仕組み|おかしいやろ/, 'shock'],
  [/はは|ふふ|やった|最高|大正解|成功です|めちゃくちゃすごい|すごい！|ぜひ！/, 'joy'],
  [/天才|私の発明|当然|もちろん|まあまあ|ですよね？|失敗したことが|ではありませんが/, 'smug'],
  [/なさい|ましょう|気をつけ|あなた|暴いて|行きますよ|見てください|みてください/, 'point'],
  [/仕組み|つまり|なぜなら|実は|さらに|引っかけ|ということ|デバイス|これは私が/, 'lecture'],
  [/……|、、、|推理|でしょう|かな|ですか？/, 'think'],
];

const MONBAN: Rule[] = [
  [/待て|帰れ|だめ|そこまでだ/, 'stop'],
  [/行け|乗れ|受け取れ|見せ|いってこい|解き明かして|遊んでこい|帰ってこい/, 'point'],
  [/秘密結社|必要がある|知る権利|謎が|守る|見つけよ/, 'arms'],
];

const RULES: Record<string, Rule[]> = { KIMORIN, 'KIMORIN⭐︎': KIMORIN, MONBAN };

export function exprFor(who: string, text: string): string {
  for (const [re, e] of RULES[who] ?? []) if (re.test(text)) return e;
  return 'talk';
}
