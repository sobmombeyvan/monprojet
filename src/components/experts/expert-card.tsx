import { useLocale, useTranslations } from "next-intl";
import { ShieldCheck, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, Card } from "@/components/ui/primitives";
import type { ConsultantCard } from "@/lib/data/queries";
import { formatPrice } from "@/lib/utils";
import { ProfessionalTypeBadge, VerificationBadge } from "./badges";

export function ExpertCard({ c, toolbar }: { c: ConsultantCard; toolbar?: React.ReactNode }) {
  const t = useTranslations();
  const locale = useLocale();
  const L = (o: { fr: string; en: string }) => (locale === "en" ? o.en : o.fr);
  const title = locale === "en" ? (c.title_en ?? c.title_fr) : c.title_fr;
  const bio = locale === "en" ? (c.short_bio_en ?? c.short_bio_fr) : c.short_bio_fr;
  const certs = c.certifications ?? [];

  return (
    <Card className="lift flex h-full min-w-0 flex-col p-5 sm:p-6">
      {toolbar}
      <div className="flex items-start gap-4">
        <Avatar src={c.photo_url} name={c.professional_name} size={56} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 break-words text-[1.05rem] font-semibold leading-snug">
            <Link href={`/experts/${c.slug}`} className="underline-offset-4 hover:underline">{c.professional_name}</Link>
          </h3>
          <p className="mt-0.5 line-clamp-2 text-sm leading-6 text-muted">{title}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <VerificationBadge status={c.verification_status} />
            <ProfessionalTypeBadge type={c.consultant_type} verification={c.verification_status} />
          </div>
        </div>
      </div>
      {bio && <p className="mt-5 line-clamp-3 text-sm leading-6 text-slate-600">{bio}</p>}
      {certs.length > 0 && (
        <p className="mt-4 flex items-start gap-2 text-sm text-navy">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal-600" />
          <span><span className="font-semibold">{t("experts.certified", { count: certs.length })}</span> <span className="text-muted">· {certs[0].title}</span></span>
        </p>
      )}
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div className="col-span-2"><dt className="text-xs text-muted">{t("experts.countriesCovered")}</dt>
          <dd className="mt-1 flex flex-wrap gap-1">{c.countries.length ? <>
            {c.countries.slice(0, 6).map((x) => <span key={x.slug} className="iso" title={L(x)}>{x.iso ?? x.slug.slice(0, 2).toUpperCase()}</span>)}
            {c.countries.length > 6 && <span className="iso text-muted" title={c.countries.slice(6).map(L).join(", ")}>+{c.countries.length - 6}</span>}
          </> : "—"}</dd></div>
        <div><dt className="text-xs text-muted">{t("experts.languages")}</dt><dd className="mt-1 text-navy">{c.languages.slice(0, 3).map(L).join(", ")}</dd></div>
        <div><dt className="text-xs text-muted">{t("profile.experience")}</dt><dd className="mt-1 text-navy">{t("common.years", { count: c.years_experience })}</dd></div>
        <div><dt className="text-xs text-muted">{t("profile.reviews")}</dt>
          <dd className="mt-1 flex items-center gap-1 text-navy">{c.reviews_count > 0 ? <><Star className="size-3.5 fill-navy text-navy" /> {Number(c.rating_avg).toFixed(1)} <span className="text-muted">({c.reviews_count})</span></> : <span className="text-muted">—</span>}</dd></div>
      </dl>
      <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-line pt-5">
        <div><p className="text-xs text-muted">{t("common.from")}</p>
          <p className="text-lg font-semibold text-navy">{c.starting_price !== null ? formatPrice(c.starting_price, c.starting_currency, locale) : t("common.onQuote")}</p></div>
        <div className="flex shrink-0 gap-2">
          <Button asChild variant="outline" size="sm"><Link href={`/experts/${c.slug}`}>{t("common.view")}</Link></Button>
          <Button asChild size="sm"><Link href={`/booking?expert=${c.slug}`}>{t("profile.bookThis")}</Link></Button>
        </div>
      </div>
    </Card>
  );
}
