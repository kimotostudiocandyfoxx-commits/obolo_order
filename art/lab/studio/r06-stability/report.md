# Studio lab — r06-stability

- **a** {"tune":{}}: overall 7.3 · vocalNaturalness 7.3 · pitch 8.1 · diction 7.6 · melody 7.8 · arrangement 7.7 · mix 7.7 · genreFit 8.6 · artifacts 7.2
- **b** {"tune":{}}: overall 7.2 · vocalNaturalness 7.2 · pitch 7.8 · diction 7.4 · melody 7.5 · arrangement 7.2 · mix 7.6 · genreFit 8.2 · artifacts 7.3

新しい標準（イントロ・アウトロ付き、曲調ごとの歌い方の指示、リミッター強め）で、8曲調を2回ずつ作って安定性を見る（どちらの回も良いか）。

recipe: {"outro":true} / vocal words: (app default)

**average**: overall 7.2 · vocalNaturalness 7.3 · pitch 8 · diction 7.5 · melody 7.7 · arrangement 7.4 · mix 7.6 · genreFit 8.4 · artifacts 7.2

| case | overall | voice | pitch | diction | melody | arr. | mix | genre | artif. | LUFS | peak | silence | voiced | time |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pop-bright~a | 8.5 | 7.8 | 8.8 | 9 | 8.6 | 8.5 | 8.4 | 9 | 8.8 | -16.9 | -0.7 | 6.9s | no | 30s |
| pop-bright~b | 8.5 | 8.5 | 8.5 | 9 | 8 | 8.5 | 8.5 | 9 | 8.5 | -13.7 | -1.1 | 4.1s | no | 31s |
| ballad-night~a | 7.8 | 8 | 8.5 | 8.5 | 8 | 8 | 7.5 | 8.5 | 7 | -13.5 | -0.9 | 0s | yes | 53s |
| ballad-night~b | 7.5 | 8.5 | 8.5 | 8 | 8.5 | 7.5 | 8 | 9 | 7 | -13.8 | -1.1 | 0s | yes | 54s |
| rock-run~a | 8.6 | 8.5 | 9 | 9.5 | 8.5 | 8.5 | 8 | 9.5 | 8.5 | -14.7 | -1 | 6.2s | no | 29s |
| rock-run~b | 8.2 | 8 | 8.5 | 9 | 8.5 | 8 | 8 | 8.5 | 8 | -14.2 | -1.2 | 2.5s | no | 29s |
| hiphop-chill~a | 3.8 | 4.5 | 6 | 3.5 | 5 | 4 | 6 | 6 | 4 | -13.8 | -0.6 | 0s | yes | 52s |
| hiphop-chill~b | 8.2 | 8 | 8.5 | 9 | 8 | 7.5 | 8.5 | 9.5 | 9 | -13 | -0.8 | 0s | yes | 52s |
| edm-party~a | 8 | 7.5 | 8.5 | 7.5 | 8.5 | 9 | 8.5 | 9.5 | 8.5 | -14.6 | -2 | 5.2s | no | 30s |
| edm-party~b | 7.8 | 7.5 | 8.5 | 6.8 | 8 | 8.5 | 8 | 9 | 8 | -12.8 | -1.4 | 4.6s | no | 31s |
| kids-march~a | 7.3 | 7 | 8 | 6.8 | 8 | 7.8 | 8 | 8.5 | 8 | -12.3 | 0.5 | 0s | yes | 48s |
| kids-march~b | 4.4 | 4.5 | 5.2 | 4 | 5 | 4.2 | 5.5 | 4 | 4.5 | -14 | -1.3 | 0s | yes | 48s |
| citypop-drive~a | 7.7 | 7.5 | 8 | 9 | 8 | 7.5 | 7.5 | 9 | 7 | -14 | -0.9 | 3.3s | no | 31s |
| citypop-drive~b | 8.2 | 7.5 | 8.5 | 9 | 8.5 | 8.5 | 8.2 | 9 | 8 | -14.5 | -0.4 | 2.9s | no | 31s |
| folk-letter~a | 6.8 | 7.5 | 8 | 6.8 | 7.8 | 8 | 7.5 | 9 | 5.5 | -14.1 | -0.3 | 0s | yes | 51s |
| folk-letter~b | 4.6 | 5.2 | 6.5 | 4.5 | 5.8 | 4.8 | 6.2 | 7.5 | 5 | -14.2 | -1.1 | 0s | yes | 51s |

## pop-bright~a
- heard: あさのひかり まどをあけて きのうのなみだ かぜにとばそう ちいさなゆめ ポケットにいれて きょうもあるきだす きみとなら どこまでも そらはいつも あおいから わらってうたおう いまここで あしたもきっといいひ
- voice: no voice sent · timings {"song":15.6,"split":5.8,"voice":0} · 8 line times
- problem: 00:15-00:19: Unprompted ad-lib vocalizing ('yeah, ooh') slightly delays the flow between lines.
- problem: The vocal tone has a slight synthetic sheen typical of anime vocal synthesis, though it fits the genre.
- idea: Add explicit negative prompts against filler ad-libs (e.g., 'no ad-libs, no vocal runs') to keep the phrasing strictly aligned with verse structures.
- idea: EQ a slight warmth in the low-mids around 300-500 Hz to make the vocal tone sound more organic.

## pop-bright~b
- heard: あさのひかり まどをあけて きのうのなみだ かぜにとばそう ちいさなゆめ ぽけっとにいれて きょうもあるきだす きみとならどこまでも そらはいつもあおいから わらってうたおう いまここで あしたもきっといいひ
- voice: no voice sent · timings {"song":15.9,"split":5.8,"voice":0} · 8 line times
- problem: 00:23 - 00:24: slight electronic shimmer/tuning artifact at the tail of 'arukidasu'
- problem: 00:28 - 00:32: chorus melody feels a bit brief and lacks backing vocal harmonies to lift the energy
- idea: Add layered vocal harmonies in the chorus to enhance dynamic contrast with the verse
- idea: Softly ease the high-end processing on vocal sustain tails to avoid robotic coloration

## ballad-night~a
- heard: よるのまちに ほしがおちて とおいきおく そっとひらく なまえをよんだ こえがふるえて まだきみをさがしてる あいたいよ いまでもずっと ことばにできないおもい このうたにのせて
- voice: octave shift 0, 16.9s · timings {"song":17.7,"split":6.2,"voice":17.1} · 8 line times
- problem: 00:56 track cuts off abruptly mid-phrase during 'このうたにのせて' before completing the chorus lyrics ('とどけたい きみがいたなつのひ' are missing)
- problem: 00:41 slight harsh sibilance and compression spike on the lead vocal when the full rhythm section enters
- idea: Extend generation length to at least 90-120 seconds to allow the chorus and outro to resolve naturally without truncation
- idea: Apply gentle de-essing and tame high-frequency vocal saturation at the chorus transition (around 00:41) to keep the mix smooth

## ballad-night~b
- heard: よるのまちにほしがおちてとおいきおくそっとひらくなまえをよんだこえがふるえてまだきみをさがしてるあいたいよいまでもずっとことばにできないおもいこのうたにのせてとどけたいきみがい
- voice: octave shift 0, 17.1s · timings {"song":17.8,"split":6.2,"voice":17.3} · 8 line times
- problem: 0:55-0:56: The track cuts off abruptly mid-phrase on 'きみがい...' before finishing the lyric 'なつのひ'.
- problem: 0:40: The drums and full ensemble enter slightly abruptly rather than building smoothly out of the verse.
- idea: Extend the generation duration by 5-10 seconds to allow the final line 'きみがいたなつのひ' and instrument decay to conclude naturally.
- idea: Shorten the intro (0:00-0:13) slightly so the entire intended lyric fits within the allotted duration.

## rock-run~a
- heard: はしれはしれかぜをきってまけないこころもやしてゆけたおれたってなんどでもたちあがるんだいまださけべぼくらのうたやみをきりさくひかりになれとどけとどけそらのかなたゆめはおわらない
- voice: no voice sent · timings {"song":15.1,"split":5.7,"voice":0} · 8 line times
- problem: 00:33-00:35 'ゆめはおわらない' has a slight synthetic metallic vibration on the sustained vocal note.
- problem: 00:36-00:47 Cymbals and upper-register synths in the post-chorus have noticeable phasey compression artifacts.
- idea: Apply dynamic EQ or de-harshing above 10kHz to tame digital cymbal sizzle.
- idea: Boost kick and sub-bass around 60-90Hz to give the rhythm section more punch against the bright guitars.

## rock-run~b
- heard: はしれはしれかぜをきって まけないこころもやしてゆけ たおれたってなんどでも たちあがるんだ いまださけべぼくらのうた やみをきりさくひかりになれ とどけとどけそらのかなた ゆめはおわらない
- voice: no voice sent · timings {"song":15,"split":5.7,"voice":0} · 8 line times
- problem: 00:32-00:37: The vocal sustain on 'おわらない' has slight artificial digital tuning artifacts and graininess.
- problem: 00:11-00:22: The vocal tone is somewhat cutesy/idol anime style rather than a gritty 'powerful japanese rock vocal' specified in the prompt.
- idea: Add 'female anime rock vocals' or specify 'husky / powerful female rock vocalist' in the prompt if a less cutesy tone is desired.
- idea: Apply subtle saturation and de-essing on high sustained vocal registers to soften synthetic brightness.

## hiphop-chill~a
- heard: ゆうがたのこうえん いつものばしょ このまちがすきなんだ ゆっくりいこうぜ あせらずに ぼくらのぺーすで すてっぷふんで きょうもいいかんじ ほらきこえる
- voice: octave shift 0, 16.3s · timings {"song":16.2,"split":5.7,"voice":16.5} · 8 line times
- problem: 00:00-00:20: Very long and odd vocal scatting/beatboxing intro that eats up nearly half the track length.
- problem: 00:22-00:26: Major lyrical dropout; lines 'ブランコゆれる ポケットのなかには あめがふたつ ともだちとわらう' are skipped and replaced with strange chuckling/laughter sounds.
- problem: 00:40: The final phrase 'まちのリズム' is completely cut off.
- problem: 00:41-00:50: Track cuts into complete dead silence for the remaining 9 seconds.
- idea: Prompt specifically with [Instrumental Intro] to prevent AI vocal scatting before the verse starts.
- idea: Shorten or structure the intro to allow enough generation time for the entire lyric set to be performed.
- idea: Reinforce syllable structure in rap prompts so the model does not drop verse lines or replace them with laugh ad-libs.
- idea: Set an outro or fade tag to prevent sudden cutoff and silence trailing at the end.

## hiphop-chill~b
- heard: ゆうがたのこうえんぶらんこゆれるぽけっとのなかにはあめがふたつともだちとわらういつものばしょこのまちがすきなんだゆっくりいこうぜあせらずにぼくらのぺーすですてっぷふんできょうもいいかんじほらきこえるまちのりずむ
- voice: octave shift 0, 16.3s · timings {"song":16.7,"split":5.7,"voice":16.5} · 8 line times
- problem: 00:31-00:50: ボーカルが00:31で終了した後、アウトロのインストループが曲全体の約4割を占めており少し間延びしている
- problem: 00:31以降の伴奏に展開やメロディックなフック（管楽器やコーラスなど）が少なく、ループ感が強め
- idea: 00:32以降にサビのリフレインや2番のラップを配置してボーカルパートの充実を図る
- idea: アウトロにフルートやミュートトランペットなどのメロディライン、あるいはターンテーブルのスクラッチを追加して展開を作る

## edm-party~a
- heard: ねおんのなか すてっぷふんで こころのおと ぼりゅーむあげて みんなでいっしょに てをあげて いまはじまるよ よるがあけるまで ひかりのなかで とびはねよう ぼくらはいま むてきなんだ ぱーてぃーはこれから
- voice: no voice sent · timings {"song":15.2,"split":5.7,"voice":0} · 8 line times
- problem: 00:24 - Skipped 'おどれ おどれ' (odore odore) at the beginning of the chorus, starting directly with 'よるがあけるまで'.
- problem: 00:37 - Vocal ends abruptly after the chorus line, leaving an extended instrumental drop without vocal ad-libs or outro.
- idea: Break down lyric lines into smaller chunks or add rhythm tags before the chorus to ensure 'おどれ おどれ' is not skipped during generation.
- idea: Add vocal chops, call-and-response shouts, or ad-libs during the drop section (00:37 onwards) to maintain energy.

## edm-party~b
- heard: ねおんのなか ステップもあげて みんなでいっしょにてをあげて みんないっしょにてをあげて いまはじまるよ おどれ おどれ よるがきえるまで ひかりのなかで とびはねよう ぼくらはいま むてきなんだ パーティーはこれから
- voice: no voice sent · timings {"song":15.5,"split":5.7,"voice":0} · 8 line times
- problem: 00:09-00:11: Missing line 'こころのおと ボリュームあげて', replaced with misread/altered phrasing 'ステップもあげて'
- problem: 00:14-00:18: Hallucinates an unintended repetition of 'みんないっしょにてをあげて'
- problem: 00:24-00:25: Sings 'よるがきえるまで' (until the night disappears) instead of 'よるがあけるまで' (until dawn)
- idea: Regenerate with stronger prompt weight or line-by-line prompting to prevent lyric omission and line duplication in the verse
- idea: Specify phonetic guide or furigana for '夜が明けるまで' to avoid misreading as 'きえる'

## kids-march~a
- heard: くまさん うさぎさん おはおはおーさん もりのみちをいっしょにあるこう どんぐりひろって ポケットいっぱい らららら たのしいね みんなでうたえば もっとたのしい らららら またあした あした
- voice: octave shift 0, 14.7s · timings {"song":15.2,"split":5.7,"voice":14.9} · 6 line times
- problem: 00:04-00:07: Lyric phrasing error on 'おはようさん', sung with extra syllables ('お・は・お・はおーさん').
- problem: 00:30-00:33: Unprompted repetition of 'あした' with slight pitch drop at the end of the chorus.
- problem: 00:34-00:47: Extended instrumental outro relative to the very brief vocal section.
- idea: Specify phonetic guide or clearer syllable counts for 'お・は・よ・う・さ・ん' to avoid stuttering on the greeting.
- idea: Add an outro tag ([outro] / instrumental fade) in the prompt structure to keep the track ending tightly timed.
- idea: Adjust tempo or add a second verse to balance the song structure with the lengthy instrumental outro.

## kids-march~b
- heard: きさんぎさん おはようさん もりのみちを いっしょにあると どんぐりひろって ポケっぱい らららら たのしいね みんなでうたえば もっとたのし らららら またあした
- voice: octave shift 0, 14.7s · timings {"song":15.2,"split":5.7,"voice":14.9} · 6 line times
- problem: 00:00 - Strange audible intake of breath / vocal gasp artifact right at the beginning.
- problem: 00:09 - 'うさぎさん' is slurred and sounds clipped like 'きさんぎさん' or missing 'う'.
- problem: 00:15 - 'あるこう' sounds truncated to 'あると'.
- problem: 00:18 - 'ポケットいっぱい' skips syllables and sounds like 'ポケっぱい'.
- problem: 00:27 - 'たのしい' drops the final vowel, sung as 'たのし'.
- problem: 00:32 - Another odd breath/gasp artifact abruptly before the outro.
- problem: 00:41 - 00:48 - Unnecessary dead air/abrupt cutoff at the end.
- problem: Overall - Arrangement lacks the requested organic ukulele, glockenspiel, and playful march feel, sounding more like sparse electronic synth-pop.
- idea: Increase prompt weight for acoustic elements: explicitly prompt for 'acoustic ukulele strumming, warm glockenspiel, children choir marching band' and negative-prompt 'electronic synthesizer, glitch, bleeps'.
- idea: Adjust phoneme spacing in the lyric prompt (e.g. 'う・さ・ぎ・さ・ん', 'ぽ・けっ・と・いっ・ぱ・い') to prevent syllable skipping.
- idea: Trim leading and trailing empty space to remove breath artifacts and prolonged silent tails.

## citypop-drive~a
- heard: よるのハイウェイ ライトがながれる ラジオからきこえる なつかしいうた まどをあけたら かぜがわらう どこまでもいこう きらめくまちを ぬけだして ふたりだけの ドライブ ほしぞらのした うたいながら ゆめのつづきへ
- voice: no voice sent · timings {"song":16.1,"split":5.7,"voice":0} · 8 line times
- problem: 0:46: The song cuts off abruptly right on the final chorus syllable (ゆめのつづきへ) with no instrumental decay or outro.
- problem: 0:35: The cadence on 'ドライブ' is slightly awkward and rhythmically stretched compared to the surrounding phrases.
- idea: Extend the generation length or add an [outro] tag so the chorus ending can ring out with a proper instrumental fade or turnaround.
- idea: Adjust phrasing in the chorus lyric prompt to keep the rhythm tighter going into 'ドライブ'.

## citypop-drive~b
- heard: よるのハイウェイライトがながれるラジオからきこえるなつかしいうたまどをあけたらかぜがわらうどこまでもいこうきらめくまちをぬけだしてふたりだけのドライブほしぞらのしたうたいながらゆめのつづきへ
- voice: no voice sent · timings {"song":15.9,"split":5.7,"voice":0} · 8 line times
- problem: 0:28 - 'いこう' のロングトーン末尾にわずかなデジタルピッチ補正感（フォルマントの揺らぎ）が感じられます。
- problem: 0:46 - ラストの 'ゆめのつづきへ' の語尾の余韻がやや機械的に減衰します。
- idea: ボーカルトラックにテープサチュレーションや薄いコーラスを足して、AI特有の高域のデジタル感を緩和する。
- idea: アウトロにインストの短い後奏（リフやサックスソロなど）を数小節設けて、フェードアウトで自然に締めくくる。

## folk-letter~a
- heard: ふるさとのえきにおりたつとかわらないけしきむかえてくれたおかあさんのこえとおくからおかえりときこえたありがとういえなかったことこのたにこめておくるよいつまでもげんきでいてねから
- voice: octave shift 0, 16.4s · timings {"song":16.2,"split":5.7,"voice":16.6} · 8 line times
- problem: 00:40 - 'このうたに' sounds slightly slurred or truncated as 'このたに'.
- problem: 00:49 - The final line 'またかえるからね' is largely missing, singing only 'から...' before abruptly cutting off at 00:51.
- idea: Extend the generation duration limit to allow the final chorus phrase and outro to finish cleanly without cutting off.
- idea: Space out the phrasing around 'このうたに' so each mora is articulated distinctly.

## folk-letter~b
- heard: ふるさとのえきにおりたつと かわらないけしき むかえてくれた おかあさんのこえとおくから おかえりときこえた ありがとう このうたにこめて いつまでもきいていてね またかえる
- voice: octave shift 0, 16.4s · timings {"song":16.3,"split":5.7,"voice":16.6} · 8 line times
- problem: 00:38-00:48 Chorus lyrics are heavily skipped or altered ('いえなかったこと' and 'おくるよ' are missing, 'げんきでいてね' became 'きいていてね').
- problem: 00:50-00:51 The audio abruptly cuts off in the middle of the phrase 'またかえるからね' ('またかえる...').
- problem: 00:23-00:32 Vocal timbre is stiff, robotic, and lacks natural phrasing/breathing.
- problem: 00:36-00:45 Chorus melody lacks energy and drive compared to the verse, making the structure feel incomplete.
- idea: Ensure generation length extends past 00:51 to prevent trailing lyrics from being truncated.
- idea: Adjust pacing or syllable density prompts so the model doesn't skip phrases like 'いえなかったこと' in the chorus.
- idea: Prompt for a more expressive, natural female folk vocal with breath control to reduce robotic tuning artifacts.
