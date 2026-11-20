import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

const query = z.object({
  consultantServiceId: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** GET /api/slots?consultantServiceId=…&from=YYYY-MM-DD&to=YYYY-MM-DD — public availability. */
export async function GET(request: Request) {
  const limited = await rateLimit(request, "slots", 60, 60);
  if (limited) return limited;
  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_available_slots", {
    p_consultant_service_id: parsed.data.consultantServiceId,
    p_from: parsed.data.from,
    p_to: parsed.data.to,
  });
  if (error) return NextResponse.json({ error: "unavailable" }, { status: 400 });
  return NextResponse.json({ slots: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
