import type { Metadata } from "next";
import Link from "next/link";
import { Faq } from "@/components/Faq";
import { PricingCards } from "@/components/marketing";
import { PRICES, formatPrice } from "@/components/site";
import { ContentPage } from "@/components/ui";

export const metadata: Metadata = {
  title: "Cennik",
  description: `Pojedyncze pismo z instrukcją wysyłki za ${formatPrice(PRICES.single)}. Podgląd przed zapłatą jest bezpłatny.`,
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
      <p className="mt-6 text-sm text-gray-500">
        Ceny brutto. Pakiet 5 pism i sprawdzenie przez prawnika pojawią się wkrótce.
      </p>
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
