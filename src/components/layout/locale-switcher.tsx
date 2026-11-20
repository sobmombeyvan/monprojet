"use client";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [pending, start] = useTransition();

  return (
    <div role="group" aria-label={t("language")} className={cn("flex rounded-lg border border-line p-0.5 text-xs font-semibold", pending && "opacity-60")}>
      {(["fr", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={locale === l}
          onClick={() =>
            start(() => {
              // @ts-expect-error — params of the current dynamic route are passed through
              router.replace({ pathname, params }, { locale: l });
            })
          }
          className={cn("rounded-md px-2 py-1 uppercase transition-colors", locale === l ? "bg-navy text-white" : "text-navy/70 hover:text-navy")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
