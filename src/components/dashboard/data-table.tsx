import { Card, EmptyState } from "@/components/ui/primitives";

/** Responsive table: horizontal scroll on mobile, consistent styling everywhere. */
export function DataTable({
  columns,
  rows,
  empty,
}: {
  columns: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  if (rows.length === 0) return <EmptyState title={empty} />;
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line bg-cloud/60 text-xs uppercase tracking-wider text-muted">
            <tr>
              {columns.map((c) => (
                <th key={c} scope="col" className="px-4 py-3 font-semibold">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-cloud/40">
                {r.map((cell, j) => (
                  <td key={j} className="px-4 py-3 align-middle text-slate-700">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
