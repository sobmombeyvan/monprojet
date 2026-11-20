"use client";
import { Star } from "lucide-react";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { submitReviewAction } from "@/lib/actions/dashboard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form-controls";
import { Alert, Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function ReviewForm({ bookingId, label }: { bookingId: string; label: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const t = useTranslations();
  return (
    <Card className="mb-4 p-4">
      <p className="font-semibold text-navy">{label}</p>
      <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Note">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}/5`} onClick={() => setRating(n)}>
            <Star className={cn("size-6", n <= rating ? "fill-amber-400 text-amber-400" : "text-line")} />
          </button>
        ))}
      </div>
      <Textarea className="mt-3" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
      {error && <Alert tone="error" className="mt-2">{t("common.errorTitle")}</Alert>}
      <Button
        className="mt-3"
        size="sm"
        disabled={rating === 0}
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await submitReviewAction(bookingId, rating, comment);
            if (r.ok) router.refresh();
            else setError(true);
          })
        }
      >
        {t("dashboard.submitReview")}
      </Button>
    </Card>
  );
}
