"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { PUBLIC_DATA_TAG } from "@/lib/supabase/public";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { site } from "@/config/site";

/** Every admin action re-checks the role server-side; RLS (is_admin()) is the final gate. */
async function admin() {
  const user = await getSessionUser();
  if (!user?.isAdmin) throw new Error("forbidden");
  return { user, supabase: await createClient() };
}
const uuid = z.string().uuid();

export async function setVerificationAction(form: FormData) {
  const { user, supabase } = await admin();
  const id = uuid.parse(form.get("consultantId"));
  const status = z.enum(["verified", "rejected", "suspended", "pending"]).parse(form.get("status"));
  await supabase
    .from("consultants")
    .update({
      verification_status: status,
      verified_at: status === "verified" ? new Date().toISOString() : null,
      verified_by: status === "verified" ? user.id : null,
      ...(status === "verified" ? { is_published: true } : status === "suspended" ? { is_published: false } : {}),
    })
    .eq("id", id);
  if (status === "verified") {
    await supabase.from("consultant_documents").update({ status: "approved", reviewer_id: user.id, reviewed_at: new Date().toISOString() }).eq("consultant_id", id).eq("status", "pending");
    await supabase.from("consultant_qualifications").update({ is_verified: true }).eq("consultant_id", id);
  }
  const { data: c } = await supabase.from("consultants").select("user_id").eq("id", id).single();
  if (c) {
    await supabase.from("notifications").insert({
      user_id: c.user_id,
      kind: "verification_" + status,
      title: status === "verified" ? "Profil vérifié" : "Mise à jour de la vérification",
      body: status === "verified" ? `Votre profil est vérifié et publié sur ${site.name}.` : `Statut de vérification : ${status}.`,
      link: "/consultant/profile",
    });
  }
  revalidatePath("/[locale]/admin", "layout");
  revalidateTag(PUBLIC_DATA_TAG);
}

export async function reviewDocumentAction(form: FormData) {
  const { user, supabase } = await admin();
  const id = uuid.parse(form.get("documentId"));
  const status = z.enum(["approved", "rejected"]).parse(form.get("status"));
  await supabase
    .from("consultant_documents")
    .update({ status, reviewer_id: user.id, reviewed_at: new Date().toISOString(), review_note: String(form.get("note") ?? "").slice(0, 500) || null })
    .eq("id", id);
  revalidatePath("/[locale]/admin/verifications", "page");
  revalidateTag(PUBLIC_DATA_TAG);
}

export async function togglePublishAction(form: FormData) {
  const { supabase } = await admin();
  await supabase.from("consultants").update({ is_published: form.get("publish") === "1" }).eq("id", uuid.parse(form.get("consultantId")));
  revalidatePath("/[locale]/admin/consultants", "page");
  revalidateTag(PUBLIC_DATA_TAG);
}

export async function updateServicePriceAction(form: FormData) {
  const { supabase } = await admin();
  const id = uuid.parse(form.get("serviceId"));
  const raw = String(form.get("price") ?? "");
  const price = raw === "" ? null : z.coerce.number().min(0).max(10_000_000).parse(raw);
  await supabase.from("services").update({ base_price: price, pricing_type: price === null ? "quote" : "fixed", is_bookable: price !== null }).eq("id", id);
  revalidatePath("/[locale]/admin/settings", "page");
  revalidateTag(PUBLIC_DATA_TAG);
}

export async function updateSettingsAction(form: FormData) {
  const { user, supabase } = await admin();
  const rate = z.coerce.number().min(0).max(0.9).parse(form.get("commissionRate"));
  const hold = z.coerce.number().int().min(5).max(60).parse(form.get("holdMinutes"));
  const free = z.coerce.number().int().min(0).max(168).parse(form.get("freeHours"));
  await supabase.from("platform_settings").upsert([
    { key: "commission_rate", value: rate, updated_by: user.id },
    { key: "booking_hold_minutes", value: hold, is_public: true, updated_by: user.id },
    { key: "cancellation_policy", value: { free_until_hours: free, reschedule_until_hours: free }, is_public: true, updated_by: user.id },
  ]);
  revalidatePath("/[locale]/admin/settings", "page");
  revalidateTag(PUBLIC_DATA_TAG);
}

export async function setCommissionStatusAction(form: FormData) {
  const { supabase } = await admin();
  const status = z.enum(["available", "paid_out", "reversed"]).parse(form.get("status"));
  await supabase
    .from("commission_records")
    .update({ status, paid_out_at: status === "paid_out" ? new Date().toISOString() : null })
    .eq("id", uuid.parse(form.get("id")));
  revalidatePath("/[locale]/admin/commissions", "page");
  revalidateTag(PUBLIC_DATA_TAG);
}

export async function setRoleAction(form: FormData) {
  const { user, supabase } = await admin();
  const target = uuid.parse(form.get("userId"));
  const role = z.enum(["client", "consultant", "editor", "admin"]).parse(form.get("role"));
  const grant = form.get("grant") === "1";
  if (target === user.id && role === "admin" && !grant) throw new Error("cannot_remove_own_admin");
  const { data: r } = await supabase.from("roles").select("id").eq("key", role).single();
  if (!r) return;
  if (grant) await supabase.from("user_roles").upsert({ user_id: target, role_id: r.id, granted_by: user.id });
  else await supabase.from("user_roles").delete().eq("user_id", target).eq("role_id", r.id);
  revalidatePath("/[locale]/admin/users", "page");
  revalidateTag(PUBLIC_DATA_TAG);
}

export async function setContentStatusAction(form: FormData) {
  const { supabase } = await admin();
  const table = z.enum(["articles", "countries"]).parse(form.get("table"));
  const status = z.enum(["draft", "in_review", "published", "archived"]).parse(form.get("status"));
  const patch: Record<string, unknown> = { status };
  if (status === "published" && table === "articles") {
    patch.published_at = new Date().toISOString();
    patch.last_verified_at = new Date().toISOString().slice(0, 10);
  }
  if (status === "published" && table === "countries") patch.last_verified_at = new Date().toISOString().slice(0, 10);
  await supabase.from(table).update(patch).eq("id", uuid.parse(form.get("id")));
  revalidatePath(`/[locale]/admin/${table}`, "page");
  revalidateTag(PUBLIC_DATA_TAG);
}
