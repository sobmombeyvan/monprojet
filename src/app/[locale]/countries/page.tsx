import { getTranslations, setRequestLocale } from "next-intl/server";
import { DestinationsExplorer, type Destination } from "@/components/countries/destinations-explorer";
import { site } from "@/config/site";
import { getExpertCountsByCountry, getPublishedCountries } from "@/lib/data/queries";

export async function generateMetadata() {
  const t = await getTranslations("countries");
  return { title: t("title"), description: t("subtitle") };
}

export default async function CountriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("countries");
  const [countries, counts] = await Promise.all([getPublishedCountries(), getExpertCountsByCountry()]);
  const en = locale === "en";
  const destinations: Destination[] = countries
    .filter((c) => c.slug !== "cameroon" && c.lon !== null && c.lat !== null)
    .map((c) => ({
      slug: c.slug, iso: c.iso2, name: (en ? c.name_en : c.name_fr) as string, region: c.region,
      regionLabel: t(`regions.${c.region}` as "regions.europe"), lon: Number(c.lon), lat: Number(c.lat),
      goals: (c.goals ?? []) as string[], opportunities: ((en ? c.opportunities_en : c.opportunities_fr) ?? []) as string[],
      overview: ((en ? c.overview_en : c.overview_fr) ?? "") as string, languages: c.main_languages ?? "", aliases: c.aliases ?? "",
      experts: counts[c.slug] ?? 0,
    }));
  return <DestinationsExplorer destinations={destinations} origin={site.origin} />;
}
