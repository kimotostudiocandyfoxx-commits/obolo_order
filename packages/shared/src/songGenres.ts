import type { SpellGroup, SpellTag } from './spell';

/**
 * R14 (client 2026-11-25, iPad: 「サイケデリックトランスの曲」 came back as サイトラ + ポップ・明るい・ふつうの速さ・ピアノ・
 * ドラム・やさしい歌声): what each common genre sounds like. The API's model builds the spell first (it knows the genres);
 * this table is the floor under it — the defaults that may only fill a group the model (or the words) left empty, and
 * always ones that belong to the genre (no piano and soft vocals for psytrance), the rules' spell without a model, the
 * demo's spells, and the guidance the lyrics writer gets (psytrance: sparse, repeated, mantra-like phrases; a ballad:
 * full verses).
 */

/** one talisman of a song's sound (an instrument, a voice, a mood, a tempo) the genres use */
type SoundTag = { ja: string; en: string; group: SpellGroup; re: RegExp };
const s = (ja: string, en: string, group: SpellGroup, re: RegExp): SoundTag => ({ ja, en, group, re });

/**
 * the sound talismans the genres need beyond the R11 dictionary (song only; the dictionary takes them in after its own,
 * so 「ピアノ」「ドラム」 stay what they were)
 */
export const SONG_SOUND_TAGS: SoundTag[] = [
  // instruments, FX
  s('うねるベース', 'rolling 16th-note bassline', 'instrument', /うねるベース|ローリングベース|ころがるベース|転がるベース|ローリング/),
  s('アシッドシンセ', 'squelchy acid 303 synth', 'instrument', /アシッド|303/),
  s('サイケな効果音', 'trippy psychedelic FX, swirling delays', 'instrument', /サイケな効果音|効果音|エフェクト|(?<![A-Za-z])FX(?![A-Za-z])/i),
  s('スーパーソウ', 'supersaw synth leads', 'instrument', /スーパーソウ|supersaw/i),
  s('シンセリード', 'big festival synth lead', 'instrument', /シンセリード|リードシンセ/),
  s('パッド', 'lush atmospheric pads', 'instrument', /パッド/),
  s('アルペジオ', 'arpeggiated synth', 'instrument', /アルペジオ|アルペ/),
  s('ウォブルベース', 'wobble bass', 'instrument', /ウォブルベース|ウォブル|ワブル/),
  s('ブレイクビーツ', 'fast chopped breakbeats', 'instrument', /ブレイクビーツ|ブレイクビート/),
  s('リースベース', 'reese bass', 'instrument', /リースベース|リース/),
  s('サブベース', 'deep sub bass', 'instrument', /サブベース|低音|重低音/),
  s('ボーカルチョップ', 'chopped vocal samples', 'instrument', /ボーカルチョップ|声ネタ|ボイスサンプル/),
  s('レコードのノイズ', 'vinyl crackle', 'instrument', /レコードのノイズ|ヴァイナル|バイナル|チリチリ/),
  s('ゆるいドラム', 'dusty laid-back drums', 'instrument', /ゆるいドラム|もたったドラム/),
  s('ローズピアノ', 'Rhodes electric piano', 'instrument', /ローズピアノ|ローズ|エレピ|エレクトリックピアノ/),
  s('ブラス', 'brass section', 'instrument', /ブラス|ホーン|トランペット|ラッパ/),
  s('カッティングギター', 'funky guitar cutting', 'instrument', /カッティングギター|カッティング/),
  s('スラップベース', 'slap bass', 'instrument', /スラップベース|スラップ|チョッパーベース|チョッパー/),
  s('ハイハット連打', 'rapid trap hi-hat rolls', 'instrument', /ハイハット連打|ハイハット/),
  s('歪んだギター', 'heavy distorted guitars', 'instrument', /ディストーション|歪ん|ひずん|ゴリゴリのギター/),
  s('ツーバス', 'double-kick drums', 'instrument', /ツーバス|ツインペダル|ツーバスドラム/),
  s('オルガン', 'organ', 'instrument', /オルガン/),
  s('クワイア', 'choir', 'instrument', /クワイア|聖歌隊|合唱団/),
  s('尺八', 'shakuhachi flute', 'instrument', /尺八/),
  s('三味線', 'shamisen', 'instrument', /三味線|しゃみせん/),
  s('和太鼓', 'taiko drums', 'instrument', /和太鼓/),
  s('ピコピコ音', 'chiptune square-wave leads', 'instrument', /ピコピコ/),
  s('ナイロンギター', 'nylon-string guitar', 'instrument', /ナイロンギター|ナイロン|ガットギター/),
  s('パーカッション', 'latin percussion', 'instrument', /パーカッション|コンガ|ボンゴ|マラカス/),
  s('オフビートギター', 'offbeat skank guitar', 'instrument', /オフビートギター|オフビート|裏打ち/),
  s('轟音ギター', 'walls of reverb-drenched guitars', 'instrument', /轟音ギター|轟音/),
  s('迫力の打楽器', 'epic cinematic percussion', 'instrument', /ティンパニ|迫力の打楽器/),
  s('フィールド録音', 'field recordings, nature sounds', 'instrument', /環境音|フィールド録音|自然の音/),
  s('80年代ドラム', '1980s gated-reverb drums', 'instrument', /80年代ドラム|ゲートリバーブ/),
  s('ウッドベース', 'upright bass', 'instrument', /ウッドベース|コントラバス/),
  s('ハードキック', 'distorted hard kick', 'instrument', /ハードキック/),
  s('ハーモニカ', 'harmonica', 'instrument', /ハーモニカ/),
  s('バンジョー', 'banjo', 'instrument', /バンジョー/),
  // voices (one per spell)
  s('歌なし', 'instrumental, no vocals', 'voice', /歌なし|歌無し|ボーカルなし|ボーカル無し|インストで|インストの曲|インストゥルメンタル/),
  s('声すこしだけ', 'minimal vocals, a few short chanted phrases', 'voice', /声すこし|声少し|声はちょっと|ちょっとだけ声|声ちょっと/),
  s('浮遊する声', 'ethereal floating vocals', 'voice', /浮遊|ふわっとした声|エーテル|幻想的な声/),
  s('ボーカルサンプル', 'short vocal hooks and vocal samples', 'voice', /ボーカルサンプル/),
  s('ソウルフルな声', 'soulful vocals', 'voice', /ソウルフル/),
  s('ラップの声', 'rap vocals', 'voice', /ラップの声|ラップで歌|ラップ入り/),
  s('オートチューン', 'auto-tuned vocals', 'voice', /オートチューン|ケロケロ/),
  s('こぶし', 'enka vocals with kobushi vibrato', 'voice', /こぶし/),
  s('ゴスペル合唱', 'gospel choir vocals', 'voice', /ゴスペル合唱|聖歌/),
  s('ボカロ声', 'synthetic vocaloid-style voice', 'voice', /ボカロ声|ボカロの声|機械っぽい声/),
  s('みんなで歌う', 'group unison vocals', 'voice', /みんなで歌|グループで歌|ユニゾン/),
  s('ハスキーな声', 'husky vocals', 'voice', /ハスキー/),
  s('気だるい声', 'hazy dreamy vocals buried in the mix', 'voice', /気だるい|けだるい|アンニュイ/),
  s('叫ぶ歌声', 'emotional strained vocals', 'voice', /叫ぶ|さけぶ|絶叫/),
  // moods
  s('催眠的', 'hypnotic', 'mood', /催眠|ヒプノ|中毒性/),
  s('トリッピー', 'trippy, psychedelic', 'mood', /トリッピー|サイケ|幻覚|ぐるぐる/),
  s('宇宙っぽい', 'cosmic', 'mood', /宇宙っぽ|コズミック|宇宙的/),
  s('高揚感', 'euphoric, uplifting', 'mood', /高揚|アゲアゲ|アガる|ユーフォリック/),
  s('ノリノリ', 'groovy', 'mood', /ノリノリ|のりのり|ノリのいい|ノリがいい|ノリの良い|グルーヴ|グルーブ|踊れる/),
  s('チル', 'chill, relaxed', 'mood', /チル|まったり|リラックス/),
  s('ノスタルジック', 'nostalgic', 'mood', /ノスタル|なつかし|懐かし|レトロ/),
  s('壮大', 'epic, cinematic', 'mood', /壮大|エピック|スケールの大き/),
  s('おしゃれ', 'stylish, sophisticated', 'mood', /おしゃれ|オシャレ|お洒落|洗練/),
  s('攻撃的', 'aggressive', 'mood', /攻撃的|激しめ|ゴリゴリ|ヘヴィ|ヘビー/),
  s('かわいい', 'cute', 'mood', /かわいい|可愛|カワイイ|キュート/),
  s('ミステリアス', 'mysterious', 'mood', /ミステリアス|神秘/),
  s('疾走感', 'driving, high energy', 'mood', /疾走|スピード感/),
  s('情熱的', 'passionate', 'mood', /情熱|アツい/),
  s('エモい', 'emotional, heartfelt', 'mood', /エモい|エモく|エモー/),
];

/** how a genre is sung: full verses, a few repeated phrases, or (nearly) none */
export type GenreLyrics = 'full' | 'sparse' | 'instrumental';
export type GenreFamily = 'electronic' | 'band' | 'pop' | 'acoustic' | 'jazz' | 'urban' | 'orchestral' | 'traditional' | 'chill';
export interface SongGenre {
  /** the talisman's label (natural Japanese: サイケデリックトランス, not サイトラ) */
  ja: string;
  /** what the music engine is given */
  en: string;
  /** the words that name it (the longer names before the ones inside them: サイケデリックトランス before トランス) */
  re: RegExp;
  family: GenreFamily;
  bpm: [number, number];
  /** the genre's tempo: a BPM, or a tempo talisman's label (アップテンポ / ゆっくり); none: by the mood */
  tempo?: number | 'アップテンポ' | 'ゆっくり';
  /** the defaults by label (a mood, the instruments, a voice) — only for groups left empty */
  mood: string;
  instruments: string[];
  voice: string;
  lyrics: GenreLyrics;
  /** one line of guidance for the model and the lyrics writer */
  guide: string;
  /** labels that go against the genre (never added as a default; taken off on a switch to it unless kept) */
  avoid?: string[];
}

const ACOUSTIC = ['ピアノ', 'ギター', 'ストリングス', 'バイオリン', 'ウクレレ', 'サックス', 'ナイロンギター'];
const SOFT = ['やさしい歌声', 'ふつうの速さ', 'ゆっくり'];
const g = (x: SongGenre): SongGenre => x;

/**
 * the ~50 common genres (dictionary order: the first match wins, so a name inside a longer one comes after it).
 * The R11–R13 genres keep their labels and English (ポップ・ロック・EDM …) so the spells made before read the same.
 */
export const SONG_GENRES: SongGenre[] = [
  // electronic: trance family first (サイケデリックトランス / ゴアトランス / プログレッシブトランス before トランス)
  g({ ja: 'サイケデリックトランス', en: 'psychedelic trance (psytrance)', re: /サイケデリック・?トランス|サイケ・?トランス|サイトラ|サイケデリックトランス|psy-?trance|psychedelic trance|フルオン/i, family: 'electronic', bpm: [140, 148], tempo: 145, mood: '催眠的', instruments: ['うねるベース', 'アシッドシンセ', '四つ打ち', 'サイケな効果音'], voice: '声すこしだけ', lyrics: 'sparse', guide: 'psytrance: 140-148 BPM, driving four-on-the-floor kick with a rolling 16th-note offbeat bassline, squelchy acid 303 lines, hypnotic repetition, trippy swirling FX and long builds; vocals minimal (short chanted or ethereal phrases) or none', avoid: [...ACOUSTIC, ...SOFT, 'ポップ', '明るい', 'ドラム', '力強い歌声'] }),
  g({ ja: 'ゴアトランス', en: 'goa trance', re: /ゴア・?トランス|ゴア系|goa ?trance|(?<![A-Za-z])goa(?![A-Za-z])/i, family: 'electronic', bpm: [140, 150], tempo: 145, mood: 'トリッピー', instruments: ['アシッドシンセ', 'うねるベース', '四つ打ち', 'アルペジオ'], voice: '歌なし', lyrics: 'instrumental', guide: 'goa trance: 140-150 BPM, melodic acid lines, eastern-sounding scales, rolling bass, layered arpeggios, cosmic and trippy; mostly instrumental', avoid: [...ACOUSTIC, ...SOFT, 'ポップ', 'ドラム'] }),
  g({ ja: 'プログレッシブトランス', en: 'progressive trance', re: /プログレッシブ・?トランス|プログレ・?トランス|progressive trance/i, family: 'electronic', bpm: [128, 136], tempo: 132, mood: '高揚感', instruments: ['パッド', 'アルペジオ', '四つ打ち', 'サブベース'], voice: '浮遊する声', lyrics: 'sparse', guide: 'progressive trance: 128-136 BPM, slowly evolving layers, warm pads and arpeggios, long builds and breakdowns, uplifting; few airy vocal lines', avoid: [...ACOUSTIC, ...SOFT, 'ポップ', 'ドラム'] }),
  g({ ja: 'ミニマルテクノ', en: 'minimal techno', re: /ミニマル・?テクノ|ミニマル系|ミニマルな曲|(?<![A-Za-z])minimal(?: techno)?(?![A-Za-z])/i, family: 'electronic', bpm: [124, 130], tempo: 126, mood: '催眠的', instruments: ['四つ打ち', 'サブベース', 'シンセ'], voice: '歌なし', lyrics: 'instrumental', guide: 'minimal techno: 124-130 BPM, stripped-down clicks and a deep kick, tiny evolving loops, hypnotic; instrumental', avoid: [...ACOUSTIC, ...SOFT, 'ポップ', '明るい', 'ドラム'] }),
  g({ ja: 'ハードスタイル', en: 'hardstyle', re: /ハードスタイル|hardstyle/i, family: 'electronic', bpm: [150, 160], tempo: 150, mood: '攻撃的', instruments: ['ハードキック', 'シンセリード', 'スーパーソウ'], voice: 'ボーカルサンプル', lyrics: 'sparse', guide: 'hardstyle: 150-160 BPM, distorted reverse-bass kicks, huge screeching leads, euphoric breakdowns; short shouted or anthemic vocal hooks', avoid: [...ACOUSTIC, ...SOFT, 'ポップ', 'ドラム'] }),
  g({ ja: 'ビッグルームEDM', en: 'big room EDM, festival anthem', re: /ビッグルーム|フェス系|フェスっぽ|big ?room/i, family: 'electronic', bpm: [126, 130], tempo: 128, mood: '高揚感', instruments: ['シンセリード', '四つ打ち', 'スーパーソウ'], voice: 'ボーカルサンプル', lyrics: 'sparse', guide: 'big room EDM: 126-130 BPM, long snare build, massive drop with a simple synth lead, festival energy; short vocal hooks', avoid: [...ACOUSTIC, ...SOFT, 'ポップ', 'ドラム'] }),
  g({ ja: 'フューチャーベース', en: 'future bass', re: /フューチャー・?ベース|future ?bass/i, family: 'electronic', bpm: [140, 160], tempo: 150, mood: 'エモい', instruments: ['スーパーソウ', 'ボーカルチョップ', 'サブベース'], voice: '女の子の声', lyrics: 'full', guide: 'future bass: 140-160 BPM half-time feel, lush detuned supersaw chords that swell, chopped vocal samples, emotional and bright; sung verses with a catchy hook', avoid: ['ピアノ', 'ギター', 'ふつうの速さ', 'ゆっくり', 'ドラム'] }),
  g({ ja: 'ドラムンベース', en: 'drum and bass', re: /ドラムン・?ベース|ドラム・?アンド・?ベース|ドラム&ベース|drum ?(?:&|and|n|'n') ?bass|(?<![A-Za-z])d(?:&|n)b(?![A-Za-z])|ドラムンベ/i, family: 'electronic', bpm: [170, 176], tempo: 174, mood: '疾走感', instruments: ['ブレイクビーツ', 'リースベース', 'パッド'], voice: '浮遊する声', lyrics: 'sparse', guide: 'drum and bass: 170-176 BPM, fast chopped breakbeats, deep rolling reese or sub bass, atmospheric pads; airy vocal lines or none', avoid: [...ACOUSTIC, ...SOFT, 'ポップ', 'ドラム', '四つ打ち'] }),
  g({ ja: 'ディープハウス', en: 'deep house', re: /ディープ・?ハウス|deep ?house/i, family: 'electronic', bpm: [118, 124], tempo: 122, mood: 'チル', instruments: ['四つ打ち', 'ローズピアノ', 'サブベース'], voice: 'ソウルフルな声', lyrics: 'sparse', guide: 'deep house: 118-124 BPM, warm four-on-the-floor, soft Rhodes chords, deep round bass, late-night and smooth; a few soulful vocal phrases', avoid: ['ギター', 'ストリングス', ...SOFT, 'ポップ', 'ドラム'] }),
  g({ ja: 'シンセウェイブ', en: 'synthwave, 1980s retro', re: /シンセ・?ウェ[イー]ブ|シンセウェーヴ|レトロウェ[イー]ブ|アウトラン|synth ?wave|retro ?wave|outrun/i, family: 'electronic', bpm: [90, 110], tempo: 100, mood: 'ノスタルジック', instruments: ['シンセ', 'アルペジオ', '80年代ドラム'], voice: '浮遊する声', lyrics: 'sparse', guide: 'synthwave: 90-110 BPM, analog synth arpeggios, gated-reverb 80s drums, neon night-drive nostalgia; few dreamy vocal lines', avoid: [...ACOUSTIC, 'やさしい歌声', 'ポップ', 'ドラム'] }),
  g({ ja: 'チップチューン', en: 'chiptune, 8-bit video game music', re: /チップチューン|チップ・?チューン|8ビット|８ビット|8-?bit|ファミコン|レトロゲーム|ゲーム音楽|chiptune/i, family: 'electronic', bpm: [140, 160], tempo: 150, mood: '楽しい', instruments: ['ピコピコ音', 'アルペジオ'], voice: '歌なし', lyrics: 'instrumental', guide: 'chiptune: 140-160 BPM, square and triangle wave leads, fast arpeggios, noise-channel drums, playful 8-bit game feel; instrumental', avoid: [...ACOUSTIC, ...SOFT, 'ポップ', 'ドラム'] }),
  g({ ja: 'アンビエント', en: 'ambient', re: /アンビエント|環境音楽|ambient/i, family: 'electronic', bpm: [60, 80], tempo: 'ゆっくり', mood: '静か', instruments: ['パッド', 'フィールド録音'], voice: '歌なし', lyrics: 'instrumental', guide: 'ambient: no beat or a very slow pulse, long evolving pads, field recordings, spacious and calm; instrumental', avoid: ['ドラム', '四つ打ち', 'アップテンポ', '力強い歌声', 'ポップ', '明るい'] }),
  g({ ja: 'ローファイヒップホップ', en: 'lo-fi hip hop beats', re: /ローファイ・?ヒップ・?ホップ|ロウファイ・?ヒップ・?ホップ|lo-?fi ?hip ?hop|チルホップ|chill ?hop/i, family: 'chill', bpm: [70, 90], tempo: 80, mood: 'チル', instruments: ['ローズピアノ', 'ゆるいドラム', 'レコードのノイズ'], voice: '歌なし', lyrics: 'instrumental', guide: 'lo-fi hip hop: 70-90 BPM, dusty swung drums, jazzy Rhodes chords, vinyl crackle, cozy study vibe; instrumental', avoid: ['アップテンポ', '力強い歌声', 'エレキギター', 'ポップ', '明るい'] }),
  g({ ja: 'トラップ', en: 'trap', re: /トラップ|(?<![A-Za-z])trap(?![A-Za-z])/i, family: 'urban', bpm: [130, 150], tempo: 140, mood: 'かっこいい', instruments: ['808ベース', 'ハイハット連打'], voice: 'ラップの声', lyrics: 'full', guide: 'trap: 130-150 BPM half-time, booming 808 bass, rapid hi-hat rolls, dark and hard; rap verses and a short hook', avoid: [...ACOUSTIC, 'やさしい歌声', 'ポップ', '明るい', 'ふつうの速さ', 'ドラム'] }),
  g({ ja: 'ユーロビート', en: 'eurobeat', re: /ユーロビート|パラパラ|eurobeat/i, family: 'electronic', bpm: [150, 160], tempo: 155, mood: '疾走感', instruments: ['シンセリード', '四つ打ち', 'ベース'], voice: '力強い歌声', lyrics: 'full', guide: 'eurobeat: 150-160 BPM, octave-jumping bass, bright synth brass leads, racing energy; big sung chorus', avoid: ['ギター', 'ピアノ', ...SOFT] }),
  // the R13 electronic genres (labels kept)
  g({ ja: 'ダブステップ', en: 'dubstep, heavy wobble bass', re: /ダブステップ|ダブステ|dubstep/i, family: 'electronic', bpm: [138, 142], tempo: 140, mood: '攻撃的', instruments: ['ウォブルベース', 'サブベース', 'シンセ'], voice: 'ボーカルサンプル', lyrics: 'sparse', guide: 'dubstep: 140 BPM half-time, heavy wobble and growl bass drops, sub bass; short vocal hooks', avoid: [...ACOUSTIC, ...SOFT, 'ポップ', 'ドラム'] }),
  g({ ja: 'ハウス', en: 'house music, four-on-the-floor', re: /ハウス|house/i, family: 'electronic', bpm: [120, 128], tempo: 124, mood: 'ノリノリ', instruments: ['シンセ', '四つ打ち'], voice: 'ソウルフルな声', lyrics: 'sparse', guide: 'house: 120-128 BPM, four-on-the-floor, offbeat hats, chord stabs, groovy; a few soulful vocal phrases', avoid: ['ギター', 'ストリングス', ...SOFT, 'ポップ'] }),
  g({ ja: 'テクノ', en: 'techno', re: /テクノ|techno/i, family: 'electronic', bpm: [125, 135], tempo: 130, mood: '催眠的', instruments: ['シンセ', '四つ打ち'], voice: '歌なし', lyrics: 'instrumental', guide: 'techno: 125-135 BPM, driving kick, hypnotic synth loops, dark and mechanical; instrumental or a spoken phrase', avoid: [...ACOUSTIC, ...SOFT, 'ポップ', '明るい'] }),
  g({ ja: 'トランス', en: 'trance, euphoric synth', re: /トランス|trance/i, family: 'electronic', bpm: [134, 140], tempo: 138, mood: '高揚感', instruments: ['シンセ', '四つ打ち'], voice: '浮遊する声', lyrics: 'sparse', guide: 'trance: 134-140 BPM, euphoric supersaw leads, long breakdown and build, four-on-the-floor; airy vocal lines', avoid: [...ACOUSTIC, ...SOFT, 'ポップ'] }),
  g({ ja: 'EDM', en: 'EDM, electronic dance music', re: /EDM|ＥＤＭ|イーディーエム|エレクトロニックダンス|エレクトロ|electro/i, family: 'electronic', bpm: [124, 130], tempo: 128, mood: '高揚感', instruments: ['シンセ', '四つ打ち'], voice: 'ボーカルサンプル', lyrics: 'sparse', guide: 'EDM: 124-130 BPM, build and drop, big synths, four-on-the-floor; short vocal hooks', avoid: [...ACOUSTIC, ...SOFT, 'ポップ'] }),
  // band
  g({ ja: 'シューゲイザー', en: 'shoegaze', re: /シューゲイザー|シューゲイズ|シューゲ|shoegaze/i, family: 'band', bpm: [90, 120], mood: '夢みたい', instruments: ['轟音ギター', 'ドラム', 'ベース'], voice: '気だるい声', lyrics: 'full', guide: 'shoegaze: walls of reverb-drenched guitars, washed-out dreamy haze, vocals soft and buried in the mix', avoid: ['ピアノ', '力強い歌声', 'ポップ'] }),
  g({ ja: 'エモ', en: 'emo rock', re: /エモ系|エモロック|エモの曲|(?<![A-Za-z])emo(?![A-Za-z])/i, family: 'band', bpm: [140, 180], tempo: 'アップテンポ', mood: '切ない', instruments: ['エレキギター', 'ドラム', 'ベース'], voice: '叫ぶ歌声', lyrics: 'full', guide: 'emo: urgent guitars, dynamic quiet-loud parts, heartfelt strained vocals', avoid: ['ピアノ', 'やさしい歌声', 'ゆっくり', 'ポップ'] }),
  g({ ja: 'J-ROCK', en: 'j-rock', re: /J-?ROCK|Ｊ-?ＲＯＣＫ|Jロック|Ｊロック|邦ロック/i, family: 'band', bpm: [130, 170], tempo: 'アップテンポ', mood: 'かっこいい', instruments: ['エレキギター', 'ドラム', 'ベース'], voice: '力強い歌声', lyrics: 'full', guide: 'j-rock: driving band sound, bright distorted guitars, tight drums, an anthemic chorus', avoid: ['ピアノ', 'やさしい歌声', 'ゆっくり', 'ポップ'] }),
  g({ ja: 'メタル', en: 'heavy metal', re: /メタル|metal/i, family: 'band', bpm: [140, 200], tempo: 'アップテンポ', mood: '攻撃的', instruments: ['歪んだギター', 'ツーバス', 'ベース'], voice: '力強い歌声', lyrics: 'full', guide: 'metal: heavy distorted riffs, double-kick drums, powerful sung or shouted vocals', avoid: ['ピアノ', 'やさしい歌声', 'ゆっくり', 'ふつうの速さ', 'ポップ', 'ドラム'] }),
  g({ ja: 'パンク', en: 'punk rock', re: /パンク|punk/i, family: 'band', bpm: [160, 200], tempo: 'アップテンポ', mood: '元気', instruments: ['エレキギター', 'ドラム', 'ベース'], voice: '力強い歌声', lyrics: 'full', guide: 'punk: fast, raw power chords, simple shouted gang choruses', avoid: ['ピアノ', 'ストリングス', 'やさしい歌声', 'ゆっくり', 'ふつうの速さ', 'ポップ'] }),
  g({ ja: 'ロック', en: 'rock', re: /ロック|rock/i, family: 'band', bpm: [110, 150], mood: 'かっこいい', instruments: ['エレキギター', 'ドラム'], voice: '力強い歌声', lyrics: 'full', guide: 'rock: electric guitars, live drums and bass, a strong sung chorus', avoid: ['やさしい歌声'] }),
  // pop and its kin (K-POP / シティポップ / アイドル before ポップ)
  g({ ja: 'シティポップ', en: '1980s city pop', re: /シティ・?ポップ|シティーポップ|city ?pop/i, family: 'pop', bpm: [95, 115], mood: 'おしゃれ', instruments: ['シンセ', 'ベース', 'カッティングギター'], voice: 'やさしい歌声', lyrics: 'full', guide: 'city pop: 1980s Japanese urban pop, funky bass and guitar cutting, glossy synths, night-city nostalgia; smooth sung vocals' }),
  g({ ja: 'アニソン', en: 'anime song, j-pop', re: /アニソン|アニメソング|アニメの(曲|歌)|アニメっぽい曲/, family: 'pop', bpm: [150, 180], tempo: 'アップテンポ', mood: '元気', instruments: ['エレキギター', 'ドラム', 'ストリングス'], voice: '力強い歌声', lyrics: 'full', guide: 'anime song: fast and dramatic j-pop rock, soaring chorus, strings and guitars, big key change', avoid: ['ゆっくり', 'やさしい歌声'] }),
  g({ ja: 'ボカロ', en: 'vocaloid-style j-pop, fast synth lines', re: /ボカロ|ボーカロイド|vocaloid/i, family: 'pop', bpm: [160, 200], tempo: 170, mood: '疾走感', instruments: ['シンセ', 'ドラム', 'ピアノ'], voice: 'ボカロ声', lyrics: 'full', guide: 'vocaloid-style: very fast, dense word-packed melody, synth and piano riffs, synthetic bright voice', avoid: ['ゆっくり', 'やさしい歌声'] }),
  g({ ja: 'アイドルポップ', en: 'idol pop', re: /アイドル(ソング|ポップ|系|っぽ|の曲|曲)?|idol/i, family: 'pop', bpm: [140, 170], tempo: 'アップテンポ', mood: 'かわいい', instruments: ['シンセ', 'ドラム', 'ストリングス'], voice: 'みんなで歌う', lyrics: 'full', guide: 'idol pop: bright and cute, energetic group unison vocals, call-and-response chant spots, sparkly synths', avoid: ['暗い', 'ゆっくり'] }),
  g({ ja: 'K-POP', en: 'k-pop', re: /K-?POP|Ｋ-?ＰＯＰ|ケーポップ|韓国の?(曲|歌|ポップ)/i, family: 'pop', bpm: [100, 130], mood: 'かっこいい', instruments: ['シンセ', '808ベース'], voice: 'みんなで歌う', lyrics: 'full', guide: 'k-pop: polished dance-pop, punchy 808s and synths, switches between sung and rapped parts, a hook-driven chorus', avoid: ['ギター', 'ゆっくり'] }),
  g({ ja: 'ポップ', en: 'pop', re: /ポップ|J-?POP|pop/i, family: 'pop', bpm: [100, 130], mood: '明るい', instruments: ['ピアノ', 'ドラム'], voice: 'やさしい歌声', lyrics: 'full', guide: 'pop: catchy melody, verse / pre-chorus / chorus, clear sung vocals' }),
  g({ ja: 'バラード', en: 'ballad', re: /バラード|ballad/i, family: 'acoustic', bpm: [60, 80], tempo: 'ゆっくり', mood: 'しっとり', instruments: ['ピアノ', 'ストリングス'], voice: 'やさしい歌声', lyrics: 'full', guide: 'ballad: slow, piano and strings, emotional full verses that build to a big final chorus', avoid: ['アップテンポ', '四つ打ち', '攻撃的'] }),
  // urban
  g({ ja: 'R&B', en: 'r&b, soul', re: /R&B|Ｒ＆Ｂ|R＆B|アールアンドビー|リズムアンドブルース|ソウル(?!フル)/i, family: 'urban', bpm: [70, 100], tempo: 'ゆっくり', mood: 'おしゃれ', instruments: ['ベース', 'ローズピアノ', 'ドラム'], voice: 'ソウルフルな声', lyrics: 'full', guide: 'r&b: smooth groove, warm keys and bass, soulful melismatic vocals' }),
  g({ ja: 'ゴスペル', en: 'gospel', re: /ゴスペル|gospel/i, family: 'urban', bpm: [70, 110], mood: '神々しい', instruments: ['オルガン', 'ピアノ', '手拍子'], voice: 'ゴスペル合唱', lyrics: 'full', guide: 'gospel: organ and piano, hand claps, a big uplifting choir answering the lead singer', avoid: ['シンセ', '四つ打ち'] }),
  g({ ja: 'ヒップホップ', en: 'hip hop', re: /ヒップホップ|ヒップ・ホップ|ラップ(?!トップ)|hip ?hop|(?<![A-Za-z])rap(?![A-Za-z])/i, family: 'urban', bpm: [85, 100], tempo: 90, mood: 'かっこいい', instruments: ['ドラム', 'ベース'], voice: 'ラップの声', lyrics: 'full', guide: 'hip hop: boom-bap or modern beat, rhythmic rap verses, a short sung or chanted hook', avoid: ['やさしい歌声'] }),
  g({ ja: 'ファンク', en: 'funk', re: /ファンク|funk/i, family: 'urban', bpm: [100, 120], mood: 'ノリノリ', instruments: ['スラップベース', 'カッティングギター', 'ブラス'], voice: 'ソウルフルな声', lyrics: 'full', guide: 'funk: tight syncopated groove on the one, slap bass, guitar cutting, brass stabs, shouted soulful vocals', avoid: ['ゆっくり', 'やさしい歌声'] }),
  g({ ja: 'ディスコ', en: 'disco', re: /ディスコ|disco/i, family: 'urban', bpm: [115, 125], tempo: 120, mood: 'ノリノリ', instruments: ['四つ打ち', 'ストリングス', 'スラップベース'], voice: 'ソウルフルな声', lyrics: 'full', guide: 'disco: four-on-the-floor with open hi-hats, octave bass, lush strings, a joyful sung chorus', avoid: ['ゆっくり'] }),
  g({ ja: 'ダンス', en: 'dance, EDM', re: /ダンス|クラブ/i, family: 'electronic', bpm: [120, 130], tempo: 126, mood: 'ノリノリ', instruments: ['シンセ', 'ドラム'], voice: 'ボーカルサンプル', lyrics: 'sparse', guide: 'dance: club beat, build and drop, synths; short vocal hooks', avoid: [...ACOUSTIC, ...SOFT] }),
  // jazz and world
  g({ ja: 'ジャズ', en: 'jazz', re: /ジャズ|jazz/i, family: 'jazz', bpm: [90, 140], mood: 'おしゃれ', instruments: ['ピアノ', 'サックス', 'ウッドベース'], voice: 'やさしい歌声', lyrics: 'full', guide: 'jazz: swing feel, piano, saxophone and upright bass, smooth vocals', avoid: ['四つ打ち', 'シンセ'] }),
  g({ ja: 'ボサノバ', en: 'bossa nova', re: /ボサノバ|ボサノヴァ|ボサ・ノバ|bossa ?nova/i, family: 'jazz', bpm: [110, 130], tempo: 'ゆっくり', mood: 'チル', instruments: ['ナイロンギター', 'パーカッション'], voice: 'やさしい歌声', lyrics: 'full', guide: 'bossa nova: gentle syncopated nylon-string guitar, soft brushes and shakers, murmured relaxed vocals', avoid: ['エレキギター', '四つ打ち', '力強い歌声'] }),
  g({ ja: 'レゲエ', en: 'reggae', re: /レゲエ|reggae/i, family: 'chill', bpm: [70, 90], tempo: 75, mood: 'チル', instruments: ['オフビートギター', 'ベース'], voice: 'やさしい歌声', lyrics: 'full', guide: 'reggae: laid-back one-drop rhythm, offbeat guitar skank, deep warm bass, sunny relaxed vocals', avoid: ['四つ打ち', 'アップテンポ'] }),
  g({ ja: 'ラテン', en: 'latin', re: /ラテン|サルサ|レゲトン|latin|salsa|reggaeton/i, family: 'urban', bpm: [95, 120], tempo: 'アップテンポ', mood: '情熱的', instruments: ['パーカッション', 'ブラス', 'ナイロンギター'], voice: '力強い歌声', lyrics: 'full', guide: 'latin: syncopated percussion, brass and guitar, hot and dancing, passionate vocals', avoid: ['ゆっくり'] }),
  g({ ja: 'カントリー', en: 'country', re: /カントリー|country/i, family: 'acoustic', bpm: [90, 120], mood: 'やさしい', instruments: ['ギター', 'バンジョー', 'バイオリン'], voice: 'やさしい歌声', lyrics: 'full', guide: 'country: acoustic guitar, banjo and fiddle, storytelling verses, warm twang', avoid: ['シンセ', '四つ打ち'] }),
  g({ ja: 'ブルース', en: 'blues', re: /ブルース|blues/i, family: 'band', bpm: [60, 90], tempo: 'ゆっくり', mood: '切ない', instruments: ['エレキギター', 'ピアノ', 'ハーモニカ'], voice: 'ハスキーな声', lyrics: 'full', guide: 'blues: 12-bar shuffle, expressive guitar bends, harmonica, husky soulful vocals', avoid: ['シンセ', '四つ打ち'] }),
  g({ ja: 'フォーク', en: 'acoustic folk', re: /フォーク|弾き語り|folk/i, family: 'acoustic', bpm: [80, 110], mood: 'やさしい', instruments: ['ギター', 'ハーモニカ'], voice: 'やさしい歌声', lyrics: 'full', guide: 'folk: acoustic guitar strumming, simple warm storytelling verses', avoid: ['シンセ', '四つ打ち', 'エレキギター'] }),
  g({ ja: 'ローファイ', en: 'lo-fi', re: /ローファイ|ロウファイ|lofi|lo-fi/i, family: 'chill', bpm: [70, 90], mood: 'チル', instruments: ['ピアノ', 'ドラム', 'レコードのノイズ'], voice: 'やさしい歌声', lyrics: 'full', guide: 'lo-fi: dusty warm sound, mellow keys, laid-back drums, vinyl crackle, soft vocals', avoid: ['アップテンポ', '力強い歌声'] }),
  // orchestral and traditional
  g({ ja: '映画音楽', en: 'epic cinematic orchestral score', re: /映画音楽|シネマティック|サントラ|サウンドトラック|劇伴|オーケストラ(?:っぽい|風|で壮大)|cinematic|soundtrack/i, family: 'orchestral', bpm: [70, 110], mood: '壮大', instruments: ['ストリングス', '迫力の打楽器', 'クワイア'], voice: '歌なし', lyrics: 'instrumental', guide: 'cinematic: full orchestra, soaring strings, epic percussion and choir, a big emotional rise; instrumental', avoid: ['四つ打ち', 'シンセ', 'ポップ', 'やさしい歌声'] }),
  g({ ja: 'クラシック', en: 'classical, orchestral', re: /クラシック|クラッシック|オーケストラ|classical/i, family: 'orchestral', bpm: [60, 120], mood: 'しっとり', instruments: ['ストリングス', 'ピアノ'], voice: '歌なし', lyrics: 'instrumental', guide: 'classical: orchestral strings and piano, elegant development; instrumental', avoid: ['四つ打ち', 'シンセ', 'ドラム'] }),
  g({ ja: '演歌', en: 'enka', re: /演歌/, family: 'traditional', bpm: [60, 80], tempo: 'ゆっくり', mood: '切ない', instruments: ['ストリングス', '尺八'], voice: 'こぶし', lyrics: 'full', guide: 'enka: slow and dramatic, strings and shakuhachi, vibrato-rich kobushi vocals, nostalgic longing', avoid: ['四つ打ち', 'シンセ', 'アップテンポ'] }),
  g({ ja: '和風', en: 'japanese traditional fusion', re: /和風|和楽器|祭り囃子|お祭りの曲|和ロック/, family: 'traditional', bpm: [100, 140], mood: '元気', instruments: ['三味線', '和太鼓', '尺八'], voice: '力強い歌声', lyrics: 'full', guide: 'japanese fusion: shamisen, taiko and shakuhachi over a modern beat, festival energy', avoid: ['四つ打ち'] }),
];

const byGenreJa = new Map(SONG_GENRES.map((x) => [x.ja, x]));
const byGenreEn = new Map(SONG_GENRES.map((x) => [x.en.toLowerCase(), x]));
/** the genre of a spell's genre talisman (by its label or its English), or null */
export function songGenreOf(tag: Pick<SpellTag, 'ja' | 'en'> | null | undefined): SongGenre | null {
  if (!tag) return null;
  return byGenreJa.get(tag.ja) ?? byGenreEn.get(tag.en.toLowerCase()) ?? SONG_GENRES.find((x) => x.re.test(tag.ja) || x.re.test(tag.en)) ?? null;
}
/** the genre the words name (the first in the table's order), or null */
export function songGenreIn(said: string): SongGenre | null {
  return SONG_GENRES.find((x) => x.re.test(said)) ?? null;
}

/** a tempo talisman: 145 → 「145BPM」 */
export const bpmTag = (bpm: number): SpellTag => ({ ja: `${bpm}BPM`, en: `${bpm} BPM`, group: 'tempo' });

/**
 * a switch between these two genres changes the song a lot (another family: pop → psytrance, ballad → metal) — {bati}
 * asks once whether the lyrics should be written again for it
 */
export function genreChangedALot(from: Pick<SpellTag, 'ja' | 'en'> | null | undefined, to: Pick<SpellTag, 'ja' | 'en'> | null | undefined): boolean {
  const a = songGenreOf(from);
  const b = songGenreOf(to);
  if (!b || a?.ja === b.ja) return false;
  if (!a) return true;
  return a.family !== b.family || a.lyrics !== b.lyrics;
}

/** for the lyrics writer: how the style spell's genre is sung (a few repeated phrases for psytrance; full verses for a ballad) */
export function genreLyricsGuide(tags: SpellTag[]): string {
  const genre = songGenreOf(tags.find((t) => t.group === 'genre'));
  const voice = tags.find((t) => t.group === 'voice');
  const none = voice?.ja === '歌なし';
  const how: GenreLyrics = none ? 'instrumental' : (genre?.lyrics ?? 'full');
  const rules: Record<GenreLyrics, string> = {
    full: 'Sung all through: full verses, a pre-chorus and a chorus with a hook (a usual song).',
    sparse:
      'This genre is mostly instrumental: write SPARSE lyrics — only a few short, repeated, mantra-like or hypnotic phrases (about 4–10 sung lines in all, 3–8 characters each, the same phrase coming back), with many non-sung blocks: Intro, Build, Drop, Instrumental between them, and an Outro. No long story verses.',
    instrumental:
      'This genre is instrumental: almost no lyrics — at most one or two very short chanted phrases (or none), the rest Intro / Build / Drop / Instrumental / Outro blocks with "lines": [].',
  };
  return [genre ? `Genre: ${genre.guide}.` : '', rules[how]].filter(Boolean).join(' ');
}
