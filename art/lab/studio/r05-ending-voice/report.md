# Studio lab — r05-ending-voice

- **std** {"tune":{}}: overall 7.3 · vocalNaturalness 7.2 · pitch 8.1 · diction 7.7 · melody 7.8 · arrangement 7.4 · mix 7.8 · genreFit 8.2 · artifacts 7.4
- **outro** {"tune":{"outro":true}}: overall 7.7 · vocalNaturalness 7.5 · pitch 8.4 · diction 7.9 · melody 8 · arrangement 7.8 · mix 8 · genreFit 8.7 · artifacts 8

①今の標準 ②[Intro]/[Outro] を付けて2小節長く。声を変える曲は、同じテイクの「変換前（スタジオの声）」も採点して、変換でどれだけ落ちるかを測る。音割れ防止のリミッターも入れた。

recipe: {} / vocal words: (app default)

**average**: overall 7.4 · vocalNaturalness 7.3 · pitch 8.2 · diction 7.7 · melody 7.8 · arrangement 7.6 · mix 7.9 · genreFit 8.4 · artifacts 7.7

| case | overall | voice | pitch | diction | melody | arr. | mix | genre | artif. | LUFS | peak | silence | voiced | time |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pop-bright~std | 8.5 | 8.5 | 8.8 | 9 | 8.6 | 8.2 | 8.4 | 9 | 8.5 | -14.5 | -1.1 | 0s | no | 97s |
| pop-bright~outro | 8.5 | 8.5 | 9 | 9 | 9 | 8 | 8.5 | 9.5 | 8 | -12.9 | -0.9 | 6.3s | no | 30s |
| ballad-night~std | 7 | 6.8 | 7.8 | 8 | 7.6 | 6.8 | 7.2 | 8.2 | 6.5 | -12.2 | -1.1 | 0s | yes | 61s |
| ballad-night~std@studio | 7.5 | 7 | 7.5 | 8 | 7.5 | 7.5 | 7.5 | 8.5 | 7 | -11.5 | -1 | 0s | no | 61s |
| ballad-night~outro | 7 | 7.5 | 8.5 | 7 | 8 | 7 | 8 | 9 | 7.5 | -12.4 | 0.3 | 0s | yes | 55s |
| ballad-night~outro@studio | 6.6 | 6.8 | 7.5 | 6.5 | 7.5 | 7.8 | 7.4 | 8.5 | 6.8 | -13.4 | -1.1 | 0s | no | 55s |
| rock-run~std | 8.3 | 8.5 | 8.5 | 8 | 8.5 | 8 | 8 | 9 | 8.5 | -12.3 | 0.6 | 2.6s | no | 27s |
| rock-run~outro | 8 | 7 | 8.5 | 8.5 | 8 | 8 | 7.5 | 9 | 8 | -13.5 | -2 | 5.4s | no | 29s |
| hiphop-chill~std | 6.4 | 7 | 7.5 | 5.8 | 7.6 | 6.4 | 7.5 | 8.5 | 6 | -13.3 | -0.4 | 2.1s | yes | 46s |
| hiphop-chill~std@studio | 6 | 7.5 | 8 | 5 | 7.5 | 8 | 8 | 9 | 8.5 | -15.2 | -1 | 2s | no | 46s |
| hiphop-chill~outro | 6.2 | 7.5 | 8.5 | 5.5 | 8 | 7 | 8 | 9 | 8.5 | -14 | -1.3 | 0s | yes | 51s |
| hiphop-chill~outro@studio | 7.2 | 7.8 | 8.5 | 6.2 | 8 | 7.2 | 8.5 | 9 | 8.5 | -13.3 | -1.3 | 7.8s | no | 51s |
| edm-party~std | 8 | 7.5 | 9 | 7.5 | 8.5 | 9 | 8.5 | 9.5 | 8.5 | -16.9 | -2.9 | 0s | no | 28s |
| edm-party~outro | 8 | 7.8 | 8.5 | 8.5 | 8 | 7.5 | 8 | 8.5 | 8 | -13.3 | -1.3 | 4.3s | no | 31s |
| kids-march~std | 5.5 | 5 | 7.5 | 8 | 6 | 5 | 6.5 | 5.5 | 6.5 | -13.8 | -1 | 3.5s | yes | 44s |
| kids-march~std@studio | 5.2 | 5 | 7 | 8 | 6 | 5 | 6.5 | 5.5 | 6 | -15 | -2 | 3.6s | no | 44s |
| kids-march~outro | 5.8 | 5 | 6 | 7 | 5.5 | 7 | 6.5 | 6 | 6 | -13.7 | 0.2 | 0s | yes | 48s |
| kids-march~outro@studio | 9 | 8.5 | 9 | 9 | 9 | 9 | 8.5 | 9.5 | 8.5 | -14.7 | -1.3 | 0s | no | 48s |
| citypop-drive~std | 6.2 | 6 | 7.5 | 6 | 7 | 7.5 | 7.5 | 8 | 6.5 | -13.6 | -1.1 | 5.7s | no | 28s |
| citypop-drive~outro | 9 | 8.5 | 9 | 9 | 9 | 9 | 8.5 | 9.5 | 9 | -14.4 | -0.9 | 5.8s | no | 32s |
| folk-letter~std | 8.2 | 8 | 8.5 | 9 | 8.5 | 8 | 8.5 | 8 | 8.5 | -13.6 | -0.8 | 0s | yes | 45s |
| folk-letter~std@studio | 8 | 7.5 | 8 | 8.5 | 8 | 7.5 | 8 | 8 | 8.5 | -13.2 | -0.6 | 0s | no | 45s |
| folk-letter~outro | 8.8 | 8.5 | 9 | 9 | 8.5 | 9 | 8.8 | 9.2 | 9 | -15.4 | -1.2 | 0s | yes | 51s |
| folk-letter~outro@studio | 8.2 | 8 | 8.5 | 9 | 8.5 | 8 | 8.5 | 8.5 | 8.5 | -13.3 | -0.9 | 0s | no | 51s |

## pop-bright~std
- heard: あさのひかり まどをあけて きのうのなみだ かぜにとばそう ちいさなゆめ ぽけっとにいれて きょうもあるきだす きみとならどこまでも そらはいつもあおいから わらってうたおう いまここで あしたもきっといいひ
- voice: no voice sent · timings {"song":77.3,"split":11.9,"voice":0} · 8 line times
- problem: 00:00 Vocal enters immediately with zero introductory instrumental bar, which can feel abrupt.
- problem: 00:31-00:33 Minor synthetic high-frequency flutter on the sustained vocal tail of 'いいひ'.
- problem: 00:34-00:45 The outro repeats the rhythm vamp without a clear melodic resolving phrase or ritardando.
- idea: Insert an [intro] tag in lyrics or prompt for a 2-4 bar acoustic guitar/piano intro before vocals begin.
- idea: Add an outro prompt or closing chord instruction to give the ending a satisfying resolution.

## pop-bright~outro
- heard: あさのひかり まどをあけて きのうのなみだ かぜにとばそう ちいさなゆめ ポケットにいれて きょうもあるきだす きみとならどこまでも そらはいつもあおいから わらってうたおう いまここで あしたもきっといいひ
- voice: no voice sent · timings {"song":15.6,"split":5.8,"voice":0} · 8 line times
- problem: 00:42-00:49: The song cuts out abruptly at 00:42 followed by approximately 7 seconds of trailing silence.
- idea: Trim trailing silence after the musical ending at 00:42 or extend the outro with a short acoustic guitar/piano ring-out chord.
- idea: Add a brief instrumental ritardando or concluding chord for a more natural song finish.

## ballad-night~std
- heard: よるのまちにほしがおちて とおいきおくそっとひらく なまえをよんだこえがふるえて まだきみをさがしてる あいたいよいまでもずっと ことばにできないおもい このうたにのせてとどけたい きみがいたなつ
- voice: octave shift -12, 24.5s · timings {"song":16.2,"split":5.7,"voice":27.3} · 8 line times
- problem: 00:48-00:50: The audio abruptly cuts off mid-phrase on 'きみがいたなつ', missing the final 'のひ' and any outro fade.
- problem: 00:02-00:24: Sustained notes and vibrato in the verse show noticeable autotune/synthetic vocal warble.
- problem: 00:26-00:28: The percussion entry at the chorus is abrupt and could use a better transitional build (e.g. reverse cymbal or soft drum fill).
- idea: Increase generation length to allow the chorus last phrase ('きみがいたなつのひ') and a proper musical decay/outro to finish.
- idea: Add transitional elements like a reverse cymbal or piano swell right before 00:27 to smooth the beat drop into the chorus.
- idea: Apply gentle tape saturation and softer high-frequency de-essing to warm up the synthetic vocal timbre.

## ballad-night~std@studio
- heard: よるのまちにほしがおちてとおいきおくそっとひらくなまえをよんだこえがふるえてまだきみをさがしてるあいたいよいまでもずっとことばにできないおもいこのうたにのせてとどけたいきみがいたなつの
- voice: same take, studio voice · timings {"song":16.2,"split":5.7,"voice":27.3} · 8 line times
- problem: 0:49 - Audio abruptly cuts off mid-word on 'なつの' before finishing 'なつのひ'
- problem: 0:15-0:25 - Vocal breath sounds and sustains exhibit slight robotic phasing artifacts
- problem: 0:26 - Chorus entry dynamic jump is slightly jarring and could use smoother transitional riser/fill
- idea: Extend generation duration so the final phrase resolves naturally without getting cut off
- idea: Apply gentle de-essing and low-pass smoothing on vocal breath frequencies to reduce synthetic grain
- idea: Smooth transition volume into the chorus with subtle reverse cymbal or dynamic ducking

## ballad-night~outro
- heard: よるのまちに ほしがおちて とおいきおく そっとひらく なまえをよんだ こえがふるえて まだきみをさがしてる あいたいよ いまでもずっと このうたにのせて とどけたい きみがいたなつのひ
- voice: octave shift 0, 17.5s · timings {"song":18.8,"split":6.4,"voice":17.7} · 8 line times
- problem: 00:00 - 00:04: Awkward vocal sigh/gasp artifact at the very start before the piano intro.
- problem: 00:48: The expected chorus lyric line 'ことばにできないおもい' is completely skipped.
- problem: 00:56: The audio abruptly cuts off at the end of the chorus line without proper tail decay.
- idea: Trim or prompt against vocal ad-libs before the instrumental intro begins.
- idea: Ensure the lyric formatting clearly spaces out chorus lines so the model does not drop entire sentences.
- idea: Extend the generation duration or add an outro tag to avoid abrupt clipping at the end of the phrase.

## ballad-night~outro@studio
- heard: よるのまちに ほしがおちて とおいきおく そっとひらく なまえをよんだ こえがふるえて まだきみをさがしてる あいたいよ いまでもずっと このうたにのせて とどけたい いたなつのひ
- voice: same take, studio voice · timings {"song":18.8,"split":6.4,"voice":17.7} · 8 line times
- problem: 00:41 - 00:44: The transition into the chorus has noticeable pitch-correction warble on 'あいたいよ'.
- problem: 00:48: The entire line 'ことばにできないおもい' is skipped in the chorus.
- problem: 00:54 - 00:56: The final phrase drops 'きみが' and sings 'いたなつのひ' before cutting off abruptly mid-measure.
- idea: Re-prompt or extend generation time so the model does not skip 'ことばにできないおもい'.
- idea: Add structured section markers like [Chorus] and [Outro] with negative prompting against abrupt cuts to allow the final line 'きみがいたなつのひ' to ring out properly.
- idea: Slightly reduce breathy vocal tags to prevent the pitch-warble and raspy synthetic artifact on high belted notes.

## rock-run~std
- heard: はしれはしれかぜをきってまけないこころもやしてゆけたおれたってなんどでもたちあがるんだいまださけべぼくらのうたやみをきりさくひかりになれとどけとどけそらのかなたゆめのかなたおわんなゆめはおわらない
- voice: no voice sent · timings {"song":14.5,"split":5.3,"voice":0} · 8 line times
- problem: 00:28 - 00:33: Lyrics hallucination/stumble where singer sings 'ゆめのかなた おわんな...' before re-singing 'ゆめはおわらない'.
- problem: 00:40 - 00:45: Outro ends somewhat abruptly after the final vocal line.
- idea: Clean up prompt tags or add an explicit [outro] marker so the lyrics in the final chorus line don't glitch or repeat words like 'かなた'.
- idea: Specify a definitive ending chord or instrumental outro tag to prevent the sudden cut at the tail.

## rock-run~outro
- heard: はしれ はしれ かぜをきって まけないこころ もやしてゆけ たおれたって なんどでも たちあがるんだ いまだ さけべ ぼくらのうた やみをきりさく ひかりになれ とどけ とどけ そらのかなた ゆめはおわらない
- voice: no voice sent · timings {"song":15.2,"split":5.7,"voice":0} · 8 line times
- problem: 0:06 - 0:22: ボーカルにわずかにボーカロイド特有の機械的な質感や高音のレゾナンスの癖があります。
- problem: 0:36 - 0:47: ラスサビ後のアウトロが短く、フレーズが途中で唐突に終わる印象を与えます。
- idea: プロンプトに「natural acoustic vocals」「human female singer」などを指定して、ボーカルの合成感を低減する。
- idea: 構成指示に明確な「[outro] finish / resolved final chord」などを追加し、楽曲の結びを自然にまとめる。

## hiphop-chill~std
- heard: ゆうがたのこうえん ブランコゆれる ポケットのなかには あめがふたつ ともだちとわらう いつものばしょ このまちがすかせらずに ぼくらのペースで ステップふんで きょうもいいかんじ ほらきこえる まちのリズム
- voice: octave shift 0, 13.9s · timings {"song":14.8,"split":5.2,"voice":14.2} · 8 line times
- problem: 00:26 - 00:29: The lyrics skip and merge awkwardly; 'きなんだ' (from このまちがすきなんだ) and 'ゆっくりいこうぜ' are completely omitted, sounding like 'このまちがす、かせらずに'.
- problem: 00:43: The audio terminates abruptly instead of having a natural fade-out or resolved musical tail.
- idea: Add explicit rhythmic line breaks or section tags between the verse and chorus so the model doesn't rush and drop phrases.
- idea: Extend track generation length by 5–10 seconds to allow the final chord and reverb tail to decay naturally without an abrupt cutoff.

## hiphop-chill~std@studio
- heard: ゆうがたのこうえん ぶらんこゆれる ぽけっとのなかには あめがふたつ ともだちとわらう いつものばしょ このまちがすかぜらしくにー ぼくらのぺーすで すてっぷふんで んー きょうもいいかんじ ほらきこえる まちのりずむ
- voice: same take, studio voice · timings {"song":14.8,"split":5.2,"voice":14.2} · 8 line times
- problem: 00:26-00:29: The lyric 'このまちがすきなんだ' was hallucinated/garbled into something like 'このまちがす かぜらしくにー'.
- problem: 00:30: The chorus skipped the first line 'ゆっくりいこうぜ あせらずに' entirely and jumped straight into 'ぼくらのペースで'.
- problem: 00:43: The track ends abruptly right after 'まちのリズム' without a natural instrumental tail or fade.
- idea: Re-generate with stronger prompt weights on lyric adherence or break verse and chorus into two distinct generation segments to ensure all lines are sung.
- idea: Add a designated outro section ([outro] or instrumental bar) so the audio does not cut off instantly after the last vocal line.

## hiphop-chill~outro
- heard: このまちがすきなんだ ゆっくりいこうぜ あせらずに ぼくらのぺーすで すてっぷふんで きょうもいいかんじ ほらきこえる まちのりかんじ まちの
- voice: octave shift 0, 16.3s · timings {"song":16.2,"split":5.8,"voice":16.5} · 8 line times
- problem: 00:00-00:16: Long intro where the first three lines of the verse ('ゆうがたのこうえん...' to 'いつものばしょ') were completely omitted.
- problem: 00:31-00:33: 'まちのリズム' sounds muffled/slurred as 'まちのりかんじ'.
- problem: 00:37-00:39: Unfinished fragment 'まちの...' cut off into a long instrumental outro.
- idea: Shorten the intro prompt tags or force a verse start earlier so the generator doesn't skip the first three lines of text.
- idea: Clarify syllable cadence on 'まちのリズム' in the lyrics prompt to prevent slurring into 'まちのりかんじ'.

## hiphop-chill~outro@studio
- heard: このまちがすきなんだ ゆっくりいこうぜ あせらずに ぼくらのぺーすで すてっぷふんで きょうもいいかんじ ほらきこえる まちのりかんじ まちの
- voice: same take, studio voice · timings {"song":16.2,"split":5.8,"voice":16.5} · 8 line times
- problem: 00:16: Skips the first three lines of the verse completely (jumps straight to 'このまちがすきなんだ').
- problem: 00:30-00:33: Misses the prompt lyric 'まちのリズム', singing 'まちのりかんじ' / 'まちのいいかんじ' instead.
- problem: 00:36-00:39: Vocal trails off mid-phrase on an incomplete 'まちの...'.
- problem: 00:39-00:51: Extended empty instrumental tail where additional verses or repeats could have been placed.
- idea: Re-roll with explicit section tags ([Intro], [Verse 1], [Chorus]) to ensure the model does not drop the opening 3 lines.
- idea: Add phonetic guides or lyric emphasis for 'まちのリズム' to prevent phonetic blending with 'いいかんじ'.
- idea: Shorten intro/outro bars in prompt to give the AI enough generation window to fit the full lyric structure.

## edm-party~std
- heard: ねおんのなか すてっぷふんで こころのおと ぼりゅーむあげて みんなでいっしょ てをあげて いまはじまるよ おどれ おどれ よるがあけるまで ひかりのなかで とびはねよう ぼくらはいま むてきなんだ むてきなんだ
- voice: no voice sent · timings {"song":14.4,"split":5.2,"voice":0} · 8 line times
- problem: 00:08: 「みんなでいっしょに」の「に」が欠落し、「みんなでいっしょ」と歌われている
- problem: 00:26-00:29: 「パーティーはこれから」の歌詞が歌われず、「むてきなんだ」の繰り返しに差し替えられている
- idea: ドロップ直前の小節数と音節配分を見直し、'パーティーはこれから' が確実にビルドアップの終わりまでに歌い切れるよう歌詞プロンプトを整理する
- idea: 00:30以降のドロップパートにボイスサンプルや掛け声（Hey!、Jump!など）を配置してさらに盛り上がりを強化する

## edm-party~outro
- heard: ねおんのなか すてっぷふんで こころのおと ぼりゅーむあげて みんなでいっしょに てをあげて いまはじまるよ おどれ おどれ よるがあけるまで ひかりのなかで とびはねよう ぼくらはいま むてきなんだ ぱーてぃーはこれから
- voice: no voice sent · timings {"song":15.5,"split":5.8,"voice":0} · 8 line times
- problem: 00:47-00:48: Instrumental drop cuts off abruptly without a proper outro fade or resolve.
- problem: 00:37-00:48: The chorus flows straight into an instrumental drop without vocal chops or ad-libs to keep the vocal excitement going.
- idea: Add prompt tags for [outro] or allow extra duration to avoid the track abruptly cutting off mid-drop.
- idea: Introduce playful vocal chops or chant samples (e.g. 'Hey!', 'Let's go!') during the drop section to maintain vocal engagement for kids.

## kids-march~std
- heard: くまさん うさぎさん おはようさん もりのみちを いっしょにあるこう どんぐりひろって ポケットいっぱい ラララ たのしいね みんなでうたえば もっとたのしい ラララ またあした
- voice: octave shift 0, 13.6s · timings {"song":14.2,"split":5.2,"voice":13.8} · 6 line times
- problem: 00:08-00:21: The vocal performance is surprisingly flat, low-energy, and robotic rather than cheerful and expressive.
- problem: 00:21, 00:30: The singer sings 'ラララ' (three syllables) instead of the prompted four 'ララララ'.
- problem: 00:00-00:07 & 00:34-00:43: Arrangement lacks acoustic instruments like ukulele and glockenspiel; instead it relies on sparse electronic brass and cartoon sound effects.
- problem: 00:34-00:43: The outro is empty and consists mostly of isolated sound effect loops with long silences.
- idea: Add prompt tags like 'energetic female vocals', 'cute cheerful voice', 'high energy nursery rhyme' to avoid deadpan delivery.
- idea: Emphasize acoustic instruments in the prompt, such as 'bright acoustic ukulele, authentic glockenspiel, live handclaps, marching acoustic snare'.
- idea: Shorten the outro or specify an explicit musical finale tag (e.g., '[Outro: energetic big finish with crash and glockenspiel chord]').

## kids-march~std@studio
- heard: くまさん うさぎさん おはようさん もりのみちを いっしょにあるこう どんぐりひろって ポケットいっぱい ららら たのしいね みんなでうたえば もっとたのしい ららら またあした
- voice: same take, studio voice · timings {"song":14.2,"split":5.2,"voice":13.8} · 6 line times
- problem: 00:21 - Sudden jarring vocal shift from a female vocalist in the verse to a low male vocalist in the chorus.
- problem: 00:00-00:07 - Intro relies on odd mouth-pop percussion sounds rather than the requested ukulele and glockenspiel march.
- problem: 00:22, 00:30 - Sang 'ラララ' instead of 'ララララ'.
- problem: 00:33-00:45 - The song ends abruptly after the vocals, leaving empty percussion loops without a melodic musical resolution.
- idea: Specify 'consistent solo female vocalist' in the prompt to prevent sudden singer gender swaps between sections.
- idea: Strengthen acoustic instrument prompts (e.g., 'bright acoustic ukulele strumming, cheerful glockenspiel melody') to replace synth mouth-pop effects.
- idea: Guide the arrangement with structural tags like [Outro: cheerful chime finish] to ensure a clean ending.

## kids-march~outro
- heard: くまさん うさぎさん おはようさん もりのみちを いっしょにあるこう どんぐりひろって ポケットいっぱい ららら たのしいね みんなでうたえば もっとたのしい ららら またあした あー
- voice: octave shift -12, 14.7s · timings {"song":16.1,"split":5.7,"voice":14.9} · 6 line times
- problem: 0:08-0:21: The verse vocal is delivered in an overly low, monotone male chant that lacks the brightness and enthusiasm expected in a kids song.
- problem: 0:22: Disjointed sudden switch from low male vocals to high pitched/female vocals at the chorus.
- problem: 0:22, 0:30: 'ララララ' is sung with three syllables ('ラララー') instead of four.
- problem: 0:33-0:35: The vocal ends awkwardly with an unnatural trailing sigh/groan ('あー').
- idea: Prompt explicitly for a consistent bright, energetic female vocal or children choir throughout the song (e.g. 'energetic female kids vocal, cheerful, bright tone').
- idea: Specify 'melodic singing' in the prompt to prevent the verses from turning into flat, low-register recitations.

## kids-march~outro@studio
- heard: くまさん うさぎさん おはようさん もりのみちを いっしょにあるこう どんぐりひろって ポケットいっぱい らららー たのしいね みんなでうたえば もっとたのしい らららー またあした
- voice: same take, studio voice · timings {"song":16.1,"split":5.7,"voice":14.9} · 6 line times
- problem: 00:22 and 00:30: Sung as 'らららー' (three beats/syllables) instead of four crisp 'ララララ' staccato syllables, though musically it flows naturally.
- problem: 00:33-00:36: Vocal fadeout/outro sigh ('はー') has slight AI vocal-fry/formant jitter.
- idea: Prompt specifically for staccato articulation if 4 distinct 'ラ・ラ・ラ・ラ' syllables are strictly required.
- idea: Add a tiny fade-out on the tail of the vocal layer around 00:35 to eliminate minor synthesizer breath jitter.

## citypop-drive~std
- heard: まどをあけたら かぜがわらう どこまでもいこう きらめくまちを ぬけだして ふたりだけの ドライブ ほしぞらのした ほしぞらのした うたいながら ゆめのつづきへ
- voice: no voice sent · timings {"song":14.8,"split":5.2,"voice":0} · 8 line times
- problem: 00:11 The first two lines of the verse ('よるのハイウェイ...', 'ラジオからきこえる...') were completely skipped.
- problem: 00:30-00:34 The vocal stutters and repeats the line 'ほしぞらのした' twice.
- problem: Vocal timbre leans heavily synthetic/Vocaloid rather than a natural human lead singer.
- idea: Provide clear structural tags (e.g. [Verse 1], [Chorus]) to prevent the AI from skipping early lyric lines.
- idea: Reroll or inpaint around 00:30 to remove the accidental lyric repetition.
- idea: Add prompt terms like 'organic human vocals, natural breathing, expressive warm tone' to avoid overly synthetic vocal artifacts.

## citypop-drive~outro
- heard: よるのハイウェイ ライトがながれる ラジオからきこえる なつかしいうた まどをあけたら かぜがわらう どこまでもいこう きらめくまちをぬけだして ふたりだけのドライブ ほしぞらのした うたいながら ゆめのつづきへ
- voice: no voice sent · timings {"song":16.1,"split":5.7,"voice":0} · 8 line times
- problem: 00:37-00:50: The song ends on an instrumental vamp without a proper outro cadence or fade-out.
- idea: Add an explicit [outro] tag with a fade-out prompt or finishing chord in the lyrics/structure prompt to give it a conclusive ending.

## folk-letter~std
- heard: ふるさとのえきにおりたつと かわらないけしきむかえてくれた おかあさんのこえとおくから おかえりときこえた ありがとういえなかったこと このうたにこめておくるよ いつまでもげんきでいてね またかえるからね
- voice: octave shift 0, 14.0s · timings {"song":14.8,"split":5.3,"voice":14.2} · 8 line times
- problem: 00:00-00:45: プロンプトで指示されていたハーモニカ（soft harmonica）の音色が入っていない
- problem: 00:13-00:17: ボーカルのピッチベンドや音の繋ぎにわずかな合成音声特有の不自然さ（ケロケロ感・フォルマント加工感）が残っている
- idea: 指定したハーモニカを取り入れるため、歌詞構成に [harmonica solo] や [harmonica intro] などのインスト指示タグを明記する
- idea: ボーカルをさらにオーガニックに響かせるため、リバーブを少し抑えめにし、アコースティック・フォークらしい生々しい息遣いを意識したプロンプト（organic vocal, intimate vocal）を追加する

## folk-letter~std@studio
- heard: ふるさとのえきに おりたつと かわらないけしき むかえてくれた おかあさんのこえ とおくから おかえりときこえた ありがとう いえなかったこと このうたにこめて おくるよ いつまでも げんきでいてね またかえるからね
- voice: same take, studio voice · timings {"song":14.8,"split":5.3,"voice":14.2} · 8 line times
- problem: 00:00-00:45: The requested soft harmonica instrument is largely missing from the arrangement, relying mostly on guitar and light piano.
- problem: 00:38-00:40: The vocal tail on 'いてね' has a slight synthetic digital vibrato/flutter.
- idea: Prompt explicitly for harmonica fills between vocal phrases in the verse and chorus.
- idea: Add slight room reverb on the vocal to soften sustained vowel decays and mask synthetic flutter.

## folk-letter~outro
- heard: ふるさとのえきにおりたつと かわらないけしきむかえてくれた おかあさんのこえとおくから おかえりときこえた ありがとういえなかったこと このうたにこめておくるよ いつまでもげんきでいてね またかえるからね
- voice: octave shift 0, 16.3s · timings {"song":16.7,"split":5.8,"voice":16.6} · 8 line times
- problem: 00:43-00:45: 'いてね'のロングトーン部分で、わずかにAI特有のフォルマント揺らぎ・ピッチ修正感が感じられます。
- problem: 00:49-00:51: アウトロのアコースティックギターの余韻が少し早くフェードアウト/カットアウトしています。
- idea: コーラスの語尾のビブラートやロングトーンがより自然になるよう、ボーカルプロンプトに'natural acoustic vibrato'などを追加する。
- idea: アウトロの余韻（リバーブテール）を自然に残すため、数秒の無音余白を持たせてレンダリングする。

## folk-letter~outro@studio
- heard: ふるさとのえきにおりたつとかわらないけしきむかえてくれたおかあさんのこえとおくからおかえりときこえたありがとういえなかったことこのうたにこめておくるよいつまでもげんきでいてねまたかえるからね
- voice: same take, studio voice · timings {"song":16.7,"split":5.8,"voice":16.6} · 8 line times
- problem: 00:00-00:51: プロンプトで指定されていたハーモニカ（soft harmonica）のパートが含まれておらず、アコースティックギターのみの編成になっています。
- problem: 00:35-00:40: サビの高音域でわずかにAI特有のデジタルな倍音・微細な揺らぎがボーカルに感じられます。
- idea: ハーモニカのオブリガートや間奏を取り入れるため、プロンプトでハーモニカのソロや伴奏の重要度を強調する（例: prominent soft harmonica riffs, harmonica fills）。
- idea: サビでの抑揚とダイナミクスを広げるために、パーカッション（シェイカー等）やストリングス/ベースを軽く追加する構成を試す。
