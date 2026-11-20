import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPendingNotificationEmails } from "@/lib/email";
import { safeEqual } from "@/lib/payments/crypto";
import { reconcilePendingPayments } from "@/lib/payments/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scheduled every 5 minutes (vercel.json or Supabase pg_cron → HTTP):
 *  - releases unpaid expired slot holds
 *  - re-checks pending payments with the provider (Fapshi does not retry webhooks)
 *  - sends queued notification emails
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || !safeEqual(auth, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = createAdminClient();
  const { data: released, error } = await db.rpc("release_expired_holds", {});
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const payments = await reconcilePendingPayments({ limit: 50 }).catch((e) => ({ error: String(e) }));
  const emailed = await sendPendingNotificationEmails(100);
  return NextResponse.json({ released, payments, emailed });
}
