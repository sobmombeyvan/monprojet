import { useTranslations } from "next-intl";
import { BadgeCheck, Clock, ShieldAlert, Scale, Award, Compass, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/primitives";

/** Verification badge — never claims more than what has been verified. */
export function VerificationBadge({ status }: { status: string }) {
  const t = useTranslations("common");
  if (status === "verified")
    return (
      <Badge tone="teal">
        <BadgeCheck /> {t("verified")}
      </Badge>
    );
  if (status === "pending")
    return (
      <Badge tone="warning">
        <Clock /> {t("pendingVerification")}
      </Badge>
    );
  return (
    <Badge tone="neutral">
      <ShieldAlert /> {t("unverified")}
    </Badge>
  );
}

const typeIcons = {
  authorized_legal_representative: Scale,
  licensed_professional: Award,
  immigration_consultant: Briefcase,
  orientation_specialist: Compass,
} as const;

/**
 * Professional-type badge. Regulated types (legal representative, licensed
 * professional) are only displayed once the profile is verified (§7).
 */
export function ProfessionalTypeBadge({ type, verification }: { type: string; verification: string }) {
  const t = useTranslations("types");
  const regulated = type === "authorized_legal_representative" || type === "licensed_professional";
  const shown = regulated && verification !== "verified" ? "immigration_consultant" : type;
  if (regulated && verification !== "verified") return null;
  const Icon = typeIcons[shown as keyof typeof typeIcons] ?? Compass;
  return (
    <Badge tone={regulated ? "navy" : "neutral"} title={t(`${shown}_desc` as "orientation_specialist_desc")}>
      <Icon /> {t(shown as "orientation_specialist")}
    </Badge>
  );
}
