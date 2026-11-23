"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { PUBLIC_DATA_TAG } from "@/lib/supabase/public";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { site } from "@/config/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

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

/** Revalidates every page that shows services, then returns to the admin page with a message. */
async function servicesDone(status: string, kind: "ok" | "error" = "ok"): Promise<never> {
  revalidatePath("/[locale]/admin/services", "page");
  revalidatePath("/[locale]/services", "page");
  revalidatePath("/[locale]/services/[slug]", "page");
  revalidatePath("/[locale]/booking", "page");
  revalidatePath("/[locale]", "page");
  revalidateTag(PUBLIC_DATA_TAG);
  return redirect({ href: `/admin/services?${kind}=${status}`, locale: await getLocale() }) as never;
}

const serviceSchema = z.object({
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nameFr: z.string().trim().min(2).max(120),
  nameEn: z.string().trim().min(2).max(120),
  descriptionFr: z.string().trim().max(1000),
  descriptionEn: z.string().trim().max(1000),
  pricingType: z.enum(["fixed", "quote"]),
  price: z.string(),
  durationMinutes: z.coerce.number().int().min(15).max(480),
  isBookable: z.boolean(),
});
function readService(form: FormData) {
  return serviceSchema.safeParse({
    slug: form.get("slug"),
    nameFr: form.get("nameFr"),
    nameEn: form.get("nameEn"),
    descriptionFr: form.get("descriptionFr") ?? "",
    descriptionEn: form.get("descriptionEn") ?? "",
    pricingType: form.get("pricingType"),
    price: String(form.get("price") ?? "").trim(),
    durationMinutes: form.get("durationMinutes") || 45,
    isBookable: form.get("isBookable") === "on",
  });
}
/** Payments go through Fapshi: prices are whole XAF amounts of at least 100. */
function servicePrice(pricingType: "fixed" | "quote", raw: string): number | null | "invalid" {
  if (pricingType === "quote") return null;
  const n = Number(raw);
  return raw !== "" && Number.isInteger(n) && n >= 100 && n <= 10_000_000 ? n : "invalid";
}

export async function toggleServicePublicationAction(form: FormData) {
  const { supabase } = await admin();
  const id = uuid.parse(form.get("serviceId"));
  const publish = z.enum(["0", "1"]).parse(form.get("publish")) === "1";
  const { error } = await supabase.from("services").update({ is_active: publish }).eq("id", id);
  if (error) return servicesDone("failed", "error");
  return servicesDone(publish ? "published" : "unpublished");
}

export async function createServiceAction(form: FormData) {
  const { supabase } = await admin();
  const parsed = readService(form);
  if (!parsed.success) return servicesDone("invalid", "error");
  const d = parsed.data;
  const price = servicePrice(d.pricingType, d.price);
  if (price === "invalid") return servicesDone("price", "error");
  const { data: last } = await supabase.from("services").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("services").insert({
    slug: d.slug, name_fr: d.nameFr, name_en: d.nameEn,
    description_fr: d.descriptionFr || null, description_en: d.descriptionEn || null,
    pricing_type: d.pricingType, base_price: price, currency: "XAF",
    default_duration_minutes: d.durationMinutes,
    is_bookable: d.pricingType === "fixed" && d.isBookable,
    is_active: form.get("publish") === "on",
    sort_order: Number(last?.sort_order ?? 0) + 1,
  });
  if (error) return servicesDone(error.code === "23505" ? "slug" : "failed", "error");
  return servicesDone("created");
}

export async function updateServiceAction(form: FormData) {
  const { supabase } = await admin();
  const id = uuid.safeParse(form.get("serviceId"));
  const parsed = readService(form);
  if (!id.success || !parsed.success) return servicesDone("invalid", "error");
  const d = parsed.data;
  const price = servicePrice(d.pricingType, d.price);
  if (price === "invalid") return servicesDone("price", "error");
  const { error } = await supabase.from("services").update({
    slug: d.slug, name_fr: d.nameFr, name_en: d.nameEn,
    description_fr: d.descriptionFr || null, description_en: d.descriptionEn || null,
    pricing_type: d.pricingType, base_price: price, currency: "XAF",
    default_duration_minutes: d.durationMinutes,
    is_bookable: d.pricingType === "fixed" && d.isBookable,
  }).eq("id", id.data);
  if (error) return servicesDone(error.code === "23505" ? "slug" : "failed", "error");
  return servicesDone("saved");
}

/**
 * Deletes a service that has never been booked. Experts' prices for it are removed with it.
 * A service with bookings must be kept for history: unpublish it instead.
 */
export async function deleteServiceAction(form: FormData) {
  await admin();
  const id = uuid.safeParse(form.get("serviceId"));
  if (!id.success) return servicesDone("invalid", "error");
  const db = createAdminClient();
  const { count } = await db.from("bookings").select("id", { count: "exact", head: true }).eq("service_id", id.data);
  if ((count ?? 0) > 0) return servicesDone("in_use", "error");
  await db.from("consultant_services").delete().eq("service_id", id.data);
  const { error } = await db.from("services").delete().eq("id", id.data);
  if (error) return servicesDone(error.code === "23503" ? "in_use" : "failed", "error");
  return servicesDone("deleted");
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

export async function deleteArticleAction(form: FormData) {
  await admin();
  const id = uuid.parse(form.get("id"));
  const db = createAdminClient();
  const { error } = await db.from("articles").delete().eq("id", id);
  if (error) throw new Error("delete_article_failed");
  revalidatePath("/[locale]/admin/articles", "page");
  revalidatePath("/[locale]/knowledge", "page");
  revalidateTag(PUBLIC_DATA_TAG);
}

export async function sendAdminConsultantMessageAction(form: FormData) {
  const { supabase } = await admin();
  const consultantId = uuid.parse(form.get("consultantId"));
  const subject = String(form.get("subject") ?? "").trim().slice(0, 150);
  const body = String(form.get("body") ?? "").trim().slice(0, 4000);
  if (subject.length < 3 || body.length < 10) throw new Error("invalid_message");
  const { data: consultant } = await supabase
    .from("consultants")
    .select("user_id")
    .eq("id", consultantId)
    .single();
  if (!consultant) throw new Error("consultant_not_found");
  const db = createAdminClient();
  const { error } = await db.from("notifications").insert({
    user_id: consultant.user_id,
    kind: "admin_message",
    title: subject,
    body,
    link: "/consultant/dashboard",
  });
  if (error) throw new Error("send_message_failed");
  revalidatePath("/[locale]/admin/consultants", "page");
}
