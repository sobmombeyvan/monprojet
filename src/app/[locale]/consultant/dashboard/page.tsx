import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Alert, StatCard } from "@/components/ui/primitives";
import { VerificationBadge } from "@/components/experts/badges";
import { BookingList } from "@/components/dashboard/booking-list";
import { PageTitle } from "@/components/dashboard/shell";
import { requireUser } from "@/lib/auth/session";
import { getMyConsultant } from "@/lib/data/consultant";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";

export default async function ConsultantDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, ["consultant"]);
  const t = await getTranslations("consultant");
  const c = await getMyConsultant(user.id);
  if (!c) {
    return (
      <>
        <PageTitle title={t("onboardingTitle")} />
        <Alert title={t("onboardingTitle")}>{t("onboardingText")}</Alert>
        <Button asChild className="mt-4"><Link href="/consultant/profile">{t("profile")}</Link></Button>
      </>
    );
  }
  const supabase = await createClient();
  const [{ data: upcoming }, { data: comm }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, reference, status, starts_at, ends_at, method, price, currency, meeting_url, consultants(professional_name), services(name_fr, name_en)")
      .eq("consultant_id", c.id)
      .eq("status", "confirmed")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(5),
    supabase.from("commission_records").select("consultant_amount, currency, status").eq("consultant_id", c.id),
  ]);
  const net = (comm ?? []).filter((r) => r.status !== "reversed").reduce((s, r) => s + Number(r.consultant_amount), 0);
  return (
    <>
      <PageTitle title={c.professional_name} action={<VerificationBadge status={c.verification_status} />} />
      {!c.is_published && <Alert tone="warning" className="mb-6" title={t("notPublished")}>{t("onboardingText")}</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("upcomingCount")} value={upcoming?.length ?? 0} />
        <StatCard label={t("net")} value={formatPrice(net, "XAF", locale)} />
        <StatCard label={t("rating")} value={c.reviews_count ? `${Number(c.rating_avg).toFixed(1)} / 5` : "—"} hint={`${c.reviews_count} avis`} />
      </div>
      <h2 className="mb-3 mt-8 text-lg font-semibold">{t("bookings")}</h2>
      <BookingList bookings={upcoming ?? []} emptyAction={false} />
    </>
  );
}
