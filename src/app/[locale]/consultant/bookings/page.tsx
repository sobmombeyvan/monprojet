import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { Alert, Badge, Card, EmptyState } from "@/components/ui/primitives";
import { statusTone } from "@/components/booking/booking-summary";
import { CallButtons } from "@/components/booking/call-buttons";
import { PageTitle } from "@/components/dashboard/shell";
import { completeBookingAction, setMeetingLinkAction } from "@/lib/actions/dashboard";
import { cancelBookingAction } from "@/lib/booking/actions";
import { requireUser } from "@/lib/auth/session";
import { getMyConsultant } from "@/lib/data/consultant";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatPrice, loc } from "@/lib/utils";

export default async function ConsultantBookingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, ["consultant"]);
  const t = await getTranslations();
  const c = await getMyConsultant(user.id);
  if (!c) return <Alert>{t("consultant.onboardingText")}</Alert>;
  const supabase = await createClient();
  // RLS: only bookings assigned to this consultant are returned
  const { data } = await supabase
    .from("bookings")
    .select("*, services(name_fr, name_en), countries:destination_country_id(name_fr, name_en)")
    .eq("consultant_id", c.id)
    .in("status", ["confirmed", "completed", "cancelled", "refund_required"])
    .order("starts_at", { ascending: false })
    .limit(100);
  const now = new Date();

  return (
    <>
      <PageTitle title={t("consultant.bookings")} />
      {(data ?? []).length === 0 ? (
        <EmptyState title={t("consultant.noBookings")} />
      ) : (
        <ul className="space-y-3">
          {data!.map((b) => (
            <li key={b.id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-navy">{loc(b.services, "name", locale)}</p>
                      <Badge tone={statusTone(b.status)}>{t(`status.${b.status}` as "status.confirmed")}</Badge>
                    </div>
                    <p className="text-sm text-muted">{formatDateTime(b.starts_at, locale, c.timezone)} · {t(`methods.${b.method}` as "methods.video")}</p>
                    <p className="font-mono text-xs text-muted">{b.reference}</p>
                  </div>
                  <p className="font-semibold text-navy">{formatPrice(b.price, b.currency, locale)}</p>
                </div>
                {/* Client information — visible only for assigned bookings */}
                <dl className="mt-4 grid gap-x-6 gap-y-1 rounded-lg bg-cloud p-3 text-sm sm:grid-cols-2">
                  <div><dt className="inline text-muted">{t("booking.fullName")} : </dt><dd className="inline text-navy">{b.client_full_name}</dd></div>
                  <div><dt className="inline text-muted">{t("booking.email")} : </dt><dd className="inline text-navy">{b.client_email}</dd></div>
                  <div><dt className="inline text-muted">{t("booking.phone")} : </dt><dd className="inline text-navy">{b.client_phone}</dd></div>
                  <div><dt className="inline text-muted">{t("booking.destination")} : </dt><dd className="inline text-navy">{loc(b.countries, "name", locale) || "—"}</dd></div>
                  {b.project_description && <div className="sm:col-span-2"><dt className="text-muted">{t("booking.description")}</dt><dd className="whitespace-pre-line text-navy">{b.project_description}</dd></div>}
                </dl>
                {b.status === "confirmed" && (
                  <div className="mt-4">
                    <CallButtons booking={b} phone={b.client_phone} />
                  </div>
                )}
                {b.status === "confirmed" && (
                  <div className="mt-4 flex flex-wrap items-end gap-3">
                    <form action={setMeetingLinkAction} className="flex flex-1 gap-2">
                      <input type="hidden" name="id" value={b.id} />
                      <Input name="url" type="url" placeholder="https://meet…" defaultValue={b.meeting_url ?? ""} aria-label={t("consultant.meetingLink")} className="min-w-48" />
                      <Button type="submit" variant="outline">{t("common.save")}</Button>
                    </form>
                    {new Date(b.starts_at) < now && (
                      <form action={completeBookingAction}>
                        <input type="hidden" name="id" value={b.id} />
                        <Button type="submit">{t("consultant.markCompleted")}</Button>
                      </form>
                    )}
                    {new Date(b.starts_at) > now && (
                      <form action={cancelBookingAction}>
                        <input type="hidden" name="bookingId" value={b.id} />
                        <input type="hidden" name="reason" value="consultant unavailable" />
                        <Button type="submit" variant="ghost" className="text-danger">{t("booking.cancelBooking")}</Button>
                      </form>
                    )}
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
