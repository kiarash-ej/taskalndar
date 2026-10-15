import { cache } from "react";
import { NO_BACKGROUND, parseBackground, type Background } from "./background";
import { createClient } from "./supabase/server";

export interface LoadedBackground {
  background: Background;
  // only for an "image" background: see backgroundImageUrl
  imageUrl: string | null;
}

// The app's own URL for a background image (src/app/background-image). Each
// upload gets a new random path, so the URL is stable for as long as that
// image is in use and the browser can cache it for good. A signed storage
// URL would change on every render, and every server action re-renders the
// layout, so each task tick would re-download the picture.
export function backgroundImageUrl(path: string): string {
  return `/background-image?v=${encodeURIComponent(path)}`;
}

// A missing profile row (or a failed query) just means "no custom background":
// the app must stay usable without it. Deduplicated per request.
export const loadBackground = cache(async (userId: string): Promise<LoadedBackground> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("background_kind, background_value")
    .eq("id", userId)
    .maybeSingle();
  const background = data ? parseBackground(data.background_kind, data.background_value) : NO_BACKGROUND;
  const imageUrl = background.kind === "image" && background.value ? backgroundImageUrl(background.value) : null;
  return { background, imageUrl };
});
