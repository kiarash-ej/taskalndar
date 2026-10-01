import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";

// Deduplicated per request: layouts and pages can all ask for the user.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
