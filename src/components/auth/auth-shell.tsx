import { getTranslations } from "next-intl/server";
import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { site } from "@/config/site";

export async function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const t = await getTranslations("home");
  return (
    <div className="grid min-h-[calc(100dvh-72px)] lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-navy lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(37,175,165,0.25),transparent_55%)]" />
        <div className="relative flex h-full flex-col justify-end p-14 text-white">
          <p className="text-sm text-white/60">{site.name}</p>
          <h2 className="mt-3 max-w-md text-3xl font-semibold text-white">{t("heroTitle")}</h2>
          <ul className="mt-8 space-y-3 text-white/80">
            {[t("trust1"), t("trust2"), t("trust3")].map((x) => (
              <li key={x} className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-teal" /> {x}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex items-center justify-center bg-cloud px-4 py-12">
        <Card className="w-full max-w-md p-6 sm:p-8">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </Card>
      </div>
    </div>
  );
}
