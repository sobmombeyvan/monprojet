"use client";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/form-controls";
import { EmptyState } from "@/components/ui/primitives";

type Country = { slug: string; name_fr: string; name_en: string; region: string; flag_emoji: string | null; overview_fr: string | null; overview_en: string | null };

export function CountryDirectory({ countries }: { countries: Country[] }) {
  const t = useTranslations("countries");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const filtered = useMemo(
    () => countries.filter((c) => !q || norm(`${c.name_fr} ${c.name_en}`).includes(norm(q))),
    [countries, q],
  );
  const regions = [...new Set(filtered.map((c) => c.region))];
  return (
    <div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} className="pl-9" aria-label={t("searchPlaceholder")} />
      </div>
      {filtered.length === 0 && <div className="mt-8"><EmptyState title={t("empty")} /></div>}
      {regions.map((r) => (
        <section key={r} className="mt-10">
          <h2 className="text-lg font-semibold">{t(`regions.${r}` as "regions.europe")}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.filter((c) => c.region === r).map((c) => (
              <Link key={c.slug} href={`/countries/${c.slug}`} className="group flex gap-4 rounded-[var(--radius-card)] border border-line bg-white p-5 transition-all hover:border-teal hover:shadow-[var(--shadow-card)]">
                <span className="text-3xl" aria-hidden>{c.flag_emoji}</span>
                <span>
                  <span className="block font-semibold text-navy group-hover:text-teal-600">{locale === "en" ? c.name_en : c.name_fr}</span>
                  <span className="mt-1 line-clamp-2 block text-sm text-muted">{locale === "en" ? c.overview_en : c.overview_fr}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
