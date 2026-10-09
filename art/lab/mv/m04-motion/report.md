# MV lab — m04-motion

m03（6.1）の反省：景色の場面に人影 → 絵ごとに「人なし」を禁止語で指定。ベタ塗り演出をやめる。場面を1.5小節ごとに増やす。サビは拍に合わせて画面が脈打つ。参考画像の効きは 0.6。

painter: gpu · scenes ≤ 30 · side 768 · heroRef 0.6 · steps 28 · hero tags: creature, chibi, white mask, blue markings, blue glowing eyes, fox ears, multiple tails, red hooded robe, white and black tails, white paws, blue gem necklace, red, white, blue

**average**: overall 6.1 · heroLikeness 6.4 · heroConsistency 6 · pictureQuality 6.4 · storyTelling 5.3 · lyricFit 6.2 · beatSync 5.7 · variety 6.1 · watchability 6 · kidsSafe 7.2

| case | overall | heroLikeness | heroConsistency | pictureQuality | storyTelling | lyricFit | beatSync | variety | watchability | kidsSafe | painted | paint s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pop-bright | 6.3 | 6.8 | 6.5 | 6.6 | 6 | 6.7 | 5.8 | 6 | 6.2 | 7.5 | 15/15 | 601 |
| rock-run | 6 | 6.8 | 5.4 | 6.9 | 5.2 | 6.2 | 6 | 6.4 | 5.8 | 7.4 | 15/15 | 623 |
| ballad-night | 6 | 6 | 6 | 6 | 5 | 6 | 5 | 6 | 6 | 7 | 12/12 | 597 |
| edm-party | 6 | 6 | 6 | 6 | 5 | 6 | 6 | 6 | 6 | 7 | 18/18 | 606 |

## pop-bright
- good: 00:05 cute wake-up moment in bed matching the opening melody.
- good: 00:38 dynamic jump shot timing with the vocal climax.
- problem: 00:43 introduces an unexpected human character not established in the storyline.
- problem: 00:25-00:29 feels repetitive with multiple continuous running angles.
- problem: Pacing relies heavily on static pan-and-scan camera motions.
- idea: Add '1girl, human' to negative prompts for cutaway scenery shots.
- idea: Vary camera perspectives during movement scenes using low angles or profile pans.
- idea: Align key pose shifts directly with the downbeats for tighter rhythmic flow.

## rock-run
- good: 00:03 - High-energy leap over the log with clean motion lines.
- good: 00:41 - Dynamic forward run along the illuminated trail.
- problem: 00:07 - Unrelated human girl appears instead of pure landscape scenery.
- problem: 00:23 - Human character intrudes again on the night sky shot.
- problem: 00:35 - Face mask anatomy distorts awkwardly during shouting expression.
- idea: Add '1girl, human' to negative prompts for scenery-only shots.
- idea: Clarify whether the hero wears a rigid mask or has an expressive face to avoid distortion.
- idea: Tighten transitions around lyric beat drops to maintain character momentum.

## ballad-night
- good: 0:05 Charming hero introduction under the moonlight.
- good: 0:47 Emotional firefly scene effectively complementing the chorus.
- problem: 0:39 Modern handheld microphone abruptly clashes with traditional fantasy atmosphere.
- problem: 0:43 Cutaway to an unrelated human girl breaks narrative continuity.
- problem: 0:52 Ending shot in a modern train interior clashes with the established shrine setting.
- idea: Replace modern microphone in prompt with mystical singing aura.
- idea: Keep hero in focus during the climax instead of cutting to random human characters.
- idea: Maintain ancient nighttime setting throughout the final sequence.

## edm-party
- good: 00:04 - Energetic introduction of the hero on the neon street.
- good: 00:23 - Dramatic close-up with glowing eyes matching the beat shift.
- good: 00:40 - Cheerful rooftop pose under the fireworks finale.
- problem: 00:13 - An unintended human girl appears on stage despite 'no humans' prompt.
- problem: 00:28 - DJ booth cut generates a random girl instead of empty scenery or the hero.
- problem: 00:38 - Another human character appears overlooking the fireworks.
- problem: 00:42 - Mascot posture briefly changes awkwardly to a four-legged stance.
- problem: 00:44 - Outfit changes inconsistently into a festival kimono style.
- idea: Add strong negative prompt weights for human characters in scenery cuts.
- idea: Keep costume prompts strictly consistent across all scenes to prevent random outfit shifts.
- idea: Maintain the bipedal chibi pose consistently to avoid strange quadruped transitions.
