import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/components/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dokument/", "/api/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
