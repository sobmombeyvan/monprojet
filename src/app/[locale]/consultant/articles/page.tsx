import { setRequestLocale } from "next-intl/server";
import { PageTitle } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { Input, Select, Textarea, Label, Field } from "@/components/ui/form-controls";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyConsultant } from "@/lib/data/consultant";
import { saveConsultantArticleAction } from "@/lib/actions/dashboard";
import { formatDate } from "@/lib/utils";

export default async function ConsultantArticlesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { locale } = await params;
  const { edit } = await searchParams;
  setRequestLocale(locale);
  const user = await requireUser(locale, ["consultant"]);
  const consultant = await getMyConsultant(user.id);
  if (!consultant) return null;

  const supabase = await createClient();
  const [articles, categories, countries] = await Promise.all([
    supabase
      .from("articles")
      .select("id, slug, title, description, body, category_id, country_id, procedure_type, locale, status, created_at, updated_at")
      .eq("author_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase.from("categories").select("id, name_fr, name_en").order("sort_order"),
    supabase.from("countries").select("id, slug, name_fr, name_en").eq("status", "published").order("name_fr"),
  ]);
  const current = (articles.data ?? []).find((article) => article.id === edit);

  return (
    <>
      <PageTitle title={locale === "en" ? "My articles" : "Mes articles"} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader>
            <h2 className="font-semibold">{current ? (locale === "en" ? "Edit article" : "Modifier l'article") : (locale === "en" ? "New article" : "Nouvel article")}</h2>
          </CardHeader>
          <CardBody>
            <form action={saveConsultantArticleAction} className="space-y-5">
              <input type="hidden" name="id" value={current?.id ?? ""} />
              <Field label={locale === "en" ? "Title" : "Titre"} htmlFor="title">
                <Input id="title" name="title" defaultValue={current?.title ?? ""} minLength={5} maxLength={180} required />
              </Field>
              <Field label={locale === "en" ? "Summary" : "Description"} htmlFor="description">
                <Textarea id="description" name="description" defaultValue={current?.description ?? ""} minLength={20} maxLength={500} required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={locale === "en" ? "Category" : "Catégorie"} htmlFor="categoryId">
                  <Select id="categoryId" name="categoryId" defaultValue={current?.category_id ?? ""} required>
                    <option value="" disabled>Choisir</option>
                    {(categories.data ?? []).map((category) => (
                      <option key={category.id} value={category.id}>{locale === "en" ? category.name_en : category.name_fr}</option>
                    ))}
                  </Select>
                </Field>
                <Field label={locale === "en" ? "Country" : "Pays"} htmlFor="countryId">
                  <Select id="countryId" name="countryId" defaultValue={current?.country_id ?? ""}>
                    <option value="">Tous les pays</option>
                    {(countries.data ?? []).map((country) => (
                      <option key={country.id} value={country.id}>{locale === "en" ? country.name_en : country.name_fr}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Langue" htmlFor="locale">
                  <Select id="locale" name="locale" defaultValue={current?.locale ?? locale}>
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </Select>
                </Field>
                <Field label={locale === "en" ? "Procedure type" : "Type de procédure"} htmlFor="procedureType">
                  <Input id="procedureType" name="procedureType" defaultValue={current?.procedure_type ?? ""} maxLength={80} />
                </Field>
              </div>
              <Field label={locale === "en" ? "Article body (Markdown)" : "Contenu (Markdown)"} htmlFor="body" hint="## Titre, listes, **gras**, liens HTTPS autorisés.">
                <Textarea id="body" name="body" defaultValue={current?.body ?? ""} className="min-h-72 font-mono text-sm" minLength={50} maxLength={50000} required />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" name="status" value="draft" variant="outline">{locale === "en" ? "Save draft" : "Enregistrer le brouillon"}</Button>
                <Button type="submit" name="status" value="in_review">{locale === "en" ? "Submit for review" : "Soumettre à validation"}</Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h2 className="font-semibold">{locale === "en" ? "Published work" : "Mes publications"}</h2></CardHeader>
          <CardBody className="space-y-3">
            {(articles.data ?? []).length === 0 ? (
              <p className="text-sm text-muted">{locale === "en" ? "No article yet." : "Aucun article pour le moment."}</p>
            ) : (articles.data ?? []).map((article) => (
              <a
                key={article.id}
                href={`?edit=${article.id}`}
                className="block rounded-lg border border-line p-3 hover:border-teal"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-navy">{article.title}</p>
                  <Badge tone={article.status === "published" ? "success" : article.status === "in_review" ? "warning" : "neutral"}>
                    {article.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted">{formatDate(article.updated_at, locale)}</p>
              </a>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
