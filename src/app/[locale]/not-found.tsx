import { getTranslations } from "next-intl/server";
import { Compass } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <div className="container-page flex min-h-[50vh] flex-col items-center justify-center py-20 text-center">
      <Compass className="size-10 text-teal" />
      <h1 className="mt-4 text-2xl font-semibold">{t("notFound")}</h1>
      <p className="mt-2 text-muted">{t("notFoundText")}</p>
      <Button asChild className="mt-6">
        <Link href="/">{t("backHome")}</Link>
      </Button>
    </div>
  );
}
