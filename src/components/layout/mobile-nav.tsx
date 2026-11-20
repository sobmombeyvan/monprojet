"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { signOutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";

export function MobileNav({
  links,
  accountLinks,
  signedIn,
  labels,
}: {
  links: { href: string; label: string }[];
  accountLinks: { href: string; label: string }[];
  signedIn: boolean;
  labels: { menu: string; close: string; login: string; register: string; logout: string };
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label={labels.menu}>
          <Menu className="!size-5" />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-navy/40 lg:hidden" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[86%] max-w-sm flex-col bg-white shadow-[var(--shadow-lift)] lg:hidden">
          <div className="flex h-16 items-center justify-between border-b border-line px-4">
            <Dialog.Title asChild>
              <div onClick={close}>
                <Logo />
              </div>
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label={labels.close}>
                <X className="!size-5" />
              </Button>
            </Dialog.Close>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-1">
              {[...links, ...accountLinks].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={close} className="block rounded-lg px-3 py-3 text-base font-medium text-navy hover:bg-cloud">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="space-y-2 border-t border-line p-4">
            {signedIn ? (
              <form action={signOutAction}>
                <Button type="submit" variant="outline" className="w-full">
                  {labels.logout}
                </Button>
              </form>
            ) : (
              <>
                <Button asChild className="w-full">
                  <Link href="/register" onClick={close}>{labels.register}</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/login" onClick={close}>{labels.login}</Link>
                </Button>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
