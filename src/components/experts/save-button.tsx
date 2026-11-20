"use client";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toggleSavedConsultant } from "@/lib/actions/engagement";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SaveExpertButton({ consultantId, initial, signedIn }: { consultantId: string; initial: boolean; signedIn: boolean }) {
  const t = useTranslations("common");
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      aria-pressed={saved}
      loading={pending}
      onClick={() => {
        if (!signedIn) return router.push("/login");
        start(async () => {
          const r = await toggleSavedConsultant(consultantId);
          if (r.saved !== undefined) setSaved(r.saved);
        });
      }}
    >
      {!pending && <Heart className={cn(saved && "fill-teal text-teal")} />}
      {saved ? t("savedExpert") : t("saveExpert")}
    </Button>
  );
}
