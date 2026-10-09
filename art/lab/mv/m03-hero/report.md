# MV lab — m03-hero

m02 の反省（5.1）：主人公の説明がぶれて「ちびキャラ」「白いお面」が消えた → 説明を毎回同じに、体の比率と顔（お面）を必ず書く。参考画像の効き 0.6 と 0.8 を比べる。最後の長い場面も小節ごとに分ける。

painter: gpu · scenes ≤ 30 · side 768 · heroRef 0.6 · steps 28 · hero tags: creature, chibi, white mask, blue markings, blue glowing eyes, fox ears, multiple tails, red hooded robe, white and black tails, white paws, blue gem necklace, red, white, blue

**average**: overall 6.1 · heroLikeness 6.5 · heroConsistency 6.2 · pictureQuality 6.6 · storyTelling 5.7 · lyricFit 6.4 · beatSync 5.4 · variety 5.5 · watchability 6 · kidsSafe 7.2

| case | overall | heroLikeness | heroConsistency | pictureQuality | storyTelling | lyricFit | beatSync | variety | watchability | kidsSafe | painted | paint s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pop-bright~ref60 | 5.9 | 6.8 | 6.7 | 6.5 | 5.8 | 6.4 | 5.2 | 4.8 | 5.6 | 7.4 | 8/8 | 605 |
| pop-bright~ref80 | 6 | 6 | 5 | 7 | 6 | 7 | 5 | 5 | 6 | 7 | 8/8 | 594 |
| rock-run~ref60 | 6.5 | 6.5 | 6.8 | 6.6 | 6.2 | 6.4 | 6 | 6.3 | 6.4 | 7.5 | 14/14 | 596 |
| rock-run~ref80 | 6.4 | 7 | 6.2 | 6.8 | 5.8 | 6.6 | 6.2 | 6.4 | 6.5 | 7.2 | 13/13 | 615 |
| ballad-night~ref60 | 6 | 6 | 6 | 6 | 5 | 6 | 5 | 5 | 6 | 7 | 8/8 | 604 |
| ballad-night~ref80 | 5.7 | 6.8 | 6.5 | 6.7 | 5.2 | 5.8 | 4.8 | 5.4 | 5.5 | 7 | 9/9 | 595 |

## pop-bright~ref60
- good: 0:00 Cozy morning window opening establishes a warm mood.
- good: 0:22 Cheerful expression and speed lines fit the musical lift.
- problem: 0:14 Static running pose relies on linear zoom rather than fluid locomotion.
- problem: 0:22 Repetitive frontal framing lowers visual interest.
- problem: 0:38 The final sunset shot lingers too long without motion progression.
- idea: Incorporate varied profile or low-angle shots in the storyboard prompts.
- idea: Add animated mouth movement and step cycles to improve dynamism.
- idea: Shorten the concluding hold and cut to a scenic landscape detail.

## pop-bright~ref80
- good: 00:00 - Cozy morning window scene capturing gentle atmosphere.
- good: 00:32 - Energetic dash across the flower meadow.
- problem: 00:24 - Mask morphs into oversized uncovered eyes, breaking character design.
- problem: 00:37 - Final still shot lingers excessively without motion variety.
- idea: Reinforce mask prompt tokens to keep face design uniform.
- idea: Cut the final long shot into two shorter dynamic action beats.

## rock-run~ref60
- good: 00:01 Dynamic opening run through the forest matches beat.
- good: 00:23 Chorus leap with speed lines creates good energy.
- good: 00:35 Majestic multiple tails reveal against cosmic backdrop.
- problem: 00:08 Empty road cut lacks character presence and stalls momentum.
- problem: 00:32 Sudden human silhouette breaks hero continuity.
- problem: 00:44 Bedroom setting with headphones feels disconnected from the fantasy journey.
- idea: Replace empty scenic cuts with continuous tracking shots of the hero running.
- idea: Remove human reference prompts in sky cut to maintain solitary creature focus.
- idea: Ground the ending in the fantasy world rather than an abrupt modern room switch.

## rock-run~ref80
- good: 00:08 Energetic running sequence matching the beat.
- good: 00:21 Expressive vocal close-up with dynamic action lines.
- problem: 00:04 Unintended human character appears in landscape shot.
- problem: 00:12 Posterize filter creates distracting color banding.
- problem: 00:27 Second appearance of out-of-place human figure.
- problem: 00:40 Lingering static close-up slows down the ending.
- idea: Add negative prompts to strictly exclude human characters during scenery cuts.
- idea: Tone down or remove posterization filters to preserve smooth shading.
- idea: Cut final prolonged shot into multiple closing reaction angles.

## ballad-night~ref60
- good: 0:01 Atmospheric intro framing character under starry sky
- good: 0:51 Uplifting shot releasing the glowing light orb
- problem: 0:12 Empty room scene feels disconnected from character journey
- problem: 0:35 Speed lines effect is slightly jarring for a slow ballad
- problem: 0:55 Final scenery cut ends too abruptly
- idea: Include character silhouette in the indoor transition shot
- idea: Replace speed lines with a gentle camera push-in
- idea: Extend final landscape duration to match audio fade

## ballad-night~ref80
- good: 00:18 - Expressive emotional crying face matching the melancholy vocal line.
- good: 00:26 - Smooth walking sequence crossing the bridge under the full moon.
- problem: 00:00 - Opening shot is held too long without motion or visual progression.
- problem: 00:12 - Abrupt transition to an empty library without establishing character presence.
- problem: 00:46 - Microphones and modern singing gear clash with the fantasy design.
- problem: 00:49 - Sudden introduction of an unrelated human girl breaks character narrative continuity.
- idea: Shorten opening static holds to 4-5 seconds to preserve visual momentum.
- idea: Place the hero directly inside the library setting to maintain spatial context.
- idea: Replace modern handheld microphone with magical singing particles or glowing aura.
- idea: Keep the fox spirit hero in the final climax instead of swapping to a human protagonist.
