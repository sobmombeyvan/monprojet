import { Bookmark } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, Card, EmptyState } from "@/components/ui/primitives";
import { VerificationBadge } from "@/components/experts/badges";
import { PageTitle } from "@/components/dashboard/shell";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loc } from "@/lib/utils";

export default async function SavedExpertsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations();
  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_consultants")
    .select("consultants(id, slug, professional_name, title_fr, title_en, photo_url, verification_status)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const list = (data ?? []).map((r) => r.consultants as unknown as Record<string, string>).filter(Boolean);
  return (
    <>
      <PageTitle title={t("dashboard.saved")} />
      {list.length === 0 ? (
        <EmptyState icon={Bookmark} title={t("dashboard.noSaved")} action={<Button asChild><Link href="/find-expert">{t("nav.findExpert")}</Link></Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((c) => (
            <Card key={c.id} className="flex items-center gap-4 p-4">
              <Avatar src={c.photo_url} name={c.professional_name} size={52} />
              <div className="min-w-0 flex-1">
                <VerificationBadge status={c.verification_status} />
                <p className="mt-1 truncate font-semibold text-navy">{c.professional_name}</p>
                <p className="truncate text-sm text-muted">{loc(c, "title", locale)}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Button asChild size="sm"><Link href={`/booking?expert=${c.slug}`}>{t("profile.bookThis")}</Link></Button>
                <Button asChild size="sm" variant="outline"><Link href={`/experts/${c.slug}`}>{t("common.view")}</Link></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
