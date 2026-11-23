import { getLocale } from "next-intl/server";
import { Badge } from "@/components/ui/primitives";
import { DataTable } from "@/components/dashboard/data-table";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { deleteArticleAction, setContentStatusAction } from "@/lib/actions/admin";
import { formatDate } from "@/lib/utils";

/** Editorial workflow table shared by countries and articles (draft → review → published → archived). */
export async function ContentTable({
  table,
  rows,
}: {
  table: "articles" | "countries";
  rows: { id: string; title: string; status: string; last_verified_at: string | null; href: string }[];
}) {
  const locale = await getLocale();
  const next: Record<string, string[]> = {
    draft: ["in_review", "published"],
    in_review: ["published", "draft"],
    published: ["archived"],
    archived: ["draft"],
  };
  return (
    <DataTable
      empty="—"
      columns={["Titre", "Statut", "Dernière vérification", "Actions"]}
      rows={rows.map((r) => [
        <a key="t" href={r.href} className="font-medium text-navy hover:text-teal-600">{r.title}</a>,
        <Badge key="s" tone={r.status === "published" ? "success" : r.status === "archived" ? "neutral" : "warning"}>{r.status}</Badge>,
        r.last_verified_at ? formatDate(r.last_verified_at, locale) : <Badge key="u" tone="danger">non vérifié</Badge>,
        <div key="a" className="flex flex-wrap gap-1">
          {table === "articles" && (
            <form action={deleteArticleAction}>
              <input type="hidden" name="id" value={r.id} />
              <ConfirmSubmit message={locale === "en" ? "Permanently delete this article?" : "Supprimer définitivement cet article ?"}
                className="rounded-md border border-danger/30 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-orange-50">
                {locale === "en" ? "Delete" : "Supprimer"}
              </ConfirmSubmit>
            </form>
          )}
          {next[r.status].map((s) => (
            <form key={s} action={setContentStatusAction}>
              <input type="hidden" name="table" value={table} />
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="status" value={s} />
              <button
                type="submit"
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
                  s === "published"
                    ? "border-teal bg-teal text-white hover:bg-teal-600"
                    : "border-line text-navy hover:bg-cloud"
                }`}
              >
                {s === "published"
                  ? (locale === "en" ? "Publish article" : "Publier l’article")
                  : s === "archived"
                    ? (locale === "en" ? "Unpublish" : "Dépublier")
                    : s === "in_review"
                      ? (locale === "en" ? "Submit for review" : "Soumettre à validation")
                      : (locale === "en" ? "Save as draft" : "Remettre en brouillon")}
              </button>
            </form>
          ))}
        </div>,
      ])}
    />
  );
}
