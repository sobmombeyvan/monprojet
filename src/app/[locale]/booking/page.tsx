import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookingWizard, type WizardOffer, type WizardService } from "@/components/booking/booking-wizard";
import { requireUser } from "@/lib/auth/session";
import { getPublicSetting, getReferenceData } from "@/lib/data/queries";
import { createClient } from "@/lib/supabase/server";
import { isoCountryOptions } from "@/lib/iso-countries";

export async function generateMetadata() {
  const t = await getTranslations("booking");
  return { title: t("title") };
}

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ expert?: string; cs?: string; service?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const sp = await searchParams;
  const supabase = await createClient();
  const t = await getTranslations("booking");

  const [ref, { data: offers }, { data: profile }, holdMinutes] = await Promise.all([
    getReferenceData(),
    supabase
      .from("consultant_services")
      .select(
        "id, price, currency, duration_minutes, methods, service_id, services!inner(id, slug, base_price, currency, is_bookable), consultants!inner(id, slug, professional_name, title_fr, title_en, photo_url, verification_status, consultant_type, rating_avg, reviews_count, is_published, accepts_bookings)",
      )
      .eq("is_active", true)
      .eq("consultants.is_published", true)
      .eq("consultants.accepts_bookings", true),
    supabase.from("profiles").select("full_name, email, phone, country_of_residence").eq("id", user.id).single(),
    getPublicSetting<number>("booking_hold_minutes", 15),
  ]);

  const services: WizardService[] = ref.services.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: locale === "en" ? s.name_en : s.name_fr,
    description: (locale === "en" ? s.description_en : s.description_fr) ?? "",
    icon: s.icon,
    pricingType: s.pricing_type,
    basePrice: s.base_price === null ? null : Number(s.base_price),
    currency: s.currency,
    bookable: s.is_bookable,
  }));

  const wizardOffers: WizardOffer[] = (offers ?? []).map((o) => {
    const s = o.services as unknown as { id: string; base_price: number | null; currency: string };
    const c = o.consultants as unknown as Record<string, string | number | null>;
    return {
      id: o.id,
      serviceId: s.id,
      price: Number(o.price ?? s.base_price ?? 0),
      currency: o.price !== null ? o.currency : s.currency,
      duration: o.duration_minutes,
      methods: o.methods,
      consultant: {
        id: String(c.id),
        slug: String(c.slug),
        name: String(c.professional_name),
        title: String((locale === "en" ? c.title_en : null) ?? c.title_fr),
        photo: (c.photo_url as string) ?? null,
        verification: String(c.verification_status),
        rating: Number(c.rating_avg),
        reviews: Number(c.reviews_count),
      },
    };
  });

  // Preselection from ?cs= (profile page) or ?expert= / ?service=
  const preOffer = wizardOffers.find((o) => o.id === sp.cs);
  const preService = preOffer?.serviceId ?? services.find((s) => s.slug === sp.service)?.id;

  return (
    <div className="bg-cloud">
      <div className="container-page py-10">
        <h1 className="text-2xl font-semibold sm:text-3xl">{t("title")}</h1>
        <BookingWizard
          services={services}
          offers={wizardOffers}
          countries={ref.countries.map((c) => ({ id: c.id, iso2: c.iso2, name: (locale === "en" ? c.name_en : c.name_fr) as string, flag: c.flag_emoji }))}
          residenceCountries={isoCountryOptions(locale)}
          holdMinutes={holdMinutes}
          initial={{
            serviceId: preService,
            offerId: preOffer?.id,
            expertSlug: sp.expert,
            fullName: profile?.full_name ?? "",
            email: profile?.email ?? user.email ?? "",
            phone: profile?.phone ?? "",
            countryOfResidence: profile?.country_of_residence ?? "CM",
          }}
        />
      </div>
    </div>
  );
}
