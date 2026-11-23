import { ArrowRight, ClipboardCheck, FileStack, MessagesSquare } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { PageHero } from "@/components/layout/page-hero";
import { getReferenceData } from "@/lib/data/queries";
import { formatPrice, loc } from "@/lib/utils";
import { buildMetadata } from "@/lib/seo";
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = { MessagesSquare, ClipboardCheck, FileStack };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return buildMetadata({ locale, pathname: "/services", title: t("services"), description: locale === "en"
    ? "Discover international mobility services and expert support."
    : "Découvrez nos services de mobilité internationale et l'accompagnement d'experts." });
}

export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { services } = await getReferenceData();
  return (
    <>
      <PageHero title={t("nav.services")} subtitle={t("home.servicesTitle")} />
      <section className="container-page py-12">
        <div className="mb-7">
          <h2 className="mt-2 text-2xl sm:text-3xl">
            {locale === "en" ? "Explore our services" : "Découvrez nos services"}
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {(locale === "en"
            ? [
                {
                  number: "01",
                  title: "Consultation with an expert",
                  text: "Individual exchanges on a destination, procedure, situation or particular difficulty.",
                  highlight: "A first step towards a clear plan.",
                },
                {
                  number: "02",
                  title: "Profile analysis and guidance",
                  text: "Assessment of your profile and options, with guidance based on official criteria.",
                },
                {
                  number: "03",
                  title: "Document assistance",
                  text: "Explanation of required documents, consistency review, tailored checklists and document verification.",
                },
                {
                  number: "04",
                  title: "Independent support",
                  text: "Complete your procedure yourself with methodological assistance, follow-up and professional advice.",
                },
                {
                  number: "05",
                  title: "Comprehensive or tailored support",
                  text: "Support through the stages agreed with your expert, based on your project and their competencies.",
                },
              ]
            : [
                {
                  number: "01",
                  title: "Consultation avec un expert",
                  text: "Échanges individuels sur une destination, une procédure, une situation ou une difficulté particulière.",
                  highlight: "Une première étape pour clarifier votre projet.",
                },
                {
                  number: "02",
                  title: "Analyse et orientation du profil",
                  text: "Évaluation de votre profil et de vos possibilités, avec une orientation fondée sur les critères officiels.",
                },
                {
                  number: "03",
                  title: "Assistance documentaire",
                  text: "Explication des documents requis, vérification de cohérence, listes personnalisées et contrôle documentaire.",
                },
                {
                  number: "04",
                  title: "Accompagnement autonome",
                  text: "Effectuez vous-même votre procédure avec une assistance méthodologique, un suivi et des conseils professionnels.",
                },
                {
                  number: "05",
                  title: "Accompagnement intégral ou sur mesure",
                  text: "Accompagnement aux étapes convenues avec votre expert, selon votre projet et ses compétences.",
                },
              ]
          ).map((item) => (
            <Card key={item.number} className="flex flex-col p-6">
              <span className="text-sm font-bold tracking-wider text-teal-600">{item.number}</span>
              <h3 className="mt-3 text-xl font-semibold">{item.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted">{item.text}</p>
              {item.highlight && <p className="mt-3 text-sm font-medium text-teal-600">{item.highlight}</p>}
              <Button asChild className="mt-5">
                <Link href="/find-expert">{locale === "en" ? "Find an expert" : "Trouver un expert"}</Link>
              </Button>
            </Card>
          ))}
          {services.map((s) => {
            const Icon = ICONS[s.icon ?? ""] ?? MessagesSquare;
            return (
              <Card key={s.id} className="flex flex-col p-6">
                <div className="grid size-12 place-items-center rounded-xl bg-teal-50 text-teal-600"><Icon className="size-6" /></div>
                <h3 className="mt-5 text-xl font-semibold">{loc(s, "name", locale)}</h3>
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
      </section>
    </>
  );
}
