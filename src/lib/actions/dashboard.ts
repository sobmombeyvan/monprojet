"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { PUBLIC_DATA_TAG } from "@/lib/supabase/public";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import {
  availabilitySchema,
  consultantProfileSchema,
  consultantServiceSchema,
  documentUploadSchema,
} from "@/lib/validation/schemas";

type Result = { ok?: boolean; error?: string };
const uuid = z.string().uuid();
const issues = (e: z.ZodError) => Object.fromEntries(e.issues.map((i) => [String(i.path[0]), i.message]));

// ─── Client ───────────────────────────────────────────────────────
export async function submitReviewAction(bookingId: string, rating: number, comment: string): Promise<Result> {
  const p = z.object({ bookingId: uuid, rating: z.number().int().min(1).max(5), comment: z.string().max(2000) }).safeParse({ bookingId, rating, comment });
  if (!p.success) return { error: "invalid" };
  const supabase = await createClient();
  // guard_reviews() (SQL) checks the booking belongs to the user and is completed
  const { error } = await supabase.from("reviews").insert({
    booking_id: p.data.bookingId,
    rating: p.data.rating,
    comment: p.data.comment.trim() || null,
    consultant_id: "00000000-0000-0000-0000-000000000000", // overwritten by trigger
    client_id: "00000000-0000-0000-0000-000000000000", // overwritten by trigger
  });
  if (error) return { error: "forbidden" };
  revalidatePath("/[locale]/dashboard/bookings", "page");
  revalidateTag(PUBLIC_DATA_TAG);
  return { ok: true };
}

// ─── Consultant: profile ─────────────────────────────────────────
export async function saveConsultantProfileAction(_: unknown, form: FormData) {
  const user = await getSessionUser();
  if (!user?.isConsultant) return { error: "forbidden" };
  const parsed = consultantProfileSchema.safeParse({ ...Object.fromEntries(form), methods: form.getAll("methods") });
  if (!parsed.success) return { fieldErrors: issues(parsed.error) };
  const d = parsed.data;
  const supabase = await createClient();
  const row = {
    user_id: user.id,
    slug: d.slug,
    professional_name: d.professionalName,
    title_fr: d.titleFr,
    title_en: d.titleEn || null,
    short_bio_fr: d.shortBioFr || null,
    short_bio_en: d.shortBioEn || null,
    bio_fr: d.bioFr || null,
    bio_en: d.bioEn || null,
    consultant_type: d.consultantType,
    license_number: d.licenseNumber || null,
    license_authority: d.licenseAuthority || null,
    years_experience: d.yearsExperience,
    city: d.city || null,
    timezone: d.timezone,
    methods: d.methods,
  };
  const { data: existing } = await supabase.from("consultants").select("id").eq("user_id", user.id).maybeSingle();
  const { data: saved, error } = existing
    ? await supabase.from("consultants").update(row).eq("id", existing.id).select("id").single()
    : await supabase.from("consultants").insert(row).select("id").single();
  if (error) return { error: error.code === "23505" ? "slug_taken" : "generic" };

  // Replace relation sets (countries, specialties, languages)
  const sets: [string, string, string[]][] = [
    ["consultant_countries", "country_id", form.getAll("countries").map(String)],
    ["consultant_specialties", "specialty_id", form.getAll("specialties").map(String)],
    ["consultant_languages", "language_code", form.getAll("languages").map(String)],
  ];
  for (const [table, col, values] of sets) {
    await supabase.from(table).delete().eq("consultant_id", saved.id);
    if (values.length) await supabase.from(table).insert(values.slice(0, 30).map((v) => ({ consultant_id: saved.id, [col]: v })));
  }
  revalidatePath("/[locale]/consultant", "layout");
  revalidateTag(PUBLIC_DATA_TAG);
  return { ok: true };
}

export async function addQualificationAction(form: FormData) {
  const user = await getSessionUser();
  if (!user?.isConsultant) return;
  const p = z
    .object({
      title: z.string().trim().min(2).max(200),
      institution: z.string().trim().max(200).optional(),
      level: z.enum(["certificate", "bachelor", "master", "doctorate", "license", "other"]),
      year: z.coerce.number().int().min(1950).max(2100).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const supabase = await createClient();
  const { data: c } = await supabase.from("consultants").select("id").eq("user_id", user.id).single();
  if (!c) return;
  await supabase.from("consultant_qualifications").insert({
    consultant_id: c.id, title: p.data.title, institution: p.data.institution || null, level: p.data.level, year_obtained: p.data.year ?? null,
  });
  revalidatePath("/[locale]/consultant/profile", "page");
  revalidateTag(PUBLIC_DATA_TAG);
}

/** Called after the browser uploaded the file to the private bucket (Storage RLS restricts the folder). */
export async function registerDocumentAction(input: { kind: string; path: string; fileName: string; mimeType: string; size: number }): Promise<Result> {
  const user = await getSessionUser();
  if (!user?.isConsultant) return { error: "forbidden" };
  const p = documentUploadSchema.safeParse(input);
  if (!p.success || !input.path.startsWith(`${user.id}/`) || input.path.includes("..")) return { error: "invalid" };
  const supabase = await createClient();
  const { data: c } = await supabase.from("consultants").select("id, verification_status").eq("user_id", user.id).single();
  if (!c) return { error: "no_profile" };
  const { error } = await supabase.from("consultant_documents").insert({
    consultant_id: c.id, kind: p.data.kind, storage_path: input.path, file_name: p.data.fileName, mime_type: p.data.mimeType, size_bytes: p.data.size,
  });
  if (error) return { error: "generic" };
  // A SQL trigger moves an unverified profile into the admin review queue
  revalidatePath("/[locale]/consultant/profile", "page");
  revalidateTag(PUBLIC_DATA_TAG);
  return { ok: true };
}

// ─── Consultant: availability & services ─────────────────────────
async function myConsultantId() {
  const user = await getSessionUser();
  if (!user?.isConsultant) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("consultants").select("id").eq("user_id", user.id).maybeSingle();
  return data?.id ?? null;
}

export async function addAvailabilityAction(form: FormData) {
  const id = await myConsultantId();
  const p = availabilitySchema.safeParse(Object.fromEntries(form));
  if (!id || !p.success) return;
  const supabase = await createClient();
  await supabase.from("availability").insert({ consultant_id: id, weekday: p.data.weekday, start_time: p.data.startTime, end_time: p.data.endTime });
  revalidatePath("/[locale]/consultant/availability", "page");
  revalidateTag(PUBLIC_DATA_TAG);
}

export async function deleteAvailabilityAction(form: FormData) {
  const supabase = await createClient();
  await supabase.from("availability").delete().eq("id", uuid.parse(form.get("id"))); // RLS: owner only
  revalidatePath("/[locale]/consultant/availability", "page");
  revalidateTag(PUBLIC_DATA_TAG);
}

export async function addExceptionAction(form: FormData) {
  const id = await myConsultantId();
  const p = z.object({ from: z.string().date(), to: z.string().date(), reason: z.string().max(200).optional() }).safeParse(Object.fromEntries(form));
  if (!id || !p.success || p.data.to < p.data.from) return;
  const supabase = await createClient();
  await supabase.from("availability_exceptions").insert({
    consultant_id: id,
    period: `[${p.data.from}T00:00:00+01:00,${p.data.to}T23:59:59+01:00]`,
    reason: p.data.reason || null,
  });
  revalidatePath("/[locale]/consultant/availability", "page");
  revalidateTag(PUBLIC_DATA_TAG);
}

export async function saveConsultantServiceAction(form: FormData) {
  const id = await myConsultantId();
  const raw = Object.fromEntries(form);
  const p = consultantServiceSchema.safeParse({ ...raw, price: raw.price === "" ? undefined : raw.price, methods: form.getAll("methods") });
  if (!id || !p.success) return;
  const supabase = await createClient();
  await supabase.from("consultant_services").upsert(
    {
      consultant_id: id,
      service_id: p.data.serviceId,
      price: p.data.price ?? null,
      currency: p.data.currency,
      duration_minutes: p.data.durationMinutes,
      methods: p.data.methods,
      is_active: true,
    },
    { onConflict: "consultant_id,service_id,duration_minutes" },
  );
  revalidatePath("/[locale]/consultant/services", "page");
  revalidateTag(PUBLIC_DATA_TAG);
}

export async function toggleConsultantServiceAction(form: FormData) {
  const supabase = await createClient();
  const id = uuid.parse(form.get("id"));
  await supabase.from("consultant_services").update({ is_active: form.get("active") === "1" }).eq("id", id);
  revalidatePath("/[locale]/consultant/services", "page");
  revalidateTag(PUBLIC_DATA_TAG);
}

// ─── Consultant: bookings ────────────────────────────────────────
export async function setMeetingLinkAction(form: FormData) {
  const p = z.object({ id: uuid, url: z.string().url().startsWith("https://").max(500) }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const supabase = await createClient();
  await supabase.from("bookings").update({ meeting_url: p.data.url }).eq("id", p.data.id); // guard: only meeting_url
  revalidatePath("/[locale]/consultant/bookings", "page");
  revalidateTag(PUBLIC_DATA_TAG);
}

export async function completeBookingAction(form: FormData) {
  const supabase = await createClient();
  await supabase.rpc("complete_booking", { p_booking_id: uuid.parse(form.get("id")) });
  revalidatePath("/[locale]/consultant/bookings", "page");
  revalidateTag(PUBLIC_DATA_TAG);
}

export async function replyReviewAction(form: FormData) {
  const p = z.object({ id: uuid, reply: z.string().trim().min(2).max(2000) }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const supabase = await createClient();
  // RLS + guard_reviews: a consultant can only set consultant_reply on reviews of their own profile
  await supabase.from("reviews").update({ consultant_reply: p.data.reply }).eq("id", p.data.id);
  revalidatePath("/[locale]/consultant/reviews", "page");
  revalidateTag(PUBLIC_DATA_TAG);
}
