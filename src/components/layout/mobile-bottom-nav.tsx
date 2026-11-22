"use client";

import { CalendarDays, Globe2, Home, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const items = [
    { href: "/", label: t("home"), icon: Home },
    { href: "/find-expert", label: t("mobileFindExpert"), icon: Search },
    { href: "/countries", label: t("mobileCountries"), icon: Globe2 },
    { href: "/booking", label: t("mobileBooking"), icon: CalendarDays },
  ];

  return (
    <nav
      aria-label={t("mobileNavigation")}
      className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-4 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold leading-none transition-colors focus-visible:z-10",
              active ? "text-teal-600" : "text-muted hover:text-navy",
            )}
          >
            <Icon className="size-5" aria-hidden />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
