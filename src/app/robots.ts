import type { MetadataRoute } from "next";
import { site } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  const isProd = process.env.APP_ENV === "production";
  return {
    // Staging et préproduction ne doivent pas être indexés
    rules: isProd ? { userAgent: "*", allow: "/", disallow: ["/admin", "/dashboard", "/consultant", "/booking", "/api"] } : { userAgent: "*", disallow: "/" },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
