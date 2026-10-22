"use client";

import { useState, useSyncExternalStore } from "react";
import { SKIN_INFO, skinCookie, SKINS, type Skin } from "@/lib/skins";
import { THEME_LABELS, THEMES, themeAttribute, themeCookie, type Theme } from "@/lib/theme";
import { Monitor, Moon, Sun } from "./icons";
import { cx } from "./ui";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeToDevice(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// whether the device prefers dark; the server can't know, so it says light
function useDeviceDark(): boolean {
  return useSyncExternalStore(subscribeToDevice, () => window.matchMedia(DARK_QUERY).matches, () => false);
}

// Applies a choice at once (no reload) and remembers it for the next visit.
function applyTheme(theme: Theme) {
  const attribute = themeAttribute(theme);
  if (attribute) document.documentElement.dataset.theme = attribute;
  else delete document.documentElement.dataset.theme;
  document.cookie = themeCookie(theme);
}

function useTheme(initial: Theme) {
  const [theme, setTheme] = useState(initial);
  return [
    theme,
    (next: Theme) => {
      applyTheme(next);
      setTheme(next);
    },
  ] as const;
}

// The header switch: a little sky where the sun slides over and becomes the
// moon, one tap between light and dark. Its border is the text colour (black
// by day, light at night) so it stands out on either background.
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useTheme(initial);
  const deviceDark = useDeviceDark();
  const dark = theme === "dark" || (theme === "system" && deviceDark);
  const label = dark ? "حالت تیره روشن است؛ رفتن به حالت روشن" : "حالت روشن است؛ رفتن به حالت تیره";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="حالت تیره"
      title={label}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={cx(
        "relative h-8 w-15 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-fg transition-[background] duration-700",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
      )}
      style={{ backgroundImage: dark ? "var(--sky-night)" : "var(--sky-day)" }}
    >
      {/* stars come out at night */}
      {[
        [10, 7],
        [20, 17],
        [16, 4],
      ].map(([x, y], i) => (
        <span
          key={i}
          aria-hidden
          className="absolute size-[3px] rounded-full transition-opacity duration-700"
          style={{
            insetInlineEnd: x,
            top: y,
            background: "var(--star)",
            opacity: dark ? 0.9 : 0,
            animation: dark ? `twinkle 1.8s ${i * 0.4}s infinite alternate` : undefined,
          }}
        />
      ))}
      {/* the sun, sliding across and turning into a crescent moon */}
      <span
        aria-hidden
        className="absolute top-[3px] size-[22px] rounded-full transition-all duration-500 ease-[cubic-bezier(.5,1.6,.4,1)]"
        style={{
          insetInlineStart: dark ? 31 : 3,
          background: dark ? "transparent" : "var(--sun)",
          boxShadow: dark ? "inset -7px -3px 0 0 var(--star)" : "0 0 10px var(--sun)",
        }}
      />
    </button>
  );
}

const ICONS: Record<Theme, typeof Sun> = { system: Monitor, light: Sun, dark: Moon };

// Settings: all three choices, including going back to following the device.
export function ThemePicker({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useTheme(initial);
  return (
    <div role="radiogroup" aria-label="حالت نمایش" className="flex flex-wrap gap-2">
      {THEMES.map((t) => {
        const Icon = ICONS[t];
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={theme === t}
            onClick={() => setTheme(t)}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors",
              theme === t
                ? "border-accent bg-accent-soft text-accent"
                : "border-line text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <Icon />
            {THEME_LABELS[t]}
          </button>
        );
      })}
    </div>
  );
}

// Applies a skin at once (the scene follows <html data-skin>) and remembers it.
function applySkin(skin: Skin | null) {
  if (skin) document.documentElement.dataset.skin = skin;
  else delete document.documentElement.dataset.skin;
  document.cookie = skinCookie(skin);
}

// Settings: the special skins, or none. A tap applies it at once and keeps it.
export function SkinPicker({ initial }: { initial: Skin | null }) {
  const [skin, setSkin] = useState(initial);
  function choose(next: Skin | null) {
    applySkin(next);
    setSkin(next);
  }
  const options: (Skin | null)[] = [null, ...SKINS];
  return (
    <div role="radiogroup" aria-label="پوستهٔ ویژه" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((option) => {
        const info = option ? SKIN_INFO[option] : null;
        const checked = skin === option;
        return (
          <button
            key={option ?? "none"}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => choose(option)}
            className={cx(
              "overflow-hidden rounded-xl border text-start transition-[border-color,box-shadow]",
              checked ? "border-accent ring-2 ring-accent/30" : "border-line hover:border-muted",
            )}
          >
            <span
              aria-hidden
              className="block h-14 w-full"
              style={{ background: info ? info.swatch : "var(--surface-2)" }}
            />
            <span className="block px-2.5 py-2">
              <span className="block text-sm font-bold">{info ? info.label : "بدون پوسته"}</span>
              <span className="block text-xs leading-5 text-muted">
                {info ? info.description : "رنگ‌های ساده و پس‌زمینهٔ خودتان"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
