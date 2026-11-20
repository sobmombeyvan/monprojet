import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intl = createIntlMiddleware(routing);

/** Route prefixes (without locale) that require a signed-in user. Role checks happen server-side in layouts. */
const PROTECTED = ["/dashboard", "/consultant", "/admin", "/booking"];

function stripLocale(pathname: string) {
  const seg = pathname.split("/")[1];
  return (routing.locales as readonly string[]).includes(seg)
    ? pathname.slice(seg.length + 1) || "/"
    : pathname;
}

export async function middleware(request: NextRequest) {
  const response = intl(request);
  const { user, response: res } = await updateSession(request, response);

  const path = stripLocale(request.nextUrl.pathname);
  // /booking/confirmation is reached after a provider redirect: still requires auth
  if (PROTECTED.some((p) => path === p || path.startsWith(p + "/")) && !user) {
    const url = request.nextUrl.clone();
    const seg = request.nextUrl.pathname.split("/")[1];
    const prefix = seg === "en" ? "/en" : "";
    url.pathname = `${prefix}/login`;
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  // Skip API routes, Next internals and static files
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
