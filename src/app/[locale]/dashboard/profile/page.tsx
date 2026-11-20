import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/primitives";
import { PageTitle } from "@/components/dashboard/shell";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { requireUser } from "@/lib/auth/session";
import { isoCountryOptions } from "@/lib/iso-countries";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations("dashboard");
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (
    <>
      <PageTitle title={t("profile")} />
      <Card className="p-6">
        <ProfileForm
          profile={profile}
          countries={isoCountryOptions(locale)}
        />
      </Card>
    </>
  );
}
