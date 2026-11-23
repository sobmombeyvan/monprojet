import { setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/form-controls";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { PageTitle } from "@/components/dashboard/shell";
import { toggleServicePublicationAction, updateServiceAction } from "@/lib/actions/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AdminServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const supabase = await createClient();
  const { data: services, error } = await supabase.from("services").select("*").order("sort_order");
  if (error) throw new Error("services_load_failed");

  return (
    <>
      <PageTitle title={locale === "en" ? "Services" : "Services"} />
      <Card>
        <CardHeader>
          <h2 className="font-semibold">{locale === "en" ? "Manage services" : "Gestion des services"}</h2>
        </CardHeader>
        <CardBody className="space-y-6">
          {(services ?? []).map((service) => (
            <section key={service.id} className="space-y-4 rounded-xl border border-line p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-navy">{locale === "en" ? service.name_en : service.name_fr}</h3>
                  <p className="mt-1 text-xs text-muted">/{service.slug}</p>
                </div>
                <form action={toggleServicePublicationAction}>
                  <input type="hidden" name="serviceId" value={service.id} />
                  <input type="hidden" name="publish" value={service.is_active ? "0" : "1"} />
                  <Button type="submit" size="sm" variant={service.is_active ? "outline" : "accent"}>
                    {service.is_active
                      ? (locale === "en" ? "Unpublish service" : "Dépublier le service")
                      : (locale === "en" ? "Publish service" : "Publier le service")}
                  </Button>
                </form>
              </div>

              <form action={updateServiceAction} className="space-y-4">
                <input type="hidden" name="serviceId" value={service.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`slug-${service.id}`}>Slug</Label>
                    <Input id={`slug-${service.id}`} name="slug" defaultValue={service.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" required />
                  </div>
                  <div>
                    <Label htmlFor={`currency-${service.id}`}>{locale === "en" ? "Currency" : "Devise"}</Label>
                    <Select id={`currency-${service.id}`} name="currency" defaultValue={service.currency}>
                      {["XAF", "EUR", "USD"].map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`name-fr-${service.id}`}>Nom (FR)</Label>
                    <Input id={`name-fr-${service.id}`} name="nameFr" defaultValue={service.name_fr} required maxLength={120} />
                  </div>
                  <div>
                    <Label htmlFor={`name-en-${service.id}`}>Name (EN)</Label>
                    <Input id={`name-en-${service.id}`} name="nameEn" defaultValue={service.name_en} required maxLength={120} />
                  </div>
                  <div>
                    <Label htmlFor={`description-fr-${service.id}`}>Description (FR)</Label>
                    <Textarea id={`description-fr-${service.id}`} name="descriptionFr" defaultValue={service.description_fr ?? ""} maxLength={1000} />
                  </div>
                  <div>
                    <Label htmlFor={`description-en-${service.id}`}>Description (EN)</Label>
                    <Textarea id={`description-en-${service.id}`} name="descriptionEn" defaultValue={service.description_en ?? ""} maxLength={1000} />
                  </div>
                  <div>
                    <Label htmlFor={`pricing-type-${service.id}`}>{locale === "en" ? "Pricing" : "Tarification"}</Label>
                    <Select id={`pricing-type-${service.id}`} name="pricingType" defaultValue={service.pricing_type}>
                      <option value="fixed">{locale === "en" ? "Fixed price" : "Prix fixe"}</option>
                      <option value="quote">{locale === "en" ? "Upon quotation" : "Sur devis"}</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`price-${service.id}`}>{locale === "en" ? "Price" : "Prix"} ({service.currency})</Label>
                    <Input id={`price-${service.id}`} name="price" type="number" min={0} max={10000000} step="any" defaultValue={service.base_price ?? ""} placeholder={locale === "en" ? "Required for fixed price" : "Requis pour un prix fixe"} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-navy">
                  <input type="checkbox" name="isBookable" defaultChecked={service.is_bookable} className="size-4 accent-teal" />
                  {locale === "en" ? "Allow booking" : "Permettre la réservation"}
                </label>
                <Button type="submit" variant="outline">{locale === "en" ? "Save service" : "Enregistrer le service"}</Button>
              </form>
            </section>
          ))}
          {services?.length === 0 && (
            <p className="text-sm text-muted">{locale === "en" ? "No services yet." : "Aucun service pour le moment."}</p>
          )}
        </CardBody>
      </Card>
    </>
  );
}
