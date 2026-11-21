"use client";
import { Check, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { createContext, useContext, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/primitives";
import type { ConsultantCard } from "@/lib/data/queries";
import { cn, formatPrice } from "@/lib/utils";

const Ctx = createContext<{ ids: string[]; toggle: (id: string) => void; clear: () => void } | null>(null);

/** Comparateur : jusqu'à 3 experts, barre fixe en bas d'écran et tableau côte à côte. */
export function CompareProvider({ experts, children }: { experts: ConsultantCard[]; children: React.ReactNode }) {
  const t = useTranslations();
  const locale = useLocale();
  const [ids, setIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [warn, setWarn] = useState(false);
  const toggle = (id: string) =>
    setIds((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 3) { setWarn(true); setTimeout(() => setWarn(false), 2500); return cur; }
      return [...cur, id];
    });
  const selected = ids.map((id) => experts.find((e) => e.id === id)).filter((x): x is ConsultantCard => !!x);
  const L = (o: { fr: string; en: string }) => (locale === "en" ? o.en : o.fr);
  const rows: [string, (c: ConsultantCard) => React.ReactNode][] = [
    [t("experts.profileType"), (c) => t(`common.${c.verification_status === "verified" ? "verified" : c.verification_status === "pending" ? "pendingVerification" : "unverified"}`)],
    [t("common.from"), (c) => <span className="font-semibold text-navy">{c.starting_price !== null ? formatPrice(c.starting_price, c.starting_currency, locale) : t("common.onQuote")}</span>],
    [t("profile.reviews"), (c) => (c.reviews_count ? `${Number(c.rating_avg).toFixed(1)} / 5 (${c.reviews_count})` : "—")],
    [t("profile.experience"), (c) => t("common.years", { count: c.years_experience })],
    [t("experts.countriesCovered"), (c) => c.countries.map(L).join(", ") || "—"],
    [t("experts.languages"), (c) => c.languages.map(L).join(", ")],
    ["Certifications", (c) => c.certifications.length || "—"],
    [t("profile.methods"), (c) => c.methods.map((m) => t(`methods.${m}` as "methods.video")).join(", ")],
  ];

  return (
    <Ctx.Provider value={{ ids, toggle, clear: () => setIds([]) }}>
      {children}
      {warn && <div role="status" className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-navy px-4 py-3 text-sm font-medium text-white shadow-(--shadow-lift)">{t("experts.compareMax")}</div>}
      {selected.length > 0 && (
        <div className="sheet fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="container-page flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">{selected.map((c) => <span key={c.id} className="rounded-full ring-2 ring-white"><Avatar src={c.photo_url} name={c.professional_name} size={36} /></span>)}</div>
              <p className="text-sm font-semibold text-navy">{t("experts.selected", { count: selected.length })}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIds([])}>{t("experts.clear")}</Button>
              <Button size="sm" disabled={selected.length < 2} onClick={() => setOpen(true)}>{t("experts.compare")}</Button>
            </div>
          </div>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 sm:items-center sm:p-6" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={t("experts.compareTitle")} className="sheet max-h-[90vh] w-full max-w-4xl overflow-auto rounded-t-3xl bg-white sm:rounded-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-line bg-white px-6 py-4">
              <h2 className="display text-2xl">{t("experts.compareTitle")}</h2>
              <button onClick={() => setOpen(false)} className="rounded-full p-2 text-muted hover:text-navy" aria-label="×"><X className="size-5" /></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead><tr><th className="w-44 px-6 py-5" />{selected.map((c) => (
                  <th key={c.id} className="px-4 py-5 align-top"><div className="flex items-center gap-3"><Avatar src={c.photo_url} name={c.professional_name} size={44} /><p className="font-semibold text-navy">{c.professional_name}</p></div></th>
                ))}</tr></thead>
                <tbody className="divide-y divide-line">
                  {rows.map(([label, fn]) => (
                    <tr key={label}><th className="px-6 py-4 align-top text-xs font-semibold text-muted">{label}</th>{selected.map((c) => <td key={c.id} className="px-4 py-4 align-top text-slate-700">{fn(c)}</td>)}</tr>
                  ))}
                  <tr><th className="px-6 py-5" />{selected.map((c) => (
                    <td key={c.id} className="px-4 py-5"><div className="flex flex-wrap gap-2">
                      <Button asChild size="sm"><Link href={`/booking?expert=${c.slug}`}>{t("profile.bookThis")}</Link></Button>
                      <Button asChild variant="outline" size="sm"><Link href={`/experts/${c.slug}`}>{t("common.view")}</Link></Button>
                    </div></td>
                  ))}</tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function CompareToggle({ id }: { id: string }) {
  const t = useTranslations("experts");
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  const on = ctx.ids.includes(id);
  return (
    <div className="-mt-1 mb-4 flex justify-end text-xs">
      <button type="button" aria-pressed={on} onClick={() => ctx.toggle(id)} className={cn("flex items-center gap-1.5 font-semibold hover:text-navy", on ? "text-navy" : "text-muted")}>
        <span className={cn("grid size-4 place-items-center rounded border border-current", on && "bg-navy text-white")}>{on && <Check className="size-3" />}</span>
        {t("compare")}
      </button>
    </div>
  );
}
