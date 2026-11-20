import { z } from "zod";

const uuid = z.string().uuid();
const methods = z.array(z.enum(["video", "phone", "in_person", "chat", "other"])).min(1, "Choisissez au moins un mode de consultation.");

/** Données envoyées par l'éditeur d'administration — validées côté serveur avant toute écriture. */
export const adminConsultantSchema = z
  .object({
    professionalName: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères.").max(120),
    slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "URL invalide (minuscules, chiffres et tirets).").max(80),
    titleFr: z.string().trim().min(3, "Le titre professionnel est obligatoire.").max(160),
    titleEn: z.string().trim().max(160).optional().default(""),
    shortBioFr: z.string().trim().max(280, "La bio courte dépasse 280 caractères.").optional().default(""),
    shortBioEn: z.string().trim().max(280).optional().default(""),
    bioFr: z.string().trim().max(6000).optional().default(""),
    bioEn: z.string().trim().max(6000).optional().default(""),
    photoUrl: z.string().url().max(500).nullable().optional(),
    city: z.string().trim().max(80).optional().default(""),
    yearsExperience: z.coerce.number().int().min(0).max(70),
    timezone: z.string().trim().max(60),
    consultantType: z.enum(["authorized_legal_representative", "licensed_professional", "immigration_consultant", "orientation_specialist"]),
    licenseNumber: z.string().trim().max(80).optional().default(""),
    licenseAuthority: z.string().trim().max(160).optional().default(""),
    verificationStatus: z.enum(["unverified", "pending", "verified", "rejected", "suspended"]),
    isPublished: z.boolean(),
    acceptsBookings: z.boolean(),
    commissionRate: z.union([z.literal(""), z.coerce.number().min(0).max(0.9)]).optional(),
    methods,
    countries: z.array(z.string().max(60)).max(60),
    specialties: z.array(z.string().max(60)).max(30),
    languages: z.array(z.string().max(5)).min(1, "Indiquez au moins une langue.").max(15),
    certifications: z.array(z.object({
      id: uuid.optional(),
      title: z.string().trim().min(2, "Chaque certification doit avoir un intitulé."),
      issuer: z.string().trim().min(2, "Chaque certification doit avoir un organisme."),
      year: z.coerce.number().int().min(1950).max(2100).nullable().optional(),
      verified: z.boolean(),
    })).max(30),
    qualifications: z.array(z.object({
      id: uuid.optional(),
      title: z.string().trim().min(2, "Chaque qualification doit avoir un intitulé."),
      institution: z.string().trim().max(200).optional().default(""),
      level: z.enum(["certificate", "bachelor", "master", "doctorate", "license", "other"]),
      year: z.coerce.number().int().min(1950).max(2100).nullable().optional(),
      verified: z.boolean(),
    })).max(30),
    services: z.array(z.object({
      id: uuid.optional(),
      serviceId: uuid,
      price: z.union([z.null(), z.coerce.number().int().min(100).max(10_000_000)]), // Fapshi: whole XAF, ≥ 100
      currency: z.literal("XAF"),
      duration: z.coerce.number().int().min(15).max(480),
      methods,
    })).min(1, "Ajoutez au moins un service."),
    availability: z.array(z.object({
      weekday: z.coerce.number().int().min(0).max(6),
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
    }).refine((a) => a.end > a.start, "Une plage horaire se termine avant de commencer.")).max(40),
  })
  .refine((d) => !d.isPublished || d.countries.length > 0, { message: "Un profil publié doit couvrir au moins une destination.", path: ["countries"] });

export type AdminConsultantInput = z.infer<typeof adminConsultantSchema>;

export const newConsultantSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  /** Optional: create the account immediately with this temporary password (no e-mail needed). */
  password: z.union([z.literal(""), z.string().min(8).max(72)]).optional(),
});
