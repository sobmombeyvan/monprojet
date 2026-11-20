import { getLocale, getTranslations } from "next-intl/server";
import { StatCard } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";

type Metrics = {
  total_users: number; registered_consultants: number; verified_consultants: number; total_bookings: number;
  completed_consultations: number; revenue: Record<string, number>; platform_commissions: Record<string, number>;
  consultant_earnings: Record<string, number>; pending_payments: number; refunds: number;
  monthly: { month: string; bookings: number; paid_bookings: number }[];
};

export async function getAdminMetrics(from?: string, to?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_metrics", { p_from: from || null, p_to: to || null });
  if (error) throw new Error(error.message);
  return data as Metrics;
}

export async function AdminMetricCards({ m }: { m: Metrics }) {
  const t = await getTranslations("admin");
  const locale = await getLocale();
  const money = (o: Record<string, number>) =>
    Object.keys(o).length ? Object.entries(o).map(([c, v]) => formatPrice(v, c, locale)).join(" · ") : formatPrice(0, "XAF", locale);
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label={t("totalUsers")} value={m.total_users} />
      <StatCard label={t("registeredConsultants")} value={m.registered_consultants} />
      <StatCard label={t("verifiedConsultants")} value={m.verified_consultants} />
      <StatCard label={t("totalBookings")} value={m.total_bookings} />
      <StatCard label={t("completed")} value={m.completed_consultations} />
      <StatCard label={t("revenue")} value={money(m.revenue)} />
      <StatCard label={t("platformCommissions")} value={money(m.platform_commissions)} />
      <StatCard label={t("consultantEarnings")} value={money(m.consultant_earnings)} />
      <StatCard label={t("pendingPayments")} value={m.pending_payments} />
      <StatCard label={t("refunds")} value={m.refunds} />
    </div>
  );
}

/** Lightweight bar chart (no chart library) of monthly bookings. */
export function MonthlyChart({ data }: { data: Metrics["monthly"] }) {
  const max = Math.max(1, ...data.map((d) => d.bookings));
  return (
    <div className="flex h-48 items-end gap-2" role="img" aria-label="Monthly bookings">
      {data.map((d) => (
        <div key={d.month} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-1 items-end gap-0.5">
            <div className="w-1/2 rounded-t bg-navy/20" style={{ height: `${(d.bookings / max) * 100}%` }} title={`${d.bookings}`} />
            <div className="w-1/2 rounded-t bg-teal" style={{ height: `${(d.paid_bookings / max) * 100}%` }} title={`${d.paid_bookings}`} />
          </div>
          <span className="text-[10px] text-muted">{d.month.slice(2)}</span>
        </div>
      ))}
    </div>
  );
}
