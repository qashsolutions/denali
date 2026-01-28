import type { MetadataRoute } from "next";
import { BRAND } from "@/config";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = BRAND.SITE_URL;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
