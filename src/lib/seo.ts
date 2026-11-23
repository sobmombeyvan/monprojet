import type { Metadata } from "next";
import { site } from "@/config/site";

export function localizedPath(locale: string, pathname = "") {
  const clean = pathname === "/" ? "" : `/${pathname.replace(/^\/+|\/+$/g, "")}`;
  return locale === "en" ? `/en${clean}` : clean || "/";
}

export function buildMetadata({
  locale,
  pathname = "",
  title,
  description,
  image,
  noIndex = false,
}: {
  locale: string;
  pathname?: string;
  title: string;
  description: string;
  image?: string;
  noIndex?: boolean;
}): Metadata {
  const canonicalPath = localizedPath(locale, pathname);
  const canonical = new URL(canonicalPath, site.url).toString();
  const fr = new URL(localizedPath("fr", pathname), site.url).toString();
  const en = new URL(localizedPath("en", pathname), site.url).toString();

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { fr, en, "x-default": fr },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: site.name,
      locale: locale === "en" ? "en_GB" : "fr_FR",
      alternateLocale: locale === "en" ? ["fr_FR"] : ["en_GB"],
      type: "website",
      images: image ? [{ url: new URL(image, site.url).toString() }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [new URL(image, site.url).toString()] : undefined,
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  };
}
