import { BookOpen, Compass, Lock, MessagesSquare, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { InteractiveGlobe } from "@/components/globe/interactive-globe";
import { SectionHeading } from "@/components/home/section-heading";
import { site } from "@/config/site";
import { getExpertCountsByCountry, getPublishedCountries, GLOBE_CITIES } from "@/lib/data/queries";
import { landDots, mapArc, mapX, mapY, type GeoDestination } from "@/lib/geo";

export async function generateMetadata() {
  const t = await getTranslations("pages");
  return { title: t("aboutTitle"), description: t("aboutLead") };
}

// Connexions affichées sur la carte « Notre réseau »
const HUBS: [string, number, number][] = [["Douala", 9.7, 4.05], ["Montréal", -73.6, 45.5], ["Paris", 2.35, 48.85], ["Berlin", 13.4, 52.5], ["Londres", -0.13, 51.5], ["Milan", 9.19, 45.46], ["Bucarest", 26.1, 44.43], ["Dubaï", 55.27, 25.2], ["New York", -74, 40.7]];
const LINKS: [number, number][] = [[0, 1], [0, 2], [0, 3], [0, 4], [0, 7], [0, 5], [0, 6], [2, 1], [4, 8], [3, 7], [5, 6]];

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages");
  const th = await getTranslations("home");
  const [countries, counts] = await Promise.all([getPublishedCountries(), getExpertCountsByCountry()]);
  const globe: GeoDestination[] = Object.entries(GLOBE_CITIES).flatMap(([slug, g]) => {
    const c = countries.find((x) => x.slug === slug);
    return c && c.lon !== null ? [{ slug, city: g.city, name: g.short ?? ((locale === "en" ? c.name_en : c.name_fr) as string), lon: Number(c.lon), lat: Number(c.lat), opportunities: [], experts: counts[slug] ?? 0 }] : [];
  });
  const steps = t.raw("approachSteps") as string[];
  const stepsText = t.raw("approachStepsText") as string[];
  const stepIcons = [BookOpen, Compass, MessagesSquare, ShieldCheck];
  const dots = landDots();
  const destinations = countries.filter((c) => c.slug !== "cameroon").length;
  const covered = Object.keys(counts).length;

  const visuals = [
    <div key="v" className="absolute inset-0">
      <InteractiveGlobe destinations={globe} origin={site.origin} interactive={false} showChips={false} className="h-full [&>div]:h-full [&>div]:max-w-none" />
      <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/80 to-transparent p-5 text-xs font-semibold text-white/80">{destinations} destinations</p>
    </div>,
    <div key="a" className="flex h-full flex-col justify-center gap-3 p-6 sm:p-8">
      {steps.map((s, i) => {
        const Icon = stepIcons[i];
        return (
          <div key={s} className="reveal flex items-center gap-4 rounded-2xl bg-white/[0.06] px-4 py-3 ring-1 ring-white/10" style={{ "--i": i + 3 } as React.CSSProperties}>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-teal text-white"><Icon className="size-5" /></span>
            <span><span className="block font-semibold text-white">{s}</span><span className="block text-xs text-white/60">{stepsText[i]}</span></span>
            <span className="ml-auto text-xs font-semibold text-white/40">0{i + 1}</span>
          </div>
        );
      })}
    </div>,
    <div key="n" className="absolute inset-0">
      <svg viewBox="200 40 540 405" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden>
        <g fill="#fff" fillOpacity={0.16}>{dots.map(([lo, la], i) => <circle key={i} cx={mapX(lo)} cy={mapY(la)} r={1.6} />)}</g>
        <g fill="none" stroke="#25AFA5" strokeWidth={1.4} strokeLinecap="round">
          {LINKS.map(([a, b], i) => <path key={i} d={mapArc(HUBS[a][1], HUBS[a][2], HUBS[b][1], HUBS[b][2])} className="draw-path" style={{ "--i": i } as React.CSSProperties} />)}
        </g>
        {HUBS.map(([n, lo, la], i) => (
          <g key={n} transform={`translate(${mapX(lo)} ${mapY(la)})`}>
            <circle r={9} fill="#25AFA5" fillOpacity={0.25} className="pulse-svg" style={{ animationDelay: `${i * 0.25}s` }} />
            <circle r={3.5} fill="#fff" />
            {["Douala", "Montréal", "Paris", "Bucarest", "Dubaï"].includes(n) && <text x={7} y={-7} fill="#fff" fillOpacity={0.85} fontSize={11} fontWeight={600}>{n}</text>}
          </g>
        ))}
      </svg>
      <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/80 to-transparent p-5 text-xs font-semibold text-white/80">{covered} / {destinations}</p>
    </div>,
  ];

  return (
    <>
      <section className="relative overflow-hidden bg-navy text-white">
        <div className="container-page grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-sm text-white/60">{t("aboutTitle")} — {site.name}</p>
            <h1 className="display mt-5 text-[2.4rem] leading-[1.06] text-white sm:text-[3.4rem]">{t("aboutHero")}</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/70">{t("aboutLead")}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="accent" size="lg"><Link href="/find-expert">{th("ctaConsult")}</Link></Button>
              <Button asChild variant="light" size="lg"><Link href="/countries">{th("ctaExploreOpps")}</Link></Button>
            </div>
          </div>
          <InteractiveGlobe destinations={globe} origin={site.origin} showChips={false} className="mx-auto w-full max-w-[420px]" />
        </div>
      </section>

      <section className="section">
        <div className="container-page grid gap-10 lg:grid-cols-[260px_1fr] lg:gap-16">
          <div><p className="eyebrow">{t("mission")}</p><div className="mt-4 h-px w-16 bg-teal" /></div>
          <blockquote className="display text-[1.75rem] font-semibold leading-snug text-navy sm:text-[2.4rem]">{t("missionText")}</blockquote>
        </div>
      </section>

      <section className="section border-t border-line">
        <div className="container-page">
          <ul className="divide-y divide-line">
            {([["vision", "visionText"], ["approach", "approachText"], ["network", "networkText"]] as const).map(([title, text], i) => (
              <li key={title} className="reveal grid items-center gap-8 py-12 first:pt-0 md:grid-cols-[minmax(0,420px)_1fr] md:gap-14" style={{ "--i": i } as React.CSSProperties}>
                <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-navy">{visuals[i]}</div>
                <div><h2 className="display text-3xl sm:text-4xl">{t(title)}</h2><p className="mt-4 max-w-xl text-lg leading-8 text-muted">{t(text)}</p></div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section bg-cloud">
        <div className="container-page">
          <SectionHeading eyebrow={t("values")} title={t("valuesTitle")} />
          <ul className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {([[BookOpen, "value1"], [ShieldCheck, "value2"], [SlidersHorizontal, "value3"], [Lock, "value4"]] as const).map(([Icon, k]) => (
              <li key={k} className="bg-white p-7">
                <span className="grid size-10 place-items-center rounded-full bg-teal-50 text-teal-600"><Icon className="size-5" /></span>
                <h3 className="mt-5 font-semibold">{t(k)}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{t(`${k}Text` as "value1Text")}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-20">
        <div className="container-page">
          <div className="flex flex-col gap-6 rounded-2xl bg-navy px-8 py-12 text-white sm:px-14 md:flex-row md:items-center md:justify-between">
            <div><h2 className="display text-3xl text-white">{t("together")}</h2><p className="mt-3 max-w-lg text-white/70">{t("togetherText")}</p></div>
            <Button asChild variant="accent" size="lg"><Link href="/solutions">{th("profileButton")}</Link></Button>
          </div>
        </div>
      </section>
    </>
  );
}
