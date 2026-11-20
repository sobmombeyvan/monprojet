"use server";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeFor } from "@/lib/auth/session";
import { hit } from "@/lib/rate-limit";
import { forgotSchema, loginSchema, registerSchema, updatePasswordSchema } from "@/lib/validation/schemas";

export type ActionState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; message?: string };

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

async function limited(bucket: string, max: number) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  return !(await hit(`rl:${bucket}:${ip}`, max, 300));
}

function fieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  return Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message]));
}

/** Only allow same-site relative redirects after login (prevents open redirects). */
function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function signInAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (await limited("login", 10)) return { error: "rateLimited" };
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "invalidCredentials" };
  const locale = await getLocale();
  // Each role lands in its own space unless a specific page was requested
  const { data: roleRows } = await supabase.from("user_roles").select("roles(key)").eq("user_id", data.user.id);
  const roles = (roleRows ?? []).map((r) => (r.roles as unknown as { key: string }).key);
  const home = homeFor({ isAdmin: roles.includes("admin") || roles.includes("super_admin"), isConsultant: roles.includes("consultant") });
  const requested = typeof form.get("next") === "string" && String(form.get("next")) !== "" ? safeNext(form.get("next")) : home;
  // `next` may already contain the /en prefix
  const href = requested.replace(/^\/en(?=\/|$)/, "") || home;
  redirect({ href, locale });
  return { ok: true };
}

export async function signUpAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (await limited("register", 5)) return { error: "rateLimited" };
  const parsed = registerSchema.safeParse({ ...Object.fromEntries(form), acceptTerms: form.get("acceptTerms") === "on" });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const locale = await getLocale();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${site()}/auth/callback?next=${locale === "en" ? "/en" : ""}${parsed.data.accountType === "consultant" ? "/consultant/profile" : "/dashboard"}`,
      data: { full_name: parsed.data.fullName, account_type: parsed.data.accountType, locale },
    },
  });
  if (error) return { error: error.message };
  if (!data.session) return { ok: true, message: "checkEmail" }; // email confirmation enabled
  redirect({ href: parsed.data.accountType === "consultant" ? "/consultant/profile" : "/dashboard", locale });
  return { ok: true };
}

export async function forgotPasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (await limited("forgot", 5)) return { error: "rateLimited" };
  const parsed = forgotSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const locale = await getLocale();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${site()}/auth/callback?next=${locale === "en" ? "/en" : ""}/reset-password`,
  });
  return { ok: true, message: "linkSent" }; // same answer whether or not the account exists
}

export async function updatePasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = updatePasswordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };
  redirect({ href: "/dashboard", locale: await getLocale() });
  return { ok: true };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect({ href: "/", locale: await getLocale() });
}
