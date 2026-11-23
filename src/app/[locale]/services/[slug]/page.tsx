import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ExpertCard } from "@/components/experts/expert-card";
import { PageHero } from "@/components/layout/page-hero";
import { getReferenceData, searchConsultants } from "@/lib/data/queries";
import { formatPrice, loc } from "@/lib/utils";
import { buildMetadata } from "@/lib/seo";
import { site } from "@/config/site";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const { services } = await getReferenceData();
  const service = services.find((item) => item.slug === slug);
  if (!service) return {};
  const name = loc(service, "name", locale);
  const description = loc(service, "description", locale);
  return buildMetadata({ locale, pathname: `/services/${slug}`, title: name, description });
}

export default async function ServicePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { services } = await getReferenceData();
  const s = services.find((x) => x.slug === slug);
  if (!s) notFound();
  const experts = await searchConsultants({ service: s.is_bookable ? slug : undefined });
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            name: loc(s, "name", locale),
            description: loc(s, "description", locale),
            url: new URL(`${locale === "en" ? "/en" : ""}/services/${slug}`, site.url).toString(),
            provider: { "@type": "Organization", name: site.name, url: site.url },
            areaServed: "International",
            ...(s.pricing_type !== "quote" && s.base_price
              ? { offers: { "@type": "Offer", price: s.base_price, priceCurrency: s.currency } }
              : {}),
          }).replace(/</g, "\\u003c"),
        }}
      />
      <PageHero title={loc(s, "name", locale)} subtitle={loc(s, "description", locale)}>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-2xl font-semibold text-navy">
            {s.pricing_type === "quote" ? t("common.onQuote") : `${t("common.from")} ${formatPrice(s.base_price, s.currency, locale)}`}
          </span>
          <Button asChild><Link href={`/booking?service=${s.slug}`}>{s.is_bookable ? t("common.book") : t("booking.requestQuote")}</Link></Button>
        </div>
      </PageHero>
      <div className="container-page py-12">
        <h2 className="text-xl font-semibold">{t("home.featuredTitle")}</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {experts.rows.slice(0, 6).map((c) => <ExpertCard key={c.id} c={c} />)}
        </div>
      </div>
    </>
  );
}
