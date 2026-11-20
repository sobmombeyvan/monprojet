import { Link } from "@/i18n/navigation";
import { site } from "@/config/site";
import { cn } from "@/lib/utils";

/** Marque : globe au trait + point turquoise, suivi du nom configuré dans src/config/site.ts */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.5 16h29M16 1.5c4 4 6 9 6 14.5s-2 10.5-6 14.5c-4-4-6-9-6-14.5s2-10.5 6-14.5Z" fill="none" stroke="currentColor" strokeWidth="1" opacity=".45" />
      <circle cx="22" cy="9.5" r="2.2" fill="#25AFA5" />
    </svg>
  );
}

export function Logo({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-3", inverted ? "text-white" : "text-navy", className)} aria-label={site.name}>
      <LogoMark />
      <span className="display text-[1.35rem] font-extrabold leading-none tracking-[-0.04em]">{site.name}</span>
    </Link>
  );
}
