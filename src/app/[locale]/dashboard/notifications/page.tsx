import { Bell } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/primitives";
import { PageTitle } from "@/components/dashboard/shell";
import { requireUser } from "@/lib/auth/session";
import { markNotificationsRead } from "@/lib/actions/engagement";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDate } from "@/lib/utils";

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations("dashboard");
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  const unread = (data ?? []).some((n) => !n.read_at);
  return (
    <>
      <PageTitle
        title={t("notifications")}
        action={unread ? (
          <form action={markNotificationsRead}><Button variant="outline" size="sm" type="submit">{t("markAllRead")}</Button></form>
        ) : undefined}
      />
      {(data ?? []).length === 0 ? (
        <EmptyState icon={Bell} title={t("noNotifications")} />
      ) : (
        <ul className="space-y-2">
          {data!.map((n) => (
            <li key={n.id}>
              <Card className={cn("flex gap-3 p-4", !n.read_at && "border-teal/40 bg-teal-50/40")}>
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-line" : "bg-teal")} aria-hidden />
                <div className="flex-1">
                  <p className="font-semibold text-navy">{n.title}</p>
                  {n.body && <p className="text-sm text-slate-700">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted">{formatDate(n.created_at, locale, { dateStyle: "medium", timeStyle: "short" })}</p>
                </div>
                {n.link && <Link href={n.link} className="self-center text-sm font-semibold text-teal-600">→</Link>}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
