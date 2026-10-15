import { describe, expect, it } from "vitest";
import { backgroundStyle, NO_BACKGROUND, parseBackground } from "./background";

describe("parseBackground", () => {
  it("accepts valid colors, gradients and images", () => {
    expect(parseBackground("color", "#0f766e")).toEqual({ kind: "color", value: "#0f766e" });
    expect(parseBackground("gradient", "ocean")).toEqual({ kind: "gradient", value: "ocean" });
    expect(parseBackground("image", "u/1.png")).toEqual({ kind: "image", value: "u/1.png" });
  });

  it("falls back to no background for unknown or malformed rows", () => {
    expect(parseBackground("color", "red; background:url(x)")).toEqual(NO_BACKGROUND);
    expect(parseBackground("gradient", "nope")).toEqual(NO_BACKGROUND);
    expect(parseBackground("image", null)).toEqual(NO_BACKGROUND);
    expect(parseBackground("weird", "x")).toEqual(NO_BACKGROUND);
    expect(parseBackground(null, null)).toEqual(NO_BACKGROUND);
  });
});

describe("backgroundStyle", () => {
  it("builds styles per kind", () => {
    expect(backgroundStyle({ kind: "color", value: "#112233" })).toEqual({ backgroundColor: "#112233" });
    expect(backgroundStyle({ kind: "gradient", value: "sunset" })?.backgroundImage).toContain("linear-gradient");
    expect(backgroundStyle({ kind: "image", value: "p" }, "https://x/y.png")?.backgroundImage).toBe('url("https://x/y.png")');
  });

  it("returns null when there is nothing to draw", () => {
    expect(backgroundStyle(NO_BACKGROUND)).toBeNull();
    expect(backgroundStyle({ kind: "image", value: "p" })).toBeNull();
  });
});
