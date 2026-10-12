# Studio lab — r10-voice

- **plain** {"tune":{"voicePrep":"plain"}}: overall 5.8 · vocalNaturalness 5.5 · pitch 6.2 · diction 5.8 · melody 6.4 · arrangement 6 · mix 6.1 · genreFit 5.9 · artifacts 5.7
- **clean** {"tune":{"voicePrep":"clean"}}: overall 6.3 · vocalNaturalness 5.8 · pitch 6.8 · diction 6.7 · melody 6.6 · arrangement 6.5 · mix 6.4 · genreFit 6.8 · artifacts 6.2
- **clean-6s** {"tune":{"voicePrep":"clean"}}: overall 5 · vocalNaturalness 5 · pitch 6 · diction 6 · melody 6 · arrangement 5 · mix 6 · genreFit 5 · artifacts 6

声の似方の試験（2026-10-12）：同じ曲・同じ録音で ①今まで通りの下ごしらえ ②新しい下ごしらえ（雑音を減らす・間を詰める・音量をそろえる）③新しい下ごしらえ＋6秒だけの録音。likeness＝話者モデルで測った似ている度（試験用・アプリには出さない）。

recipe: {"outro":true} / vocal words: (app default)

**average**: overall 5.7 · vocalNaturalness 5.4 · pitch 6.3 · diction 6.2 · melody 6.3 · arrangement 5.8 · mix 6.2 · genreFit 5.9 · artifacts 6

| case | overall | voice | pitch | diction | melody | arr. | mix | genre | artif. | LUFS | peak | silence | voiced | time |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| voice-pop~plain | 5.8 | 5.5 | 6.2 | 5.8 | 6.4 | 6 | 6.1 | 5.9 | 5.7 | -13.7 | -1 | 0s | yes | 157s |
| voice-pop~clean | 6.3 | 5.8 | 6.8 | 6.7 | 6.6 | 6.5 | 6.4 | 6.8 | 6.2 | -13 | 1 | 0s | yes | 68s |
| voice-pop~clean-6s | 5 | 5 | 6 | 6 | 6 | 5 | 6 | 5 | 6 | -12.6 | -0.6 | 0s | yes | 66s |

## voice-pop~plain
- heard: あさのひかりが まどを まだねむいめを こすりながら きみのこえが きこえたきがして ぼくはちいさく わらってみた はしりだそう すいせいのそらへ ちいさなゆめを ポケットにつめて きみとうたえば こわくないよ あしたはきっと はれるから
- voice: octave shift -12, 17.7s, likeness 0.615 (studio voice 0.288) · timings {"song":124.6,"split":0,"voice":20.2} · 8 line times · takes heard 0.814 / 0.592
- problem: 00:07 missing phrase たたく
- problem: 00:24 noticeable synthetic tuning timbre
- problem: 00:41 abrupt ending cutoff
- idea: Prompt for more natural vocal acoustics rather than electro-pop tuning
- idea: Ensure rhythmic space in prompt structure to avoid dropped syllables

## voice-pop~clean
- heard: あさのひかりがまどをたたくまだねむいめをこすりながらきみのこえがきこえたきがしてぼくはちいさくわらってみたはしりだそうすいせいのそらへちいさなゆめをぽけっとにつめてきみとうたえばこわくないよあしたはきっとはれるから
- voice: octave shift -12, 12.9s, likeness 0.638 (studio voice 0.19) · timings {"song":42.7,"split":0,"voice":13.5} · 8 line times · takes heard 0.841 / 0.722
- problem: 00:00 - 00:20: Vocal displays noticeable synthetic, formant-quantized processing.
- problem: 00:22 - 00:24: Lyric pronunciation around 'suisei no sora' lacks phonetic clarity.
- problem: 00:38 - 00:44: Abrupt musical fade-out and lingering tail cut.
- idea: Use a more natural acoustic vocal model to reduce synthetic formant artifacts.
- idea: Adjust phoneme emphasis for 'suisei' to ensure accurate lyric delivery.
- idea: Extend the outro with a proper instrumental cadence and natural decay.

## voice-pop~clean-6s
- heard: あさのひかりがまどをたたくまだねむいめをこすりながらきみのこえがきこえたきがしてぼくはちいさくわらってみたはしりだそうすいせいのそらへちいさなゆめをぽけっとにつめてきみとうたえばこわくないよあしたはきっとはれるから
- voice: octave shift -12, 10.5s, likeness 0.588 (studio voice 0.217) · timings {"song":43.2,"split":0,"voice":10.9} · 8 line times · takes heard 0.75 / 0.667
- problem: 00:01-00:20: Vocals sound noticeably robotic and synthetic rather than acoustic and expressive.
- problem: 00:21-00:40: Instrumentation features heavy synth elements rather than organic acoustic guitar and piano.
- idea: Emphasize acoustic instruments and reduce electro-pop keywords in the generation prompt.
- idea: Specify an organic human tone to prevent synthetic voice processing.
