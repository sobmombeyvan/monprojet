import { Search } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { Badge } from "@/components/ui/primitives";
import { DataTable } from "@/components/dashboard/data-table";
import { PageTitle } from "@/components/dashboard/shell";
import { setRoleAction } from "@/lib/actions/admin";
import { makeExpertAction } from "@/lib/actions/admin-consultants";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = { client: "Client", consultant: "Expert", editor: "Éditeur", admin: "Admin", super_admin: "Super admin" };

function RoleButton({ userId, role, grant, label, variant = "outline" }: { userId: string; role: string; grant: boolean; label: string; variant?: "outline" | "danger" | "primary" }) {
  return (
    <form action={setRoleAction}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="grant" value={grant ? "1" : "0"} />
      <Button type="submit" size="sm" variant={variant}>{label}</Button>
    </form>
  );
}

export default async function AdminUsersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireUser(locale, ["admin"]);
  const { q = "" } = await searchParams;
  const t = await getTranslations("admin");
  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, full_name, email, country_of_residence, created_at, user_roles!user_roles_user_id_fkey(roles(key)), consultants!consultants_user_id_fkey(id)")
    .order("created_at", { ascending: false })
    .limit(200);
  const term = q.trim().replace(/[%,()]/g, " ").slice(0, 80);
  if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  const { data } = await query;

  return (
    <>
      <PageTitle title={t("users")} />
      <form className="mb-5 flex max-w-md gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder="Rechercher par nom ou e-mail" aria-label="Rechercher" />
        <Button type="submit" variant="outline"><Search /> Rechercher</Button>
      </form>
      <DataTable
        empty="Aucun utilisateur"
        columns={["Nom", "E-mail", "Inscription", "Rôles", "Actions"]}
        rows={(data ?? []).map((u) => {
          const roles = (u.user_roles as unknown as { roles: { key: string } }[]).map((r) => r.roles.key);
          const isAdmin = roles.includes("admin") || roles.includes("super_admin");
          const consultant = (u.consultants as unknown as { id: string }[] | { id: string } | null);
          const consultantId = Array.isArray(consultant) ? consultant[0]?.id : consultant?.id;
          const isMe = u.id === me.id;
          return [
            <span key="n">{u.full_name ?? "—"}{isMe && <span className="ml-1 text-xs text-muted">(vous)</span>}</span>,
            u.email,
            formatDate(u.created_at, locale),
            <div key="r" className="flex flex-wrap gap-1">
              {roles.map((r) => <Badge key={r} tone={r === "admin" || r === "super_admin" ? "warning" : r === "consultant" ? "navy" : "neutral"}>{ROLE_LABEL[r] ?? r}</Badge>)}
            </div>,
            <div key="a" className="flex flex-wrap gap-2">
              {isAdmin
                ? !isMe && roles.includes("admin") && <RoleButton userId={u.id} role="admin" grant={false} label="Retirer admin" variant="danger" />
                : <RoleButton userId={u.id} role="admin" grant label="Rendre admin" variant="primary" />}
              {consultantId ? (
                <Button asChild size="sm" variant="outline"><Link href={`/admin/consultants/${consultantId}`}>Profil expert</Link></Button>
              ) : (
                <form action={makeExpertAction}>
                  <input type="hidden" name="userId" value={u.id} />
                  <Button type="submit" size="sm" variant="outline">Rendre expert</Button>
                </form>
              )}
              {roles.includes("editor")
                ? <RoleButton userId={u.id} role="editor" grant={false} label="Retirer éditeur" />
                : !isAdmin && <RoleButton userId={u.id} role="editor" grant label="Rendre éditeur" />}
            </div>,
          ];
        })}
      />
    </>
  );
}
