import { Star } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form-controls";
import { Alert, Card, EmptyState } from "@/components/ui/primitives";
import { PageTitle } from "@/components/dashboard/shell";
import { replyReviewAction } from "@/lib/actions/dashboard";
import { requireUser } from "@/lib/auth/session";
import { getMyConsultant } from "@/lib/data/consultant";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export default async function ConsultantReviewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, ["consultant"]);
  const t = await getTranslations();
  const c = await getMyConsultant(user.id);
  if (!c) return <Alert>{t("consultant.onboardingText")}</Alert>;
  const supabase = await createClient();
  const { data } = await supabase.from("reviews").select("*").eq("consultant_id", c.id).order("created_at", { ascending: false });
  return (
    <>
      <PageTitle title={t("consultant.reviews")} />
      {(data ?? []).length === 0 ? (
        <EmptyState icon={Star} title={t("profile.noReviews")} />
      ) : (
        <ul className="space-y-3">
          {data!.map((r) => (
            <li key={r.id}>
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-navy">{r.client_display_name}</span>
                  <span className="flex">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="size-4 fill-amber-400 text-amber-400" />)}</span>
                </div>
                {r.comment && <p className="mt-2 text-sm text-slate-700">{r.comment}</p>}
                <p className="mt-1 text-xs text-muted">{formatDate(r.created_at, locale)}</p>
                {r.consultant_reply ? (
                  <p className="mt-3 rounded-lg bg-cloud p-3 text-sm"><strong>{t("profile.reply")} :</strong> {r.consultant_reply}</p>
                ) : (
                  <form action={replyReviewAction} className="mt-3 space-y-2">
                    <input type="hidden" name="id" value={r.id} />
                    <Textarea name="reply" maxLength={2000} required className="min-h-20" aria-label={t("profile.reply")} />
                    <Button type="submit" size="sm" variant="outline">{t("profile.reply")}</Button>
                  </form>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
