"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  forgotPasswordAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
  type ActionState,
} from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { Alert } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

function useMessages() {
  const t = useTranslations("auth");
  const v = useTranslations("validation");
  const e = useTranslations("errors");
  const fe = (state: ActionState, k: string) => (state.fieldErrors?.[k] ? v(state.fieldErrors[k] as "required") : undefined);
  const err = (state: ActionState) =>
    state.error === "rateLimited" ? e("rateLimited") : state.error === "invalidCredentials" ? t("invalidCredentials") : state.error;
  return { t, fe, err };
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signInAction, {});
  const { t, fe, err } = useMessages();
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Alert tone="error">{err(state)}</Alert>}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label={t("email")} htmlFor="email" error={fe(state, "email")}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!fe(state, "email")} />
      </Field>
      <Field label={t("password")} htmlFor="password" error={fe(state, "password")}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <div className="text-right">
        <Link href="/forgot-password" className="text-sm font-medium text-teal-600 hover:underline">
          {t("forgot")}
        </Link>
      </div>
      <Button type="submit" className="w-full" loading={pending}>
        {t("submitLogin")}
      </Button>
      <p className="text-center text-sm text-muted">
        {t("noAccount")}{" "}
        <Link href="/register" className="font-semibold text-teal-600 hover:underline">
          {t("submitRegister")}
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ defaultType = "client" }: { defaultType?: "client" | "consultant" }) {
  const [state, action, pending] = useActionState(signUpAction, {});
  const { t, fe, err } = useMessages();
  if (state.ok && state.message === "checkEmail") return <Alert tone="success">{t("checkEmail")}</Alert>;
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Alert tone="error">{err(state)}</Alert>}
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-navy">{t("accountType")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["client", "consultant"] as const).map((type) => (
            <label key={type} className="cursor-pointer">
              <input type="radio" name="accountType" value={type} defaultChecked={type === defaultType} className="peer sr-only" />
              <span
                className={cn(
                  "block rounded-lg border border-line px-3 py-3 text-center text-sm font-medium text-navy transition-colors",
                  "peer-checked:border-teal peer-checked:bg-teal-50 peer-checked:text-teal-600 peer-focus-visible:ring-2 peer-focus-visible:ring-teal",
                )}
              >
                {type === "client" ? t("asClient") : t("asConsultant")}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label={t("fullName")} htmlFor="fullName" error={fe(state, "fullName")}>
        <Input id="fullName" name="fullName" autoComplete="name" required />
      </Field>
      <Field label={t("email")} htmlFor="email" error={fe(state, "email")}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label={t("password")} htmlFor="password" error={fe(state, "password")} hint={t("passwordHint")}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <label className="flex items-start gap-2 text-sm text-muted">
        <input type="checkbox" name="acceptTerms" className="mt-0.5 size-4 accent-teal" required />
        <span>
          {t("acceptTerms")}{" "}
          <Link href="/terms" className="text-teal-600 underline">CGU</Link> ·{" "}
          <Link href="/privacy" className="text-teal-600 underline">RGPD</Link>
        </span>
      </label>
      {fe(state, "acceptTerms") && <p className="text-xs text-danger">{fe(state, "acceptTerms")}</p>}
      <Button type="submit" className="w-full" loading={pending}>
        {t("submitRegister")}
      </Button>
      <p className="text-center text-sm text-muted">
        {t("hasAccount")}{" "}
        <Link href="/login" className="font-semibold text-teal-600 hover:underline">
          {t("submitLogin")}
        </Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, {});
  const { t, fe, err } = useMessages();
  if (state.ok) return <Alert tone="success">{t("linkSent")}</Alert>;
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Alert tone="error">{err(state)}</Alert>}
      <Field label={t("email")} htmlFor="email" error={fe(state, "email")}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" className="w-full" loading={pending}>
        {t("sendLink")}
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, {});
  const { t, fe, err } = useMessages();
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Alert tone="error">{err(state)}</Alert>}
      <Field label={t("newPassword")} htmlFor="password" error={fe(state, "password")} hint={t("passwordHint")}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" className="w-full" loading={pending}>
        {t("updatePassword")}
      </Button>
    </form>
  );
}
