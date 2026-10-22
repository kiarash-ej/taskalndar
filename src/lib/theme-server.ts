import "server-only";
import { cookies } from "next/headers";
import { resolveAppearance, type Appearance } from "./appearance";
import { CUSTOM_THEMES_COOKIE, parseCustomThemes, type CustomTheme } from "./custom-theme";
import { SKIN_COOKIE } from "./skins";
import { parseTheme, THEME_COOKIE, type Theme } from "./theme";

// The user's light/dark choice from their cookie ("system" when none).
export async function loadTheme(): Promise<Theme> {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}

// The chosen skin or personal theme, and the saved personal themes, from cookies.
export async function loadAppearance(): Promise<Appearance & { customs: CustomTheme[] }> {
  const jar = await cookies();
  const customs = parseCustomThemes(jar.get(CUSTOM_THEMES_COOKIE)?.value);
  return { ...resolveAppearance(jar.get(SKIN_COOKIE)?.value, customs), customs };
}
