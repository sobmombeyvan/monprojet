import { ChevronDown } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHero } from "@/components/layout/page-hero";

export async function generateMetadata() {
  const t = await getTranslations("pages");
  return { title: t("faqTitle") };
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages");
  const items = t.raw("faq") as { q: string; a: string }[];
  return (
    <>
      <PageHero title={t("faqTitle")} />
      <div className="container-page max-w-3xl py-12">
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
          {items.map((it) => (
            <li key={it.q}>
              <details className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-navy">
                  {it.q}
                  <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 leading-7 text-slate-700">{it.a}</p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
