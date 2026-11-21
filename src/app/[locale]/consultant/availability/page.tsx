import { Trash2 } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form-controls";
import { Alert, Card, CardBody, CardHeader, EmptyState } from "@/components/ui/primitives";
import { PageTitle } from "@/components/dashboard/shell";
import { addAvailabilityAction, addExceptionAction, clearAvailabilityAction, deleteAvailabilityAction } from "@/lib/actions/dashboard";
import { requireUser } from "@/lib/auth/session";
import { getMyConsultant } from "@/lib/data/consultant";
import { createClient } from "@/lib/supabase/server";

export default async function AvailabilityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, ["consultant"]);
  const t = await getTranslations();
  const c = await getMyConsultant(user.id);
  if (!c) return <Alert>{t("consultant.onboardingText")}</Alert>;
  const supabase = await createClient();
  const [{ data: slots }, { data: exceptions }] = await Promise.all([
    supabase.from("availability").select("*").eq("consultant_id", c.id).order("weekday").order("start_time"),
    supabase.from("availability_exceptions").select("*").eq("consultant_id", c.id).order("created_at", { ascending: false }).limit(20),
  ]);
  const days = t.raw("profile.days") as string[];
  const order = [1, 2, 3, 4, 5, 6, 0];

  return (
    <>
      <PageTitle title={t("consultant.availability")} />
      <p className="mb-4 text-sm text-muted">{t("profile.weekly", { tz: c.timezone })}</p>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardBody>
            {(slots ?? []).length === 0 ? (
              <EmptyState title={t("common.noAvailability")} />
            ) : (
              <ul className="divide-y divide-line">
                {order.map((d) => {
                  const ds = (slots ?? []).filter((s) => s.weekday === d);
                  if (!ds.length) return null;
                  return (
                    <li key={d} className="flex flex-wrap items-center gap-3 py-3">
                      <span className="w-28 font-medium text-navy">{days[d]}</span>
                      {ds.map((s) => (
                        <form key={s.id} action={deleteAvailabilityAction} className="flex items-center gap-1 rounded-full bg-cloud py-1 pl-3 pr-1 text-sm tabular-nums">
                          {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                          <input type="hidden" name="id" value={s.id} />
                          <button type="submit" className="rounded-full p-1 text-muted hover:bg-white hover:text-danger" aria-label="Supprimer / Delete">
                            <Trash2 className="size-3.5" />
                          </button>
                        </form>
                      ))}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><h2 className="font-semibold">{t("consultant.addSlot")}</h2></CardHeader>
            <CardBody>
              <form action={addAvailabilityAction} className="space-y-3">
                <div>
                  <Label htmlFor="weekday">Jour / Day</Label>
                  <Select id="weekday" name="weekday" defaultValue="all">
                    <option value="all">Tous les jours / Every day</option>
                    <option value="weekdays">Du lundi au vendredi / Mon–Fri</option>
                    <option value="weekend">Week-end (sam. + dim.)</option>
                    <optgroup label="Un seul jour / One day">
                      {order.map((d) => <option key={d} value={d}>{days[d]}</option>)}
                    </optgroup>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label htmlFor="startTime">De / From</Label><Input id="startTime" name="startTime" type="time" defaultValue="09:00" required /></div>
                  <div><Label htmlFor="endTime">À / To</Label><Input id="endTime" name="endTime" type="time" defaultValue="17:00" required /></div>
                </div>
                <Button type="submit" className="w-full">{t("consultant.addSlot")}</Button>
              </form>
              {(slots ?? []).length > 0 && (
                <form action={clearAvailabilityAction} className="mt-3">
                  <Button type="submit" variant="ghost" size="sm" className="w-full text-danger">Tout effacer / Clear all</Button>
                </form>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader><h2 className="font-semibold">Absences / Time off</h2></CardHeader>
            <CardBody>
              <form action={addExceptionAction} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Input name="from" type="date" required aria-label="From" />
                  <Input name="to" type="date" required aria-label="To" />
                </div>
                <Input name="reason" placeholder="Motif / Reason" maxLength={200} aria-label="Reason" />
                <Button type="submit" variant="outline" className="w-full">+</Button>
              </form>
              <ul className="mt-4 space-y-1 text-sm text-muted">
                {(exceptions ?? []).map((e) => <li key={e.id}>{String(e.period).replace(/[[\]()"]/g, "").split(",").map((x: string) => x.slice(0, 10)).join(" → ")} {e.reason && `· ${e.reason}`}</li>)}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
