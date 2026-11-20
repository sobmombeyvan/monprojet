import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/dashboard/shell";
import { createClient } from "@/lib/supabase/server";
import { ContentTable } from "../content-table";

export default async function AdminArticlesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("articles").select("id, slug, title, status, last_verified_at").order("updated_at", { ascending: false });
  return (
    <>
      <PageTitle title={t("articles")} />
      <ContentTable
        table="articles"
        rows={(data ?? []).map((a) => ({ id: a.id, title: a.title, status: a.status, last_verified_at: a.last_verified_at, href: `/knowledge/${a.slug}` }))}
      />
    </>
  );
}
