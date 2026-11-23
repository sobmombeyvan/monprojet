/**
 * Identité de la plateforme — modifiez ici (ou via les variables d'environnement)
 * pour renommer le site partout : en-tête, pied de page, e-mails, métadonnées, textes.
 */
export const site = {
  name: process.env.NEXT_PUBLIC_SITE_NAME ?? "MonProjet",
  descriptor: "Mobilité internationale & expertise",
  tagline: "Votre parcours, guidé par des experts.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
  contact: {
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "contact@monprojet.com",
    phone: process.env.NEXT_PUBLIC_CONTACT_PHONE || "+237 692 01 82 19",
    city: "Yaoundé, Cameroun",
  },
  /** Ville de départ affichée sur le globe et les cartes */
  origin: { city: "Douala", lon: 9.7, lat: 4.05 },
} as const;
