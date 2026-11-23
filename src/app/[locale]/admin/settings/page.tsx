import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/form-controls";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { PageTitle } from "@/components/dashboard/shell";
import { updateServiceAction, updateSettingsAction } from "@/lib/actions/admin";
import { paymentsAreLive } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";

export default async function AdminSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const supabase = await createClient();
  const [{ data: services }, { data: settings }] = await Promise.all([
    supabase.from("services").select("*").order("sort_order"),
    supabase.from("platform_settings").select("key, value"),
  ]);
  const s = Object.fromEntries((settings ?? []).map((r) => [r.key, r.value])) as Record<string, unknown>;
  const policy = (s.cancellation_policy ?? { free_until_hours: 24 }) as { free_until_hours: number };
  return (
    <>
      <PageTitle title={t("settings")} />
      {!paymentsAreLive() && (
        <Alert tone="warning" className="mb-6" title="Paiements en mode sandbox">
          Les paiements réels nécessitent la configuration de Fapshi (Mobile Money, XAF) — FAPSHI_API_USER / FAPSHI_API_KEY puis PAYMENT_PROVIDER_XAF=fapshi — voir PRODUCTION.md › Fapshi.
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><h2 className="font-semibold">{locale === "en" ? "Manage services" : "Gérer les services"}</h2></CardHeader>
          <CardBody className="space-y-6">
            {(services ?? []).map((sv) => (
              <form key={sv.id} action={updateServiceAction} className="space-y-4 rounded-xl border border-line p-4">
                <input type="hidden" name="serviceId" value={sv.id} />
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-navy">{locale === "en" ? sv.name_en : sv.name_fr}</h3>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sv.is_active ? "bg-green-50 text-success" : "bg-cloud text-muted"}`}>
                    {sv.is_active ? (locale === "en" ? "Published" : "Publié") : (locale === "en" ? "Unpublished" : "Dépublié")}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`slug-${sv.id}`}>Slug</Label>
                    <Input id={`slug-${sv.id}`} name="slug" defaultValue={sv.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" required />
                  </div>
                  <div>
                    <Label htmlFor={`currency-${sv.id}`}>{locale === "en" ? "Currency" : "Devise"}</Label>
                    <Select id={`currency-${sv.id}`} name="currency" defaultValue={sv.currency}>
                      {["XAF", "EUR", "USD"].map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`name-fr-${sv.id}`}>Nom (FR)</Label>
                    <Input id={`name-fr-${sv.id}`} name="nameFr" defaultValue={sv.name_fr} required maxLength={120} />
                  </div>
                  <div>
                    <Label htmlFor={`name-en-${sv.id}`}>Name (EN)</Label>
                    <Input id={`name-en-${sv.id}`} name="nameEn" defaultValue={sv.name_en} required maxLength={120} />
                  </div>
                  <div>
                    <Label htmlFor={`description-fr-${sv.id}`}>Description (FR)</Label>
                    <Textarea id={`description-fr-${sv.id}`} name="descriptionFr" defaultValue={sv.description_fr ?? ""} maxLength={1000} />
                  </div>
                  <div>
                    <Label htmlFor={`description-en-${sv.id}`}>Description (EN)</Label>
                    <Textarea id={`description-en-${sv.id}`} name="descriptionEn" defaultValue={sv.description_en ?? ""} maxLength={1000} />
                  </div>
                  <div>
                    <Label htmlFor={`pricing-type-${sv.id}`}>{locale === "en" ? "Pricing" : "Tarification"}</Label>
                    <Select id={`pricing-type-${sv.id}`} name="pricingType" defaultValue={sv.pricing_type}>
                      <option value="fixed">{locale === "en" ? "Fixed price" : "Prix fixe"}</option>
                      <option value="quote">{locale === "en" ? "Upon quotation" : "Sur devis"}</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`price-${sv.id}`}>{locale === "en" ? "Price" : "Prix"} ({sv.currency})</Label>
                    <Input id={`price-${sv.id}`} name="price" type="number" min={0} max={10000000} step="any" defaultValue={sv.base_price ?? ""} placeholder={locale === "en" ? "Required for fixed price" : "Requis pour un prix fixe"} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-5">
                  <label className="flex items-center gap-2 text-sm text-navy">
                    <input type="checkbox" name="isActive" defaultChecked={sv.is_active} className="size-4 accent-teal" />
                    {locale === "en" ? "Published on the site" : "Publié sur le site"}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-navy">
                    <input type="checkbox" name="isBookable" defaultChecked={sv.is_bookable} className="size-4 accent-teal" />
                    {locale === "en" ? "Allow booking" : "Permettre la réservation"}
                  </label>
                </div>
                <Button type="submit" variant="outline">{locale === "en" ? "Save service" : "Enregistrer le service"}</Button>
              </form>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><h2 className="font-semibold">Plateforme</h2></CardHeader>
          <CardBody>
            <form action={updateSettingsAction} className="space-y-4">
              <div>
                <Label htmlFor="commissionRate">{t("commissionRate")} (0–0.9)</Label>
                <Input id="commissionRate" name="commissionRate" type="number" min={0} max={0.9} step={0.01} defaultValue={String(s.commission_rate ?? 0.2)} />
              </div>
              <div>
                <Label htmlFor="holdMinutes">{t("holdMinutes")}</Label>
                <Input id="holdMinutes" name="holdMinutes" type="number" min={5} max={60} defaultValue={String(s.booking_hold_minutes ?? 15)} />
              </div>
              <div>
                <Label htmlFor="freeHours">Annulation gratuite jusqu&apos;à (heures avant)</Label>
                <Input id="freeHours" name="freeHours" type="number" min={0} max={168} defaultValue={policy.free_until_hours} />
              </div>
              <Button type="submit">Enregistrer</Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
