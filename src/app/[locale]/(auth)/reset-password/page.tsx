import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { requireUser } from "@/lib/auth/session";

export default async function ResetPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale); // reached through the email link, which creates a session
  const t = await getTranslations("auth");
  return (
    <AuthShell title={t("newPassword")}>
      <ResetPasswordForm />
    </AuthShell>
  );
}
