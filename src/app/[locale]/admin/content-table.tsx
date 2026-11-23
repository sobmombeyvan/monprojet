import { getLocale } from "next-intl/server";
import { Badge } from "@/components/ui/primitives";
import { DataTable } from "@/components/dashboard/data-table";
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
            <form action={deleteArticleAction} onSubmit={(event) => {
              if (!window.confirm("Supprimer définitivement cet article ?")) event.preventDefault();
            }}>
              <input type="hidden" name="id" value={r.id} />
              <button type="submit" className="rounded-md border border-danger/30 px-2 py-1 text-xs text-danger hover:bg-orange-50">Supprimer</button>
            </form>
          )}
          {next[r.status].map((s) => (
            <form key={s} action={setContentStatusAction}>
              <input type="hidden" name="table" value={table} />
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="status" value={s} />
              <button type="submit" className="rounded-md border border-line px-2 py-1 text-xs text-navy hover:bg-cloud">→ {s}</button>
            </form>
          ))}
        </div>,
      ])}
    />
  );
}
