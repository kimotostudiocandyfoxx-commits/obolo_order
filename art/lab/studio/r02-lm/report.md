# Studio lab — r02-lm

- **base** {"tune":{}}: overall 3.1 · vocalNaturalness 3.4 · pitch 4.7 · diction 2.9 · melody 4.3 · arrangement 4.7 · mix 5.7 · genreFit 4.9 · artifacts 5.8
- **lm** {"tune":{"lm":true}}: overall 6.9 · vocalNaturalness 6.5 · pitch 7.6 · diction 7.3 · melody 7.2 · arrangement 7.1 · mix 7.1 · genreFit 8.3 · artifacts 7

新方針：基本は45秒前後（Aメロ4行＋サビ4行）。LM なし／ありを比べる。気に入った曲に「2番」「大サビ」を後から足す（/extend）テストも入れる。

recipe: {} / vocal words: (app default)

**average**: overall 4.6 · vocalNaturalness 4.6 · pitch 5.6 · diction 4.5 · melody 5.3 · arrangement 5.8 · mix 6.3 · genreFit 6.1 · artifacts 6.3

| case | overall | voice | pitch | diction | melody | arr. | mix | genre | artif. | LUFS | peak | silence | voiced | time |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pop-bright~base | 2 | 1 | 1 | 1 | 3 | 5 | 6 | 4 | 8 | -15.2 | -0.8 | 2.3s | no | 37s |
| pop-bright~lm | 8.2 | 7.8 | 8.5 | 9 | 8.2 | 8 | 8 | 9 | 8.2 | -13.6 | -0.9 | 5.1s | no | 79s |
| ballad-night~base | 2 | 4 | 6 | 1 | 4 | 6 | 6 | 4 | 7.5 | -13 | -1.3 | 0s | yes | 47s |
| ballad-night~lm | 4.8 | 4.5 | 5.5 | 6 | 5 | 4.5 | 5 | 6 | 4.5 | -12.1 | -0.9 | 0s | yes | 50s |
| rock-run~base | 1.5 | 1 | 1 | 1 | 1.5 | 4 | 5 | 3.5 | 5 | -12.7 | -1.1 | 1.6s | no | 21s |
| rock-run~lm | 8.8 | 8.5 | 9 | 9 | 9 | 8.5 | 8.5 | 9.5 | 9 | -13.6 | -1.2 | 1.7s | no | 31s |
| hiphop-chill~base | 5.8 | 6.5 | 7.2 | 5.5 | 7 | 6 | 7.3 | 8 | 5.5 | -13.3 | -0.6 | 0s | yes | 38s |
| hiphop-chill~lm | 5.5 | 5.5 | 7.5 | 5 | 6.5 | 7 | 7 | 8.5 | 6 | -13.3 | -1.1 | 1.8s | yes | 50s |
| edm-party~base | 4 | 5 | 7 | 5 | 6 | 4 | 6 | 7 | 4 | -12.5 | -1.2 | 0s | no | 21s |
| edm-party~lm | 8 | 7.5 | 8.5 | 9 | 7.5 | 8 | 7.5 | 8.5 | 8 | -11.4 | -0.6 | 4.9s | no | 32s |
| kids-march~base | 3.5 | 3 | 6 | 4 | 4 | 3 | 4 | 3 | 5 | -15.1 | -0.7 | 0s | yes | 38s |
| kids-march~lm | 6 | 5 | 6.5 | 6 | 7 | 6.5 | 6.5 | 8 | 6 | -13.9 | -0.9 | 0s | yes | 48s |
| pop-bright+2ban | 2 | 1 | 1 | 1 | 3 | 6 | 6 | 3 | 8 | -14.9 | -0.8 | 0s | no | 32s |
| ballad-night+oosabi | 2 | 4 | 4 | 1 | 3 | 4 | 5 | 4 | 3 | -13.5 | -1.3 | 0s | yes | 51s |

## pop-bright~base
- heard: 
- voice: no voice sent · timings {"song":16.1,"split":11.7,"voice":0} · 8 line times
- problem: 00:00-00:45: Entire track is instrumental with no vocal generated at all
- problem: 00:00-00:45: None of the expected Japanese lyrics are sung
- problem: 00:42-00:45: Track abruptly cuts off without a proper ending
- idea: Ensure vocal generation mode is enabled instead of instrumental mode
- idea: Prepend explicit vocal markers such as [Lead Vocal] or [Female Vocals] before the lyrics block
- idea: Re-run generation with stronger vocal emphasis in prompt tags

## pop-bright~lm
- heard: あさのひかり まどをあけて きのうのなみだ かぜにとばそう ちいさなゆめ ポケットにいれて きょうもあるきだす きみとならどこまでも そらはいつもあおいから わらってうたおう いまここで あしたもきっといいひ
- voice: no voice sent · timings {"song":65.4,"split":5.5,"voice":0} · 8 line times
- problem: 00:17 - 00:19: Verse-to-chorus transition feels a bit empty and sudden without a prominent drum fill or transitional riser.
- problem: 00:34 - 00:36: The sustained note on 'いいひ' has slight robotic formant stretching and unnatural vibrato decay.
- idea: Add a short tom fill or cymbal swell right before the chorus (around 00:18) to provide better momentum.
- idea: Apply a gentle de-esser and reduce synthetic pitch correction on long vocal tails to keep sustained notes sounding organic.

## ballad-night~base
- heard: （歌詞なし・ハミングのみ）
- voice: octave shift -12, 21.6s · timings {"song":6.2,"split":5.6,"voice":24.4} · 8 line times
- problem: 0:19-0:40: 指定された歌詞（よるのまちに〜）が一切歌われず、ヴォカリーズ（アー、ウーなどのスキャット／コーラス）のみになっている
- problem: 0:00-0:46: イントロが長く、歌詞のないハミングのまま曲が終わってしまう
- idea: イントロの指定を短く設定し、冒頭5〜10秒程度から明確に歌い出しが始まるようにプロンプトや構成を修正する
- idea: ボーカルスタイルに『clear lead vocal singing Japanese lyrics』などの指定を強め、歌詞未生成（インスト化・コーラス化）を防ぐ

## ballad-night~lm
- heard: よるのまちに ほしがおちて とおいきおく そっとひらく なまえをよんだ こえがふるえて まだきみをさがしてる あいたいよ いまでもずっと ことばにできない
- voice: octave shift -12, 14.3s · timings {"song":18.5,"split":5.8,"voice":14.5} · 8 line times
- problem: 00:13-00:20: Vocal delivery on 'なまえをよんだ こえがふるえて' is choppy and robotically separated syllable-by-syllable rather than singing smoothly legato.
- problem: 00:30-00:36: Vocal tone becomes strained, metallic, and heavily auto-tuned upon reaching higher notes in the chorus.
- problem: 00:41-00:46: The song abruptly cuts off mid-chorus ('ことばにできない' trailing off into early fade-out), missing the rest of the lyric section.
- idea: Extend track generation length to allow the chorus to complete naturally without clipping the phrase.
- idea: Prompt for 'legato vocal delivery, natural breath, emotive human tone' to eliminate robotic and disjointed phrasing.
- idea: Keep the arrangement focused on acoustic grand piano and orchestral strings rather than sudden synth bass patches in the chorus.

## rock-run~base
- heard: （歌詞なし・掛け声のみ）
- voice: no voice sent · timings {"song":6.7,"split":5.4,"voice":0} · 8 line times
- problem: 00:00-00:46: 指定された歌詞（「はしれ はしれ…」など）が一切歌われておらず、ほぼインストゥルメンタル音源になってしまっています。
- problem: 00:06: 単発の掛け声（シャウト）が入るのみで、リードボーカルのメロディが存在しません。
- problem: 00:44-00:46: 曲の展開が未完のまま不自然に途切れて終了しています。
- idea: プロンプトでインスト生成扱いされないよう、歌詞タグ（[Verse], [Chorus]）とスタイル指示に「lead vocal, melodic singing」を明確に紐づけて再生成する。
- idea: イントロの小節数が長くなりすぎてボーカルが入る前に曲が終わってしまっているため、イントロの長さを指定するか構成を短縮する。

## rock-run~lm
- heard: はしれはしれ かぜをきって まけないこころ もやしてゆけ たおれたって なんどでも たちあがるんだ いまださけべ ぼくらのうた やみをきりさく ひかりになれ とどけとどけ そらのかなた ゆめはおわらない
- voice: no voice sent · timings {"song":17.8,"split":5.4,"voice":0} · 8 line times
- problem: 00:00 - The vocals enter immediately on beat one without an instrumental intro.
- problem: 00:41-00:45 - The outro instrumental loses a bit of momentum and cuts off without a definitive final chord crash.
- idea: Add [intro] tag with a 2 to 4 bar guitar riff before the verse to allow the listener to catch the groove.
- idea: Specify a definitive ending chord or drum hit at the end (e.g. [outro: hard finish on power chord]).

## hiphop-chill~base
- heard: このまちがすきなんだ ゆっくりいこうぜ あせらずに ぼくらのペースで ステップふんで きょうもいいかんじ まちのリズム
- voice: octave shift 0, 14.0s · timings {"song":6.6,"split":5.4,"voice":14.3} · 8 line times
- problem: 00:00-00:21 The instrumental intro and ad-libs are too long, causing the model to skip the first three lines of the verse ('ゆうがたのこうえん...', 'ポケットのなかには...', 'ともだちとわらう...').
- problem: 00:41-00:43 The chorus lyric 'ほらきこえる' is completely omitted.
- problem: 00:44-00:45 The track ends abruptly mid-vocal and cuts the reverb tail.
- idea: Shorten the intro to 4 bars to give adequate time for the full verse lyrics to be sung.
- idea: Use negative prompts or tighter line constraints to prevent skipping entire lyric sections.
- idea: Extend generation length to allow a natural decay and outro.

## hiphop-chill~lm
- heard: ともだちとわらう いつものばしょ このまちがすきだぜ ぼくらのぺいぺいすで ステップふんで きょうもいいかんじ まちのリズム
- voice: octave shift -12, 14.0s · timings {"song":18.3,"split":5.4,"voice":14.3} · 8 line times
- problem: 00:10-00:15: The singer sings scat syllables ('ララパ...') instead of the first two lines of the verse ('ゆうがたのこうえん...', 'ポケットのなかには...'), completely omitting them.
- problem: 00:23: The chorus line 'ゆっくりいこうぜ あせらずに' is skipped, jumping straight to 'ぼくらのペースで'.
- problem: 00:24: Glitch and stutter on 'ペース' sounding like 'ぺい、ぺいすで'.
- problem: 00:21: Sung text deviates from lyrics ('このまちがすきなんだ' becomes 'このまちがすきだぜ').
- idea: Ensure prompts include structured verse/chorus markers with explicit line counts to prevent skipping opening lines.
- idea: Re-generate or inpaint 00:23-00:26 to eliminate the vocal stutter on 'ペース'.
- idea: Prompt for clearer enunciation and check syllable-to-beat alignment in hip-hop tempo.

## edm-party~base
- heard: ねおんのなか こころのおと ぼりゅーむあげて みんなでいっしょに てをあげて いまはじまるよ おどれ おどれ よるがあけるまで ひかりのなかで とびはねよう ぼくらはいま むてきなんだ ばてぃきは ぱーてぃーはから
- voice: no voice sent · timings {"song":6.9,"split":5.4,"voice":0} · 8 line times
- problem: 00:02 - 'ステップふんで' is completely missing/skipped between 'ねおんのなか' and 'こころのおと'.
- problem: 00:30-00:35 - 'むてきなんだ パーティーはこれから' becomes rushed, repetitive, and garbled ('てきなんだ ばてぃきは ぱーてぃーはから').
- problem: 00:36-00:45 - The entire track abruptly cuts out into complete dead silence for the remaining 9 seconds.
- idea: Extend the generation length or adjust prompt structure so the drop and chorus finish cleanly without hitting an abrupt stop.
- idea: Format lyrics with explicit syllable pacing and line breaks so the AI does not skip lines like 'ステップふんで'.
- idea: Increase vocal reverb and sidechain compression against the kick to better integrate the vocal into the EDM drop.

## edm-party~lm
- heard: ねおんのなか すてっぷふんで こころのおと ぼりゅーむあげて みんなでいっしょに てをあげて いまはじまるよ おどれ おどれ よるがあけるまで ひかりのなかで とびはねよう ぼくらはいま むてきなんだ ぱーてぃーはこれから
- voice: no voice sent · timings {"song":18.6,"split":5.6,"voice":0} · 8 line times
- problem: 00:15 - 00:16: ビルドアップからドロップへの移行部分の迫力（インパクト）がやや控えめで、キックの低域が軽めです。
- problem: 00:39 - 00:45: ボーカル終了後のアウトロの展開がやや唐突にフェードアウト・終了します。
- idea: ドロップ（サビ）入りのタイミングでライザーやホワイトノイズ、サブベースのアタックを強調してEDMらしい落差と音圧を補強する
- idea: ボーカルに厚みを持たせるため、サビで左右にダブリングやコーラスレイヤーを重ねる

## kids-march~base
- heard: もりのみちを いっしょにあるこう どんぐりひろて ららららら たのしいね ててて みんなうたえば もっとたのしい もっとたのしい ららららら またあした
- voice: octave shift -12, 13.7s · timings {"song":7.1,"split":5.5,"voice":14} · 6 line times
- problem: 00:08 The opening lines ('くまさん うさぎさん おはようさん') are completely skipped.
- problem: 00:13 'ポケットいっぱい' is dropped immediately after 'どんぐりひろって'.
- problem: 00:08-00:35 The singing voice is extremely robotic, flat, and vocoder-like, lacking human expression and warmth suited for a kids song.
- problem: 00:20-00:22 Mumbled, nonsensical filler syllables occur between phrases.
- problem: Arrangement lacks the requested acoustic ukulele, glockenspiel, and playful marching band feel, sounding like a minimal electronic loop.
- idea: Prompt for 'acoustic kids choir' or 'bright female nursery singer' to avoid synthetic/robotic vocal generation.
- idea: Include explicit tags for marching snare, brass accents, acoustic ukulele strumming, and bright glockenspiel to hit the requested playful march style.
- idea: Structure lyrics with strict measure/meter tags or line breaks so the AI model does not omit lines.

## kids-march~lm
- heard: うさぎさん おはようさん もりのみちを いっしょにあるこう どんぐりひろって ポケットいっぱい ララララ たのしいね みんなでうたえば もっとたのしい ララララ またあした あー
- voice: octave shift -12, 13.7s · timings {"song":17.4,"split":5.5,"voice":14} · 6 line times
- problem: 00:08: The first word 'くまさん' is completely omitted; the vocal starts abruptly from 'うさぎさん'.
- problem: 00:36-00:40: The final note stretches into an awkward, robotic sustained vowel ('あー') before cutting out.
- problem: The vocal tone has a noticeably synthetic, tuned quality lacking the warmth expected in an expressive children's song.
- idea: Add an extra bar of intro padding or clarify prompt syllable spacing so the singer does not miss the first lyric ('くまさん').
- idea: Specify an explicit outro tag such as [outro] or [end] to prevent trailing, unnatural vocal sustain at the end.
- idea: Prompt for 'warm acoustic female vocal' or 'natural cheerful human voice' to reduce synthetic timbre.

## pop-bright+2ban
- heard: （うたなし・インストゥルメンタルのみ）
- voice: no voice sent · timings {"song":7.8,"split":5.5,"voice":0} · 16 line times
- problem: 00:00-00:43: The generation completely failed to produce vocals; only an instrumental backing track was generated.
- problem: 00:35-00:43: The track winds down into silence before completing the intended structure or delivering any lyrics.
- idea: Ensure the generation mode is not set to 'Instrumental' and prompt tags explicitly force vocal generation.
- idea: Check API / model parameters to ensure lyrics input is properly ingested into the generation pipeline.

## ballad-night+oosabi
- heard: あー おー （かしなし）
- voice: octave shift -12, 14.1s · timings {"song":7.9,"split":5.4,"voice":14.3} · 14 line times
- problem: 00:16-00:45: 指定された歌詞（よるのまちに...）が全く歌われておらず、ハミングや母音のコーラスのみになっている
- problem: 00:34-00:37: 「two, three...」のような不自然な囁き声のカウント音とノイズが混入している
- problem: 00:45: 楽曲構成としての本編（バース・サビ）が始まらないまま終わっている
- idea: 歌詞を歌わせるためにプロンプトに「clear japanese female lead vocals singing lyrics」を明記し、vocaliseやhummingをネガティブプロンプトに入れる
- idea: スタジオ音声や囁き声の混入を防ぐため、ネガティブプロンプトに「whispering, spoken words, counting, background speech」を追加する
- idea: イントロが長くなりすぎないよう、[Intro]の長さを指定するか、開始直後から歌い出しの指示を与える
