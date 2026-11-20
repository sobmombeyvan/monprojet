import { BookOpenCheck, Briefcase, GraduationCap, Languages, Lock, ShieldCheck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ExpertCard } from "@/components/experts/expert-card";
import { InteractiveGlobe } from "@/components/globe/interactive-globe";
import { HeroSearch } from "@/components/home/hero-search";
import { SectionHeading } from "@/components/home/section-heading";
import { site } from "@/config/site";
import { getArticles, getExpertCountsByCountry, getReferenceData, GLOBE_CITIES, searchConsultants } from "@/lib/data/queries";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPrice, loc } from "@/lib/utils";
import type { GeoDestination } from "@/lib/geo";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const supabase = await createClient();

  const [ref, featured, articles, counts, { data: reviews }, { count: certCount }] = await Promise.all([
    getReferenceData(),
    searchConsultants({ verified: "1" }).catch(() => ({ rows: [], total: 0, page: 1 })),
    getArticles({ locale, limit: 3 }),
    getExpertCountsByCountry(),
    supabase.from("reviews").select("id, rating, comment, client_display_name, consultants(professional_name)").eq("status", "published").not("comment", "is", null).order("rating", { ascending: false }).limit(3),
    supabase.from("consultant_certifications").select("id", { count: "exact", head: true }).eq("is_verified", true),
  ]);
  const destinations = ref.countries.filter((c) => c.slug !== "cameroon");
  const globe: GeoDestination[] = Object.entries(GLOBE_CITIES)
    .map(([slug, g]): GeoDestination | null => {
      const c = destinations.find((x) => x.slug === slug);
      if (!c || c.lon === null || c.lat === null) return null;
      return {
        slug, city: g.city, name: g.short ?? loc(c, "name", locale), lon: Number(c.lon), lat: Number(c.lat),
        opportunities: ((locale === "en" ? c.opportunities_en : c.opportunities_fr) ?? []) as string[], experts: counts[slug] ?? 0,
      };
    })
    .filter((x): x is GeoDestination => !!x);
  const [mainReview, ...otherReviews] = reviews ?? [];

  const serviceRows = [
    ...ref.services.map((s) => ({ title: loc(s, "name", locale), text: loc(s, "description", locale), price: s.pricing_type === "quote" ? tc("onQuote") : formatPrice(s.base_price, s.currency, locale), href: `/booking?service=${s.slug}`, cta: s.is_bookable ? tc("book") : t("consult") })),
    { title: t("resourcesRow"), text: t("resourcesRowText"), price: t("free"), href: "/knowledge", cta: t("consult") },
  ];

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-navy text-white">
        <div className="container-page grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-24">
          <div>
            <p className="text-sm text-white/60">{site.descriptor}</p>
            <h1 className="display mt-5 text-[2.5rem] leading-[1.05] text-white sm:text-[3.6rem]">{t("heroTitle")}</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/70">{t("heroText")}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="accent" size="lg"><Link href="/countries">{t("ctaExploreOpps")}</Link></Button>
              <Button asChild variant="light" size="lg"><Link href="/find-expert">{t("ctaConsult")}</Link></Button>
            </div>
            <div className="mt-10">
              <HeroSearch countries={destinations} specialties={ref.specialties} services={ref.services} />
            </div>
          </div>
          <InteractiveGlobe destinations={globe} origin={site.origin} />
        </div>
      </section>

      {/* ── Garanties ── */}
      <section className="border-b border-line">
        <div className="container-page grid gap-8 py-10 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-line">
          {[[ShieldCheck, t("trustVerified"), t("trustVerifiedText")], [BookOpenCheck, t("trustSources"), t("trustSourcesText")], [Lock, t("trustPayment"), t("trustPaymentText")]].map(([Icon, title, text], i) => {
            const I = Icon as typeof Lock;
            return (
              <div key={String(title)} className={`flex gap-4 sm:pr-8 ${i ? "sm:pl-8" : ""}`}>
                <I className="mt-0.5 size-5 shrink-0 text-teal-600" />
                <div><p className="font-semibold text-navy">{String(title)}</p><p className="mt-1 text-sm leading-6 text-muted">{String(text)}</p></div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Certifications ── */}
      <section className="section bg-cloud">
        <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
          <div>
            <SectionHeading eyebrow="Certifications" title={t("certTitle")} />
            <p className="mt-5 max-w-md leading-7 text-muted">{t("certText")}</p>
            <dl className="mt-10 grid grid-cols-2 gap-6 border-t border-line pt-8">
              <div><dt className="text-sm text-muted">{t("verifiedExperts")}</dt><dd className="display mt-1 text-4xl">{featured.total}</dd></div>
              <div><dt className="text-sm text-muted">{t("verifiedCerts")}</dt><dd className="display mt-1 text-4xl">{certCount ?? 0}</dd></div>
            </dl>
          </div>
          <ul className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
            {[[ShieldCheck, "cert1"], [Briefcase, "cert2"], [GraduationCap, "cert3"], [Languages, "cert4"]].map(([Icon, k]) => {
              const I = Icon as typeof Lock; const key = k as "cert1";
              return (
                <li key={key} className="bg-white p-7">
                  <span className="grid size-10 place-items-center rounded-full bg-teal-50 text-teal-600"><I className="size-5" /></span>
                  <h3 className="mt-5 font-semibold">{t(key)}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{t(`${key}Text` as "cert1Text")}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ── Services ── */}
      <section className="section">
        <div className="container-page">
          <SectionHeading eyebrow={t("servicesEyebrow")} title={t("servicesTitle")} />
          <ul className="mt-12 divide-y divide-line border-y border-line">
            {serviceRows.map((r) => (
              <li key={r.title} className="grid items-center gap-3 py-7 md:grid-cols-[1.1fr_1.6fr_auto_auto] md:gap-10">
                <h3 className="display text-xl sm:text-2xl">{r.title}</h3>
                <p className="text-sm leading-6 text-muted">{r.text}</p>
                <p className="font-semibold text-navy md:text-right">{r.price}</p>
                <Button asChild variant="outline" size="sm" className="justify-self-start"><Link href={r.href}>{r.cta}</Link></Button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Experts ── */}
      <section className="section bg-cloud">
        <div className="container-page">
          <SectionHeading eyebrow={t("featuredEyebrow")} title={t("featuredTitle")} href="/find-expert" linkLabel={tc("seeAll")} />
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {featured.rows.slice(0, 3).map((c) => <ExpertCard key={c.id} c={c} />)}
          </div>
        </div>
      </section>

      {/* ── Destinations ── */}
      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <SectionHeading eyebrow={t("countriesEyebrow")} title={t("destTitle")} />
            <p className="mt-5 max-w-md leading-7 text-muted">{t("destText")}</p>
            <Button asChild variant="outline" className="mt-8"><Link href="/countries">{t("allDestinations")}</Link></Button>
          </div>
          <ul className="grid border-t border-line sm:grid-cols-2 sm:gap-x-10">
            {destinations.filter((c) => c.is_popular).map((c) => (
              <li key={c.slug} className="border-b border-line">
                <Link href={`/countries/${c.slug}`} className="group flex items-center gap-4 py-5">
                  <span className="iso">{c.iso2}</span>
                  <span className="flex-1 font-semibold text-navy underline-offset-4 group-hover:underline">{loc(c, "name", locale)}</span>
                  <span className="text-sm text-muted">{t("expertsAvailable", { count: counts[c.slug] ?? 0 })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Étapes ── */}
      <section className="section bg-navy text-white">
        <div className="container-page">
          <h2 className="display max-w-xl text-3xl text-white sm:text-[2.5rem]">{t("stepsTitle")}</h2>
          <ol className="mt-14 grid gap-10 md:grid-cols-3">
            {(["step1", "step2", "step3"] as const).map((k, i) => (
              <li key={k} className="border-t border-white/20 pt-6">
                <span className="display text-4xl text-teal">0{i + 1}</span>
                <h3 className="mt-4 text-lg font-semibold text-white">{t(k)}</h3>
                <p className="mt-2 text-sm leading-6 text-white/65">{t(`${k}Text` as "step1Text")}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Témoignages (avis vérifiés uniquement) ── */}
      {mainReview && (
        <section className="section">
          <div className="container-page grid gap-12 lg:grid-cols-[1.5fr_1fr]">
            <figure>
              <blockquote className="display text-2xl font-semibold leading-snug text-navy sm:text-[2.1rem]">« {mainReview.comment} »</blockquote>
              <figcaption className="mt-6 text-sm"><span className="font-semibold text-navy">{mainReview.client_display_name}</span>
                <span className="text-muted"> · {(mainReview.consultants as unknown as { professional_name: string })?.professional_name}</span></figcaption>
            </figure>
            <ul className="space-y-8 lg:border-l lg:border-line lg:pl-10">
              {otherReviews.map((r) => (
                <li key={r.id}><p className="leading-7 text-slate-600">{r.comment}</p><p className="mt-3 text-sm font-semibold text-navy">{r.client_display_name}</p></li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── Ressources ── */}
      <section className="section border-t border-line">
        <div className="container-page">
          <SectionHeading eyebrow={t("articlesEyebrow")} title={t("resourcesTitle")} href="/knowledge" linkLabel={tc("seeAll")} />
          <ul className="mt-12 grid gap-10 md:grid-cols-3">
            {articles.map((a) => (
              <li key={a.slug}>
                <Link href={`/knowledge/${a.slug}`} className="group block">
                  <p className="text-xs font-semibold text-teal-600">{loc(a.categories as unknown as Record<string, unknown>, "name", locale)}</p>
                  <h3 className="display mt-3 text-xl leading-snug decoration-1 underline-offset-4 group-hover:underline">{a.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted">{a.description}</p>
                  <p className="mt-4 text-xs text-muted">{a.last_verified_at ? tc("lastVerified", { date: formatDate(a.last_verified_at, locale) }) : tc("notVerifiedYet")}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Appel final ── */}
      <section className="pb-20 sm:pb-28">
        <div className="container-page">
          <div className="flex flex-col gap-8 rounded-2xl bg-cloud px-8 py-12 sm:px-14 md:flex-row md:items-center md:justify-between">
            <div><h2 className="display text-3xl">{t("finalTitle")}</h2><p className="mt-3 max-w-lg text-muted">{t("finalText")}</p></div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg"><Link href="/find-expert">{t("ctaConsult")}</Link></Button>
              <Button asChild variant="outline" size="lg"><Link href="/register">{t("createAccount")}</Link></Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
