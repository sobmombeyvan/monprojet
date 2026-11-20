import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number | string | null | undefined, currency: string, locale = "fr") {
  if (amount === null || amount === undefined) return null;
  const n = Number(amount);
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "XAF" ? 0 : 2,
  })
    .format(n)
    .replace("XAF", "FCFA");
}

export function formatDate(value: string | Date, locale = "fr", opts: Intl.DateTimeFormatOptions = { dateStyle: "long" }) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { timeZone: "Africa/Douala", ...opts }).format(
    new Date(value),
  );
}

export function formatDateTime(value: string | Date, locale = "fr", timeZone = "Africa/Douala") {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

/** Picks the localized column of a bilingual row: loc(row, "name", "en") → row.name_en ?? row.name_fr */
export function loc<T extends Record<string, unknown>>(row: T | null | undefined, field: string, locale: string): string {
  if (!row) return "";
  const v = row[`${field}_${locale}`] ?? row[`${field}_fr`] ?? row[field];
  return typeof v === "string" ? v : "";
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** True when a verification date is older than `months` — such content is flagged, never shown as current. */
export function isStale(lastVerified: string | null | undefined, months = 6) {
  if (!lastVerified) return true;
  const d = new Date(lastVerified);
  d.setMonth(d.getMonth() + months);
  return d < new Date();
}
