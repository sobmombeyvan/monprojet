import { FileText } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form-controls";
import { Alert, Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { VerificationBadge } from "@/components/experts/badges";
import { ConsultantProfileForm } from "@/components/dashboard/consultant-profile-form";
import { FileUploader } from "@/components/dashboard/file-uploader";
import { PageTitle } from "@/components/dashboard/shell";
import { addQualificationAction } from "@/lib/actions/dashboard";
import { requireUser } from "@/lib/auth/session";
import { getMyConsultant } from "@/lib/data/consultant";
import { getReferenceData } from "@/lib/data/queries";
import { formatDate } from "@/lib/utils";

export default async function ConsultantProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, ["consultant"]);
  const t = await getTranslations();
  const [c, ref] = await Promise.all([getMyConsultant(user.id), getReferenceData()]);
  const n = (o: { name_fr: string; name_en: string }) => (locale === "en" ? o.name_en : o.name_fr);

  return (
    <>
      <PageTitle title={t("consultant.profile")} action={c ? <VerificationBadge status={c.verification_status} /> : undefined} />
      {!c && <Alert className="mb-6" title={t("consultant.onboardingTitle")}>{t("consultant.onboardingText")}</Alert>}
      <Card className="p-6">
        <ConsultantProfileForm
          c={c}
          defaultName={user.fullName}
          countries={ref.countries.map((x) => ({ value: x.id, label: `${x.flag_emoji ?? ""} ${n(x)}` }))}
          specialties={ref.specialties.map((x) => ({ value: String(x.id), label: n(x) }))}
          languages={ref.languages.map((x) => ({ value: x.code, label: n(x) }))}
        />
      </Card>

      {c && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><h2 className="font-semibold">{t("profile.qualifications")}</h2></CardHeader>
            <CardBody className="space-y-4">
              <ul className="space-y-2 text-sm">
                {(c.consultant_qualifications as Record<string, string | boolean>[]).map((q) => (
                  <li key={String(q.id)} className="flex items-center justify-between gap-2">
                    <span>{String(q.title)} · {String(q.institution ?? "")}</span>
                    <Badge tone={q.is_verified ? "teal" : "neutral"}>{q.is_verified ? t("common.verified") : t("common.pendingVerification")}</Badge>
                  </li>
                ))}
              </ul>
              <form action={addQualificationAction} className="grid gap-2 sm:grid-cols-2">
                <Input name="title" placeholder="Intitulé / Title" required aria-label="Title" />
                <Input name="institution" placeholder="Établissement / Institution" aria-label="Institution" />
                <Select name="level" defaultValue="master" aria-label="Level">
                  {(["certificate", "bachelor", "master", "doctorate", "license", "other"] as const).map((l) => (
                    <option key={l} value={l}>{t(`experts.levels.${l}`)}</option>
                  ))}
                </Select>
                <Input name="year" type="number" min={1950} max={2100} placeholder="Année / Year" aria-label="Year" />
                <Button type="submit" variant="outline" size="sm" className="sm:col-span-2">+ {t("profile.qualifications")}</Button>
              </form>
            </CardBody>
          </Card>
          <Card>
            <CardHeader><h2 className="font-semibold">{t("consultant.documents")}</h2></CardHeader>
            <CardBody className="space-y-4">
              <p className="text-sm text-muted">{t("consultant.documentsHint")}</p>
              <FileUploader bucket="consultant-documents" userId={user.id} withKind />
              <ul className="space-y-2">
                {(c.consultant_documents as Record<string, string>[]).map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-sm">
                    <FileText className="size-4 text-teal" />
                    <span className="flex-1 truncate">{d.file_name}</span>
                    <span className="text-xs text-muted">{formatDate(d.created_at, locale)}</span>
                    <Badge tone={d.status === "approved" ? "success" : d.status === "rejected" ? "danger" : "warning"}>{d.status}</Badge>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
