import { describe, expect, it } from "vitest";
import { normalizeTag, normalizeTags } from "./tags";

describe("normalizeTag", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeTag("  درس   خواندن ")).toBe("درس خواندن");
  });

  it("folds Arabic yeh and kaf into the Persian letters", () => {
    expect(normalizeTag("درسي")).toBe("درسی");
    expect(normalizeTag("كار")).toBe("کار");
  });

  it("drops a leading # and stray zero-width non-joiners at the edges", () => {
    expect(normalizeTag("#ورزش")).toBe("ورزش");
    expect(normalizeTag("‌می‌خوانم‌")).toBe("می‌خوانم");
  });
});

describe("normalizeTags", () => {
  it("normalizes, drops empties and duplicates, and keeps the first order", () => {
    expect(normalizeTags(["درس", " درسي", "", "#", "كار", "درس"])).toEqual(["درس", "درسی", "کار"]);
  });

  it("cuts tags to 40 characters and the list to 10 tags", () => {
    const tags = normalizeTags(["x".repeat(50), ...Array.from({ length: 12 }, (_, i) => `t${i}`)]);
    expect(tags[0]).toBe("x".repeat(40));
    expect(tags).toHaveLength(10);
  });

  it("splits comma-separated input, Persian commas included", () => {
    expect(normalizeTags("درس، ورزش,کار")).toEqual(["درس", "ورزش", "کار"]);
  });
});
