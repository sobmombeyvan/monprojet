"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { PUBLIC_DATA_TAG } from "@/lib/supabase/public";
import { z } from "zod";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { hit } from "@/lib/rate-limit";
import { contactSchema, profileSchema } from "@/lib/validation/schemas";

export async function toggleSavedConsultant(consultantId: string): Promise<{ saved?: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "unauthorized" };
  if (!z.string().uuid().safeParse(consultantId).success) return { error: "invalid" };
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("saved_consultants")
    .select("consultant_id")
    .eq("user_id", user.id)
    .eq("consultant_id", consultantId)
    .maybeSingle();
  if (existing) {
    await supabase.from("saved_consultants").delete().eq("user_id", user.id).eq("consultant_id", consultantId);
  } else {
    await supabase.from("saved_consultants").insert({ user_id: user.id, consultant_id: consultantId });
  }
  revalidatePath("/[locale]/dashboard/saved-experts", "page");
  revalidateTag(PUBLIC_DATA_TAG);
  return { saved: !existing };
}

export async function markNotificationsRead() {
  const user = await getSessionUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  revalidatePath("/[locale]/dashboard/notifications", "page");
  revalidateTag(PUBLIC_DATA_TAG);
}

export async function updateProfileAction(_: unknown, form: FormData) {
  const user = await getSessionUser();
  if (!user) return { error: "unauthorized" };
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone || null,
      country_of_residence: parsed.data.countryOfResidence || null,
      preferred_locale: parsed.data.preferredLocale,
      preferred_currency: parsed.data.preferredCurrency,
    })
    .eq("id", user.id);
  if (error) return { error: "generic" };
  revalidatePath("/[locale]/dashboard", "layout");
  revalidateTag(PUBLIC_DATA_TAG);
  return { ok: true };
}

/** Public contact form → support ticket (service role, rate-limited, honeypot). */
export async function contactAction(_: unknown, form: FormData) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!(await hit(`rl:contact:${ip}`, 3, 600))) return { error: "rateLimited" };
  const parsed = contactSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const user = await getSessionUser();
  const db = createAdminClient();
  const { data, error } = await db
    .from("support_tickets")
    .insert({
      user_id: user?.id ?? null,
      kind: "support",
      subject: parsed.data.subject,
      message: `${parsed.data.message}\n\n— ${parsed.data.fullName} <${parsed.data.email}>`,
    })
    .select("reference")
    .single();
  if (error) return { error: "generic" };
  return { ok: true, reference: data.reference as string };
}
