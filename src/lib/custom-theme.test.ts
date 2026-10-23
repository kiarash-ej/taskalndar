import { describe, expect, it } from "vitest";
import { resolveAppearance } from "./appearance";
import {
  contrast,
  customThemeCss,
  customThemesCookie,
  derivePalette,
  MAX_CUSTOM_THEMES,
  parseCustomThemes,
  type CustomTheme,
} from "./custom-theme";

const theme = (over: Partial<CustomTheme> = {}): CustomTheme => ({
  id: "abc123",
  name: "شب‌های امتحان",
  color: "#7c3aed",
  scene: "stars",
  intensity: 2,
  ...over,
});

const cookieValue = (themes: unknown[]) => encodeURIComponent(JSON.stringify(themes));

describe("derivePalette", () => {
  it("keeps any colour readable as text, in light and dark mode", () => {
    for (const color of ["#7c3aed", "#facc15", "#ffffff", "#000000", "#22d3ee", "#f97316", "#64748b"]) {
      const { light, dark } = derivePalette(color);
      expect(contrast(light.accent, "#f6f5f1")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(dark.accent, "#141412")).toBeGreaterThanOrEqual(4.5);
      // labels on accent buttons stay readable too
      expect(contrast(light.fg, light.accent)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(dark.fg, dark.accent)).toBeGreaterThanOrEqual(3);
    }
  });

  it("leaves a colour that already reads well as it is", () => {
    expect(derivePalette("#0f766e").light.accent).toBe("#0f766e");
  });
});

describe("stored personal themes", () => {
  it("round-trips through the cookie", () => {
    const list = [theme(), theme({ id: "x2", name: "دریا", color: "#0891b2", scene: "none", intensity: 1 })];
    const cookie = customThemesCookie(list);
    const value = cookie.slice("custom_themes=".length, cookie.indexOf(";"));
    expect(parseCustomThemes(value)).toEqual(list);
  });

  it("drops anything tampered with, so nothing but checked colours reaches the stylesheet", () => {
    const value = cookieValue([
      theme({ color: "red;}body{display:none" }),
      theme({ id: "../x" }),
      { ...theme(), scene: "lava" },
      { ...theme(), intensity: 9 },
      theme({ name: "" }),
      theme({ id: "ok1" }),
      theme({ id: "ok1", name: "duplicate" }),
    ]);
    expect(parseCustomThemes(value).map((t) => t.id)).toEqual(["ok1"]);
    expect(parseCustomThemes("not json")).toEqual([]);
    expect(parseCustomThemes(undefined)).toEqual([]);
  });

  it("keeps at most the allowed number of themes", () => {
    const many = Array.from({ length: 10 }, (_, i) => theme({ id: `t${i}` }));
    expect(parseCustomThemes(cookieValue(many))).toHaveLength(MAX_CUSTOM_THEMES);
  });

  it("builds a stylesheet of hex values for light, device-dark and chosen-dark", () => {
    const css = customThemeCss(theme());
    expect(css).toContain(':root[data-skin="custom"]{--accent:#');
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toContain(':root[data-skin="custom"][data-theme="dark"]{');
    const values = [...css.matchAll(/:(#[0-9a-f]+);/g)].map((m) => m[1]);
    expect(values.length).toBe(9);
    expect(values.every((v) => /^#[0-9a-f]{6}$/.test(v))).toBe(true);
  });
});

describe("resolveAppearance", () => {
  const customs = [theme(), theme({ id: "calm", name: "آرام", scene: "none" })];

  it("reads a built-in skin", () => {
    expect(resolveAppearance("forest", customs)).toEqual({
      active: "forest",
      skin: "forest",
      scene: "leaves",
      intensity: 2,
      css: null,
    });
  });

  it("reads a personal theme, with or without motion", () => {
    const look = resolveAppearance("custom-abc123", customs);
    expect(look).toMatchObject({ active: "custom-abc123", skin: "custom", scene: "stars", intensity: 2 });
    expect(look.css).toContain("--accent");
    expect(resolveAppearance("custom-calm", customs).scene).toBeUndefined();
  });

  it("falls back to none for a theme that no longer exists or anything unknown", () => {
    for (const value of ["custom-gone", "custom-", "lava", undefined]) {
      expect(resolveAppearance(value, customs)).toEqual({ active: null, skin: undefined, scene: undefined, intensity: 2, css: null });
    }
  });
});
