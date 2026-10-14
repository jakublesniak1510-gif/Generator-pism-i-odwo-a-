import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Faq } from "@/components/Faq";
import { pluralPl } from "@/components/format-pl";
import { LetterWizard } from "@/components/generator/LetterWizard";
import { LegalBasisList } from "@/components/LegalBasisList";
import { Markdown } from "@/components/Markdown";
import { SITE_NAME, absoluteUrl, formatPrice } from "@/components/site";
import { TemplateCard } from "@/components/TemplateCard";
import { TemplateIcon } from "@/components/TemplateIcon";
import { CheckIcon, Container } from "@/components/ui";
import { getAllTemplates, getTemplate } from "@/lib/templates";
import type { DeadlineRule, LetterTemplate } from "@/lib/templates/types";

type Params = { slug: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return getAllTemplates().map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const t = getTemplate(slug);
  if (!t) return {};
  const title = t.seo.title || t.name;
  const description = t.seo.metaDescription || t.shortDescription;
  const path = `/pisma/${t.slug}`;
  return {
    // seo.title to pełny <title> (max ~60 znaków) – bez dopisywania nazwy serwisu
    title: { absolute: title },
    description,
    keywords: t.seo.keywords.length ? t.seo.keywords : undefined,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: "pl_PL",
    },
  };
}

function describeDeadline(d: DeadlineRule): string {
  const parts: string[] = [];
  if (d.years) parts.push(`${d.years} ${pluralPl(d.years, "rok", "lata", "lat")}`);
  if (d.months) parts.push(`${d.months} ${pluralPl(d.months, "miesiąc", "miesiące", "miesięcy")}`);
  if (d.days) parts.push(`${d.days} ${d.days === 1 ? "dzień" : "dni"}`);
  return parts.join(" i ");
}

/** 3 inne pisma: najpierw z tej samej kategorii. */
function relatedTemplates(current: LetterTemplate): LetterTemplate[] {
  const others = getAllTemplates().filter((t) => t.slug !== current.slug);
  const same = others.filter((t) => t.category === current.category);
  const rest = others.filter((t) => t.category !== current.category);
  return [...same, ...rest].slice(0, 3);
}

export default async function TemplatePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const t = getTemplate(slug);
  if (!t) notFound();

  const price = formatPrice(t.priceGrosze);
  const h1 = t.seo.h1 || t.name;
  const related = relatedTemplates(t);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Strona główna", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Pisma", item: absoluteUrl("/#pisma") },
          { "@type": "ListItem", position: 3, name: t.name, item: absoluteUrl(`/pisma/${t.slug}`) },
        ],
      },
      ...(t.seo.faq.length
        ? [
            {
              "@type": "FAQPage",
              mainEntity: t.seo.faq.map((f) => ({
                "@type": "Question",
                name: f.question,
                acceptedAnswer: { "@type": "Answer", text: f.answer },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <>
      {/* Nagłówek strony */}
      <div className="border-b border-navy-100 bg-gradient-to-b from-navy-50 to-white">
        <Container className="pt-6 pb-10 sm:pb-12">
          <Breadcrumbs items={[{ label: "Strona główna", href: "/" }, { label: "Pisma", href: "/#pisma" }, { label: t.name }]} />
          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-navy-800 text-white">
                  <TemplateIcon icon={t.icon} category={t.category} />
                </span>
                <span className="text-sm text-gray-600">
                  ok. {t.estimatedMinutes} min · {price}
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">{h1}</h1>
              {t.seo.intro ? (
                <div className="mt-4 max-w-2xl text-lg">
                  <Markdown className="text-lg text-gray-700">{t.seo.intro}</Markdown>
                </div>
              ) : (
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-700">{t.shortDescription}</p>
              )}
              <a
                href="#generator"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent-400 px-5 py-3 font-semibold text-navy-950 shadow-sm transition-colors hover:bg-accent-300"
              >
                Wypełnij formularz <span aria-hidden="true">↓</span>
              </a>
            </div>

            <aside aria-labelledby="co-dostaniesz" className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
              <h2 id="co-dostaniesz" className="font-semibold text-navy-900">
                Co dostaniesz
              </h2>
              <ul className="mt-3 space-y-2.5 text-sm text-gray-700">
                <li className="flex gap-2">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-navy-700" />
                  Gotowe pismo w formatach DOCX i PDF
                </li>
                <li className="flex gap-2">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-navy-700" />
                  Instrukcję: komu, gdzie i jak je wysłać
                </li>
                <li className="flex gap-2">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-navy-700" />
                  Wyliczone terminy dla Twojej sprawy
                </li>
                <li className="flex gap-2">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-navy-700" />
                  Podstawy prawne z aktualnych przepisów, nie z AI
                </li>
              </ul>
              <div className="mt-4 flex items-baseline justify-between border-t border-navy-100 pt-4">
                <span className="text-sm text-gray-600">Cena</span>
                <span className="text-2xl font-bold text-navy-900">{price}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">Podgląd pisma przed zapłatą jest bezpłatny.</p>
            </aside>
          </div>
        </Container>
      </div>

      {/* Generator */}
      <section id="generator" aria-labelledby="generator-heading" className="scroll-mt-20 py-10 sm:py-14">
        <Container narrow>
          <h2 id="generator-heading" className="text-2xl font-bold tracking-tight text-navy-900">
            Przygotuj pismo
          </h2>
          <p className="mt-1 text-gray-600">Odpowiedz na kilka pytań – resztą zajmie się szablon.</p>
          <div className="mt-6">
            <LetterWizard slug={t.slug} templateName={t.name} sections={t.sections} priceGrosze={t.priceGrosze} />
          </div>
        </Container>
      </section>

      <Container narrow className="space-y-14 pb-16">
        {/* Poradnik */}
        {t.seo.guide.length ? (
          <section aria-label="Poradnik" className="space-y-10">
            {t.seo.guide.map((g, i) => (
              <div key={i}>
                <h2 className="text-2xl font-bold tracking-tight text-navy-900">{g.heading}</h2>
                <div className="mt-3">
                  <Markdown>{g.body}</Markdown>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {/* Podstawa prawna */}
        {t.legalBasis.length ? (
          <section aria-labelledby="podstawa-prawna">
            <h2 id="podstawa-prawna" className="text-2xl font-bold tracking-tight text-navy-900">
              Podstawa prawna
            </h2>
            <p className="mt-2 text-gray-600">Te przepisy są wpisane na stałe w szablon pisma.</p>
            <div className="mt-4">
              <LegalBasisList items={t.legalBasis} />
            </div>
          </section>
        ) : null}

        {/* Terminy */}
        {t.deadlines.length ? (
          <section aria-labelledby="terminy">
            <h2 id="terminy" className="text-2xl font-bold tracking-tight text-navy-900">
              Terminy
            </h2>
            <p className="mt-2 text-gray-600">
              Dokładne daty wyliczymy po wypełnieniu formularza – zobaczysz je przy gotowym piśmie.
            </p>
            <ul className="mt-4 space-y-3">
              {t.deadlines.map((d) => {
                const span = describeDeadline(d);
                return (
                  <li key={d.id} className="rounded-lg border border-navy-100 bg-white p-4">
                    <p className="font-semibold text-navy-900">
                      {d.label}
                      {span ? <span className="ml-2 rounded-full bg-navy-100 px-2 py-0.5 text-xs font-semibold text-navy-800">{span}</span> : null}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-gray-700">{d.description}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {/* FAQ */}
        {t.seo.faq.length ? (
          <section aria-labelledby="faq">
            <h2 id="faq" className="text-2xl font-bold tracking-tight text-navy-900">
              Najczęstsze pytania
            </h2>
            <div className="mt-4">
              <Faq items={t.seo.faq} />
            </div>
          </section>
        ) : null}

        <p className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          Serwis jest narzędziem do tworzenia dokumentów i nie stanowi porady prawnej. W skomplikowanych sprawach
          skonsultuj się z prawnikiem lub rzecznikiem konsumentów.
        </p>
      </Container>

      {/* Inne pisma */}
      {related.length ? (
        <section aria-labelledby="inne-pisma" className="border-t border-navy-100 bg-navy-50/50 py-12 sm:py-16">
          <Container>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="inne-pisma" className="text-2xl font-bold tracking-tight text-navy-900">
                Inne pisma
              </h2>
              <Link href="/#pisma" className="text-sm font-medium text-navy-700 underline underline-offset-2 hover:text-navy-900">
                Wszystkie pisma
              </Link>
            </div>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => (
                <li key={r.slug}>
                  <TemplateCard
                    template={{
                      slug: r.slug,
                      name: r.name,
                      shortDescription: r.shortDescription,
                      icon: r.icon,
                      category: r.category,
                      priceGrosze: r.priceGrosze,
                      estimatedMinutes: r.estimatedMinutes,
                    }}
                  />
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
