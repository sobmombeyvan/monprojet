"use server";
import { reconcilePendingPayments } from "@/lib/payments/service";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { PaymentConfigurationError } from "@/lib/payments/types";
import { startCheckout } from "@/lib/payments/service";
import { buildSandboxEvent, SANDBOX_SIGNATURE_HEADER } from "@/lib/payments/providers/sandbox";
import { bookingClientSchema, quoteRequestSchema } from "@/lib/validation/schemas";

const KNOWN_ERRORS = [
  "slot_unavailable", "outside_availability", "too_late_to_book", "too_many_pending_holds",
  "cannot_book_self", "service_unavailable", "method_unavailable", "consultant_unavailable", "hold_expired",
];
const mapError = (msg?: string) => (msg && KNOWN_ERRORS.find((k) => msg.includes(k))) || "generic";

/** Step 3 → creates a temporary hold (atomic, double-booking-proof in SQL). */
export async function createBookingHoldAction(input: unknown): Promise<{ reference?: string; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "unauthorized" };
  const parsed = bookingClientSchema.safeParse(input);
  if (!parsed.success) return { error: "generic" };
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_booking_hold", {
    p_consultant_service_id: d.consultantServiceId,
    p_starts_at: d.startsAt,
    p_method: d.method,
    p_full_name: d.fullName,
    p_email: d.email,
    p_phone: d.phone,
    p_country_of_residence: d.countryOfResidence.toUpperCase(),
    p_destination_country_id: d.destinationCountryId || null,
    p_procedure_type: d.procedureType || null,
    p_project_description: d.description || null,
  });
  if (error) return { error: mapError(error.message) };
  const row = (Array.isArray(data) ? data[0] : data) as { reference: string } | undefined;
  return row ? { reference: row.reference } : { error: "generic" };
}

/** Summary page → redirect to the payment provider. Amount comes from the DB. */
export async function payBookingAction(form: FormData) {
  const user = await getSessionUser();
  const locale = await getLocale();
  const prefix = locale === "en" ? "/en" : "";
  const bookingId = z.string().uuid().parse(form.get("bookingId"));
  const reference = String(form.get("reference") ?? "");
  if (!user) redirect(`${prefix}/login`);
  let url: string;
  try {
    ({ redirectUrl: url } = await startCheckout({ bookingId, userId: user.id, locale }));
  } catch (e) {
    const code = e instanceof PaymentConfigurationError ? "payment_unavailable" : mapError((e as Error).message);
    redirect(`${prefix}/booking/${reference}?error=${code}`);
  }
  redirect(url);
}

export async function cancelBookingAction(form: FormData) {
  const bookingId = z.string().uuid().parse(form.get("bookingId"));
  const reason = String(form.get("reason") ?? "").slice(0, 500) || null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_booking", { p_booking_id: bookingId, p_reason: reason });
  if (error) throw new Error(mapError(error.message));
  revalidatePath("/[locale]/dashboard/bookings", "page");
  revalidatePath("/[locale]/consultant/bookings", "page");
}

/** Polled by the confirmation page. RLS ensures users only read their own booking. */
export async function getBookingStatusAction(reference: string) {
  if (!/^GLB-\d{6}-[0-9A-F]{6}$/.test(reference)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("id, status, payments(status, created_at)")
    .eq("reference", reference)
    .maybeSingle();
  if (!data) return null; // RLS: only the booking owner gets here
  const latest = (d: typeof data) =>
    ((d.payments ?? []) as { status: string; created_at: string }[]).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.status ?? null;
  // Missed webhook? Ask the provider directly (throttled), then re-read.
  if (data.status === "pending_payment" && ["pending", "processing"].includes(latest(data) ?? "")) {
    const r = await reconcilePendingPayments({ bookingId: data.id, limit: 3 }).catch(() => null);
    if (r?.checked) {
      const { data: fresh } = await supabase.from("bookings").select("id, status, payments(status, created_at)").eq("id", data.id).maybeSingle();
      if (fresh) return { booking: fresh.status as string, payment: latest(fresh) };
    }
  }
  return { booking: data.status as string, payment: latest(data) };
}

/** Quote request for "Procedural assistance" (price upon quotation). */
export async function requestQuoteAction(input: unknown): Promise<{ ok?: boolean; reference?: string; error?: string }> {
  const parsed = quoteRequestSchema.safeParse(input);
  if (!parsed.success) return { error: "generic" };
  const user = await getSessionUser();
  if (!user) return { error: "unauthorized" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      user_id: user.id,
      kind: "support",
      subject: `Demande de devis — assistance procédurale${parsed.data.destination ? ` (${parsed.data.destination})` : ""}`,
      message: `${parsed.data.description}\n\n${parsed.data.fullName} · ${parsed.data.email} · ${parsed.data.phone}`,
    })
    .select("reference")
    .single();
  if (error) return { error: "generic" };
  return { ok: true, reference: data.reference };
}

/**
 * SANDBOX ONLY — simulates the provider calling our webhook.
 * The request goes server → our public webhook endpoint with a valid HMAC
 * signature, exercising exactly the same verification path as a real provider.
 */
export async function sandboxCompleteAction(form: FormData) {
  if (process.env.APP_ENV === "production") throw new Error("sandbox_disabled");
  const user = await getSessionUser();
  if (!user) throw new Error("unauthorized");
  const paymentRef = z.string().regex(/^PAY-[A-Z0-9-]+$/).parse(form.get("payment"));
  const outcome = z.enum(["succeeded", "failed"]).parse(form.get("outcome"));
  const db = createAdminClient();
  const { data: p } = await db
    .from("payments")
    .select("reference, provider_reference, amount, currency, client_id, provider, bookings(reference)")
    .eq("reference", paymentRef)
    .single();
  if (!p || p.client_id !== user.id || p.provider !== "sandbox") throw new Error("forbidden");

  const { body, signature } = buildSandboxEvent({
    type: outcome === "succeeded" ? "payment.succeeded" : "payment.failed",
    paymentReference: p.reference,
    providerReference: p.provider_reference,
    amount: Number(p.amount),
    currency: p.currency,
  });
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  await fetch(`${site}/api/webhooks/payments/sandbox`, {
    method: "POST",
    headers: { "Content-Type": "application/json", [SANDBOX_SIGNATURE_HEADER]: signature },
    body,
  });
  const locale = await getLocale();
  const bookingRef = (p.bookings as unknown as { reference: string }).reference;
  redirect(`${locale === "en" ? "/en" : ""}/booking/confirmation?ref=${bookingRef}`);
}
