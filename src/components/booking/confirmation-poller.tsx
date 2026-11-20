"use client";
import { CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { getBookingStatusAction } from "@/lib/booking/actions";
import { Button } from "@/components/ui/button";

type State = { booking: string; payment: string | null } | null;

/** Polls the server until the webhook has confirmed (or failed) the payment. */
export function ConfirmationPoller({ reference }: { reference: string }) {
  const t = useTranslations("booking");
  const [state, setState] = useState<State>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let stop = false;
    async function tick() {
      const s = await getBookingStatusAction(reference);
      if (stop) return;
      setState(s);
      setTries((n) => n + 1);
      const final = s && (s.booking !== "pending_payment" || s.payment === "failed" || s.payment === "cancelled");
      if (!final) setTimeout(tick, 2500);
    }
    tick();
    return () => {
      stop = true;
    };
  }, [reference]);

  const confirmed = state?.booking === "confirmed";
  const refund = state?.booking === "refund_required";
  const failed = state?.payment === "failed" || state?.payment === "cancelled";

  return (
    <div className="flex flex-col items-center text-center" aria-live="polite">
      {confirmed ? (
        <CheckCircle2 className="size-14 text-success" />
      ) : failed || refund ? (
        <XCircle className="size-14 text-danger" />
      ) : (
        <Loader2 className="size-14 animate-spin text-teal" />
      )}
      <h1 className="mt-5 text-2xl font-semibold">
        {confirmed ? t("confirmedTitle") : refund ? t("refundTitle") : failed ? t("failedTitle") : t("confirmationTitle")}
      </h1>
      <p className="mt-2 max-w-md text-muted">
        {confirmed ? t("confirmedText") : refund ? t("refundText") : failed ? t("failedText") : t("pendingText")}
      </p>
      <p className="mt-3 font-mono text-sm text-navy">{reference}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {failed && (
          <Button asChild>
            <Link href={`/booking/${reference}`}><RotateCcw /> {t("pay", { amount: "" }).trim()}</Link>
          </Button>
        )}
        <Button asChild variant={confirmed ? "primary" : "outline"}>
          <Link href="/dashboard/bookings">{t("viewBookings")}</Link>
        </Button>
      </div>
      {tries > 24 && !confirmed && !failed && <p className="mt-6 text-xs text-muted">{t("pendingText")}</p>}
    </div>
  );
}
