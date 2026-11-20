import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPendingNotificationEmails } from "@/lib/email";
import { getProvider, providerForCurrency, type Currency } from "./index";
import { applyVerifiedEvent, type WebhookStore } from "./webhook-processor";
import { site } from "@/config/site";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function newPaymentReference() {
  return `PAY-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/**
 * Starts a checkout for a held booking. Amount and currency come from the
 * database row, never from the browser.
 */
export async function startCheckout(params: { bookingId: string; userId: string; locale: string }) {
  const db = createAdminClient();
  const { data: booking, error } = await db
    .from("bookings")
    .select("id, reference, client_id, status, hold_expires_at, price, currency, client_full_name, client_email, client_phone, services(name_fr, name_en)")
    .eq("id", params.bookingId)
    .single();
  if (error || !booking) throw new Error("booking_not_found");
  if (booking.client_id !== params.userId) throw new Error("forbidden");
  if (booking.status !== "pending_payment" || new Date(booking.hold_expires_at) <= new Date()) {
    throw new Error("hold_expired");
  }

  const currency = booking.currency as Currency;
  const provider = providerForCurrency(currency);
  const reference = newPaymentReference();
  const prefix = params.locale === "en" ? "/en" : "";

  const { error: insertError } = await db.from("payments").insert({
    reference,
    booking_id: booking.id,
    client_id: booking.client_id,
    provider: provider.id,
    amount: booking.price,
    currency,
  });
  if (insertError) throw new Error("payment_init_failed");

  const service = booking.services as unknown as { name_fr: string; name_en: string } | null;
  const session = await provider.createCheckout({
    paymentReference: reference,
    bookingReference: booking.reference,
    amount: Number(booking.price),
    currency,
    description: `${site.name} ${booking.reference} - ${(params.locale === "en" ? service?.name_en : service?.name_fr) ?? "Consultation"}`,
    customer: { name: booking.client_full_name, email: booking.client_email, phone: booking.client_phone },
    successUrl: `${siteUrl()}${prefix}/booking/confirmation?ref=${booking.reference}`,
    cancelUrl: `${siteUrl()}${prefix}/booking/${booking.reference}?payment=cancelled`,
    notifyUrl: `${siteUrl()}/api/webhooks/payments/${provider.id}`,
    expiresAt: new Date(booking.hold_expires_at),
  });

  await db
    .from("payments")
    .update({ provider_reference: session.providerReference, is_live: session.isLive })
    .eq("reference", reference);

  return { redirectUrl: session.redirectUrl, paymentReference: reference, provider: provider.id, isLive: session.isLive };
}

/** Supabase implementation of the webhook persistence port. */
export function supabaseWebhookStore(): WebhookStore {
  const db = createAdminClient();
  return {
    async insertEvent(row) {
      const { error } = await db.from("payment_webhooks").insert({
        provider: row.provider,
        event_id: row.eventId,
        event_type: row.eventType,
        payment_reference: row.paymentReference,
        signature_valid: row.signatureValid,
        payload: row.payload as object,
      });
      if (error?.code === "23505") return false; // unique violation → duplicate
      if (error) throw error;
      return true;
    },
    async isProcessed(provider, eventId) {
      const { data } = await db
        .from("payment_webhooks")
        .select("processed_at, processing_error")
        .eq("provider", provider)
        .eq("event_id", eventId)
        .single();
      return !!data?.processed_at && !data.processing_error;
    },
    async markProcessed(provider, eventId, error) {
      await db
        .from("payment_webhooks")
        .update(error ? { processing_error: error, processed_at: null } : { processed_at: new Date().toISOString(), processing_error: null })
        .eq("provider", provider)
        .eq("event_id", eventId);
    },
    async confirmPayment(a) {
      const { data, error } = await db.rpc("confirm_payment", {
        p_payment_reference: a.paymentReference,
        p_provider: a.provider,
        p_provider_reference: a.providerReference,
        p_amount: a.amount,
        p_currency: a.currency,
        p_is_live: a.isLive,
      });
      if (error) throw error;
      return data as { result: string; booking_status?: string; booking_id?: string };
    },
    async failPayment(ref, status, reason) {
      const { error } = await db.rpc("fail_payment", { p_payment_reference: ref, p_status: status, p_reason: reason });
      if (error) throw error;
    },
    async afterConfirmed() {
      await sendPendingNotificationEmails(20);
    },
  };
}

// ─── Reconciliation (providers that do not retry webhooks, e.g. Fapshi) ─────────
const lastCheck = new Map<string, number>();

/**
 * Re-checks pending payments directly with the provider and applies the verified result.
 * Also expires a still-unpaid checkout once the booking's slot hold is gone.
 * Called by the confirmation page poll (one booking) and the maintenance cron (all).
 */
export async function reconcilePendingPayments(opts: { bookingId?: string; limit?: number } = {}) {
  const db = createAdminClient();
  let q = db
    .from("payments")
    .select("reference, provider, provider_reference, status, bookings(status)")
    .in("status", ["pending", "processing"])
    .not("provider_reference", "is", null)
    .gte("created_at", new Date(Date.now() - 26 * 3600_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 25);
  if (opts.bookingId) q = q.eq("booking_id", opts.bookingId);
  const { data, error } = await q;
  if (error) throw error;

  const store = supabaseWebhookStore();
  const out = { checked: 0, succeeded: 0, expired: 0, errors: 0 };
  for (const p of data ?? []) {
    const provider = getProvider(p.provider);
    if (!provider?.checkStatus || !provider.isConfigured() || !p.provider_reference) continue;
    const key = `${p.provider}:${p.provider_reference}`;
    if (Date.now() - (lastCheck.get(key) ?? 0) < 12_000) continue; // Fapshi: max 6 status calls / min / transId
    lastCheck.set(key, Date.now());
    try {
      const event = await provider.checkStatus(p.provider_reference);
      out.checked++;
      await applyVerifiedEvent(provider, event, store);
      if (event.outcome === "succeeded") out.succeeded++;
      const bookingStatus = (p.bookings as unknown as { status: string } | null)?.status;
      if (event.outcome === "pending" && provider.expire && bookingStatus && bookingStatus !== "pending_payment") {
        await provider.expire(p.provider_reference);
        out.expired++;
      }
    } catch (e) {
      out.errors++;
      console.error(`[reconcile:${p.provider}] ${p.reference}`, e instanceof Error ? e.message : e);
    }
  }
  return out;
}
