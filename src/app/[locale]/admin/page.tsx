import { requireUser } from "@/lib/auth/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { AdminMetricCards, getAdminMetrics, MonthlyChart } from "@/components/dashboard/admin-metrics";
import { PageTitle } from "@/components/dashboard/shell";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export default async function AdminOverview({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale, ["admin"]); // layout and page render in parallel: guard here too
  const t = await getTranslations("admin");
  const supabase = await createClient();
  const [m, { data: logs }] = await Promise.all([
    getAdminMetrics(),
    supabase.from("audit_logs").select("id, action, entity, entity_id, created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  return (
    <>
      <PageTitle title={t("overview")} />
      <AdminMetricCards m={m} />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><h2 className="font-semibold">{t("totalBookings")} / mois</h2></CardHeader>
          <CardBody><MonthlyChart data={m.monthly} /></CardBody>
        </Card>
        <Card>
          <CardHeader><h2 className="font-semibold">Audit log</h2></CardHeader>
          <CardBody>
            <ul className="space-y-1.5 font-mono text-xs text-slate-700">
              {(logs ?? []).map((l) => (
                <li key={l.id}>{formatDate(l.created_at, locale, { dateStyle: "short", timeStyle: "short" })} · {l.action} {l.entity} {String(l.entity_id ?? "").slice(0, 8)}</li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
