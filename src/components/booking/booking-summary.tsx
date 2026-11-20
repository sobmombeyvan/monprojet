import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/primitives";
import { formatDateTime, formatPrice, loc } from "@/lib/utils";

type Row = Record<string, unknown>;

export const statusTone = (s: string) =>
  (({ confirmed: "success", completed: "teal", pending_payment: "warning", successful: "success", failed: "danger", cancelled: "neutral", expired: "neutral", refund_required: "danger", refunded: "neutral", processing: "warning", pending: "warning" }) as const)[s] ?? "neutral";

export async function BookingSummary({ booking }: { booking: Row }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const c = booking.consultants as Row;
  const s = booking.services as Row;
  const rows: [string, React.ReactNode][] = [
    [t("booking.reference"), <span key="r" className="font-mono">{String(booking.reference)}</span>],
    [t("booking.step1"), loc(s, "name", locale)],
    [t("dashboard.consultant"), String(c?.professional_name ?? "—")],
    [t("booking.date"), formatDateTime(String(booking.starts_at), locale)],
    [t("booking.method"), t(`methods.${booking.method}` as "methods.video")],
    [t("booking.fullName"), String(booking.client_full_name)],
    [t("booking.email"), String(booking.client_email)],
    [t("booking.phone"), String(booking.client_phone)],
  ];
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Badge tone={statusTone(String(booking.status))}>{t(`status.${booking.status}` as "status.confirmed")}</Badge>
      </div>
      <dl className="divide-y divide-line text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-6 py-2.5">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-medium text-navy">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
        <span className="font-semibold text-navy">{t("booking.finalPrice")}</span>
        <span className="text-xl font-semibold text-navy">{formatPrice(booking.price as number, String(booking.currency), locale)}</span>
      </div>
    </div>
  );
}
