import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/primitives";
import { DataTable } from "@/components/dashboard/data-table";
import { PageTitle } from "@/components/dashboard/shell";
import { setRoleAction } from "@/lib/actions/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export default async function AdminUsersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, country_of_residence, created_at, user_roles(roles(key))")
    .order("created_at", { ascending: false })
    .limit(200);
  return (
    <>
      <PageTitle title={t("users")} />
      <DataTable
        empty="—"
        columns={["Nom", "Email", "Pays", "Inscription", "Rôles"]}
        rows={(data ?? []).map((u) => {
          const roles = (u.user_roles as unknown as { roles: { key: string } }[]).map((r) => r.roles.key);
          return [
            u.full_name,
            u.email,
            u.country_of_residence ?? "—",
            formatDate(u.created_at, locale),
            <div key="r" className="flex flex-wrap gap-1">
              {(["client", "consultant", "editor", "admin"] as const).map((role) => (
                <form key={role} action={setRoleAction}>
                  <input type="hidden" name="userId" value={u.id} />
                  <input type="hidden" name="role" value={role} />
                  <input type="hidden" name="grant" value={roles.includes(role) ? "0" : "1"} />
                  <button type="submit" title="Toggle">
                    <Badge tone={roles.includes(role) ? "navy" : "neutral"} className={roles.includes(role) ? "" : "opacity-50"}>{role}</Badge>
                  </button>
                </form>
              ))}
            </div>,
          ];
        })}
      />
    </>
  );
}
