"use server";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { site } from "@/config/site";
import { adminConsultantSchema, newConsultantSchema, type AdminConsultantInput } from "@/lib/validation/admin-consultant";

type Result = { ok?: boolean; errors?: string[] };

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user?.isAdmin) throw new Error("forbidden");
  return user;
}

/** Remplace l'ensemble des lignes d'une table liée (pays, spécialités, langues, disponibilités). */
async function replaceSet(db: Awaited<ReturnType<typeof createClient>>, table: string, consultantId: string, rows: Record<string, unknown>[]) {
  const { error: delError } = await db.from(table).delete().eq("consultant_id", consultantId);
  if (delError) throw delError;
  if (rows.length) {
    const { error } = await db.from(table).insert(rows.map((r) => ({ consultant_id: consultantId, ...r })));
    if (error) throw error;
  }
}

/** Synchronise une liste éditable : met à jour les lignes existantes, insère les nouvelles, supprime les retirées. */
async function syncList(db: Awaited<ReturnType<typeof createClient>>, table: string, consultantId: string, items: { id?: string; row: Record<string, unknown> }[]) {
  const { data: existing } = await db.from(table).select("id").eq("consultant_id", consultantId);
  const keep = new Set(items.filter((i) => i.id).map((i) => i.id));
  const removed = (existing ?? []).map((e) => e.id as string).filter((id) => !keep.has(id));
  if (removed.length) await db.from(table).delete().in("id", removed);
  for (const i of items) {
    const { error } = i.id
      ? await db.from(table).update(i.row).eq("id", i.id).eq("consultant_id", consultantId)
      : await db.from(table).insert({ consultant_id: consultantId, ...i.row });
    if (error) throw error;
  }
}

/**
 * Enregistre toutes les modifications d'un profil consultant.
 * Écrit avec la session de l'administrateur : la RLS (is_admin) et les triggers d'audit s'appliquent.
 */
export async function saveConsultantAdmin(consultantId: string, input: AdminConsultantInput): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = adminConsultantSchema.safeParse(input);
  if (!parsed.success) return { errors: [...new Set(parsed.error.issues.map((i) => i.message))] };
  const d = parsed.data;
  const db = await createClient();

  const { data: before } = await db.from("consultants").select("id, user_id, verification_status").eq("id", consultantId).single();
  if (!before) return { errors: ["Consultant introuvable."] };

  const [{ data: countries }, { data: specialties }] = await Promise.all([
    db.from("countries").select("id, slug").in("slug", d.countries.length ? d.countries : ["-"]),
    db.from("specialties").select("id, slug").in("slug", d.specialties.length ? d.specialties : ["-"]),
  ]);

  try {
    const { error } = await db.from("consultants").update({
      professional_name: d.professionalName, slug: d.slug, title_fr: d.titleFr, title_en: d.titleEn || null,
      short_bio_fr: d.shortBioFr || null, short_bio_en: d.shortBioEn || null, bio_fr: d.bioFr || null, bio_en: d.bioEn || null,
      photo_url: d.photoUrl ?? null, city: d.city || null, years_experience: d.yearsExperience, timezone: d.timezone,
      consultant_type: d.consultantType, license_number: d.licenseNumber || null, license_authority: d.licenseAuthority || null,
      verification_status: d.verificationStatus, is_published: d.isPublished, accepts_bookings: d.acceptsBookings,
      commission_rate: d.commissionRate === "" || d.commissionRate === undefined ? null : d.commissionRate, methods: d.methods,
      ...(d.verificationStatus === "verified" && before.verification_status !== "verified" ? { verified_at: new Date().toISOString(), verified_by: admin.id } : {}),
    }).eq("id", consultantId);
    if (error) return { errors: [error.code === "23505" ? "Cette URL (slug) est déjà utilisée." : error.message] };

    await replaceSet(db, "consultant_countries", consultantId, (countries ?? []).map((c) => ({ country_id: c.id })));
    await replaceSet(db, "consultant_specialties", consultantId, (specialties ?? []).map((s) => ({ specialty_id: s.id })));
    await replaceSet(db, "consultant_languages", consultantId, d.languages.map((code) => ({ language_code: code })));
    await replaceSet(db, "availability", consultantId, d.availability.map((a) => ({ weekday: a.weekday, start_time: a.start, end_time: a.end })));
    await syncList(db, "consultant_certifications", consultantId, d.certifications.map((c) => ({ id: c.id, row: { title: c.title, issuer: c.issuer, year_obtained: c.year ?? null, is_verified: c.verified } })));
    await syncList(db, "consultant_qualifications", consultantId, d.qualifications.map((q) => ({ id: q.id, row: { title: q.title, institution: q.institution || null, level: q.level, year_obtained: q.year ?? null, is_verified: q.verified } })));

    // Services : les services retirés sont désactivés (l'historique des réservations est conservé)
    const { data: existing } = await db.from("consultant_services").select("id").eq("consultant_id", consultantId);
    const keep = new Set(d.services.filter((s) => s.id).map((s) => s.id));
    const removed = (existing ?? []).map((e) => e.id as string).filter((id) => !keep.has(id));
    if (removed.length) await db.from("consultant_services").update({ is_active: false }).in("id", removed);
    for (const s of d.services) {
      const row = { service_id: s.serviceId, price: s.price, currency: s.currency, duration_minutes: s.duration, methods: s.methods, is_active: true };
      const { error: e } = s.id
        ? await db.from("consultant_services").update(row).eq("id", s.id)
        : await db.from("consultant_services").upsert({ consultant_id: consultantId, ...row }, { onConflict: "consultant_id,service_id,duration_minutes" });
      if (e) throw e;
    }
  } catch (e) {
    return { errors: [(e as { message?: string }).message ?? "Erreur lors de l'enregistrement."] };
  }

  await db.from("notifications").insert({
    user_id: before.user_id, kind: "profile_updated_by_admin", title: "Profil mis à jour",
    body: `L'équipe ${site.name} a mis à jour votre profil professionnel.`, link: "/consultant/profile",
  });
  revalidatePath("/[locale]/admin/consultants", "page");
  revalidatePath("/[locale]/experts/[slug]", "page");
  revalidatePath("/[locale]/find-expert", "page");
  return { ok: true };
}

/** Crée un compte consultant (invitation par e-mail pour définir le mot de passe) puis ouvre l'éditeur. */
export async function createConsultantAccount(_: unknown, form: FormData): Promise<Result> {
  await requireAdmin();
  const parsed = newConsultantSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { errors: ["Nom (2 caractères minimum) et e-mail valide requis."] };
  const service = createAdminClient();
  const locale = await getLocale();
  const { data, error } = await service.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { full_name: parsed.data.fullName, account_type: "consultant", locale },
    redirectTo: `${site.url}/auth/callback?next=${locale === "en" ? "/en" : ""}/reset-password`,
  });
  if (error || !data.user) return { errors: [error?.message ?? "Impossible de créer le compte."] };
  const base = parsed.data.fullName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "consultant";
  const { data: created, error: insertError } = await service
    .from("consultants")
    .insert({ user_id: data.user.id, slug: `${base}-${data.user.id.slice(0, 4)}`, professional_name: parsed.data.fullName, title_fr: "Titre professionnel", is_published: false })
    .select("id")
    .single();
  if (insertError || !created) return { errors: [insertError?.message ?? "Création du profil impossible."] };
  redirect({ href: `/admin/consultants/${created.id}`, locale });
  return { ok: true };
}
