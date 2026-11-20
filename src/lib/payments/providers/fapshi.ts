import { safeEqual } from "../crypto";
import {
  PaymentConfigurationError,
  WebhookVerificationError,
  type Currency,
  type PaymentOutcome,
  type PaymentProvider,
  type VerifiedEvent,
} from "../types";

/**
 * Fapshi — MTN Mobile Money & Orange Money in Cameroon (XAF only).
 * Docs: https://docs.fapshi.com/en
 *
 * Flow: POST /initiate-pay → customer pays on Fapshi's hosted page → redirect back to the site.
 * Security model: Fapshi webhooks are NOT signed (x-wh-secret is a static shared secret), so a
 * notification is never trusted on its own — the status, amount and externalId are always re-read
 * server-to-server with GET /payment-status/:transId. Fapshi does not retry webhooks, so the same
 * check also runs from the confirmation page and the maintenance cron (see reconcilePendingPayments).
 */
const BASE = { sandbox: "https://sandbox.fapshi.com", live: "https://live.fapshi.com" } as const;
const TRANS_ID = /^[A-Za-z0-9_-]{1,100}$/;
export const FAPSHI_MIN_AMOUNT = 100;

const isLive = () => process.env.FAPSHI_ENV === "live";
const base = () => BASE[isLive() ? "live" : "sandbox"];

function headers() {
  const apiuser = process.env.FAPSHI_API_USER;
  const apikey = process.env.FAPSHI_API_KEY;
  if (!apiuser || !apikey) throw new PaymentConfigurationError("FAPSHI_API_USER / FAPSHI_API_KEY are not set");
  return { apiuser, apikey, "Content-Type": "application/json" };
}

/** Fapshi ids (userId / externalId) accept only [a-zA-Z0-9-_], 1–100 chars. */
export const fapshiId = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 100);

export type FapshiStatus = "CREATED" | "PENDING" | "SUCCESSFUL" | "FAILED" | "EXPIRED";

export function fapshiOutcome(status: string | undefined): PaymentOutcome {
  switch (status) {
    case "SUCCESSFUL":
      return "succeeded";
    case "FAILED":
      return "failed"; // the customer may still retry on the same link; a later SUCCESSFUL still confirms
    case "EXPIRED":
      return "cancelled";
    case "CREATED":
    case "PENDING":
      return "pending";
    default:
      return "ignored";
  }
}

type FapshiTransaction = {
  transId?: string;
  status?: string;
  amount?: number;
  externalId?: string;
  financialTransId?: string;
  medium?: string;
  message?: string;
};

/** Authoritative, server-to-server status lookup. */
async function checkStatus(transId: string, context?: unknown): Promise<VerifiedEvent> {
  if (!TRANS_ID.test(transId)) throw new WebhookVerificationError("invalid transId");
  const res = await fetch(`${base()}/payment-status/${encodeURIComponent(transId)}`, { headers: headers(), cache: "no-store" });
  if (res.status === 404 || res.status === 400) throw new WebhookVerificationError(`unknown transaction (${res.status})`);
  if (!res.ok) throw new Error(`Fapshi payment-status failed: HTTP ${res.status}`);
  const tx = (await res.json()) as FapshiTransaction;
  if (tx.transId && tx.transId !== transId) throw new WebhookVerificationError("transId mismatch");
  const status = tx.status ?? "unknown";
  return {
    eventId: `${transId}:${status}`,
    eventType: `fapshi.${status}`,
    paymentReference: tx.externalId ?? null,
    providerReference: transId,
    outcome: fapshiOutcome(tx.status),
    amount: typeof tx.amount === "number" ? tx.amount : undefined,
    currency: "XAF",
    isLive: isLive(),
    raw: { check: tx, ...(context ? { notification: context } : {}) },
  };
}

export const fapshiProvider: PaymentProvider = {
  id: "fapshi",
  label: "Mobile Money (Fapshi — MTN / Orange)",
  supports: (c: Currency) => c === "XAF",
  isConfigured: () => !!process.env.FAPSHI_API_USER && !!process.env.FAPSHI_API_KEY,

  async createCheckout(input) {
    if (input.currency !== "XAF") throw new PaymentConfigurationError("Fapshi only accepts XAF");
    if (!Number.isInteger(input.amount) || input.amount < FAPSHI_MIN_AMOUNT) {
      throw new Error(`Fapshi requires a whole XAF amount of at least ${FAPSHI_MIN_AMOUNT}`);
    }
    const res = await fetch(`${base()}/initiate-pay`, {
      method: "POST",
      headers: headers(),
      cache: "no-store",
      body: JSON.stringify({
        amount: input.amount,
        email: input.customer.email || undefined,
        redirectUrl: input.successUrl,
        userId: fapshiId(input.bookingReference),
        externalId: fapshiId(input.paymentReference), // echoed back by payment-status → our payment row
        message: input.description.slice(0, 200),
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { message?: string; link?: string; transId?: string };
    if (!res.ok || !json.link || !json.transId) {
      throw new Error(`Fapshi initiate-pay failed: ${json.message ?? `HTTP ${res.status}`}`);
    }
    return { redirectUrl: json.link, providerReference: json.transId, isLive: isLive() };
  },

  async verifyWebhook(rawBody, hdrs) {
    const secret = process.env.FAPSHI_WEBHOOK_SECRET;
    if (secret && !safeEqual(hdrs.get("x-wh-secret") ?? "", secret)) {
      throw new WebhookVerificationError("invalid x-wh-secret");
    }
    let body: FapshiTransaction;
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new WebhookVerificationError("invalid JSON");
    }
    if (typeof body?.transId !== "string") throw new WebhookVerificationError("missing transId");
    // Never trust the notification body: re-read everything from Fapshi
    return checkStatus(body.transId, { transId: body.transId, status: body.status });
  },

  checkStatus: (providerReference) => checkStatus(providerReference),

  async expire(providerReference) {
    if (!TRANS_ID.test(providerReference)) return;
    const res = await fetch(`${base()}/expire-pay`, {
      method: "POST",
      headers: headers(),
      cache: "no-store",
      body: JSON.stringify({ transId: providerReference }),
    });
    // 400 "Link already expired" is fine
    if (!res.ok && res.status !== 400) throw new Error(`Fapshi expire-pay failed: HTTP ${res.status}`);
  },
};
