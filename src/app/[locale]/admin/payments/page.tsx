import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { statusTone } from "@/components/booking/booking-summary";
import { DataTable } from "@/components/dashboard/data-table";
import { PageTitle } from "@/components/dashboard/shell";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPrice } from "@/lib/utils";

export default async function AdminPaymentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const supabase = await createClient();
  const [{ data }, { data: hooks }, { data: refunds }] = await Promise.all([
    supabase.from("payments").select("*, bookings(reference)").order("created_at", { ascending: false }).limit(200),
    supabase.from("payment_webhooks").select("id, provider, event_type, signature_valid, processed_at, processing_error, received_at").order("received_at", { ascending: false }).limit(20),
    supabase.from("refunds").select("*, payments(reference, currency)").order("created_at", { ascending: false }).limit(50),
  ]);
  return (
    <>
      <PageTitle
        title={t("admin.payments")}
        action={<Button asChild variant="outline" size="sm"><a href="/api/admin/export?type=payments">{t("admin.export")}</a></Button>}
      />
      <DataTable
        empty={t("dashboard.noPayments")}
        columns={[t("booking.reference"), t("dashboard.date"), t("dashboard.amount"), t("consultant.commission"), t("dashboard.provider"), t("dashboard.status")]}
        rows={(data ?? []).map((p) => [
          <span key="r" className="font-mono text-xs">{p.reference}<br />{(p.bookings as { reference: string }).reference}</span>,
          formatDate(p.created_at, locale, { dateStyle: "short", timeStyle: "short" }),
          formatPrice(p.amount, p.currency, locale),
          p.platform_commission !== null ? formatPrice(p.platform_commission, p.currency, locale) : "—",
          <span key="p">{p.provider}{!p.is_live && <Badge tone="warning" className="ml-1">test</Badge>}</span>,
          <Badge key="s" tone={statusTone(p.status)}>{t(`status.${p.status}` as "status.pending")}</Badge>,
        ])}
      />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><h2 className="font-semibold">{t("admin.refunds")}</h2></CardHeader>
          <CardBody>
            <ul className="space-y-2 text-sm">
              {(refunds ?? []).length === 0 && <li className="text-muted">—</li>}
              {(refunds ?? []).map((r) => (
                <li key={r.id} className="flex justify-between gap-3">
                  <span className="font-mono text-xs">{(r.payments as { reference: string }).reference}</span>
                  <span>{formatPrice(r.amount, (r.payments as { currency: string }).currency, locale)}</span>
                  <Badge tone="warning">{r.status}</Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><h2 className="font-semibold">Webhooks</h2></CardHeader>
          <CardBody>
            <ul className="space-y-1.5 font-mono text-xs">
              {(hooks ?? []).map((h) => (
                <li key={h.id} className={h.signature_valid ? (h.processing_error ? "text-danger" : "text-slate-700") : "text-danger"}>
                  {formatDate(h.received_at, locale, { dateStyle: "short", timeStyle: "medium" })} · {h.provider} · {h.event_type ?? "invalid-signature"} · {h.processed_at ? "✓" : h.processing_error ?? "…"}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
