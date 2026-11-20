import { requireUser } from "@/lib/auth/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form-controls";
import { Card, CardBody } from "@/components/ui/primitives";
import { AdminMetricCards, getAdminMetrics, MonthlyChart } from "@/components/dashboard/admin-metrics";
import { PageTitle } from "@/components/dashboard/shell";

export default async function AdminAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale, ["admin"]); // layout and page render in parallel: guard here too
  const { from, to } = await searchParams;
  const valid = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined);
  const t = await getTranslations("admin");
  const m = await getAdminMetrics(valid(from), valid(to));
  const qs = new URLSearchParams({ ...(valid(from) && { from: from! }), ...(valid(to) && { to: to! }) }).toString();
  return (
    <>
      <PageTitle
        title={t("analytics")}
        action={<Button asChild variant="outline" size="sm"><a href={`/api/admin/export?type=payments&${qs}`}>{t("export")}</a></Button>}
      />
      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <div><Label htmlFor="from">Du / From</Label><Input id="from" name="from" type="date" defaultValue={valid(from)} /></div>
        <div><Label htmlFor="to">Au / To</Label><Input id="to" name="to" type="date" defaultValue={valid(to)} /></div>
        <Button type="submit">OK</Button>
      </form>
      <AdminMetricCards m={m} />
      <Card className="mt-6"><CardBody><MonthlyChart data={m.monthly} /></CardBody></Card>
    </>
  );
}
