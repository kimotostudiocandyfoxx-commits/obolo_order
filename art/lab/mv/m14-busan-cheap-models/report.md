# MV lab — m14-busan-cheap-models

Seedream をやめる試験：FLUX.2 klein 4B（1枚0.2円）/ 9B（0.4円）で写真1枚ずつ、Qwen-Image 2.1 Turbo（2円）で4コマ。どれも奥行きの動き＋新しい歌詞つき。前回の Seedream 4コマ版（約37円・6.4/6.0）と比べる。

painter: styled · scenes ≤ 30 · side 768 · heroRef 0.6 · steps 28 · hero tags: creature, chibi, white mask, blue markings, blue glowing eyes, fox ears, multiple tails, red hooded robe, white and black tails, white paws, blue gem necklace, red, white, blue

**average**: overall 6 · heroLikeness 6.6 · heroConsistency 6.6 · pictureQuality 6.2 · storyTelling 5.6 · lyricFit 7 · beatSync 5.1 · variety 4.9 · watchability 5.9 · kidsSafe 6.7

| case | overall | heroLikeness | heroConsistency | pictureQuality | storyTelling | lyricFit | beatSync | variety | watchability | kidsSafe | painted | paint s | yen |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| klein4b | 6 | 6 | 6 | 6 | 5 | 7 | 5 | 5 | 6 | 7 | 13/13 | 17 | 2.5 |
| klein9b | 6 | 6.8 | 6.9 | 6.7 | 5.8 | 6.9 | 5.2 | 4.8 | 5.8 | 7.2 | 13/13 | 20 | 4.8 |
| qwen-grid | 6 | 7 | 7 | 6 | 6 | 7 | 5 | 5 | 6 | 6 | 13/13 | 37 | 8.5 |

## klein4b
- good: 00:00 Peaceful opening scene framing the ocean view.
- good: 00:15 Rich depiction of the local crab dishes.
- problem: 00:04 Repetitive table-eating composition dominates almost every cut.
- problem: 00:11 Mask face morphs into an open mouth rather than remaining a fixed mask.
- problem: 00:34 Speed line effects are overused on static dining actions.
- idea: Add non-eating travel actions like walking or exploring markets.
- idea: Specify in prompts to keep the mask rigid without an articulated mouth.
- idea: Vary camera distances with wider establishing shots and tight macro food cuts.

## klein9b
- good: 0:01 Scenic opening hotel view overlooking the harbor.
- good: 0:11 Lively seafood market interaction with detailed tank art.
- problem: 0:04 Repetitive composition with character seated facing front eating food across too many consecutive cuts.
- problem: 0:23 Static panning and zoom effects feel repetitive and slideshow-like.
- problem: 0:32 Rapid succession of similar food eating scenes near the end lacks rhythmic synchrony.
- idea: Vary character actions beyond sitting and eating, such as walking or interacting with locals.
- idea: Incorporate more distinct wide and close-up camera angles to break visual monotony.
- idea: Align final rapid cuts to dynamic musical cues instead of uniform image swapping.

## qwen-grid
- good: 00:00 opening window view establishing atmosphere
- good: 00:11 lively aquarium crab market scene
- good: 00:23 dramatic street framing with speed lines
- problem: 00:30 repetitive eating shots in final half
- problem: 00:34 presence of beer glasses in kids-focused app
- problem: 00:45 final shot style clash with live photo appearance
- idea: Vary character poses beyond sitting at tables eating
- idea: Replace alcoholic drinks with soft drinks or tea
- idea: Maintain consistent anime aesthetic in final food plate shot
