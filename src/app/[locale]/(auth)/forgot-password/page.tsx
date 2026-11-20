import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotForm } from "@/components/auth/auth-forms";

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  return (
    <AuthShell title={t("forgotTitle")} subtitle={t("forgotText")}>
      <ForgotForm />
    </AuthShell>
  );
}
