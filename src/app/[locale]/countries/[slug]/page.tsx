import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Alert, Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { ExpertCard } from "@/components/experts/expert-card";
import { SourceNote } from "@/components/countries/source-note";
import { getArticles, getCountry, searchConsultants } from "@/lib/data/queries";
import { loc } from "@/lib/utils";

type Row = Record<string, unknown>;

export async function generateMetadata({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale } = await params;
  const c = await getCountry(slug);
  return c ? { title: loc(c, "name", locale), description: loc(c, "overview", locale) } : {};
}

export default async function CountryPage({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale } = await params;
  setRequestLocale(locale);
  const c = await getCountry(slug);
  if (!c) notFound();
  const t = await getTranslations();
  const [experts, articles] = await Promise.all([searchConsultants({ country: slug }), getArticles({ locale, country: slug, limit: 6 })]);
  const visas = ((c.visa_categories ?? []) as Row[]).filter((v) => v.status === "published");
  const links = (c.official_links ?? []) as { label: string; url: string }[];
  const sections = [
    ["study", "study_info"],
    ["work", "work_info"],
    ["immigration", "immigration_info"],
  ] as const;

  return (
    <>
      <section className="border-b border-line bg-navy text-white">
        <div className="container-page py-12">
          <Link href="/countries" className="text-sm text-white/60 hover:text-white">← {t("countries.title")}</Link>
          <h1 className="display mt-3 flex items-center gap-3 text-4xl text-white sm:text-5xl">
            <span className="iso border-white/30 text-white">{c.iso2}</span> {loc(c, "name", locale)}
          </h1>
          <p className="mt-3 max-w-3xl text-white/75">{loc(c, "overview", locale)}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {(((locale === "en" ? c.opportunities_en : c.opportunities_fr) ?? []) as string[]).map((o) => (
              <span key={o} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">{o}</span>
            ))}
            {c.main_languages && <span className="text-xs text-white/60">· {c.main_languages}</span>}
          </div>
          <div className="mt-4 [&_*]:!text-white/70">
            <SourceNote sourceName={c.source_name} sourceUrl={c.source_url} lastVerified={c.last_verified_at} />
          </div>
        </div>
      </section>
      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {sections.map(([key, field]) => (
            <Card key={key}>
              <CardHeader><h2 className="font-semibold">{t(`countries.${key}`)}</h2></CardHeader>
              <CardBody>
                <p className="whitespace-pre-line leading-7 text-slate-700">{loc(c, field, locale) || t("countries.emptyInfo")}</p>
              </CardBody>
            </Card>
          ))}
          <Card>
            <CardHeader><h2 className="font-semibold">{t("countries.visas")}</h2></CardHeader>
            <CardBody>
              {visas.length === 0 ? (
                <Alert tone="info">{t("countries.noVisas")}</Alert>
              ) : (
                <ul className="space-y-5">
                  {visas.map((v) => (
                    <li key={String(v.id)} className="rounded-lg border border-line p-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-navy">{loc(v, "name", locale)}</h3>
                        <Badge>{String(v.kind)}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-700">{loc(v, "description", locale)}</p>
                      {(v.requirements as { fr: string; en: string }[]).length > 0 && (
                        <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                          {(v.requirements as { fr: string; en: string }[]).map((r, i) => <li key={i}>{locale === "en" ? r.en : r.fr}</li>)}
                        </ul>
                      )}
                      <div className="mt-3">
                        <SourceNote sourceName={v.source_name as string} sourceUrl={v.official_url as string} lastVerified={v.last_verified_at as string} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          {c.estimated_costs && (
            <Card>
              <CardHeader><h2 className="font-semibold">{t("countries.costs")}</h2></CardHeader>
              <CardBody>
                <ul className="space-y-2 text-sm">
                  {(c.estimated_costs as { label: string; amount: string; source_url: string; verified_at: string }[]).map((x, i) => (
                    <li key={i} className="flex justify-between gap-4">
                      <span>{x.label}</span>
                      <a href={x.source_url} target="_blank" rel="noopener noreferrer" className="font-medium text-navy underline-offset-2 hover:underline">{x.amount}</a>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
          <section>
            <h2 className="text-xl font-semibold">{t("countries.consultants")}</h2>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              {experts.rows.slice(0, 4).map((e) => <ExpertCard key={e.id} c={e} />)}
            </div>
          </section>
        </div>
        <aside className="space-y-6">
          <Card>
            <CardHeader><h2 className="font-semibold">{t("common.officialLinks")}</h2></CardHeader>
            <CardBody>
              <ul className="space-y-2">
                {links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:underline">
                      <ExternalLink className="size-3.5" /> {l.label}
                    </a>
                  </li>
                ))}
                {links.length === 0 && <li className="text-sm text-muted">—</li>}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader><h2 className="font-semibold">{t("countries.articles")}</h2></CardHeader>
            <CardBody>
              <ul className="space-y-3">
                {articles.map((a) => (
                  <li key={a.slug}><Link href={`/knowledge/${a.slug}`} className="text-sm font-medium text-navy hover:text-teal-600">{a.title}</Link></li>
                ))}
                {articles.length === 0 && <li className="text-sm text-muted">—</li>}
              </ul>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
