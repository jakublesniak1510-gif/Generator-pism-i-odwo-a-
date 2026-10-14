import type { Metadata } from "next";
import Link from "next/link";
import { HowItWorksSteps } from "@/components/marketing";
import { PRICES, formatPrice } from "@/components/site";
import { CheckIcon, ContentPage } from "@/components/ui";

export const metadata: Metadata = {
  title: "Jak to działa",
  description:
    "Wybierasz pismo, odpowiadasz na kilka pytań, oglądasz podgląd i pobierasz gotowy dokument DOCX/PDF z instrukcją wysyłki.",
  alternates: { canonical: "/jak-to-dziala" },
};

const DETAILS = [
  {
    title: "Szablon przygotowany z prawnikiem",
    text: "Każde pismo ma stałą strukturę, właściwe podstawy prawne i terminy. To szablon decyduje, na jakie przepisy powołuje się pismo – nie algorytm.",
  },
  {
    title: "Kwestionariusz zamiast pustej kartki",
    text: "Zadajemy tylko pytania potrzebne w Twojej sprawie: dane stron, daty, kwoty i krótki opis sytuacji. Przy każdym polu znajdziesz podpowiedź.",
  },
  {
    title: "AI tylko do redakcji faktów",
    text: "Jeśli opis sytuacji wymaga uporządkowania, model AI zredaguje go w rzeczowym, formalnym stylu. Nie dodaje przepisów, sygnatur ani orzeczeń – takie fragmenty są automatycznie odrzucane.",
  },
  {
    title: "Bezpłatny podgląd",
    text: "Po wypełnieniu formularza widzisz początek pisma z Twoimi danymi. Możesz wrócić i poprawić odpowiedzi.",
  },
  {
    title: "Płatność i pobranie",
    text: `Za ${formatPrice(PRICES.single)} odblokowujesz pełne pismo, pliki DOCX i PDF, instrukcję wysyłki oraz wyliczone terminy.`,
  },
  {
    title: "Wysyłka",
    text: "Instrukcja podpowie, na jaki adres wysłać pismo, w jakiej formie (np. list polecony za potwierdzeniem odbioru) i ile czasu ma adresat na odpowiedź.",
  },
];

export default function HowItWorksPage() {
  return (
    <ContentPage
      title="Jak to działa"
      lead="Od wyboru pisma do wysłania dokumentu – bez prawniczego żargonu i bez zakładania konta."
    >
      <HowItWorksSteps />

      <h2 className="mt-14 text-2xl font-bold tracking-tight text-navy-900">Co dzieje się „pod spodem”</h2>
      <ol className="mt-6 grid gap-4 md:grid-cols-2">
        {DETAILS.map((d) => (
          <li key={d.title} className="flex gap-3 rounded-xl border border-navy-100 bg-white p-5">
            <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" />
            <div>
              <h3 className="font-semibold text-navy-900">{d.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">{d.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-14 rounded-2xl bg-navy-900 p-6 text-white sm:p-10">
        <h2 className="text-2xl font-bold">Ważne: to nie jest porada prawna</h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-navy-100">
          PismoGotowe to narzędzie do tworzenia dokumentów. Nie analizujemy indywidualnie Twojej sprawy. Jeśli
          sytuacja jest nietypowa, chodzi o wysoką kwotę albo sprawa trafiła już do sądu – skonsultuj się z adwokatem,
          radcą prawnym lub rzecznikiem konsumentów.
        </p>
        <Link
          href="/#pisma"
          className="mt-6 inline-flex rounded-lg bg-accent-400 px-5 py-3 font-semibold text-navy-950 hover:bg-accent-300"
        >
          Wybierz pismo
        </Link>
      </div>
    </ContentPage>
  );
}
