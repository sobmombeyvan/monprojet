import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { DataTable } from "@/components/dashboard/data-table";
import { PageTitle } from "@/components/dashboard/shell";
import { setCommissionStatusAction } from "@/lib/actions/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPrice } from "@/lib/utils";

export default async function AdminCommissionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const supabase = await createClient();
  const { data } = await supabase
    .from("commission_records")
    .select("*, consultants(professional_name), bookings(reference)")
    .order("created_at", { ascending: false })
    .limit(200);
  return (
    <>
      <PageTitle title={t("admin.commissions")} />
      <DataTable
        empty="—"
        columns={[t("booking.reference"), t("dashboard.consultant"), t("dashboard.date"), t("consultant.grossRevenue"), t("consultant.commission"), t("consultant.net"), t("dashboard.status"), ""]}
        rows={(data ?? []).map((r) => [
          <span key="r" className="font-mono text-xs">{(r.bookings as { reference: string }).reference}</span>,
          (r.consultants as { professional_name: string } | null)?.professional_name ?? "—",
          formatDate(r.created_at, locale),
          formatPrice(r.gross_amount, r.currency, locale),
          `${formatPrice(r.commission_amount, r.currency, locale)} (${Math.round(Number(r.commission_rate) * 100)} %)`,
          formatPrice(r.consultant_amount, r.currency, locale),
          <Badge key="s">{r.status}</Badge>,
          r.status === "available" ? (
            <form key="p" action={setCommissionStatusAction}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="status" value="paid_out" />
              <Button size="sm" variant="outline" type="submit">Marquer versé</Button>
            </form>
          ) : null,
        ])}
      />
    </>
  );
}
