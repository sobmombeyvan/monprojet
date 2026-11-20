"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { contactAction } from "@/lib/actions/engagement";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { Alert } from "@/components/ui/primitives";

type State = { ok?: boolean; reference?: string; error?: string; fieldErrors?: Record<string, string> };

export function ContactForm() {
  const t = useTranslations();
  const [state, action, pending] = useActionState<State, FormData>(contactAction as never, {});
  const fe = (k: string) => (state.fieldErrors?.[k] ? t(`validation.${state.fieldErrors[k]}` as "validation.required") : undefined);
  if (state.ok) return <Alert tone="success">{t("pages.sent", { reference: state.reference ?? "" })}</Alert>;
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      {state.error && <Alert tone="error" className="sm:col-span-2">{state.error === "rateLimited" ? t("errors.rateLimited") : t("booking.errors.generic")}</Alert>}
      <Field label={t("auth.fullName")} htmlFor="c-name" error={fe("fullName")}><Input id="c-name" name="fullName" required /></Field>
      <Field label={t("auth.email")} htmlFor="c-email" error={fe("email")}><Input id="c-email" name="email" type="email" required /></Field>
      <Field label={t("pages.subject")} htmlFor="c-subject" error={fe("subject")} className="sm:col-span-2"><Input id="c-subject" name="subject" required /></Field>
      <Field label={t("pages.message")} htmlFor="c-message" error={fe("message")} className="sm:col-span-2"><Textarea id="c-message" name="message" required /></Field>
      {/* Honeypot — hidden from humans */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <Button type="submit" loading={pending} className="sm:col-span-2 sm:justify-self-start">{t("pages.send")}</Button>
    </form>
  );
}
