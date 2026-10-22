import { customThemeCss, type CustomTheme, type Intensity } from "./custom-theme";
import { CUSTOM_PREFIX, parseSkin, SKIN_SCENE, type Scene } from "./skins";

// What the page needs to render the chosen look, from the skin cookie and the
// saved personal themes: the <html> attributes globals.css and the scene read,
// and for a personal theme its stylesheet.

export interface Appearance {
  // the skin cookie's value when it names something that exists, else null
  active: string | null;
  // <html data-skin>: a built-in skin's name, or "custom"
  skin: string | undefined;
  // <html data-scene> and data-intensity, read by the scene layer
  scene: Scene | undefined;
  intensity: Intensity;
  css: string | null;
}

export function resolveAppearance(skinValue: string | undefined, customs: CustomTheme[]): Appearance {
  const builtin = parseSkin(skinValue);
  if (builtin) return { active: builtin, skin: builtin, scene: SKIN_SCENE[builtin], intensity: 2, css: null };
  if (skinValue?.startsWith(CUSTOM_PREFIX)) {
    const theme = customs.find((t) => t.id === skinValue.slice(CUSTOM_PREFIX.length));
    if (theme) {
      return {
        active: skinValue,
        skin: "custom",
        scene: theme.scene === "none" ? undefined : theme.scene,
        intensity: theme.intensity,
        css: customThemeCss(theme),
      };
    }
  }
  return { active: null, skin: undefined, scene: undefined, intensity: 2, css: null };
}

export const CUSTOM_STYLE_ID = "custom-skin";
