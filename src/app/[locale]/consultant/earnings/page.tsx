import { getTranslations, setRequestLocale } from "next-intl/server";
import { Alert, Badge, StatCard } from "@/components/ui/primitives";
import { DataTable } from "@/components/dashboard/data-table";
import { PageTitle } from "@/components/dashboard/shell";
import { requireUser } from "@/lib/auth/session";
import { getMyConsultant } from "@/lib/data/consultant";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPrice } from "@/lib/utils";

export default async function EarningsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, ["consultant"]);
  const t = await getTranslations();
  const c = await getMyConsultant(user.id);
  if (!c) return <Alert>{t("consultant.onboardingText")}</Alert>;
  const supabase = await createClient();
  const { data } = await supabase
    .from("commission_records")
    .select("*, bookings(reference)")
    .eq("consultant_id", c.id)
    .order("created_at", { ascending: false });
  const rows = (data ?? []).filter((r) => r.status !== "reversed");
  const sum = (k: string) => rows.reduce((s, r) => s + Number(r[k]), 0);
  return (
    <>
      <PageTitle title={t("consultant.earnings")} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label={t("consultant.grossRevenue")} value={formatPrice(sum("gross_amount"), "XAF", locale)} />
        <StatCard label={t("consultant.commission")} value={formatPrice(sum("commission_amount"), "XAF", locale)} />
        <StatCard label={t("consultant.net")} value={formatPrice(sum("consultant_amount"), "XAF", locale)} />
      </div>
      <DataTable
        empty={t("dashboard.noPayments")}
        columns={[t("booking.reference"), t("dashboard.date"), t("consultant.grossRevenue"), t("consultant.commission"), t("consultant.net"), t("dashboard.status")]}
        rows={(data ?? []).map((r) => [
          <span key="r" className="font-mono text-xs">{(r.bookings as { reference: string }).reference}</span>,
          formatDate(r.created_at, locale),
          formatPrice(r.gross_amount, r.currency, locale),
          `${formatPrice(r.commission_amount, r.currency, locale)} (${Math.round(Number(r.commission_rate) * 100)} %)`,
          <span key="n" className="font-semibold text-navy">{formatPrice(r.consultant_amount, r.currency, locale)}</span>,
          <Badge key="s" tone={r.status === "available" ? "success" : r.status === "paid_out" ? "teal" : "warning"}>{r.status}</Badge>,
        ])}
      />
    </>
  );
}
