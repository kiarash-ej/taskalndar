import "server-only";
import { cookies } from "next/headers";
import { parseSkin, SKIN_COOKIE, type Skin } from "./skins";
import { parseTheme, THEME_COOKIE, type Theme } from "./theme";

// The user's light/dark choice from their cookie ("system" when none).
export async function loadTheme(): Promise<Theme> {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}

// The user's special skin from their cookie (null: none chosen).
export async function loadSkin(): Promise<Skin | null> {
  return parseSkin((await cookies()).get(SKIN_COOKIE)?.value);
}
