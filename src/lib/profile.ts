import { cache } from "react";
import {
  BACKGROUND_BUCKET,
  NO_BACKGROUND,
  parseBackground,
  type Background,
} from "./background";
import { createClient } from "./supabase/server";

const SIGNED_URL_SECONDS = 60 * 60;

export interface LoadedBackground {
  background: Background;
  // signed URL, only for an "image" background
  imageUrl: string | null;
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

  let imageUrl: string | null = null;
  if (background.kind === "image" && background.value) {
    const { data: signed } = await supabase.storage
      .from(BACKGROUND_BUCKET)
      .createSignedUrl(background.value, SIGNED_URL_SECONDS);
    imageUrl = signed?.signedUrl ?? null;
  }
  return { background, imageUrl };
});
