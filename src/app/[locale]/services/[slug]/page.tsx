import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ExpertCard } from "@/components/experts/expert-card";
import { PageHero } from "@/components/layout/page-hero";
import { getReferenceData, searchConsultants } from "@/lib/data/queries";
import { formatPrice, loc } from "@/lib/utils";

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
