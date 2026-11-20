export type Currency = "XAF" | "EUR" | "USD";
export type ProviderId = "sandbox" | "fapshi";

export interface CheckoutInput {
  /** Our payment reference — sent to the provider and echoed back in webhooks */
  paymentReference: string;
  bookingReference: string;
  amount: number; // major units (10000 XAF, 15.50 EUR)
  currency: Currency;
  description: string;
  customer: { name: string; email: string; phone?: string };
  successUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  expiresAt: Date;
}

export interface CheckoutSession {
  redirectUrl: string;
  providerReference: string | null;
  isLive: boolean;
}

export type PaymentOutcome = "succeeded" | "failed" | "cancelled" | "pending" | "ignored";

/** A provider notification whose authenticity has been verified server-side. */
export interface VerifiedEvent {
  /** Unique per notification — used as idempotency key with the provider id */
  eventId: string;
  eventType: string;
  paymentReference: string | null;
  providerReference: string | null;
  outcome: PaymentOutcome;
  /** Amount/currency as reported by the provider (never by our frontend) */
  amount?: number;
  currency?: Currency;
  isLive: boolean;
  raw: unknown;
}

export interface PaymentProvider {
  id: ProviderId;
  label: string;
  supports(currency: Currency): boolean;
  isConfigured(): boolean;
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
  verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedEvent>;
  /** Optional: authoritative status lookup by provider reference (used to reconcile missed webhooks). */
  checkStatus?(providerReference: string): Promise<VerifiedEvent>;
  /** Optional: invalidates an unpaid checkout (e.g. once the slot hold has expired). */
  expire?(providerReference: string): Promise<void>;
}

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

export class PaymentConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentConfigurationError";
  }
}

/** Currencies without minor units (XAF has no decimals). */
const ZERO_DECIMAL: Currency[] = ["XAF"];

export function toMinorUnits(amount: number, currency: Currency): number {
  return ZERO_DECIMAL.includes(currency) ? Math.round(amount) : Math.round(amount * 100);
}

export function fromMinorUnits(amount: number, currency: Currency): number {
  return ZERO_DECIMAL.includes(currency) ? amount : amount / 100;
}

export function isCurrency(v: unknown): v is Currency {
  return v === "XAF" || v === "EUR" || v === "USD";
}
