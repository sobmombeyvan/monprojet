import { notFound } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { sandboxCompleteAction } from "@/lib/booking/actions";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";

/**
 * Hosted "checkout" of the SANDBOX provider (development / staging only).
 * Clicking a button makes the server send a signed webhook to /api/webhooks/payments/sandbox,
 * exactly like a real provider would.
 */
export default async function SandboxCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  if (process.env.APP_ENV === "production") notFound();
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale);
  const { payment } = await searchParams;
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("payments")
    .select("reference, amount, currency, status, provider")
    .eq("reference", payment ?? "")
    .maybeSingle();
  if (!p || p.provider !== "sandbox") notFound();

  return (
    <div className="bg-cloud">
      <div className="container-page flex max-w-lg justify-center py-16">
        <Card className="w-full p-8">
          <div className="flex items-center gap-2 text-warning">
            <FlaskConical className="size-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Sandbox — paiement de test</span>
          </div>
          <p className="mt-6 text-sm text-muted">{p.reference}</p>
          <p className="mt-1 text-3xl font-semibold text-navy">{formatPrice(p.amount, p.currency, locale)}</p>
          <Alert tone="warning" className="mt-6">
            Aucun argent réel n&apos;est débité. Les paiements réels nécessitent la configuration de Fapshi (Mobile Money)
            (voir README).
          </Alert>
          {p.status === "pending" || p.status === "processing" ? (
            <div className="mt-6 grid gap-3">
              <form action={sandboxCompleteAction}>
                <input type="hidden" name="payment" value={p.reference} />
                <input type="hidden" name="outcome" value="succeeded" />
                <Button type="submit" className="w-full">Simuler un paiement réussi</Button>
              </form>
              <form action={sandboxCompleteAction}>
                <input type="hidden" name="payment" value={p.reference} />
                <input type="hidden" name="outcome" value="failed" />
                <Button type="submit" variant="outline" className="w-full">Simuler un échec</Button>
              </form>
            </div>
          ) : (
            <Alert className="mt-6">Statut actuel : {p.status}</Alert>
          )}
        </Card>
      </div>
    </div>
  );
}
