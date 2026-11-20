import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/primitives";
import { statusTone } from "@/components/booking/booking-summary";
import { DataTable } from "@/components/dashboard/data-table";
import { PageTitle } from "@/components/dashboard/shell";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPrice } from "@/lib/utils";

export default async function PaymentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations();
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("reference, amount, currency, status, provider, is_live, created_at, bookings(reference)")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false });
  return (
    <>
      <PageTitle title={t("dashboard.payments")} />
      <DataTable
        empty={t("dashboard.noPayments")}
        columns={[t("booking.reference"), t("dashboard.date"), t("dashboard.amount"), t("dashboard.provider"), t("dashboard.status")]}
        rows={(data ?? []).map((p) => [
          <span key="r" className="font-mono text-xs">{(p.bookings as unknown as { reference: string })?.reference}<br />{p.reference}</span>,
          formatDate(p.created_at, locale),
          <span key="a" className="font-semibold text-navy">{formatPrice(p.amount, p.currency, locale)}</span>,
          <span key="p">{p.provider}{!p.is_live && <Badge tone="warning" className="ml-2">{t("dashboard.testMode")}</Badge>}</span>,
          <Badge key="s" tone={statusTone(p.status)}>{t(`status.${p.status}` as "status.pending")}</Badge>,
        ])}
      />
    </>
  );
}
