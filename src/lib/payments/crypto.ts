import { createHmac, timingSafeEqual } from "node:crypto";

export function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/** Constant-time comparison of two hex/utf8 strings. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Parses "t=123,v1=abc,v1=def" style signature headers (sandbox). */
export function parseSignatureHeader(header: string): { timestamp: number; signatures: string[] } {
  let timestamp = NaN;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=", 2).map((s) => s?.trim());
    if (k === "t") timestamp = Number(v);
    if (k === "v1" && v) signatures.push(v);
  }
  return { timestamp, signatures };
}

/**
 * Verifies a timestamped HMAC signature (`${t}.${body}`), rejecting replays older
 * than `toleranceSeconds`.
 */
export function verifyTimestampedSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300,
  now = Math.floor(Date.now() / 1000),
): boolean {
  if (!header) return false;
  const { timestamp, signatures } = parseSignatureHeader(header);
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(now - timestamp) > toleranceSeconds) return false;
  const expected = hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  return signatures.some((s) => safeEqual(s, expected));
}

export function signTimestamped(rawBody: string, secret: string, now = Math.floor(Date.now() / 1000)): string {
  return `t=${now},v1=${hmacSha256Hex(secret, `${now}.${rawBody}`)}`;
}
