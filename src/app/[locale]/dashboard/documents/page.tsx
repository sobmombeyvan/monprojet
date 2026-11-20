import { FileText } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card, EmptyState } from "@/components/ui/primitives";
import { FileUploader } from "@/components/dashboard/file-uploader";
import { PageTitle } from "@/components/dashboard/shell";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function DocumentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations("dashboard");
  const supabase = await createClient();
  const { data: files } = await supabase.storage.from("client-documents").list(user.id, { sortBy: { column: "created_at", order: "desc" } });
  // Short-lived signed URLs — the bucket is private
  const signed = files?.length
    ? (await supabase.storage.from("client-documents").createSignedUrls(files.map((f) => `${user.id}/${f.name}`), 300)).data ?? []
    : [];
  return (
    <>
      <PageTitle title={t("documents")} />
      <Card className="mb-6 p-5">
        <p className="mb-4 text-sm text-muted">{t("documentsText")}</p>
        <FileUploader bucket="client-documents" userId={user.id} />
      </Card>
      {!files?.length ? (
        <EmptyState icon={FileText} title={t("noDocuments")} />
      ) : (
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li key={f.name}>
              <Card className="flex items-center gap-3 p-3">
                <FileText className="size-5 text-teal" />
                <span className="flex-1 truncate text-sm">{f.name}</span>
                {signed[i]?.signedUrl && (
                  <a href={signed[i].signedUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-teal-600">↗</a>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
