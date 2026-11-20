import { notFound } from "next/navigation";
import { BadgeCheck, Briefcase, CalendarDays, GraduationCap, MapPin, ShieldAlert, Star, Video } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Alert, Avatar, Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { ProfessionalTypeBadge, VerificationBadge } from "@/components/experts/badges";
import { SaveExpertButton } from "@/components/experts/save-button";
import { getSessionUser } from "@/lib/auth/session";
import { getConsultantBySlug } from "@/lib/data/queries";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPrice, loc } from "@/lib/utils";

type Row = Record<string, unknown>;

export async function generateMetadata({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale } = await params;
  const c = await getConsultantBySlug(slug);
  if (!c) return {};
  return { title: c.professional_name, description: loc(c, "short_bio", locale) || loc(c, "title", locale) };
}

export default async function ExpertProfilePage({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale } = await params;
  setRequestLocale(locale);
  const [c, user, t] = await Promise.all([getConsultantBySlug(slug), getSessionUser(), getTranslations()]);
  if (!c) notFound();

  let saved = false;
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase.from("saved_consultants").select("consultant_id").eq("consultant_id", c.id).maybeSingle();
    saved = !!data;
  }

  const verified = c.verification_status === "verified";
  const services = (c.consultant_services as Row[]).filter((s) => s.is_active);
  const days = t.raw("profile.days") as string[];
  const availability = [...(c.availability as { weekday: number; start_time: string; end_time: string }[])].sort(
    (a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7) || a.start_time.localeCompare(b.start_time),
  );

  return (
    <div className="bg-cloud">
      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Header */}
          <Card className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <Avatar src={c.photo_url} name={c.professional_name} size={112} />
              <div className="flex-1">
                <div className="flex flex-wrap gap-1.5">
                  <VerificationBadge status={c.verification_status} />
                  <ProfessionalTypeBadge type={c.consultant_type} verification={c.verification_status} />
                </div>
                <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">{c.professional_name}</h1>
                <p className="mt-1 text-muted">{loc(c, "title", locale)}</p>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-700">
                  {c.city && (
                    <span className="flex items-center gap-1.5"><MapPin className="size-4 text-teal" />{c.city}</span>
                  )}
                  <span className="flex items-center gap-1.5"><Briefcase className="size-4 text-teal" />{t("common.years", { count: c.years_experience })}</span>
                  <span className="flex items-center gap-1.5">
                    <Star className="size-4 fill-amber-400 text-amber-400" />
                    {c.reviews_count > 0 ? Number(c.rating_avg).toFixed(1) : "—"} · {t("common.reviews", { count: c.reviews_count })}
                  </span>
                </div>
              </div>
            </div>
            {/* Professional status: explicit, never implied (§7) */}
            <div className="mt-6">
              {verified ? (
                <Alert tone="info" title={t(`types.${c.consultant_type}` as "types.orientation_specialist")}>
                  {t(`types.${c.consultant_type}_desc` as "types.orientation_specialist_desc")}
                  {c.license_authority && (c.consultant_type === "authorized_legal_representative" || c.consultant_type === "licensed_professional") && (
                    <> · {t("profile.license", { authority: c.license_authority })}{c.license_number ? ` (${c.license_number})` : ""}</>
                  )}
                </Alert>
              ) : (
                <Alert tone="warning">{t("types.unverifiedNotice")}</Alert>
              )}
            </div>
          </Card>

          {/* About */}
          <Card>
            <CardHeader><h2 className="font-semibold">{t("profile.about")}</h2></CardHeader>
            <CardBody className="space-y-5">
              <p className="whitespace-pre-line leading-7 text-slate-700">{loc(c, "bio", locale) || loc(c, "short_bio", locale)}</p>
              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <h3 className="text-sm font-semibold">{t("experts.specialties")}</h3>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {(c.consultant_specialties as Row[]).map((s) => {
                      const sp = s.specialties as Row;
                      return <li key={String(sp.slug)}><Badge>{loc(sp, "name", locale)}</Badge></li>;
                    })}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{t("experts.countriesCovered")}</h3>
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {(c.consultant_countries as Row[]).map((x) => {
                      const co = x.countries as Row;
                      return (
                        <li key={String(co.slug)}>
                          <Link href={`/countries/${co.slug}`} className="hover:text-teal-600">{String(co.flag_emoji ?? "")} {loc(co, "name", locale)}</Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{t("experts.languages")}</h3>
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {(c.consultant_languages as Row[]).map((x) => {
                      const l = x.languages as Row;
                      return <li key={String(l.code)}>{loc(l, "name", locale)}</li>;
                    })}
                  </ul>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Certifications — contrôlées auprès de l'organisme émetteur */}
          <Card>
            <CardHeader className="flex items-center justify-between"><h2 className="font-semibold">Certifications</h2></CardHeader>
            <CardBody>
              {(c.consultant_certifications as Row[]).length === 0 ? (
                <p className="text-sm text-muted">—</p>
              ) : (
                <ul className="divide-y divide-line">
                  {(c.consultant_certifications as Row[]).map((x) => (
                    <li key={String(x.id)} className="flex items-start gap-4 py-3 first:pt-0 last:pb-0">
                      <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ${x.is_verified ? "bg-teal-50 text-teal-600" : "bg-cloud text-muted"}`}><BadgeCheck className="size-4" /></span>
                      <div className="flex-1"><p className="font-semibold text-navy">{String(x.title)}</p><p className="text-sm text-muted">{String(x.issuer)}{x.year_obtained ? ` · ${x.year_obtained}` : ""}</p></div>
                      {x.is_verified ? <Badge tone="teal"><BadgeCheck /> {t("profile.verifiedQualification")}</Badge> : <Badge tone="warning">{t("common.pendingVerification")}</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* Qualifications & experience */}
          <Card>
            <CardHeader><h2 className="font-semibold">{t("profile.qualifications")}</h2></CardHeader>
            <CardBody>
              <ul className="space-y-4">
                {(c.consultant_qualifications as Row[]).map((q) => (
                  <li key={String(q.id)} className="flex gap-3">
                    <GraduationCap className="mt-0.5 size-5 shrink-0 text-teal" />
                    <div>
                      <p className="font-medium text-navy">
                        {String(q.title)}{" "}
                        {q.is_verified ? (
                          <Badge tone="teal" className="ml-1"><BadgeCheck /> {t("profile.verifiedQualification")}</Badge>
                        ) : (
                          <Badge className="ml-1"><ShieldAlert /> {t("common.unverified")}</Badge>
                        )}
                      </p>
                      <p className="text-sm text-muted">
                        {[q.institution, q.year_obtained, q.level ? t(`experts.levels.${q.level}` as "experts.levels.other") : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              {(c.consultant_experiences as Row[]).length > 0 && (
                <>
                  <h3 className="mt-8 font-semibold">{t("profile.experience")}</h3>
                  <ul className="mt-3 space-y-3">
                    {(c.consultant_experiences as Row[]).map((e) => (
                      <li key={String(e.id)} className="text-sm">
                        <p className="font-medium text-navy">{String(e.role)} — {String(e.organization ?? "")}</p>
                        <p className="text-muted">{String(e.start_year ?? "")}–{String(e.end_year ?? "")}</p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardBody>
          </Card>

          {/* Reviews */}
          <Card>
            <CardHeader><h2 className="font-semibold">{t("profile.reviews")}</h2></CardHeader>
            <CardBody>
              {c.reviews.length === 0 ? (
                <p className="text-sm text-muted">{t("profile.noReviews")}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {(c.reviews as Row[]).map((r) => (
                    <li key={String(r.id)} className="py-4 first:pt-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-navy">{String(r.client_display_name ?? "—")}</span>
                        <span className="flex" aria-label={`${r.rating}/5`}>
                          {Array.from({ length: Number(r.rating) }).map((_, i) => (
                            <Star key={i} className="size-3.5 fill-amber-400 text-amber-400" />
                          ))}
                        </span>
                      </div>
                      {r.comment ? <p className="mt-1.5 text-sm text-slate-700">{String(r.comment)}</p> : null}
                      {r.consultant_reply ? (
                        <p className="mt-2 rounded-lg bg-cloud px-3 py-2 text-sm text-slate-700">
                          <span className="font-medium">{t("profile.reply")} : </span>{String(r.consultant_reply)}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted">{formatDate(String(r.created_at), locale)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Sidebar: services, prices, availability */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader><h2 className="font-semibold">{t("profile.services")}</h2></CardHeader>
            <CardBody className="space-y-3">
              {services.map((cs) => {
                const s = cs.services as Row;
                const price = cs.price ?? s.base_price;
                return (
                  <div key={String(cs.id)} className="rounded-lg border border-line p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-navy">{loc(s, "name", locale)}</p>
                        <p className="text-xs text-muted">{t("common.minutes", { count: Number(cs.duration_minutes) })}</p>
                      </div>
                      <p className="text-sm font-semibold text-navy">
                        {s.pricing_type === "quote" ? t("common.onQuote") : formatPrice(price as number, String(cs.price ? cs.currency : s.currency), locale)}
                      </p>
                    </div>
                    {s.is_bookable ? (
                      <Button asChild size="sm" className="mt-3 w-full">
                        <Link href={`/booking?expert=${c.slug}&cs=${cs.id}`}>{t("profile.bookThis")}</Link>
                      </Button>
                    ) : null}
                  </div>
                );
              })}
              <SaveExpertButton consultantId={c.id} initial={saved} signedIn={!!user} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader><h2 className="font-semibold">{t("profile.methods")}</h2></CardHeader>
            <CardBody>
              <ul className="flex flex-wrap gap-1.5">
                {(c.methods as string[]).map((m) => (
                  <li key={m}><Badge><Video /> {t(`methods.${m}` as "methods.video")}</Badge></li>
                ))}
              </ul>
              <h3 className="mt-5 flex items-center gap-1.5 text-sm font-semibold"><CalendarDays className="size-4 text-teal" />{t("profile.weekly", { tz: c.timezone })}</h3>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {availability.length === 0 && <li className="text-muted">{t("common.noAvailability")}</li>}
                {availability.map((a, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{days[a.weekday]}</span>
                    <span className="tabular-nums">{a.start_time.slice(0, 5)} – {a.end_time.slice(0, 5)}</span>
                  </li>
                ))}
              </ul>
              {verified && c.verified_at && (
                <p className="mt-5 text-xs text-muted">{t("profile.verifiedOn", { date: formatDate(c.verified_at, locale) })}</p>
              )}
              <p className="mt-1 font-mono text-[11px] text-muted">{t("profile.consultantId")}: {c.id.slice(0, 8).toUpperCase()}</p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
