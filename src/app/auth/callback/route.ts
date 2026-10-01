import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The link in Supabase's confirmation email lands here with a one-time `code`
// (PKCE), which is exchanged for a session cookie.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  // Behind Railway's proxy the request URL carries the internal host, so
  // prefer the host the browser actually used — but only when it matches
  // this service's own public domain. A client can set x-forwarded-host to
  // anything; trusting it unchecked would turn this into an open redirect
  // right after a successful login.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const publicHost = process.env.RAILWAY_PUBLIC_DOMAIN;
  const origin =
    forwardedHost && publicHost && forwardedHost === publicHost
      ? `https://${forwardedHost}`
      : request.nextUrl.origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }
  return NextResponse.redirect(`${origin}/login?error=confirm`);
}
