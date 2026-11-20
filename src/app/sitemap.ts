import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { site } from "@/config/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statics = ["", "/find-expert", "/services", "/countries", "/knowledge", "/solutions", "/about", "/faq", "/contact", "/privacy", "/terms"];
  const entries: MetadataRoute.Sitemap = statics.flatMap((p) => [
    { url: `${site.url}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 },
    { url: `${site.url}/en${p}`, changeFrequency: "weekly" as const, priority: 0.5 },
  ]);
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return entries;
  // Client anonyme : seules les données publiées (RLS) sont listées
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const [{ data: experts }, { data: countries }, { data: articles }] = await Promise.all([
    db.from("consultants").select("slug, updated_at").eq("is_published", true),
    db.from("countries").select("slug, updated_at").eq("status", "published"),
    db.from("articles").select("slug, updated_at").eq("status", "published"),
  ]);
  for (const [base, rows] of [["/experts", experts], ["/countries", countries], ["/knowledge", articles]] as const) {
    for (const r of rows ?? []) entries.push({ url: `${site.url}${base}/${r.slug}`, lastModified: r.updated_at });
  }
  return entries;
}
