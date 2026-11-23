import { notFound } from "next/navigation";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { SourceNote } from "@/components/countries/source-note";
import { ShareButton } from "@/components/knowledge/share-button";
import { getArticle, getArticles } from "@/lib/data/queries";
import { renderMarkdown } from "@/lib/markdown";
import { formatDate, loc } from "@/lib/utils";
import { site } from "@/config/site";
import { buildMetadata } from "@/lib/seo";

type Row = Record<string, unknown>;

export async function generateMetadata({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale } = await params;
  const a = await getArticle(slug);
  return a ? buildMetadata({ locale, pathname: `/knowledge/${slug}`, title: a.title, description: a.description }) : {};
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale } = await params;
  setRequestLocale(locale);
  const a = await getArticle(slug);
  if (!a) notFound();
  const t = await getTranslations();
  const cat = a.categories as Row;
  const related = (await getArticles({ locale, category: String(cat.slug), limit: 4 })).filter((r) => r.slug !== a.slug).slice(0, 3);
  const sources = (a.article_sources ?? []) as Row[];
  const reviewOverdue = a.review_due_at && new Date(a.review_due_at) < new Date();
  const official = sources.find((s) => s.is_official);

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: a.title,
            description: a.description,
            datePublished: a.published_at,
            dateModified: a.updated_at,
            author: { "@type": "Person", name: a.author_display_name },
            publisher: { "@type": "Organization", name: site.name },
            inLanguage: locale,
          }).replace(/</g, "\\u003c"),
        }}
      />
      <header className="border-b border-line bg-cloud">
        <div className="container-page max-w-4xl py-10 sm:py-14">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="teal">{loc(cat, "name", locale)}</Badge>
            {a.countries && <Badge>{loc(a.countries as Row, "name", locale)}</Badge>}
            {a.procedure_type && <Badge>{a.procedure_type}</Badge>}
            <Badge tone={a.reliability === "official" || a.reliability === "verified" ? "success" : "neutral"}>
              {t(`knowledge.reliability.${a.reliability}` as "knowledge.reliability.editorial")}
            </Badge>
          </div>
          <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">{a.title}</h1>
          <p className="mt-3 text-lg text-muted">{a.description}</p>
          <p className="mt-4 text-sm text-muted">
            {t("knowledge.by", { author: a.author_display_name })} · {t("knowledge.publishedOn", { date: formatDate(a.published_at, locale) })}
          </p>
          <div className="mt-3">
            <SourceNote sourceName={official?.label as string} sourceUrl={official?.url as string} lastVerified={a.last_verified_at} />
          </div>
          <div className="mt-5"><ShareButton title={a.title} /></div>
        </div>
      </header>
      <div className="container-page grid max-w-6xl gap-10 py-10 lg:grid-cols-[1fr_300px]">
        <div>
          {reviewOverdue && <Alert tone="warning" className="mb-6">{t("common.staleWarning")}</Alert>}
          {/* Rendered by a whitelist-only Markdown renderer (HTML is escaped) */}
          <div className="prose-content max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(a.body) }} />
          <Alert className="mt-10">{t("knowledge.notAdvice")}</Alert>
        </div>
        <aside className="space-y-6">
          <Card>
            <CardHeader><h2 className="font-semibold">{t("knowledge.sources")}</h2></CardHeader>
            <CardBody>
              <ul className="space-y-3">
                {sources.length === 0 && <li className="text-sm text-muted">—</li>}
                {sources.map((s) => (
                  <li key={String(s.id)}>
                    <a href={String(s.url)} target="_blank" rel="noopener noreferrer" className="flex items-start gap-1.5 text-sm font-medium text-teal-600 hover:underline">
                      {s.is_official ? <ShieldCheck className="mt-0.5 size-4 shrink-0" /> : <ExternalLink className="mt-0.5 size-4 shrink-0" />}
                      {String(s.label)}
                    </a>
                    <p className="ml-5.5 text-xs text-muted">{s.is_official ? t("knowledge.officialSource") : ""} · {formatDate(String(s.accessed_on), locale)}</p>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card className="bg-navy p-6 text-white">
            <p className="font-semibold text-white">{t("home.finalTitle")}</p>
            <Button asChild className="mt-4 w-full"><Link href={a.countries ? `/find-expert?country=${(a.countries as Row).slug}` : "/find-expert"}>{t("nav.findExpert")}</Link></Button>
          </Card>
          {related.length > 0 && (
            <div>
              <h2 className="font-semibold">{t("knowledge.related")}</h2>
              <ul className="mt-3 space-y-3">
                {related.map((r) => (
                  <li key={r.slug}><Link href={`/knowledge/${r.slug}`} className="text-sm font-medium text-navy hover:text-teal-600">{r.title}</Link></li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </article>
  );
}
