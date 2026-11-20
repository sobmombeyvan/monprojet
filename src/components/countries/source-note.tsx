import { getLocale, getTranslations } from "next-intl/server";
import { ExternalLink, ShieldCheck, TriangleAlert } from "lucide-react";
import { formatDate, isStale } from "@/lib/utils";

/** Every piece of immigration information shows its source and verification date (§10–11). */
export async function SourceNote({ sourceName, sourceUrl, lastVerified }: { sourceName?: string | null; sourceUrl?: string | null; lastVerified?: string | null }) {
  const t = await getTranslations("common");
  const locale = await getLocale();
  const stale = isStale(lastVerified);
  return (
    <div className="space-y-2 text-xs">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
        {sourceUrl && (
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-teal-600 hover:underline">
            <ShieldCheck className="size-3.5" /> {t("source")} : {sourceName ?? new URL(sourceUrl).hostname} <ExternalLink className="size-3" />
          </a>
        )}
        <span>{lastVerified ? t("lastVerified", { date: formatDate(lastVerified, locale) }) : t("notVerifiedYet")}</span>
      </p>
      {stale && (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-warning">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {t("staleWarning")}
        </p>
      )}
    </div>
  );
}
