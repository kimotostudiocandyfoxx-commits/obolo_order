# Studio lab — r01-baseline

今の本番と同じ作り方（ACE-Step turbo 8 steps, shift 3, LM なし）。6曲中3曲は声を Seed-VC で変える。

recipe: {} / vocal words: (app default)

**average**: overall 4 · vocalNaturalness 4.1 · pitch 5.7 · diction 4.4 · melody 4.9 · arrangement 4.7 · mix 5.3 · genreFit 4.4 · artifacts 5.1

| case | overall | voice | pitch | diction | melody | arr. | mix | genre | artif. | LUFS | peak | silence | voiced | time |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pop-bright | 2.5 | 3 | 5 | 3.5 | 4 | 2 | 4.5 | 3 | 2.5 | NaN | NaN | 0s | no | 38s |
| ballad-night | 5 | 4.5 | 6.5 | 5 | 6.5 | 5.5 | 5.5 | 4 | 5.5 | NaN | NaN | 0s | yes | 59s |
| rock-run | 3 | 3 | 4 | 1 | 3 | 7 | 6 | 7 | 5 | NaN | NaN | 0s | no | 20s |
| hiphop-chill | 5 | 5 | 6 | 4 | 5.5 | 6 | 5.5 | 6.5 | 6.5 | NaN | NaN | 0s | yes | 42s |
| edm-party | 4 | 5 | 7 | 6 | 5.5 | 3 | 5 | 2.5 | 6 | NaN | NaN | 0s | no | 21s |
| kids-march | 4.5 | 4 | 5.5 | 7 | 5 | 4.5 | 5 | 3.5 | 5 | NaN | NaN | 0s | yes | 33s |

## pop-bright
- heard: あさのひかり まどをあけて あさのひかり まどをあけて
- voice: no voice sent · timings {"song":15.2,"split":12.4,"voice":0} · 8 line times
- problem: 00:17 - Vocals enter despite the prompt requesting 'no vocals'.
- problem: 00:17-00:33 - The singer only repeats the first phrase ('あさのひかり まどをあけて') twice and misses the rest of the verse and chorus.
- problem: 00:35-01:00 - The track completely cuts out into dead silence for the remaining 25 seconds.
- idea: Remove vocal tokens completely if an instrumental is desired, or prompt properly for a full verse/chorus vocal performance.
- idea: Extend generation continuity and prevent premature track termination/silence before the 1-minute mark.

## ballad-night
- heard: よるのまちにほしがおちて とおいきおく そっとひらく なまえをよんで まだきみをさがしてる あいたいよ いまでもずっと ことばにできないおもい このたびをとどけて きみが きみがいたなつのひ
- voice: octave shift -12, 28.8s · timings {"song":4,"split":7.6,"voice":31.5} · 8 line times
- problem: 00:00-00:14 The prompt requested an 'instrumental' with 'no vocals', but male AI vocals are present throughout the track.
- problem: 00:26-00:30 Lyrics mismatch: 'こえがふるえて' was skipped, and 'なまえをよんだ' was sung as 'なまえをよんで'.
- problem: 00:48-00:54 Lyrics mismatch/hallucination: Sang 'このたびをとどけて' instead of 'このうたにのせて とどけたい'.
- problem: 00:14-01:03 Vocals sound distinctly synthetic and rigid with noticeable phasey/metallic processing.
- problem: 01:04-01:15 Long empty tail with sparse piano trailing into silence.
- idea: If an instrumental track is required, remove lyrics from the generation input and toggle the instrumental switch / negative prompt for vocals.
- idea: Ensure phrase segmentation in the lyrics prompt to prevent dropping lines like 'こえがふるえて'.
- idea: Add more organic vibrato and acoustic reverb to reduce the robotic timbre of the AI vocal.

## rock-run
- heard: （かしなし / かけごえのみ）
- voice: no voice sent · timings {"song":3.3,"split":6.6,"voice":0} · 8 line times
- problem: 00:00-01:00: 指定された歌詞（はしれ はしれ... 等）が一切歌われておらず、インスト主体のトラックになっている
- problem: 00:24-00:30: 歌詞のない不自然なフェイク・掛け声（Yeah, Oh）のみが挿入されている
- problem: 00:48-00:54: メロディや歌詞のない断片的なAIボーカルのハルシネーションが発生している
- idea: プロンプト内に『no vocals』と歌詞が同居して指示が矛盾しているため、『no vocals』を削除して『powerful energetic male vocal』または『female vocal』を明記する
- idea: 歌詞ブロック（[verse]、[chorus]）が正しく認識されるようプロンプトの構成を整理して再生成する

## hiphop-chill
- heard: いぇー いぇー ゆうがたのこうえん いこゆれる ぽけっと まちが すきなんだ ゆっくりいこうぜ あせらずに ぼくらのぺーすで すてっぷふんで きょうもいいかんじ まちきこえる うー
- voice: octave shift 0, 18.1s · timings {"song":3.3,"split":6.6,"voice":18.4} · 8 line times
- problem: 00:25: 「ブランコゆれる」が「いこゆれる」と発音され歌詞が脱落している
- problem: 00:27-00:30: 「あめがふたつ」「ともだちとわらう いつものばしょ」のフレーズが完全にスキップされている
- problem: 00:49-00:54: 「ほらきこえる まちのリズム」が「まちきこえる」と縮まり、最後はハミングでごまかされている
- problem: 00:00-00:22: 1分の尺に対してイントロが22秒と長すぎる
- problem: ボーカルがドライでオケの上に浮いており、リバーブや空間処理の馴染みが甘い
- idea: プロンプト内に「no vocals」と歌詞が同時に存在しているため、インスト指定を削除しチル系ボーカル（chill laid-back male vocalsなど）を明記する
- idea: 歌詞の脱落を防ぐため、1行あたりの音節数をメロディの小節に合わせて調整し再生成する
- idea: イントロを8小節程度（約10秒）に収まるようプロンプトや構成タグを調整する

## edm-party
- heard: みんな みんな みんな みんなでいっしょにてをあげて おどれ おどれ よるがあけるまで ひかりのなかで とびはねよう ぼくらはいま むてきなんだ はーー
- voice: no voice sent · timings {"song":3.3,"split":6.6,"voice":0} · 8 line times
- problem: 0:00 - 0:09: Weird vocal stutter loop at the start instead of an instrumental intro.
- problem: Lyrical mismatch: completely skips the first two lines of the verse ('ネオンのなか...' and 'こころのおと...') as well as the final chorus line ('パーティーはこれから').
- problem: 0:49: The drop completely falls flat; instead of an energetic 128 BPM four-on-the-floor EDM drop with bright synth leads, it slows into a sparse, half-time beat with almost no lead melody.
- problem: Prompt conflict: vocals are present despite 'no vocals' in the requested genre tags.
- idea: If an instrumental track is desired, remove lyrics completely and specify instrumental in both positive tags and negative prompt.
- idea: Strengthen genre tags with specific EDM subgenres (e.g., 'festival EDM', 'progressive house drop', 'driving 128 bpm 4-on-the-floor kick') to avoid sluggish half-time drops.
- idea: Format lyrics strictly with structure tags [Intro], [Verse], [Pre-Chorus], [Chorus] to prevent the AI from skipping sections.

## kids-march
- heard: くまさん うさぎさん おはようさん もりのみちを いっしょにあるこう どんぐりひろって ポケットいっぱい らららら たのしいね みんなでうたえば もっとたのしい らららら またあした
- voice: octave shift -12, 13.5s · timings {"song":2.9,"split":5.1,"voice":13.8} · 6 line times
- problem: 00:00-00:08 冒頭の手拍子のみのイントロが長く、コード感やメロディ楽器が入ってこないため寂しい印象です。
- problem: 00:09-00:36 プロンプトに「no vocals / instrumental」が指定されているにもかかわらずボーカルが生成されています。
- problem: 00:09-00:23 ボーカルのトーンが子供向けにしては低く平坦で、AI特有のフォルマントの不自然さ・機械的な質感があります。
- problem: 00:37-00:39 曲の末尾で意図しない「てびょうし」という不自然な話し声・ノイズが混入しています。
- idea: インストゥルメンタルを厳密に出力したい場合は、歌詞欄を空欄にするかInstrumentalトグルを有効にしてください。
- idea: 子供向け楽曲として歌唱を入れる場合は、明るい女性ボーカル（female vocal, upbeat, bright tone）を指定してピッチ感と活気を向上させてください。
- idea: ウクレレやグロッケンシュピールなどのアコースティック楽器の音圧と華やかさを強調するプロンプト調整を行ってください。
