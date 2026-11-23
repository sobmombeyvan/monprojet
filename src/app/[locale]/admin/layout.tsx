import { getTranslations } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/shell";
import { requireUser } from "@/lib/auth/session";
import { redirect } from "@/i18n/navigation";

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await requireUser(locale);
  if (!user.isAdmin) redirect({ href: "/dashboard", locale }); // protected administrative routes
  const t = await getTranslations("admin");
  return (
    <DashboardShell
      title={t("title")}
      variant="admin"
      items={[
        { href: "/admin", label: t("overview"), icon: "overview" },
        { href: "/admin/verifications", label: t("verifications"), icon: "verifications" },
        { href: "/admin/consultants", label: t("consultants"), icon: "consultants" },
        { href: "/admin/users", label: t("users"), icon: "users" },
        { href: "/admin/bookings", label: t("bookings"), icon: "bookings" },
        { href: "/admin/payments", label: t("payments"), icon: "payments" },
        { href: "/admin/commissions", label: t("commissions"), icon: "commissions" },
        { href: "/admin/countries", label: t("countries"), icon: "countries" },
        { href: "/admin/articles", label: t("articles"), icon: "articles" },
        { href: "/admin/services", label: locale === "en" ? "Services" : "Services", icon: "services" },
        { href: "/admin/analytics", label: t("analytics"), icon: "analytics" },
        { href: "/admin/settings", label: t("settings"), icon: "settings" },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
