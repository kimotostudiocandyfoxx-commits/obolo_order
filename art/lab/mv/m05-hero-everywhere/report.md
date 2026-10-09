# MV lab — m05-hero-everywhere

m04（6.1）の反省：景色だけの場面に知らない人が出続けた → 全部の場面にきもりん（景色の場面は引きの画で小さく）。最後の場面を別ルールの絵で足さない（衣装が変わった）。1つの世界観で通す。

painter: gpu · scenes ≤ 30 · side 768 · heroRef 0.6 · steps 28 · hero tags: creature, chibi, white mask, blue markings, blue glowing eyes, fox ears, multiple tails, red hooded robe, white and black tails, white paws, blue gem necklace, red, white, blue

**average**: overall 6.1 · heroLikeness 6.4 · heroConsistency 6.4 · pictureQuality 6.7 · storyTelling 5.7 · lyricFit 6.7 · beatSync 5.8 · variety 5.5 · watchability 6 · kidsSafe 7.3

| case | overall | heroLikeness | heroConsistency | pictureQuality | storyTelling | lyricFit | beatSync | variety | watchability | kidsSafe | painted | paint s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pop-bright | 6.4 | 6.8 | 6.5 | 6.7 | 6.2 | 7 | 5.8 | 5.9 | 6.3 | 7.4 | 11/11 | 609 |
| rock-run | 6 | 6 | 7 | 7 | 6 | 7 | 6 | 6 | 6 | 7 | 13/13 | 600 |
| ballad-night | 5.9 | 6.2 | 5.4 | 6.6 | 5.7 | 6.4 | 6.1 | 5.2 | 5.9 | 7.4 | 11/11 | 606 |
| edm-party | 6 | 6.4 | 6.8 | 6.6 | 4.8 | 6.2 | 5.4 | 5 | 5.8 | 7.3 | 13/13 | 598 |

## pop-bright
- good: 00:00 Welcoming opening stretch on the bed establishing tone.
- good: 00:38 Dynamic sprint with speed lines matching musical peak.
- problem: 00:16 Tear rendering causes slight distortion around the mask boundary.
- problem: 00:34 Sudden appearance of an asphalt roadway disrupts the fantasy meadow atmosphere.
- problem: 00:42 Mask mouth area clips into human teeth geometry during laughing shot.
- idea: Adjust negative prompts to keep mask solid and avoid human facial features emerging beneath it.
- idea: Unify background prompts to prevent modern roads from appearing in nature scenes.
- idea: Align camera movements and cuts more closely with primary rhythmic accents.

## rock-run
- good: 00:23 Dynamic shout frame matching the chorus peak
- good: 00:26 Starry night sky jump fitting the magical lyrics
- problem: 00:15 Mask becomes facial skin and mouth moves directly instead of staying an accessory
- problem: 00:38 Final shot holds static for over ten seconds with minimal action
- idea: Keep the white mask rigid or add distinct straps to maintain the original prop look
- idea: Add extra transition cuts or camera moves during the long concluding note

## ballad-night
- good: 00:17 - Cozy candlelight composition in the library background.
- good: 00:42 - Chorus burst with aurora borealis and emotional gesture.
- problem: 00:00 - Face alternates between an organic feline face and a hard mask across scenes.
- problem: 00:42 - Speed lines and mouth movement feel slightly mismatched with the stiff mask design.
- problem: 00:50 - Abrupt lighting change to daytime disrupts the nocturnal mood without transition.
- idea: Standardize mask prompts to prevent shifting between a painted face and a wearable mask.
- idea: Introduce dynamic profile angles and distance framing rather than centered medium shots.
- idea: Use soft dissolves or lighting fades for flashback cuts entering the chorus.

## edm-party
- good: 00:00 - Charming 2D translation of the original 3D mascot design.
- good: 00:33 - Energetic beat drop transition to the glowing dance stage.
- problem: 00:07 - Repetitive front-facing framing diminishes visual momentum.
- problem: 00:33 - Constant radial speed lines create visual clutter during the chorus.
- problem: 00:41 - A handheld microphone appears suddenly without narrative setup.
- idea: Introduce dynamic camera angles and wider perspective shots.
- idea: Reduce speed-line intensity in favor of diverse lighting effects.
- idea: Incorporate minor narrative interactions with the neon cityscape.
