import { randomUUID } from "node:crypto";
import { signTimestamped, verifyTimestampedSignature } from "../crypto";
import {
  isCurrency,
  PaymentConfigurationError,
  WebhookVerificationError,
  type PaymentProvider,
  type VerifiedEvent,
} from "../types";

/**
 * SANDBOX provider — for development and staging only.
 * It behaves like a real provider: the hosted "checkout" page triggers a
 * *signed* server-to-server webhook; the frontend never sets a payment status.
 * Refuses to run when APP_ENV=production.
 */
export const SANDBOX_SIGNATURE_HEADER = "x-sandbox-signature";

function secret() {
  const s = process.env.SANDBOX_WEBHOOK_SECRET;
  if (!s) throw new PaymentConfigurationError("SANDBOX_WEBHOOK_SECRET is not set");
  return s;
}

export const sandboxProvider: PaymentProvider = {
  id: "sandbox",
  label: "Sandbox (test)",
  supports: () => true,
  isConfigured: () => process.env.APP_ENV !== "production" && !!process.env.SANDBOX_WEBHOOK_SECRET,

  async createCheckout(input) {
    if (!this.isConfigured()) throw new PaymentConfigurationError("Sandbox payments are disabled in production");
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const url = new URL("/booking/sandbox-checkout", site);
    url.searchParams.set("payment", input.paymentReference);
    return { redirectUrl: url.toString(), providerReference: `sbx_${randomUUID()}`, isLive: false };
  },

  async verifyWebhook(rawBody, headers): Promise<VerifiedEvent> {
    if (!verifyTimestampedSignature(rawBody, headers.get(SANDBOX_SIGNATURE_HEADER), secret())) {
      throw new WebhookVerificationError("invalid sandbox signature");
    }
    const evt = JSON.parse(rawBody) as {
      id: string;
      type: "payment.succeeded" | "payment.failed" | "payment.cancelled";
      payment_reference: string;
      provider_reference: string | null;
      amount: number;
      currency: string;
    };
    if (!evt.id || !evt.payment_reference || !isCurrency(evt.currency)) {
      throw new WebhookVerificationError("malformed sandbox event");
    }
    return {
      eventId: evt.id,
      eventType: evt.type,
      paymentReference: evt.payment_reference,
      providerReference: evt.provider_reference,
      outcome: evt.type === "payment.succeeded" ? "succeeded" : evt.type === "payment.failed" ? "failed" : "cancelled",
      amount: Number(evt.amount),
      currency: evt.currency,
      isLive: false,
      raw: evt,
    };
  },
};

/** Builds a signed sandbox event (used by the sandbox checkout page and tests). */
export function buildSandboxEvent(input: {
  type: "payment.succeeded" | "payment.failed" | "payment.cancelled";
  paymentReference: string;
  providerReference: string | null;
  amount: number;
  currency: string;
}) {
  const body = JSON.stringify({
    id: `sbx_evt_${randomUUID()}`,
    type: input.type,
    payment_reference: input.paymentReference,
    provider_reference: input.providerReference,
    amount: input.amount,
    currency: input.currency,
  });
  return { body, signature: signTimestamped(body, secret()) };
}
