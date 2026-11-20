import { defineRouting } from "next-intl/routing";

export const locales = ["fr", "en"] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "fr",
  // French URLs have no prefix (/find-expert), English ones do (/en/find-expert)
  localePrefix: "as-needed",
});
