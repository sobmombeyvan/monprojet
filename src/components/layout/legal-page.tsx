import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/primitives";
import { PageHero } from "./page-hero";

export async function LegalPage({ title, sections }: { title: string; sections: { h: string; p: string }[] }) {
  const t = await getTranslations("pages");
  return (
    <>
      <PageHero title={title} />
      <div className="container-page max-w-3xl py-12">
        <Alert tone="warning" className="mb-8">{t("legalDraft")}</Alert>
        <div className="prose-content">
          {sections.map((s) => (
            <section key={s.h}>
              <h2>{s.h}</h2>
              <p>{s.p}</p>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
