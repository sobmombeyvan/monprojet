import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/primitives";
import { ContactForm } from "@/components/layout/contact-form";
import { PageHero } from "@/components/layout/page-hero";

export async function generateMetadata() {
  const t = await getTranslations("pages");
  return { title: t("contactTitle") };
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
