import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";

export type AppRole = "client" | "consultant" | "editor" | "admin" | "super_admin";

export interface SessionUser {
  id: string;
  email: string | null;
  fullName: string;
  roles: AppRole[];
  isAdmin: boolean;
  isConsultant: boolean;
  isEditor: boolean;
}

/** Current user (validated against Supabase Auth) with roles — memoized per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  // Verified locally (asymmetric JWT signing key) — avoids a round-trip to Supabase Auth on every page
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return null;
  const user = { id: claims.sub, email: (claims.email as string | undefined) ?? null };
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).single(),
    supabase.from("user_roles").select("roles(key)").eq("user_id", user.id),
  ]);
  const roles = (roleRows ?? []).map((r) => (r.roles as unknown as { key: AppRole }).key);
  const isAdmin = roles.includes("admin") || roles.includes("super_admin");
  return {
    id: user.id,
    email: profile?.email ?? user.email ?? null,
    fullName: profile?.full_name ?? user.email ?? "",
    roles,
    isAdmin,
    isConsultant: roles.includes("consultant"),
    isEditor: isAdmin || roles.includes("editor"),
  };
});

/** Server-side guard for protected layouts and actions. RLS remains the final authority. */
export async function requireUser(locale: string, roles?: AppRole[]) {
  const user = await getSessionUser();
  if (!user) redirect({ href: "/login", locale });
  if (roles && !roles.some((r) => user!.roles.includes(r)) && !user!.isAdmin) {
    redirect({ href: "/dashboard", locale });
  }
  return user!;
}

/** Each role has its own space: admin → /admin, consultant → /consultant/dashboard, client → /dashboard. */
export function homeFor(user: Pick<SessionUser, "isAdmin" | "isConsultant"> | null | undefined) {
  if (user?.isAdmin) return "/admin";
  if (user?.isConsultant) return "/consultant/dashboard";
  return "/dashboard";
}
