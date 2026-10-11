# Studio lab — r08-busan

- **a** {"tune":{}}: overall 6 · vocalNaturalness 6 · pitch 6 · diction 6 · melody 6 · arrangement 5 · mix 6 · genreFit 7 · artifacts 6
- **b** {"tune":{}}: overall 6 · vocalNaturalness 6 · pitch 6 · diction 6 · melody 6 · arrangement 6 · mix 6 · genreFit 5 · artifacts 5

実験：釜山旅行の写真から作る、ハイテンポでかっこいい K-POP 風の曲（45秒前後・Aメロ＋サビ）。2回作って良い方を MV に使う。

recipe: {"outro":true} / vocal words: (app default)

**average**: overall 6 · vocalNaturalness 6 · pitch 6 · diction 6 · melody 6 · arrangement 5.5 · mix 6 · genreFit 6 · artifacts 5.5

| case | overall | voice | pitch | diction | melody | arr. | mix | genre | artif. | LUFS | peak | silence | voiced | time |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| busan-kpop~a | 6 | 6 | 6 | 6 | 6 | 5 | 6 | 7 | 6 | -16 | -0.8 | 2.4s | no | 129s |
| busan-kpop~b | 6 | 6 | 6 | 6 | 6 | 6 | 6 | 5 | 5 | -12.8 | -1 | 1.6s | no | 53s |

## busan-kpop~a
- heard: あさのぷさん まどいっぱいのうみ そんどのすなに あしあとつけて かみがおどる いちばのざわめき かんじゃんけじゃん ひとくちでこいした ちんちゃましっそ とまらない ねおんのなんぽどん よるはこれから ちきんをかたてに わらいあおう ぷさん またあいにくるよ
- voice: no voice sent · timings {"song":120.1,"split":0,"voice":0} · 8 line times · takes heard 0.25 / 0.716
- problem: 00:08 - 'カニ' sounds slightly like 'カミ'
- problem: 00:20 - Pronunciation of '南浦洞' is rushed and slightly unnatural
- problem: 00:33-00:48 - Track leaves an extended repetitive instrumental drop that ends abruptly without resolution
- idea: Refine phonetic prompting for foreign place names like Nampo-dong to ensure clear syllabic delivery
- idea: Add structure tags for an outro to prevent unresolved trailing beats

## busan-kpop~b
- heard: あさのぷさん まどいっぱいのうみ そんどのすなに あしあとつけて かにがおどる しじょうのざわめき かんじゃんけじゃん ひとくちでこいした ちんちゃましっそ とまらない ねおんのなんぽどん よるはこれから ちきんをかたてに わらいあおう ぷさん またあいにくるよ
- voice: no voice sent · timings {"song":43.8,"split":0,"voice":0} · 8 line times · takes heard 0.432 / 0.599
- problem: 00:12 Diction on fast lines is slightly blurred
- problem: 00:31 Vocal ends early leaving a sparse instrumental section with looping tail
- idea: Prompt for more rhythmic rap cadence rather than melodic singing
- idea: Refine arrangement tags to structure a clear outro section
