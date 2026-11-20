"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { PUBLIC_DATA_TAG } from "@/lib/supabase/public";
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
  revalidateTag(PUBLIC_DATA_TAG);
  revalidatePath("/[locale]/experts/[slug]", "page");
  revalidateTag(PUBLIC_DATA_TAG);
  revalidatePath("/[locale]/find-expert", "page");
  revalidateTag(PUBLIC_DATA_TAG);
  return { ok: true };
}

/** Gives a user the consultant role and a (hidden) expert profile; returns the profile id. */
async function ensureExpert(service: ReturnType<typeof createAdminClient>, userId: string, fullName: string) {
  const { data: role } = await service.from("roles").select("id").eq("key", "consultant").single();
  if (role) {
    const { error } = await service.from("user_roles").upsert({ user_id: userId, role_id: role.id }, { onConflict: "user_id,role_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  const { data: existing } = await service.from("consultants").select("id").eq("user_id", userId).maybeSingle();
  if (existing) return existing.id as string;
  const base = fullName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "consultant";
  const { data: created, error } = await service
    .from("consultants")
    .insert({ user_id: userId, slug: `${base}-${userId.slice(0, 4)}`, professional_name: fullName, title_fr: "Titre professionnel", is_published: false })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "Création du profil impossible.");
  return created.id as string;
}

/**
 * Crée un compte expert puis ouvre l'éditeur de profil.
 *  - e-mail déjà inscrit → ce compte devient expert ;
 *  - mot de passe temporaire fourni → compte créé immédiatement (aucun e-mail nécessaire) ;
 *  - sinon → invitation par e-mail pour définir le mot de passe.
 */
export async function createConsultantAccount(_: unknown, form: FormData): Promise<Result> {
  await requireAdmin();
  const parsed = newConsultantSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { errors: ["Nom (2 caractères minimum), e-mail valide, et mot de passe d'au moins 8 caractères s'il est renseigné."] };
  const { fullName, email, password } = parsed.data;
  const service = createAdminClient();
  const locale = await getLocale();

  let userId: string;
  const { data: existing } = await service.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) {
    userId = existing.id; // already registered: turn this account into an expert
  } else if (password) {
    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, account_type: "consultant", locale },
    });
    if (error || !data.user) return { errors: [error?.message ?? "Impossible de créer le compte."] };
    userId = data.user.id;
  } else {
    const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, account_type: "consultant", locale },
      redirectTo: `${site.url}/auth/callback?next=${locale === "en" ? "/en" : ""}/reset-password`,
    });
    if (error || !data.user) {
      const limited = /rate limit/i.test(error?.message ?? "");
      return {
        errors: [limited
          ? "Limite d'envoi d'e-mails atteinte : renseignez un mot de passe temporaire pour créer le compte sans e-mail."
          : error?.message ?? "Impossible de créer le compte."],
      };
    }
    userId = data.user.id;
  }

  let consultantId: string;
  try {
    consultantId = await ensureExpert(service, userId, fullName);
  } catch (e) {
    return { errors: [e instanceof Error ? e.message : "Création du profil impossible."] };
  }
  revalidatePath("/[locale]/admin/users", "page");
  revalidatePath("/[locale]/admin/consultants", "page");
  redirect({ href: `/admin/consultants/${consultantId}`, locale });
  return { ok: true };
}

/** Transforme un utilisateur existant en expert (rôle + profil masqué), puis ouvre son profil. */
export async function makeExpertAction(form: FormData) {
  await requireAdmin();
  const userId = String(form.get("userId") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(userId)) return;
  const service = createAdminClient();
  const { data: p } = await service.from("profiles").select("full_name, email").eq("id", userId).single();
  const consultantId = await ensureExpert(service, userId, p?.full_name || p?.email?.split("@")[0] || "Expert");
  revalidatePath("/[locale]/admin/users", "page");
  revalidatePath("/[locale]/admin/consultants", "page");
  redirect({ href: `/admin/consultants/${consultantId}`, locale: await getLocale() });
}
