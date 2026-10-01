import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "../database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies. That's fine: src/proxy.ts
          // refreshes the session cookies before every request.
        }
      },
    },
  });
}
