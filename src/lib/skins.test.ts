import { describe, expect, it } from "vitest";
import { parseSkin, seeded, skinCookie, SKIN_INFO, SKINS } from "./skins";

describe("skins", () => {
  it("reads a stored skin and treats anything else as none", () => {
    expect(parseSkin("galaxy")).toBe("galaxy");
    expect(parseSkin(undefined)).toBeNull();
    expect(parseSkin("matrix")).toBeNull();
  });

  it("keeps a choice for a year and clears it for none", () => {
    expect(skinCookie("ocean")).toBe("skin=ocean; path=/; max-age=31536000; samesite=lax");
    expect(skinCookie(null)).toBe("skin=; path=/; max-age=0; samesite=lax");
  });

  it("names and describes every skin", () => {
    for (const skin of SKINS) {
      expect(SKIN_INFO[skin].label).not.toBe("");
      expect(SKIN_INFO[skin].description).not.toBe("");
    }
  });

  it("places scene elements the same way on the server and in the browser", () => {
    const run = () => Array.from({ length: 50 }, (_, i) => seeded(i, 3));
    expect(run()).toEqual(run());
    expect(run().every((v) => v >= 0 && v < 1)).toBe(true);
    expect(new Set(run()).size).toBe(50);
  });
});
