import { WebhookVerificationError, type PaymentProvider, type VerifiedEvent } from "./types";

/** Persistence port — implemented with Supabase in service.ts, in-memory in tests. */
export interface WebhookStore {
  /** Inserts the event; returns false if (provider, eventId) already exists. */
  insertEvent(row: {
    provider: string;
    eventId: string;
    eventType: string | null;
    paymentReference: string | null;
    signatureValid: boolean;
    payload: unknown;
  }): Promise<boolean>;
  isProcessed(provider: string, eventId: string): Promise<boolean>;
  markProcessed(provider: string, eventId: string, error?: string): Promise<void>;
  confirmPayment(args: {
    paymentReference: string;
    provider: string;
    providerReference: string | null;
    amount: number;
    currency: string;
    isLive: boolean;
  }): Promise<{ result: string; booking_status?: string; booking_id?: string }>;
  failPayment(paymentReference: string, status: "failed" | "cancelled" | "processing", reason: string): Promise<void>;
  /** Called after a confirmation so emails go out without waiting for the cron */
  afterConfirmed?(bookingId: string): Promise<void>;
}

export interface WebhookResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Provider-agnostic webhook pipeline:
 *   verify signature → store raw event (idempotency key) → apply → mark processed.
 * Returns 2xx for duplicates so providers stop retrying; 4xx for forged events;
 * 5xx on transient errors so providers retry.
 */
export async function processWebhook(
  provider: PaymentProvider,
  rawBody: string,
  headers: Headers,
  store: WebhookStore,
): Promise<WebhookResult> {
  let event: VerifiedEvent;
  try {
    event = await provider.verifyWebhook(rawBody, headers);
  } catch (e) {
    if (e instanceof WebhookVerificationError) {
      await store.insertEvent({
        provider: provider.id,
        eventId: `invalid:${crypto.randomUUID()}`,
        eventType: null,
        paymentReference: null,
        signatureValid: false,
        payload: { raw: rawBody.slice(0, 10_000), reason: e.message },
      });
      return { status: 400, body: { error: "invalid_signature" } };
    }
    throw e;
  }

  return applyVerifiedEvent(provider, event, store);
}

/**
 * Applies an event whose authenticity is already established (verified webhook or a
 * server-to-server status check). Idempotent on (provider, eventId).
 */
export async function applyVerifiedEvent(provider: PaymentProvider, event: VerifiedEvent, store: WebhookStore): Promise<WebhookResult> {
  const inserted = await store.insertEvent({
    provider: provider.id,
    eventId: event.eventId,
    eventType: event.eventType,
    paymentReference: event.paymentReference,
    signatureValid: true,
    payload: event.raw,
  });
  if (!inserted && (await store.isProcessed(provider.id, event.eventId))) {
    return { status: 200, body: { received: true, duplicate: true } };
  }

  try {
    let result: Record<string, unknown> = { outcome: event.outcome };
    if (!event.paymentReference) {
      result = { outcome: "ignored", reason: "no_payment_reference" };
    } else if (event.outcome === "succeeded") {
      if (event.amount === undefined || !event.currency) throw new Error("verified event lacks amount/currency");
      const r = await store.confirmPayment({
        paymentReference: event.paymentReference,
        provider: provider.id,
        providerReference: event.providerReference,
        amount: event.amount,
        currency: event.currency,
        isLive: event.isLive,
      });
      result = { outcome: "succeeded", ...r };
      if (r.result === "processed" && r.booking_id && store.afterConfirmed) {
        await store.afterConfirmed(r.booking_id).catch(() => undefined); // emails are retried by the cron
      }
    } else if (event.outcome === "failed" || event.outcome === "cancelled") {
      await store.failPayment(event.paymentReference, event.outcome === "failed" ? "failed" : "cancelled", event.eventType);
    } else if (event.outcome === "pending") {
      await store.failPayment(event.paymentReference, "processing", event.eventType);
    }
    await store.markProcessed(provider.id, event.eventId);
    return { status: 200, body: { received: true, ...result } };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await store.markProcessed(provider.id, event.eventId, message).catch(() => undefined);
    return { status: 500, body: { error: "processing_failed" } };
  }
}
