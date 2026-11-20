import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fapshiOutcome, fapshiProvider } from "../src/lib/payments/providers/fapshi";
import { processWebhook, type WebhookStore } from "../src/lib/payments/webhook-processor";

// ─── Mocked Fapshi API (fetch) ─────────────────────────────────────────
type Tx = { transId: string; status: string; amount: number; externalId: string };
let fapshiTx: Record<string, Tx> = {};
let calls: { url: string; init?: RequestInit }[] = [];
globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
  const u = String(url);
  calls.push({ url: u, init });
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (u.endsWith("/initiate-pay")) return json(200, { message: "Request successful", link: "https://checkout.fapshi.com/payment/abc", transId: "ll7J2fl4", dateInitiated: "2026-11-20T10:00:00Z" });
  const m = u.match(/\/payment-status\/(.+)$/);
  if (m) return fapshiTx[m[1]] ? json(200, fapshiTx[m[1]]) : json(404, { message: "not found" });
  if (u.endsWith("/expire-pay")) return json(400, { message: "Link already expired" });
  return json(500, {});
}) as typeof fetch;

beforeEach(() => {
  process.env.FAPSHI_API_USER = "user";
  process.env.FAPSHI_API_KEY = "key";
  process.env.FAPSHI_ENV = "sandbox";
  process.env.FAPSHI_WEBHOOK_SECRET = "wh-secret";
  fapshiTx = {};
  calls = [];
});

function memoryStore(expected = { ref: "PAY-1", amount: 15000 }) {
  const events = new Set<string>();
  const done = new Set<string>();
  const out = { confirmed: 0, failed: [] as string[], lastConfirm: null as null | { amount: number; currency: string; paymentReference: string } };
  const store: WebhookStore = {
    async insertEvent(r) {
      const k = `${r.provider}:${r.eventId}`;
      if (events.has(k)) return false;
      events.add(k);
      return true;
    },
    async isProcessed(p, id) {
      return done.has(`${p}:${id}`);
    },
    async markProcessed(p, id, error) {
      if (!error) done.add(`${p}:${id}`);
    },
    async confirmPayment(a) {
      out.lastConfirm = a;
      if (a.paymentReference !== expected.ref) throw new Error("payment_not_found");
      if (a.amount !== expected.amount) return { result: "amount_mismatch" };
      out.confirmed++;
      return { result: out.confirmed === 1 ? "processed" : "already_processed", booking_id: "b1" };
    },
    async failPayment(_ref, status) {
      out.failed.push(status);
    },
  };
  return { store, out };
}

const hook = (body: unknown, secret = "wh-secret") =>
  [JSON.stringify(body), new Headers(secret ? { "x-wh-secret": secret } : {})] as const;

test("fapshi: statuses map to outcomes", () => {
  assert.equal(fapshiOutcome("SUCCESSFUL"), "succeeded");
  assert.equal(fapshiOutcome("FAILED"), "failed");
  assert.equal(fapshiOutcome("EXPIRED"), "cancelled");
  assert.equal(fapshiOutcome("CREATED"), "pending");
  assert.equal(fapshiOutcome("PENDING"), "pending");
  assert.equal(fapshiOutcome("WHATEVER"), "ignored");
});

test("fapshi: initiate-pay sends auth headers, integer XAF amount and our references", async () => {
  const s = await fapshiProvider.createCheckout({
    paymentReference: "PAY-ABC-123", bookingReference: "GLB-123456-ABCDEF", amount: 15000, currency: "XAF",
    description: "MonProjet GLB-123456-ABCDEF - Consultation", customer: { name: "A", email: "a@example.com" },
    successUrl: "https://site/booking/confirmation?ref=GLB-123456-ABCDEF", cancelUrl: "https://site/x", notifyUrl: "https://site/n", expiresAt: new Date(),
  });
  assert.equal(s.redirectUrl, "https://checkout.fapshi.com/payment/abc");
  assert.equal(s.providerReference, "ll7J2fl4");
  assert.equal(s.isLive, false);
  const c = calls[0];
  assert.equal(c.url, "https://sandbox.fapshi.com/initiate-pay");
  const h = c.init!.headers as Record<string, string>;
  assert.equal(h.apiuser, "user");
  assert.equal(h.apikey, "key");
  const body = JSON.parse(String(c.init!.body));
  assert.deepEqual([body.amount, body.externalId, body.userId], [15000, "PAY-ABC-123", "GLB-123456-ABCDEF"]);
});

test("fapshi: refuses non-XAF, decimals and amounts under 100", async () => {
  const base = { paymentReference: "P", bookingReference: "B", description: "d", customer: { name: "a", email: "" }, successUrl: "", cancelUrl: "", notifyUrl: "", expiresAt: new Date() };
  await assert.rejects(fapshiProvider.createCheckout({ ...base, amount: 15, currency: "EUR" }));
  await assert.rejects(fapshiProvider.createCheckout({ ...base, amount: 99, currency: "XAF" }));
  await assert.rejects(fapshiProvider.createCheckout({ ...base, amount: 150.5, currency: "XAF" }));
  assert.equal(calls.length, 0);
});

test("fapshi: live env uses the live base URL", async () => {
  process.env.FAPSHI_ENV = "live";
  fapshiTx.T1 = { transId: "T1", status: "SUCCESSFUL", amount: 15000, externalId: "PAY-1" };
  const v = await fapshiProvider.checkStatus!("T1");
  assert.ok(calls[0].url.startsWith("https://live.fapshi.com/payment-status/"));
  assert.equal(v.isLive, true);
});

test("fapshi webhook: confirms only after re-reading the status from Fapshi", async () => {
  fapshiTx.T1 = { transId: "T1", status: "SUCCESSFUL", amount: 15000, externalId: "PAY-1" };
  const { store, out } = memoryStore();
  const r = await processWebhook(fapshiProvider, ...hook({ transId: "T1", status: "SUCCESSFUL", amount: 15000, externalId: "PAY-1" }), store);
  assert.equal(r.status, 200);
  assert.equal(out.confirmed, 1);
  assert.ok(calls.some((c) => c.url.endsWith("/payment-status/T1")));
});

test("fapshi webhook: a forged body cannot override the real status or amount", async () => {
  fapshiTx.T1 = { transId: "T1", status: "PENDING", amount: 15000, externalId: "PAY-1" };
  const { store, out } = memoryStore();
  await processWebhook(fapshiProvider, ...hook({ transId: "T1", status: "SUCCESSFUL", amount: 15000, externalId: "PAY-1" }), store);
  assert.equal(out.confirmed, 0);
  assert.deepEqual(out.failed, ["processing"]);

  fapshiTx.T2 = { transId: "T2", status: "SUCCESSFUL", amount: 100, externalId: "PAY-1" };
  const r = await processWebhook(fapshiProvider, ...hook({ transId: "T2", status: "SUCCESSFUL", amount: 15000 }), store);
  assert.equal(r.body.result, "amount_mismatch");
  assert.equal(out.lastConfirm!.amount, 100); // the amount comes from Fapshi, not from the webhook body
});

test("fapshi webhook: wrong/missing secret and unknown transactions are rejected", async () => {
  fapshiTx.T1 = { transId: "T1", status: "SUCCESSFUL", amount: 15000, externalId: "PAY-1" };
  const { store, out } = memoryStore();
  assert.equal((await processWebhook(fapshiProvider, ...hook({ transId: "T1" }, "nope"), store)).status, 400);
  assert.equal((await processWebhook(fapshiProvider, ...hook({ transId: "T1" }, ""), store)).status, 400);
  assert.equal((await processWebhook(fapshiProvider, ...hook({ transId: "UNKNOWN" }), store)).status, 400);
  assert.equal((await processWebhook(fapshiProvider, "not json", new Headers({ "x-wh-secret": "wh-secret" }), store)).status, 400);
  assert.equal(out.confirmed, 0);
});

test("fapshi webhook: replaying the same notification is idempotent", async () => {
  fapshiTx.T1 = { transId: "T1", status: "SUCCESSFUL", amount: 15000, externalId: "PAY-1" };
  const { store, out } = memoryStore();
  await processWebhook(fapshiProvider, ...hook({ transId: "T1" }), store);
  const again = await processWebhook(fapshiProvider, ...hook({ transId: "T1" }), store);
  assert.equal(again.body.duplicate, true);
  assert.equal(out.confirmed, 1);
});

test("fapshi: expire tolerates an already-expired link", async () => {
  await fapshiProvider.expire!("T1");
  assert.ok(calls[0].url.endsWith("/expire-pay"));
});
