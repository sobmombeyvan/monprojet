import { setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/primitives";
import { PageTitle } from "@/components/dashboard/shell";
import { NewConsultantForm } from "@/components/admin/new-consultant-form";

export default async function NewConsultantPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <PageTitle title="Ajouter un consultant" />
      <Card className="max-w-xl p-6">
        <p className="mb-5 text-sm leading-6 text-muted">Créez le compte de l&apos;expert puis complétez son profil. Le profil reste masqué jusqu&apos;à ce que vous le publiiez.</p>
        <NewConsultantForm />
      </Card>
    </>
  );
}
