import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/layout/legal-page";
import { site } from "@/config/site";

const FR = [
  { h: "1. Objet", p: `${site.name} est une plateforme d'information et de mise en relation entre des particuliers et des consultants indépendants dans le domaine de la mobilité internationale.` },
  { h: "2. Absence de garantie de résultat", p: `Aucune décision administrative (visa, permis, admission) ne peut être garantie par ${site.name} ni par les consultants. Les informations publiées ne constituent pas un avis juridique.` },
  { h: "3. Statut des consultants", p: "Le statut professionnel d'un consultant (représentant légal autorisé, professionnel agréé, consultant en immigration, spécialiste en orientation) n'est affiché qu'après vérification. Seuls les représentants autorisés vérifiés peuvent représenter un client auprès d'une administration." },
  { h: "4. Réservations et paiements", p: `Une réservation est confirmée uniquement après vérification du paiement par les serveurs de ${site.name}. Les annulations sont remboursées selon la politique affichée au moment de la réservation.` },
  { h: "5. Commission", p: `${site.name} perçoit une commission sur chaque consultation. Le classement des consultants ne dépend jamais du montant de cette commission.` },
];
const EN = [
  { h: "1. Purpose", p: `${site.name} is an information and matchmaking platform connecting individuals with independent consultants in international mobility.` },
  { h: "2. No guaranteed outcome", p: `No administrative decision (visa, permit, admission) can be guaranteed by ${site.name} or consultants. Published information is not legal advice.` },
  { h: "3. Consultant status", p: "A consultant's professional status (authorized legal representative, licensed professional, immigration consultant, orientation specialist) is only displayed after verification. Only verified authorized representatives may represent a client before an authority." },
  { h: "4. Bookings and payments", p: `A booking is confirmed only after ${site.name}'s servers verify the payment. Cancellations are refunded according to the policy shown at booking time.` },
  { h: "5. Commission", p: `${site.name} charges a commission on each consultation. Consultant ranking never depends on the commission amount.` },
];

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages");
  return <LegalPage title={t("termsTitle")} sections={locale === "en" ? EN : FR} />;
}
