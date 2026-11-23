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
      <section className="border-t border-line bg-navy py-12 sm:py-16">
        <div className="container-page">
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow text-teal">
              {locale === "en" ? "Our support levels" : "Nos niveaux d'accompagnement"}
            </p>
            <h2 className="mt-3 text-3xl text-white sm:text-4xl">
              {locale === "en"
                ? "Support adapted to every stage"
                : "Un accompagnement adapté à chaque étape"}
            </h2>
          </div>
          <ol className="mx-auto mt-10 max-w-4xl space-y-4">
            {(
              locale === "en"
                ? [
                    {
                      number: "01.",
                      title: "Consultation with an expert",
                      text: "Individual exchanges on a destination, procedure, situation or particular difficulty.",
                      highlight: "First step to a clear and commercial approach",
                    },
                    {
                      number: "02.",
                      title: "Profile analysis and guidance",
                      text: "Assessment of the candidate's characteristics, identification of possibilities and guidance towards suitable options, subject to official criteria.",
                    },
                    {
                      number: "03.",
                      title: "Document assistance",
                      text: "Explanation of required documents, consistency analysis, preparation of personalised lists and document verification.",
                    },
                    {
                      number: "04.",
                      title: "Independent support",
                      text: "The candidate completes the procedure themselves, with methodological assistance, follow-up and professional advice.",
                    },
                    {
                      number: "05.",
                      title: "Comprehensive or tailored support",
                      text: "Responsibility for several stages agreed with the client, according to the project and the expert's competencies.",
                    },
                  ]
                : [
                    {
                      number: "01.",
                      title: "Consultation avec un expert",
                      text: "Échanges individuels sur une destination, une procédure, une situation ou une difficulté particulière.",
                      highlight: "Première porte d'entrée commerciale",
                    },
                    {
                      number: "02.",
                      title: "Analyse et orientation du profil",
                      text: "Évaluation des caractéristiques du candidat, identification des possibilités et orientation vers les options adaptées, sous réserve des critères officiels.",
                    },
                    {
                      number: "03.",
                      title: "Assistance documentaire",
                      text: "Explication des documents requis, analyse de cohérence, préparation de listes personnalisées et vérification documentaire.",
                    },
                    {
                      number: "04.",
                      title: "Accompagnement autonome",
                      text: "Le candidat effectue lui-même sa procédure, avec une assistance méthodologique, un suivi et des conseils professionnels.",
                    },
                    {
                      number: "05.",
                      title: "Accompagnement intégral ou sur mesure",
                      text: "Prise en charge des différentes étapes convenues avec le client, selon son projet et les compétences de l'expert.",
                    },
                  ]
            ).map((item) => (
              <li
                key={item.number}
                className="rounded-2xl border border-white/10 bg-[#101b32] px-5 py-6 sm:px-7"
              >
                <div className="grid gap-3 sm:grid-cols-[5.5rem_1fr] sm:gap-6">
                  <span className="text-2xl font-semibold text-white/45 sm:text-3xl">{item.number}</span>
                  <div>
                    <h3 className="text-xl text-white sm:text-2xl">{item.title}</h3>
                    <p className="mt-2 leading-7 text-white/65">{item.text}</p>
                    {"highlight" in item && item.highlight && (
                      <p className="mt-2 text-sm font-medium text-teal">{item.highlight}</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="container-page py-12">
        <div className="mb-7">
          <p className="eyebrow">{locale === "en" ? "Bookable offers" : "Offres réservables"}</p>
          <h2 className="mt-2 text-2xl sm:text-3xl">
            {locale === "en" ? "Explore our services" : "Découvrez nos services"}
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
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
