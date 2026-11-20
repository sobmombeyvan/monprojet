import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formula injection and quote
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** GET /api/admin/export?type=payments|bookings&from=YYYY-MM-DD&to=YYYY-MM-DD — admin-only CSV. */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(request.url);
  const type = url.searchParams.get("type") === "bookings" ? "bookings" : "payments";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const supabase = await createClient();

  const cols =
    type === "payments"
      ? ["reference", "provider", "provider_reference", "amount", "currency", "status", "platform_commission", "consultant_earnings", "is_live", "paid_at", "created_at"]
      : ["reference", "status", "starts_at", "price", "currency", "client_full_name", "client_email", "method", "created_at"];
  let q = supabase.from(type).select(cols.join(",")).order("created_at", { ascending: false }).limit(10000);
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) q = q.gte("created_at", from);
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) q = q.lte("created_at", `${to}T23:59:59`);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lines = [cols.join(","), ...((data ?? []) as unknown as Record<string, unknown>[]).map((r) => cols.map((c) => csvCell(r[c])).join(","))];
  return new NextResponse("﻿" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="export-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
