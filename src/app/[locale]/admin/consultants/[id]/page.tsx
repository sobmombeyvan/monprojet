import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ConsultantEditor } from "@/components/admin/consultant-editor";
import { getReferenceData } from "@/lib/data/queries";
import { createClient } from "@/lib/supabase/server";
import type { AdminConsultantInput } from "@/lib/validation/admin-consultant";

type Row = Record<string, unknown>;

export default async function EditConsultantPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const supabase = await createClient(); // l'accès admin est vérifié par le layout /admin et par la RLS
  const [{ data: c }, ref] = await Promise.all([
    supabase
      .from("consultants")
      .select(`*, consultant_countries(countries(slug)), consultant_specialties(specialties(slug)), consultant_languages(language_code),
        consultant_certifications(*), consultant_qualifications(*), consultant_services(*), availability(*)`)
      .eq("id", id)
      .maybeSingle(),
    getReferenceData(),
  ]);
  if (!c) notFound();
  const name = (o: { name_fr: string; name_en: string }) => (locale === "en" ? o.name_en : o.name_fr);

  const initial: AdminConsultantInput = {
    professionalName: c.professional_name, slug: c.slug, titleFr: c.title_fr ?? "", titleEn: c.title_en ?? "",
    shortBioFr: c.short_bio_fr ?? "", shortBioEn: c.short_bio_en ?? "", bioFr: c.bio_fr ?? "", bioEn: c.bio_en ?? "",
    photoUrl: c.photo_url, city: c.city ?? "", yearsExperience: c.years_experience, timezone: c.timezone,
    consultantType: c.consultant_type, licenseNumber: c.license_number ?? "", licenseAuthority: c.license_authority ?? "",
    verificationStatus: c.verification_status, isPublished: c.is_published, acceptsBookings: c.accepts_bookings,
    commissionRate: c.commission_rate === null ? "" : Number(c.commission_rate), methods: c.methods,
    countries: (c.consultant_countries as Row[]).map((x) => (x.countries as { slug: string }).slug),
    specialties: (c.consultant_specialties as Row[]).map((x) => (x.specialties as { slug: string }).slug),
    languages: (c.consultant_languages as Row[]).map((x) => String(x.language_code)),
    certifications: (c.consultant_certifications as Row[]).map((x) => ({ id: String(x.id), title: String(x.title), issuer: String(x.issuer), year: (x.year_obtained as number) ?? null, verified: !!x.is_verified })),
    qualifications: (c.consultant_qualifications as Row[]).map((x) => ({ id: String(x.id), title: String(x.title), institution: String(x.institution ?? ""), level: (x.level as AdminConsultantInput["qualifications"][number]["level"]) ?? "other", year: (x.year_obtained as number) ?? null, verified: !!x.is_verified })),
    services: (c.consultant_services as Row[]).filter((x) => x.is_active).map((x) => ({ id: String(x.id), serviceId: String(x.service_id), price: x.price === null ? null : Number(x.price), currency: x.currency as "XAF", duration: Number(x.duration_minutes), methods: x.methods as AdminConsultantInput["methods"] })),
    availability: (c.availability as Row[]).map((x) => ({ weekday: Number(x.weekday), start: String(x.start_time).slice(0, 5), end: String(x.end_time).slice(0, 5) })),
  };

  return (
    <ConsultantEditor
      consultantId={c.id}
      userId={c.user_id}
      publicSlug={c.slug}
      initial={initial}
      countries={ref.countries.filter((x) => x.slug !== "cameroon").map((x) => ({ value: x.slug, label: name(x) }))}
      specialties={ref.specialties.map((x) => ({ value: x.slug, label: name(x) }))}
      languages={ref.languages.map((x) => ({ value: x.code, label: name(x) }))}
      services={ref.services.filter((s) => s.is_bookable).map((s) => ({ id: s.id, name: name(s), basePrice: s.base_price === null ? null : Number(s.base_price), currency: s.currency }))}
    />
  );
}
