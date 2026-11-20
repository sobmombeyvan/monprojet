import { test } from "node:test";
import assert from "node:assert/strict";
import { hmacSha256Hex, signTimestamped, verifyTimestampedSignature } from "../src/lib/payments/crypto";
import { buildSandboxEvent, sandboxProvider, SANDBOX_SIGNATURE_HEADER } from "../src/lib/payments/providers/sandbox";
import { processWebhook, type WebhookStore } from "../src/lib/payments/webhook-processor";
import { fromMinorUnits, toMinorUnits } from "../src/lib/payments/types";

process.env.SANDBOX_WEBHOOK_SECRET = "test-secret";
process.env.APP_ENV = "development";

// ─── In-memory store mimicking the database guarantees ──────────────
function memoryStore() {
  const events = new Map<string, { processed: boolean; error?: string; signatureValid: boolean }>();
  const payments = new Map([["PAY-1", { amount: 10000, currency: "XAF", status: "pending" }]]);
  const calls = { confirm: 0, fail: 0 };
  const store: WebhookStore = {
    async insertEvent(r) {
      const k = `${r.provider}:${r.eventId}`;
      if (events.has(k)) return false;
      events.set(k, { processed: false, signatureValid: r.signatureValid });
      return true;
    },
    async isProcessed(p, id) {
      const e = events.get(`${p}:${id}`);
      return !!e?.processed && !e.error;
    },
    async markProcessed(p, id, error) {
      const e = events.get(`${p}:${id}`)!;
      e.processed = !error;
      e.error = error;
    },
    async confirmPayment(a) {
      calls.confirm++;
      const p = payments.get(a.paymentReference);
      if (!p) throw new Error("payment_not_found");
      if (p.status === "successful") return { result: "already_processed" };
      if (p.amount !== a.amount || p.currency !== a.currency) {
        p.status = "failed";
        return { result: "amount_mismatch" };
      }
      p.status = "successful";
      return { result: "processed", booking_status: "confirmed", booking_id: "b1" };
    },
    async failPayment() {
      calls.fail++;
    },
  };
  return { store, events, payments, calls };
}

function sandboxRequest(type: "payment.succeeded" | "payment.failed", amount = 10000) {
  const { body, signature } = buildSandboxEvent({
    type, paymentReference: "PAY-1", providerReference: "sbx_1", amount, currency: "XAF",
  });
  return { body, headers: new Headers({ [SANDBOX_SIGNATURE_HEADER]: signature }) };
}

test("minor units: XAF is zero-decimal, EUR/USD use cents", () => {
  assert.equal(toMinorUnits(10000, "XAF"), 10000);
  assert.equal(toMinorUnits(15.5, "EUR"), 1550);
  assert.equal(fromMinorUnits(1999, "USD"), 19.99);
});

test("timestamped signature: valid, tampered body, wrong secret, replay", () => {
  const body = '{"a":1}';
  const now = 1_700_000_000;
  const header = signTimestamped(body, "s", now);
  assert.ok(verifyTimestampedSignature(body, header, "s", 300, now));
  assert.ok(!verifyTimestampedSignature('{"a":2}', header, "s", 300, now), "tampered body");
  assert.ok(!verifyTimestampedSignature(body, header, "other", 300, now), "wrong secret");
  assert.ok(!verifyTimestampedSignature(body, header, "s", 300, now + 301), "replay outside tolerance");
  assert.ok(!verifyTimestampedSignature(body, null, "s", 300, now), "missing header");
});

test("sandbox provider is disabled in production", () => {
  process.env.APP_ENV = "production";
  assert.equal(sandboxProvider.isConfigured(), false);
  process.env.APP_ENV = "development";
  assert.equal(sandboxProvider.isConfigured(), true);
});

test("webhook: valid event confirms payment exactly once (idempotency)", async () => {
  const m = memoryStore();
  const req = sandboxRequest("payment.succeeded");
  const r1 = await processWebhook(sandboxProvider, req.body, req.headers, m.store);
  assert.equal(r1.status, 200);
  assert.equal(r1.body.result, "processed");
  const r2 = await processWebhook(sandboxProvider, req.body, req.headers, m.store);
  assert.equal(r2.status, 200);
  assert.equal(r2.body.duplicate, true);
  assert.equal(m.calls.confirm, 1, "duplicate delivery must not re-run confirmation");
  assert.equal(m.payments.get("PAY-1")!.status, "successful");
});

test("webhook: forged signature is rejected and logged as invalid", async () => {
  const m = memoryStore();
  const req = sandboxRequest("payment.succeeded");
  const forged = req.body.replace('"amount":10000', '"amount":1');
  const r = await processWebhook(sandboxProvider, forged, req.headers, m.store);
  assert.equal(r.status, 400);
  assert.equal(m.calls.confirm, 0);
  assert.equal([...m.events.values()][0].signatureValid, false);
});

test("webhook: amount mismatch from provider never confirms", async () => {
  const m = memoryStore();
  const req = sandboxRequest("payment.succeeded", 500);
  const r = await processWebhook(sandboxProvider, req.body, req.headers, m.store);
  assert.equal(r.body.result, "amount_mismatch");
  assert.equal(m.payments.get("PAY-1")!.status, "failed");
});

test("webhook: failed payment goes to failPayment, not confirm", async () => {
  const m = memoryStore();
  const req = sandboxRequest("payment.failed");
  await processWebhook(sandboxProvider, req.body, req.headers, m.store);
  assert.equal(m.calls.fail, 1);
  assert.equal(m.calls.confirm, 0);
});

test("webhook: transient error returns 500 and the retry is processed", async () => {
  const m = memoryStore();
  let fail = true;
  const original = m.store.confirmPayment;
  m.store.confirmPayment = async (a) => {
    if (fail) { fail = false; throw new Error("db down"); }
    return original(a);
  };
  const req = sandboxRequest("payment.succeeded");
  assert.equal((await processWebhook(sandboxProvider, req.body, req.headers, m.store)).status, 500);
  const retry = await processWebhook(sandboxProvider, req.body, req.headers, m.store);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.result, "processed");
});
