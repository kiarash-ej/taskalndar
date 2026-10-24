"use client";

import { useState, useSyncExternalStore } from "react";
import { CUSTOM_STYLE_ID, resolveAppearance } from "@/lib/appearance";
import {
  contrast,
  customThemesCookie,
  derivePalette,
  INTENSITIES,
  MAX_CUSTOM_THEMES,
  MAX_THEME_NAME,
  newThemeId,
  type CustomTheme,
  type Intensity,
} from "@/lib/custom-theme";
import { CUSTOM_PREFIX, SCENE_LABELS, SCENES, SKIN_INFO, skinCookie, SKINS, type Scene } from "@/lib/skins";
import { Pencil, Trash } from "./icons";
import { SceneLayer } from "./skin-scene";
import { buttonClass, cx, iconButtonClass, inputClass, ProgressBar } from "./ui";

const PRESETS = ["#0f766e", "#2563eb", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#0891b2", "#475569"];
const INTENSITY_LABELS: Record<Intensity, string> = { 1: "کم", 2: "متوسط", 3: "زیاد" };

// Applies a look at once and remembers it: <html> attributes for the colours
// and the scene, the personal theme's stylesheet, and the cookies.
function applyLook(active: string | null, customs: CustomTheme[]) {
  const look = resolveAppearance(active ?? undefined, customs);
  const root = document.documentElement;
  const set = (name: string, value: string | number | undefined) => {
    if (value === undefined) delete root.dataset[name];
    else root.dataset[name] = String(value);
  };
  set("skin", look.skin);
  set("scene", look.scene);
  set("intensity", look.intensity);
  const style = document.getElementById(CUSTOM_STYLE_ID);
  if (style) style.textContent = look.css ?? "";
  document.cookie = skinCookie(look.active);
}

function saveCustoms(customs: CustomTheme[]) {
  document.cookie = customThemesCookie(customs);
}

// whether the page is in dark mode right now, for the editor's preview
function subscribeMode(onChange: () => void) {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  query.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    query.removeEventListener("change", onChange);
  };
}
function useDarkNow(): boolean {
  return useSyncExternalStore(
    subscribeMode,
    () => {
      const t = document.documentElement.dataset.theme;
      return t === "dark" || (t !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    },
    () => false,
  );
}

const tileClass = (checked: boolean) =>
  cx(
    "overflow-hidden rounded-xl border text-start transition-[border-color,box-shadow]",
    checked ? "border-accent ring-2 ring-accent/30" : "border-line hover:border-muted",
  );

const customSwatch = (t: CustomTheme) =>
  `linear-gradient(160deg, color-mix(in srgb, ${t.color} 25%, white) 0%, ${t.color} 55%, color-mix(in srgb, ${t.color} 60%, black) 100%)`;

// Settings: the built-in skins, the user's personal themes, and the editor
// for making one. A tap on a tile applies it; nothing else changes the look.
export function SkinSettings({ initialActive, initialCustoms }: { initialActive: string | null; initialCustoms: CustomTheme[] }) {
  const [active, setActive] = useState(initialActive);
  const [customs, setCustoms] = useState(initialCustoms);
  const [editing, setEditing] = useState<CustomTheme | null>(null);

  function choose(next: string | null, list = customs) {
    applyLook(next, list);
    setActive(next);
  }

  function save(theme: CustomTheme, use: boolean) {
    const exists = customs.some((t) => t.id === theme.id);
    const list = exists ? customs.map((t) => (t.id === theme.id ? theme : t)) : [...customs, theme];
    saveCustoms(list);
    setCustoms(list);
    setEditing(null);
    const id = CUSTOM_PREFIX + theme.id;
    // using it, or it was already in use and changed: show the new version
    if (use || active === id) choose(id, list);
  }

  function remove(theme: CustomTheme) {
    if (!window.confirm(`تم «${theme.name}» حذف شود؟`)) return;
    const list = customs.filter((t) => t.id !== theme.id);
    saveCustoms(list);
    setCustoms(list);
    if (active === CUSTOM_PREFIX + theme.id) choose(null, list);
  }

  const full = customs.length >= MAX_CUSTOM_THEMES;

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="پوسته" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button type="button" role="radio" aria-checked={active === null} onClick={() => choose(null)} className={tileClass(active === null)}>
          <span aria-hidden className="block h-14 w-full bg-surface-2" />
          <span className="block px-2.5 py-2">
            <span className="block text-sm font-bold">بدون پوسته</span>
            <span className="block text-xs leading-5 text-muted">رنگ‌های ساده و پس‌زمینهٔ خودتان</span>
          </span>
        </button>
        {SKINS.map((skin) => (
          <button key={skin} type="button" role="radio" aria-checked={active === skin} onClick={() => choose(skin)} className={tileClass(active === skin)}>
            <span aria-hidden className="block h-14 w-full" style={{ background: SKIN_INFO[skin].swatch }} />
            <span className="block px-2.5 py-2">
              <span className="block text-sm font-bold">{SKIN_INFO[skin].label}</span>
              <span className="block text-xs leading-5 text-muted">{SKIN_INFO[skin].description}</span>
            </span>
          </button>
        ))}
        {customs.map((theme) => {
          const id = CUSTOM_PREFIX + theme.id;
          return (
            <div key={theme.id} className={cx(tileClass(active === id), "relative")}>
              <button type="button" role="radio" aria-checked={active === id} onClick={() => choose(id)} className="block w-full text-start">
                <span aria-hidden className="block h-14 w-full" style={{ background: customSwatch(theme) }} />
                <span className="block px-2.5 py-2">
                  <span className="block truncate text-sm font-bold">{theme.name}</span>
                  <span className="block text-xs leading-5 text-muted">
                    تم شخصی · {SCENE_LABELS[theme.scene]}
                  </span>
                </span>
              </button>
              <span className="absolute end-1 top-1 flex rounded-lg bg-surface-solid/90">
                <button type="button" onClick={() => setEditing(theme)} className={iconButtonClass} aria-label={`ویرایش «${theme.name}»`}>
                  <Pencil />
                </button>
                <button type="button" onClick={() => remove(theme)} className={cx(iconButtonClass, "hover:text-down")} aria-label={`حذف «${theme.name}»`}>
                  <Trash />
                </button>
              </span>
            </div>
          );
        })}
        {!editing && (
          <button
            type="button"
            disabled={full}
            onClick={() => setEditing({ id: newThemeId(), name: "", color: "#7c3aed", scene: "stars", intensity: 2 })}
            className="grid min-h-28 place-items-center rounded-xl border-2 border-dashed border-line p-3 text-center text-sm font-semibold text-accent hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {full ? `حداکثر ${MAX_CUSTOM_THEMES} تم شخصی` : "+ ساختن تم شخصی"}
          </button>
        )}
      </div>

      {editing && (
        <ThemeEditor
          key={editing.id}
          initial={editing}
          isNew={!customs.some((t) => t.id === editing.id)}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}

      <p className="text-xs leading-6 text-muted">
        تم‌های شخصی روی همین دستگاه نگه داشته می‌شوند. پوسته‌ها و تم‌هایی که پس‌زمینهٔ متحرک دارند، جای پس‌زمینهٔ انتخابی
        شما را می‌گیرند.
      </p>
    </div>
  );
}

function ThemeEditor({
  initial,
  isNew,
  onSave,
  onCancel,
}: {
  initial: CustomTheme;
  isNew: boolean;
  onSave: (theme: CustomTheme, use: boolean) => void;
  onCancel: () => void;
}) {
  const [theme, setTheme] = useState(initial);
  const dark = useDarkNow();
  const palette = derivePalette(theme.color)[dark ? "dark" : "light"];
  // the colour was adjusted so text in it stays readable
  const adjusted = contrast(palette.accent, theme.color) > 1.15;
  const name = theme.name.trim();
  const update = (change: Partial<CustomTheme>) => setTheme((t) => ({ ...t, ...change }));

  return (
    <section aria-label={isNew ? "ساختن تم شخصی" : "ویرایش تم"} className="anim-enter space-y-4 rounded-2xl border border-line p-4">
      <h3 className="font-bold">{isNew ? "تم شخصی تازه" : `ویرایش «${initial.name}»`}</h3>

      <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">نام تم</span>
            <input
              value={theme.name}
              maxLength={MAX_THEME_NAME}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="مثلاً «شب‌های امتحان»"
              className={inputClass}
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">رنگ اصلی</legend>
            <div className="flex flex-wrap items-center gap-2">
              {PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => update({ color: c })}
                  aria-label={`رنگ ${c}`}
                  aria-pressed={theme.color === c}
                  className={cx(
                    "size-8 rounded-lg border-2 transition-shadow",
                    theme.color === c ? "border-fg ring-2 ring-accent/30" : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
              <label className="flex items-center gap-1.5 text-sm text-muted">
                دلخواه
                <input
                  type="color"
                  value={theme.color}
                  onChange={(e) => update({ color: e.target.value.toLowerCase() })}
                  className="size-9 cursor-pointer rounded-lg border border-line bg-surface p-0.5"
                />
              </label>
            </div>
            {adjusted && (
              <p className="text-xs text-muted">
                در حالت {dark ? "تیره" : "روشن"} کمی {dark ? "روشن‌تر" : "تیره‌تر"} نشان داده می‌شود تا متن‌ها خوانا بمانند.
              </p>
            )}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">پس‌زمینهٔ متحرک</legend>
            <div role="radiogroup" aria-label="پس‌زمینهٔ متحرک" className="flex flex-wrap gap-1.5">
              {(["none", ...SCENES] as (Scene | "none")[]).map((scene) => (
                <button
                  key={scene}
                  type="button"
                  role="radio"
                  aria-checked={theme.scene === scene}
                  onClick={() => update({ scene })}
                  className={cx(
                    "rounded-full border px-3 py-1 text-sm transition-colors",
                    theme.scene === scene ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-fg",
                  )}
                >
                  {SCENE_LABELS[scene]}
                </button>
              ))}
            </div>
          </fieldset>

          {theme.scene !== "none" && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">شدت حرکت</legend>
              <div role="radiogroup" aria-label="شدت حرکت" className="flex gap-1 rounded-xl bg-surface-2 p-1 text-sm">
                {INTENSITIES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={theme.intensity === n}
                    onClick={() => update({ intensity: n })}
                    className={cx(
                      "flex-1 rounded-lg px-3 py-1 font-medium transition-colors",
                      theme.intensity === n ? "bg-surface text-accent shadow-sm" : "text-muted hover:text-fg",
                    )}
                  >
                    {INTENSITY_LABELS[n]}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
        </div>

        {/* live preview, only here: the page itself doesn't change until saved */}
        <div
          aria-label="پیش‌نمایش"
          className="relative isolate h-64 overflow-hidden rounded-2xl border border-line bg-bg"
          style={
            {
              "--accent": palette.accent,
              "--accent-soft": palette.soft,
              "--accent-fg": palette.fg,
              "--scene-1": palette.accent,
            } as React.CSSProperties
          }
        >
          {theme.scene !== "none" && <SceneLayer key={`${theme.scene}-${theme.intensity}`} scene={theme.scene} level={theme.intensity} contained />}
          <div className="absolute inset-x-3 top-3 space-y-2 rounded-xl border border-line bg-surface-solid p-3 shadow-sm">
            <p className="text-sm font-bold">{name || "پیش‌نمایش"}</p>
            <ProgressBar value={68} label="نمونهٔ پیشرفت" />
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">#درس</span>
              <span className={cx(buttonClass.primary, "px-3 py-1 text-xs")}>افزودن کار</span>
            </div>
            <p className="text-xs font-semibold text-accent">مدیریت کارها ←</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!name} onClick={() => onSave({ ...theme, name }, true)} className={buttonClass.primary}>
          ذخیره و استفاده
        </button>
        <button type="button" disabled={!name} onClick={() => onSave({ ...theme, name }, false)} className={buttonClass.secondary}>
          فقط ذخیره
        </button>
        <button type="button" onClick={onCancel} className={buttonClass.ghost}>
          انصراف
        </button>
      </div>
    </section>
  );
}
