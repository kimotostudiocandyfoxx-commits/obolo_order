# Studio lab — r03-voice-extend

- **match** {"tune":{}}: overall 6.6 · vocalNaturalness 6.9 · pitch 7.4 · diction 7 · melody 7 · arrangement 6.7 · mix 7.2 · genreFit 7.6 · artifacts 6.6
- **nomatch** {"tune":{"matchVoice":false}}: overall 6.8 · vocalNaturalness 6.6 · pitch 7.5 · diction 6.9 · melody 7.3 · arrangement 7.2 · mix 7.4 · genreFit 8.4 · artifacts 7.3
- **match50** {"tune":{"voiceSteps":50}}: overall 6.7 · vocalNaturalness 6.5 · pitch 7.6 · diction 7.5 · melody 7.1 · arrangement 6.7 · mix 7.1 · genreFit 8.3 · artifacts 7.1

LM を標準に。声を変える曲（ballad / hiphop / kids）で、歌手の声域をユーザーの声に合わせる（matchVoice）あり・なし、変換の細かさ（voiceSteps 50）を比べる。2番・大サビは LM の良い曲に、①そのまま後ろに続ける（repaint）②同じ種で長い版を作り直す（regen）を比べる。

recipe: {"lm":true} / vocal words: (app default)

**average**: overall 6.7 · vocalNaturalness 6.9 · pitch 7.7 · diction 7.4 · melody 7.3 · arrangement 6.9 · mix 7.3 · genreFit 8.2 · artifacts 7

| case | overall | voice | pitch | diction | melody | arr. | mix | genre | artif. | LUFS | peak | silence | voiced | time |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pop-bright~match | 7.6 | 7.5 | 8 | 7.5 | 7.8 | 7.2 | 7.5 | 8.5 | 8 | -13.6 | -0.7 | 0s | no | 98s |
| pop-bright~nomatch | 7 | 7.5 | 8 | 6 | 8 | 8.2 | 8 | 9 | 8 | -13 | -0.9 | 0s | no | 29s |
| pop-bright~match50 | 8.2 | 7.8 | 8.7 | 7.6 | 8.5 | 8.4 | 8.2 | 9 | 8.5 | -13.4 | -1.3 | 0s | no | 29s |
| ballad-night~match | 6.5 | 8 | 8 | 7 | 8 | 7 | 8 | 9 | 6 | -12.4 | -0.9 | 2.3s | yes | 59s |
| ballad-night~nomatch | 6.5 | 6.5 | 7.5 | 7 | 7 | 6.5 | 7.5 | 8 | 6.5 | -12.6 | -1.1 | 0s | yes | 46s |
| ballad-night~match50 | 5 | 5 | 7 | 6 | 6 | 6 | 6 | 8 | 5 | -12.6 | -0.9 | 0s | yes | 54s |
| hiphop-chill~match | 6.6 | 6.8 | 7.2 | 6 | 6.5 | 7.5 | 7.2 | 8 | 6.2 | -13.6 | -0.3 | 1.5s | yes | 47s |
| hiphop-chill~nomatch | 7.8 | 7.5 | 8 | 7 | 7.5 | 8 | 8 | 9 | 8.5 | -14 | -0.5 | 1.5s | yes | 47s |
| hiphop-chill~match50 | 8 | 8 | 8 | 9 | 8 | 8 | 8 | 9 | 9 | -13.6 | -1 | 0s | yes | 53s |
| kids-march~match | 5.5 | 5.2 | 6.5 | 7.5 | 5.5 | 5 | 6 | 5 | 6 | -13.9 | 1.3 | 0s | yes | 46s |
| kids-march~nomatch | 6 | 5 | 6.5 | 7.5 | 6.5 | 6 | 6 | 7.5 | 6 | -13 | 0.1 | 2.3s | yes | 46s |
| kids-march~match50 | 5.5 | 5 | 6.5 | 7.5 | 6 | 4.5 | 6 | 7 | 6 | -12.5 | -0.6 | 0s | yes | 51s |
| pop-bright+2ban | 4.5 | 7.5 | 8 | 8 | 7.5 | 4.5 | 7.5 | 8 | 6.5 | -13.6 | -0.5 | 0s | no | 35s |
| pop-bright+2ban~regen | 9 | 8.5 | 9 | 9.5 | 9 | 8.5 | 8.5 | 9.5 | 9 | -16 | -0.8 | 1.6s | no | 61s |
| ballad-night+oosabi | 5 | 6.5 | 7 | 5.5 | 6.5 | 6 | 6.5 | 7.5 | 4 | -13 | -0.7 | 0s | yes | 51s |
| ballad-night+oosabi~regen | 8.5 | 8.5 | 8.5 | 9 | 8 | 8.5 | 8 | 9 | 8.5 | -12.1 | 0.8 | 0s | yes | 94s |

## pop-bright~match
- heard: あさのひかりまどをあけてきのうのなみだかぜにとばそうちいさなゆめぽけっとにいれてきょうもあるきだすきみとならどこまでもそらはいつもあおいからわらってうたいまここであしたもきっといいひ
- voice: no voice sent · timings {"song":77,"split":11.9,"voice":0} · 8 line times
- problem: 00:26-00:28付近で「わらってうたおう」の「おう」が曖昧になり「わらってうた」と聴こえる
- problem: 00:34以降のボーカル終了から曲の締めくくり（アウトロ）がややあっさりしており余韻が短い
- idea: 「うたおう」の部分を「うたおー」など長音表記にして発音の脱落を防ぐ
- idea: アウトロの展開を指定して自然なエンディングコードで終われるように構成を整える

## pop-bright~nomatch
- heard: あさのひかり まどをあけて きのうのなみだ みぜにとばそう きょうもあるきだす きみとなら ららら どこまでも そらはいつもあおいから わらってうたおう いまここで あしたもきっといいひ
- voice: no voice sent · timings {"song":15.5,"split":5.2,"voice":0} · 8 line times
- problem: 00:06-00:08: 「かぜにとばそう」の「かぜ」が不明瞭で「みぜにとばそう」のように聴こえます。
- problem: 00:09-00:13: Aメロ後半の歌詞「ちいさなゆめ ポケットにいれて」が完全に脱落（スキップ）しています。
- problem: 00:18: 「きみとなら」と「どこまでも」の間に歌詞にない「ららら」というアドリブが挟まっています。
- idea: 歌詞行の脱落を防ぐため、セクション構成や改行の指定を明確にし、文字数・拍の割り振りを整えてリロールする
- idea: 「かぜにとばそう」の発音崩れを修正するため、ひらがな表記のスペース区切りやプロンプトでの歌唱明瞭度指定を試みる

## pop-bright~match50
- heard: あさのひかり まどをあけて きのうのなみだ かぜにとばそう ちいさないを ポケットにいれて きょうもあるきだす きみとなら どこまでも そらはいつも あおいから わらってうたおう いまここで あしたもきっといいひ
- voice: no voice sent · timings {"song":15.1,"split":5.2,"voice":0} · 8 line times
- problem: 00:09-00:11: 'ちいさなゆめ (chiisana yume)' is mispronounced/slurred, sounding more like 'ちいさなあい (chiisana ai)' or 'ちいさないを'.
- problem: 00:23-00:25, 00:32-00:34: Slight autotune/synthetic metallic phasing on vowel tails.
- idea: Regenerate or punch in the line at 00:09 to clearly enunciate 'ゆめ (yu-me)'.
- idea: Reduce excessive vocal brightness/high-frequency excitation in the upper mid range to soften digital vocal artifacts on sustained notes.

## ballad-night~match
- heard: よるのまちに ほしがおちて とおいきおく そっとひらく なまえをよんだ こえがふるえて まだきみをさがしてる あいたいよ いまでもずっと ことばにできないおもい きみがな
- voice: octave shift -12, 22.3s · timings {"song":16.1,"split":5.9,"voice":25.1} · 8 line times
- problem: 00:40: Skipped the expected line 'このうたにのせて とどけたい'.
- problem: 00:42-00:44: Sings 'きみがな...' instead of 'きみがいたなつのひ' and cuts off abruptly before finishing the sentence/chorus.
- idea: Extend the generation duration so the chorus can complete naturally.
- idea: Regenerate the chorus section to ensure all lyrics ('このうたにのせて とどけたい', 'きみがいたなつのひ') are sung in full without sudden truncation.

## ballad-night~nomatch
- heard: よるのまちにほしがおちて とおいきおくそっとひらく なまえをよんだこえがふるえて まだきみをさがしてる あいたいよいまでもずっと ことばにできないおもい きみがいたなつのひ
- voice: octave shift -12, 13.9s · timings {"song":15.2,"split":5.6,"voice":14.2} · 8 line times
- problem: 0:39 - chorus skipped the lyric line 'このうたにのせて とどけたい' completely and jumped straight to 'きみがいたなつのひ'
- problem: 0:44-0:46 - track abruptly cuts off at the end of the phrase without a natural decay or instrumental outro
- problem: 0:00-0:12 - vocal timbre in the intro verse has noticeable AI phase/formant processing and slightly unnatural vibrato
- idea: Re-roll generation to ensure all chorus lines ('このうたにのせて とどけたい') are vocalized accurately
- idea: Extend the generation duration or add an [outro] tag to allow the final chord and reverb tail to decay naturally
- idea: Introduce a short piano intro tag ([intro]) before vocals start to ease into the ballad phrasing

## ballad-night~match50
- heard: よるのまちに ほしがおちて とおいきおく そっとひらく なまえをよんだ こえがふるえて まだきみをさがしてる あいたいよ いまでもずっと ことばにできないおもい きみがいたなすに
- voice: octave shift -12, 20.2s · timings {"song":15.9,"split":5.8,"voice":20.5} · 8 line times
- problem: 00:40 - The chorus line 'このうたにのせて とどけたい' is completely skipped.
- problem: 00:42-00:44 - 'きみがいたなつのひ' is mispronounced and cut short as 'きみがいたなすに'.
- problem: 00:44 - Audio cuts off abruptly without proper instrumental outro or lyrical resolution.
- problem: 00:17-00:20 - Vocal vibrato on sustained notes exhibits noticeable robotic/synthetic resonance.
- idea: Extend the generation length or adjust syllabic density so chorus lines are not dropped before the audio cut-off.
- idea: Add explicit phonetics for 'なつのひ' to prevent misreading as 'なすに'.
- idea: Apply slightly more hall reverb and de-essing to soften the artificial high-end presence on the lead vocal.

## hiphop-chill~match
- heard: ゆうがたのこうえん ぶらんこゆれる ぽけっとのなかには あめがふたつ ともだちとわらららら いつものばしょ このまちがすきなんだ ゆっくりいこうぜ あせらずに ぼくらのぺーすで すてっぷふんで きょうもいいかんじ ほらきこえる まちのりずむ
- voice: octave shift -12, 13.8s · timings {"song":15.3,"split":5.4,"voice":14.1} · 8 line times
- problem: 00:12-00:14: 'ともだちとわらう' の語尾が乱れ、'ともだちとわらららら' のように不自然なリピート・崩れが発生しています。
- problem: 00:00-00:05: 冒頭のボーカルのアタックが途切れ途切れで、少し吃音のような譜割りになっています。
- idea: 00:13付近の歌詞崩れ（わらららら）を解消するため、'ともだちと わらう' の間にスペースや読点を打つか、該当小節をインペインティング/再生成する。
- idea: メロディックラップとして成立していますが、サビ（ゆっくりいこうぜ〜）でもう少し音程の起伏やハモリ（ダブリング）を加えるとポップスとしてのフックが強くなります。

## hiphop-chill~nomatch
- heard: ゆうがたのこうえん ぶらんこゆれる ぽけっとのな あめがふたつ ともだちとわら いつものばしょ このまちがすきなんだ ゆっくりいこうぜ あせらずに ぼくらのぺーすで すてっぷふんで きょうもいいかんじ ほらきこえる まちのりずむ
- voice: octave shift -12, 13.9s · timings {"song":15.1,"split":5.3,"voice":14.2} · 8 line times
- problem: 00:07 - 00:08: 「ポケットのなかには」の「には」が脱落し、「ぽけっとのなー」と歌われています。
- problem: 00:13 - 00:14: 「ともだちとわらう」の語尾「う」が明瞭に発音されず、「ともだちとわらー」のように途切れています。
- idea: 歌詞の音節がリズムに対して詰まりすぎないよう、メロディの音符割り（譜割り）を調整するか、ひらがな表記で音節数を明示して生成し直す。
- idea: 語尾の発音が流れて省略されないよう、歌詞プロンプト側で「わ・ら・う」のように区切りを意識させる工夫をする。

## hiphop-chill~match50
- heard: ゆうがたのこうえん ぶらんこゆれる ぽけっとのなかには あめがふたつ ともだちとわらう いつものばしょ このまちがすきなんだ ゆっくりいこうぜ あせらずに ぼくらのぺーすで すてっぷふんで きょうもいいかんじ ほらきこえる まちのりずむ
- voice: octave shift -12, 19.9s · timings {"song":15.2,"split":5.4,"voice":20.1} · 8 line times
- problem: 00:18 - 「すきなんだ」の語尾のロングトーンにわずかなAI特有の平坦さ・引き延ばし感があります。
- problem: 00:41 - ボーカル終了からトラック終了までの余韻が短く、ややあっさりフェードアウトします。
- idea: サビ部分（00:21〜）でコーラスやダブリングを薄く重ねると、よりポップスとしてのキャッチーさや広がりが出ます。
- idea: アウトロにRhodesピアノの短いフレーズやビートのブレイクを2〜4小節追加して自然な終止感を作るとさらに良くなります。

## kids-march~match
- heard: くまさん うさぎさん おはようさん もりのみちを いっしょにあるこう どんぐりひろって ぽけっといっぱい ららら たのしいね みんなでうたえば もっとたのしい ららら またあした
- voice: octave shift -12, 13.5s · timings {"song":14.7,"split":5.5,"voice":13.8} · 6 line times
- problem: 00:00-00:08: イントロのロボット風ボーカルチョップが不気味で、子供向けマーチの爽やかな雰囲気と乖離している。
- problem: 00:08-00:20: Aメロのボーカルの音域が低く、歌い方も平坦で元気な子供向けソングとしてはテンションが低く聴こえる。
- problem: 00:23-00:25, 00:31-00:33: 『ララララ』が『ラ・ラ・ラ』と3拍分しか歌われておらず、歌詞の音節が欠落している。
- problem: 00:36-00:43: アウトロで再び電子的なボコーダー風の異音が入り、余韻が落ち着かない。
- idea: 明るい女性ボーカルや児童合唱風の声質（bright female/children vocal）を指定し、キーを上げて快活さを出す。
- idea: ウクレレやグロッケン、手拍子のアコースティックな質感を強調し、シンセ系ボーカルチョップをプロンプトのネガティブ指定で除外する。
- idea: 『playful bouncy march』などリズムのハネ感を強調し、メロディの躍動感を高める。

## kids-march~nomatch
- heard: くまさん うさぎさん おはようさん もりのみちを いっしょにあるこう どんぐりひろって ポケットいっぱい らーららら たのしいね みんなでうたえば もっとたのしい らーららら またあした
- voice: octave shift -12, 13.6s · timings {"song":14,"split":5.5,"voice":13.9} · 6 line times
- problem: 00:00-00:26: Vocals exhibit noticeable synthetic tuning and robotic artifacts, sounding like a synthesizer/Vocaloid rather than a natural human child/adult singer.
- problem: 00:30-00:43: Outro fills the remaining duration with repetitive, glitchy chipmunk/baby vocal chops instead of resolving naturally.
- idea: Add 'natural human voice, warm acoustic performance' to negative prompt robotic/vocaloid artifacts.
- idea: Specify an explicit outro structure [Outro: fade out or musical cadence] to prevent trailing nonsensical vocal loops at the end.

## kids-march~match50
- heard: くまさん うさぎさん おはようさん もりのみちを いっしょにあるこう どんぐりひろって ポケットいっぱい らららら たのしいね みんなでうたえば もっとたのしい らららら またあした
- voice: octave shift -12, 19.5s · timings {"song":14.3,"split":5.3,"voice":19.7} · 6 line times
- problem: 00:00 Vocal starts instantly without any musical intro.
- problem: 00:01-00:26 Vocal timbre sounds distinctly synthetic and robotic with unnatural pitch transitions.
- problem: 00:27-00:44 Vocals finish completely, leaving an unnecessarily long, repetitive instrumental outro that abruptly cuts off.
- idea: Include a short 2 to 4-bar instrumental intro before the verse begins.
- idea: Add prompt terms like 'warm natural female vocal', 'acoustic children\'s choir', or 'human expression' to soften synthetic vocal artifacts.
- idea: Structure the generation with outro cues or shorten the duration so it doesn't loop instrumentals for 17 seconds after singing ends.

## pop-bright+2ban
- heard: あさのひかり まどをあけて きのうのなみだ かぜにとばそう ちいさなゆめ ぽけっとにいれて きょうもあるきだす きみとなら どこまでも そらはいつもあおいから わらってうたおう いまここで あしたもきっといいひ
- voice: no voice sent · timings {"song":7,"split":5.5,"voice":0} · 16 line times
- problem: 00:43: The song abruptly terminates at the end of the first chorus interlude without including any of the extended lyrics (the entire second verse 'ゆうやけのみち...' and second chorus are missing).
- problem: 00:35-00:44: The interlude trails off and fades out early instead of building momentum to transition into verse 2.
- idea: Extend generation length/tokens so the model actually composes the second verse and chorus beyond 00:44.
- idea: Set the continuation point right after the chorus (around 00:35) and feed the second verse prompt directly to ensure seamless continuation.

## pop-bright+2ban~regen
- heard: あさのひかり まどをあけて きのうのなみだ かぜにとばそう ちいさなゆめ ぽけっとにいれて きょうもあるきだす きみとならどこまでも そらはいつもあおいから わらってうたおう いまここで あしたもきっといいひ ゆうやけのみち かげがのびて きょうのできごと はなしながら ちいさなけんか すぐなかなおり またあるきだす きみとならどこまでも そらはいつもあおいから わらってうたおう いまここで あしたもきっといいひ
- voice: no voice sent · timings {"song":26.6,"split":8.8,"voice":0} · 16 line times
- problem: 01:08 - 01:19: The instrumental outro winds down a bit abruptly with a standard acoustic loop rather than a defined musical punctuation/coda.
- problem: 00:29 - 00:33 and 01:03 - 01:07: 'ashita mo kitto ii hi' has a slight pitch-quantized synthetic sheen on the high sustain, though very minor.
- idea: Add an explicit [outro] prompt tag specifying a definitive resolved final chord or bell chime to give the ending a more polished storybook finish.
- idea: Consider adding subtle harmony or children chorus layers in Chorus 2 (00:51) to dynamically build contrast from Chorus 1.

## ballad-night+oosabi
- heard: よるのまちにほしがおちてとおいきおくそっとひらく なまえよんだこえがふるえてまだきみをさがしてる あいたいよいまでもずっとことばにできないおもいきえたいきみがな
- voice: octave shift 0, 13.9s · timings {"song":7,"split":5.5,"voice":14.1} · 14 line times
- problem: 00:38 - 00:43: Chorus lyrics deviate from the prompt, singing 'きえたい きみがな' instead of 'このうたにのせて とどけたい'.
- problem: 00:44 - 00:45: The track abruptly cuts off mid-phrase with no actual extended section (bridge or full chorus) generated.
- idea: Increase generation token limit or extension duration setting to prevent premature cutoff at 45 seconds.
- idea: Prompt lyrics with line breaks and verse/chorus tags to improve lyrical adherence and avoid altered words like 'きえたい'.

## ballad-night+oosabi~regen
- heard: よるのまちにほしがおちてとおいきおくそっとひらくなまえをよんだこえがふるえてまだきみをさがしてるあいたいよいまでもずっとことばにできないおもいこのうたにのせてとどけたいきみがいたなつのひもしもあのひにもどれたらぼくはなんていうだろうあいたいよいまでもずっとことばにできないおもいこのうたにのせてとどけたいきみがいたなつのひ
- voice: octave shift -12, 24.3s · timings {"song":29.1,"split":8.7,"voice":24.6} · 14 line times
- problem: 00:44-00:48: Slightly abrupt lull in dynamics before the bridge enters
- problem: 01:00-01:02: Minor vocal breath/tail cutoff right before chorus 2 drops in
- problem: 01:19-01:21: The final piano chord decay cuts off slightly early rather than fading naturally
- idea: Extend the reverb tail and allow the final piano chord to ring out 2-3 seconds longer at the end
- idea: Add a light cymbal swell or string crescendo between 00:46 and 00:48 to smooth the transition into the bridge
