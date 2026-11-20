import { getTranslations } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/shell";
import { homeFor, requireUser } from "@/lib/auth/session";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ClientDashboardLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await requireUser(locale);
  // The client space is for clients only: admins and consultants go to their own space
  if (user.isAdmin || user.isConsultant) redirect({ href: homeFor(user), locale });
  const t = await getTranslations("dashboard");
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null);
  return (
    <DashboardShell
      title={t("overview")}
      variant="client"
      items={[
        { href: "/dashboard", label: t("overview"), icon: "overview" },
        { href: "/dashboard/bookings", label: t("bookings"), icon: "bookings" },
        { href: "/dashboard/payments", label: t("payments"), icon: "payments" },
        { href: "/dashboard/saved-experts", label: t("saved"), icon: "saved" },
        { href: "/dashboard/documents", label: t("documents"), icon: "documents" },
        { href: "/dashboard/notifications", label: t("notifications"), icon: "notifications", badge: count ?? 0 },
        { href: "/dashboard/profile", label: t("profile"), icon: "profile" },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
