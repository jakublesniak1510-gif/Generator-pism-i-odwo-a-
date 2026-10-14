import type { Metadata } from "next";
import Link from "next/link";
import { Faq } from "@/components/Faq";
import { GENERAL_FAQ, HowItWorksSteps, PricingCards, TrustGrid } from "@/components/marketing";
import { PRICES, SITE_NAME, absoluteUrl, formatPrice } from "@/components/site";
import { TemplateCard } from "@/components/TemplateCard";
import { CheckIcon, Container, SectionHeading } from "@/components/ui";
import { CATEGORY_LABELS, getAllTemplates } from "@/lib/templates";
import type { LetterTemplate, TemplateCategory } from "@/lib/templates/types";

export const metadata: Metadata = {
  title: { absolute: "PismoGotowe – gotowe pismo lub odwołanie w 2 minuty" },
  alternates: { canonical: "/" },
  openGraph: {
    title: "Gotowe pismo lub odwołanie w 2 minuty",
    description:
      "Wybierasz pismo, odpowiadasz na kilka pytań i pobierasz gotowy dokument DOCX/PDF z instrukcją wysyłki.",
    url: "/",
  },
};

function groupByCategory(templates: LetterTemplate[]) {
  const order = Object.keys(CATEGORY_LABELS) as TemplateCategory[];
  return order
    .map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      items: templates.filter((t) => t.category === category),
    }))
    .filter((g) => g.items.length > 0);
}

export default function HomePage() {
  const templates = getAllTemplates();
  const groups = groupByCategory(templates);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url: absoluteUrl("/"),
        inLanguage: "pl-PL",
      },
      {
        "@type": "FAQPage",
        mainEntity: GENERAL_FAQ.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      },
    ],
  };

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-navy-900 text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(249,168,37,0.18),transparent_55%)]"
        />
        <Container className="relative grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm text-navy-100 ring-1 ring-white/15">
              <span className="h-2 w-2 rounded-full bg-accent-400" aria-hidden="true" />
              Reklamacje, odwołania, wypowiedzenia
            </p>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Gotowe pismo lub odwołanie <span className="text-accent-300">w&nbsp;2&nbsp;minuty</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-navy-100">
              Wybierasz pismo, odpowiadasz na kilka pytań i pobierasz gotowy dokument DOCX/PDF z instrukcją
              wysyłki. Podstawy prawne pochodzą z szablonów sprawdzonych przez prawnika.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="#pisma"
                className="inline-flex items-center justify-center rounded-lg bg-accent-400 px-6 py-3 text-base font-semibold text-navy-950 shadow-sm transition-colors hover:bg-accent-300"
              >
                Wybierz pismo
              </Link>
              <Link
                href="/jak-to-dziala"
                className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-base font-semibold text-white ring-1 ring-white/30 transition-colors hover:bg-white/10"
              >
                Jak to działa?
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-navy-100">
              {["Podgląd za darmo", `Od ${formatPrice(PRICES.single)}`, "Bez zakładania konta"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <CheckIcon className="h-4 w-4 text-accent-300" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Dekoracyjna „kartka” */}
          <div aria-hidden="true" className="hidden lg:block">
            <div className="relative mx-auto max-w-sm rotate-2 rounded-lg bg-white p-7 font-serif text-[11px] leading-relaxed text-gray-700 shadow-2xl">
              <div className="flex justify-between">
                <div className="space-y-1">
                  <div className="h-2 w-24 rounded bg-gray-200" />
                  <div className="h-2 w-20 rounded bg-gray-200" />
                  <div className="h-2 w-16 rounded bg-gray-200" />
                </div>
                <div className="h-2 w-24 rounded bg-gray-200" />
              </div>
              <div className="mt-6 ml-auto w-32 space-y-1">
                <div className="h-2 w-full rounded bg-gray-300" />
                <div className="h-2 w-24 rounded bg-gray-200" />
              </div>
              <p className="mt-6 text-center text-sm font-bold tracking-wide text-navy-900">REKLAMACJA TOWARU</p>
              <div className="mt-4 space-y-1.5">
                {[100, 95, 98, 80, 100, 92, 60].map((w, i) => (
                  <div key={i} className="h-2 rounded bg-gray-200" style={{ width: `${w}%` }} />
                ))}
              </div>
              <div className="mt-4 space-y-1.5">
                {[97, 100, 70].map((w, i) => (
                  <div key={i} className="h-2 rounded bg-gray-200" style={{ width: `${w}%` }} />
                ))}
              </div>
              <div className="mt-6 ml-auto w-28 border-t border-gray-300 pt-1 text-center text-[10px] text-gray-400">
                podpis
              </div>
              <span className="absolute -left-4 -top-4 rounded-full bg-accent-400 px-3 py-1.5 font-sans text-xs font-bold text-navy-950 shadow">
                DOCX + PDF
              </span>
            </div>
          </div>
        </Container>
      </section>

      {/* LISTA PISM */}
      <section id="pisma" aria-labelledby="pisma-heading" className="scroll-mt-20 bg-navy-50/50 py-14 sm:py-20">
        <Container>
          <SectionHeading
            id="pisma-heading"
            eyebrow="Pisma"
            title="Jakie pismo chcesz przygotować?"
            lead="Każdy szablon zawiera właściwe podstawy prawne, terminy i instrukcję wysyłki. Ty opisujesz tylko swoją sytuację."
          />
          <div className="mt-10 space-y-10">
            {groups.map((g) => (
              <div key={g.category}>
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-navy-600">{g.label}</h3>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {g.items.map((t) => (
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
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* JAK TO DZIAŁA */}
      <section aria-labelledby="jak-heading" className="py-14 sm:py-20">
        <Container>
          <SectionHeading id="jak-heading" eyebrow="Jak to działa" title="Trzy kroki do gotowego pisma" center />
          <div className="mt-10">
            <HowItWorksSteps />
          </div>
        </Container>
      </section>

      {/* ZAUFANIE */}
      <section aria-labelledby="zaufanie-heading" className="bg-navy-900 py-14 text-white sm:py-20">
        <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent-300">Dlaczego PismoGotowe</p>
            <h2 id="zaufanie-heading" className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Prawo z szablonu, fakty od Ciebie
            </h2>
            <p className="mt-4 leading-relaxed text-navy-200">
              Nie zgadujemy przepisów. Każde pismo ma stałą, sprawdzoną podstawę prawną, a Ty dostajesz dokument
              gotowy do podpisu i wysłania – razem z terminami i instrukcją.
            </p>
          </div>
          <TrustGrid />
        </Container>
      </section>

      {/* CENNIK */}
      <section aria-labelledby="cennik-heading" className="py-14 sm:py-20">
        <Container>
          <SectionHeading
            id="cennik-heading"
            eyebrow="Cennik"
            title="Płacisz tylko za gotowe pismo"
            lead="Podgląd jest bezpłatny. Płacisz dopiero, gdy chcesz pobrać pełny dokument."
            center
          />
          <div className="mt-10">
            <PricingCards compact />
          </div>
          <p className="mt-6 text-center text-sm">
            <Link href="/cennik" className="font-medium text-navy-700 underline underline-offset-2 hover:text-navy-900">
              Zobacz pełny cennik
            </Link>
          </p>
        </Container>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-heading" className="bg-navy-50/50 py-14 sm:py-20">
        <Container narrow>
          <SectionHeading id="faq-heading" eyebrow="FAQ" title="Najczęstsze pytania" center />
          <div className="mt-8">
            <Faq items={GENERAL_FAQ} />
          </div>
        </Container>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </>
  );
}
