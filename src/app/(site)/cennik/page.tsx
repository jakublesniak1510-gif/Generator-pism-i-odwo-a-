import type { Metadata } from "next";
import Link from "next/link";
import { Faq } from "@/components/Faq";
import { PricingCards } from "@/components/marketing";
import { PackageCheckout } from "@/components/payments/PackageCheckout";
import { PRICES, formatPrice } from "@/components/site";
import { CheckIcon, ContentPage } from "@/components/ui";

export const metadata: Metadata = {
  title: "Cennik",
  description: `Pojedyncze pismo z instrukcją wysyłki za ${formatPrice(PRICES.single)}, pakiet 5 pism za ${formatPrice(PRICES.pack5)}. Podgląd przed zapłatą jest bezpłatny.`,
  alternates: { canonical: "/cennik" },
};

const PRICING_FAQ = [
  {
    question: "Za co dokładnie płacę?",
    answer:
      "Za pełną treść pisma przygotowanego na podstawie Twoich odpowiedzi, pliki DOCX i PDF, instrukcję wysyłki, wyliczone terminy i listę podstaw prawnych.",
  },
  {
    question: "Czy mogę zobaczyć pismo przed zapłatą?",
    answer:
      "Tak. Po wypełnieniu formularza widzisz bezpłatny podgląd początku pisma z Twoimi danymi. Płacisz dopiero, gdy chcesz je odblokować.",
  },
  {
    question: "Jakie są metody płatności?",
    answer: "Płatności obsługuje Stripe – możesz zapłacić kartą, BLIK-iem lub szybkim przelewem (Przelewy24).",
  },
  {
    question: "Jak działa pakiet 5 pism?",
    answer:
      "Po zakupie pakietu dostajesz kod, który działa 5 razy. Przygotuj dowolne pismo, a na stronie podglądu kliknij „Mam kod pakietu lub promocyjny” i wpisz kod – pismo odblokuje się bez kolejnej płatności. Przy każdym użyciu widzisz, ile użyć zostało.",
  },
  {
    question: "Czy mogę odstąpić od umowy po zakupie?",
    answer:
      "Pismo to treść cyfrowa dostarczana natychmiast po płatności. Przed zapłatą wyrażasz zgodę na jej dostarczenie przed upływem terminu odstąpienia, co oznacza utratę prawa odstąpienia. Jeśli jednak pismo ma błąd techniczny lub nie zgadza się z Twoimi odpowiedziami – złóż reklamację, a poprawimy je albo zwrócimy pieniądze. Szczegóły w [regulaminie](/regulamin).",
  },
  {
    question: "Czy dostanę fakturę?",
    answer: "[DO UZUPEŁNIENIA – zasady wystawiania faktur / rachunków.]",
  },
];

export default function PricingPage() {
  return (
    <ContentPage
      title="Cennik"
      lead="Proste zasady: podgląd jest bezpłatny, a płacisz tylko za pismo, które chcesz pobrać."
    >
      <PricingCards />
      <p className="mt-6 text-sm text-gray-500">Ceny brutto. Sprawdzenie przez prawnika pojawi się wkrótce.</p>

      <section
        id="pakiet"
        aria-labelledby="pakiet-heading"
        className="mt-14 scroll-mt-24 rounded-2xl border border-navy-100 bg-navy-50/60 p-6 sm:p-8"
      >
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent-600">Pakiet</p>
            <h2 id="pakiet-heading" className="mt-1 text-2xl font-bold tracking-tight text-navy-900">
              Kup pakiet 5 pism – {formatPrice(PRICES.pack5)}
            </h2>
            <p className="mt-3 leading-relaxed text-gray-700">
              Dostajesz jeden kod, który odblokowuje 5 dowolnych pism. Przydaje się, gdy masz kilka spraw naraz –
              np. reklamację, odwołanie od opłaty i wypowiedzenie umowy.
            </p>
            <ol className="mt-5 space-y-2.5 text-sm text-gray-700">
              {[
                "Zapłać za pakiet – kod zobaczysz od razu po płatności.",
                "Przygotuj dowolne pismo i obejrzyj bezpłatny podgląd.",
                "Kliknij „Mam kod pakietu lub promocyjny” i wpisz kod.",
              ].map((step) => (
                <li key={step} className="flex gap-2">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-navy-700" />
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm sm:p-6">
            <PackageCheckout />
          </div>
        </div>
      </section>
      <div className="mt-14 max-w-3xl">
        <h2 className="text-2xl font-bold tracking-tight text-navy-900">Pytania o płatności</h2>
        <div className="mt-4">
          <Faq items={PRICING_FAQ} />
        </div>
        <p className="mt-8">
          <Link
            href="/#pisma"
            className="inline-flex rounded-lg bg-accent-400 px-5 py-3 font-semibold text-navy-950 hover:bg-accent-300"
          >
            Wybierz pismo
          </Link>
        </p>
      </div>
    </ContentPage>
  );
}
