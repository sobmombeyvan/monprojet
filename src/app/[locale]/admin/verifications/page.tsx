import { FileText } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { PageTitle } from "@/components/dashboard/shell";
import { reviewDocumentAction, setVerificationAction } from "@/lib/actions/admin";
import { createClient } from "@/lib/supabase/server";

export default async function VerificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const supabase = await createClient();
  const { data } = await supabase
    .from("consultants")
    .select("id, professional_name, slug, consultant_type, license_number, license_authority, created_at, consultant_documents(*), consultant_qualifications(*)")
    .eq("verification_status", "pending")
    .order("created_at");
  // Private bucket → short-lived signed URLs, admins only (storage RLS)
  const paths = (data ?? []).flatMap((c) => (c.consultant_documents as { storage_path: string }[]).map((d) => d.storage_path));
  const signed = paths.length ? (await supabase.storage.from("consultant-documents").createSignedUrls(paths, 600)).data ?? [] : [];
  const urlFor = (p: string) => signed.find((s) => s.path === p)?.signedUrl;

  return (
    <>
      <PageTitle title={t("admin.verifications")} />
      {(data ?? []).length === 0 ? (
        <EmptyState title={t("admin.noPending")} />
      ) : (
        <ul className="space-y-4">
          {data!.map((c) => (
            <li key={c.id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-navy">{c.professional_name}</p>
                    <p className="text-sm text-muted">
                      {t(`types.${c.consultant_type}` as "types.orientation_specialist")}
                      {c.license_number && ` · ${c.license_authority ?? ""} ${c.license_number}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {(["verified", "rejected"] as const).map((s) => (
                      <form key={s} action={setVerificationAction}>
                        <input type="hidden" name="consultantId" value={c.id} />
                        <input type="hidden" name="status" value={s} />
                        <Button type="submit" size="sm" variant={s === "verified" ? "primary" : "outline"}>
                          {s === "verified" ? t("admin.approve") : t("admin.reject")}
                        </Button>
                      </form>
                    ))}
                  </div>
                </div>
                <ul className="mt-4 space-y-2">
                  {(c.consultant_documents as Record<string, string>[]).map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-cloud px-3 py-2 text-sm">
                      <FileText className="size-4 text-teal" />
                      <Badge>{d.kind}</Badge>
                      {urlFor(d.storage_path) ? (
                        <a href={urlFor(d.storage_path) ?? undefined} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-teal-600 underline">{d.file_name}</a>
                      ) : (
                        <span className="flex-1 truncate">{d.file_name}</span>
                      )}
                      <Badge tone={d.status === "approved" ? "success" : d.status === "rejected" ? "danger" : "warning"}>{d.status}</Badge>
                      {d.status === "pending" &&
                        (["approved", "rejected"] as const).map((s) => (
                          <form key={s} action={reviewDocumentAction}>
                            <input type="hidden" name="documentId" value={d.id} />
                            <input type="hidden" name="status" value={s} />
                            <Button type="submit" size="sm" variant="ghost">{s === "approved" ? "✓" : "✕"}</Button>
                          </form>
                        ))}
                    </li>
                  ))}
                </ul>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
