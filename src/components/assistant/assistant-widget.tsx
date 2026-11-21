"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Sparkles, UserRound, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; text: string };

/** Minimal, safe Markdown: **bold**, [label](/relative-path) links and line breaks — no HTML injection. */
function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const nodes: React.ReactNode[] = [];
        const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((\/[^)\s]*)\)/g;
        let last = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(line))) {
          if (m.index > last) nodes.push(line.slice(last, m.index));
          if (m[1]) nodes.push(<strong key={m.index}>{m[1]}</strong>);
          else nodes.push(<Link key={m.index} href={m[3].replace(/^\/en(?=\/|$)/, "") || "/"} className="font-semibold text-teal-600 underline underline-offset-2">{m[2]}</Link>);
          last = m.index + m[0].length;
        }
        if (last < line.length) nodes.push(line.slice(last));
        const bullet = /^\s*[-*•]\s+/.test(line);
        return (
          <Fragment key={i}>
            {bullet ? <span className="flex gap-1.5"><span aria-hidden>•</span><span>{nodes.map((n, j) => (typeof n === "string" && j === 0 ? n.replace(/^\s*[-*•]\s+/, "") : n))}</span></span> : nodes}
            {i < lines.length - 1 && !bullet && <br />}
          </Fragment>
        );
      })}
    </>
  );
}

export function AssistantWidget() {
  const t = useTranslations("assistant");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const history: Msg[] = [...messages, { role: "user", text: q.slice(0, 2000) }];
    setMessages([...history, { role: "assistant", text: "" }]);
    setInput("");
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, messages: history.slice(-12) }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const code = res.status === 429 ? "rateLimited" : res.status === 503 ? "unavailable" : "error";
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", text: t(code) }]);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", text: acc }]);
      }
      if (!acc.trim()) setMessages((m) => [...m.slice(0, -1), { role: "assistant", text: t("error") }]);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMessages((m) => [...m.slice(0, -1), { role: "assistant", text: t("error") }]);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  const suggestions = [t("suggest1"), t("suggest2"), t("suggest3")];

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("open")}
          className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-navy py-3 pl-4 pr-5 text-sm font-semibold text-white shadow-(--shadow-lift) transition hover:bg-navy-700 sm:bottom-6 sm:right-6"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          <span className="relative">
            <MessageCircle className="size-5" />
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-teal ring-2 ring-navy" />
          </span>
          <span className="hidden sm:inline">{t("cta")}</span>
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label={t("title")}
          className="sheet fixed inset-0 z-[60] flex flex-col bg-white sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(640px,calc(100dvh-3rem))] sm:w-[400px] sm:rounded-2xl sm:border sm:border-line sm:shadow-(--shadow-lift)"
        >
          <header className="flex items-center gap-3 bg-navy px-4 py-3 text-white sm:rounded-t-2xl" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
            <span className="grid size-9 place-items-center rounded-full bg-teal"><Sparkles className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight">{t("title")}</p>
              <p className="text-xs text-white/70">{t("subtitle")}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={t("close")} className="grid size-9 place-items-center rounded-full hover:bg-white/10">
              <X className="size-5" />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto overscroll-contain bg-cloud px-4 py-4" aria-live="polite">
            <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-sm leading-6 text-ink shadow-(--shadow-card)">{t("greeting")}</div>
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-teal/40 bg-white px-3 py-1.5 text-left text-xs font-medium text-teal-600 hover:border-teal">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-6",
                    m.role === "user" ? "rounded-tr-sm bg-navy text-white" : "rounded-tl-sm bg-white text-ink shadow-(--shadow-card)",
                  )}
                >
                  {m.role === "assistant" && !m.text ? (
                    <span className="inline-flex gap-1 py-1" aria-label={t("typing")}>
                      <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-muted" />
                    </span>
                  ) : m.role === "assistant" ? (
                    <RichText text={m.text} />
                  ) : (
                    m.text
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-line bg-white px-3 pt-2" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <Link href="/find-expert" onClick={() => setOpen(false)} className="mb-2 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold text-teal-600 hover:bg-teal-50">
              <UserRound className="size-3.5" /> {t("talkToExpert")}
            </Link>
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex items-end gap-2 rounded-xl border border-line bg-white p-1.5 focus-within:border-navy"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                rows={1}
                maxLength={2000}
                placeholder={t("placeholder")}
                aria-label={t("placeholder")}
                className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] text-ink outline-none"
              />
              <button type="submit" disabled={busy || !input.trim()} aria-label={t("send")}
                className="grid size-10 shrink-0 place-items-center rounded-lg bg-teal text-white transition disabled:opacity-40">
                <Send className="size-4" />
              </button>
            </form>
            <p className="mt-1.5 text-center text-[11px] leading-4 text-muted">{t("disclaimer")}</p>
          </div>
        </section>
      )}
    </>
  );
}
