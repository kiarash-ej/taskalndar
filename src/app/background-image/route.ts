import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { BACKGROUND_BUCKET } from "@/lib/background";
import { createClient } from "@/lib/supabase/server";

// Serves the signed-in user's background image from the private bucket at a
// stable URL (see backgroundImageUrl). The download runs with the user's own
// session, so storage RLS still limits it to their folder; the path check
// just answers 404 early instead of asking storage.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });

  const path = request.nextUrl.searchParams.get("v") ?? "";
  if (!path.startsWith(`${user.id}/`) || path.includes("..")) return new Response(null, { status: 404 });

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BACKGROUND_BUCKET).download(path);
  if (error || !data) return new Response(null, { status: 404 });

  return new Response(data, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      // a path is never reused for different content (random name per upload)
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
