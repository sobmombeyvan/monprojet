import { setRequestLocale, getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/primitives";
import { PageTitle } from "@/components/dashboard/shell";
import { createClient } from "@/lib/supabase/server";
import { ContentTable } from "../content-table";

export default async function AdminCountriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("countries").select("id, slug, name_fr, status, last_verified_at").order("name_fr");
  return (
    <>
      <PageTitle title={t("countries")} />
      <Alert className="mb-4">
        Les catégories de visas ne peuvent être publiées qu&apos;avec une URL officielle et une date de vérification (contrainte SQL).
        L&apos;éditeur complet (Phase 4) s&apos;appuie sur ce workflow.
      </Alert>
      <ContentTable
        table="countries"
        rows={(data ?? []).map((c) => ({ id: c.id, title: c.name_fr, status: c.status, last_verified_at: c.last_verified_at, href: `/countries/${c.slug}` }))}
      />
    </>
  );
}
