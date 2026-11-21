"use client";
import { Briefcase, GraduationCap, Languages, MapPin, Search, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { landDots, mapArc, mapX, mapY, MAP_H, MAP_W } from "@/lib/geo";
import { cn } from "@/lib/utils";

export type Destination = {
  slug: string; iso: string; name: string; region: string; regionLabel: string; lon: number; lat: number;
  goals: string[]; opportunities: string[]; overview: string; languages: string; aliases: string; experts: number;
};
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Carte du monde animée + filtres (recherche, objectif, région) + fiches destination. */
export function DestinationsExplorer({ destinations, origin }: { destinations: Destination[]; origin: { city: string; lon: number; lat: number } }) {
  const t = useTranslations("countries");
  const th = useTranslations("home");
  const router = useRouter();
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const [goal, setGoal] = useState("");
  const [hover, setHover] = useState<string | null>(null);
  const dots = useMemo(() => landDots(), []);
  const list = destinations.filter((d) =>
    (!q || norm(`${d.name} ${d.aliases} ${d.regionLabel} ${d.opportunities.join(" ")}`).includes(norm(q))) && (!region || d.region === region) && (!goal || d.goals.includes(goal)));
  const regions = [...new Map(destinations.map((d) => [d.region, d.regionLabel])).entries()];
  const h = destinations.find((d) => d.slug === hover);
  const goals: [string, string, typeof MapPin][] = [["study", t("goalStudy"), GraduationCap], ["work", t("goalWork"), Briefcase], ["settle", t("goalSettle"), MapPin]];
  const tab = (on: boolean) => cn("shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition", on ? "bg-white text-navy" : "text-white/70 hover:text-white");

  return (
    <>
      <section className="relative overflow-hidden bg-navy text-white">
        <div className="container-page pt-12 sm:pt-16">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
            <div>
              <p className="text-sm text-white/60">{t("title")}</p>
              <h1 className="display mt-4 text-[2.25rem] leading-[1.08] text-white sm:text-5xl">{t("heroTitle")}</h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-white/70">{t("heroText", { count: destinations.length })}</p>
            </div>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 rounded-2xl bg-white px-4 shadow-(--shadow-lift)">
                <Search className="size-5 text-muted" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} className="h-14 w-full bg-transparent text-[15px] text-ink outline-none" aria-label={t("searchPlaceholder")} />
              </label>
              <div className="flex flex-wrap gap-2">
                {goals.map(([k, label, Icon]) => (
                  <button key={k} aria-pressed={goal === k} onClick={() => setGoal(goal === k ? "" : k)}
                    className={cn("flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition", goal === k ? "border-teal bg-teal text-white" : "border-white/25 text-white/85 hover:border-white")}>
                    <Icon className="size-4" />{label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="relative mt-10">
            <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="h-auto w-full" role="img" aria-label={t("title")}>
              <g fill="#fff" fillOpacity=".13">{dots.map(([lo, la], i) => <circle key={i} cx={mapX(lo)} cy={mapY(la)} r={1.9} />)}</g>
              {h && <path key={h.slug} d={mapArc(origin.lon, origin.lat, h.lon, h.lat)} fill="none" stroke="#25AFA5" strokeWidth={1.6} strokeLinecap="round" className="draw-path" style={{ "--i": -2 } as React.CSSProperties} />}
              {destinations.map((d, i) => {
                const visible = list.some((x) => x.slug === d.slug);
                const on = hover === d.slug;
                return (
                  <g key={d.slug} transform={`translate(${mapX(d.lon)} ${mapY(d.lat)})`} className="fade-pin cursor-pointer outline-none" style={{ "--i": i, opacity: visible ? 1 : 0.15 } as React.CSSProperties}
                    tabIndex={0} role="button" aria-label={d.name}
                    onMouseEnter={() => setHover(d.slug)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(d.slug)} onBlur={() => setHover(null)}
                    onClick={() => router.push(`/countries/${d.slug}`)} onKeyDown={(e) => e.key === "Enter" && router.push(`/countries/${d.slug}`)}>
                    <circle r={14} fill="transparent" />
                    <circle r={5} fill="none" stroke="#25AFA5" strokeWidth={1.2} className="pulse-svg" style={{ animationDelay: `${i * 0.16}s` }} />
                    <circle r={on ? 6 : 4} fill={on ? "#25AFA5" : "#fff"} />
                  </g>
                );
              })}
              <g transform={`translate(${mapX(origin.lon)} ${mapY(origin.lat)})`}>
                <circle r={10} fill="#25AFA5" fillOpacity={0.2} className="pulse-svg" />
                <circle r={4.5} fill="#25AFA5" />
                <text x={9} y={17} fill="#fff" fontSize={12} fontWeight={700}>{origin.city}</text>
              </g>
            </svg>
            {h && (
              <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-xl bg-white px-4 py-3 text-ink shadow-(--shadow-lift)"
                style={{ left: `${(mapX(h.lon) / MAP_W) * 100}%`, top: `${(mapY(h.lat) / MAP_H) * 100}%`, marginTop: -14 }}>
                <p className="flex items-center gap-2 font-semibold text-navy"><span className="iso">{h.iso}</span>{h.name}</p>
                <p className="mt-1 text-xs text-muted">{h.opportunities.slice(0, 2).join(" · ")}</p>
                <p className={cn("mt-1 text-xs font-semibold", h.experts ? "text-teal-600" : "text-muted")}>{th("expertsAvailable", { count: h.experts })}</p>
              </div>
            )}
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="container-page flex gap-2 overflow-x-auto py-4" role="group">
            <button onClick={() => setRegion("")} aria-pressed={!region} className={tab(!region)}>{t("all")} <span className="ml-1 opacity-60">{destinations.length}</span></button>
            {regions.map(([r, label]) => (
              <button key={r} onClick={() => setRegion(region === r ? "" : r)} aria-pressed={region === r} className={tab(region === r)}>
                {label} <span className="ml-1 opacity-60">{destinations.filter((d) => d.region === r).length}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="container-page py-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <p className="text-sm text-muted" aria-live="polite"><span className="display text-2xl text-navy">{list.length}</span> {t("count", { count: list.length }).replace(String(list.length), "").trim()}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted"><ShieldCheck className="size-3.5" />{t("visaNote")}</p>
        </div>
        {list.length === 0 ? (
          <EmptyState title={t("empty")} action={<Button variant="outline" onClick={() => { setQ(""); setRegion(""); setGoal(""); }}>{t("all")}</Button>} />
        ) : (
          <div key={`${q}|${region}|${goal}`} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((d, i) => (
              <Link key={d.slug} href={`/countries/${d.slug}`} className="reveal lift group flex flex-col rounded-(--radius-card) border border-line bg-white p-6" style={{ "--i": i } as React.CSSProperties}
                onMouseEnter={() => setHover(d.slug)} onMouseLeave={() => setHover(null)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-full bg-navy-50 text-sm font-bold tracking-wide text-navy">{d.iso}</span>
                    <div><h3 className="font-semibold text-navy">{d.name}</h3><p className="text-xs text-muted">{d.regionLabel}</p></div>
                  </div>
                  {d.experts > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-600"><span className="live-dot" />{d.experts}</span>}
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">{d.overview}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">{d.opportunities.map((o) => <span key={o} className="rounded-full bg-cloud px-2.5 py-0.5 text-xs font-medium text-navy">{o}</span>)}</div>
                <div className="mt-6 flex items-center justify-between border-t border-line pt-4 text-xs text-muted">
                  <span className="flex items-center gap-1.5"><Languages className="size-3.5" />{d.languages}</span>
                  <span className="font-semibold text-navy transition group-hover:translate-x-0.5">{t("discover")}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
        <div className="mt-16 flex flex-col items-start gap-5 rounded-2xl bg-cloud p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div><h2 className="display text-2xl">{t("hesitate")}</h2><p className="mt-2 text-muted">{t("hesitateText")}</p></div>
          <Button asChild size="lg"><Link href="/solutions">{th("profileButton")}</Link></Button>
        </div>
      </div>
    </>
  );
}
