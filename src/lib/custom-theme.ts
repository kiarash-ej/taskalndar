import { SCENES, type Scene } from "./skins";

// Personal themes the user builds in Settings: a name, one main colour, a
// moving background (or none) and how busy it is. The palette for light and
// dark mode is derived from the one colour, adjusted until text in it stays
// readable on the page. Kept in a cookie (this device), like the theme.

export const CUSTOM_THEMES_COOKIE = "custom_themes";
export const MAX_CUSTOM_THEMES = 6;
export const MAX_THEME_NAME = 30;
export const INTENSITIES = [1, 2, 3] as const;
export type Intensity = (typeof INTENSITIES)[number];

export interface CustomTheme {
  id: string;
  name: string;
  // "#rrggbb"
  color: string;
  scene: Scene | "none";
  intensity: Intensity;
}

const HEX = /^#[0-9a-f]{6}$/;
const ID = /^[a-z0-9]{1,12}$/;

export function newThemeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// One stored theme, checked field by field; null if anything is off.
export function cleanTheme(raw: unknown): CustomTheme | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const color = typeof r.color === "string" ? r.color.toLowerCase() : "";
  const name = typeof r.name === "string" ? r.name.trim() : "";
  const scene = r.scene === "none" || (SCENES as readonly unknown[]).includes(r.scene) ? (r.scene as Scene | "none") : null;
  const intensity = (INTENSITIES as readonly unknown[]).includes(r.intensity) ? (r.intensity as Intensity) : null;
  if (typeof r.id !== "string" || !ID.test(r.id) || !HEX.test(color) || !scene || !intensity) return null;
  if (name.length === 0 || name.length > MAX_THEME_NAME) return null;
  return { id: r.id, name, color, scene, intensity };
}

export function parseCustomThemes(cookie: string | undefined): CustomTheme[] {
  if (!cookie) return [];
  try {
    const list: unknown = JSON.parse(decodeURIComponent(cookie));
    if (!Array.isArray(list)) return [];
    const themes = list.map(cleanTheme).filter((t): t is CustomTheme => t !== null);
    return themes.filter((t, i) => themes.findIndex((o) => o.id === t.id) === i).slice(0, MAX_CUSTOM_THEMES);
  } catch {
    return [];
  }
}

const YEAR_SECONDS = 365 * 24 * 60 * 60;

export function customThemesCookie(themes: CustomTheme[]): string {
  if (themes.length === 0) return `${CUSTOM_THEMES_COOKIE}=; path=/; max-age=0; samesite=lax`;
  const value = encodeURIComponent(JSON.stringify(themes.slice(0, MAX_CUSTOM_THEMES)));
  return `${CUSTOM_THEMES_COOKIE}=${value}; path=/; max-age=${YEAR_SECONDS}; samesite=lax`;
}

// --- colour ---

type Rgb = [number, number, number];

function toRgb(hex: string): Rgb {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

function toHex(rgb: Rgb): string {
  return "#" + rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("");
}

// a towards b by t (0..1)
function mix(a: string, b: string, t: number): string {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as Rgb);
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// the app's page backgrounds and cards (globals.css)
const LIGHT_BG = "#f6f5f1";
const DARK_BG = "#141412";
const DARK_SURFACE = "#1d1d1a";
// links and labels are drawn in the accent, so it must read like text
const TEXT_CONTRAST = 4.5;

// Steps the colour towards `towards` until it reads on `bg`.
function readableOn(color: string, bg: string, towards: string): string {
  let c = color;
  for (let i = 0; i < 20 && contrast(c, bg) < TEXT_CONTRAST; i++) c = mix(c, towards, 0.08);
  return c;
}

function onColor(bg: string): string {
  return contrast("#ffffff", bg) >= contrast("#111111", bg) ? "#ffffff" : "#111111";
}

export interface Palette {
  accent: string;
  soft: string;
  fg: string;
}

export function derivePalette(color: string): { light: Palette; dark: Palette } {
  const light = readableOn(color, LIGHT_BG, "#000000");
  const dark = readableOn(color, DARK_BG, "#ffffff");
  return {
    light: { accent: light, soft: mix(light, "#ffffff", 0.85), fg: onColor(light) },
    dark: { accent: dark, soft: mix(dark, DARK_SURFACE, 0.78), fg: onColor(dark) },
  };
}

const vars = (p: Palette) => `--accent:${p.accent};--accent-soft:${p.soft};--accent-fg:${p.fg};`;

// The stylesheet for an active personal theme, the counterpart of the
// :root[data-skin="…"] rules in globals.css. Only derived hex values go in.
export function customThemeCss(theme: CustomTheme): string {
  const { light, dark } = derivePalette(theme.color);
  const sel = ':root[data-skin="custom"]';
  return (
    `${sel}{${vars(light)}}` +
    `@media (prefers-color-scheme: dark){${sel}:not([data-theme="light"]){${vars(dark)}}}` +
    `${sel}[data-theme="dark"]{${vars(dark)}}`
  );
}
