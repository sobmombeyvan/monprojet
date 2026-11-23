import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Header } from "@/components/layout/header";
import { PwaRuntime } from "@/components/layout/pwa-runtime";
import { Footer } from "@/components/layout/footer";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { AssistantWidget } from "@/components/assistant/assistant-widget";
import "../globals.css";
import { site } from "@/config/site";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-jakarta", display: "swap" });

export const viewport: Viewport = { themeColor: "#102B46", viewportFit: "cover" };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "brand" });
  const description = t("secondary");
  const frUrl = new URL("/", site.url).toString();
  const enUrl = new URL("/en", site.url).toString();
  return {
    metadataBase: new URL(site.url),
    title: { default: `${site.name} — ${t("tagline")}`, template: `%s · ${site.name}` },
    description,
    alternates: { languages: { fr: frUrl, en: enUrl, "x-default": frUrl } },
    openGraph: {
      siteName: site.name,
      title: `${site.name} — ${t("tagline")}`,
      description,
      type: "website",
      locale: locale === "en" ? "en_GB" : "fr_FR",
      alternateLocale: locale === "en" ? ["fr_FR"] : ["en_GB"],
    },
    twitter: { card: "summary_large_image", title: `${site.name} — ${t("tagline")}`, description },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
    appleWebApp: { capable: true, title: site.name, statusBarStyle: "default" },
    icons: { icon: "/icon.svg", apple: "/apple-icon" },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("nav");

  return (
    <html lang={locale} className={`${inter.variable} ${jakarta.variable}`}>
      <body className="flex min-h-dvh flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
        <NextIntlClientProvider>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Organization",
                name: site.name,
                url: site.url,
                email: site.contact.email,
                telephone: site.contact.phone,
                logo: new URL("/icon.svg", site.url).toString(),
                address: { "@type": "PostalAddress", addressLocality: "Yaounde", addressCountry: "CM" },
              }).replace(/</g, "\\u003c"),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: site.name,
                url: site.url,
                inLanguage: [locale],
                potentialAction: {
                  "@type": "SearchAction",
                  target: `${site.url}${locale === "en" ? "/en" : ""}/knowledge?q={search_term_string}`,
                  "query-input": "required name=search_term_string",
                },
              }).replace(/</g, "\\u003c"),
            }}
          />
          <PwaRuntime />
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2">
            {t("skip")}
          </a>
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
          <MobileBottomNav />
          <AssistantWidget />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
