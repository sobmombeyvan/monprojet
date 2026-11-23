import { getTranslations, setRequestLocale } from "next-intl/server";
import { SolutionsWizard } from "@/components/solutions/solutions-wizard";
import { getArticles, getReferenceData, type ConsultantCard } from "@/lib/data/queries";
import { createClient } from "@/lib/supabase/server";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "solutions" });
  return buildMetadata({ locale, pathname: "/solutions", title: t("title"), description: t("lead") });
}

/** Parcours « Trouver les solutions adaptées à mon profil » — préremplissable depuis les filtres de l'accueil. */
export default async function SolutionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ country?: string; procedure?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const supabase = await createClient();
  const [ref, { data: experts }, articles] = await Promise.all([
    getReferenceData(),
    supabase.rpc("search_consultants", { p_limit: 50 }),
    getArticles({ locale, limit: 24 }),
  ]);
  return (
    <SolutionsWizard
      initial={{ country: sp.country ?? "", procedure: sp.procedure ?? "" }}
      countries={ref.countries.filter((c) => c.slug !== "cameroon").map((c) => ({
        slug: c.slug, iso: c.iso2, name: (locale === "en" ? c.name_en : c.name_fr) as string,
        overview: ((locale === "en" ? c.overview_en : c.overview_fr) ?? "") as string,
        opportunities: ((locale === "en" ? c.opportunities_en : c.opportunities_fr) ?? []) as string[],
      }))}
      languages={ref.languages.map((l) => ({ code: l.code, name: (locale === "en" ? l.name_en : l.name_fr) as string }))}
      services={ref.services.map((s) => ({ slug: s.slug, name: (locale === "en" ? s.name_en : s.name_fr) as string, price: s.base_price === null ? null : Number(s.base_price), currency: s.currency, bookable: s.is_bookable }))}
      experts={(experts ?? []) as unknown as ConsultantCard[]}
      articles={articles.map((a) => ({ slug: a.slug, title: a.title, country: (a.countries as unknown as { slug: string } | null)?.slug ?? null, category: ((a.categories as unknown as Record<string, string>)?.[`name_${locale}`] ?? "") }))}
    />
  );
}
