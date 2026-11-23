import { setRequestLocale } from "next-intl/server";
import { ExternalLink } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/form-controls";
import { Alert, Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { PageTitle } from "@/components/dashboard/shell";
import { createServiceAction, deleteServiceAction, toggleServicePublicationAction, updateServiceAction } from "@/lib/actions/admin";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";

const OK: Record<string, string> = {
  created: "Service créé.",
  saved: "Service enregistré — le site est à jour.",
  published: "Service publié : il est visible sur le site.",
  unpublished: "Service dépublié : il n'est plus visible sur le site.",
  deleted: "Service supprimé.",
};
const ERR: Record<string, string> = {
  invalid: "Formulaire incomplet : vérifiez le nom (2 caractères min.), l'URL (minuscules, chiffres, tirets) et la durée.",
  price: "Prix fixe requis : un montant entier d'au moins 100 FCFA (règle Fapshi).",
  slug: "Cette URL (slug) est déjà utilisée par un autre service.",
  in_use: "Ce service a déjà des réservations : il ne peut pas être supprimé (historique). Dépubliez-le plutôt.",
  failed: "L'opération a échoué. Réessayez.",
};

type Svc = {
  id?: string; slug?: string; name_fr?: string; name_en?: string; description_fr?: string | null; description_en?: string | null;
  pricing_type?: string; base_price?: number | null; default_duration_minutes?: number; is_bookable?: boolean;
};

function ServiceFields({ s, idp }: { s: Svc; idp: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div><Label htmlFor={`name-fr-${idp}`}>Nom (FR)</Label><Input id={`name-fr-${idp}`} name="nameFr" defaultValue={s.name_fr} required minLength={2} maxLength={120} /></div>
      <div><Label htmlFor={`name-en-${idp}`}>Name (EN)</Label><Input id={`name-en-${idp}`} name="nameEn" defaultValue={s.name_en} required minLength={2} maxLength={120} /></div>
      <div><Label htmlFor={`slug-${idp}`}>URL (slug)</Label><Input id={`slug-${idp}`} name="slug" defaultValue={s.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" required placeholder="ex. visa-etudiant" /></div>
      <div><Label htmlFor={`duration-${idp}`}>Durée (minutes)</Label><Input id={`duration-${idp}`} name="durationMinutes" type="number" min={15} max={480} step={5} defaultValue={s.default_duration_minutes ?? 45} required /></div>
      <div>
        <Label htmlFor={`pricing-${idp}`}>Tarification</Label>
        <Select id={`pricing-${idp}`} name="pricingType" defaultValue={s.pricing_type ?? "fixed"}>
          <option value="fixed">Prix fixe</option>
          <option value="quote">Sur devis</option>
        </Select>
      </div>
      <div><Label htmlFor={`price-${idp}`}>Prix (FCFA)</Label><Input id={`price-${idp}`} name="price" type="number" min={100} max={10000000} step={1} inputMode="numeric" defaultValue={s.base_price ?? ""} placeholder="Vide si sur devis" /></div>
      <div className="sm:col-span-2"><Label htmlFor={`desc-fr-${idp}`}>Description (FR)</Label><Textarea id={`desc-fr-${idp}`} name="descriptionFr" defaultValue={s.description_fr ?? ""} maxLength={1000} rows={2} /></div>
      <div className="sm:col-span-2"><Label htmlFor={`desc-en-${idp}`}>Description (EN)</Label><Textarea id={`desc-en-${idp}`} name="descriptionEn" defaultValue={s.description_en ?? ""} maxLength={1000} rows={2} /></div>
      <label className="flex items-center gap-2 text-sm text-navy sm:col-span-2">
        <input type="checkbox" name="isBookable" defaultChecked={s.is_bookable ?? true} className="size-4 accent-teal" />
        Réservable en ligne (prix fixe uniquement)
      </label>
    </div>
  );
}

export default async function AdminServicesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale, ["admin"]);
  const { ok, error: err } = await searchParams;
  const supabase = await createClient();
  const { data: services } = await supabase.from("services").select("*").order("sort_order");

  return (
    <>
      <PageTitle title="Services" action={<Button asChild variant="outline" size="sm"><Link href="/services" target="_blank"><ExternalLink /> Voir sur le site</Link></Button>} />
      {ok && OK[ok] && <Alert tone="success" className="mb-5">{OK[ok]}</Alert>}
      {err && ERR[err] && <Alert tone="error" className="mb-5">{ERR[err]}</Alert>}

      <div className="space-y-5">
        {(services ?? []).map((s) => (
          <Card key={s.id}>
            <CardBody className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-navy">{s.name_fr}</h2>
                    <Badge tone={s.is_active ? "success" : "neutral"}>{s.is_active ? "Publié" : "Non publié"}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {s.pricing_type === "quote" ? "Sur devis" : formatPrice(s.base_price, "XAF", locale)} · {s.default_duration_minutes} min · /services/{s.slug}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={toggleServicePublicationAction}>
                    <input type="hidden" name="serviceId" value={s.id} />
                    <input type="hidden" name="publish" value={s.is_active ? "0" : "1"} />
                    <Button type="submit" size="sm" variant={s.is_active ? "outline" : "accent"}>{s.is_active ? "Dépublier" : "Publier"}</Button>
                  </form>
                  <form action={deleteServiceAction}>
                    <input type="hidden" name="serviceId" value={s.id} />
                    <ConfirmSubmit message={`Supprimer définitivement « ${s.name_fr} » ?`}
                      className="inline-flex h-9 items-center rounded-[10px] border border-danger/30 px-3 text-sm font-semibold text-danger hover:bg-orange-50">
                      Supprimer
                    </ConfirmSubmit>
                  </form>
                </div>
              </div>
              <details className="group rounded-xl border border-line">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-navy [&::-webkit-details-marker]:hidden">
                  Modifier le prix et les informations <span className="text-muted group-open:hidden">▾</span><span className="hidden text-muted group-open:inline">▴</span>
                </summary>
                <form action={updateServiceAction} className="space-y-4 border-t border-line p-4">
                  <input type="hidden" name="serviceId" value={s.id} />
                  <ServiceFields s={s} idp={s.id} />
                  <Button type="submit">Enregistrer</Button>
                </form>
              </details>
            </CardBody>
          </Card>
        ))}
        {(services ?? []).length === 0 && <p className="text-sm text-muted">Aucun service pour le moment.</p>}

        <Card>
          <CardHeader><h2 className="font-semibold">Ajouter un service</h2></CardHeader>
          <CardBody>
            <form action={createServiceAction} className="space-y-4">
              <ServiceFields s={{}} idp="new" />
              <label className="flex items-center gap-2 text-sm text-navy">
                <input type="checkbox" name="publish" defaultChecked className="size-4 accent-teal" />
                Publier tout de suite sur le site
              </label>
              <Button type="submit">Créer le service</Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
