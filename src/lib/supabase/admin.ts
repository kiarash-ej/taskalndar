import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { supabaseUrl } from "./env";

// The service-role client bypasses RLS: only for server jobs that act for no
// signed-in user (bot webhook, daily summary sender), and every query must
// filter by user_id itself. Never import this from client code.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient<Database>(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
