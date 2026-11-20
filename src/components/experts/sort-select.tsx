"use client";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";

export function SortSelect({ value }: { value: string }) {
  const t = useTranslations("experts");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <span className="hidden sm:inline">{t("sortBy")}</span>
      <select
        value={value}
        onChange={(e) => {
          const q = Object.fromEntries(params.entries());
          delete q.page;
          if (e.target.value === "relevance") delete q.sort; else q.sort = e.target.value;
          router.push({ pathname, query: q });
        }}
        className="h-9 rounded-[10px] border border-[#d5dde5] bg-white px-3 text-sm font-semibold text-navy"
      >
        {(["relevance", "price", "rating", "experience"] as const).map((s) => (
          <option key={s} value={s}>{t(`sort${s[0].toUpperCase()}${s.slice(1)}` as "sortRelevance")}</option>
        ))}
      </select>
    </label>
  );
}
