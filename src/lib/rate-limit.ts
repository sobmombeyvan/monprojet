import { NextResponse } from "next/server";

/**
 * Fixed-window rate limiter.
 * - With UPSTASH_REDIS_REST_URL/TOKEN: shared across instances (production).
 * - Otherwise: in-memory per instance (development).
 */
const memory = new Map<string, { count: number; reset: number }>();

export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function hit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([["INCR", key], ["EXPIRE", key, String(windowSeconds), "NX"]]),
    });
    const [incr] = (await res.json()) as { result: number }[];
    return Number(incr?.result ?? 0) <= limit;
  }
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.reset < now) {
    memory.set(key, { count: 1, reset: now + windowSeconds * 1000 });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

/** Returns a 429 response when the limit is exceeded, otherwise null. */
export async function rateLimit(request: Request, bucket: string, limit: number, windowSeconds: number) {
  const ok = await hit(`rl:${bucket}:${clientIp(request)}`, limit, windowSeconds);
  return ok ? null : NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(windowSeconds) } });
}
