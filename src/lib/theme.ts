// Light or dark appearance. "system" follows the device until the user picks
// one; the choice is kept in a cookie so the server renders the right colours
// from the first byte (no flash), and globals.css reads it from
// <html data-theme>.

export const THEME_COOKIE = "theme";
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = {
  system: "مثل دستگاه",
  light: "روشن",
  dark: "تیره",
};

export function parseTheme(value: unknown): Theme {
  return (THEMES as readonly unknown[]).includes(value) ? (value as Theme) : "system";
}

// The <html data-theme> value: none for "system", so the CSS media query decides.
export function themeAttribute(theme: Theme): "light" | "dark" | undefined {
  return theme === "system" ? undefined : theme;
}

const YEAR_SECONDS = 365 * 24 * 60 * 60;

export function themeCookie(theme: Theme): string {
  return theme === "system"
    ? `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`
    : `${THEME_COOKIE}=${theme}; path=/; max-age=${YEAR_SECONDS}; samesite=lax`;
}
