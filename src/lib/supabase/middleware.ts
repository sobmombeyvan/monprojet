import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

/** Refreshes the Supabase auth cookie on every request and returns the current user. */
export async function updateSession(request: NextRequest, response: NextResponse) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies: { name: string; value: string; options: CookieOptions }[]) => {
          cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  // getClaims() refreshes an expired session and verifies the JWT signature locally with the
  // project's asymmetric key (no network round-trip per request; never trust getSession() alone)
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ? { id: data.claims.sub } : null;
  return { user, response };
}
