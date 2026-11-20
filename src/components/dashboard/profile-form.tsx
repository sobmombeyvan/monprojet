"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateProfileAction } from "@/lib/actions/engagement";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { Alert } from "@/components/ui/primitives";

type State = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

export function ProfileForm({
  profile,
  countries,
}: {
  profile: Record<string, string | null> | null;
  countries: { iso2: string; name: string }[];
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<State, FormData>(updateProfileAction as never, {});
  const fe = (k: string) => (state.fieldErrors?.[k] ? t(`validation.${state.fieldErrors[k]}` as "validation.required") : undefined);
  return (
    <form action={action} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      {state.ok && <Alert tone="success" className="sm:col-span-2">{t("dashboard.profileSaved")}</Alert>}
      {state.error && <Alert tone="error" className="sm:col-span-2">{t("booking.errors.generic")}</Alert>}
      <Field label={t("auth.fullName")} htmlFor="fullName" error={fe("fullName")}>
        <Input id="fullName" name="fullName" defaultValue={profile?.full_name ?? ""} required />
      </Field>
      <Field label={t("auth.email")} htmlFor="email">
        <Input id="email" defaultValue={profile?.email ?? ""} disabled />
      </Field>
      <Field label={t("booking.phone")} htmlFor="phone" error={fe("phone")}>
        <Input id="phone" name="phone" type="tel" defaultValue={profile?.phone ?? ""} />
      </Field>
      <Field label={t("booking.residence")} htmlFor="countryOfResidence">
        <Select id="countryOfResidence" name="countryOfResidence" defaultValue={profile?.country_of_residence ?? ""}>
          <option value="">—</option>
          {countries.map((c) => <option key={c.iso2} value={c.iso2}>{c.name}</option>)}
        </Select>
      </Field>
      <Field label={t("nav.language")} htmlFor="preferredLocale">
        <Select id="preferredLocale" name="preferredLocale" defaultValue={profile?.preferred_locale ?? "fr"}>
          <option value="fr">Français</option>
          <option value="en">English</option>
        </Select>
      </Field>
      <Field label="Devise / Currency" htmlFor="preferredCurrency">
        <Select id="preferredCurrency" name="preferredCurrency" defaultValue={profile?.preferred_currency ?? "XAF"}>
          <option value="XAF">FCFA (XAF)</option>
          <option value="EUR">Euro (EUR)</option>
          <option value="USD">Dollar (USD)</option>
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" loading={pending}>{t("common.save")}</Button>
      </div>
    </form>
  );
}
