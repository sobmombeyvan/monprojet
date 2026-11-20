import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/auth-forms";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("registerTitle") };
}

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { type } = await searchParams;
  const t = await getTranslations("auth");
  return (
    <AuthShell title={t("registerTitle")} subtitle={t("registerSubtitle")}>
      <RegisterForm defaultType={type === "consultant" ? "consultant" : "client"} />
    </AuthShell>
  );
}
