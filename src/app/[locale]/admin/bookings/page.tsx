import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { statusTone } from "@/components/booking/booking-summary";
import { DataTable } from "@/components/dashboard/data-table";
import { PageTitle } from "@/components/dashboard/shell";
import { cancelBookingAction } from "@/lib/booking/actions";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatPrice } from "@/lib/utils";

export default async function AdminBookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { status } = await searchParams;
  const t = await getTranslations();
  const supabase = await createClient();
  let q = supabase
    .from("bookings")
    .select("id, reference, status, starts_at, price, currency, client_full_name, consultants(professional_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) q = q.eq("status", status);
  const { data } = await q;
  return (
    <>
      <PageTitle
        title={t("admin.bookings")}
        action={<Button asChild variant="outline" size="sm"><a href="/api/admin/export?type=bookings">{t("admin.export")}</a></Button>}
      />
      <DataTable
        empty={t("dashboard.noBookings")}
        columns={[t("booking.reference"), t("booking.date"), "Client", t("dashboard.consultant"), t("dashboard.amount"), t("dashboard.status"), ""]}
        rows={(data ?? []).map((b) => [
          <span key="r" className="font-mono text-xs">{b.reference}</span>,
          formatDateTime(b.starts_at, locale),
          b.client_full_name,
          (b.consultants as unknown as { professional_name: string } | null)?.professional_name ?? "—",
          formatPrice(b.price, b.currency, locale),
          <Badge key="s" tone={statusTone(b.status)}>{t(`status.${b.status}` as "status.confirmed")}</Badge>,
          ["confirmed", "pending_payment"].includes(b.status) ? (
            <form key="c" action={cancelBookingAction}>
              <input type="hidden" name="bookingId" value={b.id} />
              <input type="hidden" name="reason" value="admin" />
              <Button size="sm" variant="ghost" className="text-danger" type="submit">{t("common.cancel")}</Button>
            </form>
          ) : null,
        ])}
      />
    </>
  );
}
