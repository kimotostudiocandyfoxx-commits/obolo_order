# MV lab — m11-busan-cheap

コスト比較：全部 Animagine（安いアニメモデル）で写真を描き直す版（強さ0.6 / 0.75）と、サビの3枚だけ Seedream・残り Animagine の版。曲は r08 の良い方。

painter: styled · scenes ≤ 30 · side 768 · heroRef 0.6 · steps 28 · hero tags: creature, chibi, white mask, blue markings, blue glowing eyes, fox ears, multiple tails, red hooded robe, white and black tails, white paws, blue gem necklace, red, white, blue

**average**: overall 5.6 · heroLikeness 5.4 · heroConsistency 4.5 · pictureQuality 5.7 · storyTelling 5.8 · lyricFit 6.4 · beatSync 5.3 · variety 5.4 · watchability 5.7 · kidsSafe 7.2

| case | overall | heroLikeness | heroConsistency | pictureQuality | storyTelling | lyricFit | beatSync | variety | watchability | kidsSafe | painted | paint s | yen |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cheap60 | 6 | 5 | 4 | 6 | 6 | 6 | 5 | 5 | 6 | 7 | 13/13 | 40 | 4.5 |
| cheap75 | 5.2 | 5.4 | 4.8 | 5.8 | 5.2 | 6.3 | 4.9 | 5 | 5.3 | 7.2 | 13/13 | 38 | 3.8 |
| mix3 | 5.7 | 5.8 | 4.6 | 5.2 | 6.1 | 6.8 | 5.9 | 6.2 | 5.8 | 7.5 | 13/13 | 126 | 25.4 |

## cheap60
- good: 00:04 Opening beach shot establishing Busan atmosphere.
- good: 00:15 Table feast composition matching lyrics nicely.
- problem: 00:08 Hero scale shrinks to miniature figurine on table.
- problem: 00:23 Hero morphs into tall stylized figure, losing core proportions.
- problem: 00:26 Hero partially merges into fried food plate.
- idea: Lock character scale and model sheet across interior scenes.
- idea: Standardize costume details and chibi proportions in prompts.
- idea: Increase cut rhythm variety during chorus.

## cheap75
- good: 00:01 Scenic intro shot overlooking the bay.
- good: 00:23 Atmospheric stroll through the night market.
- problem: 00:08 Hero facial features and cloak details morph noticeably.
- problem: 00:11 Duplicated hero clones appear inside fish tanks.
- problem: 00:33 Odd scaling with character sitting inside a tiny pot.
- problem: 00:38 Morphing artifacts and inconsistent character anatomy.
- idea: Enforce strict negative prompting for duplicate characters.
- idea: Standardize hero model sheet prompts for cloak and mask consistency.
- idea: Vary composition beyond repetitive table-level food closeups.

## mix3
- good: 00:04 Atmospheric stroll along the beach.
- good: 00:30 Charming street-side dining composition.
- problem: 00:19 Abrupt jump between flat 2D art and 3D rendered style.
- problem: 00:26 Hero scale and anatomy fluctuate heavily around the food plates.
- problem: 00:38 Mask detailing and tail counts lose reference fidelity.
- idea: Enforce consistent 2D anime style keywords across all storyboard prompts.
- idea: Use image prompt conditioning to lock mask patterns and robe details.
- idea: Adjust edit cut points to land firmly on drum transients.
