"use client";

import { useState, useSyncExternalStore } from "react";
import { THEME_LABELS, THEMES, themeAttribute, themeCookie, type Theme } from "@/lib/theme";
import { Monitor, Moon, Sun } from "./icons";
import { cx, iconButtonClass } from "./ui";

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

// The header button: switches between light and dark in one tap.
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useTheme(initial);
  const deviceDark = useDeviceDark();
  const dark = theme === "dark" || (theme === "system" && deviceDark);
  const label = dark ? "رفتن به حالت روشن" : "رفتن به حالت تیره";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={iconButtonClass}
      aria-label={label}
      title={label}
    >
      {dark ? <Sun /> : <Moon />}
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
