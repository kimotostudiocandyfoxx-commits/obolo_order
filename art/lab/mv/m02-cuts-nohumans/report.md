# MV lab — m02-cuts-nohumans

m01 の反省：主人公なしの場面は「人なし」、主人公の場面は「ひとりだけ」。グリッチは激しい曲だけ。長い場面は小節ごとに別カメラの複数カットに分ける（サビは1小節、Aメロは2小節）。歌詞の行が変わるところで場面を変える。

painter: gpu · scenes ≤ 30 · side 768 · heroRef 0.6 · steps 28 · hero tags: creature, fox, non-human, mask, cat mask, glowing eyes, animal ears, fox ears, multiple tails, hooded cloak, red robe, blue jewelry, full body, solo

**average**: overall 5.1 · heroLikeness 4.3 · heroConsistency 5.3 · pictureQuality 6.2 · storyTelling 5.4 · lyricFit 6.3 · beatSync 5 · variety 5.3 · watchability 5.1 · kidsSafe 7

| case | overall | heroLikeness | heroConsistency | pictureQuality | storyTelling | lyricFit | beatSync | variety | watchability | kidsSafe | painted | paint s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pop-bright | 5 | 4 | 4 | 6 | 6 | 6 | 5 | 6 | 5 | 7 | 7/7 | 593 |
| rock-run | 5 | 4 | 6 | 6 | 6 | 7 | 5 | 6 | 5 | 7 | 5/5 | 594 |
| ballad-night | 5 | 4 | 5 | 6 | 5 | 6 | 5 | 5 | 5 | 7 | 8/8 | 596 |
| edm-party | 5.4 | 5.2 | 6.3 | 6.8 | 4.5 | 6.1 | 5 | 4.2 | 5.3 | 7 | 8/8 | 607 |

## pop-bright
- good: 00:07 Peaceful window scene complementing the morning lyrics.
- good: 00:15 Smooth walking progression along the town street.
- problem: 00:00 Proportion and mask design deviate significantly from reference chibi doll aesthetic.
- problem: 00:31 Mask style and color abruptly shift from white kitsune to dark visor.
- problem: 00:37 Scenery cut lingers too long without hero presence.
- idea: Add chibi body proportions and specific blue mask markings to the character prompt.
- idea: Maintain consistent mask tokens across prompts to avoid spontaneous mask mutations.
- idea: Shorten static environment shots to keep pacing brisk.

## rock-run
- good: 00:27 - Moonlit temple composition complements the vocal swell.
- good: 00:39 - Climax framing and speed lines deliver good energy.
- problem: 00:00 - Head and mask design alter the reference chibi mask into a fox muzzle with a small half-mask.
- problem: 00:15 - Shots rely on basic pans across static illustrations instead of fluid character motion.
- problem: 00:39 - Final shout reveals animal fangs and mouth, breaking the solid mask aesthetic.
- idea: Specify a smooth full-face porcelain mask with painted blue eyes in the negative prompts to avoid snout generation.
- idea: Add more cut transitions and animated overlay effects to match the vocal pacing.

## ballad-night
- good: 0:00 Atmospheric opening town shot with falling meteor streaks.
- good: 0:26 Dynamic speed-line framing on the chorus drop.
- problem: 0:07 Reference chibi proportions are lost in favor of a tall humanoid fox.
- problem: 0:14 Hero mask abruptly turns from white to black and stays inconsistent.
- problem: 0:26 Static framing persists across verses with limited cinematic movement.
- idea: Enforce chibi body proportions and white mask details in prompts.
- idea: Use stronger motion prompts and camera pans to match musical energy shifts.

## edm-party
- good: 00:19 - Energetic leap synced well with upbeat chorus tempo.
- good: 00:08 - Clean pose transition aligning nicely with the vocal cue.
- problem: 00:00 - Character proportions shifted from original chibi mascot to tall anthro anime silhouette with half-mask.
- problem: 00:30 - Final shot drags on for fourteen seconds with minimal visual progression.
- problem: 00:31 - Character robe opens exposing chest, diverging from the original modest layered robe design.
- idea: Add 'chibi, cute mascot proportions, full face mask' to generation prompts to better match source reference.
- idea: Split the long finale at 00:30 into faster cuts with close-up dance moves synced to the chorus.
