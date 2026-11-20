import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookingList } from "@/components/dashboard/booking-list";
import { PageTitle } from "@/components/dashboard/shell";
import { ReviewForm } from "@/components/dashboard/review-form";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function MyBookingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations("dashboard");
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("id, reference, status, starts_at, ends_at, method, price, currency, meeting_url, consultants(professional_name), services(name_fr, name_en), reviews(id)")
    .eq("client_id", user.id)
    .neq("status", "expired")
    .order("starts_at", { ascending: false });
  const toReview = (data ?? []).filter((b) => b.status === "completed" && (b.reviews as unknown[]).length === 0);
  return (
    <>
      <PageTitle title={t("bookings")} />
      {toReview.map((b) => (
        <ReviewForm key={b.id} bookingId={b.id} label={`${t("leaveReview")} — ${b.reference}`} />
      ))}
      <BookingList bookings={data ?? []} />
    </>
  );
}
