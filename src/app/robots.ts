import type { MetadataRoute } from "next";
import { site } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  const isProd = process.env.APP_ENV === "production" || !!process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const privatePaths = [
    "/admin", "/dashboard", "/consultant", "/booking", "/login", "/register", "/api",
    "/en/admin", "/en/dashboard", "/en/consultant", "/en/booking", "/en/login", "/en/register", "/en/api",
  ];
  return {
    // Staging et préproduction ne doivent pas être indexés
    rules: isProd
      ? { userAgent: "*", allow: "/", disallow: [...privatePaths, "/*?"] }
      : { userAgent: "*", disallow: "/" },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
