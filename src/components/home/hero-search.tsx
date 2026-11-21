"use client";
import { Search, SlidersHorizontal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

type Opt = { slug: string; name_fr: string; name_en: string };

/** Les trois filtres de l'accueil + deux actions : rechercher un expert, ou démarrer le parcours personnalisé. */
export function HeroSearch({ countries, specialties, services }: { countries: Opt[]; specialties: Opt[]; services: Opt[] }) {
  const t = useTranslations("home");
  const locale = useLocale();
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const name = (o: Opt) => (locale === "en" ? o.name_en : o.name_fr);
  const values = () => {
    const fd = new FormData(form.current!);
    return Object.fromEntries(["country", "procedure", "service"].map((k) => [k, String(fd.get(k) ?? "")]).filter(([, v]) => v));
  };
  const fields: [string, string, string, Opt[]][] = [
    ["country", t("searchCountry"), t("searchAnyCountry"), countries],
    ["procedure", t("searchProcedure"), t("searchAnyProcedure"), specialties],
    ["service", t("searchExpertise"), t("searchAnyService"), services],
  ];

  return (
    <form
      ref={form}
      onSubmit={(e) => { e.preventDefault(); router.push({ pathname: "/find-expert", query: values() }); }}
      role="search"
      className="rounded-2xl bg-white p-2 text-ink shadow-(--shadow-lift)"
    >
      <div className="grid gap-1 sm:grid-cols-3">
        {fields.map(([n, label, any, items], i) => (
          <label key={n} className={`block rounded-xl px-3.5 py-2.5 hover:bg-cloud ${i ? "sm:rounded-none sm:border-l sm:border-line" : ""}`}>
            <span className="block text-xs font-semibold text-navy">{label}</span>
            <select name={n} defaultValue="" className="mt-0.5 w-full appearance-none bg-transparent text-sm text-muted outline-none">
              <option value="">{any}</option>
              {items.map((o) => <option key={o.slug} value={o.slug}>{name(o)}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[auto_1fr]">
        <Button type="submit" variant="outline" size="lg"><Search /> {t("searchButton")}</Button>
        <Button type="button" size="lg" onClick={() => router.push({ pathname: "/solutions", query: values() })}>
          <SlidersHorizontal /> {t("profileButton")}
        </Button>
      </div>
    </form>
  );
}
