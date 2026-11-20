import { z } from "zod";

/** Shared by client forms (React Hook Form) and server actions — validated on both sides. */
export const passwordSchema = z
  .string()
  .min(8, "password")
  .max(72, "max")
  .regex(/[A-Z]/, "password")
  .regex(/\d/, "password");

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("email"),
  password: z.string().min(1, "required"),
});

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "min").max(120, "max"),
  email: z.string().trim().toLowerCase().email("email"),
  password: passwordSchema,
  accountType: z.enum(["client", "consultant"]),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "consent" }) }),
});

export const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email("email") });
export const updatePasswordSchema = z.object({ password: passwordSchema });

const phoneRegex = /^\+?[0-9 ()-]{7,20}$/;

export const bookingClientSchema = z.object({
  consultantServiceId: z.string().uuid(),
  startsAt: z.string().datetime({ offset: true }),
  method: z.enum(["video", "phone", "in_person", "chat", "other"]),
  fullName: z.string().trim().min(2, "min").max(120, "max"),
  email: z.string().trim().toLowerCase().email("email"),
  phone: z.string().trim().regex(phoneRegex, "phone"),
  countryOfResidence: z.string().trim().length(2, "required"),
  destinationCountryId: z.string().uuid().optional().or(z.literal("")),
  procedureType: z.string().trim().max(80, "max").optional(),
  description: z.string().trim().max(4000, "max").optional(),
  consent: z.literal(true, { errorMap: () => ({ message: "consent" }) }),
});
export type BookingClientInput = z.infer<typeof bookingClientSchema>;

export const quoteRequestSchema = z.object({
  fullName: z.string().trim().min(2, "min").max(120, "max"),
  email: z.string().trim().toLowerCase().email("email"),
  phone: z.string().trim().regex(phoneRegex, "phone"),
  destination: z.string().trim().max(80).optional(),
  description: z.string().trim().min(20, "min").max(4000, "max"),
});

export const contactSchema = z.object({
  fullName: z.string().trim().min(2, "min").max(120, "max"),
  email: z.string().trim().toLowerCase().email("email"),
  subject: z.string().trim().min(3, "min").max(150, "max"),
  message: z.string().trim().min(10, "min").max(4000, "max"),
  website: z.string().max(0).optional(), // honeypot
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "min").max(120, "max"),
  phone: z.string().trim().regex(phoneRegex, "phone").or(z.literal("")),
  countryOfResidence: z.string().trim().max(2).or(z.literal("")),
  preferredLocale: z.enum(["fr", "en"]),
  preferredCurrency: z.enum(["XAF", "EUR", "USD"]),
});

export const consultantProfileSchema = z.object({
  professionalName: z.string().trim().min(2).max(120),
  slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80),
  titleFr: z.string().trim().min(3).max(160),
  titleEn: z.string().trim().max(160).optional(),
  shortBioFr: z.string().trim().max(280).optional(),
  shortBioEn: z.string().trim().max(280).optional(),
  bioFr: z.string().trim().max(6000).optional(),
  bioEn: z.string().trim().max(6000).optional(),
  consultantType: z.enum(["authorized_legal_representative", "licensed_professional", "immigration_consultant", "orientation_specialist"]),
  licenseNumber: z.string().trim().max(80).optional(),
  licenseAuthority: z.string().trim().max(160).optional(),
  yearsExperience: z.coerce.number().int().min(0).max(70),
  city: z.string().trim().max(80).optional(),
  timezone: z.string().trim().max(60),
  methods: z.array(z.enum(["video", "phone", "in_person", "chat", "other"])).min(1),
});

export const availabilitySchema = z
  .object({
    weekday: z.coerce.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .refine((v) => v.endTime > v.startTime, { message: "invalid_range", path: ["endTime"] });

export const consultantServiceSchema = z.object({
  serviceId: z.string().uuid(),
  price: z.coerce.number().int().min(100).max(10_000_000).optional(), // Fapshi: whole XAF, ≥ 100
  currency: z.literal("XAF"),
  durationMinutes: z.coerce.number().int().min(15).max(480),
  methods: z.array(z.enum(["video", "phone", "in_person", "chat", "other"])).min(1),
});

export const documentUploadSchema = z.object({
  kind: z.enum(["identity", "diploma", "license", "insurance", "company_registration", "other"]),
  fileName: z.string().max(200),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
  size: z.number().int().min(1).max(10 * 1024 * 1024),
});
