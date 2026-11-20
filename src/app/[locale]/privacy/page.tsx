import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/layout/legal-page";
import { site } from "@/config/site";

const FR = [
  { h: "1. Responsable du traitement", p: `${site.name} traite les données personnelles nécessaires à la création de compte, à la mise en relation avec des experts, à la réservation et au paiement des consultations.` },
  { h: "2. Données collectées", p: `Identité, coordonnées, pays de résidence et de destination, description du projet, documents téléversés volontairement, historique des réservations et des paiements. Aucune donnée de carte bancaire n'est stockée par ${site.name} : elles sont traitées par les prestataires de paiement.` },
  { h: "3. Accès aux données", p: "Un consultant n'accède qu'aux informations des réservations qui lui sont attribuées. Les documents sont stockés dans des espaces privés et ne sont accessibles qu'à leur propriétaire et aux administrateurs habilités." },
  { h: "4. Conservation", p: "Les données sont conservées pendant la durée nécessaire aux finalités décrites et aux obligations légales, notamment comptables." },
  { h: "5. Vos droits", p: "Vous pouvez demander l'accès, la rectification ou la suppression de vos données via la page Contact." },
];
const EN = [
  { h: "1. Data controller", p: `${site.name} processes the personal data required for account creation, expert matching, booking and payment of consultations.` },
  { h: "2. Data collected", p: `Identity, contact details, country of residence and destination, project description, voluntarily uploaded documents, booking and payment history. ${site.name} never stores card data: it is processed by payment providers.` },
  { h: "3. Data access", p: "A consultant only accesses information from bookings assigned to them. Documents are stored in private spaces accessible only to their owner and authorized administrators." },
  { h: "4. Retention", p: "Data is retained for as long as necessary for the purposes described and legal obligations, including accounting." },
  { h: "5. Your rights", p: "You can request access, correction or deletion of your data through the Contact page." },
];

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages");
  return <LegalPage title={t("privacyTitle")} sections={locale === "en" ? EN : FR} />;
}
