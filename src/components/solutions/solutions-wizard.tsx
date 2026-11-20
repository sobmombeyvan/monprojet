"use client";
import { ArrowLeft, BookOpen, Briefcase, ClipboardCheck, Compass, GraduationCap, MapPin, MessagesSquare, FileStack, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, Card, EmptyState } from "@/components/ui/primitives";
import { VerificationBadge } from "@/components/experts/badges";
import type { ConsultantCard } from "@/lib/data/queries";
import { cn, formatPrice } from "@/lib/utils";

type Country = { slug: string; iso: string; name: string; overview: string; opportunities: string[] };
type Objective = "study" | "work" | "settle" | "unsure";
const OBJECTIVES: { key: Objective; icon: typeof MapPin; specialties: string[]; suggested: string[] }[] = [
  { key: "study", icon: GraduationCap, specialties: ["study-visa", "university-admission"], suggested: ["france", "belgium", "canada", "italy"] },
  { key: "work", icon: Briefcase, specialties: ["work-permit", "ausbildung"], suggested: ["germany", "canada", "united-kingdom"] },
  { key: "settle", icon: MapPin, specialties: ["permanent-residence", "family-reunification"], suggested: ["canada", "france", "germany"] },
  { key: "unsure", icon: Compass, specialties: ["career-orientation", "document-review"], suggested: ["canada", "france", "germany"] },
];
const SERVICE_ICONS: Record<string, typeof MapPin> = { consultation: MessagesSquare, "profile-assessment": ClipboardCheck, "procedural-assistance": FileStack };

export function SolutionsWizard({
  initial, countries, languages, services, experts, articles,
}: {
  initial: { country: string; procedure: string };
  countries: Country[];
  languages: { code: string; name: string }[];
  services: { slug: string; name: string; price: number | null; currency: string; bookable: boolean }[];
  experts: ConsultantCard[];
  articles: { slug: string; title: string; country: string | null; category: string }[];
}) {
  const t = useTranslations("solutions");
  const tm = useTranslations("methods");
  const tc = useTranslations("common");
  const locale = useLocale();
  const preObjective = OBJECTIVES.find((o) => o.specialties.includes(initial.procedure))?.key ?? null;
  const [step, setStep] = useState(preObjective ? 2 : 1);
  const [objective, setObjective] = useState<Objective | null>(preObjective);
  const [country, setCountry] = useState(countries.some((c) => c.slug === initial.country) ? initial.country : "");
  const [level, setLevel] = useState("");
  const [langs, setLangs] = useState<string[]>([locale]);
  const [budget, setBudget] = useState("");
  const [method, setMethod] = useState("");

  const result = useMemo(() => {
    const obj = OBJECTIVES.find((o) => o.key === objective) ?? OBJECTIVES[3];
    const dests = country ? [country] : obj.suggested;
    const svc = obj.key === "unsure" || level === "bac" ? "profile-assessment" : obj.key === "settle" ? "procedural-assistance" : "consultation";
    // Même logique que le classement de la recherche : jamais la commission
    const ranked = experts
      .map((c) => {
        let fit = Number(c.score);
        fit += c.countries.some((x) => dests.includes(x.slug)) ? 40 : -60;
        if (c.specialties.some((s) => obj.specialties.includes(s.slug))) fit += 25;
        fit += langs.some((l) => c.languages.some((x) => x.code === l)) ? 10 : -30;
        if (method && c.methods.includes(method)) fit += 8;
        if (budget && (c.starting_price ?? Infinity) > Number(budget)) fit -= 50;
        return { c, fit };
      })
      .filter((x) => x.fit > 20)
      .sort((a, b) => b.fit - a.fit)
      .slice(0, 3)
      .map((x) => x.c);
    return { obj, dests, svc: services.find((s) => s.slug === svc), svcKey: svc, ranked, arts: articles.filter((a) => !a.country || dests.includes(a.country)).slice(0, 3) };
  }, [objective, country, level, langs, budget, method, experts, services, articles]);

  const chip = (on: boolean) => cn("rounded-full border px-4 py-2 text-sm font-medium transition", on ? "border-navy bg-navy text-white" : "border-line text-navy hover:border-navy");
  const select = "h-11 w-full rounded-[10px] border border-[#d5dde5] bg-white px-3 text-sm";

  return (
    <>
      <section className="border-b border-line bg-cloud">
        <div className="container-page py-12 sm:py-16">
          <h1 className="display text-3xl sm:text-5xl">{t("title")}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">{t("lead")}</p>
        </div>
      </section>

      {step < 4 ? (
        <div className="container-page max-w-3xl py-12">
          <ol className="mb-8 grid grid-cols-3 gap-2">
            {(t.raw("steps") as string[]).map((s, i) => (
              <li key={s}><div className={cn("h-1 rounded-full", step > i ? "bg-navy" : "bg-line")} />
                <p className={cn("mt-2 text-xs font-semibold", step === i + 1 ? "text-navy" : "text-muted")}>{i + 1}. {s}</p></li>
            ))}
          </ol>
          {step === 1 && (
            <div>
              <h2 className="display text-2xl">{t("q1")}</h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {OBJECTIVES.map(({ key, icon: Icon }) => {
                  const [title, text] = t.raw(`objectives.${key}`) as [string, string];
                  return (
                    <button key={key} onClick={() => { setObjective(key); setStep(2); }}
                      className={cn("flex items-start gap-4 rounded-2xl border p-5 text-left transition hover:border-navy", objective === key ? "border-navy bg-cloud" : "border-line bg-white")}>
                      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-600"><Icon className="size-5" /></span>
                      <span><span className="block font-semibold text-navy">{title}</span><span className="mt-1 block text-sm text-muted">{text}</span></span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {step === 2 && (
            <form onSubmit={(e) => { e.preventDefault(); setStep(3); }} className="grid gap-5 sm:grid-cols-2">
              <h2 className="display text-2xl sm:col-span-2">{t("q2")}</h2>
              <label><span className="mb-1.5 block text-sm font-semibold text-navy">{t("destination")}</span>
                <select value={country} onChange={(e) => setCountry(e.target.value)} className={select}>
                  <option value="">{t("unsureDest")}</option>
                  {countries.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select></label>
              <label><span className="mb-1.5 block text-sm font-semibold text-navy">{t("level")}</span>
                <select required value={level} onChange={(e) => setLevel(e.target.value)} className={select}>
                  <option value="">—</option>
                  {Object.entries(t.raw("levels") as Record<string, string>).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select></label>
              <div className="flex justify-between gap-3 sm:col-span-2">
                <Button type="button" variant="ghost" onClick={() => setStep(1)}><ArrowLeft /> {t("back")}</Button>
                <Button type="submit">{t("next")}</Button>
              </div>
            </form>
          )}
          {step === 3 && (
            <form onSubmit={(e) => { e.preventDefault(); setStep(4); }} className="grid gap-5 sm:grid-cols-2">
              <h2 className="display text-2xl sm:col-span-2">{t("q3")}</h2>
              <fieldset className="sm:col-span-2"><legend className="mb-2 text-sm font-semibold text-navy">{t("languages")}</legend>
                <div className="flex flex-wrap gap-2">
                  {languages.map((l) => (
                    <button type="button" key={l.code} aria-pressed={langs.includes(l.code)} onClick={() => setLangs((cur) => (cur.includes(l.code) ? cur.filter((x) => x !== l.code) : [...cur, l.code]))} className={chip(langs.includes(l.code))}>{l.name}</button>
                  ))}
                </div></fieldset>
              <label><span className="mb-1.5 block text-sm font-semibold text-navy">{t("budget")}</span>
                <select value={budget} onChange={(e) => setBudget(e.target.value)} className={select}>
                  <option value="">{t("any")}</option>
                  {[15000, 25000, 35000].map((v) => <option key={v} value={v}>{t("upTo", { amount: formatPrice(v, "XAF", locale)! })}</option>)}
                </select></label>
              <label><span className="mb-1.5 block text-sm font-semibold text-navy">{t("method")}</span>
                <select value={method} onChange={(e) => setMethod(e.target.value)} className={select}>
                  <option value="">{t("any")}</option>
                  {["video", "phone", "in_person", "chat"].map((m) => <option key={m} value={m}>{tm(m as "video")}</option>)}
                </select></label>
              <div className="flex justify-between gap-3 sm:col-span-2">
                <Button type="button" variant="ghost" onClick={() => setStep(2)}><ArrowLeft /> {t("back")}</Button>
                <Button type="submit" variant="accent">{t("see")}</Button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <div className="container-page py-12">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line p-5">
            <div className="flex flex-wrap gap-2 text-sm">
              {[(t.raw(`objectives.${result.obj.key}`) as string[])[0], country ? countries.find((c) => c.slug === country)?.name : t("unsureDest"), level ? (t.raw("levels") as Record<string, string>)[level] : null]
                .filter(Boolean).map((x) => <span key={x} className="rounded-full bg-cloud px-3 py-1 font-medium text-navy">{x}</span>)}
            </div>
            <button onClick={() => setStep(1)} className="link text-sm">{t("edit")}</button>
          </div>
          <ol className="mt-12 space-y-14">
            <li className="reveal grid gap-6 lg:grid-cols-[220px_1fr]">
              <div><span className="display text-4xl text-teal">01</span><h2 className="display mt-2 text-2xl">{t("inform")}</h2><p className="mt-2 text-sm text-muted">{t("informText")}</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                {result.dests.map((slug) => { const c = countries.find((x) => x.slug === slug); if (!c) return null; return (
                  <Link key={slug} href={`/countries/${slug}`} className="lift flex flex-col rounded-[var(--radius-card)] border border-line bg-white p-5">
                    <span className="flex items-center gap-3"><span className="iso">{c.iso}</span><span className="font-semibold text-navy">{c.name}</span></span>
                    <span className="mt-3 text-sm leading-6 text-muted">{c.overview}</span>
                    <span className="mt-3 flex flex-wrap gap-1.5">{c.opportunities.map((o) => <span key={o} className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-600">{o}</span>)}</span>
                  </Link>); })}
                {result.arts.map((a) => (
                  <Link key={a.slug} href={`/knowledge/${a.slug}`} className="flex items-start gap-3 rounded-xl border border-line p-4 hover:border-navy">
                    <BookOpen className="mt-0.5 size-4 shrink-0 text-teal-600" /><span><span className="block text-sm font-semibold text-navy">{a.title}</span><span className="mt-1 block text-xs text-muted">{a.category}</span></span>
                  </Link>))}
              </div>
            </li>
            {result.svc && (() => { const Icon = SERVICE_ICONS[result.svcKey] ?? MessagesSquare; return (
              <li className="reveal grid gap-6 lg:grid-cols-[220px_1fr]" style={{ "--i": 1 } as React.CSSProperties}>
                <div><span className="display text-4xl text-teal">02</span><h2 className="display mt-2 text-2xl">{t("service")}</h2></div>
                <Card className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-600"><Icon className="size-5" /></span>
                  <div className="flex-1"><p className="font-semibold text-navy">{result.svc.name}</p><p className="mt-1 text-sm leading-6 text-muted">{t(`why.${result.svcKey}` as "why.consultation")}</p></div>
                  <div className="sm:text-right">
                    <p className="text-lg font-semibold text-navy">{result.svc.price === null ? "—" : formatPrice(result.svc.price, result.svc.currency, locale)}</p>
                    <Button asChild variant="accent" size="sm" className="mt-2"><Link href={`/booking?service=${result.svcKey}`}>{result.svc.bookable ? t("book") : t("quote")}</Link></Button>
                  </div>
                </Card>
              </li>); })()}
            <li className="reveal grid gap-6 lg:grid-cols-[220px_1fr]" style={{ "--i": 2 } as React.CSSProperties}>
              <div><span className="display text-4xl text-teal">03</span><h2 className="display mt-2 text-2xl">{t("experts")}</h2><p className="mt-2 text-sm text-muted">{t("expertsText")}</p></div>
              {result.ranked.length ? (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {result.ranked.map((c) => (
                    <Card key={c.id} className="lift flex flex-col p-6">
                      <div className="flex items-start gap-4"><Avatar src={c.photo_url} name={c.professional_name} size={52} />
                        <div className="min-w-0"><p className="truncate font-semibold text-navy">{c.professional_name}</p><p className="line-clamp-2 text-sm text-muted">{locale === "en" ? (c.title_en ?? c.title_fr) : c.title_fr}</p>
                          <div className="mt-2"><VerificationBadge status={c.verification_status} /></div></div></div>
                      <div className="mt-auto flex items-end justify-between gap-3 border-t border-line pt-4">
                        <span className="flex items-center gap-1 text-sm text-navy">{c.reviews_count ? <><Star className="size-3.5 fill-navy" /> {Number(c.rating_avg).toFixed(1)}</> : "—"}</span>
                        <div className="flex gap-2">
                          <Button asChild variant="outline" size="sm"><Link href={`/experts/${c.slug}`}>{tc("view")}</Link></Button>
                          <Button asChild size="sm"><Link href={`/booking?expert=${c.slug}`}>{t("book")}</Link></Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState title={t("noExperts")} description={t("noExpertsText")} action={<Button variant="outline" onClick={() => setStep(3)}>{t("edit")}</Button>} />
              )}
            </li>
          </ol>
        </div>
      )}
    </>
  );
}
