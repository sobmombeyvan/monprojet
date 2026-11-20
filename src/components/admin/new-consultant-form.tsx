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
      <Button type="submit" loading={pending}>Créer et modifier le profil</Button>
    </form>
  );
}
