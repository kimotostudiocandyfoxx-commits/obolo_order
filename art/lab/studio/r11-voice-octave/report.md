# Studio lab — r11-voice-octave

- **lift0** {"tune":{"voicePrep":"clean","voiceLift":0}}: overall 5 · vocalNaturalness 5 · pitch 6 · diction 6 · melody 6 · arrangement 6 · mix 6 · genreFit 6 · artifacts 5
- **lift4** {"tune":{"voicePrep":"clean","voiceLift":4}}: overall 5 · vocalNaturalness 5 · pitch 6 · diction 6 · melody 6 · arrangement 5 · mix 6 · genreFit 5 · artifacts 5
- **lift6** {"tune":{"voicePrep":"clean","voiceLift":6}}: overall 5 · vocalNaturalness 6 · pitch 6 · diction 6 · melody 6 · arrangement 5 · mix 6 · genreFit 7 · artifacts 4

r10 で毎回「1オクターブ下げ」が起きていた（話し声は歌声より低いのに同じに比べていた）。オクターブ判定に話し声→歌声の差を足す：lift 0（今まで）/ 4 / 6 半音。どれが自然で似るか。下ごしらえは clean。

recipe: {"outro":true} / vocal words: (app default)

**average**: overall 5 · vocalNaturalness 5.3 · pitch 6 · diction 6 · melody 6 · arrangement 5.3 · mix 6 · genreFit 6 · artifacts 4.7

| case | overall | voice | pitch | diction | melody | arr. | mix | genre | artif. | LUFS | peak | silence | voiced | time |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| voice-pop~lift0 | 5 | 5 | 6 | 6 | 6 | 6 | 6 | 6 | 5 | -13.4 | 0 | 0s | yes | 150s |
| voice-pop~lift4 | 5 | 5 | 6 | 6 | 6 | 5 | 6 | 5 | 5 | -13 | -1.4 | 0s | yes | 68s |
| voice-pop~lift6 | 5 | 6 | 6 | 6 | 6 | 5 | 6 | 7 | 4 | -14.4 | -1.3 | 0s | yes | 67s |

## voice-pop~lift0
- heard: あさのひかりがまどをたたくまだねむいめをこすりながらきみのこえがきこえたきがしてぼくはちいさくわらってみたはしりだそうすいせいのそらへちいさなゆめをぽけっとに
- voice: octave shift 0, 16.5s, likeness 0.689 (studio voice 0.224) · timings {"song":119.1,"split":0,"voice":19.4} · 8 line times · takes heard 0.558 / 0.6
- problem: 00:10-00:28: Vocals exhibit noticeable synthetic tuning and unnatural phrasing
- problem: 00:37: Lyrics cut off mid-chorus before finishing the written stanza
- problem: 00:38-00:44: Abrupt drop to instrumental without lyrical resolution
- idea: Increase generation length or adjust pacing to avoid cutting off chorus lyrics
- idea: Adjust vocal tags to reduce robotic synthetic timbre and improve legato phrasing

## voice-pop~lift4
- heard: あさのひかりがまどをたたく まだねむいめをこすりながら きみのこえがきこえたきがして ぼくはちいさくわらってみた はしりだそうすいせいのそらへ ちいさなゆめをぽけっとにつめて あしたはきっとはれるから
- voice: octave shift 0, 13.6s, likeness 0.667 (studio voice 0.225) · timings {"song":41.6,"split":0,"voice":14.2} · 8 line times · takes heard 0.765 / 0.551
- problem: 00:38 Missing lyrics line 'きみと歌えば こわくないよ'
- problem: 00:43 Song abruptly cuts off before finishing
- problem: 00:09 Vocal timbre exhibits synthetic digital artifacts
- idea: Prompt more heavily for acoustic instrumentation over electronic synths
- idea: Extend generation length to prevent ending cutoff
- idea: Adjust vocal prompt descriptors to reduce robotic tuning

## voice-pop~lift6
- heard: あさのひかりが まどをたたく まだねむいめを こすりながら きみのこえが きこえたきがして ぼくはちいさく わらってみた はしりだそう すいせいのそらへ ちいさなゆめを ぽけっとに はれてゆくから
- voice: octave shift 0, 13.6s, likeness 0.714 (studio voice 0.201) · timings {"song":41.6,"split":0,"voice":14.2} · 8 line times · takes heard 0.444 / 0.662
- problem: 00:37 Chorus skips lyrics (きみと歌えば こわくないよ 明日はきっと) and jumps ahead.
- problem: 00:41 Vocal and music cut off abruptly into premature silence.
- idea: Increase generation duration limit to allow the chorus to complete.
- idea: Specify explicit outro tags to avoid abrupt audio truncation.
