import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import { site } from "@/config/site";

/** Remplace {{brand}} dans tous les messages par le nom configuré du site. */
function withBrand<T>(value: T): T {
  if (typeof value === "string") return value.replaceAll("{{brand}}", site.name) as T;
  if (Array.isArray(value)) return value.map(withBrand) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withBrand(v)])) as T;
  return value;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: withBrand((await import(`../../messages/${locale}.json`)).default),
    timeZone: "Africa/Douala",
  };
});
