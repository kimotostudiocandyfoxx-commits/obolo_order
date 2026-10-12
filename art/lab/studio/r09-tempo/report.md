# Studio lab — r09-tempo

- **base** {"tune":{}}: overall 5.8 · vocalNaturalness 5.8 · pitch 6.1 · diction 5.7 · melody 6 · arrangement 5.6 · mix 5.9 · genreFit 5.9 · artifacts 5.4
- **bpm115** {"tune":{}}: overall 5.8 · vocalNaturalness 5.5 · pitch 6.5 · diction 5.4 · melody 6.3 · arrangement 5.7 · mix 6.2 · genreFit 5.6 · artifacts 5.9
- **x1.1** {"tune":{}}: overall 5.8 · vocalNaturalness 5.9 · pitch 6.2 · diction 5.7 · melody 6 · arrangement 5.4 · mix 6 · genreFit 5.5 · artifacts 6.1
- **x1.2** {"tune":{}}: overall 5.7 · vocalNaturalness 5.7 · pitch 6.5 · diction 6.7 · melody 6.3 · arrangement 5.5 · mix 6 · genreFit 5.1 · artifacts 5.8

テンポ試験（クライアント案 2026-10-12）：同じ曲を ①そのまま ②最初から1.15倍の BPM で作る ③できた曲を1.1倍速 ④1.2倍速（音の高さはそのまま）。どれが一番「良い曲」に聞こえるか。

recipe: {"outro":true} / vocal words: (app default)

**average**: overall 5.8 · vocalNaturalness 5.7 · pitch 6.3 · diction 5.9 · melody 6.1 · arrangement 5.5 · mix 6 · genreFit 5.5 · artifacts 5.8

| case | overall | voice | pitch | diction | melody | arr. | mix | genre | artif. | LUFS | peak | silence | voiced | time |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| busan-kpop~base | 5.6 | 5.5 | 6.2 | 6.4 | 6 | 5.2 | 5.8 | 4.8 | 5.8 | -13.5 | -1.2 | 1.7s | no | 130s |
| busan-kpop~bpm115 | 5.4 | 5.2 | 6.1 | 4.8 | 5.8 | 5.2 | 5.9 | 5.4 | 5.1 | -13.7 | 0.4 | 1.9s | no | 55s |
| busan-kpop~x1.1 | 5.5 | 5.8 | 6.3 | 6.4 | 6 | 4.8 | 5.9 | 5 | 6.2 | -15 | -0.2 | 1.9s | no | 53s |
| busan-kpop~x1.2 | 5.5 | 5.5 | 6.5 | 6.5 | 6 | 5.5 | 6 | 5 | 6 | -13.1 | -0.9 | 0s | no | 54s |
| mercury-pop~base | 6 | 6 | 6 | 5 | 6 | 6 | 6 | 7 | 5 | -12.8 | -1.5 | 0s | no | 49s |
| mercury-pop~bpm115 | 6.2 | 5.8 | 6.8 | 5.9 | 6.7 | 6.2 | 6.4 | 5.8 | 6.6 | -12.9 | -2.1 | 0s | no | 49s |
| mercury-pop~x1.1 | 6 | 6 | 6 | 5 | 6 | 6 | 6 | 6 | 6 | -13 | -1.4 | 0s | no | 49s |
| mercury-pop~x1.2 | 5.8 | 5.8 | 6.4 | 6.8 | 6.5 | 5.4 | 6 | 5.2 | 5.5 | -13.9 | -1.4 | 0s | no | 50s |

## busan-kpop~base
- heard: あさのぷさん まどいっぱいのうみ そんどのすなに あしあとつけて かにがおどる いちばのざわめき かんじゃんけじゃん ひとくちでこいした ちんちゃましっそ とまらない ねおんのなんぽどん よるはこれから ちきんをかたてに わらいあおう ぷさん またあいにくるよ
- voice: no voice sent · timings {"song":121.2,"split":0,"voice":0} · 8 line times · takes heard 0.636 / 0.652
- problem: 0:00-0:30 Vocal style is cute melodic idol singing rather than the requested cool Japanese rap flow.
- problem: 0:31-0:48 Track transitions into an extended instrumental drop and cuts off abruptly without an outro.
- idea: Add rap and spoken-flow descriptors while reducing kawaii/anime vocal style tags.
- idea: Adjust structural prompts to generate a definitive ending instead of trailing off.

## busan-kpop~bpm115
- heard: あさのぷさんまどいっぱいのうみそんどのすなにしーばのざわめきひとくちでこいしたちんちゃましっそとまらないねおんのわこれからちきんをかたてにわらいあおうぷさんまたあいにくるよ
- voice: no voice sent · timings {"song":45.6,"split":0,"voice":0} · 8 line times · takes heard 0.545 / 0.011
- problem: 0:06-0:11 歌詞の一部が脱落し混ざっている
- problem: 0:27-0:48 後半がボーカルチョップの繰り返しになり末尾が無音で終わる
- idea: テンポ設定を少し抑えて歌詞の詰め込みと滑舌崩れを防ぐ
- idea: セクション構成プロンプトを整理してアウトロまで展開を持たせる

## busan-kpop~x1.1
- heard: あさのぷさん まどいっぱいのうみ そんどのすなに あしあとつけて かにがおどる いちばのざわめき かんじゃんけじゃん ひとくちでこいした ちんちゃましっそ とまらない ねおんのなんぽど よるはこれから ちきんをかたてに わらいあおう ぷさん またあいにくるよ
- voice: no voice sent · timings {"song":44.2,"split":0,"voice":0} · 8 line times · takes heard 0.56 / 0.373
- problem: 0:28 - Vocals cut off completely, leaving a repetitive instrumental loop to the end.
- problem: 0:00 - Style is upbeat cute idol-pop singing rather than the requested K-pop rap flow.
- idea: Prompt explicitly for rap cadence, cadence timing, and rhythmic delivery.
- idea: Balance section durations to avoid dead instrumental sections after verse/chorus.

## busan-kpop~x1.2
- heard: あさのぷさん まどいっぱいのうみ そんどのすなに あしあとつけて かにがおどる いちばのざわめき かんじゃんけじゃん ひとくちでこいした ちんちゃましっそ とまらない ねおんのなんぽど よるはこれから ちきんをかたてに わらいあおう ぷさん またあいにくるよ
- voice: no voice sent · timings {"song":44.6,"split":0,"voice":0} · 8 line times · takes heard 0.624 / 0.6
- problem: 0:10 カンジャンケジャン付近の滑舌が早口でやや不明瞭
- problem: 0:26 後半がボーカルなしのシンセドロップのみで展開が偏っている
- idea: ラップスタイルを指示してBPMを抑えリズムのメリハリをつける
- idea: コーラスのボーカルパートを後半まで配置する構成にする

## mercury-pop~base
- heard: あさのひかりが まどをたたく まだねむいめを こすりながら きみのこえが きこえたきがして ぼくはちいさく わらってみた はしりだそう ぽけっとにつまえ ちいさな きっとはれるよ
- voice: no voice sent · timings {"song":40.8,"split":0,"voice":0} · 8 line times · takes heard 0.544 / 0.563
- problem: 00:31-00:44: Chorus lyrics diverge significantly from the prompt, skipping lines and altering order.
- problem: 00:35-00:38: Vocal phrasing becomes slurred and garbled around the pocket line.
- idea: Adjust section tags and syllabic spacing to prevent lyric skipping in the chorus.
- idea: Regenerate with a new seed to resolve phrasing blur in the transition.

## mercury-pop~bpm115
- heard: あかりが まどをたたく まだねむいめを こすりながら きみのこえが こえがきこえたきがして ぼくはちいさく わらってみた はしりだそう すいせいのそらへ ちいさなゆめを ぽけっとにつめて きみとうたえば こわくないよ あしたはきっと はれるから
- voice: no voice sent · timings {"song":41.3,"split":0,"voice":0} · 8 line times · takes heard 0.531 / 0.47
- problem: 00:09 missed 'あさの' in lyrics
- problem: 00:18 stuttered phrase 'こえが'
- problem: 00:00 synth-pop instrumentation outweighs acoustic elements
- idea: Prompt acoustic guitar and piano more heavily over synth leads
- idea: Adjust phonetic spacing to prevent repeated words

## mercury-pop~x1.1
- heard: あさのひかりがまどをたたく まだねむいめをこすりながら こえがきこえたきがして ぼくはちいさくわらってみた はしりだそうみせのそらへ ちいさなゆめをぽけっとにつめて きみとうたえばこわくないよ あしたはきっとはれるから
- voice: no voice sent · timings {"song":41.1,"split":0,"voice":0} · 8 line times · takes heard 0.439 / 0.725
- problem: 00:09 'きみの' is omitted or unclear before '声が'
- problem: 00:20 '水星の空へ' is mispronounced as 'みせのそらへ'
- idea: Provide phonetic hiragana in prompt to prevent misreading kanji
- idea: Reroll segment to ensure all lyrics in the verse are vocalized

## mercury-pop~x1.2
- heard: あさのひかりが まどをたたく まだねむいめを こすりながら きみのこえが きこえたきがして ぼくはちいさく わらってみた はしりだそう すいせいのそらへ ちいさなゆめを ぽけっとにつめて
- voice: no voice sent · timings {"song":41.7,"split":0,"voice":0} · 8 line times · takes heard 0.513 / 0.752
- problem: 0:25 - Synth-pop instrumentation diverges from requested acoustic guitar and piano setup.
- problem: 0:32 - Chorus is abruptly cut short before completing the full lyric set.
- problem: 0:12 - Vocal processing has a slight synthetic, metallic sheen.
- idea: Strengthen acoustic instrumentation prompts and reduce synth tags.
- idea: Adjust pacing or song structure to fit the entire lyrical section within the duration.
- idea: Apply gentle de-essing and EQ to soften artificial vocal top-end.
