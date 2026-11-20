"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { Alert } from "@/components/ui/primitives";
import { createConsultantAccount } from "@/lib/actions/admin-consultants";

export function NewConsultantForm() {
  const [state, action, pending] = useActionState(createConsultantAccount, {});
  return (
    <form action={action} className="space-y-4">
      {state.errors && <Alert tone="error">{state.errors.join(" ")}</Alert>}
      <Field label="Nom professionnel" htmlFor="fullName"><Input id="fullName" name="fullName" required minLength={2} /></Field>
      <Field label="E-mail" htmlFor="email"><Input id="email" name="email" type="email" required /></Field>
      <Field label="Mot de passe temporaire (facultatif)" htmlFor="password">
        <Input id="password" name="password" type="text" minLength={8} autoComplete="new-password" placeholder="8 caractères minimum" />
      </Field>
      <p className="text-xs leading-5 text-muted">
        Avec un mot de passe : le compte est créé tout de suite, communiquez-le à l&apos;expert (il pourra le changer).
        Sans mot de passe : l&apos;expert reçoit un e-mail d&apos;invitation. Si l&apos;e-mail a déjà un compte, ce compte devient expert.
      </p>
      <Button type="submit" loading={pending}>Créer et modifier le profil</Button>
    </form>
  );
}
