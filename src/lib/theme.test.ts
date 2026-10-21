import { describe, expect, it } from "vitest";
import { parseTheme, themeAttribute, themeCookie } from "./theme";

describe("theme", () => {
  it("reads a stored choice and falls back to following the device", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme(undefined)).toBe("system");
    expect(parseTheme("purple")).toBe("system");
  });

  it("leaves <html data-theme> off while following the device", () => {
    expect(themeAttribute("dark")).toBe("dark");
    expect(themeAttribute("system")).toBeUndefined();
  });

  it("keeps a choice for a year and clears it for the device setting", () => {
    expect(themeCookie("dark")).toBe("theme=dark; path=/; max-age=31536000; samesite=lax");
    expect(themeCookie("system")).toBe("theme=; path=/; max-age=0; samesite=lax");
  });
});
