import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callIsOpen, callUrl, type CallMode } from "@/lib/video";

/**
 * GET /booking/:reference/call?mode=video|audio
 * Lets only the booking's client, its consultant (or an admin — RLS decides) into the call room.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string; reference: string }> }) {
  const { locale, reference } = await params;
  const prefix = locale === "en" ? "/en" : "";
  const back = (q = "") => NextResponse.redirect(new URL(`${prefix}/booking/${encodeURIComponent(reference)}${q}`, request.url));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const login = new URL(`${prefix}/login`, request.url);
    login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }

  // RLS: returns the booking only to its client, its consultant or an admin
  const { data: b } = await supabase
    .from("bookings")
    .select("id, status, method, ends_at, meeting_url, client_id, client_full_name, consultants(professional_name, user_id)")
    .eq("reference", reference)
    .maybeSingle();
  if (!b) return back();
  if (!callIsOpen(b)) return back("?error=callClosed");

  const mode: CallMode = request.nextUrl.searchParams.get("mode") === "audio" ? "audio" : "video";
  // A consultant's own meeting link (Zoom, Meet…) takes priority for video
  if (mode === "video" && b.meeting_url) return NextResponse.redirect(b.meeting_url);

  const consultant = b.consultants as unknown as { professional_name: string; user_id: string } | null;
  const name = b.client_id === user.id ? b.client_full_name : consultant?.user_id === user.id ? consultant.professional_name : undefined;
  return NextResponse.redirect(callUrl(b.id, mode, name ?? undefined, `Consultation ${reference}`));
}
