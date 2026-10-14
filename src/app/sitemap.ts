import type { MetadataRoute } from "next";
import { STATIC_PAGES, absoluteUrl } from "@/components/site";
import { getAllTemplates } from "@/lib/templates";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    ...getAllTemplates().map((t) => ({
      url: absoluteUrl(`/pisma/${t.slug}`),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    ...STATIC_PAGES.map((p) => ({
      url: absoluteUrl(p.path),
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: p.path === "/regulamin" || p.path === "/polityka-prywatnosci" ? 0.3 : 0.6,
    })),
  ];
}
