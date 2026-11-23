import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/primitives";
import { ContactForm } from "@/components/layout/contact-form";
import { PageHero } from "@/components/layout/page-hero";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });
  return buildMetadata({ locale, pathname: "/contact", title: t("contactTitle"), description: t("contactLead") });
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages");
  return (
    <>
      <PageHero title={t("contactTitle")} subtitle={t("contactLead")} />
      <div className="container-page max-w-3xl py-12">
        <Card className="p-6 sm:p-8"><ContactForm /></Card>
      </div>
    </>
  );
}
