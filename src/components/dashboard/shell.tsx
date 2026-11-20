"use client";
import {
  Bell, Bookmark, CalendarDays, CreditCard, FileText, Gauge, Globe2, LayoutDashboard, Newspaper, Percent,
  Settings, ShieldCheck, Star, UserRound, Users, Wallet, Wrench, Clock, BarChart3,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ICONS = {
  overview: LayoutDashboard, bookings: CalendarDays, payments: CreditCard, saved: Bookmark, profile: UserRound,
  documents: FileText, notifications: Bell, services: Wrench, availability: Clock, earnings: Wallet, reviews: Star,
  users: Users, consultants: UserRound, verifications: ShieldCheck, commissions: Percent, countries: Globe2,
  articles: Newspaper, analytics: BarChart3, settings: Settings, gauge: Gauge,
} as const;
export type NavIcon = keyof typeof ICONS;

export function DashboardShell({
  title,
  items,
  children,
}: {
  title: string;
  items: { href: string; label: string; icon: NavIcon; badge?: number }[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="bg-cloud">
      <div className="container-page grid gap-6 py-8 lg:grid-cols-[240px_1fr]">
        <aside>
          <p className="mb-3 hidden px-3 text-xs font-semibold uppercase tracking-wider text-muted lg:block">{title}</p>
          <nav aria-label={title} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            <ul className="flex gap-1 lg:flex-col">
              {items.map((it) => {
                const Icon = ICONS[it.icon];
                const active = pathname === it.href || (it.href !== items[0].href && pathname.startsWith(it.href));
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active ? "bg-navy text-white" : "text-navy hover:bg-white",
                      )}
                    >
                      <Icon className="size-4" />
                      {it.label}
                      {it.badge ? (
                        <span className="ml-auto rounded-full bg-teal px-1.5 text-[11px] font-semibold text-white">{it.badge}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>
        <section className="min-w-0">{children}</section>
      </div>
    </div>
  );
}

export function PageTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {action}
    </div>
  );
}
