"use client";
import { X } from "lucide-react";
import { useState, useTransition } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Alert, Avatar } from "@/components/ui/primitives";
import { PhotoPicker } from "@/components/experts/photo-picker";
import { saveConsultantAdmin } from "@/lib/actions/admin-consultants";
import type { AdminConsultantInput } from "@/lib/validation/admin-consultant";
import { cn } from "@/lib/utils";

type Opt = { value: string; label: string };
type ServiceOpt = { id: string; name: string; basePrice: number | null; currency: string };

const TYPES: Opt[] = [
  { value: "authorized_legal_representative", label: "Représentant légal autorisé" },
  { value: "licensed_professional", label: "Professionnel agréé" },
  { value: "immigration_consultant", label: "Consultant en immigration" },
  { value: "orientation_specialist", label: "Spécialiste information & orientation" },
];
const VERIF: Opt[] = [
  { value: "unverified", label: "Non vérifié" }, { value: "pending", label: "Vérification en cours" },
  { value: "verified", label: "Vérifié" }, { value: "rejected", label: "Rejeté" }, { value: "suspended", label: "Suspendu" },
];
const METHODS: Opt[] = [{ value: "video", label: "Appel vidéo" }, { value: "phone", label: "Téléphone" }, { value: "in_person", label: "En personne" }, { value: "chat", label: "Messagerie" }];
const LEVELS: Opt[] = [{ value: "certificate", label: "Certificat" }, { value: "bachelor", label: "Licence" }, { value: "master", label: "Master" }, { value: "doctorate", label: "Doctorat" }, { value: "license", label: "Licence professionnelle" }, { value: "other", label: "Autre" }];
const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const field = "h-11 w-full rounded-[10px] border border-[#d5dde5] bg-white px-3.5 text-sm text-ink focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/10";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-6 sm:p-8">
      <div className="mb-6"><h2 className="font-semibold text-navy">{title}</h2>{hint && <p className="mt-1 text-sm text-muted">{hint}</p>}</div>
      {children}
    </section>
  );
}
function Text({ label, value, onChange, ...rest }: { label: string; value: string | number; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-navy">{label}</span><input {...rest} value={value} onChange={(e) => onChange(e.target.value)} className={field} /></label>;
}
function Chips({ options, value, onChange, bulk }: { options: Opt[]; value: string[]; onChange: (v: string[]) => void; bulk?: boolean }) {
  const all = options.length > 0 && options.every((o) => value.includes(o.value));
  return (
    <div className="flex flex-wrap gap-2">
      {bulk && (
        <button type="button" onClick={() => onChange(all ? [] : options.map((o) => o.value))}
          className="rounded-full border border-dashed border-teal px-3.5 py-1.5 text-sm font-semibold text-teal-600 hover:bg-teal-50">
          {all ? "Tout désélectionner" : "Tout sélectionner"}
        </button>
      )}
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}
            className={cn("rounded-full border px-3.5 py-1.5 text-sm font-medium transition", on ? "border-navy bg-navy text-white" : "border-line text-navy hover:border-navy")}>{o.label}</button>
        );
      })}
    </div>
  );
}
const RemoveBtn = ({ onClick }: { onClick: () => void }) => (
  <button type="button" onClick={onClick} className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-cloud hover:text-danger" aria-label="Supprimer"><X className="size-4" /></button>
);

/** Éditeur complet d'un profil consultant (administration). */
export function ConsultantEditor({
  consultantId, publicSlug, initial, countries, specialties, languages, services,
}: {
  consultantId: string; userId: string; publicSlug: string; initial: AdminConsultantInput;
  countries: Opt[]; specialties: Opt[]; languages: Opt[]; services: ServiceOpt[];
}) {
  const router = useRouter();
  const [d, setD] = useState<AdminConsultantInput>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof AdminConsultantInput>(k: K, v: AdminConsultantInput[K]) => { setSaved(false); setD((cur) => ({ ...cur, [k]: v })); };
  const setItem = <K extends "certifications" | "qualifications" | "services" | "availability">(k: K, i: number, patch: Partial<AdminConsultantInput[K][number]>) =>
    set(k, d[k].map((x, j) => (j === i ? { ...x, ...patch } : x)) as AdminConsultantInput[K]);


  function save() {
    setErrors([]);
    start(async () => {
      const r = await saveConsultantAdmin(consultantId, d);
      if (r.errors) { setErrors(r.errors); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else { setSaved(true); router.refresh(); }
    });
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar src={d.photoUrl} name={d.professionalName} size={56} />
          <div><p className="text-sm text-muted"><Link href="/admin/consultants" className="link">Consultants</Link> / Modifier</p><h1 className="display mt-1 text-3xl">{d.professionalName}</h1></div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm"><Link href={`/experts/${publicSlug}`} target="_blank">Voir le profil public</Link></Button>
          <Button type="submit" size="sm" loading={pending}>Enregistrer</Button>
        </div>
      </div>
      {errors.length > 0 && <Alert tone="error" title="Corrigez avant d'enregistrer"><ul className="list-disc pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul></Alert>}
      {saved && <Alert tone="success">Profil enregistré. Le consultant a été notifié.</Alert>}

      <Section title="Identité">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <PhotoPicker value={d.photoUrl ?? null} onChange={(v) => set("photoUrl", v)} name={d.professionalName} />
          </div>
          <Text label="Nom professionnel" value={d.professionalName} onChange={(v) => set("professionalName", v)} required />
          <Text label="URL du profil (slug)" value={d.slug} onChange={(v) => set("slug", v)} pattern="[a-z0-9]+(-[a-z0-9]+)*" />
          <Text label="Titre professionnel (FR)" value={d.titleFr} onChange={(v) => set("titleFr", v)} required />
          <Text label="Professional title (EN)" value={d.titleEn} onChange={(v) => set("titleEn", v)} />
          <Text label="Ville" value={d.city} onChange={(v) => set("city", v)} />
          <Text label="Années d'expérience" type="number" min={0} max={70} value={d.yearsExperience} onChange={(v) => set("yearsExperience", Number(v))} />
        </div>
      </Section>

      <Section title="Présentation" hint="Affichée sur la fiche de l'expert et sur son profil public.">
        <div className="grid gap-5 sm:grid-cols-2">
          {(["shortBioFr", "shortBioEn"] as const).map((k) => (
            <label key={k} className="block">
              <span className="mb-1.5 flex justify-between text-sm font-semibold text-navy">{k === "shortBioFr" ? "Bio courte (FR)" : "Short bio (EN)"}<span className="font-normal text-muted">{d[k].length} / 280</span></span>
              <textarea rows={3} maxLength={280} value={d[k]} onChange={(e) => set(k, e.target.value)} className={cn(field, "h-auto py-3")} />
            </label>
          ))}
          {(["bioFr", "bioEn"] as const).map((k) => (
            <label key={k} className="block"><span className="mb-1.5 block text-sm font-semibold text-navy">{k === "bioFr" ? "Biographie complète (FR)" : "Full biography (EN)"}</span>
              <textarea rows={7} maxLength={6000} value={d[k]} onChange={(e) => set(k, e.target.value)} className={cn(field, "h-auto py-3")} /></label>
          ))}
        </div>
      </Section>

      <Section title="Statut, vérification et publication" hint="Un statut réglementé n'est affiché publiquement qu'une fois le profil vérifié.">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-navy">Statut professionnel</span>
            <select value={d.consultantType} onChange={(e) => set("consultantType", e.target.value as AdminConsultantInput["consultantType"])} className={field}>{TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-navy">Vérification</span>
            <select value={d.verificationStatus} onChange={(e) => set("verificationStatus", e.target.value as AdminConsultantInput["verificationStatus"])} className={field}>{VERIF.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
          <Text label="N° de licence" value={d.licenseNumber} onChange={(v) => set("licenseNumber", v)} />
          <Text label="Autorité de délivrance" value={d.licenseAuthority} onChange={(v) => set("licenseAuthority", v)} />
          <Text label="Commission spécifique (0–0.9, vide = taux par défaut)" value={d.commissionRate ?? ""} onChange={(v) => set("commissionRate", v === "" ? "" : Number(v))} inputMode="decimal" />
          <Text label="Fuseau horaire" value={d.timezone} onChange={(v) => set("timezone", v)} />
          {([["isPublished", "Profil publié", "Visible dans la recherche"], ["acceptsBookings", "Accepte les réservations", "Créneaux proposés aux clients"]] as const).map(([k, l, h]) => (
            <label key={k} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
              <span><span className="block text-sm font-semibold text-navy">{l}</span><span className="block text-xs text-muted">{h}</span></span>
              <input type="checkbox" checked={d[k]} onChange={(e) => set(k, e.target.checked)} className="size-5 accent-navy" />
            </label>
          ))}
        </div>
      </Section>

      <Section title="Expertise">
        <div className="space-y-6">
          <div><p className="mb-2 text-sm font-semibold text-navy">Destinations couvertes</p><Chips bulk options={countries} value={d.countries} onChange={(v) => set("countries", v)} /></div>
          <div><p className="mb-2 text-sm font-semibold text-navy">Services proposés</p><Chips bulk options={specialties} value={d.specialties} onChange={(v) => set("specialties", v)} /></div>
          <div><p className="mb-2 text-sm font-semibold text-navy">Langues</p><Chips options={languages} value={d.languages} onChange={(v) => set("languages", v)} /></div>
          <div><p className="mb-2 text-sm font-semibold text-navy">Modes de consultation</p><Chips options={METHODS} value={d.methods} onChange={(v) => set("methods", v as AdminConsultantInput["methods"])} /></div>
        </div>
      </Section>

      <Section title="Certifications" hint="Cochez « Vérifiée » uniquement après contrôle auprès de l'organisme émetteur.">
        <div className="space-y-3">
          {d.certifications.map((c, i) => (
            <div key={c.id ?? `n${i}`} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1.4fr_1.2fr_100px_auto_auto] sm:items-center">
              <input value={c.title} onChange={(e) => setItem("certifications", i, { title: e.target.value })} placeholder="Intitulé" className={field} aria-label="Intitulé" />
              <input value={c.issuer} onChange={(e) => setItem("certifications", i, { issuer: e.target.value })} placeholder="Organisme" className={field} aria-label="Organisme" />
              <input type="number" min={1950} max={2100} value={c.year ?? ""} onChange={(e) => setItem("certifications", i, { year: e.target.value ? Number(e.target.value) : null })} placeholder="Année" className={field} aria-label="Année" />
              <label className="flex items-center gap-2 px-1 text-sm text-navy"><input type="checkbox" checked={c.verified} onChange={(e) => setItem("certifications", i, { verified: e.target.checked })} className="size-4" /> Vérifiée</label>
              <RemoveBtn onClick={() => set("certifications", d.certifications.filter((_, j) => j !== i))} />
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => set("certifications", [...d.certifications, { title: "", issuer: "", year: new Date().getFullYear(), verified: false }])}>+ Ajouter une certification</Button>
      </Section>

      <Section title="Qualifications">
        <div className="space-y-3">
          {d.qualifications.map((q, i) => (
            <div key={q.id ?? `n${i}`} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1.4fr_1.2fr_150px_90px_auto_auto] sm:items-center">
              <input value={q.title} onChange={(e) => setItem("qualifications", i, { title: e.target.value })} placeholder="Diplôme" className={field} aria-label="Diplôme" />
              <input value={q.institution} onChange={(e) => setItem("qualifications", i, { institution: e.target.value })} placeholder="Établissement" className={field} aria-label="Établissement" />
              <select value={q.level} onChange={(e) => setItem("qualifications", i, { level: e.target.value as typeof q.level })} className={field} aria-label="Niveau">{LEVELS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
              <input type="number" min={1950} max={2100} value={q.year ?? ""} onChange={(e) => setItem("qualifications", i, { year: e.target.value ? Number(e.target.value) : null })} placeholder="Année" className={field} aria-label="Année" />
              <label className="flex items-center gap-2 px-1 text-sm text-navy"><input type="checkbox" checked={q.verified} onChange={(e) => setItem("qualifications", i, { verified: e.target.checked })} className="size-4" /> Vérifiée</label>
              <RemoveBtn onClick={() => set("qualifications", d.qualifications.filter((_, j) => j !== i))} />
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => set("qualifications", [...d.qualifications, { title: "", institution: "", level: "master", year: null, verified: false }])}>+ Ajouter une qualification</Button>
      </Section>

      <Section title="Services et tarifs" hint="Laissez le prix vide pour appliquer le tarif de base du service.">
        <div className="space-y-3">
          {d.services.map((s, i) => {
            const base = services.find((x) => x.id === s.serviceId);
            return (
              <div key={s.id ?? `n${i}`} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1.5fr_1fr_90px_120px_auto] sm:items-center">
                <select value={s.serviceId} onChange={(e) => setItem("services", i, { serviceId: e.target.value })} className={field} aria-label="Service">{services.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
                <input type="number" min={100} step={500} value={s.price ?? ""} onChange={(e) => setItem("services", i, { price: e.target.value === "" ? null : Number(e.target.value) })} placeholder={base?.basePrice !== null && base ? `Base : ${base.basePrice}` : "Prix"} className={field} aria-label="Prix" />
                <select value={s.currency} onChange={(e) => setItem("services", i, { currency: e.target.value as "XAF" })} className={field} aria-label="Devise"><option value="XAF">XAF</option></select>
                <select value={s.duration} onChange={(e) => setItem("services", i, { duration: Number(e.target.value) })} className={field} aria-label="Durée">{[30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}</select>
                <RemoveBtn onClick={() => set("services", d.services.filter((_, j) => j !== i))} />
              </div>
            );
          })}
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => set("services", [...d.services, { serviceId: services[0]?.id ?? "", price: null, currency: "XAF", duration: 45, methods: d.methods }])}>+ Ajouter un service</Button>
      </Section>

      <Section title="Disponibilités hebdomadaires" hint={`Heures dans le fuseau ${d.timezone}.`}>
        <div className="space-y-3">
          {d.availability.map((a, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_140px_140px_auto] sm:items-center">
              <select value={a.weekday} onChange={(e) => setItem("availability", i, { weekday: Number(e.target.value) })} className={field} aria-label="Jour">{[1, 2, 3, 4, 5, 6, 0].map((w) => <option key={w} value={w}>{DAYS[w]}</option>)}</select>
              <input type="time" value={a.start} onChange={(e) => setItem("availability", i, { start: e.target.value })} className={field} aria-label="Début" />
              <input type="time" value={a.end} onChange={(e) => setItem("availability", i, { end: e.target.value })} className={field} aria-label="Fin" />
              <RemoveBtn onClick={() => set("availability", d.availability.filter((_, j) => j !== i))} />
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => set("availability", [...d.availability, { weekday: 1, start: "09:00", end: "17:00" }])}>+ Ajouter une plage</Button>
      </Section>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-line bg-cloud/95 py-4 backdrop-blur">
        <Button asChild variant="outline"><Link href="/admin/consultants">Annuler</Link></Button>
        <Button type="submit" loading={pending}>Enregistrer les modifications</Button>
      </div>
    </form>
  );
}
