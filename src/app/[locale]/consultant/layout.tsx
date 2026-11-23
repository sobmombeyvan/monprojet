import { getTranslations } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/shell";
import { requireUser } from "@/lib/auth/session";

export default async function ConsultantLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireUser(locale, ["consultant"]);
  const t = await getTranslations("consultant");
  return (
    <DashboardShell
      title={t("overview")}
      variant="consultant"
      items={[
        { href: "/consultant/dashboard", label: t("overview"), icon: "overview" },
        { href: "/consultant/bookings", label: t("bookings"), icon: "bookings" },
        { href: "/consultant/availability", label: t("availability"), icon: "availability" },
        { href: "/consultant/services", label: t("services"), icon: "services" },
        { href: "/consultant/articles", label: "Articles", icon: "articles" },
        { href: "/consultant/earnings", label: t("earnings"), icon: "earnings" },
        { href: "/consultant/reviews", label: t("reviews"), icon: "reviews" },
        { href: "/consultant/profile", label: t("profile"), icon: "profile" },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
