import { CalendarDays } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { statusTone } from "@/components/booking/booking-summary";
import { CallButtons } from "@/components/booking/call-buttons";
import { formatDateTime, formatPrice, loc } from "@/lib/utils";

type Row = Record<string, unknown>;

export async function BookingList({ bookings, emptyAction = true }: { bookings: Row[]; emptyAction?: boolean }) {
  const t = await getTranslations();
  const locale = await getLocale();
  if (bookings.length === 0)
    return (
      <EmptyState
        icon={CalendarDays}
        title={t("dashboard.noBookings")}
        description={t("dashboard.noBookingsText")}
        action={emptyAction ? <Button asChild><Link href="/find-expert">{t("nav.findExpert")}</Link></Button> : undefined}
      />
    );
  return (
    <ul className="space-y-3">
      {bookings.map((b) => {
        const c = b.consultants as Row;
        const s = b.services as Row;
        return (
          <li key={String(b.id)}>
            <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-600">
                <CalendarDays className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-navy">{loc(s, "name", locale)}</p>
                  <Badge tone={statusTone(String(b.status))}>{t(`status.${b.status}` as "status.confirmed")}</Badge>
                </div>
                <p className="text-sm text-muted">
                  {String(c?.professional_name ?? "")} · {formatDateTime(String(b.starts_at), locale)}
                </p>
                <p className="font-mono text-xs text-muted">{String(b.reference)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-navy">{formatPrice(b.price as number, String(b.currency), locale)}</span>
                <CallButtons booking={b} />
                <Button asChild size="sm" variant="outline">
                  <Link href={`/booking/${b.reference}`}>{t("common.view")}</Link>
                </Button>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
