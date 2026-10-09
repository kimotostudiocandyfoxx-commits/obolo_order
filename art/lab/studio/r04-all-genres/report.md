# Studio lab — r04-all-genres

- **(one recipe)** {"tune":{}}: overall 6.9 · vocalNaturalness 6.9 · pitch 7.9 · diction 7.9 · melody 7.6 · arrangement 7.1 · mix 7.6 · genreFit 8.3 · artifacts 7.1

本番の新しい標準（LM あり・45秒・声域合わせの判定を修正）で、8つの曲調がどれも安定して良いかを確認する。

recipe: {} / vocal words: (app default)

**average**: overall 6.9 · vocalNaturalness 6.9 · pitch 7.9 · diction 7.9 · melody 7.6 · arrangement 7.1 · mix 7.6 · genreFit 8.3 · artifacts 7.1

| case | overall | voice | pitch | diction | melody | arr. | mix | genre | artif. | LUFS | peak | silence | voiced | time |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pop-bright | 8.2 | 8 | 8.5 | 9 | 8.5 | 7.5 | 8 | 9 | 8.5 | -13.8 | -1.1 | 0s | no | 101s |
| ballad-night | 7.2 | 7.8 | 8.5 | 8.7 | 8 | 7.8 | 8 | 8.5 | 6.5 | -12.5 | 3 | 0s | yes | 64s |
| rock-run | 8 | 7.5 | 8.5 | 8 | 8.5 | 8 | 8 | 9 | 7.5 | -13 | -0.9 | 0s | no | 29s |
| hiphop-chill | 5 | 5.5 | 7 | 4.5 | 6 | 6.8 | 7 | 8 | 5 | -13.1 | -0.9 | 2.7s | yes | 47s |
| edm-party | 8.5 | 8 | 8.5 | 8 | 8.5 | 9 | 8.5 | 9.5 | 8.5 | -12.9 | -1.1 | 5.1s | no | 30s |
| kids-march | 5.8 | 6.5 | 7.5 | 8.5 | 6.5 | 4.5 | 6 | 6.5 | 6.5 | -12.5 | -0.4 | 0s | yes | 46s |
| citypop-drive | 7.8 | 6.5 | 8.5 | 9 | 8 | 8 | 8 | 7.5 | 8 | -14.5 | -1 | 0s | no | 30s |
| folk-letter | 5 | 5.5 | 6.5 | 7.5 | 6.5 | 5 | 7 | 8 | 6 | -14 | -1.1 | 0s | yes | 48s |

## pop-bright
- heard: あさのひかり まどをあけて きのうのなみだ かぜにとばそう ちいさなゆめ ぽけっとにいれて きょうもあるきだす きみとなら どこまでも そらはいつもあおいから わらってうたおう いまここで あしたもきっといいひ
- voice: no voice sent · timings {"song":78.9,"split":12.9,"voice":0} · 8 line times
- problem: 0:00 - Vocals start almost immediately on beat 1 with no instrumental intro.
- problem: 0:34-0:45 - The outro instrumental repeats and cuts off abruptly without a defined cadence or resolving chord.
- idea: Insert a 2-to-4-bar instrumental intro before verse vocals begin to give the song breathing room.
- idea: Specify an ending tag or clean final chord cadence so the song resolves naturally rather than cutting off.

## ballad-night
- heard: よるのまちに ほしがおちて とおいきおく そっとひらく なまえをよんだ こえがふるえて まだきみをさがしてる あいたいよ いまでもずっと ことばにできないおもい このうたにのせて とどけたい きみがいた
- voice: octave shift 0, 26.1s · timings {"song":16.7,"split":6.2,"voice":29.2} · 8 line times
- problem: 00:49 - Audio cuts off abruptly mid-sentence, leaving the last phrase 'なつのひ' (natsu no hi) unperformed.
- problem: 00:28 - Beat element introduced in the chorus feels slightly mechanical compared to the expressive grand piano opening.
- idea: Increase generation length to prevent premature cutoff and allow the final line 'きみがいたなつのひ' and piano tail to ring out naturally.
- idea: Use acoustic drum/percussion tags or softer orchestral timpani/cymbals rather than modern loop beats to keep the intimate ballad aesthetic cohesive.

## rock-run
- heard: はしれはしれかぜをきってまけないこころもやしてゆけたおれたってなんどでもたちあがるんだいまださけべぼくらのうたやみをきりさくひかりになれとどけとどけそらのかなたゆめはおわらない
- voice: no voice sent · timings {"song":15.1,"split":5.6,"voice":0} · 8 line times
- problem: 00:00 - The track starts abruptly with the vocal, cutting off the onset of the first syllable 'は'.
- problem: 00:36 - In 'ゆめはおわらない', the 'ら' consonant is swallowed/unclear, sounding like 'ゆめはおわーない'.
- problem: 00:40 - The arrangement cuts off right after the chorus vocal line without a concluding band outro or resolve.
- idea: Add an instrumental intro tag (e.g. [intro: guitar riff, 2 bars]) to avoid clipping the start of the first vocal line.
- idea: Insert an [outro] tag with instrumental chords or a drum hit to provide a definitive ending rather than a sudden stop.
- idea: Adjust phonetic spelling or prompt phrasing around 'おわらない' to preserve clear consonant pronunciation on sustained notes.

## hiphop-chill
- heard: ゆーがた...ぽけっと...ともだちとわらう いつものばしょ このまちがすきなんだ ゆっくりいこうぜ ステップふんで きょうもいいかんじ ほらきこえる
- voice: octave shift 0, 14.0s · timings {"song":15.8,"split":5.5,"voice":14.2} · 8 line times
- problem: 00:00-00:09: The first two lines of the verse ('ゆうがたのこうえん...', 'ポケットのなかには...') are heavily chopped and stuttered like an unnatural vocal sample instead of being sung smoothly.
- problem: 00:21-00:25: Portions of the chorus lyrics ('あせらずに ぼくらのペースで') are skipped completely.
- problem: 00:30-00:45: The final line of the chorus ('まちのリズム') is omitted, dropping into an extended instrumental/chopped outro.
- idea: Remove vocal chopping cues or lo-fi sample phrasing from the prompt to ensure the model sings complete phrases cleanly.
- idea: Adjust pacing and structure tags so the model has enough time to sing all lyrics without skipping lines in the chorus.
- idea: Explicitly prompt for 'clear complete lyrical performance without stutter/chopping artifacts'.

## edm-party
- heard: ねおんのなか すてっぷふんで こころのおと ぼりゅーむあげて みんなでいっしょに てをあげて いまはじまるよ おどれ おどれ おどれ よるがあけるまで ひかりのなかで とびはねよう ぼくらは むてきなんだ ぱーてぃーはこれから
- voice: no voice sent · timings {"song":15.6,"split":5.4,"voice":0} · 8 line times
- problem: 0:25 - 「ぼくらはいま」の「いま」が脱落し、「ぼくらはー むてきなんだ」と歌われています。
- idea: 歌詞の脱落を防ぐため、プロンプトで『ぼ・く・ら・は・い・ま』とモーラ（拍）を明示するか、生成時の歌詞割り（音節指定）を明確にする。
- idea: アウトロ（0:31〜のドロップ）がインストのみになっているため、掛け声（Hey! や Jump! など）のボーカルチョップを追加するとさらにキッズ向けとして盛り上がります。

## kids-march
- heard: くまさん うさぎさん おはようさん もりのみちを いっしょにあるこう どんぐりひろって ポケットいっぱい ララララ たのしいね みんなでうたえば もっとたのしい ララララ またあした
- voice: octave shift 0, 13.7s · timings {"song":15.3,"split":5.3,"voice":13.9} · 6 line times
- problem: 00:00 - 00:13: The verse instrumentation is extremely sparse (almost acappella with minimal percussion), missing the intended cheerful ukulele and glockenspiel march feel.
- problem: 00:27 - 00:43: The vocals conclude early at 00:27, leaving over 15 seconds of repetitive, empty percussion and claps with no musical resolution.
- problem: Vocal delivery has noticeable pitch-correction/synthetic stiffness.
- idea: Introduce the full playful instrumental backing (ukulele strumming, glockenspiel) right from the start rather than delaying it until the chorus.
- idea: Structure the track to finish cleanly after the final lyric, or add an instrumental melodic hook/playout to keep children engaged through the outro.
- idea: Add more dynamic variation and organic acoustic elements to make the march feel lively rather than drum-machine-driven.

## citypop-drive
- heard: よるのハイウェイライトがながれるラジオからきこえるなつかしいうたまどをあけたらかぜがわらうどこまでもいこうきらめくまちをぬけだしてふたりだけのドライブほしぞらのしたうたいながらゆめのつづきへ
- voice: no voice sent · timings {"song":16.2,"split":5.6,"voice":0} · 8 line times
- problem: 00:09-00:45: The vocal timbre sounds more like a modern kawaii idol or Vocaloid than an authentic 80s city pop singer.
- problem: 00:25-00:27: Slight metallic autotune buzz on the sustained high note ('いこう').
- problem: 00:45: Song ends abruptly right after the final vocal line without an instrumental outro fade.
- idea: Add prompt keywords like 'warm vintage female vocals', 'retro adult contemporary pop', or 'smooth 1980s Japanese singer' to avoid excessively sweet idol/anime timbre.
- idea: Extend track generation length or add an '[outro] groovy slap bass solo, fade out' section tag for a natural city pop ending.

## folk-letter
- heard: ふるさとのえきにおりたつとかわらないけしきむかえてくれたおかあさんのこえとおくからおかえりときこえたありがとういえなかったことこのうたにこめておくるよ
- voice: octave shift 0, 14.0s · timings {"song":16.5,"split":5.6,"voice":14.3} · 8 line times
- problem: 00:43-00:45: The song cuts off abruptly, leaving the remaining lines of the chorus ('いつまでも げんきでいてね またかえるからね') completely unperformed.
- problem: 00:11-00:32: Vocal has noticeable synthetic formant buzzing and mechanical phrasing.
- problem: 00:33-00:36: Pitch stability wobbles artificially on 'ありがとう'.
- idea: Extend the generation target duration or use continuation/outpainting to ensure the entire chorus and outro are rendered.
- idea: Adjust vocal prompts towards natural folk acoustic singer to reduce robotic artifacts and stiff phrasing.
