import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form-controls";
import { Alert, Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { DataTable } from "@/components/dashboard/data-table";
import { PageTitle } from "@/components/dashboard/shell";
import { saveConsultantServiceAction, toggleConsultantServiceAction } from "@/lib/actions/dashboard";
import { requireUser } from "@/lib/auth/session";
import { getMyConsultant } from "@/lib/data/consultant";
import { getReferenceData } from "@/lib/data/queries";
import { createClient } from "@/lib/supabase/server";
import { formatPrice, loc } from "@/lib/utils";

export default async function ConsultantServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, ["consultant"]);
  const t = await getTranslations();
  const c = await getMyConsultant(user.id);
  if (!c) return <Alert>{t("consultant.onboardingText")}</Alert>;
  const supabase = await createClient();
  const [{ data: mine }, ref] = await Promise.all([
    supabase.from("consultant_services").select("*, services(name_fr, name_en, base_price, currency)").eq("consultant_id", c.id).order("created_at"),
    getReferenceData(),
  ]);
  const bookable = ref.services.filter((s) => s.is_bookable);

  return (
    <>
      <PageTitle title={t("consultant.services")} />
      <DataTable
        empty={t("common.noAvailability")}
        columns={[t("booking.step1"), t("booking.duration"), t("booking.finalPrice"), t("booking.method"), t("dashboard.status"), ""]}
        rows={(mine ?? []).map((cs) => {
          const s = cs.services as Record<string, string>;
          return [
            loc(s, "name", locale),
            t("common.minutes", { count: cs.duration_minutes }),
            cs.price !== null ? formatPrice(cs.price, cs.currency, locale) : `${formatPrice(s.base_price, s.currency, locale)} (base)`,
            (cs.methods as string[]).map((m) => t(`methods.${m}` as "methods.video")).join(", "),
            <Badge key="s" tone={cs.is_active ? "success" : "neutral"}>{cs.is_active ? "✓" : "—"}</Badge>,
            <form key="f" action={toggleConsultantServiceAction}>
              <input type="hidden" name="id" value={cs.id} />
              <input type="hidden" name="active" value={cs.is_active ? "0" : "1"} />
              <Button size="sm" variant="outline" type="submit">{cs.is_active ? "Désactiver / Disable" : "Activer / Enable"}</Button>
            </form>,
          ];
        })}
      />
      <Card className="mt-6">
        <CardHeader><h2 className="font-semibold">{t("consultant.addService")}</h2></CardHeader>
        <CardBody>
          <form action={saveConsultantServiceAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="serviceId">{t("booking.step1")}</Label>
              <Select id="serviceId" name="serviceId">
                {bookable.map((s) => <option key={s.id} value={s.id}>{loc(s, "name", locale)}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="durationMinutes">{t("booking.duration")}</Label>
              <Select id="durationMinutes" name="durationMinutes" defaultValue="45">
                {[30, 45, 60, 90, 120].map((d) => <option key={d} value={d}>{t("common.minutes", { count: d })}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="price">{t("booking.finalPrice")}</Label>
              <Input id="price" name="price" type="number" min={100} step={1} placeholder="Vide = prix de base" />
            </div>
            <div>
              <Label htmlFor="currency">Devise</Label>
              <Select id="currency" name="currency" defaultValue="XAF">
                <option value="XAF">XAF (FCFA)</option>
              </Select>
            </div>
            <fieldset className="sm:col-span-2 lg:col-span-4">
              <legend className="mb-2 text-sm font-medium text-navy">{t("booking.method")}</legend>
              <div className="flex flex-wrap gap-4">
                {(c.methods as string[]).map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="methods" value={m} defaultChecked className="size-4 accent-teal" />
                    {t(`methods.${m}` as "methods.video")}
                  </label>
                ))}
              </div>
            </fieldset>
            <Button type="submit" className="sm:col-span-2 lg:col-span-1">{t("common.save")}</Button>
          </form>
        </CardBody>
      </Card>
    </>
  );
}
