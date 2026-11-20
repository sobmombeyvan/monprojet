import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";
import { LocaleSwitcher } from "./locale-switcher";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";
import { UserMenu } from "./user-menu";

export async function Header() {
  const [t, user] = await Promise.all([getTranslations("nav"), getSessionUser()]);
  const links = [
    { href: "/find-expert", label: t("findExpert") },
    { href: "/services", label: t("services") },
    { href: "/countries", label: t("countries") },
    { href: "/knowledge", label: t("knowledge") },
    { href: "/about", label: t("about") },
  ];
  const accountLinks = user
    ? [
        { href: "/dashboard", label: t("dashboard") },
        ...(user.isConsultant ? [{ href: "/consultant/dashboard", label: t("consultantSpace") }] : []),
        ...(user.isAdmin ? [{ href: "/admin", label: t("admin") }] : []),
      ]
    : [];

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="container-page flex h-16 items-center justify-between gap-4 lg:h-[72px]">
        <Logo />
        <NavLinks links={links} />
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          {user ? (
            <UserMenu name={user.fullName} links={accountLinks} logoutLabel={t("logout")} />
          ) : (
            <div className="hidden items-center gap-2 lg:flex">
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">{t("login")}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">{t("register")}</Link>
              </Button>
            </div>
          )}
          <MobileNav
            links={[{ href: "/", label: t("home") }, ...links]}
            accountLinks={accountLinks}
            signedIn={!!user}
            labels={{ menu: t("menu"), close: t("close"), login: t("login"), register: t("register"), logout: t("logout") }}
          />
        </div>
      </div>
    </header>
  );
}
