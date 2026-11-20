import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type ConsultantCard = {
  id: string;
  slug: string;
  professional_name: string;
  title_fr: string;
  title_en: string | null;
  short_bio_fr: string | null;
  short_bio_en: string | null;
  photo_url: string | null;
  consultant_type: string;
  verification_status: "unverified" | "pending" | "verified" | "rejected" | "suspended";
  years_experience: number;
  rating_avg: number;
  reviews_count: number;
  methods: string[];
  starting_price: number | null;
  starting_currency: string;
  specialties: { slug: string; fr: string; en: string }[];
  countries: { slug: string; fr: string; en: string; flag: string | null; iso?: string }[];
  languages: { code: string; fr: string; en: string }[];
  qualifications: { title: string; level: string | null; verified: boolean }[];
  has_availability: boolean;
  certifications: { title: string; issuer: string }[];
  score: number;
  total_count: number;
};

export type ExpertFilters = {
  country?: string;
  procedure?: string;
  service?: string;
  language?: string;
  method?: string;
  duration?: string;
  minPrice?: string;
  maxPrice?: string;
  availability?: string;
  qualification?: string;
  type?: string;
  verified?: string;
  q?: string;
  sort?: string;
  page?: string;
};

export const PAGE_SIZE = 12;

export async function searchConsultants(f: ExpertFilters) {
  const supabase = await createClient();
  const page = Math.max(1, Number(f.page) || 1);
  const num = (v?: string) => (v && !Number.isNaN(Number(v)) ? Number(v) : null);
  const { data, error } = await supabase.rpc("search_consultants", {
    p_country_slug: f.country || null,
    p_specialty_slug: f.procedure || null,
    p_language: f.language || null,
    p_method: f.method || null,
    p_service_slug: f.service || null,
    p_duration: num(f.duration),
    p_min_price: num(f.minPrice),
    p_max_price: num(f.maxPrice),
    p_qualification_level: f.qualification || null,
    p_consultant_type: f.type || null,
    p_verified_only: f.verified === "1",
    p_available_days: f.availability === "week" ? 7 : f.availability === "month" ? 31 : null,
    p_query: f.q?.trim().slice(0, 80) || null,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
    p_sort: ["price", "rating", "experience"].includes(f.sort ?? "") ? f.sort : "relevance",
  });
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as Omit<ConsultantCard, "certifications">[]).map((r) => ({ ...r, certifications: [] as ConsultantCard["certifications"] }));
  // Certifications vérifiées des consultants de la page (une seule requête)
  if (rows.length) {
    const { data: certs } = await supabase
      .from("consultant_certifications")
      .select("consultant_id, title, issuer")
      .eq("is_verified", true)
      .in("consultant_id", rows.map((r) => r.id));
    for (const c of certs ?? []) rows.find((r) => r.id === c.consultant_id)?.certifications.push({ title: c.title, issuer: c.issuer });
  }
  return { rows, total: rows[0]?.total_count ?? 0, page };
}

/** Countries, specialties, languages and services used by filters and forms. */
export const getReferenceData = cache(async () => {
  const supabase = await createClient();
  const [countries, specialties, languages, services] = await Promise.all([
    supabase.from("countries").select("id, slug, iso2, name_fr, name_en, region, flag_emoji, is_popular, lon, lat, goals, opportunities_fr, opportunities_en, main_languages, aliases, overview_fr, overview_en").eq("status", "published").order("name_fr"),
    supabase.from("specialties").select("id, slug, name_fr, name_en").order("name_fr"),
    supabase.from("languages").select("code, name_fr, name_en").order("name_fr"),
    supabase.from("services").select("*").eq("is_active", true).order("sort_order"),
  ]);
  return {
    countries: countries.data ?? [],
    specialties: specialties.data ?? [],
    languages: languages.data ?? [],
    services: services.data ?? [],
  };
});

export async function getConsultantBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("consultants")
    .select(
      `*,
      consultant_qualifications(*),
      consultant_certifications(*),
      consultant_experiences(*),
      consultant_specialties(specialties(slug, name_fr, name_en)),
      consultant_countries(countries(slug, name_fr, name_en, flag_emoji)),
      consultant_languages(proficiency, languages(code, name_fr, name_en)),
      consultant_services(id, price, currency, duration_minutes, methods, is_active, services(id, slug, name_fr, name_en, base_price, currency, pricing_type, is_bookable)),
      availability(weekday, start_time, end_time)`,
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, rating, comment, consultant_reply, created_at, client_display_name")
    .eq("consultant_id", data.id)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(20);
  return { ...data, reviews: reviews ?? [] };
}

export async function getPublishedCountries() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("countries")
    .select("id, slug, iso2, name_fr, name_en, region, flag_emoji, overview_fr, overview_en, is_popular, lon, lat, goals, opportunities_fr, opportunities_en, main_languages, aliases")
    .eq("status", "published")
    .order("name_fr");
  return data ?? [];
}

export async function getCountry(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("countries")
    .select("*, visa_categories(*)")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return data;
}

export async function getArticles(opts: { locale: string; q?: string; category?: string; country?: string; limit?: number }) {
  const supabase = await createClient();
  // `!inner` turns the embedded filter into a filter on the articles themselves
  const countryEmbed = opts.country ? "countries!inner" : "countries";
  let query = supabase
    .from("articles")
    .select(`id, slug, title, description, published_at, last_verified_at, reliability, procedure_type, categories!inner(slug, name_fr, name_en), ${countryEmbed}(slug, name_fr, name_en, flag_emoji)`)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(opts.limit ?? 24);
  if (opts.q) query = query.textSearch("search", opts.q.trim().split(/\s+/).join(" & "), { config: "simple" });
  if (opts.category) query = query.eq("categories.slug", opts.category);
  if (opts.country) query = query.eq("countries.slug", opts.country);
  const { data } = await query;
  return data ?? [];
}

export async function getArticle(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("articles")
    .select("*, categories(slug, name_fr, name_en), countries(id, slug, name_fr, name_en), article_sources(*)")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return data;
}

export async function getPublicSetting<T>(key: string, fallback: T): Promise<T> {
  const supabase = await createClient();
  const { data } = await supabase.from("platform_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? fallback;
}

/** Nombre d'experts publiés par destination (pour le globe, les cartes et les fiches pays). */
export async function getExpertCountsByCountry() {
  const supabase = await createClient();
  const { data } = await supabase.from("consultant_countries").select("countries(slug), consultants!inner(is_published)").eq("consultants.is_published", true);
  const counts: Record<string, number> = {};
  for (const r of data ?? []) {
    const slug = (r.countries as unknown as { slug: string } | null)?.slug;
    if (slug) counts[slug] = (counts[slug] ?? 0) + 1;
  }
  return counts;
}

/** Destinations affichées sur le globe de l'accueil, avec la ville représentative. */
export const GLOBE_CITIES: Record<string, { city: string; short?: string }> = {
  canada: { city: "Montréal" },
  "united-states": { city: "New York" },
  france: { city: "Paris" },
  belgium: { city: "Bruxelles" },
  "united-kingdom": { city: "Londres" },
  germany: { city: "Berlin" },
  italy: { city: "Milan" },
  romania: { city: "Bucarest" },
  uae: { city: "Dubaï", short: "Dubaï" },
};
