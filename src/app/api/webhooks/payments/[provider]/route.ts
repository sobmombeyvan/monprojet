import { NextResponse } from "next/server";
import { getProvider } from "@/lib/payments";
import { supabaseWebhookStore } from "@/lib/payments/service";
import { processWebhook } from "@/lib/payments/webhook-processor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/payments/:provider
 * Server-to-server notifications. The raw body is read as text so the
 * signature can be verified byte-for-byte before anything is parsed.
 */
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = await params;
  const provider = getProvider(providerId);
  if (!provider) return NextResponse.json({ error: "unknown_provider" }, { status: 404 });
  if (provider.id === "sandbox" && process.env.APP_ENV === "production") {
    return NextResponse.json({ error: "sandbox_disabled" }, { status: 403 });
  }

  const rawBody = await request.text();
  if (rawBody.length > 256 * 1024) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });

  try {
    const result = await processWebhook(provider, rawBody, request.headers, supabaseWebhookStore());
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error(`[webhook:${providerId}]`, e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
