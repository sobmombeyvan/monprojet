import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/primitives";
import { BookingList } from "@/components/dashboard/booking-list";
import { PageTitle } from "@/components/dashboard/shell";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardOverview({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations();
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [{ data: upcoming }, { count: total }, { count: saved }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, reference, status, starts_at, ends_at, method, price, currency, meeting_url, consultants(professional_name), services(name_fr, name_en)")
      .eq("client_id", user.id)
      .in("status", ["confirmed", "pending_payment"])
      .gte("starts_at", nowIso)
      .order("starts_at")
      .limit(5),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("client_id", user.id).neq("status", "expired"),
    supabase.from("saved_consultants").select("consultant_id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  return (
    <>
      <PageTitle
        title={t("dashboard.welcome", { name: user.fullName.split(" ")[0] })}
        action={<Button asChild><Link href="/find-expert">{t("nav.findExpert")}</Link></Button>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("dashboard.upcoming")} value={upcoming?.length ?? 0} />
        <StatCard label={t("dashboard.bookings")} value={total ?? 0} />
        <StatCard label={t("dashboard.saved")} value={saved ?? 0} />
      </div>
      <h2 className="mb-3 mt-8 text-lg font-semibold">{t("dashboard.upcoming")}</h2>
      <BookingList bookings={upcoming ?? []} />
    </>
  );
}
