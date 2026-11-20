import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form-controls";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { PageTitle } from "@/components/dashboard/shell";
import { updateServicePriceAction, updateSettingsAction } from "@/lib/actions/admin";
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
          <CardHeader><h2 className="font-semibold">{t("servicePrices")}</h2></CardHeader>
          <CardBody className="space-y-3">
            {(services ?? []).map((sv) => (
              <form key={sv.id} action={updateServicePriceAction} className="flex items-end gap-2">
                <input type="hidden" name="serviceId" value={sv.id} />
                <div className="flex-1">
                  <Label htmlFor={`p-${sv.id}`}>{locale === "en" ? sv.name_en : sv.name_fr} ({sv.currency})</Label>
                  <Input id={`p-${sv.id}`} name="price" type="number" min={0} step={5} defaultValue={sv.base_price ?? ""} placeholder="Vide = sur devis" />
                </div>
                <Button type="submit" variant="outline">OK</Button>
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
