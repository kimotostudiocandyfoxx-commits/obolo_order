import { describe, expect, it } from "vitest";
import { osmEmbedUrl, placeOf } from "./BuddyExtras";

// M-R223: a question about a place gets a small map under {bati}'s answer
describe("placeOf", () => {
  it("reads the place from the question", () => {
    expect(placeOf("東京タワーはどこ？")).toBe("東京タワー");
    expect(placeOf("富士山への行き方を教えて")).toBe("富士山");
    expect(placeOf("ルーブル美術館の場所")).toBe("ルーブル美術館");
    expect(placeOf("where is Kyoto?")).toBe("Kyoto");
  });
  it("no map for other questions", () => {
    expect(placeOf("ビッグバンって、いつ起きたの？")).toBeNull();
    expect(placeOf("ここはどこ？")).toBeNull();
  });
  it("the embed is centred on the place, no key", () => {
    const u = osmEmbedUrl(35.6586, 139.7454);
    expect(u).toContain("openstreetmap.org/export/embed.html");
    expect(u).toContain("marker=35.65860,139.74540");
  });
});
