import { describe, expect, it } from "vitest";
import {
  BATI_RESTYLE_TOUCH_WORDS,
  batiPrompt,
  batiRestylePrompt,
  batiSeedRule,
} from "./images";

// M-R223 (D03-S008): {bati}'s look — four touches without a wish, and the seed it was born from in every look
describe("{bati}'s look keeps its seed", () => {
  it("without a wish, the four are four art touches of the same creature", () => {
    const ps = [0, 1, 2, 3].map((i) =>
      batiRestylePrompt("", i, true, { seed: "たこ焼き", kind: "food" }),
    );
    ps.forEach((p, i) => expect(p).toContain(BATI_RESTYLE_TOUCH_WORDS[i]));
    expect(new Set(ps).size).toBe(4);
    expect(ps[0]).toContain("same creature");
  });

  it("with a wish, four variations of it", () => {
    const p = batiRestylePrompt("服を着せて", 2, false, { seed: "たこ焼き" });
    expect(p).toContain("服を着せて");
    expect(p).toContain("Variation 3 of 4");
  });

  it("food: a small piece of it stays (hair ornament, pattern, held item), else a small tattoo", () => {
    const p = batiRestylePrompt("もっとかっこよく", 0, true, {
      seed: "たこ焼き",
      kind: "food",
    });
    expect(p).toContain('born from the food "たこ焼き"');
    expect(p).toMatch(/hair ornament/);
    expect(p).toMatch(/small tattoo of "たこ焼き"/);
  });

  it("sound: a small sound-pattern motif", () => {
    const r = batiSeedRule({ seed: "雨の音", kind: "sound" });
    expect(r).toContain('favourite sound "雨の音"');
    expect(r).toMatch(/waveform|musical notes/);
    expect(
      batiRestylePrompt("", 0, false, { seed: "雨の音", kind: "sound" }),
    ).toContain("雨の音");
  });

  it("word: the word's letters as a small motif (the only text allowed)", () => {
    const r = batiSeedRule({ seed: "ありがとう", kind: "word" });
    expect(r).toContain('word "ありがとう"');
    expect(r).toMatch(/letters/);
    const p = batiRestylePrompt("", 1, false, {
      seed: "ありがとう",
      kind: "word",
    });
    expect(p).not.toContain("No text, no letters.");
    expect(p).toContain("ありがとう");
  });

  it("the birth painting of the 2nd / 3rd carries their seed too", () => {
    expect(batiPrompt("鈴の音", true, "sound")).toContain(
      'favourite sound "鈴の音"',
    );
    expect(batiPrompt("勇気", false, "word")).toContain('word "勇気"');
    expect(batiPrompt("いちご", true)).toContain("いちご");
  });
});
