import { Info, Search, SearchX, X } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { CompareProvider, CompareToggle } from "@/components/experts/compare";
import { ExpertCard } from "@/components/experts/expert-card";
import { ExpertFiltersForm } from "@/components/experts/filters";
import { SortSelect } from "@/components/experts/sort-select";
import { getReferenceData, PAGE_SIZE, searchConsultants, type ExpertFilters } from "@/lib/data/queries";
import { formatPrice, loc } from "@/lib/utils";

export async function generateMetadata() {
  const t = await getTranslations("experts");
  return { title: t("title"), description: t("subtitle") };
}

const KEYS: (keyof ExpertFilters)[] = [
  "country", "procedure", "service", "language", "method", "duration", "minPrice", "maxPrice",
  "availability", "qualification", "type", "verified", "q", "sort", "page",
];
const QUICK = ["study-visa", "university-admission", "ausbildung", "work-permit", "permanent-residence"];

export default async function FindExpertPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const filters: ExpertFilters = Object.fromEntries(
    KEYS.map((k) => [k, typeof sp[k] === "string" ? (sp[k] as string) : undefined]).filter(([, v]) => v),
  );
  const t = await getTranslations();
  const [refData, { rows, total, page }, all] = await Promise.all([
    getReferenceData(),
    searchConsultants(filters),
    searchConsultants({ page: "1" }).catch(() => ({ total: 0, rows: [] })),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const without = (key: keyof ExpertFilters) => {
    const q: Record<string, string> = {};
    for (const [k, v] of Object.entries(filters)) if (k !== key && k !== "page" && v) q[k] = v;
    return { pathname: "/find-expert" as const, query: q };
  };
  const pageHref = (p: number) => ({ pathname: "/find-expert" as const, query: { ...filters, page: String(p) } });
  const name = (list: { slug: string; name_fr: string; name_en: string }[], slug?: string) => {
    const x = list.find((i) => i.slug === slug);
    return x ? loc(x, "name", locale) : slug;
  };
  const labels: Partial<Record<keyof ExpertFilters, (v: string) => string | undefined>> = {
    country: (v) => name(refData.countries, v),
    procedure: (v) => name(refData.specialties, v),
    service: (v) => name(refData.services, v),
    language: (v) => { const l = refData.languages.find((x) => x.code === v); return l ? loc(l, "name", locale) : v; },
    method: (v) => t(`methods.${v}` as "methods.video"),
    duration: (v) => t("common.minutes", { count: Number(v) }),
    minPrice: (v) => `≥ ${formatPrice(Number(v), "XAF", locale)}`,
    maxPrice: (v) => `≤ ${formatPrice(Number(v), "XAF", locale)}`,
    verified: () => t("experts.verifiedOnly"),
    type: (v) => t(`types.${v}` as "types.orientation_specialist"),
    q: (v) => `« ${v} »`,
    availability: (v) => (v === "week" ? t("experts.availableWeek") : t("experts.availableMonth")),
    qualification: (v) => t(`experts.levels.${v}` as "experts.levels.master"),
  };
  const active = (Object.keys(labels) as (keyof ExpertFilters)[]).filter((k) => filters[k]);
  const languages = new Set(all.rows.flatMap((r) => r.languages.map((l) => l.code))).size;

  return (
    <CompareProvider experts={rows}>
      <section className="relative overflow-hidden bg-navy text-white">
        <div className="container-page relative py-12 sm:py-16">
          <p className="text-sm text-white/60">{t("experts.title")}</p>
          <h1 className="display mt-4 max-w-3xl text-[2.25rem] leading-[1.08] text-white sm:text-5xl">{t("experts.heroTitle")}</h1>
          <form method="get" action={locale === "en" ? "/en/find-expert" : "/find-expert"} className="mt-8 flex max-w-3xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-[var(--shadow-lift)] sm:flex-row">
            <label className="flex flex-1 items-center gap-3 px-3">
              <Search className="size-5 text-muted" />
              <input name="q" defaultValue={filters.q} placeholder={t("experts.searchPlaceholder")} className="h-12 w-full bg-transparent text-[15px] text-ink outline-none" aria-label={t("experts.keyword")} />
            </label>
            <select name="country" defaultValue={filters.country ?? ""} className="h-12 rounded-[10px] bg-cloud px-3 text-sm text-navy sm:w-56" aria-label={t("experts.country")}>
              <option value="">{t("common.all")}</option>
              {refData.countries.filter((c) => c.slug !== "cameroon").map((c) => <option key={c.slug} value={c.slug}>{loc(c, "name", locale)}</option>)}
            </select>
            <Button type="submit" variant="accent" size="lg">{t("common.search")}</Button>
          </form>
          <div className="mt-5 flex flex-wrap gap-2">
            {QUICK.map((s) => {
              const on = filters.procedure === s;
              return (
                <Link key={s} href={on ? without("procedure") : { pathname: "/find-expert", query: { ...without("procedure").query, procedure: s } }}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${on ? "border-white bg-white text-navy" : "border-white/25 text-white/80 hover:border-white hover:text-white"}`}>
                  {name(refData.specialties, s)}
                </Link>
              );
            })}
          </div>
          <dl className="mt-10 grid max-w-3xl grid-cols-3 gap-6 border-t border-white/15 pt-8">
            <div><dd className="display text-3xl text-white">{all.rows.filter((r) => r.verification_status === "verified").length}</dd><dt className="mt-1 text-xs text-white/55">{t("experts.statVerified")}</dt></div>
            <div><dd className="display text-3xl text-white">{refData.countries.length - 1}</dd><dt className="mt-1 text-xs text-white/55">{t("experts.statDestinations")}</dt></div>
            <div><dd className="display text-3xl text-white">{languages}</dd><dt className="mt-1 text-xs text-white/55">{t("experts.statLanguages")}</dt></div>
          </dl>
        </div>
      </section>

      <div className="container-page grid gap-8 py-8 lg:grid-cols-[300px_1fr] lg:gap-10 lg:py-12">
        <aside><ExpertFiltersForm refData={refData} values={filters} /></aside>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted" aria-live="polite"><span className="display text-2xl text-navy">{total}</span> {t("experts.results", { count: total }).replace(String(total), "").trim()}</p>
            <SortSelect value={filters.sort ?? "relevance"} />
          </div>
          {active.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {active.map((k) => (
                <Link key={k} href={without(k)} className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700">
                  {labels[k]!(filters[k]!)} <X className="size-3" />
                </Link>
              ))}
              <Link href={filters.sort ? { pathname: "/find-expert", query: { sort: filters.sort } } : "/find-expert"} className="link text-xs">{t("experts.clearAll")}</Link>
            </div>
          )}
          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted"><Info className="size-3.5" /> {t("experts.rankingNote")}</p>
          {rows.length === 0 ? (
            <div className="mt-6">
              <EmptyState icon={SearchX} title={t("experts.emptyTitle")} description={t("experts.emptyText")}
                action={<div className="flex flex-wrap justify-center gap-2">
                  <Button asChild variant="outline"><Link href="/find-expert">{t("common.reset")}</Link></Button>
                  <Button asChild><Link href="/solutions">{t("experts.profileJourney")}</Link></Button>
                </div>} />
            </div>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((c, i) => (
                <div key={c.id} className="reveal" style={{ "--i": i } as React.CSSProperties}>
                  <ExpertCard c={c} toolbar={<CompareToggle id={c.id} />} />
                </div>
              ))}
            </div>
          )}
          {pages > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
              {page > 1 && <Button asChild variant="outline" size="sm"><Link href={pageHref(page - 1)}>{t("experts.prev")}</Link></Button>}
              <span className="px-3 text-sm text-muted">{page} / {pages}</span>
              {page < pages && <Button asChild variant="outline" size="sm"><Link href={pageHref(page + 1)}>{t("experts.nextPage")}</Link></Button>}
            </nav>
          )}
        </div>
      </div>
    </CompareProvider>
  );
}
