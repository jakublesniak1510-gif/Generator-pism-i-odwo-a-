import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { GuideCard } from "@/components/GuideCard";
import { absoluteUrl } from "@/components/site";
import { Container } from "@/components/ui";
import { getAllGuides } from "@/content/poradniki";

const DESCRIPTION =
  "Praktyczne poradniki: jak wysłać pismo listem poleconym, jak liczyć terminy, co zrobić po odrzuconej reklamacji, do kogo zwrócić się o bezpłatną pomoc.";

export const metadata: Metadata = {
  title: "Poradniki – jak pisać i wysyłać pisma",
  description: DESCRIPTION,
  alternates: { canonical: "/poradniki" },
  openGraph: { title: "Poradniki – jak pisać i wysyłać pisma", description: DESCRIPTION, url: "/poradniki" },
};

export default function GuidesPage() {
  const guides = getAllGuides();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Strona główna", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Poradniki", item: absoluteUrl("/poradniki") },
        ],
      },
      {
        "@type": "ItemList",
        itemListElement: guides.map((g, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: absoluteUrl(`/poradniki/${g.slug}`),
          name: g.title,
        })),
      },
    ],
  };

  return (
    <>
      <div className="border-b border-navy-100 bg-navy-50/60">
        <Container className="pt-6 pb-10 sm:pb-14">
          <Breadcrumbs items={[{ label: "Strona główna", href: "/" }, { label: "Poradniki" }]} />
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">Poradniki</h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-gray-600">
            Jak napisać skuteczne pismo, jak je wysłać i co robić, gdy firma lub urząd nie odpowiada. Krótko, konkretnie
            i bez prawniczego żargonu.
          </p>
        </Container>
      </div>
      <Container className="py-10 sm:py-14">
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((g) => (
            <li key={g.slug}>
              <GuideCard guide={g} headingLevel="h2" />
            </li>
          ))}
        </ul>
        <p className="mt-10 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          Poradniki mają charakter informacyjny i nie stanowią porady prawnej. W skomplikowanych sprawach skonsultuj się
          z prawnikiem lub rzecznikiem konsumentów.
        </p>
      </Container>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
