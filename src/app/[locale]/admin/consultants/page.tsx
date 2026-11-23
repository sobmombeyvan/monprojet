import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { VerificationBadge } from "@/components/experts/badges";
import { DataTable } from "@/components/dashboard/data-table";
import { PageTitle } from "@/components/dashboard/shell";
import { sendAdminConsultantMessageAction, setVerificationAction, togglePublishAction } from "@/lib/actions/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AdminConsultantsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const supabase = await createClient();
  const { data } = await supabase
    .from("consultants")
    .select("id, slug, professional_name, consultant_type, verification_status, is_published, rating_avg, reviews_count, completed_consultations")
    .order("created_at", { ascending: false });
  return (
    <>
      <PageTitle title={t("admin.consultants")} action={<Button asChild size="sm"><Link href="/admin/consultants/new">+ Ajouter un consultant</Link></Button>} />
      <DataTable
        empty="—"
        columns={["Nom", "Type", t("admin.verifications"), "Note", "Consult.", ""]}
        rows={(data ?? []).map((c) => [
          <Link key="n" href={`/admin/consultants/${c.id}`} className="font-semibold text-navy underline-offset-4 hover:underline">{c.professional_name}</Link>,
          t(`types.${c.consultant_type}` as "types.orientation_specialist"),
          <VerificationBadge key="v" status={c.verification_status} />,
          c.reviews_count ? Number(c.rating_avg).toFixed(1) : "—",
          c.completed_consultations,
          <div key="a" className="flex flex-wrap gap-2">
            <Button asChild size="sm"><Link href={`/admin/consultants/${c.id}`}>Modifier</Link></Button>
            <details className="relative">
              <summary className="cursor-pointer rounded-md border border-line px-3 py-2 text-xs font-semibold text-navy hover:bg-cloud">Écrire</summary>
              <form action={sendAdminConsultantMessageAction} className="absolute right-0 z-10 mt-2 w-80 space-y-2 rounded-xl border border-line bg-white p-3 shadow-lift">
                <input type="hidden" name="consultantId" value={c.id} />
                <input name="subject" className="h-10 w-full rounded-md border border-line px-3 text-sm" placeholder="Objet" minLength={3} maxLength={150} required />
                <textarea name="body" className="min-h-28 w-full rounded-md border border-line p-3 text-sm" placeholder="Message au consultant..." minLength={10} maxLength={4000} required />
                <Button type="submit" size="sm" className="w-full">Envoyer</Button>
              </form>
            </details>
            <form action={togglePublishAction}>
              <input type="hidden" name="consultantId" value={c.id} />
              <input type="hidden" name="publish" value={c.is_published ? "0" : "1"} />
              <Button size="sm" variant="outline" type="submit">{c.is_published ? t("admin.unpublish") : t("admin.publish")}</Button>
            </form>
            {c.verification_status === "verified" && (
              <form action={setVerificationAction}>
                <input type="hidden" name="consultantId" value={c.id} />
                <input type="hidden" name="status" value="suspended" />
                <Button size="sm" variant="ghost" className="text-danger" type="submit">Suspendre</Button>
              </form>
            )}
          </div>,
        ])}
      />
    </>
  );
}
