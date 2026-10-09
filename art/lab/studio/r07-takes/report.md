# Studio lab — r07-takes

- **a** {"tune":{}}: overall 7.4 · vocalNaturalness 7.5 · pitch 8.3 · diction 7.9 · melody 7.8 · arrangement 8.1 · mix 8 · genreFit 8.7 · artifacts 7.4
- **b** {"tune":{}}: overall 7.6 · vocalNaturalness 7.6 · pitch 8.3 · diction 7.9 · melody 8 · arrangement 7.9 · mix 7.9 · genreFit 8.9 · artifacts 7.6

r06 は声を変える曲の当たり外れが大きかった（3.8〜8.2）。2テイク歌わせて、Whisper が歌詞をよく聞き取れた方を残す（takes=2）。8曲調×2回で r06 と比べる。

recipe: {"outro":true} / vocal words: (app default)

**average**: overall 7.5 · vocalNaturalness 7.5 · pitch 8.3 · diction 7.9 · melody 7.9 · arrangement 8 · mix 7.9 · genreFit 8.8 · artifacts 7.5

| case | overall | voice | pitch | diction | melody | arr. | mix | genre | artif. | LUFS | peak | silence | voiced | time |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pop-bright~a | 8 | 8 | 9 | 9 | 8 | 8 | 8 | 9 | 7 | -12 | -1.1 | 6.5s | no | 100s |
| pop-bright~b | 8 | 7.5 | 8.5 | 8 | 8 | 7.5 | 8 | 9 | 8 | -13.7 | -1.3 | 5.1s | no | 134s |
| ballad-night~a | 8 | 8.5 | 8.5 | 8 | 8.5 | 8.5 | 8.5 | 9 | 7.5 | -13.1 | -1.4 | 0s | yes | 90s |
| ballad-night~b | 7.5 | 7.5 | 8.5 | 7.5 | 8.5 | 8.5 | 8 | 9 | 7 | -14.2 | -1.8 | 0s | yes | 83s |
| rock-run~a | 8 | 7.5 | 8.5 | 9 | 8.5 | 8.5 | 8 | 9 | 7.5 | -14.5 | -1.4 | 0s | no | 53s |
| rock-run~b | 8 | 7.5 | 8.5 | 9 | 8.5 | 7.5 | 7.5 | 9 | 7.5 | -13.6 | -1.5 | 4.6s | no | 51s |
| hiphop-chill~a | 4.5 | 4 | 6 | 4.5 | 4.5 | 7 | 6.5 | 7 | 4 | -14 | -0.6 | 0s | yes | 76s |
| hiphop-chill~b | 8 | 8 | 8 | 9 | 7.5 | 7 | 8 | 9 | 8.5 | -14.1 | -1.3 | 0s | yes | 75s |
| edm-party~a | 8.5 | 8.5 | 9 | 9 | 8.5 | 8.2 | 8.5 | 9 | 9 | -12.7 | -1.4 | 4s | no | 52s |
| edm-party~b | 7.5 | 7.5 | 8.5 | 6.5 | 8 | 8.5 | 8 | 9 | 8 | -12.6 | -1.1 | 3.6s | no | 51s |
| kids-march~a | 6.5 | 7.5 | 8.5 | 8 | 8 | 8.2 | 8 | 8.5 | 8.5 | -13.7 | -1 | 0s | yes | 73s |
| kids-march~b | 8.2 | 8 | 8.5 | 9 | 8.2 | 8 | 8 | 9 | 8.5 | -13 | -1.1 | 0s | yes | 72s |
| citypop-drive~a | 8.8 | 8.5 | 9 | 9 | 8.5 | 9 | 8.5 | 9.5 | 9 | -14.8 | -1.6 | 4.7s | no | 55s |
| citypop-drive~b | 7.8 | 7 | 8.5 | 7.5 | 8 | 8.5 | 8 | 9 | 8 | -13.5 | -0.7 | 4.9s | no | 55s |
| folk-letter~a | 6.8 | 7.5 | 8 | 7 | 7.5 | 7 | 8 | 8.5 | 6.5 | -13.3 | 0.6 | 0s | yes | 75s |
| folk-letter~b | 6 | 7.5 | 7.5 | 6.5 | 7.5 | 7.5 | 7.5 | 8.5 | 5.5 | -14.7 | -1.6 | 0s | yes | 74s |

## pop-bright~a
- heard: あさのひかり まどをあけて きのうのなみだ かぜにとばそう ちいさなゆめ ポケットにいれて きょうもあるきだす きみとならどこまでも そらはいつもあおいから わらってうたおう いまここで あしたもきっといいひ
- voice: no voice sent · timings {"song":78.3,"split":12.1,"voice":0} · 8 line times
- problem: 00:42-00:49: The song finishes abruptly at 00:42 leaving about 7 seconds of dead silence at the end.
- problem: 00:23-00:25: Slight robotic flutter on the sustained vocal tail of 'あるきだす'.
- idea: Trim the silent tail after 00:42 or add an outro instrumental bar with a clean fade-out/reverb tail.
- idea: Add a short instrumental interlude or extended outro chord to give the finish a natural resolution.

## pop-bright~b
- heard: あさのひかり まどをあけて きのうのなみだ かぜにとばそう ちいさなゆめ ポケットいれて きょうもあるきだす きみとならどこまでも そらはいつもあおいから わらってうたおう いまここで あしたもきっといいひ
- voice: no voice sent · timings {"song":124.5,"split":0,"voice":0} · 8 line times · takes heard 0.397 / 0.43
- problem: 00:19: 'ポケットにいれて' sounds like 'ポケットいれて' with the particle 'に' dropped or swallowed.
- problem: 00:42-00:49: Lingering dead air/silence after the instrumental fade-out.
- idea: Add explicit phonetic spacing (e.g. ぽけっと に いれて) to ensure small particles are articulated clearly.
- idea: Trim trailing silence after 00:43 to produce a tight song finish.

## ballad-night~a
- heard: よるのまちにほしがおちて とおいきおくそっとひらく なまえをよんだこえがふるえて まだきみをさがしてる あいたいいまでもずっと ことばにできないおもい
- voice: octave shift 0, 21.7s · timings {"song":52.2,"split":0,"voice":24.2} · 8 line times · takes heard 0.488 / 0.497
- problem: 00:44 - The syllable 'よ' from 'あいたいよ' is omitted or replaced with a sustained 'あいたいー'.
- problem: 00:56 - The audio file cuts off abruptly mid-phrase on 'おもい' before completing the chorus.
- idea: Extend the generation length / duration limit so the chorus can resolve cleanly to the end of the lyrics.
- idea: Adjust prompt or phonetic spelling (e.g. 'あいたい、よ') to ensure the particle 'よ' is clearly articulated.

## ballad-night~b
- heard: よるのまちに ほしがおちて とおいきおく そっとひらく なまえをよんだ こえがふるえて まだき きみをさがしてる あいたいよ いまでもずっと ことばにできないおもい このうたにのせて
- voice: octave shift 0, 17.7s · timings {"song":52.4,"split":0,"voice":18} · 8 line times · takes heard 0.446 / 0.535
- problem: 00:34 - Vocal hesitates or stutters slightly on 'まだき、きみを' (repeating 'ki').
- problem: 00:57 - The audio abruptly cuts off mid-phrase before completing the chorus lyrics ('とどけたい きみがいたなつのひ').
- idea: Clean up the phonetic prompt or re-roll the verse section around 00:34 to remove the syllable stutter.
- idea: Extend track generation length to avoid cutting off mid-phrase during the chorus.

## rock-run~a
- heard: はしれはしれかぜをきって まけないこころもやしてゆけ たおれたってなんどでも たちあがるんだ いまださけべぼくらのうた やみをきりさくひかりになれ とどけとどけそらのかなた ゆめはおわらない おわらない
- voice: no voice sent · timings {"song":45.5,"split":0,"voice":0} · 8 line times · takes heard 0.365 / 0.458
- problem: 0:35-0:38: The extended high belted note on 'おわらない' exhibits noticeable digital phasing/flanging artifacts.
- problem: 0:39: An unexpected vocal glitch/spoken artifact (sounds like 'Wait!') cuts into the mix right before the repeat of 'おわらない'.
- problem: 0:45-0:47: Song cuts off somewhat abruptly during the vocal tail/outro.
- idea: Clean up the vocal chop artifact at 0:39 using audio editing or inpainting around the bridge/outro transition.
- idea: Allow the outro to resolve naturally with an instrument tag or clean cymbal decay rather than an abrupt cutoff.
- idea: Slightly smooth out upper-mid resonance on the high sustained vocal belts to reduce synthetic harshness.

## rock-run~b
- heard: はしれはしれかぜをきってまけないこころもやしてゆけたおれたってなんどでもたちあがるんだいまださけべぼくらのうたやみをきりさくひかりになれとどけとどけそらのかなたゆめはおわらない
- voice: no voice sent · timings {"song":42.7,"split":0,"voice":0} · 8 line times · takes heard 0.096 / 0.096
- problem: 00:30-00:33: Vocals exhibit slight metallic phase smearing on the sustained high belt / ad-lib.
- problem: 00:47: The track cuts off abruptly during the outro guitar riff without a natural decay or resolved cadence.
- idea: Specify a definitive ending or outro section (e.g., [Outro] final chord ring out) to prevent cutoff mid-bar.
- idea: Apply gentle de-essing and dynamic EQ around 3-4 kHz to smooth out high-register vocal sheen.

## hiphop-chill~a
- heard: ゆうがたのこうえん ぶらんこゆれる ぽけっとのなかには あめがふたつ ともだちとわらう いつものばしょ このまちがすきなんだ ゆっくりいこうぜ あせらずに ぼくらのぺーすで すてっぷふんで きょうもいいかんじ えー ふん えー きょうもいい えー えー ほらきこえる えー えー えー まちのりずむ
- voice: octave shift 0, 16.5s · timings {"song":46.8,"split":0,"voice":16.7} · 8 line times · takes heard 0.536 / 0.511
- problem: 0:26-0:40: The chorus breaks down as the vocal begins stuttering, repeating 'えー' and humming filler sounds instead of cleanly delivering 'ほらきこえる まちのリズム'.
- problem: 0:11-0:25: The vocal sounds heavily synthetic and robotic rather than a warm, natural human voice suitable for children.
- problem: 0:41-0:50: The audio ends prematurely leaving roughly 10 seconds of complete silence.
- idea: Reroll generation to fix the hallucinated vocal stuttering ('えー えー') and incomplete chorus lyrics.
- idea: Specify 'natural human voice, playful tone, no autotune/vocoder artifacts' in the vocal prompt.
- idea: Ensure strict rhythm prompting or shorter bars so the AI doesn't run out of lyrics and insert filler vocalizations.

## hiphop-chill~b
- heard: いぇあ ゆうがたのこうえん ぶらんこゆれる ぽけっとのなかには あめがふたつ ともだちとわらう いつものばしょ このまちがすきなんだ ゆっくりいこうぜ あせらずに ぼくらのぺーすで すてっぷふんで きょうもいいかんじ ほらきこえる まちのりずむ
- voice: octave shift 0, 16.4s · timings {"song":45.3,"split":0,"voice":16.7} · 8 line times · takes heard 0.585 / 0.57
- problem: 00:32-00:50: The vocal portion ends early at 00:32, leaving nearly 20 seconds of empty instrumental loop with no hook repetition or outro ad-libs.
- idea: Extend the vocal arrangement by repeating the chorus one more time before the fade-out.
- idea: Add chill vocal ad-libs or call-and-response elements in the outro section to sustain listener engagement.

## edm-party~a
- heard: ねおんのなか すてっぷふんで こころのおと ぼりゅーむあげて みんなでいっしょに てをあげて いまはじまるよ おどれ おどれ よるがあけるまで ひかりのなかで とびはねよう ぼくらはいま むてきなんだ ぱーてぃーはこれから
- voice: no voice sent · timings {"song":43.1,"split":0,"voice":0} · 8 line times · takes heard 0.476 / 0.485
- problem: 00:34 - 00:38: The transition into the drop lacks a classic EDM build-up riser/snare roll tension, making the drop feel slightly anti-climactic.
- problem: 00:38 - 00:48: The post-chorus instrumental drop is relatively short and ends abruptly as a brief snippet rather than a fully developed drop section.
- idea: Incorporate a rising sweep and accelerating snare roll between 00:34 and 00:38 to accentuate the build and release.
- idea: Extend the drop section with a distinct lead synth melody or vocal chops to sustain dance energy before concluding or moving into the next section.

## edm-party~b
- heard: ねおんのなか すてっぷふんで ぼりゅーむあげて いっしょにてをあげて てをあげて はじまるよーよー ひかりのなかで とびはねよう ぼくらはいま むてきなんだ ぱーてぃーはこれから
- voice: no voice sent · timings {"song":42.6,"split":0,"voice":0} · 8 line times · takes heard 0.455 / 0.475
- problem: 00:07 「こころのおと」が完全に歌われず脱落している
- problem: 00:10 「みんなで」が抜け、「いっしょにてをあげて てをあげて」と重複している
- problem: 00:24 サビ冒頭の「おどれ おどれ よるがあけるまで」がスキップされ「ひかりのなかで」から始まっている
- idea: 歌詞の脱落を防ぐため、メロディの小節配分やセクション指定（[Pre-Chorus]等）を細かく分割してプロンプトに指定する
- idea: サビに入る前のビルドアップで歌詞を消化しきれるよう、Bメロの小節数を確保する

## kids-march~a
- heard: もりのみちを いっしょにあるこう どんぐりひろって どんぐりひろって ぽけっといっぱい らららら たのしいね みんなでうたえば もっとたのしい らららら またあした
- voice: octave shift 0, 14.9s · timings {"song":46.1,"split":0,"voice":15.1} · 6 line times · takes heard 0.085 / 0.636
- problem: 00:08: The entire first line of the verse ('くまさん うさぎさん おはようさん') is skipped.
- problem: 00:14-00:18: The phrase 'どんぐりひろって' is repeated twice unexpectedly ('どんぐりひろって どんぐりひろって ポケットいっぱい').
- problem: 00:38-00:47: The outro relies heavily on repetitive cartoon sound effects rather than a clean musical ending.
- idea: Ensure prompts include structure hints or intro count-in so the vocal starts on the first lyric line rather than skipping it.
- idea: Correct lyric repetition by prompt constraints or inpainting/regenerating the verse.
- idea: Smooth out the outro with a resolving musical cadence on glockenspiel or ukulele.

## kids-march~b
- heard: くまさんうさぎさんおはようさんもりのみちをいっしょにあるこうどんぐりひろってポケットいっぱいらーらーらたのしいねみんなでうたえばもっとたのしいらーらーらまたあした
- voice: octave shift 0, 15.0s · timings {"song":44.6,"split":0,"voice":15.2} · 6 line times · takes heard 0.063 / 0.753
- problem: 00:18: 'ララララ' is sung with three syllables ('ラーラーラ') instead of four.
- problem: 00:26: 'ララララ' is again sung with three elongated beats instead of four distinct 'ラ' syllables.
- problem: 00:30-00:47: The instrumental outro is rather long (around 18 seconds) compared to the brief vocal section.
- idea: Write syllables explicitly (e.g., 'ラ・ラ・ラ・ラ') with note count cues to enforce a 4-syllable sing-along.
- idea: Add a second verse or chorus repeat before the outro to balance the song structure.
- idea: Prompt an earlier fade-out or concise musical ending tag to avoid dragging the outro.

## citypop-drive~a
- heard: よるのハイウェイ ライトがながれる ラジオからきこえる なつかしいうた まどをあけたら かぜがわらう どこまでもいこう きらめくまちを ぬけだして ふたりだけの ドライブ ほしぞらのした うたいながら ゆめのつづきへ
- voice: no voice sent · timings {"song":45.2,"split":0,"voice":0} · 8 line times · takes heard 0.439 / 0.632
- problem: 00:45 - 00:50: The ending cuts off fairly quickly instead of featuring an extended instrumental solo or gentle fade-out typical of 80s city pop.
- problem: The vocal timbre has a slightly modern anime/digital polish rather than warm 80s tape saturation.
- idea: Extend the outro with a short saxophone or synth solo over a fade-out to maximize retro city pop authenticity.
- idea: Apply subtle analog tape emulation/saturation and gentle high-cut filtering to the master/vocal for truer 80s vintage warmth.

## citypop-drive~b
- heard: よるのハイウェイ ライトがながれる ラジオからきこえる なつかしいうた まどをあけたら かぜがわらう どこまでもいこう きらめくまちを ぬけだして ふたりだけのらいぶ ほしぞらのした うたいながら ゆめのつづきへ
- voice: no voice sent · timings {"song":45.7,"split":0,"voice":0} · 8 line times · takes heard 0.636 / 0.355
- problem: 00:33-00:35: 「ドライブ」の発音が「ど」が脱落または弱すぎて「らいぶ」のように聴こえます
- problem: 00:43-00:45: 「ゆめのつづきへー」のロングトーン語尾でわずかにAI特有のフォルマントの揺らぎや機械的な処理感が感じられます
- idea: 歌詞のプロンプトで「ドライブ」を「どらいぶ」または「ド・ライヴ」のように音節を強調表記して再生成する
- idea: ボーカル末尾のロングトーンにビブラートや自然な減衰が入るようプロンプト（natural vibrato, smooth vocal decay）を調整する

## folk-letter~a
- heard: ふるさとのえきに おりたつと かわらないけしき むかえてくれた おかあさんのこえ とおくから おかえりときこえた ありがとう いえなかったこと このうたにこめて おくるよ げんきでいてね
- voice: octave shift 0, 16.7s · timings {"song":46,"split":0,"voice":16.9} · 8 line times · takes heard 0.444 / 0.279
- problem: 00:45: 'いつまでも' was skipped from the lyrics, jumping directly to 'げんきでいてね'
- problem: 00:50: The song cuts off abruptly mid-chorus before delivering the final line 'またかえるからね'
- problem: 00:51: Abrupt audio termination without a musical resolution or outro
- idea: Extend track duration setting or adjust tempo/phrasing so the full chorus and an outro can conclude naturally
- idea: Add explicit line breaks or phrasing tags to prevent skipping 'いつまでも'

## folk-letter~b
- heard: ふるさとのえきに おりたと かわらないけしき むかえてくれた おかあさんのこえ とおくから おかえりときこえた ありがとう いえなかったこと このうたにこめて おくるよ またかえるから
- voice: octave shift 0, 16.7s · timings {"song":45,"split":0,"voice":16.9} · 8 line times · takes heard 0.621 / 0.128
- problem: 00:17 - 00:18: 「おりたつと」の発音が「おりたと」または「おりたっと」のように聞こえ、やや不自然です。
- problem: 00:47: サビの歌詞「いつまでも げんきでいてね」が丸ごとスキップされています。
- problem: 00:50 - 00:51: 「またかえるから」の歌唱途中で楽曲がブツ切りでフェードアウト・終了しています。
- idea: 生成時間（duration）を長めに設定し、サビの全フレーズを収めた上でアウトロまで自然に完走できるようにする。
- idea: 歌詞の改行やセクションタグを見直し、行飛ばし（歌詞脱落）が起きないようにプロンプトを整える。
