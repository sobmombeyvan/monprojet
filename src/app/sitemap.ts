import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { site } from "@/config/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statics = ["", "/find-expert", "/services", "/countries", "/knowledge", "/solutions", "/about", "/faq", "/contact", "/privacy", "/terms"];
  const entries: MetadataRoute.Sitemap = statics.flatMap((p) => [
    {
      url: `${site.url}${p || "/"}`,
      changeFrequency: "weekly" as const,
      priority: p === "" ? 1 : 0.7,
      alternates: { languages: { fr: `${site.url}${p || "/"}`, en: `${site.url}/en${p}` } },
    },
    {
      url: `${site.url}/en${p}`,
      changeFrequency: "weekly" as const,
      priority: p === "" ? 0.9 : 0.5,
      alternates: { languages: { fr: `${site.url}${p || "/"}`, en: `${site.url}/en${p}` } },
    },
  ]);
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return entries;
  // Client anonyme : seules les données publiées (RLS) sont listées
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const [{ data: experts }, { data: countries }, { data: articles }, { data: services }] = await Promise.all([
    db.from("consultants").select("slug, updated_at").eq("is_published", true),
    db.from("countries").select("slug, updated_at").eq("status", "published"),
    db.from("articles").select("slug, updated_at").eq("status", "published"),
    db.from("services").select("slug, updated_at").eq("is_active", true),
  ]);
  for (const [base, rows] of [["/experts", experts], ["/countries", countries], ["/knowledge", articles]] as const) {
    for (const r of rows ?? []) {
      const frUrl = `${site.url}${base}/${r.slug}`;
      const enUrl = `${site.url}/en${base}/${r.slug}`;
      entries.push(
        { url: frUrl, lastModified: r.updated_at, changeFrequency: "weekly", priority: 0.8, alternates: { languages: { fr: frUrl, en: enUrl } } },
        { url: enUrl, lastModified: r.updated_at, changeFrequency: "weekly", priority: 0.7, alternates: { languages: { fr: frUrl, en: enUrl } } },
      );
    }
  }
  for (const service of services ?? []) {
    const frUrl = `${site.url}/services/${service.slug}`;
    const enUrl = `${site.url}/en/services/${service.slug}`;
    entries.push(
      { url: frUrl, lastModified: service.updated_at, changeFrequency: "monthly", priority: 0.7, alternates: { languages: { fr: frUrl, en: enUrl } } },
      { url: enUrl, lastModified: service.updated_at, changeFrequency: "monthly", priority: 0.6, alternates: { languages: { fr: frUrl, en: enUrl } } },
    );
  }
  return entries;
}
