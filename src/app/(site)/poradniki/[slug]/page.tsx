import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { formatIsoDatePl } from "@/components/format-pl";
import { GuideCard } from "@/components/GuideCard";
import { Markdown } from "@/components/Markdown";
import { SITE_NAME, absoluteUrl } from "@/components/site";
import { TemplateCard } from "@/components/TemplateCard";
import { Container } from "@/components/ui";
import { getAllGuides, getGuide, readingMinutes } from "@/content/poradniki";
import { getTemplate } from "@/lib/templates";
import type { LetterTemplate } from "@/lib/templates/types";

type Params = { slug: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return getAllGuides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) return {};
  const path = `/poradniki/${g.slug}`;
  return {
    title: g.title,
    description: g.metaDescription,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      title: g.title,
      description: g.metaDescription,
      url: path,
      siteName: SITE_NAME,
      locale: "pl_PL",
      modifiedTime: g.updatedAt,
    },
  };
}

export default async function GuidePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) notFound();

  const templates = g.relatedTemplates
    .map((s) => getTemplate(s))
    .filter((t): t is LetterTemplate => Boolean(t));
  const otherGuides = getAllGuides()
    .filter((x) => x.slug !== g.slug)
    .slice(0, 3);
  const url = absoluteUrl(`/poradniki/${g.slug}`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: g.title,
        description: g.metaDescription,
        inLanguage: "pl-PL",
        dateModified: g.updatedAt,
        datePublished: g.updatedAt,
        mainEntityOfPage: url,
        url,
        author: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
        publisher: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Strona główna", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Poradniki", item: absoluteUrl("/poradniki") },
          { "@type": "ListItem", position: 3, name: g.title, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <div className="border-b border-navy-100 bg-gradient-to-b from-navy-50 to-white">
        <Container narrow className="pt-6 pb-8 sm:pb-10">
          <Breadcrumbs
            items={[{ label: "Strona główna", href: "/" }, { label: "Poradniki", href: "/poradniki" }, { label: g.title }]}
          />
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-navy-900 sm:text-4xl">{g.title}</h1>
          <p className="mt-3 text-sm text-gray-500">
            Aktualizacja: <time dateTime={g.updatedAt}>{formatIsoDatePl(g.updatedAt)}</time> · ok. {readingMinutes(g)} min
            czytania
          </p>
        </Container>
      </div>

      <Container narrow className="py-10 sm:py-12">
        <article lang="pl">
          <Markdown document className="text-[1.0625rem] text-gray-700">
            {g.body}
          </Markdown>
        </article>

        <p className="mt-10 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          Poradnik ma charakter informacyjny i nie stanowi porady prawnej. Przepisy się zmieniają – w ważnych sprawach
          sprawdź aktualny stan prawny lub skonsultuj się z prawnikiem albo rzecznikiem konsumentów.
        </p>
      </Container>

      {templates.length ? (
        <section aria-labelledby="powiazane-pisma" className="border-t border-navy-100 bg-navy-50/50 py-12 sm:py-14">
          <Container>
            <h2 id="powiazane-pisma" className="text-2xl font-bold tracking-tight text-navy-900">
              Przygotuj pismo w 2 minuty
            </h2>
            <p className="mt-1 text-gray-600">Pisma związane z tym poradnikiem – z podstawami prawnymi i instrukcją wysyłki.</p>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => (
                <li key={t.slug}>
                  <TemplateCard
                    template={{
                      slug: t.slug,
                      name: t.name,
                      shortDescription: t.shortDescription,
                      icon: t.icon,
                      category: t.category,
                      priceGrosze: t.priceGrosze,
                      estimatedMinutes: t.estimatedMinutes,
                    }}
                  />
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}

      <section aria-labelledby="inne-poradniki" className="py-12 sm:py-14">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="inne-poradniki" className="text-2xl font-bold tracking-tight text-navy-900">
              Inne poradniki
            </h2>
            <Link href="/poradniki" className="text-sm font-medium text-navy-700 underline underline-offset-2 hover:text-navy-900">
              Wszystkie poradniki
            </Link>
          </div>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {otherGuides.map((x) => (
              <li key={x.slug}>
                <GuideCard guide={x} />
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
