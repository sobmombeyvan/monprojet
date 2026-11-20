import { getLocale, getTranslations } from "next-intl/server";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form-controls";
import { Link } from "@/i18n/navigation";
import type { ExpertFilters } from "@/lib/data/queries";

type Ref = {
  countries: { slug: string; name_fr: string; name_en: string; flag_emoji: string | null }[];
  specialties: { slug: string; name_fr: string; name_en: string }[];
  languages: { code: string; name_fr: string; name_en: string }[];
  services: { slug: string; name_fr: string; name_en: string; is_bookable: boolean }[];
};

/**
 * Plain GET form: works without JavaScript, every filter state is a shareable URL,
 * and the server renders the results (SEO-friendly marketplace).
 */
export async function ExpertFiltersForm({ refData, values }: { refData: Ref; values: ExpertFilters }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const n = (o: { name_fr: string; name_en: string }) => (locale === "en" ? o.name_en : o.name_fr);
  const action = locale === "en" ? "/en/find-expert" : "/find-expert";

  const fields = (p: string) => (
    <div className="space-y-4">
      <div>
        <Label htmlFor={`${p}-q`}>{t("experts.keyword")}</Label>
        <Input id={`${p}-q`} name="q" defaultValue={values.q} maxLength={80} />
      </div>
      <div>
        <Label htmlFor={`${p}-country`}>{t("experts.country")}</Label>
        <Select id={`${p}-country`} name="country" defaultValue={values.country ?? ""}>
          <option value="">{t("common.all")}</option>
          {refData.countries.map((c) => (
            <option key={c.slug} value={c.slug}>{c.flag_emoji} {n(c)}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`${p}-procedure`}>{t("experts.procedure")}</Label>
        <Select id={`${p}-procedure`} name="procedure" defaultValue={values.procedure ?? ""}>
          <option value="">{t("common.all")}</option>
          {refData.specialties.map((s) => (
            <option key={s.slug} value={s.slug}>{n(s)}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`${p}-service`}>{t("experts.service")}</Label>
        <Select id={`${p}-service`} name="service" defaultValue={values.service ?? ""}>
          <option value="">{t("common.all")}</option>
          {refData.services.map((s) => (
            <option key={s.slug} value={s.slug}>{n(s)}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`${p}-language`}>{t("experts.language")}</Label>
        <Select id={`${p}-language`} name="language" defaultValue={values.language ?? ""}>
          <option value="">{t("common.all")}</option>
          {refData.languages.map((l) => (
            <option key={l.code} value={l.code}>{n(l)}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`${p}-method`}>{t("experts.method")}</Label>
        <Select id={`${p}-method`} name="method" defaultValue={values.method ?? ""}>
          <option value="">{t("common.any")}</option>
          {(["video", "phone", "in_person", "chat"] as const).map((m) => (
            <option key={m} value={m}>{t(`methods.${m}`)}</option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`${p}-duration`}>{t("experts.duration")}</Label>
          <Select id={`${p}-duration`} name="duration" defaultValue={values.duration ?? ""}>
            <option value="">{t("common.any")}</option>
            {[30, 45, 60, 90].map((d) => (
              <option key={d} value={d}>{t("common.minutes", { count: d })}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`${p}-availability`}>{t("experts.availability")}</Label>
          <Select id={`${p}-availability`} name="availability" defaultValue={values.availability ?? ""}>
            <option value="">{t("common.any")}</option>
            <option value="week">{t("experts.availableWeek")}</option>
            <option value="month">{t("experts.availableMonth")}</option>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`${p}-min`}>{t("experts.priceMin")}</Label>
          <Input id={`${p}-min`} name="minPrice" type="number" min={0} step={500} inputMode="numeric" defaultValue={values.minPrice} placeholder="FCFA" />
        </div>
        <div>
          <Label htmlFor={`${p}-max`}>{t("experts.priceMax")}</Label>
          <Input id={`${p}-max`} name="maxPrice" type="number" min={0} step={500} inputMode="numeric" defaultValue={values.maxPrice} placeholder="FCFA" />
        </div>
      </div>
      <div>
        <Label htmlFor={`${p}-qualification`}>{t("experts.qualification")}</Label>
        <Select id={`${p}-qualification`} name="qualification" defaultValue={values.qualification ?? ""}>
          <option value="">{t("common.any")}</option>
          {(["certificate", "bachelor", "master", "doctorate", "license"] as const).map((l) => (
            <option key={l} value={l}>{t(`experts.levels.${l}`)}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`${p}-type`}>{t("experts.profileType")}</Label>
        <Select id={`${p}-type`} name="type" defaultValue={values.type ?? ""}>
          <option value="">{t("common.all")}</option>
          {(["authorized_legal_representative", "licensed_professional", "immigration_consultant", "orientation_specialist"] as const).map((x) => (
            <option key={x} value={x}>{t(`types.${x}`)}</option>
          ))}
        </Select>
      </div>
      <label className="flex items-center gap-2 text-sm text-navy">
        <input type="checkbox" name="verified" value="1" defaultChecked={values.verified === "1"} className="size-4 accent-teal" />
        {t("experts.verifiedOnly")}
      </label>
      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1">{t("common.search")}</Button>
        <Button asChild variant="outline">
          <Link href="/find-expert">{t("common.reset")}</Link>
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile: collapsible panel */}
      <form method="get" action={action} aria-label={t("experts.filters")} className="lg:hidden">
        {values.sort && <input type="hidden" name="sort" value={values.sort} />}
      <details className="group rounded-[var(--radius-card)] border border-line bg-white">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-semibold text-navy">
          <SlidersHorizontal className="size-4" /> {t("experts.filters")}
        </summary>
        <div className="border-t border-line p-4">{fields("m")}</div>
      </details>
      </form>
      {/* Desktop: sticky sidebar */}
      <form method="get" action={action} aria-label={t("experts.filters")} className="sticky top-24 hidden rounded-[var(--radius-card)] border border-line bg-white p-5 lg:block">
        {values.sort && <input type="hidden" name="sort" value={values.sort} />}
        <p className="mb-4 flex items-center gap-2 font-semibold text-navy">
          <SlidersHorizontal className="size-4" /> {t("experts.filters")}
        </p>
        {fields("d")}
      </form>
    </>
  );
}
