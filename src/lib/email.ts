import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { site } from "@/config/site";

/**
 * Email is a port: "console" logs in development, "resend" sends for real.
 * Swap providers by adding a case — callers never change.
 */
interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function send(msg: EmailMessage) {
  const provider = process.env.EMAIL_PROVIDER ?? "console";
  if (provider === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text }),
    });
    if (!res.ok) throw new Error(`email failed: ${res.status}`);
    return;
  }
  console.info(`[email:console] → ${msg.to} | ${msg.subject}\n${msg.text}`);
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function render(title: string, body: string, link: string | null) {
  const url = link ? new URL(link, process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").toString() : null;
  const html = `<!doctype html><html><body style="margin:0;background:#F3F6F9;font-family:Inter,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden">
    <tr><td style="background:#102B46;padding:20px 28px;color:#fff;font-weight:700;letter-spacing:.5px;font-size:18px">${escapeHtml(site.name)}</td></tr>
    <tr><td style="padding:28px;color:#102B46">
      <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1>
      <p style="font-size:15px;line-height:1.6;color:#334155">${escapeHtml(body)}</p>
      ${url ? `<p style="margin-top:24px"><a href="${url}" style="background:#25AFA5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Voir le détail</a></p>` : ""}
    </td></tr>
    <tr><td style="padding:16px 28px;font-size:12px;color:#64748b">${escapeHtml(site.tagline)}</td></tr>
  </table></td></tr></table></body></html>`;
  return { html, text: `${title}\n\n${body}${url ? `\n\n${url}` : ""}` };
}

/** Sends emails for notifications not yet emailed (called after webhooks and by the cron). */
export async function sendPendingNotificationEmails(limit = 50) {
  const db = createAdminClient();
  const { data: rows } = await db
    .from("notifications")
    .select("id, title, body, link, profiles(email)")
    .is("emailed_at", null)
    .order("created_at")
    .limit(limit);
  let sent = 0;
  for (const n of rows ?? []) {
    const email = (n.profiles as unknown as { email: string | null } | null)?.email;
    if (!email) continue;
    try {
      await send({ to: email, subject: `${site.name} — ${n.title}`, ...render(n.title, n.body ?? "", n.link) });
      await db.from("notifications").update({ emailed_at: new Date().toISOString() }).eq("id", n.id);
      sent++;
    } catch (e) {
      console.error("[email] failed", n.id, e);
    }
  }
  return sent;
}
