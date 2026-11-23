import { BookOpen } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form-controls";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { PageHero } from "@/components/layout/page-hero";
import { getArticles, getReferenceData } from "@/lib/data/queries";
import { createClient } from "@/lib/supabase/server";
import { formatDate, loc } from "@/lib/utils";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "knowledge" });
  return buildMetadata({ locale, pathname: "/knowledge", title: t("title"), description: t("subtitle") });
}

export default async function KnowledgePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; category?: string; country?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations();
  const supabase = await createClient();
  const [articles, ref, { data: categories }] = await Promise.all([
    getArticles({ locale, q: sp.q?.slice(0, 80), category: sp.category, country: sp.country }),
    getReferenceData(),
    supabase.from("categories").select("slug, name_fr, name_en").order("sort_order"),
  ]);
  return (
    <>
      <PageHero title={t("knowledge.title")} subtitle={t("knowledge.subtitle")}>
        <form method="get" action={locale === "en" ? "/en/knowledge" : "/knowledge"} className="grid gap-2 sm:grid-cols-[1fr_200px_200px_auto]">
          <Input name="q" defaultValue={sp.q} placeholder={t("knowledge.searchPlaceholder")} aria-label={t("knowledge.searchPlaceholder")} />
          <Select name="category" defaultValue={sp.category ?? ""} aria-label={t("knowledge.category")}>
            <option value="">{t("knowledge.category")}</option>
            {(categories ?? []).map((c) => <option key={c.slug} value={c.slug}>{loc(c, "name", locale)}</option>)}
          </Select>
          <Select name="country" defaultValue={sp.country ?? ""} aria-label={t("knowledge.country")}>
            <option value="">{t("knowledge.country")}</option>
            {ref.countries.map((c) => <option key={c.slug} value={c.slug}>{loc(c, "name", locale)}</option>)}
          </Select>
          <Button type="submit">{t("common.search")}</Button>
        </form>
      </PageHero>
      <div className="container-page py-10">
        {articles.length === 0 ? (
          <EmptyState icon={BookOpen} title={t("knowledge.empty")} action={<Button asChild variant="outline"><Link href="/knowledge">{t("common.reset")}</Link></Button>} />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <Link key={a.slug} href={`/knowledge/${a.slug}`} className="group">
                <Card className="flex h-full flex-col p-6 transition-shadow group-hover:shadow-(--shadow-lift)">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="teal">{loc(a.categories as unknown as Record<string, unknown>, "name", locale)}</Badge>
                    {a.countries && <Badge>{loc(a.countries as unknown as Record<string, unknown>, "name", locale)}</Badge>}
                    <Badge tone={a.reliability === "official" || a.reliability === "verified" ? "success" : "neutral"}>
                      {t(`knowledge.reliability.${a.reliability}` as "knowledge.reliability.editorial")}
                    </Badge>
                  </div>
                  <h2 className="mt-4 text-lg font-semibold leading-snug group-hover:text-teal-600">{a.title}</h2>
                  <p className="mt-2 line-clamp-3 text-sm text-muted">{a.description}</p>
                  <p className="mt-auto pt-5 text-xs text-muted">
                    {a.last_verified_at ? t("common.lastVerified", { date: formatDate(a.last_verified_at, locale) }) : t("common.notVerifiedYet")}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
