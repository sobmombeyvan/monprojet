"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { saveConsultantProfileAction } from "@/lib/actions/dashboard";
import { PhotoPicker } from "@/components/experts/photo-picker";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { Alert } from "@/components/ui/primitives";

type Opt = { value: string; label: string };
type State = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

function CheckGroup({ name, legend, options, selected, bulk }: { name: string; legend: string; options: Opt[]; selected: string[]; bulk?: boolean }) {
  const toggleAll = (e: React.MouseEvent<HTMLButtonElement>, on: boolean) => {
    e.currentTarget.closest("fieldset")?.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`).forEach((cb) => { cb.checked = on; });
  };
  return (
    <fieldset>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <legend className="text-sm font-medium text-navy">{legend}</legend>
        {bulk && (
          <span className="flex gap-3 text-xs font-semibold">
            <button type="button" className="text-teal-600 hover:underline" onClick={(e) => toggleAll(e, true)}>Tout sélectionner</button>
            <button type="button" className="text-muted hover:underline" onClick={(e) => toggleAll(e, false)}>Tout désélectionner</button>
          </span>
        )}
      </div>
      <div className="flex max-h-60 flex-wrap gap-2 overflow-y-auto">
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer">
            <input type="checkbox" name={name} value={o.value} defaultChecked={selected.includes(o.value)} className="peer sr-only" />
            <span className="block rounded-full border border-line px-3 py-1 text-sm text-navy peer-checked:border-teal peer-checked:bg-teal-50 peer-checked:text-teal-600 peer-focus-visible:ring-2 peer-focus-visible:ring-teal">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ConsultantProfileForm({
  c,
  defaultName,
  countries,
  specialties,
  languages,
}: {
  c: Record<string, unknown> | null;
  defaultName: string;
  countries: Opt[];
  specialties: Opt[];
  languages: Opt[];
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<State, FormData>(saveConsultantProfileAction as never, {});
  const [photo, setPhoto] = useState<string | null>((c?.photo_url as string | null) ?? null);
  const v = (k: string) => (c?.[k] as string | null) ?? "";
  const rel = (k: string, col: string) => ((c?.[k] as Record<string, string>[] | undefined) ?? []).map((r) => String(r[col]));
  const slugDefault = v("slug") || defaultName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const err = (k: string) => (state.fieldErrors?.[k] ? t("validation.required") : undefined);

  return (
    <form action={action} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {state.ok && <Alert tone="success" className="sm:col-span-2">{t("common.saved")}</Alert>}
      <div className="min-w-0 rounded-xl border border-line p-4 sm:col-span-2">
        <p className="mb-3 text-sm font-medium text-navy">Photo ou bitmoji</p>
        <PhotoPicker value={photo} onChange={setPhoto} name={v("professional_name") || defaultName} inputName="photoUrl" />
      </div>
      {state.error && <Alert tone="error" className="sm:col-span-2">{state.error === "slug_taken" ? "URL déjà utilisée / URL already taken" : t("booking.errors.generic")}</Alert>}
      <Field label={t("auth.fullName")} htmlFor="professionalName" error={err("professionalName")}>
        <Input id="professionalName" name="professionalName" defaultValue={v("professional_name") || defaultName} required />
      </Field>
      <Field label="URL (slug)" htmlFor="slug" error={err("slug")} hint="/experts/…">
        <Input id="slug" name="slug" defaultValue={slugDefault} pattern="[a-z0-9]+(-[a-z0-9]+)*" required />
      </Field>
      <Field label="Titre (FR)" htmlFor="titleFr" error={err("titleFr")}>
        <Input id="titleFr" name="titleFr" defaultValue={v("title_fr")} required />
      </Field>
      <Field label="Title (EN)" htmlFor="titleEn">
        <Input id="titleEn" name="titleEn" defaultValue={v("title_en")} />
      </Field>
      <Field label="Bio courte (FR)" htmlFor="shortBioFr" hint="280 max">
        <Textarea id="shortBioFr" name="shortBioFr" maxLength={280} defaultValue={v("short_bio_fr")} className="min-h-20" />
      </Field>
      <Field label="Short bio (EN)" htmlFor="shortBioEn" hint="280 max">
        <Textarea id="shortBioEn" name="shortBioEn" maxLength={280} defaultValue={v("short_bio_en")} className="min-h-20" />
      </Field>
      <Field label="Biographie (FR)" htmlFor="bioFr">
        <Textarea id="bioFr" name="bioFr" maxLength={6000} defaultValue={v("bio_fr")} />
      </Field>
      <Field label="Biography (EN)" htmlFor="bioEn">
        <Textarea id="bioEn" name="bioEn" maxLength={6000} defaultValue={v("bio_en")} />
      </Field>
      <Field label={t("experts.profileType")} htmlFor="consultantType" hint={t("types.unverifiedNotice")} className="sm:col-span-2">
        <Select id="consultantType" name="consultantType" defaultValue={v("consultant_type") || "orientation_specialist"}>
          {(["authorized_legal_representative", "licensed_professional", "immigration_consultant", "orientation_specialist"] as const).map((x) => (
            <option key={x} value={x}>{t(`types.${x}`)}</option>
          ))}
        </Select>
      </Field>
      <Field label="N° de licence / Licence number" htmlFor="licenseNumber">
        <Input id="licenseNumber" name="licenseNumber" defaultValue={v("license_number")} />
      </Field>
      <Field label="Autorité / Authority" htmlFor="licenseAuthority">
        <Input id="licenseAuthority" name="licenseAuthority" defaultValue={v("license_authority")} />
      </Field>
      <Field label="Années d'expérience / Years" htmlFor="yearsExperience">
        <Input id="yearsExperience" name="yearsExperience" type="number" min={0} max={70} defaultValue={String(c?.years_experience ?? 0)} />
      </Field>
      <Field label="Ville / City" htmlFor="city">
        <Input id="city" name="city" defaultValue={v("city")} />
      </Field>
      <Field label="Fuseau horaire / Time zone" htmlFor="timezone">
        <Select id="timezone" name="timezone" defaultValue={v("timezone") || "Africa/Douala"}>
          {["Africa/Douala", "Africa/Lagos", "Africa/Abidjan", "Europe/Paris", "Europe/Berlin", "Europe/London", "Europe/Rome", "Europe/Bucharest", "America/Toronto", "America/Montreal", "America/New_York"].map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <CheckGroup
          name="methods"
          legend={t("profile.methods")}
          options={(["video", "phone", "in_person", "chat"] as const).map((m) => ({ value: m, label: t(`methods.${m}`) }))}
          selected={(c?.methods as string[]) ?? ["video"]}
        />
      </div>
      <div className="sm:col-span-2"><CheckGroup bulk name="countries" legend={t("experts.countriesCovered")} options={countries} selected={rel("consultant_countries", "country_id")} /></div>
      <div className="sm:col-span-2"><CheckGroup bulk name="specialties" legend="Services proposés" options={specialties} selected={rel("consultant_specialties", "specialty_id")} /></div>
      <div className="sm:col-span-2"><CheckGroup name="languages" legend={t("experts.languages")} options={languages} selected={rel("consultant_languages", "language_code")} /></div>
      <div className="sm:col-span-2">
        <Button type="submit" loading={pending}>{t("common.save")}</Button>
      </div>
    </form>
  );
}
