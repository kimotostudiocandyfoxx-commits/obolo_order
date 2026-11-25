import { z } from 'zod';

/**
 * R11 (client): in this app a generation prompt is a スペル (spell). Before anything that spends mana {bati} lays the spell
 * out — 「じゃあ、こういうスペルになるね」 — as many small wooden tags (木札), each in Japanese. Behind each tag is the
 * English term the generator is given; the member never sees it. The member changes the spell in words (「ピアノも足して」
 * 「暗いのは外して」) or by taking a tag off; the yes is given to exactly that tag set (spellKey), and the server makes the
 * work from exactly that set (spellPrompt).
 * The common tags are a fixed dictionary (stable labels); free words become tags of their own (the API's model writes
 * their English; without it the words themselves stand in).
 */
export const SPELL_KINDS = ['song', 'art', 'video', 'look', 'bati', 'novel', 'chapter', 'game'] as const;
export type SpellKind = (typeof SPELL_KINDS)[number];
/**
 * novel / chapter / game (client 2026-11-25, 「会話で始めて、スペルで決めて、会話で直す」): a book's world, hero and length;
 * a chapter's event; a game's rule, goal and level
 */
export const SPELL_GROUPS = ['theme', 'genre', 'mood', 'tempo', 'instrument', 'voice', 'style', 'color', 'light', 'composition', 'camera', 'wear', 'world', 'hero', 'length', 'event', 'rule', 'goal', 'level', 'purpose', 'source', 'scenes', 'transition', 'caption'] as const;
export type SpellGroup = (typeof SPELL_GROUPS)[number];

export const SpellTag = z.object({ ja: z.string().trim().min(1).max(16), en: z.string().trim().min(1).max(80), group: z.enum(SPELL_GROUPS) });
export type SpellTag = z.infer<typeof SpellTag>;
export const SpellTags = z.array(SpellTag).min(1).max(16);
/** POST /moon/spell: a spell for the words (none yet), or the spell changed by the words */
export const SpellBody = z.object({
  kind: z.enum(SPELL_KINDS),
  said: z.string().trim().min(1).max(200),
  tags: z.array(SpellTag).max(16).optional(),
  /** client 2026-11-25: a book's / a game's answers to {bati}'s questions (a fresh spell from them: spellOfAnswers) */
  answers: z.array(z.object({ group: z.enum(SPELL_GROUPS).optional(), said: z.string().trim().max(200) })).max(6).optional(),
});
export type SpellBody = z.infer<typeof SpellBody>;
export interface SpellView {
  tags: SpellTag[];
  /** the tags this change put on and took off (the card drops the new ones in and lets the old ones fall away) */
  added: SpellTag[];
  removed: SpellTag[];
}

type Entry = { ja: string; en: string; group: SpellGroup; re: RegExp; for?: SpellKind[] };
const SONG: SpellKind[] = ['song'];
const PIC: SpellKind[] = ['art', 'video', 'look', 'bati'];
const PICG: SpellKind[] = [...PIC, 'game'];
const BOOK: SpellKind[] = ['novel'];
const CHAP: SpellKind[] = ['chapter'];
const GAME: SpellKind[] = ['game'];
const TALE: SpellKind[] = ['novel', 'game'];
const VID: SpellKind[] = ['video'];
const e = (ja: string, en: string, group: SpellGroup, re: RegExp | string, kinds?: SpellKind[]): Entry => ({ ja, en, group, re: typeof re === 'string' ? new RegExp(re) : re, for: kinds });

/** the fixed tags (first match wins inside a group; the longer words come first) */
export const SPELL_DICTIONARY: Entry[] = [
  // a book: its world (where), its genre, its length
  e('魔法の森', 'an enchanted forest', 'world', /魔法の森|まほうの森|森/, BOOK),
  e('未来の街', 'a city in the future', 'world', /未来の街|未来の町|未来/, BOOK),
  e('海の底の国', 'a kingdom under the sea', 'world', /海の底|海底/, BOOK),
  e('空の島', 'an island floating in the sky', 'world', /空の島|空に浮/, BOOK),
  e('宇宙の旅', 'a journey through outer space', 'world', /宇宙/, BOOK),
  e('ふしぎな学校', 'a mysterious school', 'world', /学校|学園/, BOOK),
  e('小さな町', 'a small quiet town', 'world', /小さな町|町|まち/, BOOK),
  e('ファンタジー', 'fantasy', 'genre', /ファンタジー|魔法|まほう/, BOOK),
  e('冒険', 'adventure', 'genre', /冒険|ぼうけん/, BOOK),
  e('ミステリー', 'gentle mystery', 'genre', /ミステリー|なぞ解き|謎解き|探偵/, BOOK),
  e('SF', 'science fiction', 'genre', /SF|ＳＦ|サイエンス/i, BOOK),
  e('学園もの', 'school life story', 'genre', /学園もの|クラス|部活/, BOOK),
  e('日常', 'slice of life', 'genre', /日常|ほのぼの/, BOOK),
  e('ちょっと怖い', 'mildly spooky (not scary for teens)', 'genre', /怖|こわ|ホラー|おばけ/, BOOK),
  e('短め', 'short chapters (about 1500 Japanese characters)', 'length', /短め|みじか|短い/, BOOK),
  e('ふつうの長さ', 'chapters of about 2000 Japanese characters', 'length', /ふつうの長さ/, BOOK),
  e('長め', 'long chapters (about 2500 Japanese characters)', 'length', /長め|ながめ|たっぷり|長い/, BOOK),
  // who it is about (a book's hero, a game's character)
  e('猫', 'a young cat', 'hero', /猫|ねこ|ネコ/, TALE),
  e('犬', 'a brave little dog', 'hero', /犬|いぬ|イヌ/, TALE),
  e('うさぎ', 'a rabbit', 'hero', /うさぎ|ウサギ/, TALE),
  e('ロボット', 'a small robot', 'hero', /ロボット|ロボ/, TALE),
  e('ドラゴン', 'a baby dragon', 'hero', /ドラゴン|竜|りゅう/, TALE),
  e('魔女', 'a young witch', 'hero', /魔女|魔法使い|まほうつかい/, TALE),
  e('宇宙船', 'a little spaceship', 'hero', /宇宙船|ロケット/, GAME),
  e('女の子', 'a girl', 'hero', /女の子|少女/, TALE),
  e('男の子', 'a boy', 'hero', /男の子|少年/, TALE),
  // a chapter: what happens next
  e('最終章', 'the final chapter: bring the story to a warm ending', 'event', /最後|さいご|おわり|終わり|完結|最終/, CHAP),
  e('新しい仲間', 'a new friend joins', 'event', /仲間|なかま|友だち|ともだち|友達/, CHAP),
  e('ライバル登場', 'a rival appears', 'event', /ライバル/, CHAP),
  e('なぞの人', 'a mysterious stranger appears', 'event', /なぞの人|謎の人|知らない人/, CHAP),
  e('嵐', 'a sudden storm', 'event', /嵐|あらし|大雨/, CHAP),
  e('なぞの手紙', 'a mysterious letter arrives', 'event', /手紙/, CHAP),
  e('迷子', 'the hero gets lost', 'event', /迷子|まいご|迷う|迷っ/, CHAP),
  e('宝さがし', 'a treasure hunt', 'event', /宝|たから/, CHAP),
  e('大ピンチ', 'a big trouble to overcome', 'event', /ピンチ|大変|危な|あぶな/, CHAP),
  e('旅立ち', 'setting off on a journey', 'event', /旅立|出発|旅に/, CHAP),
  e('ひみつ', 'a secret is revealed', 'event', /秘密|ひみつ/, CHAP),
  e('なかなおり', 'making up after a quarrel', 'event', /けんか|ケンカ|なかなおり|仲直り/, CHAP),
  e('おまかせ', "the writer's own idea of what happens next", 'event', /おまかせ|お任せ|まかせ|任せ|つづき|続き|なんでも|何でも/, CHAP),
  // a game: what kind, its rules, its goal, how hard
  e('集める', 'collect game: move left and right to catch falling items', 'genre', /集め|あつめ|キャッチ|拾/, GAME),
  e('よける', 'dodge game: avoid falling obstacles', 'genre', /よけ|避け|かわす|逃げ/, GAME),
  e('ジャンプ', 'endless runner: jump over obstacles', 'genre', /ジャンプ|ランナー|走る|はしる/, GAME),
  e('シューティング', 'shooter: shoot down enemies coming from above', 'genre', /シューティング|撃|打ち落|うち落|弾/, GAME),
  e('タップ', 'tap game: tap the targets before they disappear', 'genre', /タップ|たたく|叩/, GAME),
  e('ブロックくずし', 'breakout: bounce a ball to break blocks', 'genre', /ブロック|くずし|崩し/, GAME),
  e('クイズ', 'quiz: answer simple multiple-choice questions', 'genre', /クイズ|問題/, GAME),
  e('パズル', 'puzzle: tap to match tiles of the same colour', 'genre', /パズル|そろえ|揃え|並べ/, GAME),
  e('敵が多い', 'many enemies and obstacles', 'rule', /敵|てき|おじゃま|じゃま/, GAME),
  e('スピードアップ', 'it gets faster over time', 'rule', /だんだん|スピード|速く|はやく/, GAME),
  e('ライフ3つ', 'three lives', 'rule', /ライフ|命|いのち/, GAME),
  e('60秒', 'a 60 second time limit', 'rule', /秒|時間/, GAME),
  e('30こ集めたら勝ち', 'win by reaching 30 points', 'goal', /30|３０|勝ち|クリア/, GAME),
  e('ハイスコア', 'aim for a high score', 'goal', /ハイスコア|スコア|点数/, GAME),
  e('とてもむずかしい', 'very hard', 'level', /とても(難し|むずかし)|激ムズ|鬼むず/, GAME),
  e('むずかしい', 'hard', 'level', /難し|むずかし|ハード/, GAME),
  e('かんたん', 'easy', 'level', /かんたん|簡単|やさしめ/, GAME),
  e('ふつう', 'normal difficulty', 'level', /^ふつう$|ふつうの難しさ/, GAME),
  e('ネオン', 'neon glow on a dark background', 'color', /ネオン|ピカピカ/, GAME),
  e('夜空', 'a night sky with stars', 'color', /夜空|星空/, GAME),
  e('わくわく', 'exciting', 'mood', /わくわく|ワクワク|ドキドキ|どきどき/, TALE),
  e('おもしろい', 'funny', 'mood', /おもしろ|面白|笑える|ギャグ/, TALE),
  // a song's genre
  // R13 fix (client 2026-11-25: 「ピアノ系からEDM系にしてほしい」): every common genre word is a genre talisman of its own
  // (the longer names first: シティポップ / K-POP before ポップ, ダブステップ before ステップ …)
  e('シティポップ', '1980s city pop', 'genre', /シティ・?ポップ|シティーポップ|city ?pop/i, SONG),
  e('アニソン', 'anime song, j-pop', 'genre', /アニソン|アニメソング|アニメの(曲|歌)|アニメっぽい曲/, SONG),
  e('ボカロ', 'vocaloid-style j-pop, fast synth lines', 'genre', /ボカロ|ボーカロイド|vocaloid/i, SONG),
  e('K-POP', 'k-pop', 'genre', /K-?POP|Ｋ-?ＰＯＰ|ケーポップ|韓国の?(曲|歌|ポップ)/i, SONG),
  e('ポップ', 'pop', 'genre', /ポップ|J-?POP|pop/i, SONG),
  e('メタル', 'heavy metal', 'genre', /メタル|metal/i, SONG),
  e('パンク', 'punk rock', 'genre', /パンク|punk/i, SONG),
  e('ロック', 'rock', 'genre', /ロック|rock/i, SONG),
  e('バラード', 'ballad', 'genre', /バラード|ballad/i, SONG),
  e('R&B', 'r&b, soul', 'genre', /R&B|Ｒ＆Ｂ|R＆B|アールアンドビー|リズムアンドブルース|ソウル(?!フル)/i, SONG),
  e('ヒップホップ', 'hip hop', 'genre', /ヒップホップ|ヒップ・ホップ|ラップ(?!トップ)|hip ?hop|(?<![A-Za-z])rap(?![A-Za-z])/i, SONG),
  e('ダブステップ', 'dubstep, heavy wobble bass', 'genre', /ダブステップ|ダブステ|dubstep/i, SONG),
  e('ハウス', 'house music, four-on-the-floor', 'genre', /ハウス|house/i, SONG),
  e('テクノ', 'techno', 'genre', /テクノ|techno/i, SONG),
  e('トランス', 'trance, euphoric synth', 'genre', /トランス|trance/i, SONG),
  e('EDM', 'EDM, electronic dance music', 'genre', /EDM|ＥＤＭ|イーディーエム|エレクトロニックダンス|エレクトロ|electro/i, SONG),
  e('ダンス', 'dance, EDM', 'genre', /ダンス|クラブ|ディスコ/i, SONG),
  e('ジャズ', 'jazz', 'genre', /ジャズ|jazz/i, SONG),
  e('ボサノバ', 'bossa nova', 'genre', /ボサノバ|ボサノヴァ/, SONG),
  e('レゲエ', 'reggae', 'genre', /レゲエ|reggae/i, SONG),
  e('ファンク', 'funk', 'genre', /ファンク|funk/i, SONG),
  e('クラシック', 'classical, orchestral', 'genre', /クラシック|クラッシック|オーケストラ|classical/i, SONG),
  e('演歌', 'enka', 'genre', /演歌/, SONG),
  e('フォーク', 'acoustic folk', 'genre', /フォーク|弾き語り/, SONG),
  e('ローファイ', 'lo-fi', 'genre', /ローファイ|ロウファイ|lofi|lo-fi/i, SONG),
  // the mood (songs and pictures)
  e('明るい', 'bright', 'mood', /明る|あかる|ハッピー/),
  e('楽しい', 'joyful', 'mood', /楽し|たのし|わくわく|ワクワク/),
  e('元気', 'energetic', 'mood', /元気|げんき|はげし|激し/),
  e('しっとり', 'mellow', 'mood', /しっとり|おだやか|穏やか/),
  e('切ない', 'bittersweet', 'mood', /切な|せつな|さみし|寂し|泣/),
  e('やさしい', 'gentle', 'mood', /やさし|優し|ほっこり|あったか|温か/),
  e('暗い', 'dark', 'mood', /暗|くら(い|く|め)/),
  e('かっこいい', 'cool', 'mood', /かっこ|カッコ|クール/),
  // R12 (client): 「光々しく舞い降りる」 (光々しい: a common slip for 神々しい)
  e('神々しい', 'divine, radiant with holy light', 'mood', /神々し|こうごうし|光々し|後光/),
  e('夢みたい', 'dreamy', 'mood', /夢みたい|夢の中|幻想|ふしぎ|不思議/),
  e('静か', 'calm', 'mood', /静か|しずか|落ち着|おちつ/),
  // a song's tempo, instruments, voice
  e('ゆっくり', 'slow tempo', 'tempo', /ゆっくり|ゆったり|スロー/, SONG),
  e('ふつうの速さ', 'mid tempo', 'tempo', /ふつうの速さ|ミドルテンポ/, SONG),
  e('アップテンポ', 'upbeat tempo', 'tempo', /アップテンポ|速い|はやい|テンポよく/, SONG),
  e('エレキギター', 'electric guitar', 'instrument', /エレキ/, SONG),
  e('ギター', 'acoustic guitar', 'instrument', /ギター/, SONG),
  e('ピアノ', 'piano', 'instrument', /ピアノ/, SONG),
  e('ドラム', 'drums', 'instrument', /ドラム|太鼓/, SONG),
  e('ベース', 'bass', 'instrument', /ベース/, SONG),
  e('ストリングス', 'strings', 'instrument', /ストリングス|弦/, SONG),
  e('バイオリン', 'violin', 'instrument', /バイオリン|ヴァイオリン/, SONG),
  e('シンセ', 'synthesizer', 'instrument', /シンセ/, SONG),
  e('四つ打ち', 'four-on-the-floor kick', 'instrument', /四つ打ち|よつうち|4つ打ち|４つ打ち/, SONG),
  e('808ベース', '808 bass', 'instrument', /808/, SONG),
  e('ウクレレ', 'ukulele', 'instrument', /ウクレレ/, SONG),
  e('サックス', 'saxophone', 'instrument', /サックス/, SONG),
  e('ベル', 'bells', 'instrument', /ベル|鈴/, SONG),
  e('手拍子', 'hand claps', 'instrument', /手拍子|クラップ/, SONG),
  e('口笛', 'whistling', 'instrument', /口笛/, SONG),
  e('やさしい歌声', 'soft vocals', 'voice', /やさしい歌声|ささやく|ウィスパー/, SONG),
  e('力強い歌声', 'powerful vocals', 'voice', /力強い歌声|力強く歌|シャウト/, SONG),
  e('女の子の声', 'female vocals', 'voice', /女の子の声|女性(の)?(声|ボーカル)/, SONG),
  e('男の子の声', 'male vocals', 'voice', /男の子の声|男性(の)?(声|ボーカル)/, SONG),
  // a picture's touch, colour, light, composition; an MV's camera; a look's clothes
  e('水彩', 'watercolor', 'style', /水彩/, PIC),
  e('油絵', 'oil painting', 'style', /油絵/, PIC),
  e('クレヨン', 'crayon drawing', 'style', /クレヨン/, PIC),
  e('絵本風', 'picture book illustration', 'style', /絵本/, PIC),
  e('アニメ風', 'anime style', 'style', /アニメ/, PIC),
  e('ドット絵', 'pixel art', 'style', /ドット/, PICG),
  e('切り絵', 'paper cut art', 'style', /切り絵/, PIC),
  e('えんぴつ画', 'pencil sketch', 'style', /鉛筆|えんぴつ/, PIC),
  e('立体', '3D render', 'style', /3D|立体/i, PIC),
  e('やわらかい色', 'soft pastel colors', 'color', /やわらかい色|パステル|淡い/, PICG),
  e('あざやかな色', 'vivid colors', 'color', /あざやか|鮮やか|カラフル/, PICG),
  e('青い色', 'blue tones', 'color', /青い色|青っぽ|ブルー/, PICG),
  e('金色', 'golden tones', 'color', /金色|ゴールド/, PICG),
  e('ピンク', 'pink tones', 'color', /ピンク/, PICG),
  e('虹色', 'rainbow colors', 'color', /虹色|レインボー/, PICG),
  e('モノクロ', 'monochrome', 'color', /モノクロ|白黒/, PICG),
  e('夕焼け', 'sunset light', 'light', /夕焼け|夕日|ゆうひ/, PIC),
  e('月明かり', 'moonlight', 'light', /月明かり/, PIC),
  e('星明かり', 'starlight', 'light', /星明かり/, PIC),
  e('朝の光', 'morning light', 'light', /朝の光|朝日/, PIC),
  e('キラキラ', 'sparkling light', 'light', /キラキラ|きらきら/, PIC),
  e('正方形', 'square composition', 'composition', /正方形|四角/, PIC),
  e('真ん中に大きく', 'centered subject', 'composition', /真ん中|まんなか/, PIC),
  e('遠くから', 'wide view', 'composition', /遠く|広く|ひろく/, PIC),
  e('アップ', 'close-up', 'composition', /アップで|大きく|近く/, PIC),
  // R13 (client 2026-11-25): a video is pictures that move — what it is for, the song, how many scenes, how long, how the
  // camera moves over each picture, how scenes change, the lyrics on screen (video.ts reads them as the pipeline's settings)
  e('曲のMV', 'purpose: a music video for my song, a new picture painted for each scene', 'purpose', /MV|ＭＶ|ミュージックビデオ|曲に(映像|動画)|曲の(映像|動画)/i, VID),
  e('絵をつなぐ', 'purpose: a short clip made of my own pictures, nothing new painted', 'purpose', /(持ってる|もってる|今ある|いまある|自分の|じぶんの|わたしの|私の|ぼくの|僕の|おれの|俺の)(絵|写真|しゃしん|アート|作品)|(絵|写真|しゃしん|アート|作品)を(つな|繋|並べ|ならべ|動か|うごか)/, VID),
  e('お話スライド', 'purpose: a story slideshow told in pictures', 'purpose', /スライド|紙芝居|かみしばい|お話|物語|ストーリー/, VID),
  e('4場面', '4 scenes', 'scenes', /[4４四](場面|シーン|枚)|少なめ/, VID),
  e('8場面', '8 scenes', 'scenes', /[8８八](場面|シーン|枚)|ふつうの数/, VID),
  e('12場面', '12 scenes', 'scenes', /(12|１２|十二)(場面|シーン|枚)|多め|たくさんの場面/, VID),
  e('サビだけ', 'about 30 seconds: the chorus', 'length', /サビだけ|サビ|30秒|３０秒|ショート/, VID),
  e('1分', 'about 60 seconds', 'length', /[1１一]分|60秒|６０秒/, VID),
  e('まるごと', 'the whole song', 'length', /まるごと|丸ごと|ぜんぶ|全部|フル|最後まで/, VID),
  e('パララックス', '2.5D parallax: near and far move apart', 'camera', /パララックス|奥行き|おくゆき/, VID),
  e('ゆっくりズーム', 'slow zoom', 'camera', /ズーム/, VID),
  e('空を飛ぶカメラ', 'flying camera', 'camera', /飛ぶ|とぶ|空から/, VID),
  e('横に流れる', 'panning shot', 'camera', /流れる|パン/, VID),
  e('ふわっと切りかえ', 'soft fade between scenes', 'transition', /ふわっと|フェード|じわっと/, VID),
  e('パッと切りかえ', 'hard cut between scenes', 'transition', /パッと|ぱっと|スパッと/, VID),
  e('ピカッと切りかえ', 'white flash between scenes', 'transition', /ピカッと|ぴかっと|フラッシュ/, VID),
  e('歌詞なし', 'no lyric captions', 'caption', /(歌詞|字幕)(は|を)?(なし|無し|いらない|出さない|ださない|なくて)/, VID),
  e('歌詞を出す', 'lyric captions on screen', 'caption', /歌詞|字幕/, VID),
  e('魔法使い', 'wizard robe', 'wear', /魔法使い|まほうつかい/, ['look', 'bati']),
  e('パジャマ', 'pajamas', 'wear', /パジャマ/, ['look', 'bati']),
  e('宇宙飛行士', 'astronaut suit', 'wear', /宇宙飛行士/, ['look', 'bati']),
  e('ドレス', 'dress', 'wear', /ドレス/, ['look', 'bati']),
  e('着物', 'kimono', 'wear', /着物|浴衣/, ['look', 'bati']),
  e('帽子', 'hat', 'wear', /帽子|ぼうし/, ['look', 'bati']),
  e('メガネ', 'glasses', 'wear', /メガネ|めがね|眼鏡/, ['look', 'bati']),
];

/** what a work is about: the common words (a word not here is a tag of its own) */
const THEMES: [RegExp, string, string][] = [
  [/^星空$/, '星空', 'starry sky'],
  [/^(夏|なつ)$/, '夏', 'summer'],
  [/^(冬|ふゆ)$/, '冬', 'winter'],
  [/^(春|はる)$/, '春', 'spring'],
  [/^(秋|あき)$/, '秋', 'autumn'],
  [/^(海|うみ)$/, '海', 'the sea'],
  [/^(夜|よる)$/, '夜', 'night'],
  [/^(星|ほし)$/, '星', 'stars'],
  [/^(月|つき)$/, '月', 'the moon'],
  [/^(空|そら)$/, '空', 'the sky'],
  [/^(雨|あめ)$/, '雨', 'rain'],
  [/^(雪|ゆき)$/, '雪', 'snow'],
  [/^(花|はな)$/, '花', 'flowers'],
  [/^桜$/, '桜', 'cherry blossoms'],
  [/^(森|もり)$/, '森', 'forest'],
  [/^(街|まち)$/, '街', 'the city'],
  [/^(猫|ねこ)$/, '猫', 'a cat'],
  [/^(犬|いぬ)$/, '犬', 'a dog'],
  [/^クジラ$|^くじら$/, 'クジラ', 'a whale'],
  [/^うさぎ$/, 'うさぎ', 'a rabbit'],
  [/^宇宙$/, '宇宙', 'outer space'],
  [/^(友だち|友達|ともだち)$/, '友だち', 'friendship'],
  [/^恋$/, '恋', 'love'],
  [/^(夢|ゆめ)$/, '夢', 'dreams'],
  [/^(旅|たび)$/, '旅', 'a journey'],
  [/^家族$/, '家族', 'family'],
  [/^(朝|あさ)$/, '朝', 'morning'],
  [/^学校$/, '学校', 'school'],
  [/^ネオン$/, 'ネオン', 'neon lights'],
  [/^動物$/, '動物', 'animals'],
  [/^ふわふわ$/, 'ふわふわ', 'fluffy'],
  [/^(さんぽ|散歩)$/, 'さんぽ', 'a walk'],
  [/^海辺$/, '海辺', 'the seaside'],
];

/** the groups that take one tag only (a new one replaces the old) */
const ONE: SpellGroup[] = ['genre', 'tempo', 'voice', 'style', 'composition', 'camera', 'world', 'hero', 'length', 'level', 'goal', 'purpose', 'source', 'scenes', 'transition', 'caption'];
/** moods that do not go together */
const OPPOSITE: Record<string, string[]> = { bright: ['dark', 'bittersweet'], dark: ['bright', 'joyful'], joyful: ['dark', 'bittersweet'], bittersweet: ['bright', 'joyful'], energetic: ['calm', 'mellow'], calm: ['energetic'], mellow: ['energetic'] };
const ORDER: SpellGroup[] = ['purpose', 'source', 'world', 'hero', 'theme', 'wear', 'genre', 'event', 'style', 'mood', 'tempo', 'instrument', 'voice', 'rule', 'goal', 'level', 'color', 'light', 'composition', 'camera', 'transition', 'scenes', 'length', 'caption'];
const INSTRUMENTS: Record<string, string[]> = {
  pop: ['ピアノ', 'ドラム'],
  rock: ['エレキギター', 'ドラム'],
  ballad: ['ピアノ', 'ストリングス'],
  'hip hop': ['ドラム', 'ベース'],
  'dance, EDM': ['シンセ', 'ドラム'],
  jazz: ['ピアノ', 'サックス'],
  'acoustic folk': ['ギター'],
  'lo-fi': ['ピアノ', 'ドラム'],
  '1980s city pop': ['シンセ', 'ベース'],
  'anime song, j-pop': ['エレキギター', 'ドラム'],
  'vocaloid-style j-pop, fast synth lines': ['シンセ', 'ドラム'],
  'k-pop': ['シンセ', 'ドラム'],
  'heavy metal': ['エレキギター', 'ドラム'],
  'punk rock': ['エレキギター', 'ドラム'],
  'r&b, soul': ['ベース', 'ピアノ'],
  'dubstep, heavy wobble bass': ['シンセ', '808ベース'],
  'house music, four-on-the-floor': ['シンセ', '四つ打ち'],
  techno: ['シンセ', '四つ打ち'],
  'trance, euphoric synth': ['シンセ', '四つ打ち'],
  'EDM, electronic dance music': ['シンセ', '四つ打ち'],
  'bossa nova': ['ギター'],
  reggae: ['ギター', 'ベース'],
  funk: ['ベース', 'ドラム'],
  'classical, orchestral': ['ストリングス', 'ピアノ'],
  enka: ['ストリングス'],
};
/** R13 fix: genres whose sound has no acoustic instruments by default (a switch to them lets ピアノ / ギター go) */
const ELECTRONIC = new Set(['EDM, electronic dance music', 'dance, EDM', 'house music, four-on-the-floor', 'techno', 'trance, euphoric synth', 'dubstep, heavy wobble bass']);
/** what a kind's spell always has (the dictionary's ja), when the words did not say it */
const DEFAULTS: Record<SpellKind, Partial<Record<SpellGroup, string>>> = {
  song: { genre: 'ポップ', mood: '明るい', voice: 'やさしい歌声' },
  art: { style: '水彩', color: 'やわらかい色', composition: '正方形' },
  // R13: pictures that move — Bati fills what was not said (an MV of the chorus, 8 pictures, 2.5D, soft fades, lyrics on)
  video: { purpose: '曲のMV', style: 'アニメ風', camera: 'パララックス', transition: 'ふわっと切りかえ', scenes: '8場面', length: 'サビだけ', caption: '歌詞を出す' },
  look: { style: 'アニメ風' },
  bati: { style: 'アニメ風' },
  // client 2026-11-25: {bati} fills what was not said (the member never has to write anything)
  novel: { world: '小さな町', hero: '女の子', genre: 'ファンタジー', mood: 'わくわく', length: 'ふつうの長さ' },
  chapter: { event: 'おまかせ' },
  game: { genre: '集める', goal: 'ハイスコア', level: 'ふつう', color: 'あざやかな色' },
};
/** client 2026-11-25: a book's or a game's spell is at most 8 talismans */
export const SPELL_MAX_TAGS: Record<SpellKind, number> = { song: 14, art: 14, video: 14, look: 14, bati: 14, novel: 8, chapter: 8, game: 8 };

const byJa = (ja: string) => SPELL_DICTIONARY.find((x) => x.ja === ja)!;
const tagOf = (x: Entry): SpellTag => ({ ja: x.ja, en: x.en, group: x.group });
const fits = (x: Entry, kind: SpellKind) => !x.for || x.for.includes(kind);
const sortTags = (ts: SpellTag[]) => [...ts].sort((a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group));
const same = (a: SpellTag, b: SpellTag) => a.en.toLowerCase() === b.en.toLowerCase() || a.ja === b.ja;

/** the dictionary tags named in the words, and the words left over */
function named(kind: SpellKind, said: string): { tags: SpellTag[]; rest: string } {
  let rest = said;
  const tags: SpellTag[] = [];
  for (const x of SPELL_DICTIONARY) {
    if (!fits(x, kind)) continue;
    const m = rest.match(x.re);
    if (!m) continue;
    if (ONE.includes(x.group) && tags.some((t) => t.group === x.group)) continue;
    tags.push(tagOf(x));
    // the word and its kana tail (明る|い, 暗|いのは) go
    rest = rest.replace(new RegExp(`(?:${x.re.source})[ぁ-ゖ]*`, x.re.flags), '、');
  }
  return { tags, rest };
}

const KIND_WORDS = /曲|歌|うた|ソング|音楽|おんがく|絵|イラスト|アート|画像|がぞう|写真|しゃしん|ピクチャ|映像|動画|どうが|ビデオ|MV|ムービー|姿|かっこう|格好|着せかえ|服|小説|物語|ものがたり|お話|おはなし|本|ゲーム|次の章|章/g;
const ASKING = /(を|で|の|に)?(作って|つくって|描いて|かいて|作りたい|つくりたい|描きたい|作れる|つくれる|作る|つくる|生成して|お願い|おねがい|ください|して|ちょうだい|欲しい|ほしい|にする|にして|足して|たして|加えて|入れて|いれて|外して|はずして|消して|抜いて|やめて|いらない|変えて|かえて)(欲しい|ほしい|ください|くれる|くれない|ちょうだい|もらえる)?(なんだけど|んだけど|んですけど|だけど|けど|んだが|な|の|よ|ね)?[！!。]*/g;
const FILLER = /^(もっと|ちょっと|すこし|少し|なんか|あと|それと|それから|も|は|が|を|の|で|に|と|な|感じ|かんじ|系|っぽい|みたいな?|して|する)+$/;
/**
 * R12 (client): the words around a request are not what it is about — greetings, 「魔法で」, the request verbs, 欲しい,
 * politeness and the joints of the sentence (「ヤッホー画像を作って欲しいんだけど…」 → only 「空飛ぶクジラ…」 is left)
 */
const GREETING = /^(ヤッホー|やっほー|やっほ|ヤッホ|こんにちは|こんばんは|おはよう|ねえバティ|ねえ|ねぇ|ねー|あのね|あの|えっと|ええと|バティ)[、,！!\s　ー〜]*/;
const BY_MAGIC = /(魔法|まほう|スペル)で(?=(作|つく|描|か|生成|お願い|おねがい))/g;
/** a free word that is only request / filler (never a talisman) */
const NOT_CONTENT = /^(魔法|まほう|スペル|欲しい|ほしい|ヤッホー|やっほー|やっほ|なんだけど|んだけど|だけど|けど|お願い|おねがい|ください|よろしく|です|ます|だよ|かな|ような|ように|よう|みたい|みたいな|感じ|かんじ|ね|よ|な|もの|やつ|なにか|何か|なんか|一つ|ひとつ|一枚|いちまい|新しい|あたらしい|新しく|あたらしく)$/;
/**
 * R13 (client): in the app a generation prompt is a 「スペル」, but members also say プロンプト (ぷろんぷと, ﾌﾟﾛﾝﾌﾟﾄ,
 * prompt), 呪文 (じゅもん), 指示文 or プロンプト文 — all of them mean the spell ({bati} answers with スペル, never
 * correcting). A collection of them (プロンプト集 / 呪文帳 …) is the スペルブック.
 */
const SPELL_ALIAS = String.raw`(?:プロンプト|ぷろんぷと|ﾌﾟﾛﾝﾌﾟﾄ|(?<![A-Za-zＡ-Ｚａ-ｚ])(?:prompts?|ｐｒｏｍｐｔ[ｓ]?)(?![A-Za-zＡ-Ｚａ-ｚ])|呪文|じゅもん|ジュモン|ｼﾞｭﾓﾝ|指示文|しじぶん)(?:文|ぶん)?`;
const SPELL_ALIAS_BOOK = new RegExp(`(?:${SPELL_ALIAS}|スペル)(?:集|しゅう|帳|ちょう|書|ブック|ぶっく|一覧|いちらん|リスト|ノート)`, 'gi');
const SPELL_ALIAS_ONE = new RegExp(SPELL_ALIAS, 'gi');
/** the member's words with プロンプト / 呪文 / 指示文 (and their collections) said as スペル / スペルブック */
export function spellSaid(text: string): string {
  return text.replace(SPELL_ALIAS_BOOK, 'スペルブック').replace(SPELL_ALIAS_ONE, 'スペル');
}
/** a word that only names the spell itself (スペル, プロンプト, 呪文 …, このスペル): never a talisman */
export function isSpellWord(word: string): boolean {
  return /^(この|その|あの|いまの|今の)?スペル(ブック)?$/.test(spellSaid(word.trim()));
}
/** 「このスペルに」「プロンプトを」: the spell named as the thing being changed (not what it is about) */
const THE_SPELL = /(この|その|あの|いまの|今の)?スペル(ブック)?(に|を|で|の|は|から|へ|も|って)?(?!で(作|つく|描|か|生成|お願い|おねがい))/g;

/** the words with the request taken off (kept: what it is about, the dictionary words) */
export function spellWordsOnly(said: string): string {
  return spellSaid(said.trim()).replace(GREETING, '').replace(BY_MAGIC, '、').replace(THE_SPELL, '、');
}

/** the free words (what it is about) as tags: common ones from THEMES, others as they are (their English: the words) */
function themes(rest: string): SpellTag[] {
  const chunks = rest
    .replace(KIND_WORDS, '、')
    .replace(ASKING, '、')
    .split(/[、。,.!！?？\s　]+|(?<=[\p{sc=Han}\p{sc=Katakana}ー])(?:の|と|や|で|に|を|が|は|な)(?=.)|の(?=[\p{sc=Han}\p{sc=Katakana}])/u)
    .map((c) => c.replace(/^(の|や|で|に|を|が|は|な)+|(の|と|や|で|に|を|が|は|な|も|感じ|っぽい|みたいな?|する|して|した|ような|ように|よう|なんだけど|んだけど|だけど|けど)+$/g, '').trim())
    .filter((c) => c && !FILLER.test(c) && !NOT_CONTENT.test(c) && !isSpellWord(c));
  const out: SpellTag[] = [];
  for (const c of chunks) {
    const t = THEMES.find(([re]) => re.test(c));
    const tag: SpellTag = t ? { ja: t[1], en: t[2], group: 'theme' } : { ja: c.slice(0, 12), en: c.slice(0, 40), group: 'theme' };
    if (!out.some((o) => same(o, tag))) out.push(tag);
  }
  return out.slice(0, 4);
}

/** a book's / a game's free words: the bits of grammar left over (「新しい」「来て」「ちょっ」) are not tags */
const CRAFT: SpellKind[] = ['novel', 'chapter', 'game'];
const scrap = (t: SpellTag) => /^[\p{sc=Hiragana}ー]{1,4}$/u.test(t.ja) || ([...t.ja].length <= 3 && /(て|っ|た|い|く|に)$/.test(t.ja));
const freeWords = (kind: SpellKind, rest: string) => (CRAFT.includes(kind) ? themes(rest).filter((t) => !scrap(t)) : themes(rest));

/** a fresh spell for the words: the tags they name, what it is about, then the kind's own defaults */
export function spellFrom(kind: SpellKind, said: string): SpellTag[] {
  const n = named(kind, spellWordsOnly(said));
  const tags = [...freeWords(kind, n.rest), ...n.tags];
  for (const [g, ja] of Object.entries(DEFAULTS[kind]) as [SpellGroup, string][]) if (!tags.some((t) => t.group === g)) tags.push(tagOf(byJa(ja)));
  if (kind === 'song') {
    const mood = tags.find((t) => t.group === 'mood')?.en;
    if (!tags.some((t) => t.group === 'tempo')) tags.push(tagOf(byJa(mood === 'mellow' || mood === 'bittersweet' || mood === 'calm' ? 'ゆっくり' : mood === 'energetic' || mood === 'joyful' ? 'アップテンポ' : 'ふつうの速さ')));
    if (!tags.some((t) => t.group === 'instrument')) for (const ja of INSTRUMENTS[tags.find((t) => t.group === 'genre')!.en] ?? []) tags.push(tagOf(byJa(ja)));
  }
  return sortTags(tags).slice(0, SPELL_MAX_TAGS[kind]);
}

/** one answer to one of {bati}'s questions: the group its free words go into (the book's world, the hero …) */
export type SpellAnswer = { group?: SpellGroup; said: string };
const LEAVE_IT = /^(おまかせ|お任せ|まかせる|任せる|なんでも|何でも|なんでもいい|わからない|べつに|特に(ない)?|バティが決めて|決めて)[！!。、]*$/;

/**
 * client 2026-11-25 (本・ゲーム): {bati} asks 2–4 short questions, then distils the answers into one spell — the
 * dictionary tags each answer names, its other words as a tag of the question's group (Q「主人公はだれ？」→
 * 「メガネの少年」 is the hero), then the kind's defaults for whatever was not said. At most SPELL_MAX_TAGS; the
 * member's extra words go first when there are too many, the defaults never.
 */
/** the groups the words already name (a question about them need not be asked) */
export function spellNamedGroups(kind: SpellKind, said: string): SpellGroup[] {
  return [...new Set(named(kind, said).tags.map((t) => t.group))];
}

export function spellOfAnswers(kind: SpellKind, answers: SpellAnswer[]): SpellTag[] {
  const tags: SpellTag[] = [];
  const add = (t: SpellTag) => {
    if (tags.some((o) => same(o, t))) return;
    if (ONE.includes(t.group) && tags.some((o) => o.group === t.group)) return;
    tags.push(t);
  };
  for (const a of answers) {
    const said = a.said.trim();
    if (!said || LEAVE_IT.test(said)) continue;
    const n = named(kind, said);
    const free = freeWords(kind, n.rest);
    const g = a.group && a.group !== 'theme' ? a.group : null;
    // a hero / a world in the member's own short words keeps them (「メガネの少年」, not just 男の子); the English behind it
    // is the dictionary's with the extra words (the API's model rewrites it in English)
    const own = said.replace(/[、。！!？?\s　]+$/, '').replace(/(で|が|かな|がいい|にする|にして)$/, '');
    const hit = g && (g === 'hero' || g === 'world') && free.length && [...own].length <= 10 ? n.tags.find((t) => t.group === g) : undefined;
    for (const t of n.tags) add(t === hit ? { ...t, ja: own, en: `${free.map((f) => f.ja).join(' ')} ${t.en}` } : t);
    if (hit) continue;
    // the answer's own words are the question's tag (「しゃべるペンギン」 is the hero); when the dictionary already said
    // it (「メガネの少年」 → 男の子), the words around it are only its colour
    if (g && !n.tags.some((t) => t.group === g) && free.length) add({ ...free[0], group: g });
    else if (!n.tags.length) for (const t of free.slice(0, 2)) add(t);
  }
  for (const [g, ja] of Object.entries(DEFAULTS[kind]) as [SpellGroup, string][]) if (!tags.some((t) => t.group === g)) tags.push(tagOf(byJa(ja)));
  const out = sortTags(tags);
  while (out.length > SPELL_MAX_TAGS[kind]) {
    let i = -1;
    for (let k = out.length - 1; k >= 0 && i < 0; k--) if (out[k].group === 'theme' || out[k].group === 'mood' || out[k].group === 'rule') i = k;
    out.splice(i < 0 ? out.length - 1 : i, 1);
  }
  return out;
}

const LEVELS = ['かんたん', 'ふつう', 'むずかしい', 'とてもむずかしい'];
/** 「もっと難しく」「もっとかんたんに」: the game's level one step up / down from the one there */
export function levelStep(tags: SpellTag[], said: string): SpellTag | null {
  const up = /難しく|むずかしく|難しい|むずかしい|ハード|レベル(を)?上げ/.test(said);
  const down = /かんたん|簡単|やさしく|やさしめ|レベル(を)?下げ/.test(said);
  if (up === down) return null;
  const now = LEVELS.indexOf(tags.find((t) => t.group === 'level')?.ja ?? 'ふつう');
  const next = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, (now < 0 ? 1 : now) + (up ? 1 : -1)))];
  return tagOf(byJa(next));
}

const REMOVE = /外して|はずして|消して|けして|なくして|抜いて|ぬいて|取って|とって|いらない|やめて|なしで|なしに|なし$|じゃなくて|ではなく/;

/**
 * the spell changed by the member's words: 「〇〇は外して」 takes the tags it names off; anything else puts the tags it
 * names on (「ピアノも足して」「もっと明るく」「ロックにして」 — a genre / tempo / touch replaces the one there, a mood takes
 * its opposite off); free words with 足して / 入れて become a tag of their own
 */
export function spellEdit(kind: SpellKind, tags: SpellTag[], said0: string): SpellView {
  const said = spellWordsOnly(said0);
  const removed: SpellTag[] = [];
  const added: SpellTag[] = [];
  let out = [...tags];
  const take = (pred: (t: SpellTag) => boolean) => {
    for (const t of out.filter(pred)) removed.push(t);
    out = out.filter((t) => !pred(t));
  };
  const kept = keptOf(kind, said);
  const isKept = (t: SpellTag) => kept.some((k) => same(k, t));
  // R13 fix (client: 「プロンプトをピアノ系からEDM系にしてほしい」): 「AからBに」「A系からB系に」「AじゃなくてB」「AをやめてBに」
  // — what A names goes, what B names comes in
  const genre0 = out.find((t) => t.group === 'genre');
  const sw = switchOf(said);
  let add: SpellTag[];
  if (sw) {
    const from = named(kind, sw.from);
    const fromWords = themes(from.rest);
    take((t) => !isKept(t) && (from.tags.some((x) => same(x, t)) || fromWords.some((w) => t.ja === w.ja)));
    const to = named(kind, sw.to);
    add = to.tags.length ? to.tags : themes(to.rest).slice(0, 2);
  } else {
    if (REMOVE.test(said)) {
      const target = said.split(REMOVE)[0];
      const n = named(kind, target);
      const words = themes(n.rest);
      take((t) => n.tags.some((x) => same(x, t)) || words.some((w) => t.ja.includes(w.ja) || w.ja.includes(t.ja)));
      return { tags: out, added, removed };
    }
    // a game: 「もっと難しく」 is the level one step up (not a word of its own)
    const step = kind === 'game' ? levelStep(out, said) : null;
    const n = named(kind, step ? said.replace(/もっと|とても|難し[いく]?|むずかし[いく]?|かんたんに|簡単に|やさしく|やさしめ|ハード|に|して/g, '、') : said);
    add = [...(step ? [step] : []), ...n.tags.filter((t) => !step || t.group !== 'level')];
    if (/足して|たして|加えて|くわえて|入れて|いれて|追加|も(ほしい|入れ|欲しい)/.test(said) || !add.length) for (const t of themes(n.rest)) add.push(t);
  }
  for (const t of add) {
    if (out.some((o) => same(o, t))) continue;
    if (ONE.includes(t.group)) take((o) => o.group === t.group);
    if (t.group === 'mood') take((o) => o.group === 'mood' && (OPPOSITE[t.en] ?? []).includes(o.en));
    out.push(t);
    added.push(t);
  }
  // a song's genre switch: the old genre's own instruments go (an electronic genre lets the acoustic ones go too), the new
  // genre's come in — the instruments the member keeps (「ピアノはそのままで」) or names stay
  const genre1 = out.find((t) => t.group === 'genre');
  if (kind === 'song' && genre1 && genre1 !== genre0 && added.includes(genre1)) {
    const was = genre0 ? (INSTRUMENTS[genre0.en] ?? []) : [];
    const next = INSTRUMENTS[genre1.en] ?? [];
    const acoustic = ELECTRONIC.has(genre1.en) ? ['ピアノ', 'ギター', 'ストリングス', 'バイオリン', 'ウクレレ', 'サックス'] : [];
    take((t) => t.group === 'instrument' && !isKept(t) && !add.some((a) => same(a, t)) && !next.includes(t.ja) && (was.includes(t.ja) || acoustic.includes(t.ja)));
    for (const ja of next) {
      const t = tagOf(byJa(ja));
      if (out.some((o) => same(o, t))) continue;
      out.push(t);
      added.push(t);
    }
  }
  // a tag both taken off and put back is neither
  const back = removed.filter((r) => added.some((a) => same(a, r)));
  return { tags: sortTags(out).slice(0, Math.min(16, SPELL_MAX_TAGS[kind] + 2)), added: added.filter((a) => !back.some((b) => same(a, b))), removed: removed.filter((r) => !back.includes(r)) };
}

/** 「AからBに」「A系からB系へ」「AじゃなくてB」「AをやめてBに」「AよりBがいい」: the two sides, or null */
function switchOf(said: string): { from: string; to: string } | null {
  const m = said.match(/^(.*?[^\s、。])(?:系|っぽい(?:の|感じ)?|風|のやつ|の感じ)?(?:から|じゃなくて|じゃなく|ではなく|をやめて|はやめて|やめて|より)[、\s　]*(.+?)$/);
  if (!m) return null;
  const from = m[1].replace(/^[、\s　]+/, '');
  const to = m[2].replace(/(系|っぽく|っぽい|風)?(に|へ|で|が)?(して|したい|する|変えて|かえて|変更|チェンジ|お願い|おねがい|ほしい|欲しい|ください|くれる|ちょうだい|いい|にしたい)*(ほしい|欲しい|ください|な|ね|よ)*[。！!？?]*$/, '');
  if (!from.trim() || !to.trim()) return null;
  return { from, to };
}

/** 「ピアノはそのままで」「ピアノは残して」: the tags the member keeps through a change */
function keptOf(kind: SpellKind, said: string): SpellTag[] {
  const out: SpellTag[] = [];
  for (const m of said.matchAll(/([^、。\s　]{1,16}?)(?:は|も)?(?:そのまま|残して|のこして|残す|キープ|入れたまま|いれたまま)/g)) out.push(...named(kind, m[1]).tags);
  return out;
}

/** R13 fix: the words name a song genre (「EDM系にして」「ラップにして」): a change of the style spell, not of the lyrics */
export function songGenreNamed(said: string): boolean {
  return named('song', spellWordsOnly(said)).tags.some((t) => t.group === 'genre');
}

/** a tag taken off by tapping it */
export function spellDrop(tags: SpellTag[], en: string): SpellView {
  const removed = tags.filter((t) => t.en === en);
  return { tags: tags.filter((t) => t.en !== en), added: [], removed };
}

/**
 * the dictionary's own labels for the model's pairs (a common tag always reads the same), the rest clipped; no
 * repeats, one per single group
 */
export function spellNormalize(kind: SpellKind, pairs: { ja?: unknown; en?: unknown; group?: unknown }[]): SpellTag[] {
  const out: SpellTag[] = [];
  for (const p of pairs) {
    if (typeof p.ja !== 'string' || typeof p.en !== 'string' || !p.ja.trim() || !p.en.trim()) continue;
    const ja = p.ja.trim();
    const hit = SPELL_DICTIONARY.find((x) => fits(x, kind) && (x.ja === ja || x.en.toLowerCase() === p.en!.toString().trim().toLowerCase())) ?? SPELL_DICTIONARY.find((x) => fits(x, kind) && x.re.test(ja) && ja.length <= x.ja.length + 2);
    const group = (SPELL_GROUPS as readonly string[]).includes(p.group as string) ? (p.group as SpellGroup) : 'theme';
    const t: SpellTag = hit ? tagOf(hit) : { ja: ja.slice(0, 12), en: p.en.trim().replace(/[^\x20-\x7e]/g, '').slice(0, 60) || ja.slice(0, 40), group };
    if (out.some((o) => same(o, t)) || (ONE.includes(t.group) && out.some((o) => o.group === t.group))) continue;
    out.push(t);
  }
  return sortTags(out).slice(0, 16);
}

const PREFIX: Record<SpellKind, string> = { song: 'song', art: 'illustration', video: 'music video made of still pictures that move', look: 'character look', bati: 'character outfit', novel: 'story', chapter: 'next chapter', game: 'small HTML5 canvas game' };
/** the English prompt the generator is given (built from the tags as they are now) */
export function spellPrompt(kind: SpellKind, tags: SpellTag[]): string {
  const g = (k: SpellGroup) => tags.filter((t) => t.group === k).map((t) => t.en);
  const about = g('theme');
  const rest = tags.filter((t) => t.group !== 'theme').map((t) => t.en);
  if (kind === 'song') {
    const parts = [`${[...g('mood'), ...g('genre')].join(' ')} song`.trim(), about.length && `about ${about.join(', ')}`, g('tempo').join(', '), g('instrument').length && `featuring ${g('instrument').join(', ')}`, g('voice').join(', ')];
    return parts.filter(Boolean).join(', ');
  }
  if (kind === 'novel') {
    const parts = [`${[...g('mood'), ...g('genre')].join(' ')} story`.trim(), g('world').length && `set in ${g('world').join(', ')}`, g('hero').length && `the hero is ${g('hero').join(', ')}`, about.length && `about ${about.join(', ')}`, ...g('length')];
    return parts.filter(Boolean).join('; ');
  }
  if (kind === 'chapter') return [`next chapter: ${[...g('event'), ...about].join(', ') || "the writer's own idea of what happens next"}`, g('mood').length && `mood: ${g('mood').join(', ')}`, g('hero').length && `featuring ${g('hero').join(', ')}`].filter(Boolean).join('; ');
  if (kind === 'game') {
    const look = [...g('color'), ...g('style'), ...g('mood')];
    const parts = [`${PREFIX.game}: ${g('genre').join(', ') || 'collect game'}`, g('hero').length && `the player is ${g('hero').join(', ')}`, about.length && `about ${about.join(', ')}`, g('rule').length && `rules: ${g('rule').join(', ')}`, g('goal').length && `goal: ${g('goal').join(', ')}`, g('level').length && `difficulty: ${g('level').join(', ')}`, look.length && `look: ${look.join(', ')}`];
    return parts.filter(Boolean).join('; ');
  }
  if (kind === 'video') {
    // R13: only what the pictures look like (what it is for, the song, the scenes, the camera … are the pipeline's settings)
    const look = tags.filter((t) => ['style', 'mood', 'color', 'light', 'composition', 'wear', 'hero', 'world'].includes(t.group)).map((t) => t.en);
    return [PREFIX.video, about.length && `of ${about.join(', ')}`, ...look].filter(Boolean).join(', ');
  }
  return [PREFIX[kind], about.length && `of ${about.join(', ')}`, ...rest].filter(Boolean).join(', ');
}

/** the Japanese words of the spell (for a song's lyrics, the art's words) */
export function spellWords(tags: SpellTag[]): string {
  return tags.map((t) => t.ja).join('、');
}

/** R12: the labels a kind's spell gets when the words did not say them (a spell book match leaves them out) */
export function spellDefaultLabels(kind: SpellKind): string[] {
  return Object.values(DEFAULTS[kind]).filter((x): x is string => !!x);
}

/**
 * R12 (コンパス): a spell read from a picture / a song, completed with the kind's own defaults for the groups it did not
 * read (a song always has a genre, a tempo and a voice), in the usual order, at most SPELL_MAX_TAGS
 */
export function spellComplete(kind: SpellKind, tags: SpellTag[]): SpellTag[] {
  const out = [...tags];
  for (const [g, ja] of Object.entries(DEFAULTS[kind]) as [SpellGroup, string][]) if (!out.some((t) => t.group === g)) out.push(tagOf(byJa(ja)));
  if (kind === 'song') {
    const mood = out.find((t) => t.group === 'mood')?.en;
    if (!out.some((t) => t.group === 'tempo')) out.push(tagOf(byJa(mood === 'mellow' || mood === 'bittersweet' || mood === 'calm' ? 'ゆっくり' : mood === 'energetic' || mood === 'joyful' ? 'アップテンポ' : 'ふつうの速さ')));
    if (!out.some((t) => t.group === 'instrument')) for (const ja of INSTRUMENTS[out.find((t) => t.group === 'genre')!.en] ?? ['ピアノ']) out.push(tagOf(byJa(ja)));
  }
  return sortTags(out).slice(0, SPELL_MAX_TAGS[kind]);
}

/** the spell's fingerprint: the yes is tied to exactly this tag set (MakeConfirm.spell) */
export function spellKey(kind: SpellKind, tags: SpellTag[]): string {
  const s = `${kind}|${tags.map((t) => `${t.group}:${t.en}:${t.ja}`).join('|')}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${kind}-${tags.length}-${h.toString(16).padStart(8, '0')}`;
}
