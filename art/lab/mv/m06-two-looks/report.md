# MV lab — m06-two-looks

クライアント決定「B」：Aメロ・イントロはわざと絵柄を変えたちびキャラ／クレヨン調（Runware の Animagine、1枚約0.3円）、サビは Seedream 5.0 Pro の本気の決め絵2枚（設定画を見ながら、1枚約7円）を小節ごとのカットに。GPU 起動なし。

painter: styled · scenes ≤ 30 · side 768 · heroRef 0.6 · steps 28 · hero tags: creature, chibi, white mask, blue markings, blue glowing eyes, fox ears, multiple tails, red hooded robe, white and black tails, white paws, blue gem necklace, red, white, blue

**average**: overall 5.9 · heroLikeness 5.8 · heroConsistency 5.3 · pictureQuality 6.4 · storyTelling 5.9 · lyricFit 6.4 · beatSync 6.1 · variety 5.9 · watchability 6 · kidsSafe 7.1

| case | overall | heroLikeness | heroConsistency | pictureQuality | storyTelling | lyricFit | beatSync | variety | watchability | kidsSafe | painted | paint s | yen |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pop-bright | 6 | 7 | 6 | 7 | 6 | 6 | 6 | 5 | 6 | 7 | 7/7 | 113 | 15.4 |
| rock-run | 6 | 5 | 5 | 6 | 6 | 7 | 6 | 6 | 6 | 7 | 10/10 | 112 | 16 |
| ballad-night | 5.8 | 5.4 | 4.8 | 6.2 | 5.8 | 6.1 | 6.4 | 6.7 | 5.9 | 7.2 | 7/7 | 122 | 15.4 |

## pop-bright
- good: 00:05 cozy bedroom scene with soft morning lighting
- good: 00:25 visual transition into the vibrant chorus landscape
- problem: 00:25 chorus shot lingers on static walk visual too long
- problem: 00:41 speed lines overlay feels jarring on still render
- problem: 00:45 repeats previous walking setup without new staging
- idea: Incorporate low-angle and side profile shots during the chorus
- idea: Add environmental motion like falling petals or camera tracking
- idea: Smooth the visual transition between pastel verse and full render chorus

## rock-run
- good: 0:11 Scenic wide shot capturing the mountain expanse.
- good: 0:27 Chorus drop hitting alongside the dramatic singing pose.
- problem: 0:00 Style shifts drastically from the reference 3D model into an angular superhero mecha comic aesthetic.
- problem: 0:27 Abrupt switch to a realistic 3D rendered model disrupts stylistic flow.
- problem: 0:42 Rapid repetition of prior cuts undermines the visual climax.
- idea: Align art style prompts across all sections to maintain consistent rendering and line work.
- idea: Refine mask and anatomy tags to preserve the original rounded cute mascot features.
- idea: Generate unique keyframes for the finale instead of looping earlier frames.

## ballad-night
- good: 00:42 Smooth musical drop landing cleanly onto the cinematic rendered chorus visual.
- problem: 00:00 - 00:17 Abstract wallpaper patterns of floating faces fail to depict the hero character clearly.
- problem: 00:34 The face unmasks into a standard shonen anime character, breaking the mask motif abruptly.
- idea: Adjust early prompts to frame a single chibi protagonist rather than dense collage patterns.
- idea: Enforce mask preservation in dramatic action shots to maintain visual identity.
