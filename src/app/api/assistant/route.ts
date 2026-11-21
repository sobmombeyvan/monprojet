import { NextResponse } from "next/server";
import { z } from "zod";
import { site } from "@/config/site";
import { getReferenceData } from "@/lib/data/queries";
import { rateLimit } from "@/lib/rate-limit";
import { formatPrice } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/assistant — floating chat assistant powered by Google Gemini.
 * The API key stays on the server; the answer is streamed back as plain text.
 * Conversations are not stored.
 */
const bodySchema = z.object({
  locale: z.enum(["fr", "en"]).default("fr"),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(20),
});

async function systemPrompt(locale: string) {
  const ref = await getReferenceData().catch(() => null);
  const services = (ref?.services ?? [])
    .map((s) => `- ${s.name_fr} / ${s.name_en}: ${s.pricing_type === "quote" ? "sur devis / on quote" : s.base_price !== null ? formatPrice(Number(s.base_price), s.currency, "fr") : "—"}`)
    .join("\n");
  const countries = (ref?.countries ?? []).filter((c) => c.slug !== "cameroon").map((c) => c.name_fr).join(", ");
  const specialties = (ref?.specialties ?? []).map((s) => s.name_fr).join(", ");
  const p = locale === "en" ? "/en" : "";
  return `You are the virtual assistant of ${site.name}, a platform that helps people (mostly from Cameroon and French-speaking Africa) with international mobility: studying, working, visiting or settling abroad, by giving reliable general information and connecting them with verified human experts.

LANGUAGE: reply in the SAME language as the user's latest message (English question → English answer, French question → French answer), whatever the website language. If the message has no clear language, use ${locale === "en" ? "English" : "French"}.
LENGTH: this is a small chat window. Be warm and to the point: 2–5 short sentences or a list of at most 5 short bullets, under 120 words. Give the key steps only, then offer to go deeper or to talk to an expert. Write longer only if the user explicitly asks for details.

WHAT THE PLATFORM OFFERS
Paid services (prices in FCFA / XAF, payment by MTN or Orange Mobile Money):
${services || "- Consultation avec un expert"}
Areas experts cover: ${specialties || "immigration, études à l'étranger, visas"}.
Destinations covered: ${countries || "Canada, France, Belgique, Allemagne…"}.
Consultations happen by video call, audio call or phone. Contact: ${site.contact.email}.

USEFUL LINKS (use these exact relative paths in Markdown links, e.g. [Trouver un expert](${p}/find-expert)):
- Find an expert: ${p}/find-expert
- Book a consultation: ${p}/booking
- Services and prices: ${p}/services
- Destination guides: ${p}/countries
- Articles / resources: ${p}/knowledge
- Personalised path: ${p}/solutions
- FAQ: ${p}/faq · Contact: ${p}/contact

STRICT RULES
- Give general, educational information only. Never present it as legal advice and never guarantee a visa, admission, permit or outcome.
- Immigration rules change: when you mention requirements, amounts or delays, say they must be checked on the official government website or with an expert, and recommend booking a consultation for a personal case.
- Never invent prices, experts, phone numbers or features that are not listed above.
- Do not ask for or store sensitive data (passport numbers, bank details, passwords). If the user shares some, tell them not to.
- Never help with fraud: fake documents, lying on applications, illegal entry or overstaying.
- Off-topic requests: politely say you can only help with studies, work, visas, travel and settling abroad, and with using ${site.name}.
- When the question needs a personal analysis (their file, their chances, a refusal), suggest talking to an expert with a link to ${p}/find-expert or ${p}/booking.`;
}

export async function POST(request: Request) {
  const limited = (await rateLimit(request, "assistant", 20, 600)) ?? (await rateLimit(request, "assistant-day", 150, 86_400));
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { locale, messages } = parsed.data;
  if (messages[messages.length - 1].role !== "user") return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const model = (process.env.GEMINI_MODEL || "gemini-2.5-flash").replace(/[^a-zA-Z0-9.\-]/g, "");

  const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: await systemPrompt(locale) }] },
      contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.text }] })),
      // flash models: skip "thinking" for fast chat answers (pro models do not allow disabling it)
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024, ...(/flash/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
    }),
    signal: request.signal,
  }).catch(() => null);

  if (!upstream?.ok || !upstream.body) {
    console.error("[assistant] Gemini error", upstream?.status, upstream ? (await upstream.text()).slice(0, 300) : "network");
    return NextResponse.json({ error: upstream?.status === 429 ? "busy" : "upstream_error" }, { status: 502 });
  }

  // Gemini SSE ("data: {json}") → plain text stream for the browser
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  const stream = upstream.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const json = JSON.parse(line.slice(5).trim()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
            const text = (json.candidates?.[0]?.content?.parts ?? []).filter((x) => !x.thought).map((x) => x.text ?? "").join("");
            if (text) controller.enqueue(encoder.encode(text));
          } catch {
            /* ignore keep-alive / partial lines */
          }
        }
      },
    }),
  );
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
