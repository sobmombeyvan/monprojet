import { ArrowRight, ClipboardCheck, FileStack, MessagesSquare } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { PageHero } from "@/components/layout/page-hero";
import { getReferenceData } from "@/lib/data/queries";
import { formatPrice, loc } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = { MessagesSquare, ClipboardCheck, FileStack };

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("services") };
}

export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { services } = await getReferenceData();
  return (
    <>
      <PageHero title={t("nav.services")} subtitle={t("home.servicesTitle")} />
      <div className="container-page grid gap-6 py-12 md:grid-cols-3">
        {services.map((s) => {
          const Icon = ICONS[s.icon ?? ""] ?? MessagesSquare;
          return (
            <Card key={s.id} className="flex flex-col p-6">
              <div className="grid size-12 place-items-center rounded-xl bg-teal-50 text-teal-600"><Icon className="size-6" /></div>
              <h2 className="mt-5 text-xl font-semibold">{loc(s, "name", locale)}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted">{loc(s, "description", locale)}</p>
              <p className="mt-6 text-2xl font-semibold text-navy">
                {s.pricing_type === "quote" ? t("common.onQuote") : formatPrice(s.base_price, s.currency, locale)}
              </p>
              <div className="mt-5 grid gap-2">
                <Button asChild><Link href={`/booking?service=${s.slug}`}>{s.is_bookable ? t("common.book") : t("booking.requestQuote")}</Link></Button>
                <Button asChild variant="ghost"><Link href={`/services/${s.slug}`}>{t("home.learnMore")} <ArrowRight /></Link></Button>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
