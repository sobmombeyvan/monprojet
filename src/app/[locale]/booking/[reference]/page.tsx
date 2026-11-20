import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { BookingSummary } from "@/components/booking/booking-summary";
import { CallButtons } from "@/components/booking/call-buttons";
import { HoldCountdown } from "@/components/booking/hold-countdown";
import { requireUser } from "@/lib/auth/session";
import { cancelBookingAction, payBookingAction } from "@/lib/booking/actions";
import { getPublicSetting } from "@/lib/data/queries";
import { paymentsAreLive } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";

export default async function BookingReferencePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; reference: string }>;
  searchParams: Promise<{ error?: string; payment?: string }>;
}) {
  const { locale, reference } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const { error } = await searchParams;
  const t = await getTranslations("booking");
  const tc = await getTranslations("call");
  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("*, consultants(professional_name, slug, user_id), services(name_fr, name_en)")
    .eq("reference", reference)
    .maybeSingle();
  if (!booking) notFound(); // RLS: other users' bookings are invisible
  const policy = await getPublicSetting<{ free_until_hours: number }>("cancellation_policy", { free_until_hours: 24 });

  const holdActive = booking.status === "pending_payment" && new Date(booking.hold_expires_at) > new Date();
  const isClient = booking.client_id === user.id;
  const sandbox = !paymentsAreLive();

  return (
    <div className="bg-cloud">
      <div className="container-page max-w-3xl py-10">
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-lg font-semibold">{t("summary")}</h1>
            {holdActive && <HoldCountdown expiresAt={booking.hold_expires_at} />}
          </CardHeader>
          <CardBody className="space-y-5">
            {error && <Alert tone="error">{t(`errors.${error}` as "errors.generic")}</Alert>}
            <BookingSummary booking={booking} />

            {holdActive && isClient && (
              <form action={payBookingAction} className="space-y-3">
                <input type="hidden" name="bookingId" value={booking.id} />
                <input type="hidden" name="reference" value={booking.reference} />
                {sandbox && <Alert tone="warning">{t("sandboxNotice")}</Alert>}
                <Button type="submit" size="lg" className="w-full">
                  <Lock /> {t("pay", { amount: new Intl.NumberFormat(locale === "en" ? "en-GB" : "fr-FR", { style: "currency", currency: booking.currency, maximumFractionDigits: booking.currency === "XAF" ? 0 : 2 }).format(booking.price).replace("XAF", "FCFA") })}
                </Button>
                <p className="text-xs text-muted">{t("payNotice")}</p>
              </form>
            )}

            {booking.status === "pending_payment" && !holdActive && (
              <Alert tone="warning">
                {t("holdExpired")}{" "}
                <Link href={booking.consultants?.slug ? `/booking?expert=${booking.consultants.slug}` : "/find-expert"} className="font-semibold underline">{t("title")}</Link>
              </Alert>
            )}
            {booking.status === "expired" && (
              <Alert tone="warning">
                {t("holdExpired")}{" "}
                <Link href={booking.consultants?.slug ? `/booking?expert=${booking.consultants.slug}` : "/find-expert"} className="font-semibold underline">{t("title")}</Link>
              </Alert>
            )}

            {booking.status === "confirmed" && (
              <div className="space-y-3">
                <Alert tone="success" title={t("confirmedTitle")}>{t("cancelPolicy", { hours: policy.free_until_hours })}</Alert>
                {booking.method !== "in_person" && (
                  <div className="space-y-2 rounded-lg border border-line p-4">
                    <CallButtons booking={booking} size="md" phone={isClient ? null : booking.client_phone} />
                    <p className="text-xs text-muted">{tc("hint")}</p>
                  </div>
                )}
                <details className="rounded-lg border border-line p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-danger">{t("cancelBooking")}</summary>
                  <form action={cancelBookingAction} className="mt-3 space-y-3">
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <textarea name="reason" maxLength={500} className="w-full rounded-lg border border-line p-3 text-sm" placeholder="…" />
                    <Button type="submit" variant="danger" size="sm">{t("cancelConfirm")}</Button>
                  </form>
                </details>
              </div>
            )}

            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard/bookings">{t("viewBookings")}</Link>
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
