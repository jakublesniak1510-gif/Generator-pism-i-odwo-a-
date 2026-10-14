import Link from "next/link";
import type { FaqItem } from "@/lib/templates/types";
import { PRICES, formatPrice } from "./site";
import { CheckIcon } from "./ui";

export const HOW_IT_WORKS_STEPS = [
  {
    title: "Wybierz pismo",
    text: "Reklamacja, odwołanie od opłaty, wypowiedzenie umowy – znajdź dokument dopasowany do Twojej sprawy.",
  },
  {
    title: "Odpowiedz na kilka pytań",
    text: "Prosty kwestionariusz krok po kroku. Każde pole ma podpowiedź, a odpowiedzi nie znikają po odświeżeniu strony.",
  },
  {
    title: "Pobierz i wyślij",
    text: "Zobacz podgląd za darmo, a po odblokowaniu pobierz DOCX i PDF wraz z instrukcją, gdzie i jak wysłać pismo.",
  },
];

export function HowItWorksSteps() {
  return (
    <ol className="grid gap-6 md:grid-cols-3">
      {HOW_IT_WORKS_STEPS.map((step, i) => (
        <li key={step.title} className="relative rounded-xl border border-navy-100 bg-white p-6 shadow-sm">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-800 text-lg font-bold text-white"
          >
            {i + 1}
          </span>
          <h3 className="mt-4 text-lg font-semibold text-navy-900">
            <span className="sr-only">Krok {i + 1}: </span>
            {step.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}

export const TRUST_POINTS = [
  {
    title: "Podstawy prawne w szablonie",
    text: "Przepisy, terminy i struktura pisma pochodzą z szablonu przygotowanego z prawnikiem. AI pomaga jedynie zredagować opis Twojej sytuacji – nie wymyśla przepisów.",
    icon: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4",
  },
  {
    title: "Podgląd za darmo",
    text: "Zanim zapłacisz, widzisz początek gotowego pisma z Twoimi danymi. Płacisz dopiero, gdy wiesz, co dostajesz.",
    icon: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z",
  },
  {
    title: "Instrukcja wysyłki",
    text: "Do pisma dołączamy instrukcję: komu i na jaki adres je wysłać, w jakiej formie oraz ile czasu ma adresat na odpowiedź.",
    icon: "M3 7l9 6 9-6M3 7h18v10H3z",
  },
  {
    title: "DOCX i PDF",
    text: "Pobierasz pismo w dwóch formatach – PDF gotowy do druku i DOCX, jeśli chcesz coś jeszcze dopisać.",
    icon: "M7 3h7l5 5v13H7zM14 3v5h5M12 11v6M9 14l3 3 3-3",
  },
];

export function TrustGrid() {
  return (
    <ul className="grid gap-5 sm:grid-cols-2">
      {TRUST_POINTS.map((p) => (
        <li key={p.title} className="flex gap-4 rounded-xl bg-white/5 p-5 ring-1 ring-white/10">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-400 text-navy-950">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={p.icon} />
            </svg>
          </span>
          <div>
            <h3 className="font-semibold text-white">{p.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-navy-200">{p.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export const PLANS = [
  {
    name: "Pojedyncze pismo",
    price: PRICES.single,
    soon: false,
    features: [
      "Pismo w formatach DOCX i PDF",
      "Instrukcja, gdzie i jak wysłać",
      "Wyliczone terminy dla Twojej sprawy",
      "Lista podstaw prawnych",
      "Bezpłatny podgląd przed zakupem",
    ],
  },
  {
    name: "Pakiet 5 pism",
    price: PRICES.pack5,
    soon: true,
    features: ["5 dowolnych pism do wykorzystania", "Wszystko, co w pojedynczym piśmie", "Ok. 11,80 zł za pismo"],
  },
  {
    name: "Sprawdzenie przez prawnika",
    price: PRICES.lawyerReview,
    soon: true,
    features: [
      "Pismo przejrzane przez prawnika",
      "Uwagi do Twojej sytuacji",
      "Poprawiona wersja dokumentu",
    ],
  },
];

export function PricingCards({ compact = false }: { compact?: boolean }) {
  return (
    <ul className="grid gap-6 md:grid-cols-3">
      {PLANS.map((plan, i) => {
        const featured = i === 0;
        return (
          <li
            key={plan.name}
            className={`relative flex flex-col rounded-2xl border bg-white p-6 ${
              featured ? "border-navy-800 shadow-lg ring-1 ring-navy-800" : "border-navy-100 shadow-sm"
            }`}
          >
            {plan.soon ? (
              <span className="absolute right-4 top-4 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                Wkrótce
              </span>
            ) : (
              <span className="absolute right-4 top-4 rounded-full bg-accent-100 px-2.5 py-0.5 text-xs font-semibold text-accent-800">
                Dostępne
              </span>
            )}
            <h3 className="pr-20 text-lg font-semibold text-navy-900">{plan.name}</h3>
            <p className="mt-3">
              <span className={`text-3xl font-bold ${plan.soon ? "text-gray-500" : "text-navy-900"}`}>
                {formatPrice(plan.price)}
              </span>
            </p>
            {!compact || featured ? (
              <ul className="mt-5 space-y-2 text-sm text-gray-700">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <CheckIcon className={`mt-0.5 h-4 w-4 shrink-0 ${plan.soon ? "text-gray-400" : "text-navy-700"}`} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-gray-600">{plan.features[0]}</p>
            )}
            <div className="mt-auto pt-6">
              {plan.soon ? (
                <span className="block rounded-lg border border-gray-200 px-4 py-2.5 text-center text-sm font-medium text-gray-500">
                  Dostępne wkrótce
                </span>
              ) : (
                <Link
                  href="/#pisma"
                  className="block rounded-lg bg-accent-400 px-4 py-2.5 text-center text-sm font-semibold text-navy-950 transition-colors hover:bg-accent-300"
                >
                  Wybierz pismo
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export const GENERAL_FAQ: FaqItem[] = [
  {
    question: "Czy pismo z PismoGotowe jest poradą prawną?",
    answer:
      "Nie. Serwis jest narzędziem do tworzenia dokumentów na podstawie szablonów. Szablony opierają się na aktualnych przepisach i są regularnie aktualizowane, ale nie analizujemy indywidualnie Twojej sprawy. Jeśli sytuacja jest skomplikowana lub chodzi o wysoką kwotę, skonsultuj się z adwokatem, radcą prawnym albo rzecznikiem konsumentów.",
  },
  {
    question: "Czy AI wymyśla przepisy w moim piśmie?",
    answer:
      "Nie. Podstawy prawne, terminy i struktura pisma są na stałe zapisane w szablonie. Sztuczna inteligencja może jedynie uporządkować i ładnie zredagować opis faktów, który podajesz w kwestionariuszu. Tekst z AI jest dodatkowo filtrowany – jeśli zawierałby odwołania do przepisów lub orzeczeń, zastępujemy go wersją z szablonu.",
  },
  {
    question: "Ile kosztuje pismo i kiedy płacę?",
    answer:
      "Pojedyncze pismo kosztuje 24,99 zł. Płacisz dopiero po zobaczeniu bezpłatnego podglądu – kartą, BLIK-iem lub szybkim przelewem.",
  },
  {
    question: "W jakim formacie dostanę dokument?",
    answer:
      "Po odblokowaniu pobierzesz pismo w formacie **PDF** (gotowe do druku i podpisu) oraz **DOCX** (do edycji w Wordzie, LibreOffice lub Google Docs).",
  },
  {
    question: "Czy muszę zakładać konto?",
    answer:
      "Nie. Dostęp do pisma daje unikalny link, który otrzymujesz po jego przygotowaniu. Zachowaj go – tylko on pozwala wrócić do dokumentu i pobrać go ponownie.",
  },
  {
    question: "Co się dzieje z moimi danymi?",
    answer:
      "Dane z kwestionariusza wykorzystujemy wyłącznie do przygotowania pisma i przechowujemy przez ograniczony czas. Szczegóły znajdziesz w [polityce prywatności](/polityka-prywatnosci).",
  },
];
