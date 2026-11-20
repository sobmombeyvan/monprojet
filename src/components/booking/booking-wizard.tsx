"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, ClipboardCheck, FileStack, MessagesSquare, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "@/i18n/navigation";
import { createBookingHoldAction, requestQuoteAction } from "@/lib/booking/actions";
import { bookingClientSchema, quoteRequestSchema } from "@/lib/validation/schemas";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { Alert, Avatar, Card, CardBody, CardHeader, Skeleton } from "@/components/ui/primitives";
import { VerificationBadge } from "@/components/experts/badges";
import { cn, formatPrice } from "@/lib/utils";

export type WizardService = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string | null;
  pricingType: "fixed" | "quote";
  basePrice: number | null;
  currency: string;
  bookable: boolean;
};
export type WizardOffer = {
  id: string;
  serviceId: string;
  price: number;
  currency: string;
  duration: number;
  methods: string[];
  consultant: { id: string; slug: string; name: string; title: string; photo: string | null; verification: string; rating: number; reviews: number };
};
type Country = { id: string; iso2: string; name: string; flag: string | null };

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = { MessagesSquare, ClipboardCheck, FileStack };
const TZ = "Africa/Douala";

const clientInfoSchema = bookingClientSchema.pick({
  fullName: true, email: true, phone: true, countryOfResidence: true,
  destinationCountryId: true, procedureType: true, description: true, consent: true,
});
type ClientInfo = z.infer<typeof clientInfoSchema>;

function dayKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function BookingWizard({
  services,
  offers,
  countries,
  residenceCountries,
  holdMinutes,
  initial,
}: {
  services: WizardService[];
  offers: WizardOffer[];
  countries: Country[];
  residenceCountries: { iso2: string; name: string }[];
  holdMinutes: number;
  initial: { serviceId?: string; offerId?: string; expertSlug?: string; fullName: string; email: string; phone: string; countryOfResidence: string };
}) {
  const t = useTranslations("booking");
  const tc = useTranslations("common");
  const tm = useTranslations("methods");
  const locale = useLocale();
  const router = useRouter();

  const preOffer = offers.find((o) => o.id === initial.offerId);
  const preConsultant = preOffer?.consultant.id ?? offers.find((o) => o.consultant.slug === initial.expertSlug)?.consultant.id;
  const [step, setStep] = useState<1 | 2 | 3>(initial.serviceId ? 2 : 1);
  const [serviceId, setServiceId] = useState(initial.serviceId);
  const [consultantId, setConsultantId] = useState(preConsultant);
  const [offerId, setOfferId] = useState(initial.offerId);
  const [method, setMethod] = useState<string | undefined>(preOffer?.methods[0]);
  const [slots, setSlots] = useState<{ starts_at: string; ends_at: string }[] | null>(null);
  const [slotsError, setSlotsError] = useState(false);
  const [day, setDay] = useState<string>();
  const [startsAt, setStartsAt] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [reloadKey, setReloadKey] = useState(0);

  const service = services.find((s) => s.id === serviceId);
  const serviceOffers = useMemo(() => offers.filter((o) => o.serviceId === serviceId), [offers, serviceId]);
  const consultants = useMemo(() => {
    const map = new Map<string, WizardOffer["consultant"]>();
    serviceOffers.forEach((o) => map.set(o.consultant.id, o.consultant));
    return [...map.values()].sort((a, b) => Number(b.verification === "verified") - Number(a.verification === "verified") || b.rating - a.rating);
  }, [serviceOffers]);
  const consultantOffers = serviceOffers.filter((o) => o.consultant.id === consultantId);
  const offer = offers.find((o) => o.id === offerId);

  // Default duration when a consultant is picked
  useEffect(() => {
    if (consultantId && !consultantOffers.some((o) => o.id === offerId)) {
      const first = consultantOffers[0];
      setOfferId(first?.id);
      setMethod(first?.methods[0]);
    }
  }, [consultantId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load slots for the selected offer (next 21 days)
  useEffect(() => {
    if (!offerId) return;
    const from = new Date();
    const to = new Date(Date.now() + 21 * 86400000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    setSlots(null);
    setSlotsError(false);
    setStartsAt(undefined);
    fetch(`/api/slots?consultantServiceId=${offerId}&from=${fmt(from)}&to=${fmt(to)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => {
        setSlots(j.slots);
        setDay(j.slots[0] ? dayKey(j.slots[0].starts_at) : undefined);
      })
      .catch(() => setSlotsError(true));
  }, [offerId, reloadKey]);

  const slotsByDay = useMemo(() => {
    const m = new Map<string, { starts_at: string }[]>();
    (slots ?? []).forEach((s) => {
      const k = dayKey(s.starts_at);
      m.set(k, [...(m.get(k) ?? []), s]);
    });
    return m;
  }, [slots]);

  const dateFmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { timeZone: TZ, ...opts }).format(new Date(iso));

  const form = useForm<ClientInfo>({
    resolver: zodResolver(clientInfoSchema),
    defaultValues: {
      fullName: initial.fullName,
      email: initial.email,
      phone: initial.phone,
      countryOfResidence: initial.countryOfResidence,
      destinationCountryId: "",
      procedureType: "",
      description: "",
      consent: false as unknown as true,
    },
  });
  const tv = useTranslations("validation");
  const err = (k: keyof ClientInfo) => {
    const m = form.formState.errors[k]?.message;
    return m ? tv(m as "required") : undefined;
  };

  function submit(values: ClientInfo) {
    if (!offer || !startsAt || !method) return;
    setError(undefined);
    start(async () => {
      const r = await createBookingHoldAction({ ...values, consultantServiceId: offer.id, startsAt, method });
      if (r.reference) router.push(`/booking/${r.reference}`);
      else {
        setError(r.error);
        if (r.error === "slot_unavailable" || r.error === "outside_availability") {
          setStep(2);
          setReloadKey((k) => k + 1); // keep selection, refresh slots
        }
      }
    });
  }

  const steps = [t("step1"), t("step2"), t("step3")];

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
      <div>
        {/* Stepper */}
        <ol className="mb-6 flex items-center gap-2 text-sm" aria-label="Progress">
          {steps.map((label, i) => {
            const n = (i + 1) as 1 | 2 | 3;
            const done = step > n;
            return (
              <li key={label} className="flex flex-1 items-center gap-2" aria-current={step === n ? "step" : undefined}>
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold", done ? "bg-teal text-white" : step === n ? "bg-navy text-white" : "bg-white text-muted ring-1 ring-line")}>
                  {done ? <Check className="size-4" /> : n}
                </span>
                <span className={cn("hidden font-medium sm:inline", step === n ? "text-navy" : "text-muted")}>{label}</span>
                {i < 2 && <span className="h-px flex-1 bg-line" />}
              </li>
            );
          })}
        </ol>

        {error && (
          <Alert tone="error" className="mb-4">
            {t(`errors.${error}` as "errors.generic")}
          </Alert>
        )}

        {/* Step 1 — service */}
        {step === 1 && (
          <Card>
            <CardHeader><h2 className="font-semibold">{t("chooseService")}</h2></CardHeader>
            <CardBody className="grid gap-3 md:grid-cols-3">
              {services.map((s) => {
                const Icon = ICONS[s.icon ?? ""] ?? MessagesSquare;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setServiceId(s.id);
                      setConsultantId(undefined);
                      setOfferId(undefined);
                      setStep(2);
                    }}
                    className={cn("flex flex-col rounded-xl border p-4 text-left transition-all hover:border-teal hover:shadow-[var(--shadow-card)]", serviceId === s.id ? "border-teal bg-teal-50" : "border-line bg-white")}
                  >
                    <Icon className="size-6 text-teal" />
                    <span className="mt-3 font-semibold text-navy">{s.name}</span>
                    <span className="mt-1 text-sm text-muted">{s.description}</span>
                    <span className="mt-auto pt-4 font-semibold text-navy">
                      {s.pricingType === "quote" ? tc("onQuote") : formatPrice(s.basePrice, s.currency, locale)}
                    </span>
                  </button>
                );
              })}
            </CardBody>
          </Card>
        )}

        {/* Quote-only service */}
        {step >= 2 && service && !service.bookable && <QuoteForm initial={initial} onBack={() => setStep(1)} />}

        {/* Step 2 — consultant & slot */}
        {step === 2 && service?.bookable && (
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="font-semibold">{t("chooseConsultant")}</h2>
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}><ArrowLeft /> {tc("back")}</Button>
            </CardHeader>
            <CardBody className="space-y-6">
              <div className="grid gap-2 sm:grid-cols-2">
                {consultants.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setConsultantId(c.id)}
                    aria-pressed={consultantId === c.id}
                    className={cn("flex items-center gap-3 rounded-xl border p-3 text-left transition-colors", consultantId === c.id ? "border-teal bg-teal-50" : "border-line bg-white hover:border-teal")}
                  >
                    <Avatar src={c.photo} name={c.name} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-navy">{c.name}</span>
                      <span className="block truncate text-xs text-muted">{c.title}</span>
                      <span className="mt-1 flex items-center gap-2">
                        <VerificationBadge status={c.verification} />
                        {c.reviews > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-navy">
                            <Star className="size-3 fill-amber-400 text-amber-400" />{c.rating.toFixed(1)}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              {consultantId && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("duration")} htmlFor="bk-duration">
                    <Select id="bk-duration" value={offerId ?? ""} onChange={(e) => { setOfferId(e.target.value); setMethod(offers.find((o) => o.id === e.target.value)?.methods[0]); }}>
                      {consultantOffers.map((o) => (
                        <option key={o.id} value={o.id}>
                          {tc("minutes", { count: o.duration })} — {formatPrice(o.price, o.currency, locale)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t("method")} htmlFor="bk-method">
                    <Select id="bk-method" value={method ?? ""} onChange={(e) => setMethod(e.target.value)}>
                      {(offer?.methods ?? []).map((m) => (
                        <option key={m} value={m}>{tm(m as "video")}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
              )}

              {offerId && (
                <div>
                  <h3 className="text-sm font-semibold text-navy">{t("slots")}</h3>
                  {slotsError ? (
                    <Alert tone="error" className="mt-3">{t("errors.generic")}</Alert>
                  ) : slots === null ? (
                    <div className="mt-3 grid grid-cols-4 gap-2" aria-label={t("loadingSlots")}>
                      {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
                    </div>
                  ) : slots.length === 0 ? (
                    <Alert className="mt-3">{t("noSlots")}</Alert>
                  ) : (
                    <>
                      <div className="mt-3 flex gap-2 overflow-x-auto pb-2" role="listbox" aria-label={t("date")}>
                        {[...slotsByDay.keys()].map((k) => {
                          const first = slotsByDay.get(k)![0].starts_at;
                          return (
                            <button
                              key={k}
                              type="button"
                              role="option"
                              aria-selected={day === k}
                              onClick={() => { setDay(k); setStartsAt(undefined); }}
                              className={cn("flex w-16 shrink-0 flex-col items-center rounded-lg border py-2 text-xs", day === k ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-teal")}
                            >
                              <span className="uppercase">{dateFmt(first, { weekday: "short" })}</span>
                              <span className="text-lg font-semibold">{dateFmt(first, { day: "numeric" })}</span>
                              <span>{dateFmt(first, { month: "short" })}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5" role="listbox" aria-label={t("slots")}>
                        {(slotsByDay.get(day ?? "") ?? []).map((s) => (
                          <button
                            key={s.starts_at}
                            type="button"
                            role="option"
                            aria-selected={startsAt === s.starts_at}
                            onClick={() => setStartsAt(s.starts_at)}
                            className={cn("h-10 rounded-lg border text-sm font-medium tabular-nums", startsAt === s.starts_at ? "border-teal bg-teal text-white" : "border-line bg-white text-navy hover:border-teal")}
                          >
                            {dateFmt(s.starts_at, { hour: "2-digit", minute: "2-digit" })}
                          </button>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-muted">{t("timezoneNote")}</p>
                    </>
                  )}
                </div>
              )}
              <div className="flex justify-end">
                <Button disabled={!startsAt || !method} onClick={() => { setError(undefined); setStep(3); }}>
                  {tc("next")}
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Step 3 — client information */}
        {step === 3 && offer && startsAt && (
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="font-semibold">{t("step3")}</h2>
              <Button variant="ghost" size="sm" onClick={() => setStep(2)}><ArrowLeft /> {tc("back")}</Button>
            </CardHeader>
            <CardBody>
              <form onSubmit={form.handleSubmit(submit)} className="grid gap-4 sm:grid-cols-2" noValidate>
                <Field label={t("fullName")} htmlFor="fullName" error={err("fullName")}>
                  <Input id="fullName" autoComplete="name" aria-invalid={!!err("fullName")} {...form.register("fullName")} />
                </Field>
                <Field label={t("email")} htmlFor="email" error={err("email")}>
                  <Input id="email" type="email" autoComplete="email" aria-invalid={!!err("email")} {...form.register("email")} />
                </Field>
                <Field label={t("phone")} htmlFor="phone" error={err("phone")}>
                  <Input id="phone" type="tel" autoComplete="tel" placeholder="+237 6XX XX XX XX" aria-invalid={!!err("phone")} {...form.register("phone")} />
                </Field>
                <Field label={t("residence")} htmlFor="countryOfResidence" error={err("countryOfResidence")}>
                  <Select id="countryOfResidence" {...form.register("countryOfResidence")}>
                    {residenceCountries.map((c) => <option key={c.iso2} value={c.iso2}>{c.name}</option>)}
                  </Select>
                </Field>
                <Field label={t("destination")} htmlFor="destinationCountryId">
                  <Select id="destinationCountryId" {...form.register("destinationCountryId")}>
                    <option value="">—</option>
                    {countries.map((c) => <option key={c.id} value={c.id}>{c.flag} {c.name}</option>)}
                  </Select>
                </Field>
                <Field label={t("procedureType")} htmlFor="procedureType" error={err("procedureType")}>
                  <Input id="procedureType" {...form.register("procedureType")} />
                </Field>
                <Field label={t("description")} htmlFor="description" error={err("description")} hint={t("descriptionHint")} className="sm:col-span-2">
                  <Textarea id="description" maxLength={4000} {...form.register("description")} />
                </Field>
                <label className="flex items-start gap-2 text-sm text-muted sm:col-span-2">
                  <input type="checkbox" className="mt-0.5 size-4 accent-teal" {...form.register("consent")} />
                  {t("consent")}
                </label>
                {err("consent") && <p className="text-xs text-danger sm:col-span-2">{err("consent")}</p>}
                <div className="sm:col-span-2">
                  <Alert>{t("holdNotice", { minutes: holdMinutes })}</Alert>
                  <Button type="submit" size="lg" className="mt-4 w-full" loading={pending}>
                    {t("continueToSummary")}
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        )}
      </div>

      {/* Live summary */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardHeader><h2 className="font-semibold">{t("summary")}</h2></CardHeader>
          <CardBody>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted">{t("step1")}</dt><dd className="text-right font-medium text-navy">{service?.name ?? "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">{t("chooseConsultant")}</dt><dd className="text-right font-medium text-navy">{offer?.consultant.name ?? "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">{t("duration")}</dt><dd className="text-right font-medium text-navy">{offer ? tc("minutes", { count: offer.duration }) : "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">{t("method")}</dt><dd className="text-right font-medium text-navy">{method ? tm(method as "video") : "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">{t("date")}</dt><dd className="text-right font-medium text-navy">{startsAt ? dateFmt(startsAt, { dateStyle: "full", timeStyle: "short" }) : "—"}</dd></div>
            </dl>
            <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
              <span className="font-semibold text-navy">{t("finalPrice")}</span>
              <span className="text-xl font-semibold text-navy">
                {offer ? formatPrice(offer.price, offer.currency, locale) : service?.pricingType === "quote" ? tc("onQuote") : "—"}
              </span>
            </div>
          </CardBody>
        </Card>
      </aside>
    </div>
  );
}

function QuoteForm({ initial, onBack }: { initial: { fullName: string; email: string; phone: string }; onBack: () => void }) {
  const t = useTranslations("booking");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const [done, setDone] = useState<string>();
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const form = useForm<z.infer<typeof quoteRequestSchema>>({
    resolver: zodResolver(quoteRequestSchema),
    defaultValues: { fullName: initial.fullName, email: initial.email, phone: initial.phone, destination: "", description: "" },
  });
  const err = (k: keyof z.infer<typeof quoteRequestSchema>) => {
    const m = form.formState.errors[k]?.message;
    return m ? tv(m as "required") : undefined;
  };
  if (done) return <Alert tone="success" title={t("quoteTitle")}>{done}</Alert>;
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="font-semibold">{t("quoteTitle")}</h2>
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft /> {tc("back")}</Button>
      </CardHeader>
      <CardBody>
        <p className="mb-4 text-sm text-muted">{t("quoteText")}</p>
        {error && <Alert tone="error" className="mb-4">{t("errors.generic")}</Alert>}
        <form
          noValidate
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit((v) =>
            start(async () => {
              const r = await requestQuoteAction(v);
              if (r.ok) setDone(`${t("reference")} : ${r.reference}`);
              else setError(true);
            }),
          )}
        >
          <Field label={t("fullName")} htmlFor="q-name" error={err("fullName")}><Input id="q-name" {...form.register("fullName")} /></Field>
          <Field label={t("email")} htmlFor="q-email" error={err("email")}><Input id="q-email" type="email" {...form.register("email")} /></Field>
          <Field label={t("phone")} htmlFor="q-phone" error={err("phone")}><Input id="q-phone" type="tel" {...form.register("phone")} /></Field>
          <Field label={t("destination")} htmlFor="q-dest"><Input id="q-dest" {...form.register("destination")} /></Field>
          <Field label={t("description")} htmlFor="q-desc" error={err("description")} className="sm:col-span-2">
            <Textarea id="q-desc" {...form.register("description")} />
          </Field>
          <Button type="submit" className="sm:col-span-2" loading={pending}>{t("requestQuote")}</Button>
        </form>
      </CardBody>
    </Card>
  );
}
