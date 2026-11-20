"use client";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, LogOut } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { signOutAction } from "@/lib/auth/actions";
import { initials } from "@/lib/utils";

export function UserMenu({
  name,
  links,
  logoutLabel,
}: {
  name: string;
  links: { href: string; label: string }[];
  logoutLabel: string;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="hidden items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-navy hover:bg-cloud lg:flex">
        <span className="grid size-8 place-items-center rounded-full bg-navy text-xs font-semibold text-white">{initials(name)}</span>
        <span className="max-w-32 truncate">{name}</span>
        <ChevronDown className="size-4 text-muted" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-52 rounded-xl border border-line bg-white p-1.5 shadow-[var(--shadow-lift)]"
        >
          {links.map((l) => (
            <DropdownMenu.Item key={l.href} asChild>
              <Link href={l.href} className="block rounded-md px-3 py-2 text-sm text-navy outline-none data-[highlighted]:bg-cloud">
                {l.label}
              </Link>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <form action={signOutAction}>
            <button type="submit" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-danger hover:bg-cloud">
              <LogOut className="size-4" /> {logoutLabel}
            </button>
          </form>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
