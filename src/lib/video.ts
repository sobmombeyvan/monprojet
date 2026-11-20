import "server-only";
import { createHmac } from "node:crypto";
import { site } from "@/config/site";

/**
 * Audio / video call rooms for bookings — Jitsi Meet (free, no account or API key needed).
 * Each booking gets its own room whose name is signed with VIDEO_ROOM_SECRET, so it cannot be guessed.
 * Set JITSI_DOMAIN to use a self-hosted Jitsi or 8x8 JaaS instead of the public meet.jit.si.
 */
const domain = () => (process.env.JITSI_DOMAIN || "meet.jit.si").replace(/^https?:\/\//, "").replace(/\/+$/, "");

function secret() {
  const s = process.env.VIDEO_ROOM_SECRET || process.env.CRON_SECRET;
  if (!s) throw new Error("VIDEO_ROOM_SECRET is not set");
  return s;
}

export function roomName(bookingId: string) {
  const brand = site.name.replace(/[^A-Za-z0-9]/g, "") || "Consultation";
  const sig = createHmac("sha256", secret()).update(`booking-room:${bookingId}`).digest("hex").slice(0, 24);
  return `${brand}-${sig}`;
}

export type CallMode = "video" | "audio";

export function callUrl(bookingId: string, mode: CallMode, displayName?: string, subject?: string) {
  const cfg: string[] = ["config.prejoinPageEnabled=true", "config.disableDeepLinking=false"];
  if (mode === "audio") cfg.push("config.startWithVideoMuted=true", "config.startAudioOnly=true");
  if (displayName) cfg.push(`userInfo.displayName=${encodeURIComponent(JSON.stringify(displayName))}`);
  if (subject) cfg.push(`config.subject=${encodeURIComponent(JSON.stringify(subject))}`);
  return `https://${domain()}/${roomName(bookingId)}#${cfg.join("&")}`;
}

/** The call can be joined from booking confirmation until 3 hours after the scheduled end. */
export function callIsOpen(b: { status: string; ends_at: string }) {
  return b.status === "confirmed" && Date.now() <= new Date(b.ends_at).getTime() + 3 * 3600_000;
}
