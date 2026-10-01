import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "../database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

// Pages anyone can open without signing in.
const PUBLIC_PATHS = ["/login", "/signup", "/auth"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Refreshes the Supabase session cookies on every request and sends signed-out
// visitors of app pages to /login (and signed-in ones away from /login, /signup).
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Don't put code between createServerClient and getUser(): getUser() is what
  // validates and refreshes the session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // keep any refreshed session cookies
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  if (!user && !isPublic(pathname)) return redirectTo("/login");
  if (user && (pathname === "/login" || pathname === "/signup")) return redirectTo("/");

  return response;
}
